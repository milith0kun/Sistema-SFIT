import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/offline/outbox.dart';
import '../../../../core/offline/outbox_registry.dart';
import '../models/report_model.dart';

part 'reports_api_service.g.dart';

@riverpod
ReportsApiService reportsApiService(Ref ref) =>
    ReportsApiService(
      ref.watch(dioClientProvider).dio,
      offlineOutbox: ref.watch(reportsOutboxProvider),
    );

class ReportsApiService {
  final Dio _dio;
  /// Outbox para encolar reportes cuando el envío falla por red. El backend
  /// los recibe luego con el header `Idempotency-Key` para deduplicar
  /// reintentos (mismo payload → misma sanción/reporte único).
  final Outbox? _outbox;
  ReportsApiService(this._dio, {Outbox? offlineOutbox}) : _outbox = offlineOutbox;

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
  ///
  /// Comportamiento:
  ///   - Online + OK: retorna el id del reporte creado.
  ///   - Online + validación rechazada (400/422 con `success:false`):
  ///     lanza [ReportSubmitException] con el mensaje del backend.
  ///   - Offline / red caída: si hay un [Outbox] registrado, encola el
  ///     payload (con `Idempotency-Key`) y retorna un id placeholder
  ///     `offline-<timestamp>`. El UI debe interpretar ese prefijo como
  ///     "pendiente de sincronizar". Si no hay outbox, relanza la
  ///     excepción de red.
  Future<String> submitReport({
    required String vehiclePlate,
    required String category,
    String? description,
    String? vehicleTypeKey,
    double? latitude,
    double? longitude,
    String? qrToken,
    List<String>? imageUrls,
  }) async {
    final payload = <String, dynamic>{
      'vehiclePlate': vehiclePlate,
      'category': category,
      // Omitir el campo si viene vacío — el backend valida min:10
      // y rechazaría con 422 si se envía cadena vacía.
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      if (vehicleTypeKey != null) 'vehicleTypeKey': vehicleTypeKey,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (qrToken != null) 'qrToken': qrToken,
      if (imageUrls != null && imageUrls.isNotEmpty) 'imageUrls': imageUrls,
    };

    Response<dynamic> resp;
    try {
      resp = await _dio.post('/reportes', data: payload);
    } on DioException catch (e) {
      // Error puro de red (sin respuesta del backend) → encolar si hay
      // outbox configurado. Errores con respuesta del backend (4xx/5xx
      // que escapan al `validateStatus`) se relanzan tal cual: NO los
      // encolamos porque el backend ya rechazó la entrada.
      final isNetworkError = e.response == null && (
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout
      );
      if (isNetworkError && _outbox != null) {
        await _outbox.enqueue(payload);
        return 'offline-${DateTime.now().millisecondsSinceEpoch}';
      }
      rethrow;
    }
    final body = resp.data as Map?;
    // dio_client tiene `validateStatus: status < 500`, así que 4xx llega
    // como respuesta normal — hay que detectar `success: false` aquí.
    if (body == null || body['success'] == false) {
      // Express-validator envía errores en `errors: { campo: [msg] }`.
      // Si está, devolvemos el primer mensaje (más informativo que el genérico).
      String? msg;
      final errors = body?['errors'];
      if (errors is Map && errors.isNotEmpty) {
        final first = errors.values.first;
        if (first is List && first.isNotEmpty) {
          msg = first.first.toString();
        } else if (first is String) {
          msg = first;
        }
      }
      msg ??= body?['error'] as String?;
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
  /// Defensivo: si el backend responde sin `data` (ej. perfil incompleto)
  /// devolvemos lista vacía en lugar de propagar un cast nulo a la UI.
  Future<Map<String, dynamic>> getMisReportes({
    int page = 1,
    int limit = 20,
  }) async {
    final resp = await _dio.get('/reportes/mis-reportes', queryParameters: {
      'page': page,
      'limit': limit,
    });
    final body = resp.data;
    final data = (body is Map && body['data'] is Map)
        ? Map<String, dynamic>.from(body['data'] as Map)
        : <String, dynamic>{};
    final rawItems = data['items'];
    final items = (rawItems is List)
        ? rawItems.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : <Map<String, dynamic>>[];
    return {
      'items': items,
      'total': data['total'] ?? items.length,
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

  /// POST /reportes/:id/apelar — el ciudadano autor apela un reporte
  /// rechazado. Cambia el status del reporte a "revision" en backend y
  /// guarda el motivo. Sólo se permite una apelación por reporte.
  Future<void> appealReport(
    String reportId, {
    required String reason,
    List<String>? evidence,
  }) async {
    await _dio.post('/reportes/$reportId/apelar', data: {
      'reason': reason,
      if (evidence != null && evidence.isNotEmpty) 'evidence': evidence,
    });
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

  /// POST /uploads/reports — sube imágenes (multipart) y devuelve URLs.
  /// El page `submit_report_page` arma el `FormData` con los archivos
  /// (`files[]`) y las metadata (vehicle, category, etc.).
  Future<List<String>> uploadReportFiles(FormData files) async {
    final resp = await _dio.post('/uploads/reports', data: files);
    final data = (resp.data as Map)['data'];
    if (data is List) return data.cast<String>();
    if (data is Map && data['urls'] is List) {
      return (data['urls'] as List).cast<String>();
    }
    return const [];
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
