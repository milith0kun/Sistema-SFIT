import 'package:flutter/foundation.dart';

/// Constantes de la API
class ApiConstants {
  ApiConstants._();

  /// URL base del backend desplegado en producción.
  static const String baseUrl = 'https://sfit.ecosdelseo.com/api';

  // Timeouts (ms)
  static const int connectTimeout = 15000;
  static const int receiveTimeout = 15000;

  // Auth endpoints
  static const String login        = '/auth/login';
  static const String register     = '/auth/register';
  static const String refreshToken = '/auth/refresh';
  static const String googleAuth   = '/auth/google';

  // Storage keys
  static const String accessTokenKey  = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
}
