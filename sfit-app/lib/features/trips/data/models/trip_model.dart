class TripVehicle {
  final String id;
  final String plate;
  final String brand;
  final String model;
  final String vehicleTypeKey;

  const TripVehicle({
    required this.id,
    required this.plate,
    required this.brand,
    required this.model,
    required this.vehicleTypeKey,
  });

  factory TripVehicle.fromJson(Map<String, dynamic> j) => TripVehicle(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        plate: j['plate'] as String? ?? '',
        brand: j['brand'] as String? ?? '',
        model: j['model'] as String? ?? '',
        vehicleTypeKey: j['vehicleTypeKey'] as String? ?? '',
      );
}

class TripRoute {
  final String id;
  final String name;

  const TripRoute({required this.id, required this.name});

  factory TripRoute.fromJson(Map<String, dynamic> j) => TripRoute(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
      );
}

class TripModel {
  final String id;
  final TripVehicle? vehicle;
  final TripRoute? route;
  final String status; // pendiente | en_curso | completado | cancelado
  final DateTime? startedAt;
  final DateTime? endedAt;
  final double? kmRecorridos;
  final String? observations;
  final DateTime createdAt;

  const TripModel({
    required this.id,
    required this.status,
    required this.createdAt,
    this.vehicle,
    this.route,
    this.startedAt,
    this.endedAt,
    this.kmRecorridos,
    this.observations,
  });

  factory TripModel.fromJson(Map<String, dynamic> j) => TripModel(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        vehicle: j['vehicle'] != null
            ? TripVehicle.fromJson(j['vehicle'] as Map<String, dynamic>)
            : null,
        route: j['route'] != null
            ? TripRoute.fromJson(j['route'] as Map<String, dynamic>)
            : null,
        status: j['status'] as String? ?? 'pendiente',
        startedAt: j['startedAt'] != null
            ? DateTime.tryParse(j['startedAt'] as String)
            : null,
        endedAt: j['endedAt'] != null
            ? DateTime.tryParse(j['endedAt'] as String)
            : null,
        kmRecorridos: (j['kmRecorridos'] as num?)?.toDouble(),
        observations: j['observations'] as String?,
        createdAt: DateTime.parse(
          j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
        ),
      );
}
