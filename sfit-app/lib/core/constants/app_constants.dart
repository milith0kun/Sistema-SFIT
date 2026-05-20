/// Constantes generales de la aplicación
class AppConstants {
  AppConstants._();

  static const String appName = 'SFIT';
  static const String appFullName =
      'Sistema de Fiscalización Inteligente de Transporte';
  static const String appVersion = '1.4.0';

  // Actualización — versión mínima local (fallback si la API no responde)
  static const String minimumVersion = '1.2.0';
  static const String playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.sfit.sfit_app';

  // QR
  static const String qrSecretKey = String.fromEnvironment(
    'SFIT_QR_SECRET',
    defaultValue: 'SFIT_QR_SECRET_KEY',
  );

  // URLs
  static const String webLoginUrl = 'https://sfit.ecosdelseo.com/login';

  // Estados del conductor
  static const String estadoApto = 'APTO';
  static const String estadoRiesgo = 'RIESGO';
  static const String estadoNoApto = 'NO_APTO';

  // Estados del vehículo
  static const String vehiculoDisponible = 'DISPONIBLE';
  static const String vehiculoEnRuta = 'EN_RUTA';
  static const String vehiculoMantenimiento = 'EN_MANTENIMIENTO';
  static const String vehiculoFueraServicio = 'FUERA_DE_SERVICIO';

  // Estados de usuario
  static const String usuarioPendiente = 'PENDIENTE';
  static const String usuarioActivo = 'ACTIVO';
  static const String usuarioRechazado = 'RECHAZADO';
  static const String usuarioSuspendido = 'SUSPENDIDO';

  // Mapa: centro de fallback cuando no hay GPS válido para encuadrar.
  // Cusco — la mayoría de operación inicial es ahí. Construir LatLng en
  // el call-site para no acoplar este archivo a latlong2.
  static const double fallbackMapLat = -13.5320;
  static const double fallbackMapLng = -71.9675;
}
