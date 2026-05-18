import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Vista pública de una empresa de transporte. Accesible sin autenticación
/// desde el feed (al tocar el nombre de empresa), QR scan, o buscar vehículo.
class EmpresaDetallePage extends StatefulWidget {
  final String companyId;
  const EmpresaDetallePage({super.key, required this.companyId});

  @override
  State<EmpresaDetallePage> createState() => _EmpresaDetallePageState();
}

class _EmpresaDetallePageState extends State<EmpresaDetallePage> {
  late final Dio _dio;
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;

  static final _dateFormat = DateFormat("MMMM 'de' yyyy", 'es');

  @override
  void initState() {
    super.initState();
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(milliseconds: ApiConstants.connectTimeout),
      receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
      headers: {ApiConstants.clientHeader: ApiConstants.clientToken},
    ));
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await _dio.get('/public/empresas/${widget.companyId}');
      final data = (resp.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      if (mounted) setState(() { _data = data; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudo cargar la empresa.';
          _loading = false;
        });
      }
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
        leading: const BackButton(),
        title: Text(
          'Empresa',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _Content(data: _data!, dateFormat: _dateFormat),
    );
  }
}

class _Content extends StatelessWidget {
  final Map<String, dynamic> data;
  final DateFormat dateFormat;
  const _Content({required this.data, required this.dateFormat});

  @override
  Widget build(BuildContext context) {
    final razonSocial = data['razonSocial'] as String? ?? '—';
    final ruc = data['ruc'] as String? ?? '—';
    final municipality = data['municipalityName'] as String?;
    final serviceScope = data['serviceScope'] as String?;
    final vehicleTypeKeys = (data['vehicleTypeKeys'] as List?)?.cast<String>() ?? const [];
    final vehicleCount = (data['vehicleCount'] as num?)?.toInt() ?? 0;
    final driverCount = (data['driverCount'] as num?)?.toInt() ?? 0;
    final fleetReputation = (data['fleetReputation'] as num?)?.toInt();
    final memberSinceRaw = data['memberSince'] as String?;
    DateTime? memberSince;
    if (memberSinceRaw != null) memberSince = DateTime.tryParse(memberSinceRaw);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Hero con razón social
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.ink2),
            ),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.goldBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.goldBorder, width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.apartment_rounded,
                      size: 28, color: AppColors.goldDark),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        razonSocial,
                        style: AppTheme.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink9,
                          letterSpacing: -0.3,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(children: [
                        const Icon(Icons.numbers, size: 12, color: AppColors.ink5),
                        const SizedBox(width: 3),
                        Text(
                          'RUC $ruc',
                          style: AppTheme.inter(
                              fontSize: 12, color: AppColors.ink6, tabular: true),
                        ),
                      ]),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // KPIs
          Row(children: [
            Expanded(child: _KpiCard(
              label: 'Vehículos',
              value: '$vehicleCount',
              icon: Icons.directions_bus_outlined,
              color: AppColors.gold,
            )),
            const SizedBox(width: 10),
            Expanded(child: _KpiCard(
              label: 'Conductores',
              value: '$driverCount',
              icon: Icons.groups_2_outlined,
              color: AppColors.info,
            )),
          ]),
          const SizedBox(height: 10),
          if (fleetReputation != null)
            _KpiCard(
              label: 'Reputación promedio de flota',
              value: '$fleetReputation / 100',
              icon: Icons.verified_outlined,
              color: _reputationColor(fleetReputation),
              full: true,
            ),
          const SizedBox(height: 16),
          // Detalles
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.ink2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'INFORMACIÓN PÚBLICA',
                  style: AppTheme.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink5,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 10),
                if (municipality != null)
                  _InfoRow(
                    icon: Icons.location_city_outlined,
                    label: 'Municipalidad',
                    value: municipality,
                  ),
                if (serviceScope != null)
                  _InfoRow(
                    icon: Icons.route_outlined,
                    label: 'Tipo de servicio',
                    value: _serviceLabel(serviceScope),
                  ),
                if (vehicleTypeKeys.isNotEmpty)
                  _InfoRow(
                    icon: Icons.commute_outlined,
                    label: 'Tipos permitidos',
                    value: vehicleTypeKeys.join(', '),
                  ),
                if (memberSince != null)
                  _InfoRow(
                    icon: Icons.event_available_outlined,
                    label: 'Registrada en SFIT',
                    value: dateFormat.format(memberSince),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Disclaimer
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.ink1,
              border: Border.all(color: AppColors.ink2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              const Icon(Icons.info_outline, size: 16, color: AppColors.ink5),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Datos públicos de la empresa registrados en SFIT. La reputación se calcula con sanciones, inspecciones y reportes ciudadanos.',
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink6,
                    height: 1.45,
                  ),
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Color _reputationColor(int score) {
    if (score >= 80) return AppColors.apto;
    if (score >= 60) return AppColors.riesgo;
    return AppColors.noApto;
  }

  String _serviceLabel(String key) => switch (key) {
        'urbano' => 'Urbano',
        'interprovincial' => 'Interprovincial',
        _ => key,
      };
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool full;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.full = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: AppTheme.inter(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink5,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: AppTheme.inter(
                    fontSize: full ? 16 : 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                    tabular: true,
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

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.ink5),
          const SizedBox(width: 10),
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.ink9,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: AppColors.noApto),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
            const SizedBox(height: 14),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
