import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/public_api_service.dart';
import '../../data/models/public_vehicle_model.dart';

/// Vista pública de vehículo y conductor (RF-08).
/// Accesible sin autenticación — se navega desde el escáner QR o búsqueda por placa.
class VehiclePublicPage extends ConsumerStatefulWidget {
  final String plate;
  final String? qrJson;
  final bool? offlineVerified;

  const VehiclePublicPage({
    super.key,
    required this.plate,
    this.qrJson,
    this.offlineVerified,
  });

  @override
  ConsumerState<VehiclePublicPage> createState() => _VehiclePublicPageState();
}

class _VehiclePublicPageState extends ConsumerState<VehiclePublicPage> {
  final _api = PublicApiService();
  PublicVehicleModel? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = widget.qrJson != null
          ? await _api.getVehicleByQr(widget.qrJson!)
          : await _api.getVehicleByPlate(widget.plate);
      if (mounted) setState(() { _data = result; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Error al consultar el vehículo.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isCiudadano = authState.user?.role == 'ciudadano';

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text('Vehículo ${widget.plate}',
            style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700)),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null
              ? _ErrorView(message: _error!)
              : _data == null
                  ? const _EmptyView()
                  : _DataView(
                      data: _data!,
                      offlineVerified: widget.offlineVerified,
                      isCiudadano: isCiudadano,
                    ),
    );
  }
}

class _DataView extends StatelessWidget {
  final PublicVehicleModel data;
  final bool? offlineVerified;
  final bool isCiudadano;

  const _DataView({
    required this.data,
    this.offlineVerified,
    this.isCiudadano = false,
  });

  @override
  Widget build(BuildContext context) {
    final v = data.vehicle;
    final d = data.driver;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Badge de placa ───────────────────────────────────
          _PlateBadge(plate: v.plate),
          const SizedBox(height: 12),

          // ── Indicador visual de estado ──────────────────────
          _IndicatorBanner(indicator: v.indicator),
          const SizedBox(height: 12),

          // ── Validación QR ───────────────────────────────────
          if (offlineVerified != null || data.qrSignatureValid != null)
            _QrValidationBadge(
              offline: offlineVerified,
              server: data.qrSignatureValid,
            ),
          if (offlineVerified != null || data.qrSignatureValid != null)
            const SizedBox(height: 12),

          // ── Tarjeta de vehículo ──────────────────────────────
          _InfoCard(
            icon: Icons.directions_car,
            title: '${v.brand} ${v.model} ${v.year}',
            subtitle: _vehicleTypeLabel(v.vehicleTypeKey),
            children: [
              _InfoRow('Empresa', v.company ?? '—'),
              _InfoRow('Estado operativo', _statusLabel(v.status)),
              _InfoRow('Reputación', '${v.reputationScore}/100'),
            ],
          ),
          const SizedBox(height: 12),

          // ── Última inspección ────────────────────────────────
          _InspectionCard(status: v.lastInspectionStatus),
          const SizedBox(height: 12),

          // ── Tarjeta del conductor ────────────────────────────
          if (d != null)
            _InfoCard(
              icon: Icons.person,
              title: d.name,
              subtitle: 'Conductor asignado',
              children: [
                _InfoRow('Categoría de licencia', d.licenseCategory),
                _InfoRow('Estado de fatiga', _fatigueLabel(d.fatigueStatus)),
                _InfoRow('Reputación', '${d.reputationScore}/100'),
                _InfoRow('Habilitado', d.enabled ? 'Sí' : 'No'),
              ],
            )
          else
            const _InfoCard(
              icon: Icons.person_off,
              title: 'Sin conductor asignado',
              subtitle: 'Este vehículo no tiene conductor activo.',
              children: [],
            ),

          // ── Botón Reportar anomalía (solo ciudadano) ─────────
          if (isCiudadano) ...[
            const SizedBox(height: 20),
            _ReportarButton(vehicleId: v.id),
          ],
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  String _vehicleTypeLabel(String key) => switch (key) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos'  => 'Limpieza y residuos',
        'emergencia'         => 'Emergencia',
        'maquinaria'         => 'Maquinaria municipal',
        'municipal_general'  => 'Vehículo municipal',
        _ => key,
      };

  String _statusLabel(String s) => switch (s) {
        'disponible'        => 'Disponible',
        'en_ruta'           => 'En ruta',
        'en_mantenimiento'  => 'En mantenimiento',
        'fuera_de_servicio' => 'Fuera de servicio',
        _ => s,
      };

  String _fatigueLabel(String s) => switch (s) {
        'apto'    => 'Apto',
        'riesgo'  => 'En riesgo',
        'no_apto' => 'No apto',
        _ => s,
      };
}

