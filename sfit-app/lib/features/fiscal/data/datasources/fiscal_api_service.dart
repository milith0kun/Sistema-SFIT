import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../shared/models/_id_normalize.dart';
import '../../../../shared/models/appeal_model.dart';
import '../../../../shared/models/sanction_model.dart';

part 'fiscal_api_service.g.dart';

@riverpod
FiscalApiService fiscalApiService(Ref ref) =>
    FiscalApiService(ref.watch(dioClientProvider).dio);

// ── Providers invalidables ─────────────────────────────────────────────────

/// Apelaciones que el fiscal debe resolver (status pendiente).
/// Refresh tras `resolveAppeal` con `ref.invalidate(appealsToResolveProvider)`.
final appealsToResolveProvider =
    FutureProvider.autoDispose<List<AppealModel>>((ref) async {
  return ref.watch(fiscalApiServiceProvider).getAppeals(status: 'pendiente');
});

/// Apelaciones ya resueltas por el fiscal autenticado (historial).
final myResolvedAppealsProvider =
    FutureProvider.autoDispose<List<AppealModel>>((ref) async {
  return ref.watch(fiscalApiServiceProvider).getAppeals(status: 'resuelta');
});

// ── Servicio ───────────────────────────────────────────────────────────────

/// Endpoints del rol fiscal: apelaciones, sanciones (creación/anulación) y
/// estadísticas operativas. Para inspecciones usa `inspection_api_service`.
class FiscalApiService {
  final Dio _dio;
  FiscalApiService(this._dio);

  // Apelaciones ─────────────────────────────────────────────────────────────

  Future<List<AppealModel>> getAppeals({
    String? status,
    int limit = 50,
  }) async {
    final resp = await _dio.get('/apelaciones', queryParameters: {
      if (status != null) 'status': status,
      'limit': limit,
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map((j) => AppealModel.fromJson(normalizeBackendJson(j))).toList();
  }

  Future<AppealModel> getAppealDetail(String id) async {
    final resp = await _dio.get('/apelaciones/$id');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return AppealModel.fromJson(normalizeBackendJson(data));
  }

  /// PATCH /apelaciones/:id/resolver — el fiscal aprueba o rechaza.
  /// `status` debe ser `resuelta` (aprueba) o `rechazada`.
  /// `resolution` debe tener al menos 5 caracteres (validado en backend).
  Future<AppealModel> resolveAppeal(
    String id, {
    required String status,
    required String resolution,
  }) async {
    final resp = await _dio.patch('/apelaciones/$id/resolver', data: {
      'status': status,
      'resolution': resolution,
    });
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return AppealModel.fromJson(normalizeBackendJson(data));
  }

  // Sanciones ───────────────────────────────────────────────────────────────

  Future<List<SanctionModel>> getSanctions({
    String? status,
    String? vehicleId,
    int limit = 50,
  }) async {
    final resp = await _dio.get('/sanciones', queryParameters: {
      'limit': limit,
      if (status != null) 'status': status,
      if (vehicleId != null) 'vehicleId': vehicleId,
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map((j) => SanctionModel.fromJson(normalizeBackendJson(j))).toList();
  }

  Future<SanctionModel> createSanction({
    required String vehicleId,
    required String faultType,
    required num amountSoles,
    num? amountUIT,
    String? description,
  }) async {
    final resp = await _dio.post('/sanciones', data: {
      'vehicleId': vehicleId,
      'faultType': faultType,
      'amountSoles': amountSoles,
      if (amountUIT != null) 'amountUIT': amountUIT,
      if (description != null && description.isNotEmpty)
        'description': description,
    });
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return SanctionModel.fromJson(normalizeBackendJson(data));
  }

  /// POST /sanciones/:id/anular — solo super_admin/admin_municipal/fiscal.
  Future<void> annulSanction(String id, {required String reason}) async {
    await _dio.post('/sanciones/$id/anular', data: {'reason': reason});
  }

  // Estadísticas del fiscal ─────────────────────────────────────────────────

  /// GET /admin/stats/fiscal — métricas del día (inspecciones realizadas,
  /// sanciones generadas, score promedio, etc.). Permitido a fiscal y admins.
  Future<Map<String, dynamic>> getFiscalStats({DateTime? date}) async {
    final resp = await _dio.get('/admin/stats/fiscal', queryParameters: {
      if (date != null) 'date': date.toIso8601String().substring(0, 10),
    });
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }
}
