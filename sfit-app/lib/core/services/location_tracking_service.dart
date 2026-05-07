import 'dart:async';
import 'dart:math' as math;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive/hive.dart';
import 'package:latlong2/latlong.dart';
import '../../features/trips/data/datasources/trips_api_service.dart';

/// Información mínima de un waypoint con su orden y etiqueta — necesaria para
/// pintar marcadores numerados y resaltar paraderos visitados.
class RouteWaypoint {
  final int order;
  final double lat;
  final double lng;
  final String? label;

  const RouteWaypoint({
    required this.order,
    required this.lat,
    required this.lng,
    this.label,
  });

  LatLng get latLng => LatLng(lat, lng);
}

class TrackingState {
  final String? entryId;
  final String? routeId;
  final bool isTracking;
  final List<LatLng> localTrack;
  final List<RouteWaypoint> routeWaypoints;
  final LatLng? currentPosition;
  final double? currentAccuracy;

  /// Índices (`waypoint.order`) de paraderos detectados como visitados.
  final Set<int> visitedStopIndices;

  /// Etiqueta del último paradero recién detectado (null = ninguno reciente).
  /// Pensado para mostrar feedback efímero ("Pasaste por: Plaza Mayor").
  final String? lastVisitedLabel;

  /// Cantidad de puntos GPS descartados por baja precisión durante esta sesión.
  /// Útil para diagnóstico ("descartados X puntos por accuracy > 50m").
  final int discardedLowAccuracy;

  /// Indica si el backend detectó que el bus está fuera de ruta.
  final bool isOffRoute;

  /// Tamaño actual de la cola offline (puntos pendientes de envío). > 0
  /// indica problemas de red — la UI puede mostrar un badge "Sin conexión".
  final int queuedPoints;

  /// Cantidad acumulada (persistida) de puntos descartados por overflow del
  /// box (cola llena al máximo). Útil para diagnóstico.
  final int droppedByOverflow;

  const TrackingState({
    this.entryId,
    this.routeId,
    this.isTracking = false,
    this.localTrack = const [],
    this.routeWaypoints = const [],
    this.currentPosition,
    this.currentAccuracy,
    this.visitedStopIndices = const <int>{},
    this.lastVisitedLabel,
    this.discardedLowAccuracy = 0,
    this.isOffRoute = false,
    this.queuedPoints = 0,
    this.droppedByOverflow = 0,
  });

  TrackingState copyWith({
    String? entryId,
    String? routeId,
    bool? isTracking,
    List<LatLng>? localTrack,
    List<RouteWaypoint>? routeWaypoints,
    LatLng? currentPosition,
    double? currentAccuracy,
    Set<int>? visitedStopIndices,
    Object? lastVisitedLabel = _kSentinel,
    int? discardedLowAccuracy,
    bool? isOffRoute,
    int? queuedPoints,
    int? droppedByOverflow,
  }) => TrackingState(
    entryId: entryId ?? this.entryId,
    routeId: routeId ?? this.routeId,
    isTracking: isTracking ?? this.isTracking,
    localTrack: localTrack ?? this.localTrack,
    routeWaypoints: routeWaypoints ?? this.routeWaypoints,
    currentPosition: currentPosition ?? this.currentPosition,
    currentAccuracy: currentAccuracy ?? this.currentAccuracy,
    visitedStopIndices: visitedStopIndices ?? this.visitedStopIndices,
    lastVisitedLabel:
        lastVisitedLabel == _kSentinel
            ? this.lastVisitedLabel
            : lastVisitedLabel as String?,
    discardedLowAccuracy: discardedLowAccuracy ?? this.discardedLowAccuracy,
    isOffRoute: isOffRoute ?? this.isOffRoute,
    queuedPoints: queuedPoints ?? this.queuedPoints,
    droppedByOverflow: droppedByOverflow ?? this.droppedByOverflow,
  );

  static const _kSentinel = Object();
}

/// Resultado de la verificación inicial de permisos.
enum LocationPermissionResult {
  granted,
  serviceDisabled,
  denied,
  deniedForever,
}

class LocationTrackingNotifier extends StateNotifier<TrackingState> {
  final TripsApiService _svc;

  StreamSubscription<Position>? _positionSub;
  StreamSubscription<List<ConnectivityResult>>? _connSub;
  Timer? _heartbeat;
  Timer? _drainRetryTimer;

