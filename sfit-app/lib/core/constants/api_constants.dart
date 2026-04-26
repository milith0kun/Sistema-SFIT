import 'package:flutter/foundation.dart';

/// Constantes de la API
class ApiConstants {
  ApiConstants._();

  // ── Base URLs ──────────────────────────────────────────────────
  static const String _prodBaseUrl = 'https://sfit.ecosdelseo.com/api';

  /// Para desarrollo local, sobrescribir con:
  ///   --dart-define=SFIT_DEV_HOST=10.0.2.2        (emulador Android)
  ///   --dart-define=SFIT_DEV_HOST=localhost        (físico + adb reverse)
  ///   --dart-define=SFIT_DEV_HOST=192.168.1.x     (físico en LAN)
  static const String _devHost = String.fromEnvironment('SFIT_DEV_HOST');

  /// URL base activa:
  /// - Sin SFIT_DEV_HOST → producción (Dokploy), funciona en emulador y físico.
  /// - Con SFIT_DEV_HOST → backend local en http://HOST:3000/api.
  static String get baseUrl {
    if (kReleaseMode || _devHost.isEmpty) return _prodBaseUrl;
    return 'http://$_devHost:3000/api';
  }

  // Timeouts (ms)
  static const int connectTimeout = 15000;
  static const int receiveTimeout = 15000;

  // Auth endpoints
  static const String login        = '/auth/login';
  static const String register     = '/auth/register';
  static const String refreshToken = '/auth/refresh';
  static const String googleAuth   = '/auth/google';
  static const String logout       = '/auth/logout';

  // Notifications (RF-18)
  static const String fcmToken = '/notificaciones/token';

  // Storage keys
  static const String accessTokenKey  = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userJsonKey     = 'sfit_user';

  /// Header y token compartido con la WAF de Cloudflare.
  /// La regla "Skip Bot Fight Mode" en Cloudflare exige que la request a /api/*
  /// traiga este header con este valor; cualquier otra fuente recibe challenge.
  static const String clientHeader = 'X-Sfit-Client';
  static const String clientToken  = 'sfit-mob-7f3a9b2c4d6e8f1a3b5c7d9e0f2a4b6c';
}
