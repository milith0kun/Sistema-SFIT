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

part 'app_router.g.dart';

@Riverpod(keepAlive: true)
GoRouter router(Ref ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final path    = state.uri.path;
      final isAuth  = path == '/login' || path == '/register';
      final isSplash = path == '/';

      switch (authState.status) {
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
          if (!isSplash) return '/login';
          return null;
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
              // SFIT mark
              const _SfitMark(size: 36),
              const SizedBox(height: 40),

              // Status icon
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: iconColor.withOpacity(0.3),
                    width: 1.5,
                  ),
                ),
                child: Icon(icon, size: 34, color: iconColor),
              ),
              const SizedBox(height: 24),

              Text(
                title,
                style: tt.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),

              Text(
                message,
                style: tt.bodyMedium?.copyWith(color: AppColors.ink5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),

              OutlinedButton(
                onPressed: onLogout,
                child: Text(logoutLabel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── SFIT diamond mark ──────────────────────────────────────────────
class _SfitMark extends StatelessWidget {
  final double size;
  const _SfitMark({this.size = 32});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(size, size),
      painter: _SfitMarkPainter(),
    );
  }
}

class _SfitMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    const gold = AppColors.gold;

    final stroke = Paint()
      ..color = gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = s.width * 0.055
      ..strokeJoin = StrokeJoin.miter;

    final fill = Paint()
      ..color = gold
      ..style = PaintingStyle.fill;

    // Outer diamond
    canvas.drawPath(
      Path()
        ..moveTo(s.width * 0.5, s.height * 0.094)
        ..lineTo(s.width * 0.906, s.height * 0.5)
        ..lineTo(s.width * 0.5, s.height * 0.906)
        ..lineTo(s.width * 0.094, s.height * 0.5)
        ..close(),
      stroke,
    );

    // Inner diamond (filled)
    canvas.drawPath(
      Path()
        ..moveTo(s.width * 0.5, s.height * 0.297)
        ..lineTo(s.width * 0.703, s.height * 0.5)
        ..lineTo(s.width * 0.5, s.height * 0.703)
        ..lineTo(s.width * 0.297, s.height * 0.5)
        ..close(),
      fill,
    );
  }

  @override
  bool shouldRepaint(_) => false;
}
