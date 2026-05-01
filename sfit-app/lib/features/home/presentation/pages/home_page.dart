import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../../../../core/widgets/sfit_sidebar.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../../auth/domain/entities/user_entity.dart';
import '../../../auth/presentation/pages/role_preview_page.dart';
import '../../../auth/presentation/pages/widgets/status_screen.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../fleet/presentation/pages/fleet_page.dart';
import '../../../inspection/presentation/pages/inspections_list_page.dart';
import '../../../operator/presentation/pages/conductores_tab_page.dart';
import '../../../operator/presentation/pages/fleet_analytics_page.dart';
import '../../../operator/presentation/pages/vehiculos_tab_page.dart';
import '../../../profile/presentation/pages/profile_page.dart';
import '../../../feed/presentation/pages/feed_page.dart';
import '../../../reports/presentation/pages/mis_reportes_page.dart';
import '../../../reports/presentation/pages/reports_review_page.dart';
import '../../../reports/presentation/pages/submit_report_page.dart';
import '../../../trips/presentation/pages/fatigue_page.dart';
import '../../../trips/presentation/pages/my_routes_page.dart';
import '../../../trips/presentation/pages/my_trips_page.dart';
import '../../../trips/presentation/pages/trip_map_page.dart';
import '../../../rewards/presentation/pages/rewards_page.dart';
import 'dashboards/citizen_dashboard_page.dart';
import 'dashboards/conductor_dashboard_page.dart';
import 'dashboards/fiscal_dashboard_page.dart';
import 'dashboards/operator_dashboard_page.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/widgets/connectivity_banner.dart';
import '../../../../core/widgets/sfit_loading.dart';

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
  bool _inPreviewMode = false;
  String? _lastProcessedTabSlug;
  // Tabs que ya fueron visitados al menos una vez — se construyen de forma perezosa
  // para evitar que animaciones de carga en tabs ocultos disparen el crash de semantics.
  final Set<int> _visitedTabs = {0};

  @override
  void initState() {
    super.initState();
    _loadUnreadCount();
    _checkPreviewMode();
  }

  Future<void> _checkPreviewMode() async {
    final isPreview = await ref.read(authProvider.notifier).isInPreviewMode();
    if (mounted) setState(() => _inPreviewMode = isPreview);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Soporta deep-link `/home?tab=<slug>` para saltar al tab indicado
    // (ej. "Reportar ahora" desde el empty state del feed).
    final slug = GoRouterState.of(context).uri.queryParameters['tab'];
    if (slug == null || slug == _lastProcessedTabSlug) return;
    _lastProcessedTabSlug = slug;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final user = ref.read(authProvider).user;
      if (user == null) return;
      final tabs = _tabsForRole(user.role);
      final i = tabs.indexWhere((t) => t.slug == slug);
      if (i >= 0 && i != _index) {
        setState(() {
          _index = i;
          _visitedTabs.add(i);
        });
      }
    });
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

    // super_admin → selector de rol para "entrar como" un usuario
    // operativo (ciudadano/conductor/fiscal/operador). Los demás roles
    // web-only (admin_municipal, admin_provincial) ven el StatusScreen
    // que los redirige al panel web.
    if (user.isSuperAdmin) {
      return const RolePreviewPage();
    }

    if (user.isWebOnlyRole) {
      return StatusScreen(
        mark: const SfitMark(size: 36),
        icon: Icons.desktop_windows_outlined,
        iconColor: AppColors.goldDark,
        iconBg: AppColors.goldBg,
        title: 'Usa el panel web',
        message:
            'Como ${_roleLabel(user.role)}, las gestiones se hacen desde '
            'el panel web de SFIT con tus mismas credenciales.',
        onPrimary: () async {
          final url = Uri.parse('https://sfit.ecosdelseo.com/login');
          if (await canLaunchUrl(url)) {
            await launchUrl(url, mode: LaunchMode.externalApplication);
          }
        },
        primaryIcon: Icons.open_in_new_rounded,
        primaryLabel: 'Abrir panel web',
        onLogout: () => ref.read(authProvider.notifier).logout(),
      );
    }

    final tabs = _tabsForRole(user.role);
    final safeIndex = _index.clamp(0, tabs.length - 1);

    final activeTab = tabs[safeIndex];
    // El primer tab (índice 0) siempre es "Inicio" en todos los roles.
    // Si el usuario no está ahí, el back vuelve a Inicio. Si ya está
    // en Inicio, el back muestra el diálogo de cerrar sesión.
    final isOnHomeTab = safeIndex == 0;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (!isOnHomeTab) {
          // Volver al tab Inicio en lugar de salir del app.
          setState(() {
            _index = 0;
            _visitedTabs.add(0);
          });
          return;
        }
        // Estamos en Inicio → preguntar si cerrar sesión.
        final shouldLogout = await _confirmLogout(context);
        if (shouldLogout == true && context.mounted) {
          await ref.read(authProvider.notifier).logout();
        }
      },
      child: Scaffold(
      backgroundColor: AppColors.paper,
      drawer: SfitSidebar(
        currentSlug: activeTab.slug,
        unreadNotifCount: _unreadNotifCount,
        inPreviewMode: _inPreviewMode,
        onSelectTab: (slug) {
          final i = tabs.indexWhere((t) => t.slug == slug);
          if (i >= 0 && i != _index) {
            setState(() {
              _index = i;
              _visitedTabs.add(i);
            });
          }
        },
      ),
      appBar: AppBar(
        toolbarHeight: 62,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        shape: const Border(bottom: BorderSide(color: AppColors.ink2, width: 1)),
        title: Row(
          children: [
            const SfitMark(size: 30),
            const SizedBox(width: 10),
            Container(width: 1, height: 18, color: AppColors.ink2),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                activeTab.label,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.3,
                ),
              ),
            ),
          ],
        ),
        actions: [
          // Notificaciones
          IconButton(
            tooltip: 'Notificaciones',
            icon: Badge(
              backgroundColor: AppColors.primary,
              isLabelVisible: _unreadNotifCount > 0,
              label: Text(
                _unreadNotifCount > 99 ? '99+' : '$_unreadNotifCount',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
              ),
              child: const Icon(Icons.notifications_outlined, size: 22, color: AppColors.ink8),
            ),
            onPressed: () async {
              await context.push('/notificaciones');
              if (mounted) _loadUnreadCount();
            },
          ),
          // Avatar / menú de cuenta
          _AccountMenu(
            user: user,
            roleLabel: _roleLabel(user.role),
            onMyProfile: () {
              final i = tabs.indexWhere((t) => t.slug == 'perfil');
              if (i >= 0) {
                setState(() {
                  _index = i;
                  _visitedTabs.add(i);
                });
              }
            },
            onLogout: () => ref.read(authProvider.notifier).logout(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          const ConnectivityBanner(),
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: tabs.asMap().entries.map((e) {
                final i = e.key;
                final isActive = i == safeIndex;
                // Solo construir el widget del tab si fue visitado al menos una vez.
                // Los tabs no visitados se dejan como SizedBox vacío para no crear
                // AnimationControllers ocultos que disparan el crash de semantics.
                final built = _visitedTabs.contains(i);
                return Offstage(
                  offstage: !isActive,
                  child: built
                      ? TickerMode(enabled: isActive, child: e.value.page)
                      : const SizedBox.shrink(),
                );
              }).toList(),
            ),
          ),
        ],
      ),
      ),
    );
  }

  /// Diálogo de confirmación de cerrar sesión. Devuelve `true` si el
  /// usuario confirmó, `false`/`null` si canceló.
  Future<bool?> _confirmLogout(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: AppColors.noAptoBg,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.logout_rounded, color: AppColors.noApto, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '¿Cerrar sesión?',
                style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
              ),
            ),
          ],
        ),
        content: Text(
          'Tendrás que volver a ingresar con tu correo o cuenta de Google la próxima vez.',
          style: AppTheme.inter(fontSize: 13, color: AppColors.ink6, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancelar',
              style: AppTheme.inter(fontSize: 13.5, color: AppColors.ink6, fontWeight: FontWeight.w600),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.noApto,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text(
              'Cerrar sesión',
              style: AppTheme.inter(fontSize: 13.5, color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  // ── Tabs por rol — cada tab es un dashboard real o vista funcional.
  List<_Tab> _tabsForRole(String role) {
    void onSelectTab(String slug) {
      final tabs = _tabsForRole(role);
      final i = tabs.indexWhere((t) => t.slug == slug);
      if (i >= 0 && i != _index) {
        setState(() {
          _index = i;
          _visitedTabs.add(i);
        });
      }
    }

    return switch (role) {
      'fiscal' => [
          _Tab(
            slug: 'inicio',
            label: 'Inicio',
            icon: Icons.home_outlined,
            iconFilled: Icons.home,
            page: FiscalDashboardPage(onSelectTab: onSelectTab),
          ),
          const _Tab(
            slug: 'inspecciones',
            label: 'Inspecciones',
            icon: Icons.assignment_outlined,
            iconFilled: Icons.assignment,
            page: InspectionsListPage(),
          ),
          const _Tab(
            slug: 'qr',
            label: 'QR',
            icon: Icons.qr_code_scanner_outlined,
            iconFilled: Icons.qr_code_scanner,
            page: _QrLaunchTab(forInspection: true),
          ),
          const _Tab(
            slug: 'reportes',
            label: 'Reportes',
            icon: Icons.flag_outlined,
            iconFilled: Icons.flag,
            page: ReportsReviewPage(),
          ),
          const _Tab(
            slug: 'vehiculos-consulta',
            label: 'Vehículos',
            icon: Icons.directions_car_outlined,
            iconFilled: Icons.directions_car,
            page: _QrLaunchTab(forInspection: true),
          ),
          const _Tab(
            slug: 'conductores-consulta',
            label: 'Conductores',
            icon: Icons.groups_2_outlined,
            iconFilled: Icons.groups_2,
            page: _QrLaunchTab(forInspection: true),
          ),
          const _Tab(
            slug: 'perfil',
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      'operador' => [
          _Tab(
            slug: 'inicio',
            label: 'Inicio',
            icon: Icons.home_outlined,
            iconFilled: Icons.home,
            page: OperatorDashboardPage(onSelectTab: onSelectTab),
          ),
          const _Tab(
            slug: 'flota',
            label: 'Flota',
            icon: Icons.local_shipping_outlined,
            iconFilled: Icons.local_shipping,
            page: FleetPage(),
          ),
          const _Tab(
            slug: 'conductores',
            label: 'Conductores',
            icon: Icons.groups_2_outlined,
            iconFilled: Icons.groups_2,
            page: ConductoresTabPage(),
          ),
          const _Tab(
            slug: 'vehiculos',
            label: 'Vehículos',
            icon: Icons.directions_car_outlined,
            iconFilled: Icons.directions_car,
            page: VehiculosTabPage(),
          ),
          const _Tab(
            slug: 'analisis',
            label: 'Análisis',
            icon: Icons.bar_chart_outlined,
            iconFilled: Icons.bar_chart,
            page: FleetAnalyticsPage(),
          ),
          const _Tab(
            slug: 'rutas',
            label: 'Rutas',
            icon: Icons.route_outlined,
            iconFilled: Icons.route,
            page: MyRoutesPage(),
          ),
          const _Tab(
            slug: 'perfil',
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      'conductor' => [
          _Tab(
            slug: 'inicio',
            label: 'Inicio',
            icon: Icons.home_outlined,
            iconFilled: Icons.home,
            page: ConductorDashboardPage(onSelectTab: onSelectTab),
          ),
          const _Tab(
            slug: 'rutas',
            label: 'Mis rutas',
            icon: Icons.route_outlined,
            iconFilled: Icons.route,
            page: MyRoutesPage(),
          ),
          const _Tab(
            slug: 'mapa',
            label: 'Mapa',
            icon: Icons.map_outlined,
            iconFilled: Icons.map,
            page: TripMapPage(),
          ),
          const _Tab(
            slug: 'fatiga',
            label: 'Fatiga',
            icon: Icons.monitor_heart_outlined,
            iconFilled: Icons.monitor_heart,
            page: FatiguePage(),
          ),
          const _Tab(
            slug: 'viajes',
            label: 'Viajes',
            icon: Icons.timeline_outlined,
            iconFilled: Icons.timeline,
            page: MyTripsPage(),
          ),
          const _Tab(
            slug: 'perfil',
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      'ciudadano' => [
          _Tab(
            slug: 'inicio',
            label: 'Inicio',
            icon: Icons.home_outlined,
            iconFilled: Icons.home,
            page: CitizenDashboardPage(onSelectTab: onSelectTab),
          ),
          const _Tab(
            slug: 'inicio-feed',
            label: 'Feed',
            icon: Icons.dynamic_feed_outlined,
            iconFilled: Icons.dynamic_feed,
            page: FeedPage(),
          ),
          const _Tab(
            slug: 'mis-reportes',
            label: 'Mis reportes',
            icon: Icons.list_alt_outlined,
            iconFilled: Icons.list_alt,
            page: MisReportesPage(),
          ),
          const _Tab(
            slug: 'reportar',
            label: 'Reportar',
            icon: Icons.campaign_outlined,
            iconFilled: Icons.campaign,
            page: SubmitReportPage(),
          ),
          const _Tab(
            slug: 'premios',
            label: 'Premios',
            icon: Icons.emoji_events_outlined,
            iconFilled: Icons.emoji_events,
            page: RewardsPage(),
          ),
          const _Tab(
            slug: 'perfil',
            label: 'Perfil',
            icon: Icons.person_outline,
            iconFilled: Icons.person,
            page: ProfilePage(),
          ),
        ],
      // Nota: admin_municipal, admin_provincial y super_admin son web-only
      // (ver `UserEntity.isWebOnlyRole`). HomePage muestra `StatusScreen`
      // para esos roles antes de llegar a `_tabsForRole`, por eso no
      // están listados aquí.
      _ => const [
          _Tab(
            slug: 'inicio',
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
            slug: 'perfil',
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
  final String slug;
  const _Tab({
    required this.label,
    required this.icon,
    required this.page,
    required this.slug,
    this.iconFilled,
  });
}

/// Avatar circular en el AppBar que abre un popup con el header de cuenta
/// (nombre + email + pill de rol), acceso rápido a "Mi perfil" y
/// "Cerrar sesión". Espejo del patrón de la sidebar web.
class _AccountMenu extends StatelessWidget {
  final UserEntity user;
  final String roleLabel;
  final VoidCallback onMyProfile;
  final VoidCallback onLogout;

  const _AccountMenu({
    required this.user,
    required this.roleLabel,
    required this.onMyProfile,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final name = user.name;
    final email = user.email;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';

    return PopupMenuButton<String>(
      tooltip: 'Cuenta',
      offset: const Offset(0, 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      surfaceTintColor: Colors.white,
      elevation: 8,
      icon: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.primaryBg,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.primaryBorder, width: 1),
        ),
        alignment: Alignment.center,
        child: Text(
          initial,
          style: AppTheme.inter(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
          ),
        ),
      ),
      onSelected: (v) {
        if (v == 'profile') onMyProfile();
        if (v == 'logout') onLogout();
      },
      itemBuilder: (_) => [
        // Header inerte con info de cuenta
        PopupMenuItem<String>(
          enabled: false,
          padding: EdgeInsets.zero,
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            constraints: const BoxConstraints(minWidth: 240),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: AppColors.primaryBg,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.primaryBorder),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initial,
                        style: AppTheme.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            name.isEmpty ? 'Usuario' : name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.inter(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink9,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.inter(
                              fontSize: 11.5,
                              color: AppColors.ink5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primaryBg,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.primaryBorder),
                  ),
                  child: Text(
                    roleLabel.toUpperCase(),
                    style: AppTheme.inter(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryDark,
                      letterSpacing: 1.0,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const PopupMenuDivider(height: 1),
        PopupMenuItem<String>(
          value: 'profile',
          height: 42,
          child: Row(
            children: [
              const Icon(Icons.person_outline, size: 18, color: AppColors.ink7),
              const SizedBox(width: 10),
              Text(
                'Mi perfil',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink8,
                ),
              ),
            ],
          ),
        ),
        PopupMenuItem<String>(
          value: 'logout',
          height: 42,
          child: Row(
            children: [
              const Icon(Icons.logout_rounded, size: 18, color: AppColors.noApto),
              const SizedBox(width: 10),
              Text(
                'Cerrar sesión',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.noApto,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
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
        body: SfitLoading(),
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
