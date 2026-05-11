import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/location_tracking_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Card semafórico que reporta la salud del tracking GPS al conductor.
///
/// Comportamiento por estado:
/// - **Silencioso** (no se renderiza): tracking apagado o todo va bien
///   (cola baja, sin fallos consecutivos, último envío hace <60s).
/// - **Ámbar**: cola >= 50 pings OR fallos consecutivos >= 3 OR último
///   envío hace >2min. Muestra el contador grande de pings pendientes
///   con CTA "Forzar envío" → `flushQueue()`.
/// - **Rojo**: tracking activo pero no hay pings en >5min. Algo se
///   detuvo (Doze, permisos, OEM, GPS apagado). CTA "Revisar permisos".
///
/// Long-press → abre `/conductor/diagnostico-tracking` con todos los
/// counters técnicos. El conductor diario solo ve el estado; soporte
/// puede entrar al detalle para post-mortem.
///
/// Por qué silencioso por default: si la app se ve "ruidosa" con
/// indicadores constantes, el conductor los ignora cuando son críticos.
/// El card aparece cuando hay un problema accionable.
class TrackingHealthCard extends ConsumerWidget {
  const TrackingHealthCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(locationTrackingProvider);
    final status = _resolveStatus(s);
    if (status == _Status.silent) return const SizedBox.shrink();

    final theme = _themeFor(status);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: GestureDetector(
        onLongPress: () => context.push('/conductor/diagnostico-tracking'),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: theme.bg,
            border: Border.all(color: theme.border, width: 1.5),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: theme.color.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Icon(theme.icon, color: theme.color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      theme.title,
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: theme.color,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _bodyText(status, s),
                      style: AppTheme.inter(
                        fontSize: 12,
                        color: AppColors.ink7,
                        height: 1.4,
                      ),
                    ),
                    if (status == _Status.amber || status == _Status.red) ...[
                      const SizedBox(height: 10),
                      _CtaRow(status: status, ref: ref, context: context),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Resolución de estado ────────────────────────────────────────────
  _Status _resolveStatus(TrackingState s) {
    if (!s.isTracking) return _Status.silent;
    final now = DateTime.now();
    final lastSend = s.lastSuccessfulSend;
    final lastDelta = lastSend == null
        ? const Duration(days: 365)
        : now.difference(lastSend);

    // Rojo: turno activo pero llevamos demasiado sin reportar pings.
    // Probable causa: Doze mode, OEM mató el servicio, permisos revocados.
    if (lastDelta > const Duration(minutes: 5)) return _Status.red;

    // Ámbar: hay cola creciendo o el último envío ya rebasó 2 min, o
    // llevamos 3+ fallos seguidos. Aún recuperable, pero el conductor
    // debe saber.
    if (s.queuedPoints >= 50 ||
        s.consecutiveFailures >= 3 ||
        lastDelta > const Duration(minutes: 2)) {
      return _Status.amber;
    }
    return _Status.silent;
  }

  String _bodyText(_Status status, TrackingState s) {
    final lastSend = s.lastSuccessfulSend;
    switch (status) {
      case _Status.amber:
        return '${s.queuedPoints} pings pendientes de subir. '
            'Se enviarán automáticamente al recuperar señal.';
      case _Status.red:
        final mins = lastSend == null
            ? null
            : DateTime.now().difference(lastSend).inMinutes;
        return 'No se ha registrado tu posición '
            '${mins != null ? "hace $mins min" : "recientemente"}. '
            'Verifica permisos de ubicación, batería y conexión.';
      case _Status.silent:
        return '';
    }
  }

  _CardTheme _themeFor(_Status s) {
    switch (s) {
      case _Status.amber:
        return const _CardTheme(
          title: 'Sincronizando tracking',
          color: AppColors.riesgo,
          bg: AppColors.riesgoBg,
          border: AppColors.riesgoBorder,
          icon: Icons.cloud_sync_outlined,
        );
      case _Status.red:
        return const _CardTheme(
          title: 'Tracking detenido',
          color: AppColors.noApto,
          bg: AppColors.noAptoBg,
          border: AppColors.noAptoBorder,
          icon: Icons.gps_off_rounded,
        );
      case _Status.silent:
        return const _CardTheme(
          title: '',
          color: AppColors.ink6,
          bg: AppColors.ink1,
          border: AppColors.ink2,
          icon: Icons.gps_fixed,
        );
    }
  }
}

enum _Status { silent, amber, red }

class _CardTheme {
  final String title;
  final Color color;
  final Color bg;
  final Color border;
  final IconData icon;
  const _CardTheme({
    required this.title,
    required this.color,
    required this.bg,
    required this.border,
    required this.icon,
  });
}

class _CtaRow extends StatelessWidget {
  final _Status status;
  final WidgetRef ref;
  final BuildContext context;
  const _CtaRow({
    required this.status,
    required this.ref,
    required this.context,
  });

  @override
  Widget build(BuildContext _) {
    if (status == _Status.amber) {
      return Row(children: [
        OutlinedButton.icon(
          onPressed: () async {
            await ref.read(locationTrackingProvider.notifier).flushQueue();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Forzando envío de pings pendientes…'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          icon: const Icon(Icons.upload, size: 16),
          label: const Text('Forzar envío'),
          style: OutlinedButton.styleFrom(
            visualDensity: VisualDensity.compact,
            foregroundColor: AppColors.riesgo,
            side: const BorderSide(color: AppColors.riesgoBorder),
          ),
        ),
      ]);
    }
    // Rojo: la causa más probable es permisos / battery — mandamos al
    // usuario a la pantalla de diagnóstico que tiene los CTAs reales
    // (revisar batería, abrir settings GPS, ver últimos errores).
    return Row(children: [
      OutlinedButton.icon(
        onPressed: () => context.push('/conductor/diagnostico-tracking'),
        icon: const Icon(Icons.troubleshoot, size: 16),
        label: const Text('Revisar'),
        style: OutlinedButton.styleFrom(
          visualDensity: VisualDensity.compact,
          foregroundColor: AppColors.noApto,
          side: const BorderSide(color: AppColors.noAptoBorder),
        ),
      ),
    ]);
  }
}
