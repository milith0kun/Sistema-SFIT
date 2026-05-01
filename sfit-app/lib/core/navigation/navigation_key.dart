/// RF-18: Clave global del Navigator para navegación desde notificaciones push.
///
/// Se pasa a [MaterialApp.router] (a través de GoRouter) y se usa en
/// [NotificationService] para navegar cuando el usuario toca una notificación
/// mientras la app está en foreground o background.
library;

import 'package:flutter/material.dart';

/// [GlobalKey] del [NavigatorState] de la app.
/// Declarado aquí como top-level para que tanto [app.dart] como
/// [notification_service.dart] puedan importarlo sin dependencias circulares.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

/// [GlobalKey] del [ScaffoldMessengerState] raíz de la app.
/// Permite mostrar SnackBars desde cualquier punto del código sin depender del
/// `BuildContext` de la pantalla actual — necesario para que el toast siga
/// visible cuando el flujo navega a otra ruta inmediatamente después
/// (por ejemplo: toast de "login exitoso" justo antes de redirigir al home).
final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

/// Muestra un SnackBar usando el ScaffoldMessenger raíz, sobreviviendo a
/// cambios de ruta. Usar este helper para feedback de operaciones que pueden
/// terminar redirigiendo al usuario (login, logout, deep links).
void showAppSnackBar(SnackBar snackBar) {
  final messenger = scaffoldMessengerKey.currentState;
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(snackBar);
}
