import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Pantalla de SFITCoins y recompensas para ciudadano — RF-16.
class RewardsPage extends ConsumerStatefulWidget {
  const RewardsPage({super.key});

  @override
  ConsumerState<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends ConsumerState<RewardsPage> {
  Map<String, dynamic>? _stats;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/reportes', queryParameters: {'limit': 10});
      final data = (resp.data as Map)['data'] as Map;
      final items = data['items'] as List;
      final validados = items
          .where((r) => (r as Map)['status'] == 'validado')
          .length;
      if (mounted) {
        setState(() {
          _stats = {
            'totalReports': data['total'] ?? 0,
            'validatedReports': validados,
            'sfitCoins': validados * 50,
          };
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final coins = (_stats?['sfitCoins'] as int?) ?? 0;
    final validated = (_stats?['validatedReports'] as int?) ?? 0;
    final total = (_stats?['totalReports'] as int?) ?? 0;

    final level = coins < 100
        ? ('Bronce', Icons.looks_one_outlined, AppColors.riesgo)
        : coins < 500
            ? ('Plata', Icons.looks_two_outlined, AppColors.ink5)
            : ('Oro', Icons.star_rounded, AppColors.gold);

    return SafeArea(
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.gold,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Hero SFITCoins ───────────────────────────
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.panel, AppColors.panel.withValues(alpha: 0.85)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: AppColors.goldBg,
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: AppColors.gold, width: 2),
                            ),
                            child: const Icon(Icons.emoji_events_rounded,
                                size: 40, color: AppColors.gold),
                          ),
                          const SizedBox(height: 14),
                          if (user != null)
                            Text(user.name,
                                style: AppTheme.inter(
                                  fontSize: 14,
                                  color: Colors.white70,
                                  fontWeight: FontWeight.w500,
                                )),
                          const SizedBox(height: 4),
                          Text(
                            '$coins',
                            style: AppTheme.inter(
                              fontSize: 48,
                              fontWeight: FontWeight.w900,
                              color: AppColors.gold,
                              letterSpacing: -2,
                            ),
                          ),
                          Text('SFITCoins',
                              style: AppTheme.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: Colors.white54,
                                letterSpacing: 2,
                              )),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppColors.goldBg,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                  color: AppColors.goldBorder),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(level.$2,
                                    size: 16, color: level.$3),
                                const SizedBox(width: 6),
                                Text('Nivel ${level.$1}',
                                    style: AppTheme.inter(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: level.$3,
                                    )),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ── Cómo ganar coins ─────────────────────────
                    Text('Cómo ganar SFITCoins',
                        style: AppTheme.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        )),
                    const SizedBox(height: 10),
                    const _HowToCard(
                      icon: Icons.campaign_outlined,
                      title: 'Enviar un reporte',
                      coins: 10,
                      description:
                          'Por cada reporte enviado al sistema.',
                    ),
                    const SizedBox(height: 8),
                    const _HowToCard(
                      icon: Icons.check_circle_outline,
                      title: 'Reporte validado',
                      coins: 50,
                      description:
                          'Cuando el equipo fiscal confirma tu reporte.',
                      highlight: true,
                    ),
                    const SizedBox(height: 8),
                    const _HowToCard(
                      icon: Icons.qr_code_scanner_outlined,
                      title: 'Escanear un QR',
                      coins: 5,
                      description:
                          'Por cada vehículo verificado con QR.',
                    ),
                    const SizedBox(height: 20),

                    // ── Resumen de actividad ─────────────────────
                    Text('Tu actividad',
                        style: AppTheme.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        )),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: _StatCard(
                          label: 'Reportes enviados',
                          value: '$total',
                          icon: Icons.flag_outlined,
                          color: AppColors.riesgo,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatCard(
                          label: 'Validados',
                          value: '$validated',
                          icon: Icons.verified_outlined,
                          color: AppColors.apto,
                        ),
                      ),
                    ]),
                    const SizedBox(height: 20),

                    // ── Próximas recompensas ─────────────────────
                    Text('Beneficios disponibles',
                        style: AppTheme.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        )),
                    const SizedBox(height: 10),
                    _RewardItem(
                      title: 'Cupón de transporte gratuito',
                      cost: 200,
                      available: coins >= 200,
                    ),
                    const SizedBox(height: 8),
                    _RewardItem(
                      title: 'Reconocimiento ciudadano del mes',
                      cost: 500,
                      available: coins >= 500,
                    ),
                    const SizedBox(height: 8),
                    _RewardItem(
                      title: 'Certificado de participación cívica',
                      cost: 100,
                      available: coins >= 100,
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.goldBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.goldBorder),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline,
                              size: 16, color: AppColors.goldDark),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'El canje de recompensas estará disponible '
                              'en la próxima actualización del sistema.',
                              style: AppTheme.inter(
                                  fontSize: 12, color: AppColors.goldDark),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _HowToCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final int coins;
  final String description;
  final bool highlight;

  const _HowToCard({
    required this.icon,
    required this.title,
    required this.coins,
    required this.description,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: highlight ? AppColors.goldBg : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: highlight ? AppColors.goldBorder : AppColors.ink1,
          ),
        ),
        child: Row(children: [
          Icon(icon,
              size: 20,
              color: highlight ? AppColors.gold : AppColors.ink5),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink8,
                    )),
                Text(description,
                    style: AppTheme.inter(
                        fontSize: 11, color: AppColors.ink5)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.goldBorder),
            ),
            child: Text('+$coins',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: AppColors.goldDark,
                )),
          ),
        ]),
      );
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.ink1),
        ),
        child: Column(children: [
          Icon(icon, size: 24, color: color),
          const SizedBox(height: 8),
          Text(value,
              style: AppTheme.inter(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
              )),
          Text(label,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 11, color: AppColors.ink5)),
        ]),
      );
}

class _RewardItem extends StatelessWidget {
  final String title;
  final int cost;
  final bool available;
  const _RewardItem({
    required this.title,
    required this.cost,
    required this.available,
  });

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: available ? AppColors.aptoBg : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: available ? AppColors.aptoBorder : AppColors.ink1),
        ),
        child: Row(children: [
          Icon(
            available
                ? Icons.redeem_outlined
                : Icons.lock_outline,
            size: 20,
            color: available ? AppColors.apto : AppColors.ink3,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(title,
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color:
                      available ? AppColors.ink8 : AppColors.ink4,
                )),
          ),
          const SizedBox(width: 8),
          Text('$cost coins',
              style: AppTheme.inter(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color:
                    available ? AppColors.apto : AppColors.ink4,
              )),
        ]),
      );
}
