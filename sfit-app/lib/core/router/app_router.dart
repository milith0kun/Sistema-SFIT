import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/splash/presentation/pages/splash_page.dart';
import '../theme/app_colors.dart';
import '../widgets/sfit_mark.dart';

part 'app_router.g.dart';

/// Notifier que reemite cambios del auth state para GoRouter.
/// Permite que el router re-evalúe `redirect` sin ser recreado.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authProvider, (_, __) => notifyListeners());
  }
}

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

      switch (authStatus) {
        case AuthStatus.loading:
          return isSplash ? null : '/';

        case AuthStatus.authenticated:
          if (isAuth || isSplash) return '/home';
          return null;

        case AuthStatus.pendingApproval:
          if (path == '/pending') return null;
          return '/pending';

        case AuthStatus.rejected:
          if (path == '/rejected') return null;
          return '/rejected';

        case AuthStatus.unauthenticated:
          if (isAuth) return null;
          return '/login';
      }
    },
    routes: [
      GoRoute(path: '/',         builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login',    builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
      GoRoute(path: '/pending',  builder: (_, __) => const _PendingPage()),
      GoRoute(path: '/rejected', builder: (_, __) => const _RejectedPage()),
      GoRoute(path: '/home',     builder: (_, __) => const HomePage()),
    ],
  );
}

// ── Pantalla: solicitud pendiente (RF-01-03) ──────────────────────
class _PendingPage extends ConsumerWidget {
  const _PendingPage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _StatusScreen(
      icon: Icons.hourglass_top_rounded,
      iconColor: AppColors.gold,
      iconBg: AppColors.goldBg,
      title: 'Solicitud enviada',
      message:
          'Tu cuenta está pendiente de aprobación. Recibirás una notificación cuando el administrador revise tu solicitud.',
      onLogout: () => ref.read(authProvider.notifier).logout(),
    );
  }
}

// ── Pantalla: solicitud rechazada (RF-01-04 / RF-01-05) ──────────
class _RejectedPage extends ConsumerWidget {
  const _RejectedPage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _StatusScreen(
      icon: Icons.cancel_outlined,
      iconColor: AppColors.danger,
      iconBg: const Color(0xFFFFF5F5),
      title: 'Solicitud rechazada',
      message:
          'Tu solicitud de acceso fue rechazada por el administrador municipal. Puedes crear una nueva cuenta o contactar al soporte.',
      onLogout: () => ref.read(authProvider.notifier).logout(),
      logoutLabel: 'Volver al inicio',
    );
  }
}

// ── Widget reutilizable de estado ──────────────────────────────────
class _StatusScreen extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String message;
  final VoidCallback onLogout;
  final String logoutLabel;

  const _StatusScreen({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.message,
    required this.onLogout,
    this.logoutLabel = 'Cerrar sesión',
  });

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SfitMark(size: 36),
              const SizedBox(height: 40),
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: iconColor.withValues(alpha: 0.3),
                    width: 1.5,
                  ),
                ),
                child: Icon(icon, size: 34, color: iconColor),
              ),
              const SizedBox(height: 24),
              Text(title, style: tt.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Text(
                message,
                style: tt.bodyMedium?.copyWith(color: AppColors.ink5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              OutlinedButton(onPressed: onLogout, child: Text(logoutLabel)),
            ],
          ),
        ),
      ),
    );
  }
}
