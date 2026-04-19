/// RF-18 — Firebase Cloud Messaging service.
///
/// Solicita permisos, obtiene el token FCM y lo registra en el backend.
/// Todo el código está envuelto en try/catch — si Firebase no está configurado
/// (falta google-services.json) la app continúa sin errores.
library;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../constants/api_constants.dart';
import '../network/dio_client.dart';

part 'fcm_service.g.dart';

/// Handler de mensajes en background — debe ser una función de nivel superior.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // El mensaje llega en background o cuando la app está cerrada.
  // No se puede usar providers ni contexto aquí.
  debugPrint('[FCM-BG] Mensaje recibido: ${message.messageId}');
}

class FcmService {
  const FcmService();

  /// Inicializa FCM: permisos → token → registro en backend → handlers.
  /// Llamar después de que el usuario se autentique exitosamente.
  static Future<void> initialize(Ref ref) async {
    try {
      final instance = FirebaseMessaging.instance;

      // 1. Solicitar permisos (iOS requiere diálogo; Android 13+ también)
      final settings = await instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[FCM] Permisos de notificación denegados por el usuario');
        return;
      }

      // 2. Obtener token FCM del dispositivo
      final token = await instance.getToken();
      if (token == null) {
        debugPrint('[FCM] No se pudo obtener el token FCM (Firebase no configurado?)');
        return;
      }

      debugPrint('[FCM] Token obtenido: ${token.substring(0, 20)}...');

      // 3. Registrar token en el backend
      await _registerTokenOnBackend(ref, token);

      // 4. Escuchar actualizaciones del token (se renueva automáticamente)
      instance.onTokenRefresh.listen((newToken) async {
        debugPrint('[FCM] Token renovado');
        await _registerTokenOnBackend(ref, newToken);
      });

      // 5. Configurar handler de background (debe registrarse antes de runApp,
      //    pero lo hacemos aquí también para cubrir el caso de inicialización tardía)
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // 6. Handler foreground — app en primer plano
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('[FCM] Mensaje en foreground: ${message.notification?.title}');
        // TODO: mostrar notificación local con flutter_local_notifications
        // cuando se implemente la UI de notificaciones en-app
      });

      // 7. Handler cuando el usuario toca la notificación (app en background → abre)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('[FCM] App abierta desde notificación: ${message.data}');
        // TODO: navegar a la pantalla correspondiente según message.data['type']
      });

      debugPrint('[FCM] Inicialización completada correctamente');
    } catch (e) {
      // Si Firebase no está configurado (sin google-services.json), continuar sin error
      debugPrint('[FCM] Error en inicialización (no fatal): $e');
    }
  }

  /// Elimina el token FCM del backend (llamar en logout).
  static Future<void> unregisterToken(Ref ref) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;

      final dio = ref.read(dioClientProvider).dio;
      await dio.delete(
        ApiConstants.fcmToken,
        data: {'token': token},
      );

      debugPrint('[FCM] Token eliminado del backend');
    } catch (e) {
      debugPrint('[FCM] Error al eliminar token (no fatal): $e');
    }
  }

  /// Registra el token FCM en el backend via POST /notificaciones/token.
  static Future<void> _registerTokenOnBackend(Ref ref, String token) async {
    try {
      final dio = ref.read(dioClientProvider).dio;
      final platform = defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

      final response = await dio.post(
        ApiConstants.fcmToken,
        data: {'token': token, 'platform': platform},
      );

      if (response.data is Map && response.data['success'] == true) {
        debugPrint('[FCM] Token registrado en backend correctamente');
      } else {
        debugPrint('[FCM] Backend rechazó el token: ${response.data}');
      }
    } catch (e) {
      debugPrint('[FCM] Error registrando token en backend (no fatal): $e');
    }
  }
}

@Riverpod(keepAlive: true)
FcmService fcmService(Ref ref) => const FcmService();
