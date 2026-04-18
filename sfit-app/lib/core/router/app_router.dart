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
import '../../features/splash/presentation/pages/splash_page.dart';

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

      switch (authStatus) {
        case AuthStatus.loading:
          return isSplash ? null : '/';

        case AuthStatus.authenticated:
          if (isAuth || isSplash) return '/home';
          return null;

        case AuthStatus.pendingApproval:
          return path == '/pending' ? null : '/pending';

        case AuthStatus.rejected:
          return path == '/rejected' ? null : '/rejected';

        case AuthStatus.unauthenticated:
          if (isAuth) return null;
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
    ],
  );
}
