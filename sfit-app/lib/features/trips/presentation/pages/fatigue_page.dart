import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/notification_service.dart';
import '../../data/datasources/trips_api_service.dart';

/// Estado de fatiga del conductor — RF-14.
/// Consume GET /conductor/fatiga para mostrar datos reales del backend.
class FatiguePage extends ConsumerStatefulWidget {
  const FatiguePage({super.key});

  @override
  ConsumerState<FatiguePage> createState() => _FatiguePageState();
}

class _FatiguePageState extends ConsumerState<FatiguePage> {
  FatigaStatus? _fatiga;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final svc = ref.read(tripsApiServiceProvider);
      final result = await svc.getFatigaStatus();
      if (mounted) {
        setState(() {
          _fatiga = result;
          _loading = false;
        });
        if (_fatiga != null && (_fatiga!.estado == 'riesgo' || _fatiga!.estado == 'no_apto')) {
          _triggerFatigaAlert(_fatiga!.estado);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _triggerFatigaAlert(String estado) async {
    try {
      final title = estado == 'no_apto'
          ? '⚠️ ALERTA: No apto para conducir'
          : '⚠️ Precaución: Fatiga detectada';
      final body = estado == 'no_apto'
          ? 'Tu nivel de fatiga es crítico. Detén el vehículo y descansa de inmediato.'
          : 'Tu nivel de fatiga está en zona de riesgo. Considera tomar un descanso.';
      await NotificationService.showNotification(
        title: title,
        body: body,
        payload: 'fatiga',
      );
    } catch (_) {}
  }

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

            // ── Contenido reactivo ───────────────────────────────
            if (_loading)
              const _LoadingState()
            else if (_error != null)
              _ErrorState(message: _error!, onRetry: _load)
            else if (_fatiga != null)
              _FatigaContent(fatiga: _fatiga!)
          ],
        ),
      ),
    );
  }
}

// ── Estado cargando ────────────────────────────────────────────────────────────

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 60),
        child: CircularProgressIndicator(),
      ),
    );
  }
}

// ── Estado error ───────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.noAptoBg,
        border: Border.all(color: AppColors.noAptoBorder),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          const Icon(Icons.warning_amber_rounded,
              size: 36, color: AppColors.noApto),
          const SizedBox(height: 10),
          Text(
            'No se pudo obtener el estado de fatiga',
            style: AppTheme.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.noApto,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Reintentar'),
          ),
        ],
      ),
    );
  }
}

// ── Contenido con datos reales ─────────────────────────────────────────────────

class _FatigaContent extends StatelessWidget {
  final FatigaStatus fatiga;

  const _FatigaContent({required this.fatiga});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Panel principal de estado ──────────────────────────
        _StatusPanel(estado: fatiga.estado),

        const SizedBox(height: 20),

        // ── Horas acumuladas ───────────────────────────────────
        _AccumulatedHoursCard(horasConduccion: fatiga.horasConduccion),

        const SizedBox(height: 16),

        // ── Descanso ───────────────────────────────────────────
        _RestCard(horasDescanso: fatiga.horasDescanso),

        const SizedBox(height: 24),

        // ── Última actualización ───────────────────────────────
        _UpdatedAtRow(iso: fatiga.ultimaActualizacion),
      ],
    );
  }
}

// ── Panel principal (APTO / PRECAUCIÓN / EN RIESGO / NO APTO) ─────────────────

class _StatusPanel extends StatelessWidget {
  final String estado;

  const _StatusPanel({required this.estado});

  @override
  Widget build(BuildContext context) {
    final Color statusColor;
    final Color statusBg;
    final Color statusBorder;
    final String statusLabel;
    final String statusDesc;
    final IconData statusIcon;

    switch (estado) {
      case 'no_apto':
        statusColor = AppColors.noApto;
        statusBg = AppColors.noAptoBg;
        statusBorder = AppColors.noAptoBorder;
        statusLabel = 'NO APTO';
        statusDesc =
            'Superaste el límite seguro de conducción. Detente y descansa de inmediato.';
        statusIcon = Icons.cancel_outlined;
        break;
      case 'riesgo':
        statusColor = AppColors.riesgo;
        statusBg = AppColors.riesgoBg;
        statusBorder = AppColors.riesgoBorder;
        statusLabel = 'EN RIESGO';
        statusDesc =
            'Acumulaste más de 4 horas de conducción. Planifica un descanso pronto.';
        statusIcon = Icons.warning_amber_rounded;
        break;
      case 'precaucion':
        statusColor = AppColors.riesgo;
        statusBg = AppColors.riesgoBg;
        statusBorder = AppColors.riesgoBorder;
        statusLabel = 'PRECAUCIÓN';
        statusDesc =
            'Llevas más de 2.5 horas manejando. Mantente alerta y reduce la velocidad.';
        statusIcon = Icons.info_outline;
        break;
      default: // apto
        statusColor = AppColors.apto;
        statusBg = AppColors.aptoBg;
        statusBorder = AppColors.aptoBorder;
        statusLabel = 'APTO';
        statusDesc =
            'Tu estado de conducción está dentro de los límites reglamentarios.';
        statusIcon = Icons.check_circle_outline;
    }

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
          Icon(statusIcon, size: 48, color: statusColor),
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

// ── Tarjeta: Horas acumuladas hoy ─────────────────────────────────────────────

class _AccumulatedHoursCard extends StatelessWidget {
  final double horasConduccion;

  const _AccumulatedHoursCard({required this.horasConduccion});

  @override
  Widget build(BuildContext context) {
    const double max = 8;
    final double progress = (horasConduccion / max).clamp(0.0, 1.0);

    // Color de la barra según nivel
    final Color barColor;
    if (horasConduccion >= 5) {
      barColor = AppColors.noApto;
    } else if (horasConduccion >= 2.5) {
      barColor = AppColors.riesgo;
    } else {
      barColor = AppColors.apto;
    }

    // Formatear horas y minutos
    final int horas = horasConduccion.floor();
    final int minutos = ((horasConduccion - horas) * 60).round();
    final String display =
        minutos > 0 ? '${horas}h ${minutos}m' : '${horas}h';

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
                display,
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
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
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

// ── Tarjeta: Descanso desde último cierre ─────────────────────────────────────

class _RestCard extends StatelessWidget {
  final double horasDescanso;

  const _RestCard({required this.horasDescanso});

  @override
  Widget build(BuildContext context) {
    final bool sinDatos = horasDescanso == 0;
    final int horas = horasDescanso.floor();
    final int minutos = ((horasDescanso - horas) * 60).round();
    final String display = sinDatos
        ? '—'
        : (minutos > 0 ? '${horas}h ${minutos}m' : '${horas}h');

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
            'DESCANSO DESDE ÚLTIMO CIERRE',
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink5,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            display,
            style: AppTheme.inter(
              fontSize: 40,
              fontWeight: FontWeight.w800,
              color: sinDatos ? AppColors.ink4 : AppColors.ink9,
              tabular: !sinDatos,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            sinDatos
                ? 'Sin viajes cerrados hoy'
                : 'Tiempo transcurrido desde el último cierre de ruta',
            style: AppTheme.inter(fontSize: 12, color: AppColors.ink4),
          ),
        ],
      ),
    );
  }
}

// ── Fila de última actualización ──────────────────────────────────────────────

class _UpdatedAtRow extends StatelessWidget {
  final String iso;

  const _UpdatedAtRow({required this.iso});

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.access_time, size: 13, color: AppColors.ink4),
        const SizedBox(width: 4),
        Text(
          'Actualizado a las ${_formatTime(iso)}',
          style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
        ),
      ],
    );
  }
}
