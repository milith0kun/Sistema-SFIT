class FleetVehicle {
  final String id;
  final String plate;
  final String brand;
  final String model;
  final String vehicleTypeKey;

  const FleetVehicle({
    required this.id,
    required this.plate,
    required this.brand,
    required this.model,
    required this.vehicleTypeKey,
  });

  factory FleetVehicle.fromJson(Map<String, dynamic> j) => FleetVehicle(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        plate: j['plate'] as String,
        brand: j['brand'] as String,
        model: j['model'] as String,
        vehicleTypeKey: j['vehicleTypeKey'] as String,
      );
}

class FleetDriver {
  final String id;
  final String name;
  final String status; // apto | riesgo | no_apto
  final double? continuousHours;
  final double? restHours;

  const FleetDriver({
    required this.id,
    required this.name,
    required this.status,
    this.continuousHours,
    this.restHours,
  });

  factory FleetDriver.fromJson(Map<String, dynamic> j) => FleetDriver(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        name: j['name'] as String,
        status: j['status'] as String? ?? 'apto',
        continuousHours: (j['continuousHours'] as num?)?.toDouble(),
        restHours: (j['restHours'] as num?)?.toDouble(),
      );
}

class FleetEntryModel {
  final String id;
  final FleetVehicle vehicle;
  final FleetDriver driver;
  final Map<String, dynamic>? route;
  final String? departureTime;
  final String? returnTime;
  final double km;
  final String status;
  final String? observations;
  final bool checklistComplete;
  final DateTime date;

  const FleetEntryModel({
    required this.id,
    required this.vehicle,
    required this.driver,
    required this.km,
    required this.status,
    required this.date,
    this.route,
    this.departureTime,
    this.returnTime,
    this.observations,
    this.checklistComplete = false,
  });

  factory FleetEntryModel.fromJson(Map<String, dynamic> j) => FleetEntryModel(
        id: j['id'] as String,
        vehicle: FleetVehicle.fromJson(j['vehicle'] as Map<String, dynamic>),
        driver: FleetDriver.fromJson(j['driver'] as Map<String, dynamic>),
        route: j['route'] as Map<String, dynamic>?,
        departureTime: j['departureTime'] as String?,
        returnTime: j['returnTime'] as String?,
        km: (j['km'] as num?)?.toDouble() ?? 0,
        status: j['status'] as String,
        observations: j['observations'] as String?,
        checklistComplete: j['checklistComplete'] as bool? ?? false,
        date: DateTime.parse(j['date'] as String),
      );

  bool get isActive => status == 'en_ruta';
  bool get isClosed => status == 'cerrado' || status == 'auto_cierre';
}
