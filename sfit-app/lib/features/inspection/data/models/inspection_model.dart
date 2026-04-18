class ChecklistItem {
  final String item;
  final bool passed;
  final String? notes;

  const ChecklistItem({required this.item, required this.passed, this.notes});

  Map<String, dynamic> toJson() => {
        'item': item,
        'passed': passed,
        if (notes != null) 'notes': notes,
      };
}

class InspectionVehicle {
  final String id;
  final String plate;
  final String vehicleTypeKey;
  final String brand;
  final String model;

  const InspectionVehicle({
    required this.id,
    required this.plate,
    required this.vehicleTypeKey,
    required this.brand,
    required this.model,
  });

  factory InspectionVehicle.fromJson(Map<String, dynamic> j) =>
      InspectionVehicle(
        id: j['_id'] as String? ?? j['id'] as String,
        plate: j['plate'] as String,
        vehicleTypeKey: j['vehicleTypeKey'] as String,
        brand: j['brand'] as String,
        model: j['model'] as String,
      );
}

class InspectionModel {
  final String id;
  final InspectionVehicle? vehicle;
  final String vehicleTypeKey;
  final String result; // aprobada | observada | rechazada
  final int score;
  final String? observations;
  final DateTime date;
  final Map<String, dynamic>? fiscal;

  const InspectionModel({
    required this.id,
    required this.vehicle,
    required this.vehicleTypeKey,
    required this.result,
    required this.score,
    required this.date,
    this.observations,
    this.fiscal,
  });

  factory InspectionModel.fromJson(Map<String, dynamic> j) => InspectionModel(
        id: j['id'] as String,
        vehicle: j['vehicle'] != null
            ? InspectionVehicle.fromJson(j['vehicle'] as Map<String, dynamic>)
            : null,
        vehicleTypeKey: j['vehicleTypeKey'] as String,
        result: j['result'] as String,
        score: (j['score'] as num).toInt(),
        observations: j['observations'] as String?,
        date: DateTime.parse(j['date'] as String),
        fiscal: j['fiscal'] as Map<String, dynamic>?,
      );
}

/// Checklist predefinido por tipo de vehículo.
/// El admin puede personalizarlos desde la web; estos son los ítems por defecto.
const Map<String, List<String>> kDefaultChecklist = {
  'transporte_publico': [
    'Luces delanteras y traseras funcionando',
    'Frenos en buen estado',
    'Documentos del vehículo vigentes',
    'Licencia del conductor vigente',
    'SOAT vigente',
    'Cinturones de seguridad operativos',
    'Neumáticos en buen estado',
    'Extintor dentro del vehículo',
    'Botón de emergencia operativo',
    'Limpieza e higiene del vehículo',
  ],
  'limpieza_residuos': [
    'Sistema de compactación operativo',
    'Contenedores sin derrames',
    'Luces de emergencia funcionando',
    'Documentos vigentes',
    'SOAT vigente',
    'Frenos en buen estado',
    'Neumáticos en buen estado',
    'Equipo de protección del operario a bordo',
  ],
  'emergencia': [
    'Sirena y luces de emergencia operativas',
    'Equipamiento médico / bomberil completo',
    'Combustible al 100%',
    'Documentos vigentes',
    'Frenos en buen estado',
    'Comunicaciones (radio) operativas',
    'Neumáticos en buen estado',
  ],
  'maquinaria': [
    'Luces de seguridad y balizas operativas',
    'Hidráulica sin fugas',
    'Frenos en buen estado',
    'Nivel de aceite correcto',
    'Documentos vigentes',
    'Operario con licencia de maquinaria',
    'Extintor a bordo',
  ],
  'municipal_general': [
    'Luces delanteras y traseras funcionando',
    'Frenos en buen estado',
    'Documentos del vehículo vigentes',
    'Licencia del conductor vigente',
    'SOAT vigente',
    'Cinturones de seguridad operativos',
    'Neumáticos en buen estado',
  ],
};

List<String> checklistForType(String typeKey) =>
    kDefaultChecklist[typeKey] ?? kDefaultChecklist['municipal_general']!;
