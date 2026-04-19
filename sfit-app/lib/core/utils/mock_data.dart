import '../../features/fleet/data/models/fleet_entry_model.dart';
import '../../features/inspection/data/models/inspection_model.dart';

/// Datos de muestra para el modo demo (kDemoMode == true).
/// Ningún servicio real es modificado — estas listas se usan únicamente
/// en los widgets / providers que comprueban explícitamente kDemoMode.

// ── Inspecciones mock ─────────────────────────────────────────────

final List<InspectionModel> kMockInspections = [
  InspectionModel(
    id: 'mock-insp-001',
    vehicle: InspectionVehicle(
      id: 'mock-veh-001',
      plate: 'ABC-123',
      vehicleTypeKey: 'transporte_publico',
      brand: 'Toyota',
      model: 'Coaster',
    ),
    vehicleTypeKey: 'transporte_publico',
    result: 'aprobada',
    score: 92,
    observations: 'Vehículo en excelente estado. Sin observaciones.',
    date: DateTime.now().subtract(const Duration(hours: 2)),
  ),
  InspectionModel(
    id: 'mock-insp-002',
    vehicle: InspectionVehicle(
      id: 'mock-veh-002',
      plate: 'DEF-456',
      vehicleTypeKey: 'limpieza_residuos',
      brand: 'Mercedes-Benz',
      model: 'Atego',
    ),
    vehicleTypeKey: 'limpieza_residuos',
    result: 'observada',
    score: 71,
    observations: 'Luces traseras con falla intermitente. Revisión en 48h.',
    date: DateTime.now().subtract(const Duration(hours: 5)),
  ),
  InspectionModel(
    id: 'mock-insp-003',
    vehicle: InspectionVehicle(
      id: 'mock-veh-003',
      plate: 'GHI-789',
      vehicleTypeKey: 'emergencia',
      brand: 'Ford',
      model: 'Transit',
    ),
    vehicleTypeKey: 'emergencia',
    result: 'rechazada',
    score: 48,
    observations: 'SOAT vencido. Frenos traseros desgastados. Fuera de servicio.',
    date: DateTime.now().subtract(const Duration(days: 1)),
  ),
];

// ── Entradas de flota mock ────────────────────────────────────────

final List<FleetEntryModel> kMockFleetEntries = [
  FleetEntryModel(
    id: 'mock-fleet-001',
    vehicle: FleetVehicle(
      id: 'mock-veh-001',
      plate: 'ABC-123',
      brand: 'Toyota',
      model: 'Coaster',
      vehicleTypeKey: 'transporte_publico',
    ),
    driver: FleetDriver(
      id: 'mock-drv-001',
      name: 'Carlos Mamani Quispe',
      status: 'apto',
      continuousHours: 3.5,
      restHours: 8.0,
    ),
    route: {
      '_id': 'mock-route-001',
      'name': 'Ruta Centro–San Sebastián',
      'distance': 12.4,
    },
    departureTime: DateTime.now()
        .subtract(const Duration(hours: 3, minutes: 30))
        .toIso8601String(),
    km: 12.4,
    status: 'en_ruta',
    observations: null,
    checklistComplete: true,
    date: DateTime.now(),
  ),
  FleetEntryModel(
    id: 'mock-fleet-002',
    vehicle: FleetVehicle(
      id: 'mock-veh-004',
      plate: 'JKL-321',
      brand: 'Volkswagen',
      model: 'Constellation',
      vehicleTypeKey: 'limpieza_residuos',
    ),
    driver: FleetDriver(
      id: 'mock-drv-002',
      name: 'María Huanca Torres',
      status: 'apto',
      continuousHours: 2.0,
      restHours: 10.0,
    ),
    route: {
      '_id': 'mock-route-002',
      'name': 'Recorrido Norte',
      'distance': 8.7,
    },
    departureTime: DateTime.now()
        .subtract(const Duration(hours: 1, minutes: 45))
        .toIso8601String(),
    returnTime: DateTime.now().subtract(const Duration(minutes: 10)).toIso8601String(),
    km: 8.7,
    status: 'cerrado',
    observations: 'Recorrido completado sin novedades.',
    checklistComplete: true,
    date: DateTime.now(),
  ),
];

// ── Usuario mock (fiscal) ─────────────────────────────────────────

/// Mapa con los campos básicos de usuario que auth_provider.user expone.
/// Se puede usar para pre-rellenar formularios o headers en modo demo.
const Map<String, dynamic> kMockUser = {
  'id': 'mock-user-fiscal-001',
  'name': 'Inspector Demo',
  'email': 'inspector.demo@sfit.gob.pe',
  'role': 'fiscal',
  'municipalityId': 'mock-muni-001',
  'status': 'activo',
  'avatarUrl': null,
};

/// Usuario operador para demos de gestión de flota.
const Map<String, dynamic> kMockUserOperador = {
  'id': 'mock-user-op-001',
  'name': 'Operador Demo',
  'email': 'operador.demo@sfit.gob.pe',
  'role': 'operador',
  'municipalityId': 'mock-muni-001',
  'status': 'activo',
  'avatarUrl': null,
};

/// Usuario conductor para demos de viajes y fatiga.
const Map<String, dynamic> kMockUserConductor = {
  'id': 'mock-user-drv-001',
  'name': 'Carlos Mamani Quispe',
  'email': 'conductor.demo@sfit.gob.pe',
  'role': 'conductor',
  'municipalityId': 'mock-muni-001',
  'status': 'activo',
  'avatarUrl': null,
};
