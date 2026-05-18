/// Resumen agregado de la empresa del operador para el dashboard.
///
/// Mapea 1:1 a la respuesta de `GET /api/operador/dashboard`. Si el operador
/// no tiene empresa, `company` es `null` y los contadores quedan en cero.
class OperatorDashboardSummary {
  final OperatorCompanyBrief? company;
  final VehicleStatusCounts vehicles;
  final DriverStatusCounts drivers;
  final FleetTodayMetrics fleetToday;
  final DashboardAlerts alerts;

  const OperatorDashboardSummary({
    required this.company,
    required this.vehicles,
    required this.drivers,
    required this.fleetToday,
    required this.alerts,
  });

  factory OperatorDashboardSummary.fromJson(Map<String, dynamic> json) {
    return OperatorDashboardSummary(
      company: json['company'] == null
          ? null
          : OperatorCompanyBrief.fromJson(json['company'] as Map<String, dynamic>),
      vehicles: VehicleStatusCounts.fromJson(json['vehicles'] as Map<String, dynamic>),
      drivers:  DriverStatusCounts.fromJson(json['drivers']  as Map<String, dynamic>),
      fleetToday: FleetTodayMetrics.fromJson(json['fleetToday'] as Map<String, dynamic>),
      alerts: DashboardAlerts.fromJson(json['alerts'] as Map<String, dynamic>),
    );
  }
}

class OperatorCompanyBrief {
  final String id;
  final String razonSocial;
  final String ruc;
  final String serviceScope;
  final List<String> departmentCodes;
  final List<String> provinceCodes;
  final List<String> districtCodes;

  const OperatorCompanyBrief({
    required this.id,
    required this.razonSocial,
    required this.ruc,
    required this.serviceScope,
    required this.departmentCodes,
    required this.provinceCodes,
    required this.districtCodes,
  });

  factory OperatorCompanyBrief.fromJson(Map<String, dynamic> json) {
    return OperatorCompanyBrief(
      id: json['id'] as String,
      razonSocial: json['razonSocial'] as String? ?? '',
      ruc: json['ruc'] as String? ?? '',
      serviceScope: json['serviceScope'] as String? ?? 'urbano',
      departmentCodes: (json['departmentCodes'] as List? ?? const []).cast<String>(),
      provinceCodes:   (json['provinceCodes']   as List? ?? const []).cast<String>(),
      districtCodes:   (json['districtCodes']   as List? ?? const []).cast<String>(),
    );
  }
}

class VehicleStatusCounts {
  final int total;
  final int disponible;
  final int enRuta;
  final int enMantenimiento;
  final int fueraDeServicio;

  const VehicleStatusCounts({
    required this.total,
    required this.disponible,
    required this.enRuta,
    required this.enMantenimiento,
    required this.fueraDeServicio,
  });

  factory VehicleStatusCounts.fromJson(Map<String, dynamic> json) {
    return VehicleStatusCounts(
      total: (json['total'] as num? ?? 0).toInt(),
      disponible:        (json['disponible']        as num? ?? 0).toInt(),
      enRuta:            (json['en_ruta']           as num? ?? 0).toInt(),
      enMantenimiento:   (json['en_mantenimiento']  as num? ?? 0).toInt(),
      fueraDeServicio:   (json['fuera_de_servicio'] as num? ?? 0).toInt(),
    );
  }
}

class DriverStatusCounts {
  final int total;
  final int apto;
  final int riesgo;
  final int noApto;

  const DriverStatusCounts({
    required this.total,
    required this.apto,
    required this.riesgo,
    required this.noApto,
  });

  factory DriverStatusCounts.fromJson(Map<String, dynamic> json) {
    return DriverStatusCounts(
      total:  (json['total']   as num? ?? 0).toInt(),
      apto:   (json['apto']    as num? ?? 0).toInt(),
      riesgo: (json['riesgo']  as num? ?? 0).toInt(),
      noApto: (json['no_apto'] as num? ?? 0).toInt(),
    );
  }
}

class FleetTodayMetrics {
  final int totalEntries;
  final int enRuta;
  final int cerradas;
  final int kmTotalToday;

  const FleetTodayMetrics({
    required this.totalEntries,
    required this.enRuta,
    required this.cerradas,
    required this.kmTotalToday,
  });

  factory FleetTodayMetrics.fromJson(Map<String, dynamic> json) {
    return FleetTodayMetrics(
      totalEntries: (json['totalEntries'] as num? ?? 0).toInt(),
      enRuta:       (json['enRuta']       as num? ?? 0).toInt(),
      cerradas:     (json['cerradas']     as num? ?? 0).toInt(),
      kmTotalToday: (json['kmTotalToday'] as num? ?? 0).toInt(),
    );
  }
}

class DashboardAlerts {
  final int soatProxVencer;
  final int conductoresEnRiesgo;
  final int vehiculosOffRoute;

  const DashboardAlerts({
    required this.soatProxVencer,
    required this.conductoresEnRiesgo,
    required this.vehiculosOffRoute,
  });

  int get total => soatProxVencer + conductoresEnRiesgo + vehiculosOffRoute;

  factory DashboardAlerts.fromJson(Map<String, dynamic> json) {
    return DashboardAlerts(
      soatProxVencer:      (json['soatProxVencer']      as num? ?? 0).toInt(),
      conductoresEnRiesgo: (json['conductoresEnRiesgo'] as num? ?? 0).toInt(),
      vehiculosOffRoute:   (json['vehiculosOffRoute']   as num? ?? 0).toInt(),
    );
  }
}
