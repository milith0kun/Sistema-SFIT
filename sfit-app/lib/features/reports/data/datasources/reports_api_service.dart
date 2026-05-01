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
  /// Lanza [ReportSubmitException] con el mensaje del backend si la
  /// respuesta no es exitosa (ej. 429 rate limit, 400 validación).
  Future<String> submitReport({
    required String vehiclePlate,
    required String category,
    required String description,
    String? vehicleTypeKey,
    double? latitude,
    double? longitude,
    String? qrToken,
    List<String>? imageUrls,
  }) async {
    final resp = await _dio.post('/reportes', data: {
      'vehiclePlate': vehiclePlate,
      'category': category,
      'description': description,
      if (vehicleTypeKey != null) 'vehicleTypeKey': vehicleTypeKey,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (qrToken != null) 'qrToken': qrToken,
      if (imageUrls != null && imageUrls.isNotEmpty) 'imageUrls': imageUrls,
    });
    final body = resp.data as Map?;
    // dio_client tiene `validateStatus: status < 500`, así que 4xx llega
    // como respuesta normal — hay que detectar `success: false` aquí.
    if (body == null || body['success'] == false) {
      final msg = body?['error'] as String?;
      throw ReportSubmitException(
        msg ?? 'No se pudo enviar el reporte',
        statusCode: resp.statusCode,
      );
    }
    final data = body['data'] as Map?;
    final id = data?['id'] as String?;
    if (id == null) {
      throw ReportSubmitException(
        'Respuesta inesperada del servidor',
        statusCode: resp.statusCode,
      );
    }
    return id;
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

  /// GET /reportes/mis-reportes — lista reportes del ciudadano autenticado.
  Future<Map<String, dynamic>> getMisReportes({
    int page = 1,
    int limit = 20,
  }) async {
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

  /// GET /reportes/feed — feed público de reportes validados con filtros.
  /// [region] = 'all' | 'province' | 'municipality'
  /// [order] = 'recent' | 'supported' | 'nearby'
  Future<Map<String, dynamic>> getFeed({
    String region = 'municipality',
    String? category,
    String order = 'recent',
    int page = 1,
    int limit = 20,
  }) async {
    final resp = await _dio.get('/reportes/feed', queryParameters: {
      'region': region,
      if (category != null && category.isNotEmpty) 'category': category,
      'order': order,
      'page': page,
      'limit': limit,
    });
    final data = (resp.data as Map)['data'] as Map;
    return {
      'items': (data['items'] as List)
          .map((e) => e as Map<String, dynamic>)
          .toList(),
      'total': data['total'] ?? 0,
      'hasMore': data['hasMore'] ?? false,
    };
  }

  /// POST /reportes/:id/apoyar — alterna apoyo del ciudadano a un reporte.
  /// Retorna el nuevo conteo y si el usuario apoya o no.
  Future<Map<String, dynamic>> toggleApoyo(String reportId) async {
    final resp = await _dio.post('/reportes/$reportId/apoyar');
    final data = (resp.data as Map)['data'] as Map;
    return {
      'apoyado': data['apoyado'] as bool,
      'totalApoyos': data['totalApoyos'] as int,
    };
  }
}

/// Error con mensaje legible para el usuario lanzado cuando el backend
/// rechaza un envío de reporte (rate limit, validación, etc.).
class ReportSubmitException implements Exception {
  final String message;
  final int? statusCode;
  const ReportSubmitException(this.message, {this.statusCode});

  @override
  String toString() => message;
}
