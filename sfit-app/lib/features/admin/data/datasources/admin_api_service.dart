import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';

part 'admin_api_service.g.dart';

@riverpod
AdminApiService adminApiService(Ref ref) =>
    AdminApiService(ref.watch(dioClientProvider).dio);

class AdminApiService {
  final Dio _dio;
  AdminApiService(this._dio);

  Future<Map<String, dynamic>> getStatsMunicipal({String? municipalityId}) async {
    final resp = await _dio.get('/admin/stats/municipal', queryParameters: {
      if (municipalityId != null) 'municipalityId': municipalityId,
    });
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getActividad() async {
    final resp = await _dio.get('/admin/actividad');
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getUsers({
    String? status,
    String? role,
    int page = 1,
    int limit = 30,
  }) async {
    final resp = await _dio.get('/admin/usuarios', queryParameters: {
      'page': page,
      'limit': limit,
      if (status != null) 'status': status,
      if (role != null) 'role': role,
    });
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return {
      'items': (data['items'] as List)
          .map((e) => e as Map<String, dynamic>)
          .toList(),
      'total': data['total'] ?? 0,
    };
  }

  Future<void> approveUser(String id) async {
    await _dio.post('/users/$id/approve');
  }

  Future<void> rejectUser(String id, {String? reason}) async {
    await _dio.post('/users/$id/reject', data: {
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
  }

  Future<Map<String, dynamic>> getConfig() async {
    final resp = await _dio.get('/admin/config');
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  // ── RF-04-01: Empresas ────────────────────────────────────────

  Future<Map<String, dynamic>> getEmpresas({
    int page = 1,
    int limit = 30,
    bool? active,
  }) async {
    final resp = await _dio.get('/empresas', queryParameters: {
      'page': page,
      'limit': limit,
      if (active != null) 'active': active,
    });
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return {
      'items': (data['items'] as List)
          .map((e) => e as Map<String, dynamic>)
          .toList(),
      'total': data['total'] ?? 0,
    };
  }

  Future<Map<String, dynamic>> createEmpresa({
    required String ruc,
    required String razonSocial,
    required String repNombre,
    required String repDni,
    String? repPhone,
    List<String>? vehicleTypeKeys,
  }) async {
    final resp = await _dio.post('/empresas', data: {
      'ruc': ruc,
      'razonSocial': razonSocial,
      'representanteLegal': {
        'name': repNombre,
        'dni': repDni,
        if (repPhone != null && repPhone.isNotEmpty) 'phone': repPhone,
      },
      if (vehicleTypeKeys != null && vehicleTypeKeys.isNotEmpty)
        'vehicleTypeKeys': vehicleTypeKeys,
    });
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  Future<void> toggleEmpresaStatus(String id, {required bool active}) async {
    await _dio.patch('/empresas/$id', data: {'active': active});
  }
}
