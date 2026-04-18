import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';

part 'vehicle_api_service.g.dart';

@riverpod
VehicleApiService vehicleApiService(Ref ref) =>
    VehicleApiService(ref.watch(dioClientProvider).dio);

class VehicleApiService {
  final Dio _dio;
  VehicleApiService(this._dio);

  Future<Map<String, dynamic>> getVehicles({
    String? status,
    String? type,
    String? search,
    int limit = 100,
  }) async {
    final resp = await _dio.get('/vehiculos', queryParameters: {
      if (status != null) 'status': status,
      if (type != null) 'type': type,
      if (search != null && search.isNotEmpty) 'q': search,
      'limit': limit,
    });
    final data = (resp.data as Map)['data'] as Map;
    return {
      'items': (data['items'] as List)
          .map((e) => e as Map<String, dynamic>)
          .toList(),
      'total': data['total'] ?? 0,
    };
  }
}
