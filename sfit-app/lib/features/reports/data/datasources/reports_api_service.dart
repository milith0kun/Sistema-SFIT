import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../models/report_model.dart';

part 'reports_api_service.g.dart';

@riverpod
ReportsApiService reportsApiService(Ref ref) =>
    ReportsApiService(ref.watch(dioClientProvider).dio);

class ReportsApiService {
  final Dio _dio;
  ReportsApiService(this._dio);

  /// GET /reportes — retorna lista de reportes, filtrable por estado.
  Future<List<ReportModel>> getReports({
    String? status,
    int limit = 30,
  }) async {
    final resp = await _dio.get('/reportes', queryParameters: {
      'limit': limit,
      if (status != null) 'status': status,
    });
    final body = resp.data as Map;
    final data = body['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => ReportModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /reportes — envía un nuevo reporte ciudadano.
  /// Retorna el ID del reporte creado.
  /// [latitude] y [longitude] son opcionales (RF-12-03 anti-fraude capa 2).
  /// [qrToken] es el JSON serializado del QR escaneado (RF-12-04 anti-fraude capa 4).
  Future<String> submitReport({
    required String vehiclePlate,
    required String category,
    required String description,
    String? vehicleTypeKey,
    double? latitude,
    double? longitude,
    String? qrToken, // RF-12-04: payload JSON del QR escaneado
  }) async {
    final resp = await _dio.post('/reportes', data: {
      'vehiclePlate': vehiclePlate,
      'category': category,
      'description': description,
      if (vehicleTypeKey != null) 'vehicleTypeKey': vehicleTypeKey,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (qrToken != null) 'qrToken': qrToken, // RF-12-04
    });
    final data = (resp.data as Map)['data'] as Map;
    return data['id'] as String;
  }

  /// PATCH /reportes/:id — actualiza el estado de un reporte (fiscal).
  Future<void> updateReportStatus(
    String id,
    String status, {
    String? rejectionReason,
  }) async {
    await _dio.patch('/reportes/$id', data: {
      'status': status,
      if (rejectionReason != null && rejectionReason.isNotEmpty)
        'rejectionReason': rejectionReason,
    });
  }
}