  /// Última posición conocida. La usa el heartbeat para mantener "vivo" al
  /// bus en el mapa público aunque esté detenido (sin movimiento → sin
  /// emisiones del stream con distanceFilter > 0).
  Position? _lastPosition;
  DateTime _lastSendAt = DateTime.fromMillisecondsSinceEpoch(0);

  /// Periodo del heartbeat: si no enviamos un punto en este tiempo, mandamos
  /// la última posición conocida. Mantiene al bus visible para ciudadanos
  /// con la ventana de 2min anti-fantasma del backend.
  static const Duration _heartbeatPeriod = Duration(seconds: 25);

  /// Distancia mínima (m) que debe moverse el bus para emitir un punto. Más
  /// alto = mejor batería, peor resolución del trazo.
  static const int _distanceFilterMeters = 5;

  /// Filtro de calidad: descartar puntos con accuracy mayor a este umbral (m).
  static const double _accuracyThresholdMeters = 50;

  /// Box Hive para puntos pendientes de envío. ES la fuente de verdad: TODO
  /// punto del stream se encola primero y un drain loop intenta subirlos.
  static const String _queueBoxName = 'location_queue_v1';

  /// Box Hive para metadata persistente (contador de descartes por overflow).
  /// Independiente del queue para no perder el contador al limpiar la cola.
  static const String _metaBoxName = 'location_meta_v1';
  static const String _kDroppedKey = '_dropped';

  /// Capacidad máxima de la cola en disco. Al rebasarla descartamos los más
  /// viejos pero seguimos aceptando nuevos puntos (mejor perder histórico
  /// que romper la captura).
  static const int _maxQueueSize = 5000;

  /// Pace entre envíos en el drain — el backend rate-limita a 60/min (1 Hz)
  /// por conductor; dejamos margen.
  static const Duration _drainPace = Duration(milliseconds: 1100);

  /// Backoff exponencial al fallar el drain. Empieza en 2s, dobla hasta 60s.
  static const Duration _backoffBase = Duration(seconds: 2);
  static const Duration _backoffMax = Duration(seconds: 60);

  Box<Map<dynamic, dynamic>>? _queue;
  Box? _meta;
  bool _draining = false;

  /// Cantidad de fallos consecutivos en el drain. Resetea a 0 al primer
  /// envío exitoso. Determina la espera del próximo intento (backoff).
  int _consecutiveFailures = 0;

  LocationTrackingNotifier(this._svc) : super(const TrackingState()) {
    // Drain al boot del notifier: si quedaron puntos de un turno previo en
    // disco, intentar subirlos sin esperar a que el conductor inicie un
    // turno nuevo. El backend acepta pings de turnos cerrados (busca por
    // _id; sólo verifica que driverId coincida con el conductor autenticado).
    unawaited(_bootDrain());
  }

  Future<void> _bootDrain() async {
    try {
      await _ensureBoxesOpen();
      // Refleja el estado persistido al inicio (puntos en cola y descartes).
      state = state.copyWith(
        queuedPoints: _queue?.length ?? 0,
        droppedByOverflow: _readDroppedCount(),
      );
      if ((_queue?.isNotEmpty ?? false)) {
        // No await: el drain corre en background mientras el constructor
        // termina. Si falla, programa retry con backoff.
        unawaited(_drainQueue());
      }
    } catch (_) {
      // No bloquear el arranque por errores de Hive.
    }
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _connSub?.cancel();
    _heartbeat?.cancel();
    _drainRetryTimer?.cancel();
    super.dispose();
  }

