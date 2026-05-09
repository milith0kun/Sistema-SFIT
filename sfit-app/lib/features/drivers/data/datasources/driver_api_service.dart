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
    final body = resp.data;
    final data = (body is Map && body['data'] is Map) ? body['data'] as Map : const {};
    final rawItems = data['items'];
    final items = (rawItems is List)
        ? rawItems.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : <Map<String, dynamic>>[];
    return {
      'items': items,
      'total': data['total'] ?? items.length,
    };
  }

  Future<Map<String, dynamic>> getDriverDetail(String id) async {
    final resp = await _dio.get('/conductores/$id');
    final body = resp.data;
    return (body is Map && body['data'] is Map)
        ? Map<String, dynamic>.from(body['data'] as Map)
        : <String, dynamic>{};
  }

  /// Devuelve el registro de conductor del usuario autenticado.
  /// Incluye empresa, licencia, fatiga, reputación y vehículo asignado.
  /// Devuelve null si el usuario no tiene un registro de conductor (404 o
  /// si el backend responde sin campo `data` — caso típico cuando un admin
  /// recién cambió el rol a "conductor" pero todavía no creó el Driver).
  /// En ese caso devolvemos null para que la UI muestre el banner
  /// "Asocia tu empresa" en vez de reventar con un cast nulo a pantalla
  /// completa (FlutterErrorWidget rojo).
  Future<Map<String, dynamic>?> getMyDriverProfile() async {
    try {
      final resp = await _dio.get('/conductores/me');
      // Dio acepta status < 500 como respuesta normal, así que aquí
      // puede llegar 401/403/422 con shape de error en lugar de 200.
      if (resp.statusCode != null && resp.statusCode! >= 400) return null;
      final body = resp.data;
      if (body is! Map || body['success'] != true) return null;
      final data = body['data'];
      return (data is Map) ? Map<String, dynamic>.from(data) : null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      // Cualquier error de red/cast lo tratamos como "sin perfil de
      // conductor" para no propagar pantalla roja al ciudadano.
      return null;
    } catch (_) {
      return null;
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
    final body = resp.data;
    if (body is Map && body['data'] is Map) {
      return Map<String, dynamic>.from(body['data'] as Map);
    }
    final err = (body is Map ? body['error']?.toString() : null) ?? 'Error al actualizar perfil';
    throw Exception(err);
  }

  /// PATCH /conductores/me asociando una empresa al conductor autenticado.
  /// Devuelve el perfil actualizado (incluye companyName/companyRuc).
  Future<Map<String, dynamic>> setMyCompany(String companyId) async {
    final resp = await _dio.patch('/conductores/me', data: {
      'companyId': companyId,
    });
    final body = resp.data;
    if (body is Map && body['data'] is Map) {
      return Map<String, dynamic>.from(body['data'] as Map);
    }
    final err = (body is Map ? body['error']?.toString() : null) ?? 'Error al asociar empresa';
    throw Exception(err);
  }
}
