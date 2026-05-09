import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';
import '../../../../operator/data/datasources/operator_api_service.dart';
import '../../../../operator/data/models/operator_dashboard_summary.dart';

class OperatorDashboardPage extends ConsumerWidget {
  final Function(String) onSelectTab;

  const OperatorDashboardPage({super.key, required this.onSelectTab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Operador';
    final dashboard = ref.watch(operatorDashboardProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(operatorDashboardProvider);
          await ref.read(operatorDashboardProvider.future);
        },
        color: AppColors.gold,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              dashboard.when(
                loading: () => _DashboardSkeleton(name: name),
                error: (e, _) => _DashboardError(name: name, message: '$e'),
                data: (s) => _DashboardContent(name: name, summary: s),
              ),
              const SizedBox(height: 16),

              SfitQuickActionCard(
                icon: Icons.local_shipping_outlined,
                title: 'Gestión de Flota',
                subtitle: 'Registra salidas, retornos y asignaciones.',
                onTap: () => onSelectTab('flota'),
              ),

              SfitCategorizedFeatures(
                categories: [
                  SfitFeatureCategory(
                    label: 'OPERACIÓN',
                    icon: Icons.local_shipping_outlined,
                    modules: [
                      SfitFeatureCard(
                        icon: Icons.local_shipping_outlined,
                        title: 'Flota',
                        subtitle: 'Salidas y retornos',
                        onTap: () => onSelectTab('flota'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.route_outlined,
                        title: 'Rutas',
                        subtitle: 'Control de recorridos',
                        onTap: () => onSelectTab('rutas'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.bar_chart_outlined,
                        title: 'Análisis',
                        subtitle: 'Estadísticas',
                        onTap: () => onSelectTab('analisis'),
                      ),
                    ],
                  ),
                  SfitFeatureCategory(
                    label: 'RECURSOS',
                    icon: Icons.groups_outlined,
                    modules: [
                      SfitFeatureCard(
                        icon: Icons.groups_2_outlined,
                        title: 'Conductores',
                        subtitle: 'Listado y estados',
                        onTap: () => onSelectTab('conductores'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.directions_car_outlined,
                        title: 'Vehículos',
                        subtitle: 'Gestión de unidades',
                        onTap: () => onSelectTab('vehiculos'),
                      ),
                      SfitFeatureCard(
                        icon: Icons.person_add_alt_outlined,
                        title: 'Asociar',
                        subtitle: 'Sumar conductores',
                        onTap: () => context.push('/operador/asociar-conductores'),
                      ),
                    ],
                  ),
                  SfitFeatureCategory(
                    label: 'CUENTA',
                    icon: Icons.account_circle_outlined,
                    modules: [
                      SfitFeatureCard(
                        icon: Icons.person_outline,
                        title: 'Mi perfil',
                        subtitle: 'Datos y cuenta',
                        onTap: () => onSelectTab('perfil'),
                      ),
                    ],
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

class _DashboardContent extends StatelessWidget {
  final String name;
  final OperatorDashboardSummary summary;

  const _DashboardContent({required this.name, required this.summary});

  @override
  Widget build(BuildContext context) {
    final hasCompany = summary.company != null;
    final companyLabel = hasCompany
        ? summary.company!.razonSocial
        : 'Sin empresa asignada — contacta al admin';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SfitHeroCard(
          kicker: 'OPERADOR · ${companyLabel.toUpperCase()}',
          title: '¡Hola, $name!',
          subtitle: hasCompany
              ? 'Controla la flota y conductores de tu empresa.'
              : 'Sin empresa, no puedes registrar salidas. Contacta al administrador.',
          pills: [
            SfitHeroPill(
              label: 'Vehículos',
              value: summary.vehicles.total.toString(),
            ),
            SfitHeroPill(
              label: 'En ruta',
              value: summary.fleetToday.enRuta.toString(),
            ),
          ],
        ),
        const SizedBox(height: 14),

        SfitKpiStrip(
          items: [
            SfitKpiCardData(
              icon: Icons.directions_car_outlined,
              label: 'Disponibles',
              value: summary.vehicles.disponible.toString(),
              subtitle: '${summary.vehicles.total} en flota',
              accent: AppColors.apto,
            ),
            SfitKpiCardData(
              icon: Icons.people_outline,
              label: 'Choferes',
              value: summary.drivers.apto.toString(),
              subtitle: 'Aptos hoy',
              accent: AppColors.info,
            ),
            SfitKpiCardData(
              icon: Icons.warning_amber_outlined,
              label: 'Alertas',
              value: summary.alerts.total.toString(),
              subtitle: _alertSubtitle(summary.alerts),
              accent: summary.alerts.total == 0 ? AppColors.apto : AppColors.riesgo,
            ),
          ],
        ),
      ],
    );
  }

  String _alertSubtitle(DashboardAlerts a) {
    if (a.total == 0) return 'Sin incidentes';
    final parts = <String>[];
    if (a.soatProxVencer > 0) parts.add('SOAT: ${a.soatProxVencer}');
    if (a.conductoresEnRiesgo > 0) parts.add('Riesgo: ${a.conductoresEnRiesgo}');
    if (a.vehiculosOffRoute > 0) parts.add('Off-route: ${a.vehiculosOffRoute}');
    return parts.join(' · ');
  }
}

class _DashboardSkeleton extends StatelessWidget {
  final String name;
  const _DashboardSkeleton({required this.name});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SfitHeroCard(
          kicker: 'OPERADOR · CARGANDO…',
          title: '¡Hola, $name!',
          subtitle: 'Cargando datos de tu empresa…',
          pills: const [
            SfitHeroPill(label: 'Vehículos', value: '—'),
            SfitHeroPill(label: 'En ruta', value: '—'),
          ],
        ),
        const SizedBox(height: 14),
        const SfitKpiStrip(
          items: [
            SfitKpiCardData(
              icon: Icons.directions_car_outlined,
              label: 'Disponibles',
              value: '—',
              subtitle: '...',
              accent: AppColors.ink3,
            ),
            SfitKpiCardData(
              icon: Icons.people_outline,
              label: 'Choferes',
              value: '—',
              subtitle: '...',
              accent: AppColors.ink3,
            ),
            SfitKpiCardData(
              icon: Icons.warning_amber_outlined,
              label: 'Alertas',
              value: '—',
              subtitle: '...',
              accent: AppColors.ink3,
            ),
          ],
        ),
      ],
    );
  }
}

class _DashboardError extends StatelessWidget {
  final String name;
  final String message;
  const _DashboardError({required this.name, required this.message});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SfitHeroCard(
          kicker: 'OPERADOR · ERROR',
          title: '¡Hola, $name!',
          subtitle: 'No se pudieron cargar los datos. Desliza para reintentar.',
          pills: const [
            SfitHeroPill(label: 'Estado', value: 'Error'),
          ],
        ),
      ],
    );
  }
}
