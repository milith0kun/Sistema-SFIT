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
      if (mounted) {
        setState(() {
          _data = result;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Error al consultar el vehículo.';
          _loading = false;
        });
      }
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
        ? d.name
            .trim()
            .split(' ')
            .where((e) => e.isNotEmpty)
            .map((e) => e[0])
            .take(2)
            .join()
            .toUpperCase()
        : '';

    return SafeArea(
      bottom: true,
      child: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── 1. Placa de Rodaje con Sello de Estado (Animación de entrada) ────
            _FadeInSlideUp(
              delay: const Duration(milliseconds: 100),
              child: _PlateBadge(plate: v.plate, indicator: v.indicator),
            ),
            const SizedBox(height: 20),

            // ── 2. Validación QR Compacta e Interactiva ─────────────────────────
            if (offlineVerified != null || data.qrSignatureValid != null) ...[
              _FadeInSlideUp(
                delay: const Duration(milliseconds: 220),
                child: _QrValidationBadge(
                  offline: offlineVerified,
                  server: data.qrSignatureValid,
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── 3. Tarjeta Consolidada de Información de Vehículo y TUC ──────────
            _FadeInSlideUp(
              delay: const Duration(milliseconds: 340),
              child: _InfoCard(
                icon: Icons.directions_car_rounded,
                title: '${v.brand} ${v.model} ${v.year}',
                subtitle: _vehicleTypeLabel(v.vehicleTypeKey),
                children: [
                  _InfoRow('Empresa', v.company ?? '—'),
                  _InfoRow('Estado operativo', null,
                      valueWidget: _buildStatusBadge(v.status)),
                  _InspectionRow(status: v.lastInspectionStatus),
                  _ReputationRow(
                    score: v.reputationScore,
                    label: v.reputationLabel,
                  ),
                  if (d == null) ...[
                    const Divider(height: 20, color: AppColors.ink1),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(5),
                            decoration: BoxDecoration(
                              color: AppColors.ink1,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.person_off_rounded,
                                size: 14, color: AppColors.ink4),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Sin conductor activo asignado',
                            style: AppTheme.inter(
                              fontSize: 12.5,
                              color: AppColors.ink5,
                              fontWeight: FontWeight.w600,
                            ).copyWith(fontStyle: FontStyle.italic),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // ── 4. Tarjeta del Conductor Asignado (Solo si existe) ───────────────
            if (d != null) ...[
              const SizedBox(height: 16),
              _FadeInSlideUp(
                delay: const Duration(milliseconds: 460),
                child: _InfoCard(
                  icon: Icons.person_rounded,
                  title: d.name,
                  subtitle: 'Conductor asignado',
                  headerLeading: initials.isNotEmpty
                      ? Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppColors.primary.withOpacity(0.08),
                                AppColors.primary.withOpacity(0.03),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: AppColors.primary.withOpacity(0.2),
                                width: 1.5),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            initials,
                            style: AppTheme.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primary,
                            ),
                          ),
                        )
                      : null,
                  children: [
                    _InfoRow('Categoría de licencia', d.licenseCategory),
                    _InfoRow('Estado de fatiga', null,
                        valueWidget: _buildFatigueBadge(d.fatigueStatus)),
                    _ReputationRow(
                      score: d.reputationScore,
                      label: d.reputationLabel,
                    ),
                    _InfoRow('Habilitado', null,
                        valueWidget: _buildEnabledBadge(d.enabled)),
                  ],
                ),
              ),
            ],

            // ── 5. Botones de Acción (Ciudadano / Fiscal) ────────────────────────
            if (isCiudadano) ...[
              const SizedBox(height: 24),
              _FadeInSlideUp(
                delay: const Duration(milliseconds: 580),
                child: _ReportarButton(vehicle: v),
              ),
            ],
            if (isFiscal && v.status != 'fuera_de_servicio') ...[
              const SizedBox(height: 24),
              _FadeInSlideUp(
                delay: const Duration(milliseconds: 580),
                child: _SuspendButton(vehicleId: v.id, plate: v.plate),
              ),
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

// ── Animación de Entrada personalizada (Micro-interacción premium) ───────────
class _FadeInSlideUp extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const _FadeInSlideUp({required this.child, this.delay = Duration.zero});

  @override
  State<_FadeInSlideUp> createState() => _FadeInSlideUpState();
}

class _FadeInSlideUpState extends State<_FadeInSlideUp>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));

    Future.delayed(widget.delay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SlideTransition(
        position: _slideAnimation,
        child: widget.child,
      ),
    );
  }
}

