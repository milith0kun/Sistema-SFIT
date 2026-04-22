/// RF-18: Handler de mensajes FCM en background / app terminada.
///
/// DEBE ser una función de nivel superior (top-level) — no puede ser un método
/// de clase ni un closure. FCM la invoca en un isolate separado cuando la app
/// no está en primer plano.
library;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Manejador de mensajes FCM recibidos con la app en background o cerrada.
///
/// Firebase inicializa automáticamente el core antes de invocar esta función,
/// por lo que NO es necesario llamar [Firebase.initializeApp] aquí.
///
/// Restricciones importantes:
/// - No se puede usar providers Riverpod (no hay contexto Flutter).
/// - No se puede mostrar UI directamente.
/// - Solo operaciones seguras: logging, almacenamiento local sin contexto.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint(
    '[FCM background] ${message.messageId}: '
    '${message.notification?.title ?? "(sin título)"}',
  );
}
