import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';

part 'driver_api_service.g.dart';

@riverpod
DriverApiService driverApiService(Ref ref) =>
    DriverApiService(ref.watch(dioClientProvider).dio);

class DriverApiService {
  final Dio _dio;
  DriverApiService(this._dio);

  Future<Map<String, dynamic>> getDrivers({
    String? status,
    String? search,
    int limit = 100,
  }) async {
    final resp = await _dio.get('/conductores', queryParameters: {
      if (status != null) 'status': status,
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

  Future<Map<String, dynamic>> getDriverDetail(String id) async {
    final resp = await _dio.get('/conductores/$id');
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }
}