// ── Sello de Estado Holográfico / Oficial que emula stickers reales ──────────
class _StatusSeal extends StatelessWidget {
  final String indicator;

  const _StatusSeal({required this.indicator});

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (indicator) {
      'verde'    => (AppColors.apto, 'APTO\nSFIT', Icons.verified_user_rounded),
      'amarillo' => (AppColors.riesgo, 'OBSERVADO\nSFIT', Icons.warning_amber_rounded),
      _          => (AppColors.noApto, 'SUSPENDIDO\nSFIT', Icons.gpp_bad_rounded),
    };

    return Container(
      width: 66,
      height: 66,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            color.withOpacity(0.95),
            color,
            color.withOpacity(0.75),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.35),
            blurRadius: 8,
            spreadRadius: 1,
            offset: const Offset(1, 2),
          ),
        ],
        border: Border.all(color: Colors.white, width: 2.2),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(100),
        child: Stack(
          children: [
            // Reflejo diagonal de luz
            Positioned(
              top: -30,
              left: -30,
              child: Transform.rotate(
                angle: 0.5,
                child: Container(
                  width: 80,
                  height: 25,
                  color: Colors.white.withOpacity(0.18),
                ),
              ),
            ),
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: Colors.white, size: 15),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: AppTheme.inter(
                      fontSize: 8.5,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      height: 1.1,
                      letterSpacing: 0.5,
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

// ── Badge de placa (Diseño de Placa Física Oficial Peruana Premium) ──────────
class _PlateBadge extends StatelessWidget {
  final String plate;
  final String indicator;

  const _PlateBadge({required this.plate, required this.indicator});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.06),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
            border: Border.all(color: AppColors.ink2, width: 2),
          ),
          child: Column(
            children: [
              // Franja Superior "PERÚ" que emula la placa de rodaje nacional
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: const BoxDecoration(
                  color: AppColors.panel,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(14),
                    topRight: Radius.circular(14),
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  'PERÚ',
                  style: AppTheme.inter(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: 4.5,
                  ),
                ),
              ),
              // Cuerpo de la Placa
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 22),
                child: Column(
                  children: [
                    Text(
                      plate.toUpperCase(),
                      style: GoogleFonts.sourceCodePro(
                        fontSize: 38,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink9,
                        letterSpacing: 7,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'FISCALIZACIÓN DE TRANSPORTE',
                      style: AppTheme.inter(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                        letterSpacing: 1.8,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Sello flotando en la esquina superior derecha
        Positioned(
          top: -12,
          right: -10,
          child: _StatusSeal(indicator: indicator),
        ),
      ],
    );
  }
}

// ── Certificado de Autenticidad QR Interactivo (Criptografía y Firma) ────────
class _QrValidationBadge extends StatefulWidget {
  final bool? offline;
  final bool? server;

  const _QrValidationBadge({super.key, this.offline, this.server});

  @override
  State<_QrValidationBadge> createState() => _QrValidationBadgeState();
}

class _QrValidationBadgeState extends State<_QrValidationBadge> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final bool valid = widget.server ?? widget.offline ?? true;
    final color = valid ? AppColors.apto : AppColors.noApto;
    final bg = valid ? AppColors.aptoBg : AppColors.noAptoBg;
    final border = valid ? AppColors.aptoBorder : AppColors.noAptoBorder;
    final title = valid ? 'Firma Digital Verificada' : 'Firma Digital Inválida';
    final subtitle = valid
        ? 'Este código QR ha sido verificado criptográficamente en tiempo real y pertenece al registro oficial de la municipalidad.'
        : 'La firma criptográfica del código QR no coincide con la clave institucional. El QR podría estar alterado o falsificado.';
    final icon = valid ? Icons.shield_rounded : Icons.gpp_bad_rounded;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border, width: 1.2),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: BorderRadius.circular(11),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 18, color: color),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        title,
                        style: AppTheme.inter(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        widget.server != null ? 'ONLINE' : 'OFFLINE',
                        style: GoogleFonts.sourceCodePro(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: color,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: color,
                    ),
                  ],
                ),
                AnimatedCrossFade(
                  firstChild: const SizedBox.shrink(),
                  secondChild: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 10),
                      const Divider(height: 1, color: Colors.black12),
                      const SizedBox(height: 10),
                      Text(
                        subtitle,
                        style: AppTheme.inter(
                          fontSize: 12.5,
                          color: color.withOpacity(0.9),
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding:
                            const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.65),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: color.withOpacity(0.15)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'HMAC-SHA256 INTEGRITY CHECK',
                              style: GoogleFonts.sourceCodePro(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w700,
                                color: color.withOpacity(0.8),
                              ),
                            ),
                            Icon(
                              valid
                                  ? Icons.lock_outline_rounded
                                  : Icons.lock_open_rounded,
                              size: 11,
                              color: color.withOpacity(0.8),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  crossFadeState: _expanded
                      ? CrossFadeState.showSecond
                      : CrossFadeState.showFirst,
                  duration: const Duration(milliseconds: 250),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Tarjeta de información modular unificada (_InfoCard) ─────────────────────
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
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: AppColors.ink2, width: 1.2),
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
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, size: 20, color: AppColors.primary),
                    ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTheme.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink9,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: AppTheme.inter(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
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
                  return child;
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Fila de Inspección Técnica Consolidada (RF-11) ───────────────────────────
class _InspectionRow extends StatelessWidget {
  final String status;

  const _InspectionRow({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, bg, label, icon) = switch (status) {
      'aprobada'  => (AppColors.apto, AppColors.aptoBg, 'Aprobada y Vigente', Icons.check_circle_outline_rounded),
      'observada' => (AppColors.riesgo, AppColors.riesgoBg, 'Con Observaciones', Icons.warning_amber_rounded),
      'rechazada' => (AppColors.noApto, AppColors.noAptoBg, 'Rechazada', Icons.cancel_outlined),
      _           => (AppColors.ink5, AppColors.ink1, 'Sin Registro', Icons.help_outline_rounded),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Inspección Técnica',
            style: AppTheme.inter(
                fontSize: 13, color: AppColors.ink5, fontWeight: FontWeight.w500),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: color.withOpacity(0.35), width: 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 13, color: color),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
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

// ── Fila de reputación premium con barra de progreso lineal (RF-15) ──────────
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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Reputación',
            style: AppTheme.inter(
                fontSize: 13, color: AppColors.ink5, fontWeight: FontWeight.w500),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$score%',
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: _color,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '($label)',
                    style: AppTheme.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _color,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 5),
              // Barra lineal muy fina
              Container(
                width: 110,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.ink1,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: (score / 100).clamp(0.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: _color,
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
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
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTheme.inter(
                fontSize: 13, color: AppColors.ink5, fontWeight: FontWeight.w500),
          ),
          valueWidget ??
              Text(
                value ?? '',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink8,
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
      icon: const Icon(Icons.campaign_outlined, size: 20),
      label: const Text('Reportar anomalía'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.riesgo,
        side: const BorderSide(color: AppColors.riesgoBorder, width: 1.5),
        backgroundColor: AppColors.riesgoBg,
        minimumSize: const Size(double.infinity, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: AppTheme.inter(fontSize: 14.5, fontWeight: FontWeight.w700),
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
      icon: const Icon(Icons.block_outlined, size: 20),
      label: const Text('Suspender vehículo'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.noApto,
        side: const BorderSide(color: AppColors.noAptoBorder, width: 1.5),
        backgroundColor: AppColors.noAptoBg,
        minimumSize: const Size(double.infinity, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: AppTheme.inter(fontSize: 14.5, fontWeight: FontWeight.w700),
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
                      child: SfitLoading.inline(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Confirmar'),
            ),
          ],
        ),
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
            Text(message,
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6)),
          ],
        ),
      ),
    );
  }
}
