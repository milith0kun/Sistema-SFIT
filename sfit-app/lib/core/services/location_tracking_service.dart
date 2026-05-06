import 'dart:async';
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

  /// Box Hive para puntos pendientes cuando falla la red.
  static const String _queueBoxName = 'location_queue_v1';
  static const int _maxQueueSize = 5000;
  Box<Map<dynamic, dynamic>>? _queue;
  bool _draining = false;

  LocationTrackingNotifier(this._svc) : super(const TrackingState());

  @override
  void dispose() {
    _positionSub?.cancel();
    _connSub?.cancel();
    _heartbeat?.cancel();
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
    await _ensureQueueOpen();

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
    );

    if (pos != null) {
      _lastPosition = pos;
      _sendOrQueue(entryId: entryId, pos: pos, action: 'start');
    }

    _startStreams(entryId);
  }

  /// Carga puntos existentes del backend y reanuda tracking (app reabierta).
  Future<void> resumeTracking(String entryId, {String? routeId}) async {
    if (state.isTracking && state.entryId == entryId) return;
    await _stopStreamsKeepState();
    await _ensureQueueOpen();

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
        _sendOrQueue(entryId: entryId, pos: endPos, action: 'end');
      }
    }
    // Drain final con timeout — si la red está caída, se quedan en el box
    // y se mandarán cuando vuelva.
    try {
      await _drainQueue().timeout(const Duration(seconds: 5));
    } catch (_) {/* best-effort */}

    await _stopStreamsKeepState();
    state = const TrackingState();
  }

  Future<void> _stopStreamsKeepState() async {
    await _positionSub?.cancel();
    _positionSub = null;
    await _connSub?.cancel();
    _connSub = null;
    _heartbeat?.cancel();
    _heartbeat = null;
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
      if (hasNet) _drainQueue();
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
    _sendOrQueue(entryId: entryId, pos: pos);
  }

  void _onHeartbeat(String entryId) {
    final since = DateTime.now().difference(_lastSendAt);
    if (since < _heartbeatPeriod) return;
    final pos = _lastPosition;
    if (pos == null) return;
    _sendOrQueue(entryId: entryId, pos: pos);
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

  // ─── Envío y cola offline ───────────────────────────────────────────────

  Future<void> _ensureQueueOpen() async {
    if (_queue != null && _queue!.isOpen) return;
    _queue = await Hive.openBox<Map<dynamic, dynamic>>(_queueBoxName);
  }

  void _sendOrQueue({
    required String entryId,
    required Position pos,
    String? action,
  }) {
    _lastSendAt = DateTime.now();
    _svc
        .sendLocation(
          entryId: entryId,
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: pos.accuracy,
          speed: pos.speed >= 0 ? pos.speed : null,
          action: action,
        )
        .then(_applyServerResponse)
        .catchError((_) {
          // Encolar para reintentar cuando vuelva la red.
          _enqueue(entryId, pos, action);
        });
  }

  Future<void> _enqueue(String entryId, Position pos, String? action) async {
    final box = _queue;
    if (box == null) return;
    if (box.length >= _maxQueueSize) {
      // Descartar el más viejo para no inundar disco.
      final firstKey = box.keys.isNotEmpty ? box.keys.first : null;
      if (firstKey != null) await box.delete(firstKey);
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
    state = state.copyWith(queuedPoints: box.length);
  }

  /// Drena la cola offline en orden FIFO. Se llama cuando vuelve la red, al
  /// hacer checkout, o lazy desde el siguiente envío exitoso.
  Future<void> _drainQueue() async {
    if (_draining) return;
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
          );
          await box.delete(key);
          // Pace para no toparse con rate limit (60/min) del backend.
          await Future.delayed(const Duration(milliseconds: 1100));
        } catch (_) {
          // Si falla un punto, paramos el drain — se reintentará al volver.
          break;
        }
      }
    } finally {
      _draining = false;
      state = state.copyWith(queuedPoints: box.length);
    }
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