// ── Badge de placa ─────────────────────────────────────────────────────────────
class _PlateBadge extends StatelessWidget {
  final String plate;
  const _PlateBadge({required this.plate});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.goldBorder, width: 2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            'PLACA',
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.goldDark,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            plate,
            style: GoogleFonts.sourceCodePro(
              fontSize: 34,
              fontWeight: FontWeight.w700,
              color: AppColors.panel,
              letterSpacing: 4,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta última inspección ──────────────────────────────────────────────────
class _InspectionCard extends StatelessWidget {
  final String status;
  const _InspectionCard({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border, label, icon) = switch (status) {
      'aprobada'  => (AppColors.apto,   AppColors.aptoBg,   AppColors.aptoBorder,
                      'Aprobada',        Icons.check_circle_outline),
      'observada' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder,
                      'Con observaciones', Icons.warning_amber_outlined),
      'rechazada' => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder,
                      'Rechazada',       Icons.cancel_outlined),
      _           => (AppColors.ink5,   AppColors.ink1,     AppColors.ink3,
                      'Sin inspección',  Icons.help_outline),
    };

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.goldBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.goldBorder),
                  ),
                  child: const Icon(Icons.assignment_outlined,
                      size: 18, color: AppColors.goldDark),
                ),
                const SizedBox(width: 10),
                Text('Última inspección',
                    style: AppTheme.inter(
                        fontSize: 14, fontWeight: FontWeight.w700,
                        color: AppColors.ink9)),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.ink2),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: bg,
                    shape: BoxShape.circle,
                    border: Border.all(color: border),
                  ),
                  child: Icon(icon, size: 16, color: color),
                ),
                const SizedBox(width: 10),
                Text(
                  label,
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Botón reportar anomalía ────────────────────────────────────────────────────
class _ReportarButton extends StatelessWidget {
  final String vehicleId;
  const _ReportarButton({required this.vehicleId});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () => context.push('/reportar?vehicleId=$vehicleId'),
      icon: const Icon(Icons.campaign_outlined, size: 18),
      label: const Text('Reportar anomalía'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.riesgo,
        side: const BorderSide(color: AppColors.riesgoBorder, width: 1.5),
        backgroundColor: AppColors.riesgoBg,
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: AppTheme.inter(fontSize: 14.5, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _IndicatorBanner extends StatelessWidget {
  final String indicator;
  const _IndicatorBanner({required this.indicator});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border, label, icon) = switch (indicator) {
      'verde'    => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder,
                     'Habilitado y en regla', Icons.check_circle_outline),
      'amarillo' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder,
                     'Con observaciones', Icons.warning_amber_outlined),
      _          => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder,
                     'Suspendido o no apto', Icons.block_outlined),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 10),
          Text(label, style: AppTheme.inter(
            fontSize: 14, fontWeight: FontWeight.w600, color: color,
          )),
        ],
      ),
    );
  }
}

class _QrValidationBadge extends StatelessWidget {
  final bool? offline;
  final bool? server;
  const _QrValidationBadge({this.offline, this.server});

  @override
  Widget build(BuildContext context) {
    final valid = (offline ?? true) && (server ?? true);
    final color = valid ? AppColors.apto : AppColors.noApto;
    final bg    = valid ? AppColors.aptoBg : AppColors.noAptoBg;
    final border= valid ? AppColors.aptoBorder : AppColors.noAptoBorder;
    final label = valid ? 'QR auténtico — firma verificada' : 'QR inválido — firma no coincide';
    final icon  = valid ? Icons.verified_outlined : Icons.gpp_bad_outlined;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bg, border: Border.all(color: border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Text(label, style: AppTheme.inter(fontSize: 12, color: color, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final List<Widget> children;

  const _InfoCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.goldBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.goldBorder),
                  ),
                  child: Icon(icon, size: 18, color: AppColors.goldDark),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTheme.inter(
                      fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink9,
                    )),
                    Text(subtitle, style: AppTheme.inter(
                      fontSize: 12, color: AppColors.ink5,
                    )),
                  ],
                ),
              ],
            ),
          ),
          if (children.isNotEmpty) ...[
            const Divider(height: 1, color: AppColors.ink2),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
              child: Column(children: children),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
          Text(value, style: AppTheme.inter(
            fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink8,
          )),
        ],
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.ink1,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.ink3),
              ),
              child: const Icon(Icons.directions_car_outlined,
                  size: 38, color: AppColors.ink4),
            ),
            const SizedBox(height: 20),
            Text(
              'Vehículo no encontrado',
              style: AppTheme.inter(
                  fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
            ),
            const SizedBox(height: 8),
            Text(
              'Este vehículo no está registrado en el sistema SFIT o la placa es incorrecta.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.noApto),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6)),
          ],
        ),
      ),
    );
  }
}
