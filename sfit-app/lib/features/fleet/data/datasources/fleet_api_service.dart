import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../models/fleet_entry_model.dart';

part 'fleet_api_service.g.dart';

@riverpod
FleetApiService fleetApiService(Ref ref) =>
    FleetApiService(ref.watch(dioClientProvider).dio);

class FleetApiService {
  final Dio _dio;
  FleetApiService(this._dio);

  Future<List<FleetEntryModel>> getTodayFleet() async {
    final resp = await _dio.get('/flota');
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => FleetEntryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> registerDeparture({
    required String vehicleId,
    required String driverId,
    String? routeId,
    String? observations,
  }) async {
    final now = DateTime.now();
    await _dio.post('/flota', data: {
      'vehicleId': vehicleId,
      'driverId': driverId,
      if (routeId != null) 'routeId': routeId,
      'status': 'en_ruta',
      'departureTime': now.toIso8601String(),
      'checklistComplete': true,
      if (observations != null && observations.isNotEmpty)
        'observations': observations,
    });
  }

  Future<void> registerReturn({
    required String entryId,
    required double km,
    String? observations,
  }) async {
    await _dio.patch('/flota/$entryId', data: {
      'status': 'cerrado',
      'returnTime': DateTime.now().toIso8601String(),
      'km': km,
      if (observations != null && observations.isNotEmpty)
        'observations': observations,
    });
  }

  Future<List<Map<String, dynamic>>> getAvailableVehicles() async {
    final resp = await _dio.get('/vehiculos', queryParameters: {
      'status': 'disponible',
      'limit': 100,
    });
    final data = (resp.data as Map)['data'] as Map;
    return (data['items'] as List)
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  Future<List<Map<String, dynamic>>> getAptDrivers() async {
    final resp = await _dio.get('/conductores', queryParameters: {
      'status': 'apto',
      'limit': 100,
    });
    final data = (resp.data as Map)['data'] as Map;
    return (data['items'] as List)
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }
}
