import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../../auth/presentation/pages/widgets/status_screen.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../fleet/presentation/pages/fleet_page.dart';
import '../../../inspection/presentation/pages/inspections_list_page.dart';
import '../../../operator/presentation/pages/conductores_tab_page.dart';
import '../../../operator/presentation/pages/fleet_analytics_page.dart';
import '../../../operator/presentation/pages/vehiculos_tab_page.dart';
import '../../../profile/presentation/pages/profile_page.dart';
import '../../../reports/presentation/pages/reports_review_page.dart';
import '../../../reports/presentation/pages/submit_report_page.dart';
import '../../../trips/presentation/pages/fatigue_page.dart';
import '../../../trips/presentation/pages/my_routes_page.dart';
import '../../../trips/presentation/pages/my_trips_page.dart';
import '../../../rewards/presentation/pages/rewards_page.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/widgets/connectivity_banner.dart';

/// Pantalla principal — adapta el contenido al rol del usuario (RF-05 a RF-16).
///
/// Estructura:
/// - Roles web-only → `StatusScreen` sugiriendo el panel web.
/// - Resto → `Scaffold` con `NavigationBar` Material 3; cada tab renderiza
///   por ahora un `_ComingSoon` con `SfitHeroCard` para mantener el canon
///   visual hasta que la feature real aterrice.
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _index = 0;
  int _unreadNotifCount = 0;

  @override
  void initState() {
    super.initState();
    _loadUnreadCount();
  }

  Future<void> _loadUnreadCount() async {
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/notificaciones');
      final data = (resp.data as Map)['data'] as Map<String, dynamic>;
      final count = data['unreadCount'] as int? ?? 0;
      if (mounted) setState(() => _unreadNotifCount = count);
    } catch (_) {
      // Silencioso — el badge simplemente no se muestra si falla
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const _BlankLoading();

    if (user.isWebOnlyRole) {
      return StatusScreen(
        mark: const SfitMark(size: 36),
        icon: Icons.desktop_windows_outlined,
        iconColor: AppColors.goldDark,
        iconBg: AppColors.goldBg,
        title: 'Usa la web para este rol',
        message:
            'Tu rol (${_roleLabel(user.role)}) opera desde el panel web de SFIT. '
            'Ingresa a sfit.ecosdelseo.com con tus mismas credenciales.',
        onLogout: () => ref.read(authProvider.notifier).logout(),
      );
    }

    final tabs = _tabsForRole(user.role);
    final safeIndex = _index.clamp(0, tabs.length - 1);

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Row(
          children: [
            const SfitMark(size: 22),
            const SizedBox(width: 10),
            Text(
              'SFIT',
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
                letterSpacing: 2.4,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Notificaciones',
            icon: Badge(
              isLabelVisible: _unreadNotifCount > 0,
              label: Text(
                _unreadNotifCount > 99 ? '99+' : '$_unreadNotifCount',
                style: const TextStyle(fontSize: 10),
              ),
              child: const Icon(Icons.notifications_outlined),
            ),
            onPressed: () async {
              await context.push('/notificaciones');
              // Refrescar el conteo al volver de la pantalla de notificaciones
              if (mounted) _loadUnreadCount();
            },
          ),
          PopupMenuButton<String>(
            tooltip: 'Perfil',
            icon: CircleAvatar(
              radius: 15,
              backgroundColor: AppColors.goldBg,
              child: Text(
                user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                style: AppTheme.inter(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.goldDark,
                ),
              ),
            ),
            onSelected: (v) {
              if (v == 'logout') ref.read(authProvider.notifier).logout();
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name,
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink9,
                      ),
                    ),
                    Text(
                      _roleLabel(user.role),
                      style: AppTheme.inter(
                        fontSize: 12, color: AppColors.ink5,
                      ),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Text('Cerrar sesión'),
              ),
            ],
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: Column(
        children: [
          const ConnectivityBanner(),
          Expanded(
            child: IndexedStack(
              index: safeIndex,
              children: tabs.map((t) => t.page).toList(),
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: tabs
            .map((t) => NavigationDestination(
                  icon: Icon(t.icon),
                  selectedIcon: Icon(t.iconFilled ?? t.icon),
                  label: t.label,
                ))
            .toList(),
      ),
    );
  }

  // ── Tabs por rol — cada tab es un placeholder `_RolePlaceholder` con
  //    SfitHeroCard + KPIStrip mock para mantener el canon visual.
  List<_Tab> _tabsForRole(String role) {
    return switch (role) {
      'fiscal' => [
          const _Tab(
            label: 'Inspecciones',
            icon: Icons.assignment_outlined,
            iconFilled: Icons.assignment,
            page: InspectionsListPage(),
          ),
          const _Tab(
            label: 'QR',
            icon: Icons.qr_code_scanner_outlined,
            iconFilled: Icons.qr_code_scanner,
            page: _QrLaunchTab(forInspection: true),
          ),
          const _Tab(
            label: 'Reportes',
            icon: Icons.flag_outlined,
            iconFilled: Icons.flag,
            page: ReportsReviewPage(),
          ),
          const _Tab(
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      'operador' => const [
          _Tab(
            label: 'Flota',
            icon: Icons.local_shipping_outlined,
            iconFilled: Icons.local_shipping,
            page: FleetPage(),
          ),
          _Tab(
            label: 'Conductores',
            icon: Icons.groups_2_outlined,
            iconFilled: Icons.groups_2,
            page: ConductoresTabPage(),
          ),
          _Tab(
            label: 'Vehículos',
            icon: Icons.directions_car_outlined,
            iconFilled: Icons.directions_car,
            page: VehiculosTabPage(),
          ),
          _Tab(
            label: 'Análisis',
            icon: Icons.bar_chart_outlined,
            iconFilled: Icons.bar_chart,
            page: FleetAnalyticsPage(),
          ),
          _Tab(
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      'conductor' => const [
          _Tab(
            label: 'Mis rutas',
            icon: Icons.route_outlined,
            iconFilled: Icons.route,
            page: MyRoutesPage(),
          ),
          _Tab(
            label: 'Fatiga',
            icon: Icons.monitor_heart_outlined,
            iconFilled: Icons.monitor_heart,
            page: FatiguePage(),
          ),
          _Tab(
            label: 'Viajes',
            icon: Icons.timeline_outlined,
            iconFilled: Icons.timeline,
            page: MyTripsPage(),
          ),
          _Tab(
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      'ciudadano' => const [
          _Tab(
            label: 'Consulta',
            icon: Icons.qr_code_2_outlined,
            iconFilled: Icons.qr_code_2,
            page: _QrLaunchTab(),
          ),
          _Tab(
            label: 'Reportar',
            icon: Icons.campaign_outlined,
            iconFilled: Icons.campaign,
            page: SubmitReportPage(),
          ),
          _Tab(
            label: 'Recompensas',
            icon: Icons.emoji_events_outlined,
            iconFilled: Icons.emoji_events,
            page: RewardsPage(),
          ),
          _Tab(
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      _ => const [
          _Tab(
            label: 'Inicio',
            icon: Icons.home_outlined,
            iconFilled: Icons.home,
            page: _RolePlaceholder(
              kicker: 'Bienvenido',
              title: 'Inicio',
              subtitle: 'Tablero general del sistema SFIT.',
            ),
          ),
          _Tab(
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: _RolePlaceholder(
              kicker: 'Cuenta',
              title: 'Tu perfil',
              subtitle: 'Datos personales y sesión.',
            ),
          ),
        ],
    };
  }

  String _roleLabel(String role) => switch (role) {
        'ciudadano'         => 'Ciudadano',
        'conductor'         => 'Conductor',
        'fiscal'            => 'Fiscal / Inspector',
        'operador'          => 'Operador de Empresa',
        'admin_municipal'   => 'Administrador Municipal',
        'admin_provincial'  => 'Administrador Provincial',
        'super_admin'       => 'Super Admin',
        _                   => role,
      };
}

class _Tab {
  final String label;
  final IconData icon;
  final IconData? iconFilled;
  final Widget page;
  const _Tab({
    required this.label,
    required this.icon,
    required this.page,
    this.iconFilled,
  });
}

/// Placeholder de tab por-rol: mantiene el canon visual (hero + KPI mock +
/// badge "Próximamente") hasta que la feature real aterrice.
class _RolePlaceholder extends StatelessWidget {
  final String kicker;
  final String title;
  final String subtitle;

  const _RolePlaceholder({
    required this.kicker,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SfitHeroCard(
              kicker: kicker,
              title: title,
              subtitle: subtitle,
              pills: const [
                SfitHeroPill(label: 'Estado', value: '—'),
                SfitHeroPill(label: 'Hoy', value: '0'),
              ],
            ),
            const SizedBox(height: 18),

            // Placeholder KPI strip para mantener el ritmo visual del canon.
            const SfitKpiStrip(
              items: [
                SfitKpiCardData(
                  icon: Icons.check_circle_outline,
                  label: 'Aptos',
                  value: '—',
                  subtitle: 'Próximamente',
                  accent: AppColors.apto,
                ),
                SfitKpiCardData(
                  icon: Icons.warning_amber_outlined,
                  label: 'Riesgo',
                  value: '—',
                  subtitle: 'Próximamente',
                  accent: AppColors.riesgo,
                ),
                SfitKpiCardData(
                  icon: Icons.block_outlined,
                  label: 'No aptos',
                  value: '—',
                  subtitle: 'Próximamente',
                  accent: AppColors.noApto,
                ),
              ],
            ),

            const SizedBox(height: 22),

            // Empty-state canon — card blanca con ícono + mensaje + badge
            _ComingSoonCard(title: title),
          ],
        ),
      ),
    );
  }
}

class _ComingSoonCard extends StatelessWidget {
  final String title;

  const _ComingSoonCard({required this.title});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
      child: Column(
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.goldBorder, width: 1.5),
            ),
            child: const Icon(
              Icons.construction_rounded,
              size: 30,
              color: AppColors.goldDark,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Esta vista aún no está implementada.',
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 13,
              color: AppColors.ink5,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.goldBorder, width: 1),
            ),
            child: Text(
              'PRÓXIMAMENTE',
              style: AppTheme.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.goldDark,
                letterSpacing: 1.6,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BlankLoading extends StatelessWidget {
  const _BlankLoading();

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: AppColors.paper,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.gold),
        ),
      );
}

/// Tab de escáner QR — botón grande que lanza la página de escaneo
/// y campo de búsqueda por placa como alternativa (RF-06, RF-08).
class _QrLaunchTab extends StatefulWidget {
  final bool forInspection;
  const _QrLaunchTab({this.forInspection = false});

  @override
  State<_QrLaunchTab> createState() => _QrLaunchTabState();
}

class _QrLaunchTabState extends State<_QrLaunchTab> {
  final _plateCtrl = TextEditingController();

  @override
  void dispose() {
    _plateCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Hero QR ──────────────────────────────────────────
            Container(
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(16),
              ),
              padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
              child: Column(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.goldBg,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.goldBorder, width: 1.5),
                    ),
                    child: const Icon(Icons.qr_code_scanner,
                        size: 36, color: AppColors.goldDark),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Escanear QR del vehículo',
                    style: AppTheme.inter(
                      fontSize: 17, fontWeight: FontWeight.w700,
                      color: Colors.white, letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Verifica la firma HMAC sin conexión',
                    style: AppTheme.inter(fontSize: 13, color: Colors.white54),
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: () => context.push(
                      '/qr',
                      extra: {'forInspection': widget.forInspection},
                    ),
                    icon: const Icon(Icons.camera_alt_outlined, size: 18),
                    label: const Text('Abrir cámara'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 46),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Separador ─────────────────────────────────────────
            Row(children: [
              const Expanded(child: Divider(color: AppColors.ink2)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text('o busca por placa',
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink4)),
              ),
              const Expanded(child: Divider(color: AppColors.ink2)),
            ]),
            const SizedBox(height: 16),

            // ── Búsqueda por placa ───────────────────────────────
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _plateCtrl,
                    textCapitalization: TextCapitalization.characters,
                    decoration: InputDecoration(
                      hintText: 'Placa (ej. ABC-123)',
                      hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.ink2),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.ink2),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                    ),
                    style: AppTheme.inter(fontSize: 14, color: AppColors.ink9,
                        fontWeight: FontWeight.w600),
                    onSubmitted: (_) => _searchPlate(context),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  onPressed: () => _searchPlate(context),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.panel,
                    minimumSize: const Size(52, 52),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Icon(Icons.search, color: Colors.white),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _searchPlate(BuildContext context) {
    final plate = _plateCtrl.text.trim();
    if (plate.isEmpty) return;
    context.push('/vehiculo-publico/$plate');
  }
}
