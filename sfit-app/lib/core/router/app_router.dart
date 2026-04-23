import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/pending_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/rejected_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/inspection/presentation/pages/inspection_detail_page.dart';
import '../../features/inspection/presentation/pages/new_appeal_page.dart';
import '../../features/inspection/presentation/pages/new_inspection_page.dart';
import '../../features/inspection/presentation/pages/vehicle_inspections_page.dart';
import '../../features/notifications/presentation/pages/notifications_page.dart';
import '../../features/ai_ocr/presentation/pages/document_ocr_page.dart';
import '../../features/ocr/presentation/pages/plate_scanner_page.dart';
import '../../features/onboarding/presentation/pages/onboarding_page.dart';
import '../../features/profile/presentation/pages/change_password_page.dart';
import '../../features/qr_scanner/presentation/pages/qr_scanner_page.dart';
import '../../features/splash/presentation/pages/splash_page.dart';
import '../../features/trips/presentation/pages/trip_checkin_page.dart';
import '../../features/trips/presentation/pages/trip_checkout_page.dart';
import '../../features/operator/presentation/pages/vehicle_qr_page.dart';
import '../../features/operator/presentation/pages/nuevo_conductor_page.dart';
import '../../features/operator/presentation/pages/nuevo_vehiculo_page.dart';
import '../../features/vista_publica/presentation/pages/vehicle_public_page.dart';
import '../../features/trips/presentation/pages/route_detail_page.dart';
import '../../features/rewards/presentation/pages/ranking_page.dart';
import '../../features/reports/presentation/pages/submit_report_page.dart';

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
    redirect: (context, state) async {
      final authStatus = ref.read(authProvider).status;
      final path       = state.uri.path;
      final isAuth     = path == '/login' || path == '/register';
      final isSplash   = path == '/';
      final isOnboarding = path == '/onboarding';
      // Rutas accesibles sin autenticación
      final isPublic   = path == '/qr' || path.startsWith('/vehiculo-publico/');

      switch (authStatus) {
        case AuthStatus.loading:
          return isSplash ? null : '/';

        case AuthStatus.authenticated:
          if (isAuth || isSplash || isOnboarding) return '/home';
          return null;

        case AuthStatus.pendingApproval:
          if (isPublic) return null;
          return path == '/pending' ? null : '/pending';

        case AuthStatus.rejected:
          if (isPublic) return null;
          return path == '/rejected' ? null : '/rejected';

        case AuthStatus.unauthenticated:
          if (isOnboarding || isPublic) return null;
          if (isAuth) return null;
          // Primera vez sin sesión: mostrar onboarding si no se ha completado
          final prefs = await SharedPreferences.getInstance();
          final onboardingDone = prefs.getBool('onboarding_done') ?? false;
          if (!onboardingDone && isSplash) return '/onboarding';
          return '/login';
      }
    },
    routes: [
      GoRoute(path: '/',            builder: (_, __) => const SplashPage()),
      GoRoute(path: '/onboarding',  builder: (_, __) => const OnboardingPage()),
      GoRoute(path: '/login',       builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register',    builder: (_, __) => const RegisterPage()),
      GoRoute(path: '/pending',     builder: (_, __) => const PendingPage()),
      GoRoute(path: '/rejected',    builder: (_, __) => const RejectedPage()),
      GoRoute(path: '/home',        builder: (_, __) => const HomePage()),

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

      // ── Rutas de inspección ───────────────────────────────────
      GoRoute(
        path: '/inspecciones',
        builder: (context, state) {
          final vehicleId = state.uri.queryParameters['vehicleId']!;
          return VehicleInspectionsPage(vehicleId: vehicleId);
        },
      ),
      GoRoute(
        path: '/inspeccion/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return InspectionDetailPage(inspectionId: id);
        },
      ),
      GoRoute(
        path: '/apelacion-nueva',
        builder: (context, state) {
          final inspectionId = state.uri.queryParameters['inspectionId']!;
          return NewAppealPage(inspectionId: inspectionId);
        },
      ),

      // ── Rutas de perfil ───────────────────────────────────────
      GoRoute(
        path: '/cambiar-password',
        builder: (context, state) => const ChangePasswordPage(),
      ),

      // ── RF-17: OCR de placas vehiculares ──────────────────────
      GoRoute(
        path: '/ocr-placa',
        builder: (context, state) => const PlateScannerPage(),
      ),

      // ── RF-17: OCR de documentos (DNI, licencia, SOAT, tarjeta) ──
      GoRoute(
        path: '/ocr-documento',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          return DocumentOcrPage(
            docType: extra['docType'] as OcrDocType,
          );
        },
      ),

      // ── Turno de conductor ────────────────────────────────────
      GoRoute(
        path: '/viaje-checkin',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return TripCheckinPage(
            preRouteId: extra?['routeId'] as String?,
            preRouteName: extra?['routeName'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/viaje-checkout/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return TripCheckoutPage(
            entryId: id,
            vehiclePlate: extra['vehiclePlate'] as String? ?? '—',
            departureTime: extra['departureTime'] as String? ?? '',
            estimatedKm: extra['estimatedKm'] as double?,
          );
        },
      ),

      // ── Centro de notificaciones ──────────────────────────────
      GoRoute(
        path: '/notificaciones',
        builder: (context, state) => const NotificationsPage(),
      ),

      // ── QR de vehículo (operador) ─────────────────────────────
      GoRoute(
        path: '/vehiculo-qr',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          return VehicleQrPage(
            vehicleId: extra['id'] as String,
            plate: extra['plate'] as String,
          );
        },
      ),

      // ── Alta de conductor y vehículo (RF-05-01 / RF-05-02) ───
      GoRoute(path: '/nuevo-conductor', builder: (_, __) => const NuevoConductorPage()),
      GoRoute(path: '/nuevo-vehiculo',  builder: (_, __) => const NuevoVehiculoPage()),

      // ── RF-09: Detalle de ruta (conductor) ───────────────────
      GoRoute(
        path: '/ruta-detalle',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          return RouteDetailPage(
            routeId:   extra['routeId']   as String,
            routeName: extra['routeName'] as String? ?? 'Ruta',
          );
        },
      ),

      // ── RF-16: Ranking de ciudadanos ──────────────────────────
      GoRoute(path: '/ranking', builder: (_, __) => const RankingPage()),

      // ── RF-12: Formulario de reporte desde vista pública ─────
      GoRoute(
        path: '/reportar',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return SubmitReportPage(
            vehiclePlate: extra?['plate'] as String?,
            vehicleData: extra,
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
