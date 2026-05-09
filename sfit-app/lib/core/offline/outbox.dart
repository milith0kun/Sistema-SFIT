import 'dart:async';
import 'dart:math' as math;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:hive/hive.dart';

/// Cola offline genérica para POSTs que pueden ejecutarse sin red.
///
/// Patrón extraído de `location_tracking_service.dart`:
///   - Box Hive con cap configurable (FIFO si rebasa).
///   - Drain con backoff exponencial al fallar la red.
///   - Listener de `connectivity_plus` para retry on reconnect.
///   - Idempotency key UUIDv4 client-side por item — el backend la usa
///     para deduplicar reintentos (header `Idempotency-Key`).
///
/// Cada feature instancia su propio `Outbox` con un nombre único de box
/// (`sanctions_outbox_v1`, `reports_outbox_v1`, etc). El `sender`
/// implementa la llamada HTTP: recibe el payload + key y debe lanzar
/// excepción si el envío falla — la excepción dispara el backoff.
///
/// Diferencia clave con `location_tracking_service`: aquí el cliente
/// puede esperar el resultado del primer intento si quiere mostrar
/// confirmación inmediata. `enqueueAndTrySend` retorna `true` si el
/// envío directo funcionó, `false` si quedó encolado para retry.
class Outbox {
  /// Nombre del box Hive. Debe ser único por feature
  /// (ej. `sanctions_outbox_v1`).
  final String boxName;

  /// Tamaño máximo de la cola en disco. Al rebasar, se descarta el más
  /// viejo (FIFO) y se incrementa el contador `_dropped` en el meta.
  final int maxQueueSize;

  /// Función que ejecuta el POST contra el backend. Recibe el payload
  /// original + la idempotencyKey. Debe lanzar si falla (red, 5xx, etc).
  /// Si lanza, el item queda en cola y se reintentará con backoff.
  final Future<void> Function(Map<String, dynamic> payload, String idempotencyKey)
      sender;

  /// Pace entre envíos en el drain (rate limit del backend).
  final Duration drainPace;

  /// Backoff exponencial al fallar.
  final Duration backoffBase;
  final Duration backoffMax;

  Box<Map<dynamic, dynamic>>? _box;
  Box? _meta;

  /// Stream broadcast con el conteo actual de items en cola. Para UI:
  /// banners "X cambios pendientes". Emite cada vez que cambia.
  final _countCtrl = StreamController<int>.broadcast();
  Stream<int> get queueCount => _countCtrl.stream;
  int _lastCount = 0;
  int get currentQueueCount => _lastCount;

  StreamSubscription<List<ConnectivityResult>>? _connSub;
  Timer? _retryTimer;
  bool _draining = false;
  int _consecutiveFailures = 0;

  static const String _kDroppedKey = '_dropped';
  static const String _kIdempotencyKey = 'idempotencyKey';

  Outbox({
    required this.boxName,
    required this.sender,
    this.maxQueueSize = 500,
    this.drainPace = const Duration(milliseconds: 300),
    this.backoffBase = const Duration(seconds: 2),
    this.backoffMax = const Duration(seconds: 60),
  });

  Future<void> init() async {
    if (_box == null || !_box!.isOpen) {
      _box = await Hive.openBox<Map<dynamic, dynamic>>(boxName);
    }
    if (_meta == null || !_meta!.isOpen) {
      _meta = await Hive.openBox('${boxName}_meta');
    }
    _emit();
    _connSub ??= Connectivity().onConnectivityChanged.listen((results) {
      final hasNet = results.any((r) => r != ConnectivityResult.none);
      if (hasNet) {
        _consecutiveFailures = 0;
        _retryTimer?.cancel();
        _retryTimer = null;
        unawaited(drain());
      }
    });
    // Boot drain: si quedaron items de una sesión anterior.
    if ((_box?.isNotEmpty ?? false)) {
      unawaited(drain());
    }
  }

