/// RF-18: Servicio de notificaciones push (FCM) + local notifications.
///
/// Responsabilidades:
///   - Crear canal Android `sfit_alerts` con importancia alta.
///   - Inicializar [FlutterLocalNotificationsPlugin].
///   - Solicitar permisos de notificación.
///   - Mostrar notificaciones locales cuando llega un mensaje FCM en foreground.
///   - Navegar a la pantalla correcta cuando el usuario toca una notificación.
///
/// Navegación: usa [GoRouter] almacenado via [NotificationService.setRouter]
/// (llamado desde [app.dart] una vez construido el router) para invocar
/// `router.go(destination)` desde fuera del árbol de widgets.
library;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

/// Canal Android para todas las alertas de SFIT.
const _kChannelId   = 'sfit_alerts';
const _kChannelName = 'Alertas SFIT';
const _kChannelDesc = 'Notificaciones de fatiga, sanciones, reportes y operaciones';

/// Plugin singleton de notificaciones locales.
final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

class NotificationService {
  const NotificationService._();

  /// Referencia al [GoRouter] de la app, inyectada desde [app.dart] una vez
  /// que el router Riverpod ha sido creado.
  static GoRouter? _router;

  /// Registra el [GoRouter] activo para que el servicio pueda navegar
  /// cuando el usuario toca una notificación.
  ///
  /// Llamar desde el [build] de [SfitApp] tras obtener `ref.watch(routerProvider)`.
  static void setRouter(GoRouter router) => _router = router;

  // ── Inicialización ──────────────────────────────────────────────────────

  /// Inicializa el canal Android, el plugin local y los listeners FCM.
  ///
  /// Debe llamarse desde [main()] DESPUÉS de [Firebase.initializeApp()],
  /// dentro del mismo bloque try/catch que protege contra la ausencia de
  /// google-services.json.
  static Future<void> initialize() async {
    await _initLocalNotifications();
    await _requestPermissions();
    _registerFcmListeners();
  }

  // ── Notificaciones locales ──────────────────────────────────────────────

  /// Muestra una notificación local con [title], [body] y [payload] opcional.
  ///
  /// [payload] se pasa al tap-handler para decidir a qué ruta navegar.
  static Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      _kChannelId,
      _kChannelName,
      channelDescription: _kChannelDesc,
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const notificationDetails = NotificationDetails(
      android: androidDetails,
    );

    await _localNotifications.show(
      // ID estable basado en el hash del título+body para evitar duplicados
      (title + body).hashCode,
      title,
      body,
      notificationDetails,
      payload: payload,
    );
  }

  // ── Privados ────────────────────────────────────────────────────────────

  static Future<void> _initLocalNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Crear canal Android con importancia alta
    const channel = AndroidNotificationChannel(
      _kChannelId,
      _kChannelName,
      description: _kChannelDesc,
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  static Future<void> _requestPermissions() async {
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[NotificationService] Permisos de notificación denegados');
      } else {
        debugPrint('[NotificationService] Permisos concedidos: '
            '${settings.authorizationStatus}');
      }
    } catch (e) {
      debugPrint('[NotificationService] Error solicitando permisos: $e');
    }
  }

  static void _registerFcmListeners() {
    // 1. Foreground: app abierta → mostrar notificación local
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[FCM foreground] ${message.notification?.title}');
      final notification = message.notification;
      if (notification != null) {
        showNotification(
          title: notification.title ?? 'SFIT',
          body:  notification.body  ?? '',
          payload: message.data['type'] as String?,
        );
      }
    });

    // 2. Background → tap: app en background, usuario toca la notificación
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[FCM tap desde background] ${message.data}');
      _navigateFromPayload(message.data['type'] as String?);
    });

    // 3. Terminated → tap: app estaba cerrada, lanzada desde notificación
    FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        debugPrint('[FCM tap desde app cerrada] ${message.data}');
        // Diferir la navegación hasta que el Navigator esté montado
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _navigateFromPayload(message.data['type'] as String?);
        });
      }
    });
  }

  /// Callback cuando el usuario toca una notificación local.
  static void _onNotificationTap(NotificationResponse response) {
    debugPrint('[NotificationService] Tap en notificación local: '
        '${response.payload}');
    _navigateFromPayload(response.payload);
  }

  /// Navega según el [type] del payload de la notificación.
  ///
  /// - `asignacion_viaje` → `/conductor/viajes-pendientes` (bandeja push)
  /// - `fatiga`, `reporte`, `sancion`, `operacion` → `/home`
  /// - cualquier otro valor o null → `/notificaciones`
  static void _navigateFromPayload(String? type) {
    if (_router == null) {
      debugPrint('[NotificationService] GoRouter no disponible todavía '
          '(type=$type). Navegación diferida ignorada.');
      return;
    }

    final destination = _routeForType(type);
    debugPrint('[NotificationService] Navegando a $destination (type=$type)');
    _router!.go(destination);
  }

  static String _routeForType(String? type) {
    switch (type) {
      case 'asignacion_viaje':
        return '/conductor/viajes-pendientes';
      case 'fatiga':
      case 'reporte':
      case 'sancion':
      case 'operacion':
        return '/home';
      default:
        return '/notificaciones';
    }
  }
}
