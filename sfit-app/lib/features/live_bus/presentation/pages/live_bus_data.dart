/// Modelos de datos para la pantalla "Buses en vivo".
///
/// Reflejan la respuesta del endpoint público
/// GET /api/public/flota/activas?lat=&lng=&limit=
/// (ver `sfit-web/src/app/api/public/flota/activas/route.ts`).
library;

class BusWaypoint {
  final double lat;
  final double lng;
  final String? label;
  final int order;

  const BusWaypoint({required this.lat, required this.lng, this.label, required this.order});

  factory BusWaypoint.fromJson(Map<String, dynamic> j) => BusWaypoint(
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
        label: j['label'] as String?,
        order: (j['order'] as num?)?.toInt() ?? 0,
      );
}

class BusEtaStop {
  final int stopIndex;
  final String label;
  final double lat;
  final double lng;
  final int distanceFromBusMeters;
  final int etaSeconds;
  final bool visited;

  const BusEtaStop({
    required this.stopIndex,
    required this.label,
    required this.lat,
    required this.lng,
    required this.distanceFromBusMeters,
    required this.etaSeconds,
    required this.visited,
  });

  factory BusEtaStop.fromJson(Map<String, dynamic> j) => BusEtaStop(
        stopIndex: (j['stopIndex'] as num?)?.toInt() ?? 0,
        label: j['label'] as String? ?? 'Paradero',
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
        distanceFromBusMeters: (j['distanceFromBusMeters'] as num?)?.toInt() ?? 0,
        etaSeconds: (j['etaSeconds'] as num?)?.toInt() ?? 0,
        visited: j['visited'] as bool? ?? false,
      );
}

/// Parada detectada automáticamente del trazo en vivo del conductor.
/// El backend la calcula en `/api/public/flota/activas`: identifica clusters
/// de puntos GPS donde el bus permaneció >30s en un radio <15m.
class LearnedStop {
  final double lat;
  final double lng;
  /// Tiempo total que el bus pasó en este paradero (segundos).
  final int durationSeconds;

  const LearnedStop({
    required this.lat,
    required this.lng,
    required this.durationSeconds,
  });

  factory LearnedStop.fromJson(Map<String, dynamic> j) => LearnedStop(
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
        durationSeconds: (j['durationSeconds'] as num?)?.toInt() ?? 0,
      );
}

class BusData {
  final String id;
  final String plate;
  final String vehicleType;
  final String vehicleStatus;
  final double lat;
  final double lng;
  /// Velocidad reportada por el GPS del conductor (m/s). null si el bus
  /// nunca reportó velocidad (siempre detenido o GPS sin soporte de speed).
  final double? speed;
  final String? routeId;
  final String? routeName;
  final String? routeCode;
  /// Nombre del municipio que administra al bus (ej. "Cusco", "San Jerónimo").
  /// Permite al ciudadano identificar de qué jurisdicción es la unidad.
  final String? municipalityName;
  final List<BusWaypoint> waypoints;
  /// Geometría real de la ruta siguiendo calles (cacheada en backend con
  /// Google Routes API). Si está disponible, la app dibuja la polyline con
  /// estos coords en lugar de los waypoints crudos. Cada elemento es
  /// `[lat, lng]`.
  final List<List<double>> polylineCoords;
  /// Últimos puntos GPS reales que el conductor recorrió (los más recientes,
  /// orden cronológico ascendente). Se usa para dibujar el trazo "en vivo"
  /// cuando la ruta no tiene polyline ni waypoints definidos. Cada elemento
  /// es `{lat, lng}`.
  final List<List<double>> liveTrack;
  /// Paradas aprendidas automáticamente: clusters del trazo donde el bus
  /// permaneció >30s en un radio <15m. Permite mostrar "paraderos detectados"
  /// aunque la ruta no esté formalmente definida — el sistema aprende del
  /// recorrido real del conductor.
  final List<LearnedStop> learnedStops;
  final List<BusEtaStop> etaByStop;
  final String? nextStopLabel;
  final int? nextStopEta;
  final String? locationUpdatedAt;
  final int? distanceFromUserMeters;
  /// Bus marcado como fuera de la ruta planeada (>100m de la polyline).
  /// La app muestra un badge naranja en el marcador.
  final bool isOffRoute;

