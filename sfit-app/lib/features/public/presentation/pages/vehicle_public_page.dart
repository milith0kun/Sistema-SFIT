import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
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
    final role = authState.user?.role;
    final isCiudadano = role == 'ciudadano';
    final isFiscal = role == 'fiscal';

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        toolbarHeight: 60,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        shape: const Border(bottom: BorderSide(color: AppColors.ink2, width: 1)),
        leading: IconButton(
          tooltip: 'Volver',
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.ink9, size: 22),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Vehículo ${widget.plate}',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: _loading
          ? const SfitLoading.page(color: AppColors.gold)
          : _error != null
              ? _ErrorView(message: _error!)
              : _data == null
                  ? const _EmptyView()
                  : _DataView(
                      data: _data!,
                      offlineVerified: widget.offlineVerified,
                      isCiudadano: isCiudadano,
                      isFiscal: isFiscal,
                    ),
    );
  }
}

class _DataView extends StatelessWidget {
  final PublicVehicleModel data;
  final bool? offlineVerified;
  final bool isCiudadano;
  final bool isFiscal;

  const _DataView({
    required this.data,
    this.offlineVerified,
    this.isCiudadano = false,
    this.isFiscal = false,
  });

  @override
  Widget build(BuildContext context) {
    final v = data.vehicle;
    final d = data.driver;
    final initials = d != null && d.name.isNotEmpty
        ? d.name.trim().split(' ').where((e) => e.isNotEmpty).map((e) => e[0]).take(2).join().toUpperCase()
        : '';

    return SafeArea(
      bottom: true,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Badge de placa ───────────────────────────────────
            _PlateBadge(plate: v.plate),
            const SizedBox(height: 16),

            // ── Indicador visual de estado ──────────────────────
            _IndicatorBanner(indicator: v.indicator),
            const SizedBox(height: 16),

            // ── Validación QR ───────────────────────────────────
            if (offlineVerified != null || data.qrSignatureValid != null) ...[
              _QrValidationBadge(
                offline: offlineVerified,
                server: data.qrSignatureValid,
              ),
              const SizedBox(height: 16),
            ],

            // ── Tarjeta de vehículo ──────────────────────────────
            _InfoCard(
              icon: Icons.directions_car_rounded,
              title: '${v.brand} ${v.model} ${v.year}',
              subtitle: _vehicleTypeLabel(v.vehicleTypeKey),
              children: [
                _InfoRow('Empresa', v.company ?? '—'),
                _InfoRow('Estado operativo', null, valueWidget: _buildStatusBadge(v.status)),
                _ReputationRow(
                  score: v.reputationScore,
                  label: v.reputationLabel,
                ),
              ],
            ),
            const SizedBox(height: 16),

            // ── Última inspección ────────────────────────────────
            _InspectionCard(status: v.lastInspectionStatus),
            const SizedBox(height: 16),

            // ── Tarjeta del conductor ────────────────────────────
            if (d != null)
              _InfoCard(
                icon: Icons.person_rounded,
                title: d.name,
                subtitle: 'Conductor asignado',
                headerLeading: initials.isNotEmpty
                    ? Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.08),
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.primary.withOpacity(0.2), width: 1.5),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          initials,
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      )
                    : null,
                children: [
                  _InfoRow('Categoría de licencia', d.licenseCategory),
                  _InfoRow('Estado de fatiga', null, valueWidget: _buildFatigueBadge(d.fatigueStatus)),
                  _ReputationRow(
                    score: d.reputationScore,
                    label: d.reputationLabel,
                  ),
                  _InfoRow('Habilitado', null, valueWidget: _buildEnabledBadge(d.enabled)),
                ],
              )
            else
              _InfoCard(
                icon: Icons.person_off_rounded,
                title: 'Sin conductor activo',
                subtitle: 'Este vehículo no tiene conductor asignado.',
                headerLeading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppColors.ink1,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.person_off_rounded, size: 18, color: AppColors.ink4),
                ),
                children: const [],
              ),

            // ── Botón Reportar anomalía (solo ciudadano) ─────────
            if (isCiudadano) ...[
              const SizedBox(height: 24),
              _ReportarButton(vehicle: v),
            ],
            // ── Botón Suspender (solo fiscal) ─────────────────────
            if (isFiscal && v.status != 'fuera_de_servicio') ...[
              const SizedBox(height: 24),
              _SuspendButton(vehicleId: v.id, plate: v.plate),
            ],
          ],
        ),
      ),
    );
  }

  String _vehicleTypeLabel(String key) => switch (key) {
        'transporte_urbano'          => 'Transporte urbano',
        'transporte_interprovincial' => 'Transporte interprovincial',
        _ => key,
      };

  Widget _buildStatusBadge(String status) {
    final (color, bg, label) = switch (status) {
      'disponible'        => (AppColors.apto, AppColors.aptoBg, 'Disponible'),
      'en_ruta'           => (AppColors.info, AppColors.infoBg, 'En Ruta'),
      'en_mantenimiento'  => (AppColors.riesgo, AppColors.riesgoBg, 'Mantenimiento'),
      'fuera_de_servicio' => (AppColors.noApto, AppColors.noAptoBg, 'Fuera de Servicio'),
      _ => (AppColors.ink5, AppColors.ink1, status),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildFatigueBadge(String status) {
    final (color, bg, label) = switch (status) {
      'apto'    => (AppColors.apto, AppColors.aptoBg, 'Apto'),
      'riesgo'  => (AppColors.riesgo, AppColors.riesgoBg, 'En Riesgo'),
      'no_apto' => (AppColors.noApto, AppColors.noAptoBg, 'No Apto'),
      _ => (AppColors.ink5, AppColors.ink1, status),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildEnabledBadge(bool enabled) {
    final color = enabled ? AppColors.apto : AppColors.noApto;
    final bg = enabled ? AppColors.aptoBg : AppColors.noAptoBg;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Text(
        enabled ? 'Habilitado' : 'Inhabilitado',
        style: AppTheme.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

// ── Badge de placa (Diseño de Placa Física Oficial Peruana Premium) ──────────
class _PlateBadge extends StatelessWidget {
  final String plate;
  const _PlateBadge({required this.plate});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: AppColors.ink2, width: 1.5),
      ),
      child: Column(
        children: [
          // Franja Superior "PERÚ" que emula la placa de rodaje nacional
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: const BoxDecoration(
              color: AppColors.panel,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(10.5),
                topRight: Radius.circular(10.5),
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              'PERÚ',
              style: AppTheme.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 4,
              ),
            ),
          ),
          // Cuerpo de la Placa
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Column(
              children: [
                Text(
                  plate.toUpperCase(),
                  style: GoogleFonts.sourceCodePro(
                    fontSize: 36,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                    letterSpacing: 6,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'FISCALIZACIÓN DE TRANSPORTE',
                  style: AppTheme.inter(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                    letterSpacing: 1.5,
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

// ── Tarjeta última inspección (Estilo Check-List de Reporte Premium) ─────────
class _InspectionCard extends StatelessWidget {
  final String status;
  const _InspectionCard({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border, label, icon) = switch (status) {
      'aprobada'  => (AppColors.apto,   AppColors.aptoBg,   AppColors.aptoBorder,
                      'Aprobada y Vigente', Icons.check_circle_rounded),
      'observada' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder,
                      'Con Observaciones', Icons.warning_rounded),
      'rechazada' => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder,
                      'Rechazada / Inhabilitante', Icons.cancel_rounded),
      _           => (AppColors.ink5,   AppColors.ink1,     AppColors.ink3,
                      'Sin Registro de Inspección', Icons.help_outline_rounded),
    };

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: AppColors.ink1, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.assignment_rounded,
                      size: 18, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Text(
                  'Última Inspección Técnica',
                  style: AppTheme.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.ink1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: border, width: 1.2),
              ),
              child: Row(
                children: [
                  Icon(icon, size: 18, color: color),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      style: AppTheme.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                    ),
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

// ── Botón reportar anomalía (Ciudadano) ──────────────────────────────────────
class _ReportarButton extends StatelessWidget {
  final PublicVehicle vehicle;
  const _ReportarButton({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () => context.push('/reportar', extra: {
        'plate': vehicle.plate,
        'vehicleTypeKey': vehicle.vehicleTypeKey,
        'brand': vehicle.brand,
        'model': vehicle.model,
        'status': vehicle.status,
      }),
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

// ── Botón suspender vehículo (Fiscal) ────────────────────────────────────────
class _SuspendButton extends ConsumerWidget {
  final String vehicleId;
  final String plate;
  const _SuspendButton({required this.vehicleId, required this.plate});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OutlinedButton.icon(
      onPressed: () => _openDialog(context, ref),
      icon: const Icon(Icons.block_outlined, size: 18),
      label: const Text('Suspender vehículo'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.noApto,
        side: const BorderSide(color: AppColors.noAptoBorder, width: 1.5),
        backgroundColor: AppColors.noAptoBg,
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: AppTheme.inter(fontSize: 14.5, fontWeight: FontWeight.w600),
      ),
    );
  }

  Future<void> _openDialog(BuildContext context, WidgetRef ref) async {
    final reasonCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool submitting = false;

    await showDialog<void>(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text('Suspender $plate'),
          content: Form(
            key: formKey,
            child: TextFormField(
              controller: reasonCtrl,
              minLines: 3,
              maxLines: 5,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'Motivo (mínimo 5 caracteres)',
                border: OutlineInputBorder(),
              ),
              validator: (v) {
                final trimmed = v?.trim() ?? '';
                if (trimmed.length < 5) return 'Mínimo 5 caracteres';
                return null;
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.of(ctx).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: submitting
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setState(() => submitting = true);
                      try {
                        final dio = ref.read(dioClientProvider).dio;
                        final resp = await dio.patch(
                          '/vehiculos/$vehicleId/suspender',
                          data: {'reason': reasonCtrl.text.trim()},
                        );
                        final ok = (resp.data as Map?)?['success'] == true;
                        if (!ctx.mounted) return;
                        Navigator.of(ctx).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              ok
                                  ? 'Vehículo $plate suspendido.'
                                  : 'No se pudo suspender.',
                            ),
                          ),
                        );
                      } on DioException catch (e) {
                        if (!ctx.mounted) return;
                        final msg = (e.response?.data as Map?)?['error']
                                ?.toString() ??
                            'Error de red';
                        setState(() => submitting = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(msg)),
                        );
                      }
                    },
              child: submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: SfitLoading.inline(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Confirmar'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Indicador visual de estado (Píldora Premium) ─────────────────────────────
class _IndicatorBanner extends StatelessWidget {
  final String indicator;
  const _IndicatorBanner({required this.indicator});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border, label, icon) = switch (indicator) {
      'verde'    => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder,
                     'Vehículo habilitado y en regla', Icons.verified_rounded),
      'amarillo' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder,
                     'Vehículo con observaciones', Icons.warning_rounded),
      _          => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder,
                     'Vehículo no autorizado / suspendido', Icons.gpp_bad_rounded),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: AppTheme.inter(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Certificado de Autenticidad QR (Criptografía y Firma Digital) ─────────────
class _QrValidationBadge extends StatelessWidget {
  final bool? offline;
  final bool? server;
  const _QrValidationBadge({this.offline, this.server});

  @override
  Widget build(BuildContext context) {
    final bool valid;
    if (server != null) {
      valid = server!;
    } else {
      valid = offline ?? true;
    }

    final color = valid ? AppColors.apto : AppColors.noApto;
    final bg    = valid ? AppColors.aptoBg : AppColors.noAptoBg;
    final border= valid ? AppColors.aptoBorder : AppColors.noAptoBorder;
    final title = valid ? 'Firma Digital Auténtica' : 'Firma Inválida o Alterada';
    final subtitle = valid
        ? 'Este código QR ha sido verificado criptográficamente y pertenece al registro oficial.'
        : 'La firma del código QR no coincide con la clave institucional. El QR podría ser falso.';
    final icon  = valid ? Icons.shield_outlined : Icons.gpp_bad_outlined;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Text(
                title,
                style: AppTheme.inter(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
              const Spacer(),
              Text(
                server != null ? 'ONLINE' : 'OFFLINE',
                style: GoogleFonts.sourceCodePro(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: color.withOpacity(0.8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: AppTheme.inter(
              fontSize: 12,
              color: color.withOpacity(0.85),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.5),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'HMAC-SHA256 INTEGRITY CHECK',
                  style: GoogleFonts.sourceCodePro(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w600,
                    color: color.withOpacity(0.7),
                  ),
                ),
                Icon(
                  valid ? Icons.lock_outline_rounded : Icons.lock_open_rounded,
                  size: 11,
                  color: color.withOpacity(0.7),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta de información modular (_InfoCard) ───────────────────────────────
class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget? headerLeading;

  const _InfoCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.children,
    this.headerLeading,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: AppColors.ink1, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                headerLeading ??
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(icon, size: 18, color: AppColors.primary),
                    ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTheme.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: AppTheme.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.ink5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (children.isNotEmpty) ...[
            const Divider(height: 1, color: AppColors.ink1),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                children: children.map((child) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: child,
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Fila de reputación con estrellas (RF-15) ─────────────────────────────────
class _ReputationRow extends StatelessWidget {
  final int score;
  final String label;

  const _ReputationRow({required this.score, required this.label});

  Color get _color {
    if (score >= 80) return AppColors.apto;
    if (score >= 60) return AppColors.apto;
    if (score >= 40) return AppColors.riesgo;
    return AppColors.noApto;
  }

  int get _stars => (score / 20).round().clamp(0, 5);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Reputación',
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink5, fontWeight: FontWeight.w500),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(5, (i) {
                  return Icon(
                    i < _stars ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 15,
                    color: i < _stars ? _color : AppColors.ink3,
                  );
                }),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: _color,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Fila de información estándar ─────────────────────────────────────────────
class _InfoRow extends StatelessWidget {
  final String label;
  final String? value;
  final Widget? valueWidget;

  const _InfoRow(this.label, this.value, {this.valueWidget});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink5, fontWeight: FontWeight.w500),
          ),
          valueWidget ??
              Text(
                value ?? '',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink8,
                ),
              ),
        ],
      ),
    );
  }
}

// ── Vista de vacío (Vehículo no encontrado) ──────────────────────────────────
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

// ── Vista de Error ───────────────────────────────────────────────────────────
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