  /// Pide permisos GPS de forma explícita y bloqueante. Llamar desde
  /// la pantalla de checkin ANTES de permitir avanzar.
  Future<LocationPermissionResult> ensurePermissions() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return LocationPermissionResult.serviceDisabled;

    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    switch (perm) {
      case LocationPermission.always:
      case LocationPermission.whileInUse:
        return LocationPermissionResult.granted;
      case LocationPermission.deniedForever:
        return LocationPermissionResult.deniedForever;
      case LocationPermission.denied:
      case LocationPermission.unableToDetermine:
        return LocationPermissionResult.denied;
    }
  }

  /// Inicia tracking para un FleetEntry. Llamar desde TripCheckinPage tras
  /// confirmar permisos otorgados.
  ///
  /// Internamente arranca un foreground service Android (vía
  /// `getPositionStream`) que mantiene el GPS funcionando aunque la pantalla
  /// se apague o la app pase a segundo plano.
  Future<void> startTracking(String entryId, {String? routeId}) async {
    await _stopStreamsKeepState();
    await _ensureBoxesOpen();

    // Drenar cualquier residuo en cola (puede ser de turnos previos abortados
    // por kill de la app). El backend acepta pings de turnos cerrados.
    unawaited(_drainQueue());

    final waypoints = await _loadRouteWaypoints(routeId);
    final pos = await _safeGetPosition();

    state = TrackingState(
      entryId: entryId,
      routeId: routeId,
      isTracking: true,
      routeWaypoints: waypoints,
      localTrack:
          pos != null ? [LatLng(pos.latitude, pos.longitude)] : const [],
      currentPosition: pos != null ? LatLng(pos.latitude, pos.longitude) : null,
      currentAccuracy: pos?.accuracy,
      queuedPoints: _queue?.length ?? 0,
      droppedByOverflow: _readDroppedCount(),
    );

    if (pos != null) {
      _lastPosition = pos;
      await _enqueue(entryId, pos, 'start');
    }

    _startStreams(entryId);
  }

  /// Carga puntos existentes del backend y reanuda tracking (app reabierta).
  Future<void> resumeTracking(String entryId, {String? routeId}) async {
    if (state.isTracking && state.entryId == entryId) return;
    await _stopStreamsKeepState();
    await _ensureBoxesOpen();

    // Drenar cola pendiente de turnos anteriores antes de empezar a tomar
    // puntos nuevos. Si el conductor estuvo offline en su turno previo y la
    // app fue matada, esos puntos siguen en disco.
    unawaited(_drainQueue());

    List<LatLng> existing = const [];
    Set<int> visited = const <int>{};
    try {
      final hist = await _svc.getTrackHistory(entryId);
      existing =
          hist.trackPoints.map((p) => LatLng(p['lat']!, p['lng']!)).toList();
      visited =
          hist.visitedStops.map((s) => (s['stopIndex'] as num).toInt()).toSet();
    } catch (_) {
      // El usuario verá el estado vacío; el tracking se reanuda desde aquí.
    }

    final waypoints = await _loadRouteWaypoints(routeId);
    final pos = await _safeGetPosition();
    final ll = pos != null ? LatLng(pos.latitude, pos.longitude) : null;
    final track = [...existing, if (ll != null) ll];

    state = TrackingState(
      entryId: entryId,
      routeId: routeId,
      isTracking: true,
      localTrack: track,
      routeWaypoints: waypoints,
      currentPosition: ll,
      currentAccuracy: pos?.accuracy,
      visitedStopIndices: visited,
      queuedPoints: _queue?.length ?? 0,
      droppedByOverflow: _readDroppedCount(),
    );

    if (pos != null) _lastPosition = pos;
    _startStreams(entryId);
  }

  Future<List<RouteWaypoint>> _loadRouteWaypoints(String? routeId) async {
    if (routeId == null) return const [];
    try {
      final raw = await _svc.getRouteWaypointsDetailed(routeId);
      return raw
          .map(
            (p) => RouteWaypoint(
              order: (p['order'] as num).toInt(),
              lat: (p['lat'] as num).toDouble(),
              lng: (p['lng'] as num).toDouble(),
              label: p['label'] as String?,
            ),
          )
          .toList();
    } catch (_) {
      return const [];
    }
  }

  /// Detiene tracking. Llamar desde TripCheckoutPage. Antes de cortar el
  /// stream, intenta drenar la cola para no perder puntos pendientes.
  Future<void> stopTracking() async {
    final entryId = state.entryId;
    if (entryId != null) {
      // Si no tenemos _lastPosition (el stream nunca emitió un punto válido
      // durante el turno), pedimos uno fresco con timeout corto. Sin esto,
      // `endLocation` y `distanceMeters` no se calculan en el backend.
      final endPos = _lastPosition ?? await _safeGetPosition();
      if (endPos != null) {
        await _enqueue(entryId, endPos, 'end');
      }
    }
    // Drain final con timeout — si la red está caída, se quedan en el box
    // y se mandarán al volver (o al próximo arranque de la app, vía
    // _bootDrain).
    try {
      await _drainQueue().timeout(const Duration(seconds: 5));
    } catch (_) {/* best-effort */}

    await _stopStreamsKeepState();
    state = TrackingState(
      queuedPoints: _queue?.length ?? 0,
      droppedByOverflow: _readDroppedCount(),
    );
  }

  Future<void> _stopStreamsKeepState() async {
    await _positionSub?.cancel();
    _positionSub = null;
    await _connSub?.cancel();
    _connSub = null;
    _heartbeat?.cancel();
    _heartbeat = null;
    // OJO: NO cancelamos _drainRetryTimer — el drain debe seguir intentando
    // subir puntos pendientes incluso después de cerrar el turno.
  }

  /// Limpia el feedback efímero de "último paradero" después de mostrarlo.
  void clearLastVisitedLabel() {
    if (state.lastVisitedLabel != null) {
      state = state.copyWith(lastVisitedLabel: null);
    }
  }

  void _startStreams(String entryId) {
    // Stream de posición con foreground service Android. El servicio mantiene
    // el GPS activo aunque se apague la pantalla o la app esté en background.
    final settings = AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: _distanceFilterMeters,
      forceLocationManager: false,
      intervalDuration: const Duration(seconds: 5),
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'SFIT — Turno en curso',
        notificationText:
            'Compartiendo tu ubicación con los pasajeros y la municipalidad',
        notificationChannelName: 'sfit_tracking',
        enableWakeLock: true,
        setOngoing: true,
      ),
    );
    _positionSub = Geolocator.getPositionStream(locationSettings: settings)
        .listen(_onPosition, onError: (_) {/* el stream se reanuda solo */});

    // Heartbeat: si no enviamos hace 25s (bus parado, sin movimiento), mandamos
    // la última posición conocida para mantener visible al bus para ciudadanos.
    _heartbeat = Timer.periodic(_heartbeatPeriod, (_) => _onHeartbeat(entryId));

    // Drain de cola al recuperar conectividad.
    _connSub = Connectivity().onConnectivityChanged.listen((results) {
      final hasNet = results.any((r) => r != ConnectivityResult.none);
      if (hasNet) {
        // Resetear backoff: vuelve la red, hay que reintentar ya.
        _consecutiveFailures = 0;
        _drainRetryTimer?.cancel();
        _drainRetryTimer = null;
        unawaited(_drainQueue());
      }
    });
  }

  void _onPosition(Position pos) {
    final entryId = state.entryId;
    if (entryId == null || !state.isTracking) return;

    if (pos.accuracy > _accuracyThresholdMeters) {
      state = state.copyWith(
        discardedLowAccuracy: state.discardedLowAccuracy + 1,
        currentAccuracy: pos.accuracy,
      );
      return;
    }

    _lastPosition = pos;
    final ll = LatLng(pos.latitude, pos.longitude);
    final newTrack = [...state.localTrack, ll];
    if (newTrack.length > 500) {
      newTrack.removeRange(0, newTrack.length - 500);
    }
    state = state.copyWith(
      currentPosition: ll,
      currentAccuracy: pos.accuracy,
      localTrack: newTrack,
    );
    // Cola = fuente de verdad: encolar siempre primero, luego dejar que el
    // drain loop intente subirlo. Esto garantiza que ningún punto se pierda
    // si la red cae justo en medio del envío.
    unawaited(_enqueue(entryId, pos, null));
  }

  void _onHeartbeat(String entryId) {
    final since = DateTime.now().difference(_lastSendAt);
    if (since < _heartbeatPeriod) return;
    final pos = _lastPosition;
    if (pos == null) return;
    unawaited(_enqueue(entryId, pos, null));
  }

  Future<Position?> _safeGetPosition() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      ).timeout(const Duration(seconds: 8));
    } catch (_) {
      return null;
    }
  }

  // ─── Persistencia ───────────────────────────────────────────────────────

  Future<void> _ensureBoxesOpen() async {
    if (_queue == null || !_queue!.isOpen) {
      _queue = await Hive.openBox<Map<dynamic, dynamic>>(_queueBoxName);
    }
    if (_meta == null || !_meta!.isOpen) {
      _meta = await Hive.openBox(_metaBoxName);
    }
  }

  int _readDroppedCount() {
    final m = _meta;
    if (m == null || !m.isOpen) return 0;
    final v = m.get(_kDroppedKey);
    return v is int ? v : 0;
  }

  Future<void> _bumpDroppedCount(int by) async {
    final m = _meta;
    if (m == null || !m.isOpen) return;
    final current = _readDroppedCount();
    await m.put(_kDroppedKey, current + by);
  }

  /// Encola un punto. Si la cola está llena (> _maxQueueSize), descarta el
  /// más viejo PERO incrementa el contador persistido en `_meta` para no
  /// perder visibilidad del descarte. Es preferible perder puntos viejos
  /// que romper la captura.
  Future<void> _enqueue(String entryId, Position pos, String? action) async {
    await _ensureBoxesOpen();
    final box = _queue;
    if (box == null) return;

    if (box.length >= _maxQueueSize) {
      // Eliminar el más viejo (FIFO) y registrar el descarte en disco.
      final firstKey = box.keys.isNotEmpty ? box.keys.first : null;
      if (firstKey != null) await box.delete(firstKey);
      await _bumpDroppedCount(1);
    }

    await box.add(<String, dynamic>{
      'entryId': entryId,
      'lat': pos.latitude,
      'lng': pos.longitude,
      'accuracy': pos.accuracy,
      'speed': pos.speed >= 0 ? pos.speed : null,
      'action': action,
      'ts': DateTime.now().millisecondsSinceEpoch,
    });

    state = state.copyWith(
      queuedPoints: box.length,
      droppedByOverflow: _readDroppedCount(),
    );

    // Disparar drain para vaciar el punto recién encolado lo antes posible.
    // Si ya hay un drain en curso (o un retry programado), no hace nada.
    unawaited(_drainQueue());
  }

  // ─── Drain con backoff exponencial ──────────────────────────────────────

  /// Drena la cola offline en orden FIFO. Se llama:
  ///   - tras encolar un punto nuevo (best-effort),
  ///   - al recuperar conectividad,
  ///   - desde el constructor (boot drain),
  ///   - desde un timer de retry tras un fallo (con backoff exponencial).
  Future<void> _drainQueue() async {
    if (_draining) return;
    await _ensureBoxesOpen();
    final box = _queue;
    if (box == null || box.isEmpty) return;
    _draining = true;
    try {
      final keys = box.keys.toList();
      for (final key in keys) {
        final raw = box.get(key);
        if (raw == null) continue;
        final item = Map<String, dynamic>.from(raw);
        try {
          await _svc.sendLocation(
            entryId: item['entryId'] as String,
            lat: (item['lat'] as num).toDouble(),
            lng: (item['lng'] as num).toDouble(),
            accuracy: (item['accuracy'] as num?)?.toDouble(),
            speed: (item['speed'] as num?)?.toDouble(),
            action: item['action'] as String?,
          ).then(_applyServerResponse);
          await box.delete(key);
          // Resetear backoff al primer éxito.
          _consecutiveFailures = 0;
          _lastSendAt = DateTime.now();
          // Pace para no toparse con rate limit (60/min) del backend.
          await Future<void>.delayed(_drainPace);
        } catch (_) {
          // Si falla un punto, paramos el drain — programa retry con backoff
          // y se reintentará al recuperar la red o vencer el timer.
          _consecutiveFailures++;
          _scheduleRetry();
          break;
        }
      }
    } finally {
      _draining = false;
      state = state.copyWith(
        queuedPoints: box.length,
        droppedByOverflow: _readDroppedCount(),
      );
    }
  }

  /// Programa un reintento del drain con backoff exponencial.
  /// 2s, 4s, 8s, 16s, 32s, máx 60s.
  void _scheduleRetry() {
    _drainRetryTimer?.cancel();
    if (_consecutiveFailures <= 0) return;
    // 2 ^ (n-1) * base, capado a _backoffMax.
    final exp = math.min(_consecutiveFailures - 1, 10);
    final raw = _backoffBase * math.pow(2, exp).toInt();
    final wait = raw > _backoffMax ? _backoffMax : raw;
    _drainRetryTimer = Timer(wait, () {
      _drainRetryTimer = null;
      unawaited(_drainQueue());
    });
  }

  void _applyServerResponse(Map<String, dynamic> data) {
    final isOffRoute = data['isOffRoute'] as bool? ?? false;
    final newly = data['newlyVisited'] as Map?;
    if (newly != null) {
      final stopIndex = (newly['stopIndex'] as num?)?.toInt();
      if (stopIndex != null) {
        final updated = {...state.visitedStopIndices, stopIndex};
        state = state.copyWith(
          visitedStopIndices: updated,
          lastVisitedLabel:
              newly['label'] as String? ?? 'Paradero $stopIndex',
          isOffRoute: isOffRoute,
        );
        return;
      }
    }
    if (state.isOffRoute != isOffRoute) {
      state = state.copyWith(isOffRoute: isOffRoute);
    }
  }
}

final locationTrackingProvider =
    StateNotifierProvider<LocationTrackingNotifier, TrackingState>((ref) {
      final svc = ref.watch(tripsApiServiceProvider);
      return LocationTrackingNotifier(svc);
    });
