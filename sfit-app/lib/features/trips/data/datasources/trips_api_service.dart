import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../models/trip_model.dart';

part 'trips_api_service.g.dart';

@riverpod
TripsApiService tripsApiService(Ref ref) =>
    TripsApiService(ref.watch(dioClientProvider).dio);

/// Listado de FleetEntry del conductor (turnos del día). Provider invalidable:
/// `ref.invalidate(myFleetEntriesProvider)` después de iniciar/cerrar turno
/// fuerza el rebuild en `MyRoutesPage` y en cualquier widget que lo escuche.
final myFleetEntriesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final svc = ref.watch(tripsApiServiceProvider);
  return svc.getMyFleetEntries();
});

/// Rutas asignadas al conductor. También invalidable.
final myRoutesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final svc = ref.watch(tripsApiServiceProvider);
  return svc.getMyRoutes(limit: 20);
});

class TripsApiService {
  final Dio _dio;
  TripsApiService(this._dio);

  /// GET /viajes?limit=limit — viajes asignados al conductor autenticado.
  Future<List<TripModel>> getMyTrips({int limit = 30}) async {
    final resp = await _dio.get('/viajes', queryParameters: {'limit': limit});
    final body = resp.data as Map;
    final data = body['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => TripModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /rutas?limit=limit — rutas disponibles para el conductor.
  /// Devuelve datos crudos (sin modelo separado).
  Future<List<Map<String, dynamic>>> getMyRoutes({int limit = 20}) async {
    final resp = await _dio.get('/rutas', queryParameters: {'limit': limit});
    final body = resp.data as Map;
    final data = body['data'] as Map;
    final items = data['items'] as List;
    return items.cast<Map<String, dynamic>>();
  }

  /// PATCH /viajes/:id — confirma inicio de viaje (status → en_curso).
  Future<void> confirmTrip(String tripId) async {
    await _dio.patch('/viajes/$tripId', data: {'status': 'en_curso'});
  }

  /// PATCH /viajes/:id — cierra el viaje (status → completado).
  Future<void> closeTrip(String tripId, {String? observations}) async {
    await _dio.patch('/viajes/$tripId', data: {
      'status': 'completado',
      if (observations != null && observations.isNotEmpty)
        'observations': observations,
    });
  }

  // ── Workflow asignación push/pull (Fase 1 backend, Fase 4 app) ────────────

  /// GET /viajes?status=pendiente_aceptacion — viajes asignados al conductor
  /// autenticado en espera de aceptar o rechazar (flujo PUSH del operador).
  Future<List<Map<String, dynamic>>> getPendingTrips({int limit = 20}) async {
    final resp = await _dio.get('/viajes', queryParameters: {
      'status': 'pendiente_aceptacion',
      'limit': limit,
    });
    final body = resp.data as Map;
    final data = body['data'] as Map;
    return (data['items'] as List).cast<Map<String, dynamic>>();
  }

  /// GET /viajes/disponibles — catálogo PULL: viajes en pendiente_aceptacion
  /// SIN driver asignado en la municipalidad del conductor. Cualquiera puede
  /// reclamarlos con `claimTrip()`.
  Future<List<Map<String, dynamic>>> getAvailableTrips({int limit = 20}) async {
    final resp = await _dio.get('/viajes/disponibles', queryParameters: {
      'limit': limit,
    });
    final body = resp.data as Map;
    final data = body['data'] as Map;
    return (data['items'] as List).cast<Map<String, dynamic>>();
  }

  /// POST /viajes/:id/aceptar — el conductor confirma una asignación.
  /// Requiere que el viaje esté en pendiente_aceptacion y el driverId
  /// coincida con el del conductor autenticado.
  Future<void> acceptTrip(String tripId) async {
    await _dio.post('/viajes/$tripId/aceptar');
  }

  /// POST /viajes/:id/rechazar — el conductor declina con motivo (≥5 chars).
  Future<void> rejectTrip(String tripId, {required String reason}) async {
    await _dio.post('/viajes/$tripId/rechazar', data: {'rejectionReason': reason});
  }

  /// POST /viajes/:id/tomar — flujo PULL: reclama un viaje del catálogo.
  /// Asignación atómica anti-race en backend. `direction` opcional para
  /// rutas con ida/vuelta.
  Future<void> claimTrip(String tripId, {String? direction}) async {
    await _dio.post('/viajes/$tripId/tomar', data: {
      if (direction != null) 'direction': direction,
    });
  }

  /// POST /viajes/:id/iniciar — de aceptado a en_curso. Setea startTime
  /// del lado server.
  Future<void> startAssignedTrip(String tripId) async {
    await _dio.post('/viajes/$tripId/iniciar');
  }

  // ── Turno de conductor (FleetEntry) ─────────────────────────────────────────

  /// POST /flota — inicia un turno del conductor (crea FleetEntry en_ruta).
  /// Devuelve el id de la FleetEntry creada.
  Future<String> startTrip({
    required String vehicleId,
    required DateTime departureTime,
    bool checklistComplete = true,
    String? routeId,
  }) async {
    final hhmm = '${departureTime.hour.toString().padLeft(2, '0')}:${departureTime.minute.toString().padLeft(2, '0')}';
    final resp = await _dio.post('/flota', data: {
      'vehicleId': vehicleId,
      'departureTime': hhmm,
      'checklistComplete': checklistComplete,
      'status': 'en_ruta',
      if (routeId != null) 'routeId': routeId,
    });
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>;
    return data['id'] as String;
  }

  /// GET /rutas/:id — waypoints de una ruta para dibujar en el mapa.
  Future<List<Map<String, double>>> getRouteWaypoints(String routeId) async {
    final resp = await _dio.get('/rutas/$routeId');
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>;
    final wps = data['waypoints'] as List? ?? [];
    return wps.map((p) {
      final m = p as Map<String, dynamic>;
      return {
        'lat': (m['lat'] as num).toDouble(),
        'lng': (m['lng'] as num).toDouble(),
      };
    }).toList();
  }

  /// GET /rutas/:id — waypoints con metadata completa (order + label).
  /// Útil para renderizar paraderos numerados en el mapa.
  Future<List<Map<String, dynamic>>> getRouteWaypointsDetailed(
      String routeId) async {
    final resp = await _dio.get('/rutas/$routeId');
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>;
    final wps = data['waypoints'] as List? ?? [];
    return wps.asMap().entries.map((entry) {
      final m = entry.value as Map<String, dynamic>;
      return {
        'order': (m['order'] as num?)?.toInt() ?? entry.key,
        'lat': (m['lat'] as num).toDouble(),
        'lng': (m['lng'] as num).toDouble(),
        'label': m['label'] as String?,
      };
    }).toList();
  }

  /// GET /flota — viajes activos del conductor autenticado.
  Future<List<Map<String, dynamic>>> getMyFleetEntries() async {
    final resp = await _dio.get('/flota');
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>;
    final items = data['items'] as List;
    return items.cast<Map<String, dynamic>>();
  }

  /// GET /flota/:id — detalle del FleetEntry incluyendo `trackPoints`,
  /// `visitedStops`, métricas (`distanceMeters`, `durationSeconds`,
  /// `routeCompliancePercentage`) y `capture.status`. Usado por
  /// TripSummaryPage.
  Future<Map<String, dynamic>> getFleetEntryDetail(String entryId) async {
    final resp = await _dio.get('/flota/$entryId');
    final body = resp.data as Map<String, dynamic>;
    return body['data'] as Map<String, dynamic>;
  }

  /// DELETE /flota/:id — borra un turno cerrado (y sus LocationPings y
  /// RouteCapture asociadas). El conductor solo puede borrar sus propios
  /// turnos cerrados (validado server-side por driver match + status).
  Future<void> deleteFleetEntry(String entryId) async {
    await _dio.delete('/flota/$entryId');
  }

  /// PATCH /flota/:id — cierra el turno del conductor.
  ///
  /// El kilometraje real lo calcula el backend desde los `LocationPing`
  /// (campo `distanceMeters` vía haversine). El conductor sólo registra
  /// hora de regreso y observaciones opcionales.
  ///
  /// Devuelve `true` si el cierre se ejecutó ahora; `false` si el turno ya
  /// estaba cerrado server-side (idempotencia). El caller puede usar este
  /// flag para evitar re-disparar invalidaciones de caché o mostrar "ya
  /// cerrado" en lugar de "cerrado".
  ///
  /// Lanza `Exception` si el body responde `success: false` — antes el
  /// cliente asumía éxito por código 200 y dejaba el turno abierto en el
  /// servidor sin avisar al usuario.
  Future<bool> closeFleetEntry(
    String entryId, {
    DateTime? returnTime,
    String? observations,
  }) async {
    final rt = returnTime ?? DateTime.now();
    final hhmm = '${rt.hour.toString().padLeft(2, '0')}:${rt.minute.toString().padLeft(2, '0')}';
    final resp = await _dio.patch('/flota/$entryId', data: {
      'status': 'cerrado',
      'returnTime': hhmm,
      if (observations != null && observations.isNotEmpty)
        'observations': observations,
    });
    final body = resp.data as Map?;
    if (body == null || body['success'] == false) {
      final err = body?['error']?.toString() ?? 'Respuesta inválida del servidor';
      throw Exception(err);
    }
    final data = body['data'] as Map?;
    return data?['alreadyClosed'] != true;
  }

  /// POST /flota/:entryId/track-bulk — sube en lote el track persistido
  /// localmente. Backend dedupa por (entryId, ts) e idempotentemente inserta
  /// solo los puntos nuevos. Si el FleetEntry está cerrado, recalcula
  /// distanceMeters con el set completo. Devuelve `{received, inserted, duplicates, recalculated, distanceMeters}`.
  Future<Map<String, dynamic>> bulkUploadTrack({
    required String entryId,
    required List<Map<String, dynamic>> points,
  }) async {
    final resp = await _dio.post(
      '/flota/$entryId/track-bulk',
      data: {'points': points},
    );
    final body = resp.data as Map?;
    final status = resp.statusCode ?? 0;
    if (status >= 400 || body == null || body['success'] == false) {
      final err = body?['error'] as String? ?? 'HTTP $status';
      throw LocationSendException(err, statusCode: status);
    }
    final data = body['data'];
    if (data is! Map) {
      throw LocationSendException(
        'Respuesta inesperada del servidor',
        statusCode: status,
      );
    }
    return Map<String, dynamic>.from(data);
  }

  /// POST /rutas/:routeId/marcar-preferida — el conductor marca su propia
  /// FleetEntry como pasada "recomendada" de la ruta. El backend valida que
  /// la captura sea suya (driverId del session) y reescribe `Route.waypoints`
  /// con los puntos GPS de esta pasada (peso 100%). El próximo conductor
  /// que tome la ruta verá ese trazado como oficial.
  ///
  /// Devuelve `{routeId, preferredCaptureId, preferredAt, waypointsReplaced,
  /// waypointCount, totalPings, filteredByAccuracy}`.
  Future<Map<String, dynamic>> markRoutePreferredCapture({
    required String routeId,
    required String captureId,
  }) async {
    final resp = await _dio.post(
      '/rutas/$routeId/marcar-preferida',
      data: {'captureId': captureId},
    );
    final body = resp.data as Map?;
    final status = resp.statusCode ?? 0;
    if (status >= 400 || body == null || body['success'] == false) {
      final err = body?['error'] as String? ?? 'HTTP $status';
      throw LocationSendException(err, statusCode: status);
    }
    final data = body['data'];
    if (data is! Map) {
      throw LocationSendException(
        'Respuesta inesperada del servidor',
        statusCode: status,
      );
    }
    return Map<String, dynamic>.from(data);
  }

  /// PATCH /flota/:entryId/location — envía update de GPS al backend.
  /// Retorna el body `data` parseado (incluye `visitedStops` y `newlyVisited`).
  ///
  /// El `dio_client` global tiene `validateStatus: status < 500`, así que
  /// los 4xx llegan como respuesta normal en lugar de DioException.
  /// Detectamos `success:false` y lanzamos `LocationSendException` con el
  /// status para que el caller (LocationTrackingService) decida si reintentar
  /// o descartar el ping.
  Future<Map<String, dynamic>> sendLocation({
    required String entryId,
    required double lat,
    required double lng,
    double? accuracy,
    double? speed,
    String? action,
  }) async {
    final resp = await _dio.patch('/flota/$entryId/location', data: {
      'lat': lat,
      'lng': lng,
      if (accuracy != null) 'accuracy': accuracy,
      if (speed != null) 'speed': speed,
      if (action != null) 'action': action,
    });
    final body = resp.data as Map?;
    final status = resp.statusCode ?? 0;
    if (status >= 400 || body == null || body['success'] == false) {
      final err = body?['error'] as String? ?? 'HTTP $status';
      throw LocationSendException(err, statusCode: status);
    }
    final data = body['data'];
    if (data is! Map) {
      throw LocationSendException(
        'Respuesta inesperada del servidor',
        statusCode: status,
      );
    }
    return Map<String, dynamic>.from(data);
  }

  /// GET /flota/:entryId/location — obtiene trayecto y paraderos visitados.
  Future<TrackHistory> getTrackHistory(String entryId) async {
    final resp = await _dio.get('/flota/$entryId/location');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    final points = (data['trackPoints'] as List? ?? []).map((p) {
      final m = p as Map<String, dynamic>;
      return {
        'lat': (m['lat'] as num).toDouble(),
        'lng': (m['lng'] as num).toDouble(),
      };
    }).toList();
    final visited = (data['visitedStops'] as List? ?? [])
        .map((s) => Map<String, dynamic>.from(s as Map))
        .toList();
    return TrackHistory(trackPoints: points, visitedStops: visited);
  }

  /// GET /flota/:entryId/location — solo trayecto (legacy convenience).
  Future<List<Map<String, double>>> getTrackPoints(String entryId) async {
    final hist = await getTrackHistory(entryId);
    return hist.trackPoints;
  }

  /// GET /conductor/preferencias — última unidad y ruta usadas por el conductor.
  Future<DriverPreferences> getDriverPreferences() async {
    final resp = await _dio.get('/conductor/preferencias');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return DriverPreferences.fromJson(data);
  }

  /// GET /conductor/fatiga — estado de fatiga del conductor autenticado (RF-14).
  Future<FatigaStatus> getFatigaStatus() async {
    final resp = await _dio.get('/conductor/fatiga');
    final body = resp.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw Exception(body['error'] ?? 'Error al obtener estado de fatiga');
    }
    final data = body['data'] as Map<String, dynamic>;
    return FatigaStatus.fromJson(data);
  }
}

// ── Modelo de trayecto + paraderos visitados ───────────────────────────────

class TrackHistory {
  final List<Map<String, double>> trackPoints;
  final List<Map<String, dynamic>> visitedStops;
  const TrackHistory({required this.trackPoints, required this.visitedStops});
}

// ── Preferencias del conductor (última unidad/ruta) ────────────────────────

class DriverPreferenceVehicle {
  final String id;
  final String plate;
  final String? brand;
  final String? model;
  final String? vehicleTypeKey;
  final String? status;

