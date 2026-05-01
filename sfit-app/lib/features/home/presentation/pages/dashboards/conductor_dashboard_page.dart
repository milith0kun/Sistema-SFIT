import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';
import '../../../../drivers/data/datasources/driver_api_service.dart';

class ConductorDashboardPage extends ConsumerStatefulWidget {
  final Function(String) onSelectTab;

  const ConductorDashboardPage({super.key, required this.onSelectTab});

  @override
  ConsumerState<ConductorDashboardPage> createState() => _ConductorDashboardPageState();
}

class _ConductorDashboardPageState extends ConsumerState<ConductorDashboardPage> {
  Map<String, dynamic>? _driverData;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final data = await ref.read(driverApiServiceProvider).getMyDriverProfile();
      if (!mounted) return;
      setState(() { _driverData = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fatigaLabel(String? status) => switch (status) {
    'apto'    => 'Apto',
    'riesgo'  => 'Riesgo',
    'no_apto' => 'No apto',
    _         => '—',
  };

  Color _fatigaColor(String? status) => switch (status) {
    'apto'    => AppColors.apto,
    'riesgo'  => AppColors.riesgo,
    'no_apto' => AppColors.noApto,
    _         => AppColors.ink5,
  };

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Conductor';

    final fatigaStatus = _driverData?['status'] as String? ?? 'apto';
    final continuousHours = (_driverData?['continuousHours'] as num?)?.toDouble() ?? 0;
    final reputation = (_driverData?['reputationScore'] as num?)?.toInt() ?? 0;
    final company = _driverData?['companyName'] as String?;

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
                kicker: 'CONDUCTOR · SFIT',
                title: '¡Hola, $name!',
                subtitle: company != null ? 'Empresa: $company' : 'Revisa tu turno y estado de fatiga.',
                pills: [
                  SfitHeroPill(label: 'Estado', value: _loading ? '...' : _fatigaLabel(fatigaStatus).toUpperCase()),
                  SfitHeroPill(label: 'Reputación', value: _loading ? '...' : '$reputation'),
                ],
              ),
              const SizedBox(height: 20),

              SfitKpiStrip(
                items: [
                  SfitKpiCardData(
                    icon: Icons.monitor_heart_outlined,
                    label: 'Fatiga',
                    value: _loading ? '—' : _fatigaLabel(fatigaStatus),
                    subtitle: '${continuousHours.toStringAsFixed(0)}h continuas',
                    accent: _fatigaColor(fatigaStatus),
                  ),
                  SfitKpiCardData(
                    icon: Icons.star_outline,
                    label: 'Reputación',
                    value: _loading ? '—' : '$reputation',
                    subtitle: 'de 100 pts',
                    accent: reputation >= 80 ? AppColors.apto : reputation >= 50 ? AppColors.riesgo : AppColors.noApto,
                  ),
                  SfitKpiCardData(
                    icon: Icons.business_outlined,
                    label: 'Empresa',
                    value: company?.split(' ').first ?? '—',
                    subtitle: 'Asignada',
                    accent: AppColors.info,
                  ),
                ],
              ),
              const SizedBox(height: 20),

              SfitQuickActionCard(
                icon: Icons.route_outlined,
                title: 'Mis Rutas',
                subtitle: 'Ver recorridos asignados y turno activo.',
                onTap: () => widget.onSelectTab('rutas'),
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
                    icon: Icons.timeline_outlined,
                    title: 'Viajes',
                    subtitle: 'Historial diario',
                    onTap: () => widget.onSelectTab('viajes'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.monitor_heart_outlined,
                    title: 'Fatiga',
                    subtitle: 'Control preventivo',
                    onTap: () => widget.onSelectTab('fatiga'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.map_outlined,
                    title: 'Mapa',
                    subtitle: 'Ubicación en ruta',
                    onTap: () => widget.onSelectTab('mapa'),
                  ),
                  SfitFeatureCard(
                    icon: Icons.person_outline,
                    title: 'Mi perfil',
                    subtitle: 'Datos y licencia',
                    onTap: () => widget.onSelectTab('perfil'),
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
