/// RF-18 — Firebase Cloud Messaging service.
///
/// Responsabilidad acotada: obtener y registrar el token FCM en el backend.
///
/// El handler de background, los permisos y los listeners de foreground/tap
/// son gestionados por [NotificationService] (inicializado en main.dart).
/// Esto evita duplicar listeners y mantiene cada clase con una sola responsabilidad.
library;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../constants/api_constants.dart';
import '../network/dio_client.dart';

part 'fcm_service.g.dart';

class FcmService {
  const FcmService();

  /// Obtiene el token FCM y lo registra en el backend.
  /// Llamar después de que el usuario se autentique exitosamente.
  ///
  /// Permisos y listeners ya configurados por [NotificationService.initialize]
  /// en main.dart; aquí solo nos ocupamos del token.
  static Future<void> initialize(Ref ref) async {
    try {
      final instance = FirebaseMessaging.instance;

      // 1. Obtener token FCM del dispositivo
      final token = await instance.getToken();
      if (token == null) {
        debugPrint('[FCM] No se pudo obtener el token FCM (Firebase no configurado?)');
        return;
      }

      debugPrint('[FCM] Token obtenido: ${token.substring(0, 20)}...');

      // 2. Registrar token en el backend
      await _registerTokenOnBackend(ref, token);

      // 3. Escuchar actualizaciones del token (se renueva automáticamente)
      instance.onTokenRefresh.listen((newToken) async {
        debugPrint('[FCM] Token renovado');
        await _registerTokenOnBackend(ref, newToken);
      });

      debugPrint('[FCM] Token registrado correctamente');
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
