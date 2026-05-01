import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app.dart';
import 'core/services/fcm_background_handler.dart';
import 'core/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializa los símbolos de fecha en español para que `DateFormat`
  // pueda formatear fechas con locale 'es' (ej. "1 de mayo, 14:23").
  await initializeDateFormatting('es', null);

  try {
    await Firebase.initializeApp();

    // RF-18: Registrar el handler de background ANTES de runApp.
    // Debe ser una función top-level — ver fcm_background_handler.dart.
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // RF-18: Inicializar canal Android + listeners FCM (foreground, tap).
    await NotificationService.initialize();
  } catch (_) {
    // Si falta google-services.json en el build, no bloquear el arranque.
    // Los handlers de FCM simplemente no se registran.
  }

  runApp(
    const ProviderScope(
      child: SfitApp(),
    ),
  );
}
