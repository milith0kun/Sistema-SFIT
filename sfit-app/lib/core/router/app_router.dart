import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/pending_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/rejected_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/inspection/presentation/pages/new_inspection_page.dart';
import '../../features/qr_scanner/presentation/pages/qr_scanner_page.dart';
import '../../features/splash/presentation/pages/splash_page.dart';
import '../../features/vista_publica/presentation/pages/vehicle_public_page.dart';

part 'app_router.g.dart';

/// Notifier que reemite cambios del auth state para GoRouter.
/// Permite que el router re-evalúe `redirect` sin ser recreado.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authProvider, (_, __) => notifyListeners());
  }
}

/// RF-01: Router con guard de autenticación que redirige según `authProvider.status`.
@Riverpod(keepAlive: true)
GoRouter router(Ref ref) {
  final refresh = _AuthRefreshNotifier(ref);

  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: kDebugMode,
    refreshListenable: refresh,
    redirect: (context, state) {
      final authStatus = ref.read(authProvider).status;
      final path       = state.uri.path;
      final isAuth     = path == '/login' || path == '/register';
      final isSplash   = path == '/';
      // Rutas accesibles sin autenticación
      final isPublic   = path == '/qr' || path.startsWith('/vehiculo-publico/');

      switch (authStatus) {
        case AuthStatus.loading:
          return isSplash ? null : '/';

        case AuthStatus.authenticated:
          if (isAuth || isSplash) return '/home';
          return null;

        case AuthStatus.pendingApproval:
          if (isPublic) return null;
          return path == '/pending' ? null : '/pending';

        case AuthStatus.rejected:
          if (isPublic) return null;
          return path == '/rejected' ? null : '/rejected';

        case AuthStatus.unauthenticated:
          if (isAuth || isPublic) return null;
          return '/login';
      }
    },
    routes: [
      GoRoute(path: '/',         builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login',    builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
      GoRoute(path: '/pending',  builder: (_, __) => const PendingPage()),
      GoRoute(path: '/rejected', builder: (_, __) => const RejectedPage()),
      GoRoute(path: '/home',     builder: (_, __) => const HomePage()),

      // ── Rutas protegidas adicionales ───────────────────────────
      GoRoute(
        path: '/nueva-inspeccion',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          return NewInspectionPage(
            vehicleId: extra['vehicleId'] as String,
            plate: extra['plate'] as String,
            vehicleTypeKey: extra['vehicleTypeKey'] as String,
            driverId: extra['driverId'] as String?,
          );
        },
      ),

      // ── Rutas públicas (accesibles sin auth) ───────────────────
      GoRoute(
        path: '/qr',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          final forInspection = extra?['forInspection'] as bool? ?? false;
          return QrScannerPage(forInspection: forInspection);
        },
      ),
      GoRoute(
        path: '/vehiculo-publico/:plate',
        builder: (context, state) {
          final plate = state.pathParameters['plate']!;
          final extra = state.extra as Map<String, dynamic>?;
          return VehiclePublicPage(
            plate: plate,
            qrJson: extra?['qrJson'] as String?,
            offlineVerified: extra?['offlineVerified'] as bool?,
          );
        },
      ),
    ],
  );
}
