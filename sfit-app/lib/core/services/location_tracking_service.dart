import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
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
  }) =>
      TrackingState(
        entryId: entryId ?? this.entryId,
        routeId: routeId ?? this.routeId,
        isTracking: isTracking ?? this.isTracking,
        localTrack: localTrack ?? this.localTrack,
        routeWaypoints: routeWaypoints ?? this.routeWaypoints,
        currentPosition: currentPosition ?? this.currentPosition,
        currentAccuracy: currentAccuracy ?? this.currentAccuracy,
        visitedStopIndices: visitedStopIndices ?? this.visitedStopIndices,
        lastVisitedLabel: lastVisitedLabel == _kSentinel
            ? this.lastVisitedLabel
            : lastVisitedLabel as String?,
        discardedLowAccuracy:
            discardedLowAccuracy ?? this.discardedLowAccuracy,
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
  Timer? _timer;

  /// Frecuencia de muestreo del GPS — 8s es suficiente para zona urbana
  /// con paraderos cada 200-500m a velocidades típicas (20-40 km/h).
  static const Duration _samplingInterval = Duration(seconds: 8);

  /// Filtro de calidad: descartar puntos con accuracy mayor a este umbral (m).
  static const double _accuracyThresholdMeters = 50;

  LocationTrackingNotifier(this._svc) : super(const TrackingState());

  @override
  void dispose() {
    _timer?.cancel();
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
  Future<void> startTracking(String entryId, {String? routeId}) async {
    _timer?.cancel();
    final waypoints = await _loadRouteWaypoints(routeId);
    final pos = await _safeGetPosition();
    state = TrackingState(
      entryId: entryId,
      routeId: routeId,
      isTracking: true,
      routeWaypoints: waypoints,
      localTrack: pos != null ? [LatLng(pos.latitude, pos.longitude)] : const [],
      currentPosition: pos != null ? LatLng(pos.latitude, pos.longitude) : null,
      currentAccuracy: pos?.accuracy,
    );
    if (pos != null) {
      _sendAndUpdate(
        entryId: entryId,
        pos: pos,
        action: 'update',
      );
    }
    _timer = Timer.periodic(_samplingInterval, (_) => _tick());
  }

  /// Carga puntos existentes del backend y reanuda tracking (app reabierta).
  Future<void> resumeTracking(String entryId, {String? routeId}) async {
    if (state.isTracking && state.entryId == entryId) return;
    _timer?.cancel();

    List<LatLng> existing = const [];
    Set<int> visited = const <int>{};
    try {
      final hist = await _svc.getTrackHistory(entryId);
      existing = hist.trackPoints
          .map((p) => LatLng(p['lat']!, p['lng']!))
          .toList();
      visited = hist.visitedStops
          .map((s) => (s['stopIndex'] as num).toInt())
          .toSet();
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
    );
    _timer = Timer.periodic(_samplingInterval, (_) => _tick());
  }

  Future<List<RouteWaypoint>> _loadRouteWaypoints(String? routeId) async {
    if (routeId == null) return const [];
    try {
      final raw = await _svc.getRouteWaypointsDetailed(routeId);
      return raw
          .map((p) => RouteWaypoint(
                order: (p['order'] as num).toInt(),
                lat: (p['lat'] as num).toDouble(),
                lng: (p['lng'] as num).toDouble(),
                label: p['label'] as String?,
              ))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  /// Detiene tracking. Llamar desde TripCheckoutPage.
  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    state = const TrackingState();
  }

  /// Limpia el feedback efímero de "último paradero" después de mostrarlo.
  void clearLastVisitedLabel() {
    if (state.lastVisitedLabel != null) {
      state = state.copyWith(lastVisitedLabel: null);
    }
  }

  Future<void> _tick() async {
    final entryId = state.entryId;
    if (entryId == null || !state.isTracking) return;
    final pos = await _safeGetPosition();
    if (pos == null) return;

    if (pos.accuracy > _accuracyThresholdMeters) {
      state = state.copyWith(
        discardedLowAccuracy: state.discardedLowAccuracy + 1,
        currentAccuracy: pos.accuracy,
      );
      return;
    }

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
    _sendAndUpdate(entryId: entryId, pos: pos);
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

  void _sendAndUpdate({
    required String entryId,
    required Position pos,
    String? action,
  }) {
    _svc
        .sendLocation(
      entryId: entryId,
      lat: pos.latitude,
      lng: pos.longitude,
      accuracy: pos.accuracy,
      speed: pos.speed >= 0 ? pos.speed : null,
      action: action,
    )
        .then((data) {
      // El backend devuelve `newlyVisited: { stopIndex, label }` cuando detecta
      // que el bus pasó por un paradero nuevo. Reflejarlo en el estado.
      final newly = data['newlyVisited'] as Map?;
      if (newly == null) return;
      final stopIndex = (newly['stopIndex'] as num?)?.toInt();
      if (stopIndex == null) return;
      final updated = {...state.visitedStopIndices, stopIndex};
      state = state.copyWith(
        visitedStopIndices: updated,
        lastVisitedLabel: newly['label'] as String? ?? 'Paradero $stopIndex',
      );
    }).catchError((_) {
      // Errores de red no rompen la UI; siguiente tick reintentará el push.
    });
  }
}

final locationTrackingProvider =
    StateNotifierProvider<LocationTrackingNotifier, TrackingState>((ref) {
  final svc = ref.watch(tripsApiServiceProvider);
  return LocationTrackingNotifier(svc);
});
