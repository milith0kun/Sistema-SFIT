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
}
