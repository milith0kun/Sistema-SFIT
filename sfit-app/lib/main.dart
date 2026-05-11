import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app.dart';
import 'core/services/fcm_background_handler.dart';
import 'core/services/notification_service.dart';
import 'core/services/tracking_watchdog.dart';

/// Reemplaza el `ErrorWidget.builder` default (banner rojo grande de
/// FlutterErrorWidget) por una vista compacta que no asusta al usuario en
/// release. En debug seguimos mostrando el detalle para depurar.
Widget _buildErrorWidget(FlutterErrorDetails details) {
  if (kDebugMode) return ErrorWidget(details.exception);
  return Container(
    color: const Color(0xFFFFFAFA),
    alignment: Alignment.center,
    padding: const EdgeInsets.all(20),
    child: const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.error_outline_rounded, size: 36, color: Color(0xFFB45309)),
        SizedBox(height: 10),
        Text(
          'Algo no salió bien al cargar esta sección.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFF18181B),
          ),
        ),
        SizedBox(height: 6),
        Text(
          'Inténtalo nuevamente o vuelve más tarde.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Color(0xFF71717A)),
        ),
      ],
    ),
  );
}

void main() {
  // Envolvente runZonedGuarded para capturar errores asíncronos que escapen
  // de zonas Riverpod / Future.then sin onError. Con esto cualquier crash
  // catastrófico se loguea (SFIT_ERROR) y la app no se cae a pantalla negra
  // sin pista del error.
  runZonedGuarded<void>(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Reemplazar la pantalla roja default de Flutter por una vista compacta
    // (release) o el widget original (debug).
    ErrorWidget.builder = _buildErrorWidget;

    // Reportar errores de Flutter (incluido en builds release) al logcat con
    // tag 'SFIT_ERROR' para poder diagnosticar pantallas rojas en campo via
    // `adb logcat -s flutter:V SFIT_ERROR:V`.
    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      developer.log(
        'FLUTTER ERROR: ${details.exceptionAsString()}',
        name: 'SFIT_ERROR',
        error: details.exception,
        stackTrace: details.stack,
      );
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      developer.log(
        'PLATFORM ERROR: $error',
        name: 'SFIT_ERROR',
        error: error,
        stackTrace: stack,
      );
      return true;
    };

    // Cada paso de inicialización en su propio try/catch. Si uno falla,
    // arrancamos igual sin esa funcionalidad — preferimos app degradada a
    // pantalla negra de boot.

    // Símbolos de fecha en español para `DateFormat`. Si falla, queda el
    // locale por defecto del sistema.
    try {
      await initializeDateFormatting('es', null);
    } catch (e, st) {
      developer.log('init es locale failed', name: 'SFIT_ERROR', error: e, stackTrace: st);
    }

    // Hive para storage local (cola GPS, cache, perfil offline). Si falla,
    // la app sigue pero sin persistencia local.
    try {
      await Hive.initFlutter();
    } catch (e, st) {
      developer.log('Hive init failed', name: 'SFIT_ERROR', error: e, stackTrace: st);
    }

    // WorkManager watchdog: tarea periódica de 15min que detecta cuando el
    // tracking GPS lleva >5min sin reportar durante un turno activo (Doze,
    // proceso muerto, OEM que mató el servicio) y notifica al usuario. NO
    // re-arranca el GPS — solo alerta para que el conductor reabra la app.
    try {
      await registerTrackingWatchdog();
    } catch (e, st) {
      developer.log('WorkManager watchdog init failed',
          name: 'SFIT_ERROR', error: e, stackTrace: st);
    }

    runApp(
      const ProviderScope(
        child: SfitApp(),
      ),
    );

    // Firebase + FCM en post-frame para no bloquear el primer frame.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        await Firebase.initializeApp();
        FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
        await NotificationService.initialize();
      } catch (e, st) {
        // Si falta google-services.json o el dispositivo no tiene Play
        // Services, no bloquear el arranque. Los handlers FCM no se
        // registran y las notificaciones push simplemente no llegan.
        developer.log('FCM init failed (non-fatal)', name: 'SFIT_ERROR', error: e, stackTrace: st);
      }
    });
  }, (error, stack) {
    // Catch-all final para errores en zonas async que escaparon del resto.
    developer.log(
      'ZONE ERROR: $error',
      name: 'SFIT_ERROR',
      error: error,
      stackTrace: stack,
    );
  });
}
