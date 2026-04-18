import 'package:flutter/foundation.dart';

/// Constantes de la API
class ApiConstants {
  ApiConstants._();

  /// URL base del backend (Next.js API).
  /// En debug apunta a la red local; en release, al servidor de producción.
  static final String baseUrl = kDebugMode
      ? 'http://10.0.2.2:3000/api'        // emulador Android → host
      : 'https://sfit.ecosdelseo.com/api'; // producción

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
