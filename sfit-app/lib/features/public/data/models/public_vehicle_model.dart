/// Datos del vehículo y conductor para la vista pública (RF-08).
class PublicVehicleModel {
  final bool? qrSignatureValid;
  final PublicVehicle vehicle;
  final PublicDriver? driver;

  const PublicVehicleModel({
    required this.qrSignatureValid,
    required this.vehicle,
    required this.driver,
  });

  factory PublicVehicleModel.fromJson(Map<String, dynamic> json) =>
      PublicVehicleModel(
        qrSignatureValid: json['qrSignatureValid'] as bool?,
        vehicle: PublicVehicle.fromJson(json['vehicle'] as Map<String, dynamic>),
        driver: json['driver'] != null
            ? PublicDriver.fromJson(json['driver'] as Map<String, dynamic>)
            : null,
      );
}

class PublicVehicle {
  final String id;
  final String plate;
  final String vehicleTypeKey;
  final String brand;
  final String model;
  final int year;
  final String status;
  final String? company;
  final String lastInspectionStatus;
  final int reputationScore;
  final String reputationLabel; // Excelente / Bueno / Regular / Deficiente / Sin historial
  final String indicator; // verde | amarillo | rojo

  const PublicVehicle({
    required this.id,
    required this.plate,
    required this.vehicleTypeKey,
    required this.brand,
    required this.model,
    required this.year,
    required this.status,
    required this.company,
    required this.lastInspectionStatus,
    required this.reputationScore,
    required this.reputationLabel,
    required this.indicator,
  });

  factory PublicVehicle.fromJson(Map<String, dynamic> json) => PublicVehicle(
        id: json['id'] as String,
        plate: json['plate'] as String,
        vehicleTypeKey: json['vehicleTypeKey'] as String,
        brand: json['brand'] as String,
        model: json['model'] as String,
        year: (json['year'] as num).toInt(),
        status: json['status'] as String,
        company: json['company'] as String?,
        lastInspectionStatus: json['lastInspectionStatus'] as String,
        reputationScore: (json['reputationScore'] as num? ?? 0).toInt(),
        reputationLabel: json['reputationLabel'] as String? ?? 'Sin historial',
        indicator: json['indicator'] as String,
      );
}

class PublicDriver {
  final String id;
  final String name;
  final String licenseCategory;
  final String fatigueStatus;
  final int reputationScore;
  final String reputationLabel; // Excelente / Bueno / Regular / Deficiente / Sin historial
  final bool enabled;

  const PublicDriver({
    required this.id,
    required this.name,
    required this.licenseCategory,
    required this.fatigueStatus,
    required this.reputationScore,
    required this.reputationLabel,
    required this.enabled,
  });

  factory PublicDriver.fromJson(Map<String, dynamic> json) => PublicDriver(
        id: json['id'] as String,
        name: json['name'] as String,
        licenseCategory: json['licenseCategory'] as String,
        fatigueStatus: json['fatigueStatus'] as String,
        reputationScore: (json['reputationScore'] as num? ?? 0).toInt(),
        reputationLabel: json['reputationLabel'] as String? ?? 'Sin historial',
        enabled: json['enabled'] as bool,
      );
}
