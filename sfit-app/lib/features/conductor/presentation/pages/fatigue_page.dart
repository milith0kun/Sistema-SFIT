import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

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
      final user = ref.read(authProvider).user;
      if (user == null) { setState(() => _loading = false); return; }
      final dio = ref.read(dioClientProvider).dio;
      // Busca el conductor asociado al usuario por DNI
      final resp = await dio.get('/conductores', queryParameters: {'limit': 100});
      final data = (resp.data as Map)['data'] as Map;
      final items = (data['items'] as List)
          .map((e) => e as Map<String, dynamic>)
          .toList();
      // Si hay items, toma el primero (la empresa del operador filtra por municipalidad)
      // Para conductores mostramos el que coincida con el nombre del usuario
      Map<String, dynamic>? found;
      for (final d in items) {
        if ((d['name'] as String? ?? '').toLowerCase().contains(
            user.name.split(' ').first.toLowerCase())) {
          found = d;
          break;
        }
      }
      found ??= items.isNotEmpty ? items.first : null;
      if (mounted) setState(() { _driver = found; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline,
                            color: AppColors.noApto, size: 32),
                        const SizedBox(height: 8),
                        TextButton(
                            onPressed: _load, child: const Text('Reintentar')),
                      ],
                    ),
                  )
                : _driver == null
                    ? Center(
                        child: Text('No se encontró registro de conductor.',
                            style: AppTheme.inter(fontSize: 14, color: AppColors.ink4)),
                      )
                    : _FatigueBody(driver: _driver!),
      ),
    );
  }
}

class _FatigueBody extends StatelessWidget {
  final Map<String, dynamic> driver;
  const _FatigueBody({required this.driver});

  @override
  Widget build(BuildContext context) {
    final status = driver['status'] as String? ?? 'apto';
    final ch = (driver['continuousHours'] as num?)?.toDouble() ?? 0;
    final rh = (driver['restHours'] as num?)?.toDouble() ?? 0;
    final rep = (driver['reputationScore'] as num?)?.toInt() ?? 100;

    final (statusColor, statusBg, statusIcon, statusLabel, statusDesc) = switch (status) {
      'apto' => (
          AppColors.apto, AppColors.aptoBg,
          Icons.check_circle_outline,
          'APTO PARA CONDUCIR',
          'Tus indicadores de fatiga están dentro de los límites seguros.'
        ),
      'riesgo' => (
          AppColors.riesgo, AppColors.riesgoBg,
          Icons.warning_amber_outlined,
          'EN ZONA DE RIESGO',
          'Has acumulado muchas horas. Programa descanso adicional.'
        ),
      _ => (
          AppColors.noApto, AppColors.noAptoBg,
          Icons.cancel_outlined,
          'NO APTO — DESCANSO REQUERIDO',
          'Has superado el límite reglamentario. No conduzcas hasta descansar.'
        ),
    };

    // Límite reglamentario: 10h continuas, mínimo 8h descanso
    const maxContinuous = 10.0;
    const minRest = 8.0;
    final chProgress = (ch / maxContinuous).clamp(0.0, 1.0);
    final rhProgress = (rh / minRest).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Estado principal ─────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: statusBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: statusColor.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              Icon(statusIcon, size: 48, color: statusColor),
              const SizedBox(height: 12),
              Text(statusLabel,
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(
                    fontSize: 16, fontWeight: FontWeight.w800,
                    color: statusColor, letterSpacing: 0.5)),
              const SizedBox(height: 6),
              Text(statusDesc,
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(fontSize: 13, color: statusColor)),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // ── Horas continuas ──────────────────────────────────────
        _GaugeCard(
          label: 'Horas de conducción continua',
          value: ch,
          max: maxContinuous,
          progress: chProgress,
          unit: 'h',
          color: ch >= 8 ? AppColors.riesgo : AppColors.apto,
          note: 'Límite reglamentario: ${maxContinuous.toInt()}h',
        ),
        const SizedBox(height: 12),

        // ── Horas de descanso ────────────────────────────────────
        _GaugeCard(
          label: 'Horas de descanso acumulado',
          value: rh,
          max: minRest,
          progress: rhProgress,
          unit: 'h',
          color: rh >= minRest ? AppColors.apto : AppColors.riesgo,
          note: 'Mínimo recomendado: ${minRest.toInt()}h',
        ),
        const SizedBox(height: 20),

        // ── Reputación ───────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.ink1),
          ),
          child: Row(
            children: [
              const Icon(Icons.star_rounded, color: AppColors.gold, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Reputación',
                        style: AppTheme.inter(
                          fontSize: 12, fontWeight: FontWeight.w600,
                          color: AppColors.ink5)),
                    Text('$rep / 100',
                        style: AppTheme.inter(
                          fontSize: 22, fontWeight: FontWeight.w800,
                          color: AppColors.ink9)),
                  ],
                ),
              ),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 80,
                  height: 8,
                  child: LinearProgressIndicator(
                    value: rep / 100,
                    backgroundColor: AppColors.ink1,
                    color: rep >= 80
                        ? AppColors.apto
                        : rep >= 60
                            ? AppColors.riesgo
                            : AppColors.noApto,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── Normativa vigente ────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.goldBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.goldBorder),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline, size: 18, color: AppColors.goldDark),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'D.S. 017-2009-MTC Art. 233: máximo 10h de conducción continua, '
                  'mínimo 8h de descanso entre jornadas. Incumplir puede acarrear sanción.',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.goldDark),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label,
                  style: AppTheme.inter(
                    fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink7)),
              Text('${value.toStringAsFixed(1)} $unit',
                  style: AppTheme.inter(
                    fontSize: 18, fontWeight: FontWeight.w800, color: color)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: AppColors.ink1,
              color: color,
            ),
          ),
          const SizedBox(height: 6),
          Text(note,
              style: AppTheme.inter(fontSize: 11, color: AppColors.ink4)),
        ],
      ),
    );
  }
}
