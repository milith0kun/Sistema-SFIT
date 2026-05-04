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

class BusData {
  final String id;
  final String plate;
  final String vehicleType;
  final String vehicleStatus;
  final double lat;
  final double lng;
  final String? routeId;
  final String? routeName;
  final String? routeCode;
  final List<BusWaypoint> waypoints;
  /// Geometría real de la ruta siguiendo calles (cacheada en backend con
  /// Google Routes API). Si está disponible, la app dibuja la polyline con
  /// estos coords en lugar de los waypoints crudos. Cada elemento es
  /// `[lat, lng]`.
  final List<List<double>> polylineCoords;
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
    this.routeId,
    this.routeName,
    this.routeCode,
    this.waypoints = const [],
    this.polylineCoords = const [],
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
    return BusData(
      id: j['id'] as String? ?? '',
      plate: j['plate'] as String? ?? '—',
      vehicleType: j['vehicleType'] as String? ?? 'omnibus',
      vehicleStatus: j['vehicleStatus'] as String? ?? 'apto',
      lat: (loc['lat'] as num?)?.toDouble() ?? 0,
      lng: (loc['lng'] as num?)?.toDouble() ?? 0,
      routeId: route?['id'] as String?,
      routeName: route?['name'] as String?,
      routeCode: route?['code'] as String?,
      waypoints: wpList.map(BusWaypoint.fromJson).toList(),
      polylineCoords: polyCoords,
      etaByStop: etaList.map(BusEtaStop.fromJson).toList(),
      nextStopLabel: ns?['label'] as String?,
      nextStopEta: (ns?['etaSeconds'] as num?)?.toInt(),
      locationUpdatedAt: loc['updatedAt']?.toString(),
      distanceFromUserMeters: (j['distanceFromUserMeters'] as num?)?.toInt(),
      isOffRoute: j['isOffRoute'] as bool? ?? false,
    );
  }
}