  const DriverPreferenceVehicle({
    required this.id,
    required this.plate,
    this.brand,
    this.model,
    this.vehicleTypeKey,
    this.status,
  });

  factory DriverPreferenceVehicle.fromJson(Map<String, dynamic> j) =>
      DriverPreferenceVehicle(
        id: j['id'] as String,
        plate: j['plate'] as String? ?? '',
        brand: j['brand'] as String?,
        model: j['model'] as String?,
        vehicleTypeKey: j['vehicleTypeKey'] as String?,
        status: j['status'] as String?,
      );
}

class DriverPreferenceRoute {
  final String id;
  final String? code;
  final String? name;
  final String? type;
  final int? stops;
  final String? length;
  final String? status;

  const DriverPreferenceRoute({
    required this.id,
    this.code,
    this.name,
    this.type,
    this.stops,
    this.length,
    this.status,
  });

  factory DriverPreferenceRoute.fromJson(Map<String, dynamic> j) =>
      DriverPreferenceRoute(
        id: j['id'] as String,
        code: j['code'] as String?,
        name: j['name'] as String?,
        type: j['type'] as String?,
        stops: (j['stops'] as num?)?.toInt(),
        length: j['length'] as String?,
        status: j['status'] as String?,
      );
}

class DriverPreferences {
  final DriverPreferenceVehicle? vehicle;
  final DriverPreferenceRoute? route;

