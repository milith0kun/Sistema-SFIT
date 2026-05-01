/// Constantes generales de la aplicación
class AppConstants {
  AppConstants._();

  static const String appName = 'SFIT';
  static const String appFullName = 'Sistema de Fiscalización Inteligente de Transporte';
  static const String appVersion = '1.3.0';

  // Actualización — versión mínima local (fallback si la API no responde)
  static const String minimumVersion = '1.2.0';
  static const String playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.sfit.sfit_app';

  // QR
  static const String qrSecretKey = 'SFIT_QR_SECRET_KEY'; // Se obtiene de env
  
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
}
