import 'dart:async';
import 'dart:io' show SocketException;
import 'dart:math' as math;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleState, WidgetsBindingObserver, WidgetsBinding;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive/hive.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  /// Trazo histórico COMPLETO del turno (no se trunca). Es la fuente de verdad
  /// para dibujar la línea oro de "por dónde he pasado" desde el inicio del
  /// turno hasta el último ping. Nunca se descartan puntos antiguos: aunque
  /// la lista crezca a miles de puntos, el render de la polyline en
  /// flutter_map es eficiente (línea simple sin markers por punto).
  final List<LatLng> localTrack;

  /// Últimos N puntos del trazo, usados para resaltar el "tramo reciente"
  /// con un color/grosor distinto sobre el histórico. Sirve para que el
  /// conductor vea con claridad dónde está el progreso vivo sin perder
  /// la referencia de inicio→fin.
  final List<LatLng> recentTrack;
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

  /// Conteo de envíos consecutivos fallidos. Se resetea al primer éxito.
  /// Útil para que la UI muestre un indicador ámbar cuando >= 3 (problema
  /// de red persistente). Espejo del campo privado del notifier.
  final int consecutiveFailures;

  /// Última vez que un ping logró subirse al backend (ping individual o
  /// chunk de bulk). `null` o epoch 0 si nunca. La UI lo usa para detectar
  /// gaps: si `now - lastSuccessfulSend > 5min` durante turno activo,
  /// algo está mal.
  final DateTime? lastSuccessfulSend;

  /// `true` si Android NO tiene a SFIT excluida del battery optimization.
  /// La UI muestra un banner sugiriendo configurarlo. Se evalúa al iniciar
  /// turno y al volver del background.
  final bool needsBatteryExemption;

  /// `true` si al boot detectamos un `active_entry_id` persistido cuyo
  /// último ping en `location_track_v2` es de hace >10min — señal de que
  /// un turno anterior quedó sin cerrar (kill/reboot/crash). El dashboard
  /// del conductor muestra un banner ofreciendo cerrarlo o reanudarlo.
  final bool wasInterrupted;

  const TrackingState({
    this.entryId,
    this.routeId,
    this.isTracking = false,
    this.localTrack = const [],
    this.recentTrack = const [],
    this.routeWaypoints = const [],
    this.currentPosition,
    this.currentAccuracy,
    this.visitedStopIndices = const <int>{},
    this.lastVisitedLabel,
    this.discardedLowAccuracy = 0,
    this.isOffRoute = false,
    this.queuedPoints = 0,
    this.droppedByOverflow = 0,
    this.consecutiveFailures = 0,
    this.lastSuccessfulSend,
    this.needsBatteryExemption = false,
    this.wasInterrupted = false,
  });

  TrackingState copyWith({
    String? entryId,
    String? routeId,
    bool? isTracking,
    List<LatLng>? localTrack,
    List<LatLng>? recentTrack,
    List<RouteWaypoint>? routeWaypoints,
    LatLng? currentPosition,
    double? currentAccuracy,
    Set<int>? visitedStopIndices,
    Object? lastVisitedLabel = _kSentinel,
    int? discardedLowAccuracy,
    bool? isOffRoute,
    int? queuedPoints,
    int? droppedByOverflow,
    int? consecutiveFailures,
    Object? lastSuccessfulSend = _kSentinel,
    bool? needsBatteryExemption,
    bool? wasInterrupted,
  }) => TrackingState(
    entryId: entryId ?? this.entryId,
    routeId: routeId ?? this.routeId,
    isTracking: isTracking ?? this.isTracking,
    localTrack: localTrack ?? this.localTrack,
    recentTrack: recentTrack ?? this.recentTrack,
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
    consecutiveFailures: consecutiveFailures ?? this.consecutiveFailures,
    lastSuccessfulSend:
        lastSuccessfulSend == _kSentinel
            ? this.lastSuccessfulSend
            : lastSuccessfulSend as DateTime?,
    needsBatteryExemption: needsBatteryExemption ?? this.needsBatteryExemption,
    wasInterrupted: wasInterrupted ?? this.wasInterrupted,
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

class LocationTrackingNotifier extends StateNotifier<TrackingState>
    with WidgetsBindingObserver {
  final TripsApiService _svc;

  StreamSubscription<Position>? _positionSub;
  Timer? _healthTimer;
  StreamSubscription<List<ConnectivityResult>>? _connSub;
  Timer? _heartbeat;
  Timer? _drainRetryTimer;

  /// Última posición conocida. La usa el heartbeat para mantener "vivo" al
  /// bus en el mapa público aunque esté detenido (sin movimiento → sin
  /// emisiones del stream con distanceFilter > 0).
  Position? _lastPosition;
  DateTime _lastSendAt = DateTime.fromMillisecondsSinceEpoch(0);

  /// Último ping encolado — para deduplicar emisiones cercanas en tiempo y
  /// espacio. Si llegan dos puntos casi idénticos en < 100 ms y < 1 m,
  /// descartamos el segundo (heartbeat duplicado, race en check-in, etc.).
  int _lastEnqueuedTs = 0;
  double _lastEnqueuedLat = 0;
  double _lastEnqueuedLng = 0;

  /// TTL para pings antiguos en la cola. Subido a 7 días para que rutas
  /// largas en zonas remotas (Andes, selva) sin señal varios días NO
  /// pierdan datos al re-conectar. Antes era 24h y se perdían pings legítimos
  /// cuando el conductor pasaba >1 día sin internet.
  static const Duration _queuePingTtl = Duration(days: 7);

  /// Periodo del heartbeat: si no enviamos un punto en este tiempo, mandamos
  /// la última posición conocida. Mantiene al bus visible para ciudadanos
  /// con la ventana de 2min anti-fantasma del backend.
  static const Duration _heartbeatPeriod = Duration(seconds: 25);

  /// Distancia mínima (m) que debe moverse el bus para emitir un punto del
  /// stream. Bajado de 5m → 3m para mejor resolución del trazo en zonas
  /// urbanas con tráfico lento. El heartbeat (cada 25s) garantiza pings
  /// adicionales aunque el bus esté detenido.
  static const int _distanceFilterMeters = 3;

  /// Umbral DURO de accuracy: pings con accuracy peor que esto se descartan
  /// (probablemente GPS recién encendido o reflejado por edificio gigante).
  /// Antes era 50m, lo subimos a 100m para no perder datos en zonas con
  /// edificios altos o clima nublado donde un accuracy de 60-80m es lo mejor
  /// que el GPS puede ofrecer y aún así es útil para trazar la ruta.
  /// Por encima de 100m el punto es lo bastante impreciso como para que la
  /// línea trazada se vea peor incluyéndolo que omitiéndolo.
  static const double _accuracyThresholdMeters = 100;

  /// Tamaño de la ventana de "tramo reciente". Los últimos N puntos se
  /// re-pintan con un color/grosor distinto encima del histórico para que
  /// el conductor distinga visualmente el progreso vivo.
  static const int _recentTrackWindow = 80;

  /// Límite máximo de puntos en `state.localTrack`. Mantiene la UI fluida
  /// en rutas largas (8h+) donde la lista crecería a 10000+ puntos y cada
  /// `state.copyWith` re-clonaría la lista entera cada ping → memory
  /// pressure + UI lag al estar en el tab Mapa.
  ///
  /// El histórico COMPLETO (sin truncar) vive en el Hive box
  /// `location_track_v2` que se lee al cerrar turno o en
  /// `trip_summary_page` para reconstruir la ruta full. Aquí solo
  /// guardamos los últimos N puntos para visualización en vivo. Cuando
  /// se llega al tope, descartamos los más viejos del state (no del box).
  /// 3000 puntos cubren cómodamente 4-5h de visualización en vivo a 3m
  /// de distance filter, suficiente para que el conductor vea el progreso
  /// reciente. El usuario revisa el track completo después en el resumen.
  static const int _stateLocalTrackMax = 3000;

  /// Box Hive para puntos pendientes de envío. ES la fuente de verdad: TODO
  /// punto del stream se encola primero y un drain loop intenta subirlos.
  static const String _queueBoxName = 'location_queue_v1';

  /// Box Hive para metadata persistente (contador de descartes por overflow).
  /// Independiente del queue para no perder el contador al limpiar la cola.
  static const String _metaBoxName = 'location_meta_v1';
  static const String _kDroppedKey = '_dropped';

  /// Box Hive con cache de waypoints por `routeId`. Permite que la ruta
  /// planificada siga visible offline (al reabrir la app sin red, o si el
  /// API falla en mitad del turno). Estructura por entrada:
  /// `{ 'waypoints': [{order,lat,lng,label}, ...], 'cachedAt': epochMs }`.
  static const String _routeCacheBoxName = 'route_polyline_v1';

  /// Clave en SharedPreferences donde se persiste el `entryId` del turno
  /// activo. El WorkManager watchdog la lee desde un isolate separado para
  /// detectar si el conductor tiene un turno en curso (y por tanto el
  /// tracking debería estar activo). Si encuentra esta clave + el último
  /// ping persistido en `location_track_v2` es de hace >5min, dispara una
  /// notificación local de alta prioridad. Se escribe en `startTracking`
  /// y se borra en `stopTracking`.
  static const String _kActiveEntryIdKey = 'active_entry_id_v1';

  /// Box Hive con el histórico completo de puntos GPS por `entryId`.
  /// Sobrevive al cierre del turno y a reinicios de la app. Es el respaldo
  /// definitivo del trazo: si el endpoint ping-by-ping falla durante el
  /// turno, el cliente puede subir el track completo en un bulk al cerrar
  /// y `trip_summary_page` puede dibujar el track local mientras el bulk
  /// procesa. Estructura: `{ entryId: [{lat,lng,ts,accuracy?,speed?}, ...] }`.
  static const String _trackBoxName = 'location_track_v2';

  /// Capacidad máxima de la cola en disco. Subido de 5000 a 30000 para
  /// soportar rutas interdepartamentales largas (Cusco→Juliaca, Cusco→Lima)
  /// sin señal. 30000 pings a un ping cada ~3s = ~25 horas de captura
  /// continua, suficiente para los trayectos más largos del país sin
  /// descartar nada. El histórico autoritativo (location_track_v2) crece
  /// independiente.
  static const int _maxQueueSize = 30000;

  /// Tamaño del chunk al hacer bulk upload. El backend limita a 5000 pings
  /// por request (zod schema en /api/flota/[id]/track-bulk). Si la cola
  /// tiene más, partimos en lotes y subimos uno por uno. Antes el bulk
  /// fallaba con 400 si pasaba de 5000 y perdíamos TODO el batch.
  static const int _bulkUploadChunkSize = 4500;

  /// Pace entre envíos en el drain — el backend rate-limita a 60/min (1 Hz)
  /// por conductor; dejamos margen.
  static const Duration _drainPace = Duration(milliseconds: 1100);

  /// Backoff exponencial al fallar el drain. Empieza en 2s, dobla hasta 60s.
  static const Duration _backoffBase = Duration(seconds: 2);
  static const Duration _backoffMax = Duration(seconds: 60);

  /// Failsafe: si un mismo ping falla este número de veces seguidas, lo
  /// descartamos. Evita atascos eternos en pings con problemas no
  /// recuperables (FleetEntry borrado, payload corrupto, etc.) sin
  /// importar el código HTTP exacto. Subido de 6 a 20 para que pings en
  /// zonas con conexión muy intermitente (rutas largas en montaña) tengan
  /// suficientes oportunidades antes de descartarse.
  static const int _maxPingAttempts = 20;

  Box<Map<dynamic, dynamic>>? _queue;
  Box? _meta;
  Box? _routeCache;
  Box? _trackBox;
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
    // Listener del ciclo de vida de la app: cuando el conductor pasa a
    // background (WhatsApp, llamada, etc.) Android puede pausar Timers Dart.
    // Disparamos drain explícito en `paused`/`hidden` para vaciar la cola
    // antes de la pausa, y nuevamente en `resumed` para procesar lo que
    // quedó atrás. El foreground service nativo sigue capturando GPS sin
    // problema; lo único frágil son los Timers Dart del retry/heartbeat.
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (!state.isTracking) return;
    if (s == AppLifecycleState.paused ||
        s == AppLifecycleState.hidden ||
        s == AppLifecycleState.resumed) {
      // Cancelar el retry agendado para reintentar ya — la situación de red
      // pudo cambiar mientras la app estaba pausada.
      _drainRetryTimer?.cancel();
      _drainRetryTimer = null;
      _consecutiveFailures = 0;
      unawaited(_drainQueue());
    }
  }

  Future<void> _bootDrain() async {
    try {
      await _ensureBoxesOpen();
      // Refleja el estado persistido al inicio (puntos en cola y descartes).
      state = state.copyWith(
        queuedPoints: _queue?.length ?? 0,
        droppedByOverflow: _readDroppedCount(),
      );
      final box = _queue;
      if (box == null || box.isEmpty) return;

      // Fast-path bulk: si al arrancar quedaron >50 pings residuales de un
      // único entryId que también está en `_trackBox`, intentar bulk antes
      // del drain single. Caso real: el conductor cerró el turno con red
      // intermitente, la app cierra y deja una cola grande pendiente. Antes
      // tardaba horas en drenarse al reabrir (1 PATCH cada 1.1s); con bulk
      // sube en 1-2 requests al mismo endpoint que ya usa el cierre.
      const bulkBootThreshold = 50;
      if (box.length >= bulkBootThreshold) {
        final entryIds = <String>{};
        for (final key in box.keys) {
          final raw = box.get(key);
          if (raw == null) continue;
          final eid = raw['entryId'] as String?;
          if (eid != null) entryIds.add(eid);
          if (entryIds.length > 1) break; // No vale la pena, salir del scan.
        }
        if (entryIds.length == 1) {
          final entryId = entryIds.first;
          final trackRaw = _trackBox?.get(entryId);
          if (trackRaw is List && trackRaw.isNotEmpty) {
            // Bulk en background — no bloqueamos el arranque del notifier.
            // Si falla los 3 intentos, el método retorna false y caemos
            // al drain single tradicional.
            unawaited(() async {
              final ok = await _drainBulkAtCheckout(entryId);
              if (!ok && (_queue?.isNotEmpty ?? false)) {
                unawaited(_drainQueue());
              }
            }());
            return;
          }
        }
      }

      // Caso por defecto: drenar la cola con el flujo single tradicional.
      // No await: corre en background mientras el constructor termina.
      // Si falla, programa retry con backoff.
      unawaited(_drainQueue());
    } catch (_) {
      // No bloquear el arranque por errores de Hive.
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _positionSub?.cancel();
    _connSub?.cancel();
    _heartbeat?.cancel();
    _drainRetryTimer?.cancel();
    _healthTimer?.cancel();
    super.dispose();
  }

  /// Health check periódico: si llevamos >5min sin enviar un ping al backend
  /// durante un turno activo, algo está mal (Doze, permisos revocados, GPS
  /// apagado, OEM mató el servicio). Disparamos una local notification de
  /// alta prioridad y dejamos que la UI muestre el TrackingHealthCard rojo.
  ///
  /// La notification es importante porque el conductor probablemente tenga
  /// la app en background — sin el push se enteraría solo al abrir SFIT.
  void _checkTrackingHealth() {
    if (!state.isTracking) return;
    final since = DateTime.now().difference(_lastSendAt);
    if (since < const Duration(minutes: 5)) return;
    debugPrint('[LocationTracking] Health check: gap de '
        '${since.inMinutes}min sin envíos exitosos durante turno activo.');
    // Cualquier widget que escuche el provider verá el estado actualizado
    // (lastSuccessfulSend no se movió → status pasa a rojo en el card).
    // En F4 agregamos también una local notification con
    // flutter_local_notifications para alertar fuera de la app.
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

    // Persistir el entryId activo para el WorkManager watchdog. Si Android
    // mata el proceso o el usuario reinicia el teléfono durante este turno,
    // el watchdog detecta el flag + último ping > 5min y dispara una
    // notification para que el conductor reabra la app.
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kActiveEntryIdKey, entryId);
    } catch (_) {/* no bloqueante */}

    final waypoints = await _loadRouteWaypoints(routeId);
    final pos = await _safeGetPosition();

    final initialTrack =
        pos != null ? [LatLng(pos.latitude, pos.longitude)] : const <LatLng>[];
    state = TrackingState(
      entryId: entryId,
      routeId: routeId,
      isTracking: true,
      routeWaypoints: waypoints,
      localTrack: initialTrack,
      recentTrack: initialTrack,
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
    final recentStart = track.length > _recentTrackWindow
        ? track.length - _recentTrackWindow
        : 0;

    state = TrackingState(
      entryId: entryId,
      routeId: routeId,
      isTracking: true,
      localTrack: track,
      recentTrack: track.sublist(recentStart),
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
    await _ensureBoxesOpen();
    try {
      final raw = await _svc.getRouteWaypointsDetailed(routeId);
      final waypoints = raw
          .map(
            (p) => RouteWaypoint(
              order: (p['order'] as num).toInt(),
              lat: (p['lat'] as num).toDouble(),
              lng: (p['lng'] as num).toDouble(),
              label: p['label'] as String?,
            ),
          )
          .toList();
      // Cache para uso offline: si la próxima vez no hay red, leemos de aquí.
      // Las rutas urbanas no cambian con frecuencia; un cache sin TTL agresivo
      // es aceptable.
      try {
        await _routeCache?.put(routeId, <String, dynamic>{
          'waypoints': waypoints
              .map(
                (w) => <String, dynamic>{
                  'order': w.order,
                  'lat': w.lat,
                  'lng': w.lng,
                  'label': w.label,
                },
              )
              .toList(),
          'cachedAt': DateTime.now().millisecondsSinceEpoch,
        });
      } catch (_) {/* best-effort */}
      return waypoints;
    } catch (_) {
      // Sin red o error API: intentar cache local.
      return _readCachedWaypoints(routeId);
    }
  }

  List<RouteWaypoint> _readCachedWaypoints(String routeId) {
    final box = _routeCache;
    if (box == null || !box.isOpen) return const [];
    final raw = box.get(routeId);
    if (raw is! Map) return const [];
    final list = raw['waypoints'];
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map(
          (p) => RouteWaypoint(
            order: (p['order'] as num).toInt(),
            lat: (p['lat'] as num).toDouble(),
            lng: (p['lng'] as num).toDouble(),
            label: p['label'] as String?,
          ),
        )
        .toList();
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
    // Borrar el flag de turno activo — el watchdog ya no debe alertar
    // sobre este entryId. Si fallara, no es crítico: en el peor caso el
    // próximo health check del watchdog notifica una vez al usuario que
    // ya cerró el turno (mensaje "tu turno anterior quedó sin cerrar" que
    // puede ignorar).
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kActiveEntryIdKey);
    } catch (_) {/* no bloqueante */}
    // Drain final del turno. Estrategia bulk-first:
    //   1) `_drainBulkAtCheckout` sube TODO el track del entryId en 1-2
    //      requests al endpoint `/track-bulk`. Para 300 pts esto baja de
    //      >5 min (el viejo `_drainQueue` PATCH-by-PATCH con 1.1s de pace)
    //      a ~2 s. El backend deduplica por (entryId, ts) así que puntos
    //      ya subidos en vivo durante el turno se ignoran sin duplicar.
    //   2) Si el bulk falla los 3 intentos (red caída persistente, error
    //      5xx, etc.) caemos al `_drainQueue` tradicional como red de
    //      seguridad. Mismo timeout dinámico que antes para acotar la
    //      espera del usuario.
    bool bulkOk = false;
    bool isNetError = false;
    Object? netException;
    try {
      if (entryId != null) {
        bulkOk = await _drainBulkAtCheckout(entryId);
      }
    } catch (e) {
      if (_isNetworkError(e)) {
        isNetError = true;
        netException = e;
      } else {
        debugPrint('[LocationTracking] Error no-red durante bulk checkout: $e');
      }
    }

    if (!bulkOk && !isNetError) {
      final pending = _queue?.length ?? 0;
      final estimatedMs = pending * (_drainPace.inMilliseconds + 200) + 5000;
      // Reducimos el timeout del fallback a un máximo de 8 segundos en total
      // para no frustrar al conductor si la red está lenta pero activa.
      final drainTimeout = Duration(
        milliseconds: estimatedMs.clamp(5000, 8000),
      );
      try {
        await _drainQueue().timeout(drainTimeout);
      } catch (e, st) {
        debugPrint('[LocationTracking] fallback drain falló (pending=$pending,'
            ' timeout=${drainTimeout.inSeconds}s): $e');
        debugPrintStack(stackTrace: st);
      }
    }

    await _stopStreamsKeepState();
    state = TrackingState(
      queuedPoints: _queue?.length ?? 0,
      droppedByOverflow: _readDroppedCount(),
    );

    // Si fue un error de red, propagamos el error para que la UI de TripCheckoutPage lo capture.
    if (isNetError && netException != null) {
      throw netException;
    }
  }

  /// Detiene el tracking localmente de forma inmediata e incondicional,
  /// limpiando SharedPreferences y deteniendo los streams de geolocalización.
  /// No realiza llamadas de red ni drains bloqueantes.
  Future<void> forceStopTrackingLocal() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kActiveEntryIdKey);
    } catch (_) {/* no crítico */}

    await _stopStreamsKeepState();
    state = TrackingState(
      queuedPoints: _queue?.length ?? 0,
      droppedByOverflow: _readDroppedCount(),
    );
    debugPrint('[LocationTracking] forceStopTrackingLocal ejecutado con éxito.');
  }

  Future<void> _stopStreamsKeepState() async {
    await _positionSub?.cancel();
    _positionSub = null;
    await _connSub?.cancel();
    _connSub = null;
    _heartbeat?.cancel();
    _heartbeat = null;
    _healthTimer?.cancel();
    _healthTimer = null;
    // OJO: NO cancelamos _drainRetryTimer — el drain debe seguir intentando
    // subir puntos pendientes incluso después de cerrar el turno.
  }

  /// Limpia el feedback efímero de "último paradero" después de mostrarlo.
  void clearLastVisitedLabel() {
    if (state.lastVisitedLabel != null) {
      state = state.copyWith(lastVisitedLabel: null);
    }
  }

  /// Fuerza un drain inmediato de la cola — útil cuando el usuario ve que
  /// los pings no se suben (por reintento programado lejano) y quiere
  /// disparar el envío ya. Resetea el contador de fallos consecutivos para
  /// que el primer intento no salga con backoff.
  Future<void> flushQueue() async {
    _drainRetryTimer?.cancel();
    _drainRetryTimer = null;
    _consecutiveFailures = 0;
    await _drainQueue();
  }

  /// Agrega un punto al histórico persistido del entryId. Usado por `_enqueue`
  /// para mantener el respaldo local del trazo, independiente del envío.
  Future<void> _appendToTrack(String entryId, Position pos, int tsMs) async {
    final box = _trackBox;
    if (box == null) return;
    final raw = box.get(entryId);
    final list = (raw is List) ? raw.toList() : <dynamic>[];
    list.add(<String, dynamic>{
      'lat': pos.latitude,
      'lng': pos.longitude,
      'ts': DateTime.fromMillisecondsSinceEpoch(tsMs).toUtc().toIso8601String(),
      if (pos.accuracy > 0) 'accuracy': pos.accuracy,
      if (pos.speed >= 0) 'speed': pos.speed,
    });
    await box.put(entryId, list);
  }

  /// Devuelve el track persistido localmente para un entryId. Útil para
  /// `trip_summary_page` cuando el backend devuelve trackPoints vacío
  /// (los pings nunca llegaron y la app puede mostrar al menos lo que sí
  /// capturó). Lista vacía si el box no existe o no hay registros.
  Future<List<LatLng>> getPersistedTrack(String entryId) async {
    await _ensureBoxesOpen();
    final raw = _trackBox?.get(entryId);
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((m) {
      final lat = (m['lat'] as num?)?.toDouble();
      final lng = (m['lng'] as num?)?.toDouble();
      if (lat == null || lng == null) return null;
      return LatLng(lat, lng);
    }).whereType<LatLng>().toList();
  }

  /// Sube el track local del entryId al endpoint bulk del backend
  /// (`POST /flota/:id/track-bulk`). Idempotente server-side. Devuelve el
  /// número de puntos insertados acumulado entre todos los chunks (0 si
  /// todo era duplicado o no había track). Si la cola tiene más puntos que
  /// `_bulkUploadChunkSize`, se sube en lotes — antes un track de >5000
  /// puntos fallaba completo con 400.
  Future<int> bulkUploadTrack(String entryId) async {
    await _ensureBoxesOpen();
    final raw = _trackBox?.get(entryId);
    if (raw is! List || raw.isEmpty) return 0;
    final allPoints = raw
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
    // El track viene cronológicamente desde _appendToTrack, pero por si acaso
    // (boots intercalados con turnos sin cerrar) lo reordenamos.
    allPoints.sort((a, b) {
      final ta = (a['ts'] as String?) ?? '';
      final tb = (b['ts'] as String?) ?? '';
      return ta.compareTo(tb);
    });

    var totalInserted = 0;
    var chunkIndex = 0;
    final totalChunks = (allPoints.length / _bulkUploadChunkSize).ceil();
    for (var offset = 0; offset < allPoints.length; offset += _bulkUploadChunkSize) {
      final end = (offset + _bulkUploadChunkSize > allPoints.length)
          ? allPoints.length
          : offset + _bulkUploadChunkSize;
      final chunk = allPoints.sublist(offset, end);
      chunkIndex++;
      try {
        final result = await _svc.bulkUploadTrack(
          entryId: entryId,
          points: chunk,
        );
        final inserted = (result['inserted'] as num?)?.toInt() ?? 0;
        totalInserted += inserted;
        debugPrint(
          '[LocationTracking] bulk chunk $chunkIndex/$totalChunks '
          'entryId=$entryId: received=${result['received']}, '
          'inserted=$inserted, duplicates=${result['duplicates']}',
        );
      } catch (e) {
        debugPrint(
          '[LocationTracking] bulk chunk $chunkIndex/$totalChunks falló '
          'para $entryId: $e',
        );
        // No abortamos la subida total — los chunks restantes se intentan
        // igual. El backend deduplica por (entryId, ts) así que reintentos
        // posteriores son seguros. Pero re-lanzamos al final si no logramos
        // nada para que el caller (trip_summary) sepa que hubo problema.
        if (totalInserted == 0 && chunkIndex == totalChunks) rethrow;
      }
    }
    return totalInserted;
  }

  bool _isNetworkError(Object e) {
    if (e is DioException) {
      return e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.error is SocketException ||
          e.message?.contains('SocketException') == true;
    }
    if (e is SocketException) {
      return true;
    }
    return false;
  }

  /// Drain bulk al cerrar turno. Sube TODO el track del `entryId` en chunks
  /// (4500 pts/request) en lugar de drenar la cola un punto a la vez. Antes:
  /// 300 pts × 1.1s de `_drainPace` = >5 min de espera mínima, más en
  /// la práctica con latencia/retries (reportes reales de 8h+).
  ///
  /// Aprovecha que `_trackBox` ya guarda el histórico autoritativo
  /// (`_appendToTrack` corre en cada `_enqueue`) y que el backend deduplica
  /// por `(entryId, ts)`: puntos ya subidos por PATCH `/location` durante el
  /// turno son ignorados como duplicados, no se insertan dos veces.
  ///
  /// 3 intentos con backoff corto (0s, 2s, 5s) — el conductor está esperando
  /// en pantalla, no queremos backoff exponencial largo aquí. Si falla los
  /// 3, devuelve `false` para que `stopTracking` caiga al `_drainQueue()`
  /// tradicional como red de seguridad.
  ///
  /// Tras éxito, purga del `_queue` todas las entradas cuyo `entryId`
  /// coincida — su contenido ya está garantizado en el backend vía bulk.
  Future<bool> _drainBulkAtCheckout(String entryId) async {
    const attempts = <Duration>[
      Duration.zero,
      Duration(seconds: 2),
      Duration(seconds: 5),
    ];
    for (var i = 0; i < attempts.length; i++) {
      if (attempts[i] > Duration.zero) {
        await Future<void>.delayed(attempts[i]);
      }
      try {
        final inserted = await bulkUploadTrack(entryId);
        // Éxito sin throws: el track del entryId está completo en el backend.
        // `inserted == 0` es válido cuando todo el track ya se había subido
        // vía PATCH single durante el turno (todo duplicado server-side).
        await _purgeQueueForEntry(entryId);
        debugPrint('[LocationTracking] bulk checkout OK entryId=$entryId '
            'inserted=$inserted (attempt ${i + 1})');
        return true;
      } catch (e) {
        debugPrint('[LocationTracking] bulk checkout falló attempt '
            '${i + 1}/${attempts.length} entryId=$entryId: $e');
        
        // Si detectamos un error de red, abortamos reintentos de inmediato.
        // Propagamos la excepción para que stopTracking la capture y aborte el fallback.
        if (_isNetworkError(e)) {
          debugPrint('[LocationTracking] Abortando bulk checkout por error de red en intento ${i + 1}');
          throw e;
        }
      }
    }
    return false;
  }

  /// Elimina del `_queue` todas las entradas cuyo `entryId` coincida con el
  /// dado. Usado tras un bulk exitoso para no reenviar los mismos puntos
  /// uno-por-uno al final del cierre. Conserva entradas de otros entryIds
  /// (raro pero posible: turno abortado por kill, drain colado durante un
  /// turno nuevo, etc.).
  Future<void> _purgeQueueForEntry(String entryId) async {
    final box = _queue;
    if (box == null || box.isEmpty) return;
    final keysToDelete = <dynamic>[];
    for (final key in box.keys) {
      final raw = box.get(key);
      if (raw == null) continue;
      if ((raw['entryId'] as String?) == entryId) keysToDelete.add(key);
    }
    if (keysToDelete.isEmpty) return;
    await box.deleteAll(keysToDelete);
    _consecutiveFailures = 0;
    state = state.copyWith(
      queuedPoints: box.length,
      consecutiveFailures: 0,
    );
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

    // Health check cada minuto: detecta cuando llevamos >5min sin envíos
    // exitosos (Doze, permisos, OEM matando el servicio).
    _healthTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => _checkTrackingHealth(),
    );

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

    // Filtro DURO: solo descartamos si la accuracy es realmente terrible
    // (>100m, GPS recién encendido o reflejo). Antes se descartaba a >50m
    // y eso provocaba "líneas rectas" en zonas con edificios altos o clima
    // nublado donde 60-80m es lo mejor que el chip puede ofrecer.
    if (pos.accuracy > _accuracyThresholdMeters) {
      state = state.copyWith(
        discardedLowAccuracy: state.discardedLowAccuracy + 1,
        currentAccuracy: pos.accuracy,
      );
      return;
    }

    _lastPosition = pos;
    final ll = LatLng(pos.latitude, pos.longitude);
    // Truncamos la lista del state si supera el tope para evitar memory
    // pressure en rutas largas (8h+). El histórico completo sigue persistido
    // en location_track_v2 y se reconstruye al cerrar turno.
    final basePrev = state.localTrack;
    final List<LatLng> newTrack;
    if (basePrev.length >= _stateLocalTrackMax) {
      // Mantenemos los últimos `_stateLocalTrackMax - 1` y añadimos el nuevo.
      // Evita reasignación O(n) cada ping cuando ya estamos en el límite.
      newTrack = [
        ...basePrev.sublist(basePrev.length - _stateLocalTrackMax + 1),
        ll,
      ];
    } else {
      newTrack = [...basePrev, ll];
    }
    final recentStart = newTrack.length > _recentTrackWindow
        ? newTrack.length - _recentTrackWindow
        : 0;
    final newRecent = newTrack.sublist(recentStart);
    state = state.copyWith(
      currentPosition: ll,
      currentAccuracy: pos.accuracy,
      localTrack: newTrack,
      recentTrack: newRecent,
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
    if (_routeCache == null || !_routeCache!.isOpen) {
      _routeCache = await Hive.openBox(_routeCacheBoxName);
    }
    if (_trackBox == null || !_trackBox!.isOpen) {
      _trackBox = await Hive.openBox(_trackBoxName);
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

    final ts = DateTime.now().millisecondsSinceEpoch;
    // Dedup: si el ping anterior fue hace menos de 100 ms y a menos de 1 m,
    // probablemente sea un duplicado (heartbeat racing con _onPosition,
    // start/stop apretado, etc.). No tiene sentido encolarlo dos veces — el
    // backend lo rechazaría como duplicate. Las acciones explícitas
    // (`start`/`end`) se dejan pasar siempre porque marcan el ciclo del
    // turno y pueden coincidir en tiempo con el primer/último punto.
    if (action == null && ts - _lastEnqueuedTs < 100) {
      final dLat = (pos.latitude - _lastEnqueuedLat).abs();
      final dLng = (pos.longitude - _lastEnqueuedLng).abs();
      // ~1e-5 grados ≈ 1.1 m. Comparación crudo en lugar de haversine para
      // evitar el costo en un check tan caliente.
      if (dLat < 1e-5 && dLng < 1e-5) return;
    }

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
      'ts': ts,
    });
    _lastEnqueuedTs = ts;
    _lastEnqueuedLat = pos.latitude;
    _lastEnqueuedLng = pos.longitude;

    // Persistencia paralela del histórico autoritativo local. Este box NO se
    // borra al enviar al backend — es el respaldo del trazo del turno por si
    // los pings se pierden en transmisión. `trip_summary_page` lee desde
    // aquí cuando el backend devuelve trackPoints vacío.
    await _appendToTrack(entryId, pos, ts);

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
      final ttlCutoff = DateTime.now().millisecondsSinceEpoch -
          _queuePingTtl.inMilliseconds;
      for (final key in keys) {
        final raw = box.get(key);
        if (raw == null) continue;
        final item = Map<String, dynamic>.from(raw);
        // TTL: pings con más de 24 h en cola muy probablemente son residuos
        // de un turno abortado / boot anterior. El backend los rechazaría
        // (FleetEntry cerrada / out-of-range). Mejor descartarlos para no
        // ocupar slots útiles ni atascar el drain.
        final ts = (item['ts'] as num?)?.toInt() ?? 0;
        if (ts > 0 && ts < ttlCutoff) {
          debugPrint('[LocationTracking] descartando ping >24h '
              '(ts=$ts, key=$key, entryId=${item['entryId']})');
          await box.delete(key);
          continue;
        }
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
          // Espejar métricas en el state para que la UI vea el progreso
          // del drain en tiempo real (TrackingHealthCard).
          state = state.copyWith(
            consecutiveFailures: 0,
            lastSuccessfulSend: _lastSendAt,
            queuedPoints: box.length,
          );
          // Pace para no toparse con rate limit (60/min) del backend.
          await Future<void>.delayed(_drainPace);
        } catch (e) {
          // Política de reintento por ping:
          //   - LocationSendException 403/404/422 = permanente (entry borrado,
          //     driver no autorizado, payload inválido). Descartar al toque.
          //   - 401 = posible token expirado. El AuthInterceptor refresca.
          //     Tratamos como transitorio pero contamos attempts (si refresh
          //     falla N veces, descartamos para no atascar la cola).
          //   - 5xx/408/429/network/timeout = transitorio.
          //
          // Failsafe universal: cualquier ping con attempts >= _maxPingAttempts
          // se descarta sin importar la causa.  Mejor perder ese ping
          // que tener la cola atascada para siempre.
          final attempts = ((item['attempts'] as num?)?.toInt() ?? 0) + 1;
          int? status;
          if (e is LocationSendException) status = e.statusCode;
          final permanentStatus = status == 403 || status == 404 || status == 422;

          if (permanentStatus || attempts >= _maxPingAttempts) {
            debugPrint('[LocationTracking] descartando ping '
                '(status=$status, attempts=$attempts, key=$key, '
                'entryId=${item['entryId']}): $e');
            await box.delete(key);
            continue;
          }

          // Reintenable: actualizamos el contador en el box y agendamos retry.
          item['attempts'] = attempts;
          await box.put(key, item);
          _consecutiveFailures++;
          state = state.copyWith(
            consecutiveFailures: _consecutiveFailures,
            queuedPoints: box.length,
          );
          debugPrint('[LocationTracking] sendLocation transitorio '
              '(status=$status, attempts=$attempts/$_maxPingAttempts, '
              'failures=$_consecutiveFailures, queue=${box.length}): $e');
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
