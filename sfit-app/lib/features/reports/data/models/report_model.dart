class ReportVehicle {
  final String id;
  final String plate;
  final String? vehicleTypeKey;

  const ReportVehicle({
    required this.id,
    required this.plate,
    this.vehicleTypeKey,
  });

  factory ReportVehicle.fromJson(Map<String, dynamic> j) => ReportVehicle(
        id: j['_id'] as String? ?? j['id'] as String,
        plate: j['plate'] as String,
        vehicleTypeKey: j['vehicleTypeKey'] as String?,
      );
}

class ReportModel {
  final String id;
  final ReportVehicle? vehicle;
  final String category;
  final String description;
  final String status; // pendiente | en_revision | validado | rechazado
  final String? vehicleTypeKey;
  final DateTime createdAt;
  final Map<String, dynamic>? citizen;

  const ReportModel({
    required this.id,
    required this.vehicle,
    required this.category,
    required this.description,
    required this.status,
    required this.createdAt,
    this.vehicleTypeKey,
    this.citizen,
  });

  factory ReportModel.fromJson(Map<String, dynamic> j) => ReportModel(
        id: j['_id'] as String? ?? j['id'] as String,
        vehicle: j['vehicle'] != null
            ? ReportVehicle.fromJson(j['vehicle'] as Map<String, dynamic>)
            : null,
        category: j['category'] as String,
        description: j['description'] as String,
        status: j['status'] as String,
        vehicleTypeKey: j['vehicleTypeKey'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
        citizen: j['citizen'] as Map<String, dynamic>?,
      );
}

/// Categorías predefinidas de reporte ciudadano.
const kReportCategories = <String>[
  'Conducción peligrosa',
  'Cobro indebido',
  'Mal estado del vehículo',
  'Otro',
];
