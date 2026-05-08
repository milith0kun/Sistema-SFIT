import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';

part 'companies_api_service.g.dart';

@riverpod
CompaniesApiService companiesApiService(Ref ref) =>
    CompaniesApiService(ref.watch(dioClientProvider).dio);

/// Servicio para la búsqueda pública de empresas de transporte.
///
/// El endpoint `/public/empresas` no requiere scope geográfico — devuelve
/// todas las empresas activas registradas en SFIT a nivel nacional. Se usa
/// principalmente para el onboarding del conductor (asociarse a su empresa).
class CompaniesApiService {
  final Dio _dio;
  CompaniesApiService(this._dio);

  /// GET `/public/empresas?q=...&limit=...`
  ///
  /// Devuelve la lista cruda de empresas (campos: id, razonSocial, ruc,
  /// municipalityName). Si `q` es vacío, lista las primeras `limit`.
  Future<List<Map<String, dynamic>>> searchPublic({
    String? q,
    int limit = 30,
  }) async {
    final resp = await _dio.get('/public/empresas', queryParameters: {
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      'limit': limit,
    });
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>? ?? body;
    final items = (data['items'] as List? ?? const []).cast<Map<String, dynamic>>();
    return items;
  }
}