  Future<void> dispose() async {
    await _connSub?.cancel();
    _connSub = null;
    _retryTimer?.cancel();
    _retryTimer = null;
    await _countCtrl.close();
  }

  /// Intenta enviar `payload` directamente; si falla, lo encola y
  /// devuelve `false`. Si succeed devuelve `true`. La idempotencyKey
  /// se genera aquí — el sender debe pasarla en el header
  /// `Idempotency-Key` para que el backend deduplique reintentos.
  Future<bool> enqueueAndTrySend(Map<String, dynamic> payload) async {
    await init();
    final key = _makeIdempotencyKey();
    final wrapped = <String, dynamic>{
      ...payload,
      _kIdempotencyKey: key,
    };
    try {
      await sender(payload, key);
      return true;
    } catch (_) {
      // Network/5xx: persistir y reintentar más tarde.
      await _enqueue(wrapped);
      return false;
    }
  }

  /// Variante "siempre encola" — para casos donde el caller no quiere
  /// esperar la respuesta (fire-and-forget, alta frecuencia). Por ej.
  /// el location tracking. El drain decide cuándo subirlo.
  Future<void> enqueue(Map<String, dynamic> payload) async {
    await init();
    final key = _makeIdempotencyKey();
    await _enqueue({...payload, _kIdempotencyKey: key});
    unawaited(drain());
  }

  Future<void> _enqueue(Map<String, dynamic> payload) async {
    final box = _box;
    if (box == null) return;
    if (box.length >= maxQueueSize) {
      final firstKey = box.keys.isNotEmpty ? box.keys.first : null;
      if (firstKey != null) await box.delete(firstKey);
      final m = _meta;
      if (m != null) {
        final v = m.get(_kDroppedKey);
        await m.put(_kDroppedKey, (v is int ? v : 0) + 1);
      }
    }
    await box.add(payload);
    _emit();
  }

  /// Drena la cola en orden FIFO. Se llama:
  ///   - tras `enqueue` (best-effort).
  ///   - al recuperar conectividad.
  ///   - desde el constructor si quedaron items.
  ///   - desde un retry timer tras fallo (con backoff).
  Future<void> drain() async {
    if (_draining) return;
    await init();
    final box = _box;
    if (box == null || box.isEmpty) return;
    _draining = true;
    try {
      final keys = box.keys.toList();
      for (final key in keys) {
        final raw = box.get(key);
        if (raw == null) continue;
        final item = Map<String, dynamic>.from(raw);
        final idempotencyKey =
            item[_kIdempotencyKey] as String? ?? _makeIdempotencyKey();
        // Limpiar la key del payload para que el sender reciba el
        // payload original — la key va aparte como argumento.
        final payload = Map<String, dynamic>.from(item)
          ..remove(_kIdempotencyKey);
        try {
          await sender(payload, idempotencyKey);
          await box.delete(key);
          _consecutiveFailures = 0;
          await Future<void>.delayed(drainPace);
        } catch (_) {
          _consecutiveFailures++;
          _scheduleRetry();
          break;
        }
      }
    } finally {
      _draining = false;
      _emit();
    }
  }

  void _scheduleRetry() {
    _retryTimer?.cancel();
    if (_consecutiveFailures <= 0) return;
    final exp = math.min(_consecutiveFailures - 1, 10);
    final raw = backoffBase * math.pow(2, exp).toInt();
    final wait = raw > backoffMax ? backoffMax : raw;
    _retryTimer = Timer(wait, () {
      _retryTimer = null;
      unawaited(drain());
    });
  }

  void _emit() {
    final n = _box?.length ?? 0;
    if (n != _lastCount) {
      _lastCount = n;
      _countCtrl.add(n);
    }
  }

  /// UUIDv4 client-side. Suficiente para idempotencia (no es token de
  /// seguridad). Evita una dependencia extra como `uuid`.
  String _makeIdempotencyKey() {
    final rand = math.Random.secure();
    final bytes = List<int>.generate(16, (_) => rand.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }
}
