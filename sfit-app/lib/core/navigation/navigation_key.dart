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
