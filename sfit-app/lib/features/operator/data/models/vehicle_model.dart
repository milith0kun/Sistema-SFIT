class VehicleModel {
  final String id;
  final String plate;
  final String brand;
  final String model;
  final int year;
  final String vehicleTypeKey;
  final String status; // disponible | en_ruta | mantenimiento | fuera_servicio
  final String? soatExpiry;

  const VehicleModel({
    required this.id,
    required this.plate,
    required this.brand,
    required this.model,
    required this.year,
    required this.vehicleTypeKey,
    required this.status,
    this.soatExpiry,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> j) => VehicleModel(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        plate: j['plate'] as String? ?? '',
        brand: j['brand'] as String? ?? '',
        model: j['model'] as String? ?? '',
        year: (j['year'] as num?)?.toInt() ?? 0,
        vehicleTypeKey: j['vehicleTypeKey'] as String? ?? '',
        status: j['status'] as String? ?? 'disponible',
        soatExpiry: j['soatExpiry'] as String?,
      );
}
