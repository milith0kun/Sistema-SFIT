import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';

part 'driver_api_service.g.dart';

@riverpod
DriverApiService driverApiService(Ref ref) =>
    DriverApiService(ref.watch(dioClientProvider).dio);

/// Perfil del conductor autenticado. `autoDispose` para que cada pantalla
/// reciba la versión fresca al volverse a observar, e `invalidable` para
/// forzar refresh tras editar perfil o asociar empresa desde otra pantalla.
final myDriverProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  return ref.watch(driverApiServiceProvider).getMyDriverProfile();
});

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

  /// Devuelve el registro de conductor del usuario autenticado.
  /// Incluye empresa, licencia, fatiga, reputación y vehículo asignado.
  /// Devuelve null si el usuario no tiene un registro de conductor (404).
  Future<Map<String, dynamic>?> getMyDriverProfile() async {
    try {
      final resp = await _dio.get('/conductores/me');
      return (resp.data as Map)['data'] as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  /// PATCH /conductores/me con campos personales (nombre, dni, licencia,
  /// categoría, teléfono). Validaciones server-side: DNI y licenseNumber
  /// únicos → 409 con `error` legible.
  Future<Map<String, dynamic>> updateMyProfile({
    String? name,
    String? dni,
    String? licenseNumber,
    String? licenseCategory,
    String? phone,
  }) async {
    final resp = await _dio.patch('/conductores/me', data: {
      if (name != null) 'name': name,
      if (dni != null) 'dni': dni,
      if (licenseNumber != null) 'licenseNumber': licenseNumber,
      if (licenseCategory != null) 'licenseCategory': licenseCategory,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  /// PATCH /conductores/me asociando una empresa al conductor autenticado.
  /// Devuelve el perfil actualizado (incluye companyName/companyRuc).
  Future<Map<String, dynamic>> setMyCompany(String companyId) async {
    final resp = await _dio.patch('/conductores/me', data: {
      'companyId': companyId,
    });
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }
}
