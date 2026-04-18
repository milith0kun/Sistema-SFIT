import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Estado de fatiga del conductor — RF-14.
/// FatigueEngine aún no implementado en backend; muestra estado placeholder.
class FatiguePage extends StatelessWidget {
  const FatiguePage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────
            Text(
              'Estado de fatiga',
              style: AppTheme.inter(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Monitoreo de conducción segura',
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
            ),

            const SizedBox(height: 20),

            // ── Panel principal de estado ────────────────────────
            _StatusPanel(),

            const SizedBox(height: 20),

            // ── Horas acumuladas ─────────────────────────────────
            _AccumulatedHoursCard(),

            const SizedBox(height: 16),

            // ── Descanso restante ────────────────────────────────
            _RestCard(),

            const SizedBox(height: 24),

            // ── Aviso de disponibilidad futura ───────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.ink1,
                border: Border.all(color: AppColors.ink2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline,
                      size: 18, color: AppColors.ink4),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'El cálculo automático de fatiga estará disponible en la próxima versión.',
                      style: AppTheme.inter(
                          fontSize: 12, color: AppColors.ink5),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Panel principal (APTO / EN RIESGO / NO APTO) ───────────────────────────
class _StatusPanel extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Estado por defecto: APTO
    const statusColor = AppColors.apto;
    const statusBg = AppColors.aptoBg;
    const statusBorder = AppColors.aptoBorder;
    const statusLabel = 'APTO';
    const statusDesc =
        'Tu estado de conducción está dentro de los límites reglamentarios.';
    const statusIcon = Icons.check_circle_outline;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: statusBg,
        border: Border.all(color: statusBorder, width: 1.5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          const Icon(statusIcon, size: 48, color: statusColor),
          const SizedBox(height: 12),
          Text(
            statusLabel,
            style: AppTheme.inter(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: statusColor,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            statusDesc,
            textAlign: TextAlign.center,
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta: Horas acumuladas hoy ──────────────────────────────────────────
class _AccumulatedHoursCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Placeholder: 0 de 8 horas
    const double current = 0;
    const double max = 8;
    final double progress = current / max;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'HORAS ACUMULADAS HOY',
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink5,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                '${current.toStringAsFixed(0)}h',
                style: AppTheme.inter(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink9,
                  tabular: true,
                ),
              ),
              Text(
                ' / ${max.toStringAsFixed(0)}h',
                style: AppTheme.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                  color: AppColors.ink4,
                  tabular: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: AppColors.ink2,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.apto),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Límite reglamentario: 8 horas continuas',
            style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta: Descanso restante ─────────────────────────────────────────────
class _RestCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DESCANSO RESTANTE',
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink5,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '—',
            style: AppTheme.inter(
              fontSize: 40,
              fontWeight: FontWeight.w800,
              color: AppColors.ink4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Datos de descanso no disponibles aún',
            style: AppTheme.inter(fontSize: 12, color: AppColors.ink4),
          ),
        ],
      ),
    );
  }
}
