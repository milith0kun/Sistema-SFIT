import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Listado de viajes del operador — RF-09 (mobile).
class OperatorTripsPage extends ConsumerStatefulWidget {
  const OperatorTripsPage({super.key});

  @override
  ConsumerState<OperatorTripsPage> createState() =>
      _OperatorTripsPageState();
}

class _OperatorTripsPageState extends ConsumerState<OperatorTripsPage> {
  bool _loading = true;
  String? _error;
  List<_Trip> _all = const [];
  String _filter = 'todos';

  static const _filters = [
    ('todos', 'Todos'),
    ('programado', 'Programados'),
    ('en_curso', 'En curso'),
    ('completado', 'Completados'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get(
        '/viajes',
        queryParameters: {'role': 'operador', 'limit': 50},
      );
      final body = resp.data as Map?;
      final data = (body?['data'] as Map?) ?? body ?? const {};
      final items = (data['items'] as List? ?? const [])
          .map((e) => _Trip.fromJson(e as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          _all = items;
          _loading = false;
        });
      }
    } catch (_) {
      // Backend puede no tener el endpoint todavía — mostramos estado vacío
      // sin romper la UI. El operador puede usar la web mientras tanto.
      if (mounted) {
        setState(() {
          _all = const [];
          _loading = false;
          _error = null;
        });
      }
    }
  }

  List<_Trip> get _filtered => _filter == 'todos'
      ? _all
      : _all.where((t) => t.status == _filter).toList();

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Mis viajes',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: Column(children: [
        // Filtros segmentados horizontales
        SizedBox(
          height: 46,
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            scrollDirection: Axis.horizontal,
            itemCount: _filters.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (_, i) {
              final f = _filters[i];
              final selected = f.$1 == _filter;
              return ChoiceChip(
                label: Text(
                  f.$2,
                  style: AppTheme.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: selected ? AppColors.primaryDark : AppColors.ink6,
                  ),
                ),
                selected: selected,
                onSelected: (_) => setState(() => _filter = f.$1),
                selectedColor: AppColors.primaryBg,
                backgroundColor: Colors.white,
                showCheckmark: false,
                side: BorderSide(
                  color: selected ? AppColors.primaryBorder : AppColors.ink2,
                ),
                visualDensity: VisualDensity.compact,
              );
            },
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _load,
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  )
                : _error != null
                    ? _buildError()
                    : filtered.isEmpty
                        ? ListView(children: [const SizedBox(height: 80), _buildEmpty()])
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(12, 6, 12, 96),
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (_, i) => _TripCard(
                              trip: filtered[i],
                              onTap: () =>
                                  context.push('/operador/viajes/${filtered[i].id}'),
                            ),
                          ),
          ),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text(
                'Crea el viaje desde el panel web. Aquí lo verás listado.',
              ),
              behavior: SnackBarBehavior.floating,
              backgroundColor: AppColors.ink9,
              action: SnackBarAction(
                label: 'OK',
                textColor: Colors.white,
                onPressed: () {},
              ),
            ),
          );
        },
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: Text(
          'Nuevo viaje',
          style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _buildEmpty() => Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.ink2),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(
              Icons.calendar_month_outlined,
              size: 36,
              color: AppColors.ink4,
            ),
            const SizedBox(height: 10),
            Text(
              'Sin viajes',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.ink8,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'No hay viajes con este filtro.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
            ),
          ]),
        ),
      );

  Widget _buildError() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(
            _error ?? 'Error',
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _load,
            child: const Text('Reintentar'),
          ),
        ]),
      );
}

