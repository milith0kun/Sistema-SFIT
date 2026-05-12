import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/fleet_api_service.dart';
import '../../data/models/fleet_entry_model.dart';

/// Panel de flota diario para el Operador — RF-07.
class FleetPage extends ConsumerStatefulWidget {
  const FleetPage({super.key});

  @override
  ConsumerState<FleetPage> createState() => _FleetPageState();
}

class _FleetPageState extends ConsumerState<FleetPage> {
  List<FleetEntryModel> _entries = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _load(); });
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(fleetApiServiceProvider);
      final items = await svc.getTodayFleet();
      if (mounted) setState(() { _entries = items; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _error = 'Error al cargar la flota.'; _loading = false; });
    }
  }

  Future<void> _registerReturn(FleetEntryModel entry) async {
    final kmCtrl = TextEditingController();
    final obsCtrl = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Registrar retorno — ${entry.vehicle.plate}',
            style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: kmCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Kilómetros recorridos',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: obsCtrl,
              decoration: const InputDecoration(
                labelText: 'Observaciones (opcional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.panel),
            child: const Text('Confirmar retorno'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        final svc = ref.read(fleetApiServiceProvider);
        await svc.registerReturn(
          entryId: entry.id,
          km: double.tryParse(kmCtrl.text) ?? 0,
          observations: obsCtrl.text.trim(),
        );
        await _load();
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Error al registrar retorno.'),
                backgroundColor: AppColors.noApto),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final active   = _entries.where((e) => e.isActive).length;
    final closed   = _entries.where((e) => e.isClosed).length;
    final total    = _entries.length;

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'OPERACIÓN DE FLOTA',
                      style: AppTheme.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                        letterSpacing: 1.6,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Flota del día',
                  style: AppTheme.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/operador/viajes'),
                        icon: const Icon(Icons.event_note_outlined, size: 16),
                        label: const Text('Programación'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.ink8,
                          side: const BorderSide(color: AppColors.ink2),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          textStyle: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () async {
                          await context.push('/flota-salida');
                          if (mounted) _load();
                        },
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Registrar salida'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.ink9,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          textStyle: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── KPI strip ───────────────────────────────────────────
          if (!_loading)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  _KpiChip(
                    label: 'Total',
                    value: '$total',
                    color: AppColors.info,
                    icon: Icons.local_shipping_outlined,
                  ),
                  const SizedBox(width: 8),
                  _KpiChip(
                    label: 'En ruta',
                    value: '$active',
                    color: AppColors.riesgo,
                    icon: Icons.directions_bus_outlined,
                  ),
                  const SizedBox(width: 8),
                  _KpiChip(
                    label: 'Cerrados',
                    value: '$closed',
                    color: AppColors.apto,
                    icon: Icons.check_circle_outline,
                  ),
                ],
              ),
            ),

          // ── Lista ─────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : _error != null
                    ? Center(child: Text(_error!, style: AppTheme.inter(color: AppColors.noApto)))
                    : _entries.isEmpty
                        ? _EmptyFleet(onAdd: () async {
                            await context.push('/flota-salida');
                            if (mounted) _load();
                          })
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                              itemCount: _entries.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) => _FleetCard(
                                entry: _entries[i],
                                onTap: () async {
                                  await context.push(
                                    '/flota/${_entries[i].id}',
                                  );
                                  if (mounted) _load();
                                },
                                onReturn: _entries[i].isActive
                                    ? () => _registerReturn(_entries[i])
                                    : null,
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _KpiChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData? icon;
  const _KpiChip({
    required this.label,
    required this.value,
    required this.color,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          border: Border.all(color: color.withValues(alpha: 0.22)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 12, color: color.withValues(alpha: 0.9)),
                  const SizedBox(width: 4),
                ],
                Expanded(
                  child: Text(
                    label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.inter(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: color.withValues(alpha: 0.85),
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: AppTheme.inter(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
                tabular: true,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FleetCard extends StatelessWidget {
  final FleetEntryModel entry;
  final VoidCallback? onTap;
  final VoidCallback? onReturn;

  const _FleetCard({required this.entry, this.onTap, this.onReturn});

  @override
  Widget build(BuildContext context) {
    final (statusColor, statusBg, statusLabel) = switch (entry.status) {
      'en_ruta'           => (AppColors.riesgo, AppColors.riesgoBg, 'En ruta'),
      'cerrado'           => (AppColors.apto,   AppColors.aptoBg,   'Cerrado'),
      'auto_cierre'       => (AppColors.ink5,   AppColors.ink1,     'Auto-cierre'),
      'mantenimiento'     => (AppColors.info,   AppColors.infoBg,   'Mantenimiento'),
      'fuera_de_servicio' => (AppColors.noApto, AppColors.noAptoBg, 'Fuera de servicio'),
      _                   => (AppColors.apto,   AppColors.aptoBg,   'Disponible'),
    };

    final routeName = entry.route == null
        ? null
        : (entry.route!['name'] as String?)?.trim();
    final routeCode = entry.route == null
        ? null
        : (entry.route!['code'] as String?)?.trim();
    final routeLabel = [
      if (routeCode != null && routeCode.isNotEmpty) routeCode,
      if (routeName != null && routeName.isNotEmpty) routeName,
    ].join(' · ');

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
            child: Row(
              children: [
                // Placa
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.ink9,
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Text(
                    entry.vehicle.plate,
                    style: AppTheme.inter(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                // Conductor
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _DriverStatusDot(status: entry.driver.status),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              entry.driver.name,
                              style: AppTheme.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink9,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 1),
                      Text(
                        _driverStatusLabel(entry.driver.status),
                        style: AppTheme.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _driverStatusColor(entry.driver.status),
                        ),
                      ),
                    ],
                  ),
                ),
                // Estado
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: statusBg,
                    border: Border.all(color: statusColor.withValues(alpha: 0.25)),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    statusLabel,
                    style: AppTheme.inter(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: statusColor,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Ruta asignada (si la hay) — pill discreta separada del top
          if (routeLabel.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: AppColors.ink1,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.alt_route,
                      size: 13,
                      color: AppColors.ink5,
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        routeLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.inter(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink7,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Horario y botón retorno
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 8, 10),
            child: Row(
              children: [
                const Icon(Icons.schedule, size: 13, color: AppColors.ink4),
                const SizedBox(width: 4),
                Text(
                  _timeRange(entry.departureTime, entry.returnTime),
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink6,
                    fontWeight: FontWeight.w500,
                    tabular: true,
                  ),
                ),
                if (entry.km > 0) ...[
                  const SizedBox(width: 10),
                  const Icon(
                    Icons.straighten_outlined,
                    size: 13,
                    color: AppColors.ink4,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${entry.km.toStringAsFixed(0)} km',
                    style: AppTheme.inter(
                      fontSize: 11.5,
                      color: AppColors.ink6,
                      fontWeight: FontWeight.w500,
                      tabular: true,
                    ),
                  ),
                ],
                const Spacer(),
                if (onReturn != null)
                  FilledButton.tonalIcon(
                    onPressed: onReturn,
                    icon: const Icon(Icons.login, size: 14),
                    label: const Text('Retorno'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primaryBg,
                      foregroundColor: AppColors.primaryDark,
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 0,
                      ),
                      textStyle: AppTheme.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
        ),
      ),
    );
  }

  String _driverStatusLabel(String s) => switch (s) {
        'riesgo'  => 'En riesgo',
        'no_apto' => 'No apto',
        _         => 'Apto',
      };

  Color _driverStatusColor(String s) => switch (s) {
        'riesgo'  => AppColors.riesgo,
        'no_apto' => AppColors.noApto,
        _         => AppColors.apto,
      };

  String _timeRange(String? dep, String? ret) {
    if (dep == null) return 'Sin salida registrada';
    final depTime = _fmtTime(dep);
    if (ret == null) return 'Salida: $depTime';
    return '$depTime → ${_fmtTime(ret)}';
  }

  String _fmtTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}

// ── Indicador de estado del conductor ─────────────────────────────
class _DriverStatusDot extends StatelessWidget {
  final String status; // apto | riesgo | no_apto

  const _DriverStatusDot({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'riesgo'  => AppColors.riesgo,
      'no_apto' => AppColors.noApto,
      _         => AppColors.apto,
    };
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: 3,
            spreadRadius: 1,
          ),
        ],
      ),
    );
  }
}

class _EmptyFleet extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyFleet({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.local_shipping_outlined, size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text('Sin salidas registradas hoy',
                style: AppTheme.inter(
                    fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink7)),
            const SizedBox(height: 6),
            Text('Registra la primera salida del día',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Registrar salida'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
