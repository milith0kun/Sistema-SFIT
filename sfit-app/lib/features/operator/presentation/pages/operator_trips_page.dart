import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../trips/data/models/trip_model.dart';
import '../../data/datasources/operator_api_service.dart';

/// Listado de viajes del operador — RF-09 (mobile).
class OperatorTripsPage extends ConsumerStatefulWidget {
  const OperatorTripsPage({super.key});

  @override
  ConsumerState<OperatorTripsPage> createState() =>
      _OperatorTripsPageState();
}

class _OperatorTripsPageState extends ConsumerState<OperatorTripsPage> {
  String _filter = 'todos';

  static const _filters = [
    ('todos', 'Todos'),
    ('programado', 'Programados'),
    ('en_curso', 'En curso'),
    ('completado', 'Completados'),
  ];

  List<TripModel> _applyFilter(List<TripModel> all) =>
      _filter == 'todos' ? all : all.where((t) => t.status == _filter).toList();

  @override
  Widget build(BuildContext context) {
    final tripsAsync = ref.watch(operadorTripsProvider);
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
            onRefresh: () => ref.refresh(operadorTripsProvider.future),
            child: tripsAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
              error: (_, __) => ListView(
                children: [const SizedBox(height: 80), _buildEmpty()],
              ),
              data: (all) {
                final filtered = _applyFilter(all);
                if (filtered.isEmpty) {
                  return ListView(
                    children: [const SizedBox(height: 80), _buildEmpty()],
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 6, 12, 96),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _TripCard(
                    trip: filtered[i],
                    onTap: () =>
                        context.push('/operador/viajes/${filtered[i].id}'),
                  ),
                );
              },
            ),
          ),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await context.push<bool>('/operador/viajes/nuevo');
          if (created == true && mounted) {
            ref.invalidate(operadorTripsProvider);
          }
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
}

class _TripCard extends StatelessWidget {
  final TripModel trip;
  final VoidCallback onTap;
  const _TripCard({required this.trip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final s = _statusInfo(trip.status);
    final fmt = DateFormat('dd MMM · HH:mm', 'es');
    final routeName = trip.route?.name ?? 'Ruta';
    final plate = trip.vehicle?.plate;
    final dep = trip.startedAt;
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
                  routeName,
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
            if (dep != null)
              Row(children: [
                const Icon(Icons.schedule, size: 12, color: AppColors.ink5),
                const SizedBox(width: 4),
                Text(
                  fmt.format(dep.toLocal()),
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink6,
                    tabular: true,
                  ),
                ),
              ]),
            const SizedBox(height: 8),
            Wrap(spacing: 12, runSpacing: 4, children: [
              if (plate != null && plate.isNotEmpty)
                _MetaChip(
                  icon: Icons.directions_car_outlined,
                  text: plate,
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
