import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

/// Constantes de la API
class ApiConstants {
  ApiConstants._();

  // ── Base URLs por entorno ──────────────────────────────────────
  static const String _prodBaseUrl = 'https://sfit.ecosdelseo.com/api';

  /// Host del dev backend para debug local.
  /// - Emulador Android: `10.0.2.2` apunta al localhost del host.
  /// - Dispositivo físico con `adb reverse tcp:3000 tcp:3000`: `localhost`
  ///   también funciona (recomendado, más estable que LAN).
  /// - Dispositivo físico en LAN (sin adb reverse): cambia a la IP del PC
  ///   en la misma red (ej. `192.168.1.126`).
  /// - Simulador iOS: `localhost`.
  ///
  /// Puedes sobrescribir en runtime con `--dart-define=SFIT_DEV_HOST=192.168.1.x`.
  static const String _devHost = String.fromEnvironment(
    'SFIT_DEV_HOST',
    defaultValue: 'localhost',
  );

  static String get _devBaseUrl => 'http://$_devHost:3000/api';

  /// URL base por plataforma/modo. En release siempre producción.
  static String get baseUrl {
    if (kReleaseMode) return _prodBaseUrl;
    if (kIsWeb) return _prodBaseUrl;
    try {
      if (Platform.isAndroid || Platform.isIOS) return _devBaseUrl;
    } catch (_) {
      // Platform no disponible → cae en producción
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
