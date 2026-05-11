import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../shared/models/company_brief_model.dart';
import '../../../../shared/models/_id_normalize.dart';
import '../../../../shared/models/conductor_model.dart';
import '../../../../shared/models/fleet_entry_model.dart';
import '../../../../shared/models/passenger_model.dart';
import '../../../../shared/models/route_candidate_model.dart';
import '../../../../shared/models/route_model.dart';
import '../../../trips/data/models/trip_model.dart';
import '../models/operator_dashboard_summary.dart';
import '../models/vehicle_model.dart';

part 'operator_api_service.g.dart';

@riverpod
OperatorApiService operatorApiService(Ref ref) =>
    OperatorApiService(ref.watch(dioClientProvider).dio);

// ── Providers invalidables ─────────────────────────────────────────────────

/// Conductores asociables/asociados al operador. Patrón usado por
/// `asociar_conductores_page` y `conductores_tab_page`.
final operadorConductoresProvider =
    FutureProvider.autoDispose<List<ConductorModel>>((ref) async {
  return ref.watch(operatorApiServiceProvider).getOperadorConductores();
});

/// Empresa del operador autenticado (cache compartido por nuevo_conductor /
/// nuevo_vehiculo / fleet_analytics).
final miEmpresaProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(operatorApiServiceProvider).getMiEmpresa();
});

/// Lista de FleetEntries del operador para el tab de análisis de flota.
final myFleetProvider =
    FutureProvider.autoDispose<List<FleetEntryModel>>((ref) async {
  return ref.watch(operatorApiServiceProvider).getFlota();
});

/// Filtro UBIGEO 2-dig seleccionado en el listado de rutas. `null` = todos.
/// Se mantiene como state global porque el chip de filtro vive en el tab
/// Oficiales pero los providers consumen el valor.
final selectedRoutesDepartmentProvider = StateProvider<String?>((_) => null);

/// Rutas operativas del operador. Reactivo al filtro de departamento.
final operadorRoutesProvider =
    FutureProvider.autoDispose<List<RouteModel>>((ref) async {
  final dept = ref.watch(selectedRoutesDepartmentProvider);
  return ref.watch(operatorApiServiceProvider).getRoutes(departmentCode: dept);
});

/// Rutas candidatas pendientes de validar/asignar.
final routeCandidatesProvider =
    FutureProvider.autoDispose<List<RouteCandidateModel>>((ref) async {
  return ref.watch(operatorApiServiceProvider).getRouteCandidates();
});

/// Viajes del operador del periodo actual.
final operadorTripsProvider =
    FutureProvider.autoDispose<List<TripModel>>((ref) async {
  return ref.watch(operatorApiServiceProvider).getTrips();
});

/// Resumen del dashboard del operador (vehículos, conductores, flota del día,
/// alertas). Reemplaza los KPIs hardcodeados del home.
final operatorDashboardProvider =
    FutureProvider.autoDispose<OperatorDashboardSummary>((ref) async {
  return ref.watch(operatorApiServiceProvider).getDashboard();
});

// ── Servicio ───────────────────────────────────────────────────────────────

class OperatorApiService {
  final Dio _dio;
  OperatorApiService(this._dio);

  // CRUD básico (legacy, usado por conductores_tab y vehiculos_tab) ─────────