class _TripCard extends StatelessWidget {
  final _Trip trip;
  final VoidCallback onTap;
  const _TripCard({required this.trip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final s = _statusInfo(trip.status);
    final fmt = DateFormat('dd MMM · HH:mm', 'es');
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(
                  trip.routeName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: s.bg,
                  border: Border.all(color: s.border),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  s.label,
                  style: AppTheme.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: s.fg,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 6),
            if (trip.departureAt != null)
              Row(children: [
                const Icon(Icons.schedule, size: 12, color: AppColors.ink5),
                const SizedBox(width: 4),
                Text(
                  fmt.format(trip.departureAt!.toLocal()),
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink6,
                    tabular: true,
                  ),
                ),
              ]),
            const SizedBox(height: 8),
            Wrap(spacing: 12, runSpacing: 4, children: [
              if (trip.vehiclePlate != null)
                _MetaChip(
                  icon: Icons.directions_car_outlined,
                  text: trip.vehiclePlate!,
                ),
              if (trip.driverName != null)
                _MetaChip(icon: Icons.person_outline, text: trip.driverName!),
              _MetaChip(
                icon: Icons.groups_2_outlined,
                text: '${trip.passengerCount} pax',
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String text;
  const _MetaChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12, color: AppColors.ink5),
      const SizedBox(width: 4),
      Text(
        text,
        style: AppTheme.inter(
          fontSize: 11.5,
          color: AppColors.ink6,
          fontWeight: FontWeight.w500,
        ),
      ),
    ]);
  }
}

class _StatusInfo {
  final String label;
  final Color fg;
  final Color bg;
  final Color border;
  const _StatusInfo({
    required this.label,
    required this.fg,
    required this.bg,
    required this.border,
  });
}

_StatusInfo _statusInfo(String status) => switch (status) {
      'programado' => const _StatusInfo(
          label: 'PROGRAMADO',
          fg: AppColors.info,
          bg: AppColors.infoBg,
          border: AppColors.infoBorder,
        ),
      'en_curso' => const _StatusInfo(
          label: 'EN CURSO',
          fg: AppColors.riesgo,
          bg: AppColors.riesgoBg,
          border: AppColors.riesgoBorder,
        ),
      'completado' => const _StatusInfo(
          label: 'COMPLETADO',
          fg: AppColors.apto,
          bg: AppColors.aptoBg,
          border: AppColors.aptoBorder,
        ),
      'cancelado' => const _StatusInfo(
          label: 'CANCELADO',
          fg: AppColors.noApto,
          bg: AppColors.noAptoBg,
          border: AppColors.noAptoBorder,
        ),
      _ => _StatusInfo(
          label: status.toUpperCase(),
          fg: AppColors.ink6,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        ),
    };

class _Trip {
  final String id;
  final String routeName;
  final String status;
  final DateTime? departureAt;
  final String? vehiclePlate;
  final String? driverName;
  final int passengerCount;

  const _Trip({
    required this.id,
    required this.routeName,
    required this.status,
    this.departureAt,
    this.vehiclePlate,
    this.driverName,
    this.passengerCount = 0,
  });

  factory _Trip.fromJson(Map<String, dynamic> j) {
    DateTime? parseDt(dynamic v) {
      if (v is String && v.isNotEmpty) return DateTime.tryParse(v);
      return null;
    }

    final route = j['route'] as Map<String, dynamic>?;
    final vehicle = j['vehicle'] as Map<String, dynamic>?;
    final driver = j['driver'] as Map<String, dynamic>?;

    return _Trip(
      id: (j['_id'] ?? j['id'] ?? '').toString(),
      routeName:
          (route?['name'] ?? j['routeName'] ?? j['name'] ?? 'Ruta').toString(),
      status: (j['status'] ?? 'programado').toString(),
      departureAt:
          parseDt(j['departureAt']) ?? parseDt(j['scheduledAt']),
      vehiclePlate: (vehicle?['plate'] ?? j['vehiclePlate']) as String?,
      driverName: (driver?['name'] ?? j['driverName']) as String?,
      passengerCount: (j['passengerCount'] as num?)?.toInt() ??
          (j['pasajeros'] is List ? (j['pasajeros'] as List).length : 0),
    );
  }
}
