import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../drivers/data/datasources/driver_api_service.dart';

/// Estado de fatiga del conductor — RF-14 (FatigueEngine).
class FatiguePage extends ConsumerStatefulWidget {
  const FatiguePage({super.key});

  @override
  ConsumerState<FatiguePage> createState() => _FatiguePageState();
}

class _FatiguePageState extends ConsumerState<FatiguePage> {
  Map<String, dynamic>? _driver;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ref.read(driverApiServiceProvider);
      final driver = await api.getMyDriverProfile();
      if (mounted) setState(() { _driver = driver; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.ink9,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Encabezado ──────────────────────────────────────
              Text('Estado de fatiga',
                  style: AppTheme.inter(
                    fontSize: 20, fontWeight: FontWeight.w700,
                    color: AppColors.ink9, letterSpacing: -0.5)),
              const SizedBox(height: 2),
              Text('Indicadores reglamentarios y reputación.',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
              const SizedBox(height: 16),

              // ── Cuerpo ──────────────────────────────────────────
              if (_loading)
                const _LoadingState()
              else if (_error != null)
                _ErrorState(onRetry: _load)
              else if (_driver == null)
                const _EmptyState()
              else
                _FatigueBody(driver: _driver!),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Estados ─────────────────────────────────────────────────────────
class _LoadingState extends StatelessWidget {
  const _LoadingState();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 60),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 24, height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.ink7),
            ),
            const SizedBox(height: 12),
            Text('Consultando indicadores…',
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
          ],
        ),
      );
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 40),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.noApto, size: 28),
            const SizedBox(height: 10),
            Text('No se pudo cargar tu estado.',
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.ink9,
                side: const BorderSide(color: AppColors.ink2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text('Reintentar',
                  style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 40),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.person_off_outlined, size: 36, color: AppColors.ink3),
            const SizedBox(height: 10),
            Text('Aún no estás registrado como conductor.',
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6)),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                'Cuando una empresa autorizada te asigne, podrás ver aquí tus indicadores de fatiga y reputación.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink4)),
            ),
          ],
        ),
      );
}

// ── Cuerpo principal (ya con datos) ─────────────────────────────────
class _FatigueBody extends StatelessWidget {
  final Map<String, dynamic> driver;
  const _FatigueBody({required this.driver});

  @override
  Widget build(BuildContext context) {
    final status = driver['status'] as String? ?? 'apto';
    final ch = (driver['continuousHours'] as num?)?.toDouble() ?? 0;
    final rh = (driver['restHours'] as num?)?.toDouble() ?? 0;
    final rep = (driver['reputationScore'] as num?)?.toInt() ?? 100;

    final (statusColor, statusIcon, statusLabel, statusDesc) = switch (status) {
      'apto' => (
          AppColors.apto,
          Icons.check_circle_outline,
          'APTO PARA CONDUCIR',
          'Tus indicadores de fatiga están dentro de los límites seguros.'
        ),
      'riesgo' => (
          AppColors.riesgo,
          Icons.warning_amber_outlined,
          'EN ZONA DE RIESGO',
          'Has acumulado muchas horas. Programa descanso adicional.'
        ),
      _ => (
          AppColors.noApto,
          Icons.cancel_outlined,
          'NO APTO — DESCANSO REQUERIDO',
          'Has superado el límite reglamentario. No conduzcas hasta descansar.'
        ),
    };

    const maxContinuous = 10.0;
    const minRest = 8.0;
    final chProgress = (ch / maxContinuous).clamp(0.0, 1.0);
    final rhProgress = (rh / minRest).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Estado principal ──────────────────────────────────
        _StatusBanner(
          color: statusColor,
          icon: statusIcon,
          title: statusLabel,
          subtitle: statusDesc,
        ),
        const SizedBox(height: 14),

        // ── Sección: indicadores reglamentarios ───────────────
        const _SectionHeader(label: 'Indicadores reglamentarios'),
        const SizedBox(height: 8),
        _GaugeCard(
          label: 'Conducción continua',
          value: ch,
          max: maxContinuous,
          progress: chProgress,
          unit: 'h',
          color: ch >= 8 ? AppColors.riesgo : AppColors.apto,
          note: 'Límite reglamentario: ${maxContinuous.toInt()} h',
        ),
        const SizedBox(height: 10),
        _GaugeCard(
          label: 'Descanso acumulado',
          value: rh,
          max: minRest,
          progress: rhProgress,
          unit: 'h',
          color: rh >= minRest ? AppColors.apto : AppColors.riesgo,
          note: 'Mínimo recomendado: ${minRest.toInt()} h',
        ),

        const SizedBox(height: 18),

        // ── Sección: reputación ───────────────────────────────
        const _SectionHeader(label: 'Reputación'),
        const SizedBox(height: 8),
        _ReputationCard(score: rep),

        const SizedBox(height: 18),

        // ── Normativa vigente ─────────────────────────────────
        const _NormCard(),
      ],
    );
  }
}

