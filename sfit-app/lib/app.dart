import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/navigation/navigation_key.dart';
import 'core/router/app_router.dart';
import 'core/services/notification_service.dart';
import 'core/services/update_service.dart';
import 'core/theme/app_theme.dart';

class SfitApp extends ConsumerWidget {
  const SfitApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    // RF-18: Inyectar el GoRouter en NotificationService para que pueda
    // navegar desde los handlers de notificaciones push.
    NotificationService.setRouter(router);

    return MaterialApp.router(
      title: 'SFIT',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      // Modo dark deshabilitado por consistencia con la web (que también
      // está forzada a light). Si se quiere reactivar, restaurar
      // `darkTheme: AppTheme.darkTheme` y `themeMode: ThemeMode.system`.
      themeMode: ThemeMode.light,
      scaffoldMessengerKey: scaffoldMessengerKey,
      routerConfig: router,
      // El builder se ejecuta en cada ruta; _UpdateWrapper garantiza
      // que el check se dispare una sola vez al primer frame.
      builder: (context, child) => _UpdateWrapper(child: child ?? const SizedBox()),
    );
  }
}

/// Wrapper que dispara el chequeo de actualización una sola vez,
/// en el primer frame después de que MaterialApp tiene su Navigator listo.
class _UpdateWrapper extends StatefulWidget {
  final Widget child;
  const _UpdateWrapper({required this.child});

  @override
  State<_UpdateWrapper> createState() => _UpdateWrapperState();
}

class _UpdateWrapperState extends State<_UpdateWrapper> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) UpdateService.checkAndPrompt(context);
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
