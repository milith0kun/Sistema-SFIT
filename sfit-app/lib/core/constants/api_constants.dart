import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

/// Constantes de la API
class ApiConstants {
  ApiConstants._();

  // ── Base URLs por entorno ──────────────────────────────────────
  static const String _prodBaseUrl = 'https://sfit.ecosdelseo.com/api';
  static const String _androidEmulatorBaseUrl = 'http://10.0.2.2:3000/api';
  static const String _iosSimulatorBaseUrl = 'http://localhost:3000/api';

  /// URL base seleccionada según plataforma y modo.
  /// - Release: siempre producción.
  /// - Debug: emulador Android → 10.0.2.2; simulador iOS → localhost.
  ///   En otros casos (Web, desktop) → producción.
  static String get baseUrl {
    if (kReleaseMode) return _prodBaseUrl;
    if (kIsWeb) return _prodBaseUrl;
    try {
      if (Platform.isAndroid) return _androidEmulatorBaseUrl;
      if (Platform.isIOS) return _iosSimulatorBaseUrl;
    } catch (_) {
      // Platform no disponible (web) → cae en producción
    }
    return _prodBaseUrl;
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

  // Storage keys
  static const String accessTokenKey  = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userJsonKey     = 'sfit_user';
}