// ── Banner de estado (sobrio, sin fondo a color) ────────────────────
class _StatusBanner extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String title;
  final String subtitle;

  const _StatusBanner({
    required this.color,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.08),
              border: Border.all(color: color.withValues(alpha: 0.25)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 7, height: 7,
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(title,
                          style: AppTheme.inter(
                            fontSize: 13, fontWeight: FontWeight.w700,
                            color: color, letterSpacing: 0.4)),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                Text(subtitle,
                    style: AppTheme.inter(
                      fontSize: 12, color: AppColors.ink6, height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Encabezado de sección ───────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(label.toUpperCase(),
        style: AppTheme.inter(
          fontSize: 10.5, fontWeight: FontWeight.w700,
          color: AppColors.ink5, letterSpacing: 0.8));
  }
}

// ── Tarjeta de indicador (gauge) ────────────────────────────────────
class _GaugeCard extends StatelessWidget {
  final String label;
  final double value;
  final double max;
  final double progress;
  final String unit;
  final Color color;
  final String note;

  const _GaugeCard({
    required this.label,
    required this.value,
    required this.max,
    required this.progress,
    required this.unit,
    required this.color,
    required this.note,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label,
                  style: AppTheme.inter(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: AppColors.ink8)),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(value.toStringAsFixed(1),
                      style: AppTheme.inter(
                        fontSize: 19, fontWeight: FontWeight.w700,
                        color: AppColors.ink9, tabular: true)),
                  const SizedBox(width: 3),
                  Text(unit,
                      style: AppTheme.inter(
                        fontSize: 12, fontWeight: FontWeight.w500,
                        color: AppColors.ink5)),
                  const SizedBox(width: 6),
                  Text('/ ${max.toStringAsFixed(0)} $unit',
                      style: AppTheme.inter(
                        fontSize: 11.5, color: AppColors.ink5, tabular: true)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: AppColors.ink1,
              color: color,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                width: 5, height: 5,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const SizedBox(width: 5),
              Text(note,
                  style: AppTheme.inter(fontSize: 11, color: AppColors.ink5)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta de reputación ───────────────────────────────────────────
class _ReputationCard extends StatelessWidget {
  final int score;
  const _ReputationCard({required this.score});

  Color get _color {
    if (score >= 80) return AppColors.apto;
    if (score >= 50) return AppColors.riesgo;
    return AppColors.noApto;
  }

  String get _label {
    if (score >= 80) return 'EXCELENTE';
    if (score >= 60) return 'BUENA';
    if (score >= 40) return 'REGULAR';
    return 'BAJA';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Puntaje',
                      style: AppTheme.inter(
                        fontSize: 12, color: AppColors.ink5)),
                  const SizedBox(height: 2),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text('$score',
                          style: AppTheme.inter(
                            fontSize: 28, fontWeight: FontWeight.w700,
                            color: AppColors.ink9, tabular: true)),
                      const SizedBox(width: 4),
                      Text('/ 100',
                          style: AppTheme.inter(
                            fontSize: 13, color: AppColors.ink5, tabular: true)),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: _color.withValues(alpha: 0.4)),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        color: _color,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(_label,
                        style: AppTheme.inter(
                          fontSize: 9.5, fontWeight: FontWeight.w700,
                          color: _color, letterSpacing: 0.5)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: score / 100,
              minHeight: 6,
              backgroundColor: AppColors.ink1,
              color: _color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Normativa vigente ───────────────────────────────────────────────
class _NormCard extends StatelessWidget {
  const _NormCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.gavel_outlined, size: 16, color: AppColors.ink6),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: AppTheme.inter(
                    fontSize: 11.5, color: AppColors.ink6, height: 1.45),
                children: [
                  TextSpan(
                    text: 'D.S. 017-2009-MTC, Art. 233 — ',
                    style: AppTheme.inter(
                      fontSize: 11.5, fontWeight: FontWeight.w700,
                      color: AppColors.ink8, height: 1.45),
                  ),
                  const TextSpan(
                    text: 'máximo 10 h de conducción continua y mínimo 8 h '
                        'de descanso entre jornadas. El incumplimiento puede '
                        'derivar en sanción y suspensión.',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
