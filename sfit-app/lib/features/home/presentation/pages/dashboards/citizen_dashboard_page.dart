import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';
import '../../../../rewards/data/datasources/rewards_api_service.dart';
import '../../../../rewards/data/models/reward_model.dart';
import '../../../../reports/data/datasources/reports_api_service.dart';

class CitizenDashboardPage extends ConsumerStatefulWidget {
  final Function(String) onSelectTab;

  const CitizenDashboardPage({super.key, required this.onSelectTab});

  @override
  ConsumerState<CitizenDashboardPage> createState() => _CitizenDashboardPageState();
}

class _CitizenDashboardPageState extends ConsumerState<CitizenDashboardPage> {
  CoinsStatus? _coins;
  int _totalReportes = 0;
  int _reportesPendientes = 0;
  int _reportesValidados = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final coinsFut = ref.read(rewardsApiServiceProvider).getCoinsStatus();
      final reportsFut = ref.read(reportsApiServiceProvider).getMisReportes(limit: 100);
      final results = await Future.wait([coinsFut, reportsFut]);
      if (!mounted) return;
      final coins = results[0] as CoinsStatus;
      final reportesMap = results[1] as Map<String, dynamic>;
      final reportes = reportesMap['items'] as List? ?? [];

      int pendientes = 0;
      int validados = 0;
      for (final r in reportes) {
        final status = (r is Map) ? (r['status'] as String? ?? '') : '';
        if (status == 'pendiente') pendientes++;
        if (status == 'validado' || status == 'aprobado') validados++;
      }

      setState(() {
        _coins = coins;
        _totalReportes = reportes.length;
        _reportesPendientes = pendientes;
        _reportesValidados = validados;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Ciudadano';
    final coinsValue = _coins?.balance.toString() ?? '—';
    final nivelLabel = _coins?.nivelLabel ?? '—';

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.gold,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SfitHeroCard(
                kicker: 'CIUDADANO · SFIT',
                title: '¡Hola, $name!',
                subtitle: 'Participa y mejora el transporte de tu ciudad.',
                pills: [
                  SfitHeroPill(label: 'SFITCoins', value: _loading ? '...' : coinsValue),
                  SfitHeroPill(label: 'Reportes', value: _loading ? '...' : '$_totalReportes'),
                ],
              ),
              const SizedBox(height: 20),

              SfitKpiStrip(
                items: [
                  SfitKpiCardData(
                    icon: Icons.flag_outlined,
                    label: 'Reportes',
                    value: _loading ? '—' : '$_reportesPendientes',
                    subtitle: 'Pendientes',
                    accent: AppColors.riesgo,
                  ),
                  SfitKpiCardData(
                    icon: Icons.check_circle_outline,
                    label: 'Validados',
                    value: _loading ? '—' : '$_reportesValidados',
                    subtitle: 'Aprobados',
                    accent: AppColors.apto,
                  ),
                  SfitKpiCardData(
                    icon: Icons.emoji_events_outlined,
                    label: 'Nivel',
                    value: _loading ? '—' : nivelLabel,
                    subtitle: 'Gamificación',
                    accent: AppColors.info,
                  ),
                ],
              ),
              const SizedBox(height: 20),

              SfitQuickActionCard(
                icon: Icons.campaign_outlined,
                title: 'Reportar Infracción',
                subtitle: 'Sube fotos o video de una falta en tiempo real.',
                onTap: () => widget.onSelectTab('reportar'),
              ),

              const SfitSectionHeader(
                icon: Icons.grid_view_rounded,
                label: 'MÓDULOS DISPONIBLES',
              ),
              const SizedBox(height: 12),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.1,
                children: [
                  SfitFeatureCard(
                    icon: Icons.dynamic_feed_outlined,
                    title: 'Feed',
                    subtitle: 'Comunidad',
                    onTap: () => widget.onSelectTab('inicio-feed'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.list_alt_outlined,
                    title: 'Mis reportes',
                    subtitle: 'Seguimiento',
                    onTap: () => widget.onSelectTab('mis-reportes'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.qr_code_scanner_outlined,
                    title: 'Escanear QR',
                    subtitle: 'Info vehicular',
                    onTap: () => context.push('/qr'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.emoji_events_outlined,
                    title: 'Premios',
                    subtitle: 'Canjear puntos',
                    onTap: () => widget.onSelectTab('premios'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.directions_bus_outlined,
                    title: 'Buses en vivo',
                    subtitle: 'Mapa en tiempo real',
                    onTap: () => context.push('/buses-en-vivo'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.leaderboard_outlined,
                    title: 'Ranking',
                    subtitle: 'Tabla ciudadanos',
                    onTap: () => context.push('/ranking'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