  const DriverPreferences({this.vehicle, this.route});

  factory DriverPreferences.fromJson(Map<String, dynamic> j) =>
      DriverPreferences(
        vehicle: j['vehicle'] != null
            ? DriverPreferenceVehicle.fromJson(
                j['vehicle'] as Map<String, dynamic>)
            : null,
        route: j['route'] != null
            ? DriverPreferenceRoute.fromJson(
                j['route'] as Map<String, dynamic>)
            : null,
      );
}

// ── Modelo de respuesta de fatiga ─────────────────────────────────────────────

class FatigaStatus {
  final double horasConduccion;
  final double horasDescanso;
  final String estado; // apto | precaucion | riesgo | no_apto
  final String ultimaActualizacion;

  const FatigaStatus({
    required this.horasConduccion,
    required this.horasDescanso,
    required this.estado,
    required this.ultimaActualizacion,
  });

  factory FatigaStatus.fromJson(Map<String, dynamic> json) => FatigaStatus(
        horasConduccion: (json['horasConduccion'] as num).toDouble(),
        horasDescanso: (json['horasDescanso'] as num).toDouble(),
        estado: json['estado'] as String,
        ultimaActualizacion: json['ultimaActualizacion'] as String,
      );
}

/// Excepción explícita lanzada por `sendLocation` cuando el backend rechaza
/// un ping (4xx con `success:false`). Lleva el status para que el drain
/// loop del LocationTrackingService decida la política de retry.
class LocationSendException implements Exception {
  final String message;
  final int statusCode;
  const LocationSendException(this.message, {required this.statusCode});

  @override
  String toString() => 'LocationSendException($statusCode): $message';
}
