import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';

part 'report_api_service.g.dart';

@riverpod
ReportApiService reportApiService(Ref ref) =>
    ReportApiService(ref.watch(dioClientProvider).dio);

class ReportApiService {
  final Dio _dio;
  ReportApiService(this._dio);

  Future<Map<String, dynamic>> getReports({
    String? status,
    int page = 1,
    int limit = 30,
  }) async {
    final resp = await _dio.get('/reportes', queryParameters: {
      if (status != null) 'status': status,
      'page': page,
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

  Future<void> submitReport({
    required String category,
    required String description,
    String? vehiclePlate,
    String? municipalityId,
  }) async {
    await _dio.post('/reportes', data: {
      'category': category,
      'description': description,
      if (vehiclePlate != null && vehiclePlate.isNotEmpty)
        'vehiclePlate': vehiclePlate,
      if (municipalityId != null) 'municipalityId': municipalityId,
    });
  }

  Future<void> updateReportStatus(String id, String status) async {
    await _dio.patch('/reportes/$id', data: {'status': status});
  }

  Future<Map<String, dynamic>> getMisReportes({int page = 1, int limit = 20}) async {
    final resp = await _dio.get('/reportes/mis-reportes', queryParameters: {
      'page': page,
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
