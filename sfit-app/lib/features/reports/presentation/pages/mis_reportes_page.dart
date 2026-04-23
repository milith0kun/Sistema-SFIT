import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../data/datasources/report_api_service.dart';

class MisReportesPage extends ConsumerStatefulWidget {
  const MisReportesPage({super.key});

  @override
  ConsumerState<MisReportesPage> createState() => _MisReportesPageState();
}

class _MisReportesPageState extends ConsumerState<MisReportesPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ref.read(reportApiServiceProvider).getMisReportes();
      if (mounted) {
        setState(() {
          _items = List<Map<String, dynamic>>.from(result['items'] as List);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis reportes')),
      body: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 14, color: AppColors.noApto),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _load,
                style: FilledButton.styleFrom(backgroundColor: AppColors.panel),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        SfitHeroCard(
          kicker: 'CIUDADANO',
          title: 'Mis reportes',
          subtitle: 'Seguimiento de tus reportes ciudadanos',
          rfCode: 'RF-12',
          pills: [
            SfitHeroPill(label: 'Total', value: '${_items.length}'),
          ],
        ),
        const SizedBox(height: 20),
        if (_items.isEmpty) _buildEmpty(),
        if (_items.isNotEmpty)
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) => _ReportCard(item: _items[index]),
          ),
      ],
    );
  }

  Widget _buildEmpty() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 32),
      child: Column(
        children: [
          Icon(
            Icons.assignment_outlined,
            size: 44,
            color: AppColors.ink4,
          ),
          const SizedBox(height: 14),
          Text(
            'Aún no has enviado reportes',
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Cuando envíes un reporte ciudadano aparecerá aquí.',
            textAlign: TextAlign.center,
            style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final Map<String, dynamic> item;

  const _ReportCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final category = item['category'] as String? ?? '';
    final status = item['status'] as String? ?? 'pendiente';
    final vehiclePlate = item['vehiclePlate'] as String?;
    final description = item['description'] as String?;
    final createdAtRaw = item['createdAt'];
    DateTime? createdAt;
    if (createdAtRaw is String) {
      createdAt = DateTime.tryParse(createdAtRaw);
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Ícono de categoría
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.riesgoBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.riesgoBorder),
            ),
            child: Icon(
              _categoryIcon(category),
              size: 20,
              color: AppColors.riesgo,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Fila: categoría + badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        category.isEmpty ? 'Sin categoría' : category,
                        style: AppTheme.inter(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                          height: 1.2,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _StatusBadge(status: status),
                  ],
                ),
                // Descripción (preview)
                if (description != null && description.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, height: 1.4),
                  ),
                ],
                const SizedBox(height: 8),
                // Metadatos
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    if (vehiclePlate != null && vehiclePlate.isNotEmpty)
                      _MetaChip(
                        icon: Icons.directions_car_outlined,
                        label: vehiclePlate,
                      ),
                    _MetaChip(
                      icon: Icons.calendar_today_outlined,
                      label: createdAt != null
                          ? DateFormat('dd/MM/yyyy HH:mm').format(createdAt.toLocal())
                          : '—',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _categoryIcon(String category) {
    final lower = category.toLowerCase();
    if (lower.contains('conducción') || lower.contains('conduccion') || lower.contains('peligros')) {
      return Icons.speed_rounded;
    }
    if (lower.contains('cobro') || lower.contains('precio') || lower.contains('tarifa')) {
      return Icons.payments_outlined;
    }
    if (lower.contains('mal estado') || lower.contains('vehículo') || lower.contains('vehiculo')) {
      return Icons.car_crash_outlined;
    }
    if (lower.contains('conducta')) {
      return Icons.sentiment_dissatisfied_outlined;
    }
    return Icons.report_gmailerrorred_outlined;
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _MetaChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.ink4),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink4, tabular: true),
          ),
        ],
      );
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (bg, border, fg, label) = switch (status) {
      'pendiente' => (
          AppColors.riesgoBg,
          AppColors.riesgoBorder,
          AppColors.riesgo,
          'PENDIENTE',
        ),
      'en_revision' => (
          const Color(0xFFEFF6FF),
          const Color(0xFF93C5FD),
          const Color(0xFF1D4ED8),
          'EN REVISIÓN',
        ),
      'validado' => (
          AppColors.aptoBg,
          AppColors.aptoBorder,
          AppColors.apto,
          'VALIDADO',
        ),
      'rechazado' => (
          AppColors.noAptoBg,
          AppColors.noAptoBorder,
          AppColors.noApto,
          'RECHAZADO',
        ),
      _ => (
          AppColors.riesgoBg,
          AppColors.riesgoBorder,
          AppColors.riesgo,
          status.toUpperCase(),
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border, width: 1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          color: fg,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}