  const BusData({
    required this.id,
    required this.plate,
    required this.vehicleType,
    required this.vehicleStatus,
    required this.lat,
    required this.lng,
    this.speed,
    this.routeId,
    this.routeName,
    this.routeCode,
    this.municipalityName,
    this.waypoints = const [],
    this.polylineCoords = const [],
    this.liveTrack = const [],
    this.learnedStops = const [],
    this.etaByStop = const [],
    this.nextStopLabel,
    this.nextStopEta,
    this.locationUpdatedAt,
    this.distanceFromUserMeters,
    this.isOffRoute = false,
  });

  factory BusData.fromJson(Map<String, dynamic> j) {
    final loc = j['currentLocation'] as Map<String, dynamic>? ?? const {};
    final route = j['route'] as Map<String, dynamic>?;
    final ns = j['nextStop'] as Map<String, dynamic>?;
    final etaList = (j['etaByStop'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final wpList = (route?['waypoints'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final polyRaw = route?['polylineCoords'] as List?;
    final polyCoords = polyRaw
            ?.map<List<double>>((p) {
              final list = (p as List).cast<num>();
              return [list[0].toDouble(), list[1].toDouble()];
            })
            .toList() ??
        const <List<double>>[];
    // liveTrack del backend viene como [{lat,lng}, ...] (objects, no arrays).
    final liveTrackRaw = j['liveTrack'] as List?;
    final liveTrack = liveTrackRaw
            ?.map<List<double>>((p) {
              final m = p as Map<String, dynamic>;
              return [(m['lat'] as num).toDouble(), (m['lng'] as num).toDouble()];
            })
            .toList() ??
        const <List<double>>[];
    // Paradas aprendidas: [{lat,lng,durationSeconds}].
    final learnedRaw = j['learnedStops'] as List?;
    final learnedStops = learnedRaw
            ?.map<LearnedStop>((p) => LearnedStop.fromJson(p as Map<String, dynamic>))
            .toList() ??
        const <LearnedStop>[];
    return BusData(
      id: j['id'] as String? ?? '',
      plate: j['plate'] as String? ?? '—',
      vehicleType: j['vehicleType'] as String? ?? 'omnibus',
      vehicleStatus: j['vehicleStatus'] as String? ?? 'apto',
      lat: (loc['lat'] as num?)?.toDouble() ?? 0,
      lng: (loc['lng'] as num?)?.toDouble() ?? 0,
      speed: (loc['speed'] as num?)?.toDouble(),
      routeId: route?['id'] as String?,
      routeName: route?['name'] as String?,
      routeCode: route?['code'] as String?,
      municipalityName: j['municipalityName'] as String?,
      waypoints: wpList.map(BusWaypoint.fromJson).toList(),
      polylineCoords: polyCoords,
      liveTrack: liveTrack,
      learnedStops: learnedStops,
      etaByStop: etaList.map(BusEtaStop.fromJson).toList(),
      nextStopLabel: ns?['label'] as String?,
      nextStopEta: (ns?['etaSeconds'] as num?)?.toInt(),
      locationUpdatedAt: loc['updatedAt']?.toString(),
      distanceFromUserMeters: (j['distanceFromUserMeters'] as num?)?.toInt(),
      isOffRoute: j['isOffRoute'] as bool? ?? false,
    );
  }
}

/// Bus simplificado para la lista de rutas activas (campos reducidos).
class ActiveBusLite {
  final String id;
  final String plate;
  final double lat;
  final double lng;
  final int? distanceFromUserMeters;

  const ActiveBusLite({
    required this.id,
    required this.plate,
    required this.lat,
    required this.lng,
    this.distanceFromUserMeters,
  });

  factory ActiveBusLite.fromJson(Map<String, dynamic> j) => ActiveBusLite(
        id: j['id'] as String? ?? '',
        plate: j['plate'] as String? ?? '—',
        lat: (j['lat'] as num?)?.toDouble() ?? 0,
        lng: (j['lng'] as num?)?.toDouble() ?? 0,
        distanceFromUserMeters: (j['distanceFromUserMeters'] as num?)?.toInt(),
      );
}

class NearestStop {
  final int stopIndex;
  final String label;
  final double lat;
  final double lng;
  final int distanceFromUserMeters;

  const NearestStop({
    required this.stopIndex,
    required this.label,
    required this.lat,
    required this.lng,
    required this.distanceFromUserMeters,
  });

  factory NearestStop.fromJson(Map<String, dynamic> j) => NearestStop(
        stopIndex: (j['stopIndex'] as num?)?.toInt() ?? 0,
        label: j['label'] as String? ?? 'Paradero',
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
        distanceFromUserMeters: (j['distanceFromUserMeters'] as num?)?.toInt() ?? 0,
      );
}

/// Ruta activa: agregación devuelta por GET /api/public/rutas-activas.
class ActiveRouteData {
  final String routeId;
  final String name;
  final String? code;
  final String? direction;
  final String? vehicleTypeKey;
  /// Municipio que administra esta ruta (ej. "Cusco", "San Jerónimo").
  final String? municipalityName;
  final int activeBusCount;
  final List<BusWaypoint> waypoints;
  final List<List<double>> polylineCoords;
  final List<ActiveBusLite> buses;
  final ActiveBusLite? closestBus;
  final NearestStop? nearestStop;
  final int? etaToUserStopSeconds;
  /// `true` si la ruta es oficial (modelo `Route` validado por la
  /// municipalidad); `false` si proviene de una `RouteCapture` candidata
  /// generada automáticamente cuando un conductor cierra turno sin asociar
  /// ruta. Default `true` para retro-compatibilidad con backends viejos
  /// que no envían el campo.
  final bool validated;
  /// Trazo simplificado de una candidata (`validated == false`). El backend
  /// envía hasta ~60 puntos en lugar de un waypoint set completo. Cada
  /// elemento es `[lat, lng]`. Vacío para rutas oficiales (usar
  /// `polylineCoords` / `waypoints`).
  final List<List<double>> samplePolyline;

  const ActiveRouteData({
    required this.routeId,
    required this.name,
    this.code,
    this.direction,
    this.vehicleTypeKey,
    this.municipalityName,
    required this.activeBusCount,
    this.waypoints = const [],
    this.polylineCoords = const [],
    this.buses = const [],
    this.closestBus,
    this.nearestStop,
    this.etaToUserStopSeconds,
    this.validated = true,
    this.samplePolyline = const [],
  });

  factory ActiveRouteData.fromJson(Map<String, dynamic> j) {
    final wpList = (j['waypoints'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final busesList = (j['buses'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final polyRaw = j['polylineCoords'] as List?;
    final polyCoords = polyRaw
            ?.map<List<double>>((p) {
              final list = (p as List).cast<num>();
              return [list[0].toDouble(), list[1].toDouble()];
            })
            .toList() ??
        const <List<double>>[];
    final sampleRaw = j['samplePolyline'] as List?;
    final samplePoly = sampleRaw
            ?.map<List<double>>((p) {
              final list = (p as List).cast<num>();
              return [list[0].toDouble(), list[1].toDouble()];
            })
            .toList() ??
        const <List<double>>[];
    final closest = j['closestBus'] as Map<String, dynamic>?;
    final near = j['nearestStop'] as Map<String, dynamic>?;
    return ActiveRouteData(
      routeId: j['routeId'] as String? ?? '',
      name: j['name'] as String? ?? '—',
      code: j['code'] as String?,
      direction: j['direction'] as String?,
      vehicleTypeKey: j['vehicleTypeKey'] as String?,
      municipalityName: j['municipalityName'] as String?,
      activeBusCount: (j['activeBusCount'] as num?)?.toInt() ?? 0,
      waypoints: wpList.map(BusWaypoint.fromJson).toList(),
      polylineCoords: polyCoords,
      buses: busesList.map(ActiveBusLite.fromJson).toList(),
      closestBus: closest != null ? ActiveBusLite.fromJson(closest) : null,
      nearestStop: near != null ? NearestStop.fromJson(near) : null,
      etaToUserStopSeconds: (j['etaToUserStopSeconds'] as num?)?.toInt(),
      validated: j['validated'] as bool? ?? true,
      samplePolyline: samplePoly,
    );
  }
}
