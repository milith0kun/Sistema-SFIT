import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/location_tracking_service.dart';
import '../../data/datasources/trips_api_service.dart';

/// Pantalla de cierre de turno del conductor (RF-conductor).
///
/// Muestra el viaje activo y permite registrar el kilometraje de retorno
/// y observaciones antes de cerrar el turno.
class TripCheckoutPage extends ConsumerStatefulWidget {
  final String entryId;
  final String vehiclePlate;
  final String departureTime;
  final double? estimatedKm;

  const TripCheckoutPage({
    super.key,
    required this.entryId,
    required this.vehiclePlate,
    required this.departureTime,
    this.estimatedKm,
  });

  @override
  ConsumerState<TripCheckoutPage> createState() => _TripCheckoutPageState();
}

class _TripCheckoutPageState extends ConsumerState<TripCheckoutPage> {
  final _formKey = GlobalKey<FormState>();
  final _kmCtrl = TextEditingController();
  final _obsCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _kmCtrl.dispose();
    _obsCtrl.dispose();
    super.dispose();
  }

  String _formatDepartureTime() {
    final raw = widget.departureTime;
    // "HH:MM" format stored by FleetEntry
    if (RegExp(r'^\d{2}:\d{2}').hasMatch(raw)) return raw.substring(0, 5);
    try {
      final dt = DateTime.parse(raw).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return raw;
    }
  }

  String _formatNow() {
    final dt = DateTime.now();
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _cerrarTurno() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final km = double.parse(_kmCtrl.text.replaceAll(',', '.'));
      final svc = ref.read(tripsApiServiceProvider);
      await svc.closeFleetEntry(
        widget.entryId,
        km: km,
        returnTime: DateTime.now(),
        observations: _obsCtrl.text.trim().isEmpty ? null : _obsCtrl.text.trim(),
      );
      // Detener tracking GPS
      ref.read(locationTrackingProvider.notifier).stopTracking();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Turno cerrado correctamente'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        final msg = e.toString();
        final match = RegExp(r'"error"\s*:\s*"([^"]+)"').firstMatch(msg);
        final errorText = match?.group(1) ?? msg;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $errorText'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.noApto,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.ink9),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Cerrar turno',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Resumen del turno activo ──────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.panel,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TURNO ACTIVO',
                      style: AppTheme.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppColors.goldLight,
                        letterSpacing: 1.4,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.directions_car,
                          color: Colors.white,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          widget.vehiclePlate,
                          style: AppTheme.inter(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _InfoChip(
                          icon: Icons.play_circle_outline,
                          label: 'Salida',
                          value: _formatDepartureTime(),
                        ),
                        const SizedBox(width: 10),
                        _InfoChip(
                          icon: Icons.access_time,
                          label: 'Ahora',
                          value: _formatNow(),
                        ),
                        if (widget.estimatedKm != null) ...[
                          const SizedBox(width: 10),
                          _InfoChip(
                            icon: Icons.route_outlined,
                            label: 'Km est.',
                            value: '${widget.estimatedKm!.toStringAsFixed(0)} km',
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── Kilometraje al regreso ─────────────────────────────
              Text(
                'Kilometraje al regreso',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink7,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _kmCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                decoration: InputDecoration(
                  hintText: 'Ej. 125.5',
                  hintStyle: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
                  prefixIcon: const Icon(Icons.speed, color: AppColors.ink5),
                  suffixText: 'km',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.gold, width: 2),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 14,
                  ),
                ),
                style: AppTheme.inter(fontSize: 15, color: AppColors.ink9),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Ingresa el kilometraje';
                  final val = double.tryParse(v.replaceAll(',', '.'));
                  if (val == null || val < 0) return 'Valor inválido';
                  return null;
                },
              ),
              const SizedBox(height: 18),

              // ── Observaciones ──────────────────────────────────────
              Text(
                'Observaciones (opcional)',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink7,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _obsCtrl,
                minLines: 3,
                maxLines: 5,
                maxLength: 500,
                decoration: InputDecoration(
                  hintText: 'Incidencias, novedades del vehículo…',
                  hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.gold, width: 2),
                  ),
                  contentPadding: const EdgeInsets.all(14),
                ),
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
              ),
              const SizedBox(height: 28),

              // ── Botón cerrar turno ─────────────────────────────────
              FilledButton.icon(
                onPressed: _submitting ? null : _cerrarTurno,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.stop_circle_outlined, size: 20),
                label: Text(
                  _submitting ? 'Cerrando…' : 'Cerrar turno',
                  style: AppTheme.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.noApto,
                  disabledBackgroundColor: AppColors.ink2,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: Colors.white60),
              const SizedBox(width: 4),
              Text(
                label,
                style: AppTheme.inter(fontSize: 10, color: Colors.white60),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTheme.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
