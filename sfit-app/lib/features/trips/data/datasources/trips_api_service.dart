import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../models/trip_model.dart';

part 'trips_api_service.g.dart';

@riverpod
TripsApiService tripsApiService(Ref ref) =>
    TripsApiService(ref.watch(dioClientProvider).dio);

class TripsApiService {
  final Dio _dio;
  TripsApiService(this._dio);

  /// GET /viajes?limit=limit — viajes asignados al conductor autenticado.
  Future<List<TripModel>> getMyTrips({int limit = 30}) async {
    final resp = await _dio.get('/viajes', queryParameters: {'limit': limit});
    final body = resp.data as Map;
    final data = body['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => TripModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /rutas?limit=limit — rutas disponibles para el conductor.
  /// Devuelve datos crudos (sin modelo separado).
  Future<List<Map<String, dynamic>>> getMyRoutes({int limit = 20}) async {
    final resp = await _dio.get('/rutas', queryParameters: {'limit': limit});
    final body = resp.data as Map;
    final data = body['data'] as Map;
    final items = data['items'] as List;
    return items.cast<Map<String, dynamic>>();
  }

  /// PATCH /viajes/:id — confirma inicio de viaje (status → en_curso).
  Future<void> confirmTrip(String tripId) async {
    await _dio.patch('/viajes/$tripId', data: {'status': 'en_curso'});
  }

  /// PATCH /viajes/:id — cierra el viaje (status → completado).
  Future<void> closeTrip(String tripId, {String? observations}) async {
    await _dio.patch('/viajes/$tripId', data: {
      'status': 'completado',
      if (observations != null && observations.isNotEmpty)
        'observations': observations,
    });
  }

  // ── Turno de conductor (FleetEntry) ─────────────────────────────────────────

  /// POST /flota — inicia un turno del conductor (crea FleetEntry en_ruta).
  /// Devuelve el id de la FleetEntry creada.
  Future<String> startTrip({
    required String vehicleId,
    required DateTime departureTime,
    bool checklistComplete = true,
    String? routeId,
  }) async {
    final hhmm = '${departureTime.hour.toString().padLeft(2, '0')}:${departureTime.minute.toString().padLeft(2, '0')}';
    final resp = await _dio.post('/flota', data: {
      'vehicleId': vehicleId,
      'departureTime': hhmm,
      'checklistComplete': checklistComplete,
      'status': 'en_ruta',
      if (routeId != null) 'routeId': routeId,
    });
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>;
    return data['id'] as String;
  }

  /// GET /rutas/:id — waypoints de una ruta para dibujar en el mapa.
  Future<List<Map<String, double>>> getRouteWaypoints(String routeId) async {
    final resp = await _dio.get('/rutas/$routeId');
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>;
    final wps = data['waypoints'] as List? ?? [];
    return wps.map((p) {
      final m = p as Map<String, dynamic>;
      return {
        'lat': (m['lat'] as num).toDouble(),
        'lng': (m['lng'] as num).toDouble(),
      };
    }).toList();
  }

  /// GET /flota — viajes activos del conductor autenticado.
  Future<List<Map<String, dynamic>>> getMyFleetEntries() async {
    final resp = await _dio.get('/flota');
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>;
    final items = data['items'] as List;
    return items.cast<Map<String, dynamic>>();
  }

  /// PATCH /flota/:id — cierra el turno del conductor.
  Future<void> closeFleetEntry(
    String entryId, {
    required double km,
    DateTime? returnTime,
    String? observations,
  }) async {
    final rt = returnTime ?? DateTime.now();
    final hhmm = '${rt.hour.toString().padLeft(2, '0')}:${rt.minute.toString().padLeft(2, '0')}';
    await _dio.patch('/flota/$entryId', data: {
      'status': 'cerrado',
      'returnTime': hhmm,
      'km': km,
      if (observations != null && observations.isNotEmpty)
        'observations': observations,
    });
  }

  /// PATCH /flota/:entryId/location — envía update de GPS al backend.
  Future<void> sendLocation({
    required String entryId,
    required double lat,
    required double lng,
    String? action,
  }) async {
    await _dio.patch('/flota/$entryId/location', data: {
      'lat': lat,
      'lng': lng,
      if (action != null) 'action': action,
    });
  }

  /// GET /flota/:entryId/location — obtiene trayecto guardado.
  /// Devuelve lista de {lat, lng} maps.
  Future<List<Map<String, double>>> getTrackPoints(String entryId) async {
    final resp = await _dio.get('/flota/$entryId/location');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    final points = data['trackPoints'] as List? ?? [];
    return points.map((p) {
      final m = p as Map<String, dynamic>;
      return {
        'lat': (m['lat'] as num).toDouble(),
        'lng': (m['lng'] as num).toDouble(),
      };
    }).toList();
  }

  /// GET /conductor/fatiga — estado de fatiga del conductor autenticado (RF-14).
  Future<FatigaStatus> getFatigaStatus() async {
    final resp = await _dio.get('/conductor/fatiga');
    final body = resp.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw Exception(body['error'] ?? 'Error al obtener estado de fatiga');
    }
    final data = body['data'] as Map<String, dynamic>;
    return FatigaStatus.fromJson(data);
  }
}

// ── Modelo de respuesta de fatiga ─────────────────────────────────────────────

class FatigaStatus {
  final double horasConduccion;
  final double horasDescanso;
  final String estado; // apto | precaucion | riesgo | no_apto
  final String ultimaActualizacion;

  const FatigaStatus({
    required this.horasConduccion,
    required this.horasDescanso,
    required this.estado,
    required this.ultimaActualizacion,
  });

  factory FatigaStatus.fromJson(Map<String, dynamic> json) => FatigaStatus(
        horasConduccion: (json['horasConduccion'] as num).toDouble(),
        horasDescanso: (json['horasDescanso'] as num).toDouble(),
        estado: json['estado'] as String,
        ultimaActualizacion: json['ultimaActualizacion'] as String,
      );
}
