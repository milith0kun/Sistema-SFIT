import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong2.dart';
import '../network/dio_client.dart';
import '../../features/trips/data/datasources/trips_api_service.dart';

class TrackingState {
  final String? entryId;
  final bool isTracking;
  final List<LatLng> localTrack;
  final LatLng? currentPosition;

  const TrackingState({
    this.entryId,
    this.isTracking = false,
    this.localTrack = const [],
    this.currentPosition,
  });

  TrackingState copyWith({
    String? entryId,
    bool? isTracking,
    List<LatLng>? localTrack,
    LatLng? currentPosition,
  }) =>
      TrackingState(
        entryId: entryId ?? this.entryId,
        isTracking: isTracking ?? this.isTracking,
        localTrack: localTrack ?? this.localTrack,
        currentPosition: currentPosition ?? this.currentPosition,
      );
}

class LocationTrackingNotifier extends StateNotifier<TrackingState> {
  final TripsApiService _svc;
  Timer? _timer;

  LocationTrackingNotifier(this._svc) : super(const TrackingState());

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Inicia tracking para un FleetEntry. Llamar desde TripCheckinPage.
  Future<void> startTracking(String entryId) async {
    _timer?.cancel();
    final pos = await _safeGetPosition();
    final track = <LatLng>[];
    if (pos != null) {
      final ll = LatLng(pos.latitude, pos.longitude);
      track.add(ll);
      _sendSilent(entryId: entryId, lat: pos.latitude, lng: pos.longitude, action: 'update');
      state = TrackingState(
        entryId: entryId,
        isTracking: true,
        localTrack: track,
        currentPosition: ll,
      );
    } else {
      state = TrackingState(entryId: entryId, isTracking: true);
    }
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _tick());
  }

  /// Carga puntos existentes del backend y reanuda tracking (app reopened).
  Future<void> resumeTracking(String entryId) async {
    if (state.isTracking && state.entryId == entryId) return;
    _timer?.cancel();
    List<LatLng> existing = [];
    try {
      final raw = await _svc.getTrackPoints(entryId);
      existing = raw.map((p) => LatLng(p['lat']!, p['lng']!)).toList();
    } catch (_) {}

    final pos = await _safeGetPosition();
    final ll = pos != null ? LatLng(pos.latitude, pos.longitude) : null;
    if (ll != null) existing.add(ll);

    state = TrackingState(
      entryId: entryId,
      isTracking: true,
      localTrack: existing,
      currentPosition: ll,
    );
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _tick());
  }

  /// Detiene tracking. Llamar desde TripCheckoutPage.
  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    state = const TrackingState();
  }

  Future<void> _tick() async {
    final entryId = state.entryId;
    if (entryId == null || !state.isTracking) return;
    final pos = await _safeGetPosition();
    if (pos == null) return;
    final ll = LatLng(pos.latitude, pos.longitude);
    final newTrack = [...state.localTrack, ll];
    // Limitar a 500 puntos locales para evitar memoria excesiva
    if (newTrack.length > 500) newTrack.removeRange(0, newTrack.length - 500);
    state = state.copyWith(currentPosition: ll, localTrack: newTrack);
    _sendSilent(entryId: entryId, lat: pos.latitude, lng: pos.longitude);
  }

  Future<Position?> _safeGetPosition() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 8));
    } catch (_) {
      return null;
    }
  }

  void _sendSilent({
    required String entryId,
    required double lat,
    required double lng,
    String? action,
  }) {
    _svc.sendLocation(entryId: entryId, lat: lat, lng: lng, action: action).catchError((_) {});
  }
}

final locationTrackingProvider =
    StateNotifierProvider<LocationTrackingNotifier, TrackingState>((ref) {
  final svc = ref.watch(tripsApiServiceProvider);
  return LocationTrackingNotifier(svc);
});
