import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';
import '../../../../reports/data/datasources/reports_api_service.dart';

class CitizenDashboardPage extends ConsumerStatefulWidget {
  final Function(String) onSelectTab;

  const CitizenDashboardPage({super.key, required this.onSelectTab});

  @override
  ConsumerState<CitizenDashboardPage> createState() =>
      _CitizenDashboardPageState();
}

class _CitizenDashboardPageState extends ConsumerState<CitizenDashboardPage> {
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
      final reportesMap = await ref
          .read(reportsApiServiceProvider)
          .getMisReportes(limit: 100);
      if (!mounted) return;
      final reportes = reportesMap['items'] as List? ?? const [];

      int pendientes = 0;
      int validados = 0;
      for (final r in reportes) {
        final status = (r is Map) ? (r['status'] as String? ?? '') : '';
        if (status == 'pendiente') pendientes++;
        if (status == 'validado' || status == 'aprobado') validados++;
      }

      setState(() {
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

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.gold,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SfitHeroCard(
                kicker: 'CIUDADANO · SFIT',
                title: '¡Hola, $name!',
                subtitle: 'Participa y mejora el transporte de tu ciudad.',
                pills: [
                  SfitHeroPill(
                    label: 'Reportes',
                    value: _loading ? '...' : '$_totalReportes',
                  ),
                ],
              ),
              const SizedBox(height: 14),

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
                ],
              ),
              const SizedBox(height: 16),

              SfitQuickActionCard(
                icon: Icons.campaign_outlined,
                title: 'Reportar Infracción',
                subtitle: 'Sube fotos o video de una falta en tiempo real.',
                onTap: () => context.push('/reportar'),
              ),
              const SizedBox(height: 20),

              SfitCategorizedFeatures(
                categories: [
                  SfitFeatureCategory(
                    label: 'CONSULTAS',
                    icon: Icons.search_rounded,
                    modules: [
                      SfitFeatureCard(
                        icon: Icons.qr_code_scanner_outlined,
                        title: 'Escanear QR',
                        subtitle: 'Verificar habilitación',
                        onTap: () => context.push('/qr'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.directions_bus_outlined,
                        title: 'Buses en vivo',
                        subtitle: 'Mapa en tiempo real',
                        onTap: () => context.push('/buses-en-vivo'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.airport_shuttle_outlined,
                        title: 'Viaje Interprov.',
                        subtitle: 'Monitorear velocidad',
                        onTap: () => context.push('/ciudadano/mi-viaje'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.search_rounded,
                        title: 'Buscar vehículo',
                        subtitle: 'Auditar placa o historial',
                        onTap: () => context.push('/buscar-vehiculo'),
                      ),
                    ],
                  ),
                  SfitFeatureCategory(
                    label: 'RED SOCIAL VIAL',
                    icon: Icons.people_alt_outlined,
                    modules: [
                      SfitFeatureCard(
                        icon: Icons.people_alt_outlined,
                        title: 'Red Social Vial',
                        subtitle: 'Comunidad y feed vial',
                        onTap: () => widget.onSelectTab('red-social-vial'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.campaign_outlined,
                        title: 'Reportar ahora',
                        subtitle: 'Registrar nueva falta',
                        onTap: () => context.push('/reportar'),
                      ),
                    ],
                  ),
                  SfitFeatureCategory(
                    label: 'MI ACTIVIDAD',
                    icon: Icons.list_alt_outlined,
                    modules: [
                      SfitFeatureCard(
                        icon: Icons.list_alt_outlined,
                        title: 'Mis reportes',
                        subtitle: 'Ver estado de reportes',
                        onTap: () => widget.onSelectTab('mis-reportes'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.notifications_outlined,
                        title: 'Notificaciones',
                        subtitle: 'Centro de avisos',
                        onTap: () => context.push('/notificaciones'),
                      ),
                    ],
                  ),
                  SfitFeatureCategory(
                    label: 'MI CUENTA',
                    icon: Icons.person_outline,
                    modules: [
                      SfitFeatureCard(
                        icon: Icons.person_outline,
                        title: 'Mi perfil',
                        subtitle: 'Editar datos y cuenta',
                        onTap: () => widget.onSelectTab('perfil'),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
