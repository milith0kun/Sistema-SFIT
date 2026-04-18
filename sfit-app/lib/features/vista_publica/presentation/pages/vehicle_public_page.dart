import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/public_api_service.dart';
import '../../data/models/public_vehicle_model.dart';

/// Vista pública de vehículo y conductor (RF-08).
/// Accesible sin autenticación — se navega desde el escáner QR o búsqueda por placa.
class VehiclePublicPage extends StatefulWidget {
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
  State<VehiclePublicPage> createState() => _VehiclePublicPageState();
}

class _VehiclePublicPageState extends State<VehiclePublicPage> {
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
              : _DataView(
                  data: _data!,
                  offlineVerified: widget.offlineVerified,
                ),
    );
  }
}

class _DataView extends StatelessWidget {
  final PublicVehicleModel data;
  final bool? offlineVerified;

  const _DataView({required this.data, this.offlineVerified});

  @override
  Widget build(BuildContext context) {
    final v = data.vehicle;
    final d = data.driver;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
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
            subtitle: v.plate,
            children: [
              _InfoRow('Tipo', _vehicleTypeLabel(v.vehicleTypeKey)),
              _InfoRow('Empresa', v.company ?? '—'),
              _InfoRow('Estado', _statusLabel(v.status)),
              _InfoRow('Última inspección', _inspectionLabel(v.lastInspectionStatus)),
              _InfoRow('Reputación', '${v.reputationScore}/100'),
            ],
          ),
          const SizedBox(height: 12),

          // ── Tarjeta del conductor ────────────────────────────
          if (d != null)
            _InfoCard(
              icon: Icons.person,
              title: d.name,
              subtitle: 'Conductor habilitado',
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

  String _inspectionLabel(String s) => switch (s) {
        'aprobada'  => 'Aprobada',
        'observada' => 'Con observaciones',
        'rechazada' => 'Rechazada',
        _ => 'Pendiente',
      };

  String _fatigueLabel(String s) => switch (s) {
        'apto'    => 'Apto',
        'riesgo'  => 'En riesgo',
        'no_apto' => 'No apto',
        _ => s,
      };
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