  Future<List<ConductorModel>> getConductores({int limit = 50}) async {
    final resp = await _dio.get('/conductores', queryParameters: {'limit': limit});
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => ConductorModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<VehicleModel>> getVehiculos({int limit = 50}) async {
    final resp = await _dio.get('/vehiculos', queryParameters: {'limit': limit});
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => VehicleModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> createConductor({
    required String name, required String dni,
    required String licenseNumber, required String licenseCategory,
    String? phone,
  }) async {
    await _dio.post('/conductores', data: {
      'name': name, 'dni': dni,
      'licenseNumber': licenseNumber, 'licenseCategory': licenseCategory,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
  }

  Future<void> createVehiculo({
    required String plate, required String brand,
    required String model, required int year,
    required String vehicleTypeKey, String? soatExpiry,
  }) async {
    await _dio.post('/vehiculos', data: {
      'plate': plate.toUpperCase(), 'brand': brand, 'model': model,
      'year': year, 'vehicleTypeKey': vehicleTypeKey,
      if (soatExpiry != null && soatExpiry.isNotEmpty) 'soatExpiry': soatExpiry,
    });
  }

  // Asociación de conductores ───────────────────────────────────────────────

  Future<List<ConductorModel>> getOperadorConductores({
    String? q,
    int limit = 50,
    String? departmentCode,
  }) async {
    final resp = await _dio.get('/operador/conductores', queryParameters: {
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      'limit': limit,
      if (departmentCode != null && departmentCode.isNotEmpty)
        'departmentCode': departmentCode,
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map(ConductorModel.fromJson).toList();
  }

  Future<void> asociarConductor(String driverId) async {
    await _dio.post('/operador/conductores/$driverId/asociar');
  }

  // Mi empresa ──────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getMiEmpresa() async {
    final resp = await _dio.get('/operador/mi-empresa');
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  /// Resumen agregado de la empresa para el home (KPIs reales).
  Future<OperatorDashboardSummary> getDashboard() async {
    final resp = await _dio.get('/operador/dashboard');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return OperatorDashboardSummary.fromJson(data);
  }

  // Flota ───────────────────────────────────────────────────────────────────

  Future<List<FleetEntryModel>> getFlota({
    DateTime? desde,
    DateTime? hasta,
    int limit = 200,
  }) async {
    final resp = await _dio.get('/flota', queryParameters: {
      'limit': limit,
      if (desde != null) 'desde': desde.toIso8601String(),
      if (hasta != null) 'hasta': hasta.toIso8601String(),
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map((j) => FleetEntryModel.fromJson(normalizeBackendJson(j))).toList();
  }

  // Rutas y candidatas ──────────────────────────────────────────────────────

  Future<List<RouteModel>> getRoutes({
    int limit = 100,
    String? departmentCode,
  }) async {
    final resp = await _dio.get('/rutas', queryParameters: {
      'limit': limit,
      if (departmentCode != null && departmentCode.isNotEmpty)
        'departmentCode': departmentCode,
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map((j) => RouteModel.fromJson(normalizeBackendJson(j))).toList();
  }

  Future<List<RouteCandidateModel>> getRouteCandidates({
    String? status,
    int limit = 50,
  }) async {
    final resp = await _dio.get('/rutas/candidatas', queryParameters: {
      if (status != null) 'status': status,
      'limit': limit,
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map((j) => RouteCandidateModel.fromJson(normalizeBackendJson(j))).toList();
  }

  Future<RouteCandidateModel> getRouteCandidateDetail(String id) async {
    final resp = await _dio.get('/rutas/candidatas/$id');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return RouteCandidateModel.fromJson(normalizeBackendJson(data));
  }

  Future<void> assignRouteCandidate(String id, {required String routeId}) async {
    await _dio.post('/rutas/candidatas/$id/asignar', data: {'routeId': routeId});
  }

  Future<void> dismissRouteCandidate(String id, {required String reason}) async {
    await _dio.post('/rutas/candidatas/$id/descartar', data: {'reason': reason});
  }

  /// DELETE /rutas/candidatas/:id — borra DEFINITIVAMENTE la captura.
  ///
  /// Distinto de `dismissRouteCandidate` (que solo marca status=rejected):
  /// éste elimina el documento de la base. No puede borrarse si la captura
  /// ya fue promovida a una Route oficial — el backend devuelve 409.
  Future<void> deleteRouteCandidate(String id) async {
    await _dio.delete('/rutas/candidatas/$id');
  }

  /// POST /rutas/candidatas/:id/validar — convierte la candidata en RouteModel.
  /// `extra` contiene campos opcionales (code, type, municipalityId, etc.).
  Future<RouteModel> validateRouteCandidate(
    String id, {
    required String name,
    Map<String, dynamic>? extra,
  }) async {
    final resp = await _dio.post('/rutas/candidatas/$id/validar', data: {
      'name': name,
      if (extra != null) ...extra,
    });
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return RouteModel.fromJson(normalizeBackendJson(data));
  }

  Future<RouteModel> getRouteDetail(String id) async {
    final resp = await _dio.get('/rutas/$id');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return RouteModel.fromJson(normalizeBackendJson(data));
  }

  Future<RouteModel> updateRoute(String id, Map<String, dynamic> patch) async {
    final resp = await _dio.patch('/rutas/$id', data: patch);
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return RouteModel.fromJson(normalizeBackendJson(data));
  }

  /// POST /rutas — crea una nueva ruta para la empresa del operador
  /// (el backend infiere companyId del JWT). El payload debe incluir
  /// `name`, `code`, `serviceScope` y los campos específicos según scope:
  ///   - urbano_*: `waypoints[]` con al menos 2 elementos
  ///   - interprovincial_*: `originDistrictCode` + `destinationDistrictCode`
  Future<RouteModel> createRoute(Map<String, dynamic> payload) async {
    final resp = await _dio.post('/rutas', data: payload);
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return RouteModel.fromJson(normalizeBackendJson(data));
  }

  /// POST /rutas/:id/recalcular — converge capturas GPS y recalcula tanto
  /// `waypoints` como `polylineGeometry` (snap-to-roads). Sin esto, el mapa
  /// de la app pinta líneas rectas waypoint-a-waypoint que cruzan manzanas.
  /// Devuelve `before`/`after` waypoints para mostrar el diff al operador.
  Future<Map<String, dynamic>> recalculateRoute(
    String id, {
    bool preview = false,
  }) async {
    final resp = await _dio.post(
      '/rutas/$id/recalcular',
      data: {if (preview) 'preview': true},
    );
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  /// GET /rutas/:id/pasadas — historial de pasadas de la ruta con score,
  /// `isBest` (mejor automática) e `isPreferred` (mejor manual del operador).
  /// Datos heterogéneos por ahora — el caller los consume como Map.
  Future<Map<String, dynamic>> getRoutePasses(String routeId, {int limit = 30}) async {
    final resp = await _dio.get(
      '/rutas/$routeId/pasadas',
      queryParameters: {'limit': limit},
    );
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  /// POST /rutas/:id/marcar-preferida — el operador marca manualmente una
  /// pasada (FleetEntry) como la "mejor" del corredor. Tiene precedencia
  /// sobre el score automático. La UI debe distinguirlas como
  /// "MEJOR (manual)" vs "MEJOR (automática)".
  Future<void> markRoutePreferredCapture(
    String routeId, {
    required String captureId,
  }) async {
    await _dio.post(
      '/rutas/$routeId/marcar-preferida',
      data: {'captureId': captureId},
    );
  }

  /// DELETE /rutas/:id/marcar-preferida — limpia el override manual y
  /// vuelve al `isBest` automático.
  Future<void> clearRoutePreferredCapture(String routeId) async {
    await _dio.delete('/rutas/$routeId/marcar-preferida');
  }

  // Viajes y pasajeros ──────────────────────────────────────────────────────

  Future<List<TripModel>> getTrips({
    DateTime? desde,
    DateTime? hasta,
    int limit = 50,
  }) async {
    final resp = await _dio.get('/viajes', queryParameters: {
      'limit': limit,
      if (desde != null) 'desde': desde.toIso8601String(),
      if (hasta != null) 'hasta': hasta.toIso8601String(),
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map(TripModel.fromJson).toList();
  }

  Future<TripModel> getTripDetail(String id) async {
    final resp = await _dio.get('/viajes/$id');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return TripModel.fromJson(data);
  }

  Future<List<PassengerModel>> getPassengers(String tripId) async {
    final resp = await _dio.get('/viajes/$tripId/pasajeros');
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map((j) => PassengerModel.fromJson(normalizeBackendJson(j))).toList();
  }

  Future<PassengerModel> addPassenger(
    String tripId, {
    required String name,
    String? dni,
    String? seat,
    String? contact,
    String? boardingStop,
    String? destinationStop,
    String? note,
  }) async {
    final resp = await _dio.post('/viajes/$tripId/pasajeros', data: {
      'name': name,
      if (dni != null && dni.isNotEmpty) 'dni': dni,
      if (seat != null && seat.isNotEmpty) 'seat': seat,
      if (contact != null && contact.isNotEmpty) 'contact': contact,
      if (boardingStop != null) 'boardingStop': boardingStop,
      if (destinationStop != null) 'destinationStop': destinationStop,
      if (note != null && note.isNotEmpty) 'note': note,
    });
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return PassengerModel.fromJson(normalizeBackendJson(data));
  }

  Future<void> deletePassenger(String tripId, String passengerId) async {
    await _dio.delete('/viajes/$tripId/pasajeros/$passengerId');
  }

  Future<PassengerModel> updatePassenger(
    String tripId,
    String passengerId,
    Map<String, dynamic> patch,
  ) async {
    final resp = await _dio.patch(
      '/viajes/$tripId/pasajeros/$passengerId',
      data: patch,
    );
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return PassengerModel.fromJson(normalizeBackendJson(data));
  }

  Future<Map<String, dynamic>> importPassengers(
    String tripId,
    FormData csv,
  ) async {
    final resp = await _dio.post(
      '/viajes/$tripId/pasajeros/import',
      data: csv,
    );
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  // Manifiesto ──────────────────────────────────────────────────────────────

  Future<void> uploadManifestPhoto(String tripId, FormData photo) async {
    await _dio.post('/viajes/$tripId/manifest-photo', data: photo);
  }

  // QR de vehículo ──────────────────────────────────────────────────────────

  /// GET /vehiculos/:id/qr — devuelve el token firmado para generar el QR.
  Future<String> getVehicleQrToken(String vehicleId) async {
    final resp = await _dio.get('/vehiculos/$vehicleId/qr');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return data['token'] as String? ?? data['qrToken'] as String? ?? '';
  }

  // Empresas (para validate_capture al asignar empresa a la ruta) ───────────

  Future<List<CompanyBriefModel>> searchEmpresas({String? q, int limit = 30}) async {
    final resp = await _dio.get('/empresas', queryParameters: {
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      'limit': limit,
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return items.map((j) => CompanyBriefModel.fromJson(normalizeBackendJson(j))).toList();
  }
}
