import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_url.dart';
import '../../data/datasources/reports_api_service.dart';

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
      final result = await ref.read(reportsApiServiceProvider).getMisReportes();
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
    return Container(
      color: AppColors.ink1,
      child: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
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
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.ink9,
                  minimumSize: const Size(double.infinity, 46),
                ),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      );
    }

    final pendientes = _items.where((r) => (r['status'] as String?) == 'pendiente').length;
    final validados = _items.where((r) => (r['status'] as String?) == 'validado').length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        // Header con kicker estilo feed
        Row(
          children: [
            Container(width: 5, height: 5, decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(
              'TU ACTIVIDAD',
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
          'Mis reportes',
          style: AppTheme.inter(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.ink9,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 14),

        // Strip de KPIs compacto
        if (_items.isNotEmpty) ...[
          Row(
            children: [
              Expanded(child: _MiniKpi(label: 'Total', value: '${_items.length}', color: AppColors.ink9)),
              const SizedBox(width: 8),
              Expanded(child: _MiniKpi(label: 'Pendientes', value: '$pendientes', color: AppColors.riesgo)),
              const SizedBox(width: 8),
              Expanded(child: _MiniKpi(label: 'Validados', value: '$validados', color: AppColors.apto)),
            ],
          ),
          const SizedBox(height: 14),
        ],

        // Banner explicando flujo del feed comunitario
        if (pendientes > 0) ...[
          _PendingBanner(count: pendientes),
          const SizedBox(height: 14),
        ],

        if (_items.isEmpty) _buildEmpty(),
        if (_items.isNotEmpty)
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
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
          const Icon(
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

// ── Banner informativo cuando hay reportes pendientes ────────────────────────
class _PendingBanner extends StatelessWidget {
  final int count;
  const _PendingBanner({required this.count});

  @override
  Widget build(BuildContext context) {
    final plural = count == 1 ? 'reporte pendiente' : 'reportes pendientes';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.infoBg,
        border: Border.all(color: AppColors.infoBorder),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.info),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: AppTheme.inter(fontSize: 12, color: AppColors.info, height: 1.4),
                children: [
                  TextSpan(
                    text: 'Tienes $count $plural. ',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const TextSpan(
                    text: 'Aparecerán en el feed comunitario una vez que un fiscal los valide.',
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

class _MiniKpi extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _MiniKpi({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(left: BorderSide(color: color, width: 3), top: const BorderSide(color: AppColors.ink2), right: const BorderSide(color: AppColors.ink2), bottom: const BorderSide(color: AppColors.ink2)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTheme.inter(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.ink5, letterSpacing: 1.0),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTheme.inter(fontSize: 18, fontWeight: FontWeight.w800, color: color, tabular: true, letterSpacing: -0.3),
          ),
        ],
      ),
    );
  }
}

// ── Card de un reporte propio: foto, descripción completa, estado ────────────
class _ReportCard extends StatefulWidget {
  final Map<String, dynamic> item;
  const _ReportCard({required this.item});

  @override
  State<_ReportCard> createState() => _ReportCardState();
}

class _ReportCardState extends State<_ReportCard> {
  bool _expanded = false;

  // DateFormat estático para reusar la instancia en todos los rebuilds.
  static final _cardDateFormat = DateFormat("d 'de' MMMM, HH:mm", 'es');

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final category = item['category'] as String? ?? '';
    final status = item['status'] as String? ?? 'pendiente';
    final vehiclePlate = item['vehiclePlate'] as String?;
    final description = item['description'] as String? ?? '';
    final imageUrls = (item['imageUrls'] as List?)?.cast<String>() ?? const [];
    final createdAtRaw = item['createdAt'];
    DateTime? createdAt;
    if (createdAtRaw is String) {
      createdAt = DateTime.tryParse(createdAtRaw);
    }

    final shouldClampDescription = description.length > 140 && !_expanded;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Galería de fotos (si hay) ────────────────────────────
          if (imageUrls.isNotEmpty) _PhotoStrip(urls: imageUrls),

          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Categoría + badge estado
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(_categoryIcon(category), size: 18, color: AppColors.ink7),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        category.isEmpty ? 'Sin categoría' : category,
                        style: AppTheme.inter(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                          height: 1.2,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _StatusBadge(status: status),
                  ],
                ),

                // Descripción completa con expand
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    shouldClampDescription
                        ? '${description.substring(0, 140)}…'
                        : description,
                    style: AppTheme.inter(fontSize: 13.5, color: AppColors.ink8, height: 1.5),
                  ),
                  if (description.length > 140)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: GestureDetector(
                        onTap: () => setState(() => _expanded = !_expanded),
                        child: Text(
                          _expanded ? 'Ver menos' : 'Ver más',
                          style: AppTheme.inter(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                ],

                const SizedBox(height: 12),
                Container(height: 1, color: AppColors.ink1),
                const SizedBox(height: 10),

                // Pie: placa + fecha
                Row(
                  children: [
                    if (vehiclePlate != null && vehiclePlate.isNotEmpty) ...[
                      const Icon(Icons.directions_car_outlined, size: 13, color: AppColors.ink5),
                      const SizedBox(width: 4),
                      Text(
                        vehiclePlate,
                        style: AppTheme.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink8,
                          tabular: true,
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    const Icon(Icons.calendar_today_outlined, size: 12, color: AppColors.ink4),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        createdAt != null
                            ? _cardDateFormat.format(createdAt.toLocal())
                            : '—',
                        style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5, tabular: true),
                      ),
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
    if (lower.contains('exceso') || lower.contains('velocidad')) {
      return Icons.speed_rounded;
    }
    if (lower.contains('ruta') || lower.contains('incumplimiento')) {
      return Icons.alt_route_outlined;
    }
    return Icons.report_gmailerrorred_outlined;
  }
}

// ── Strip de fotos al estilo feed ────────────────────────────────────────────
class _PhotoStrip extends StatelessWidget {
  final List<String> urls;
  const _PhotoStrip({required this.urls});

  @override
  Widget build(BuildContext context) {
    if (urls.length == 1) {
      return AspectRatio(
        aspectRatio: 16 / 10,
        child: CachedNetworkImage(
          imageUrl: normalizeImageUrl(urls.first),
          fit: BoxFit.cover,
          fadeInDuration: const Duration(milliseconds: 220),
          placeholder: (_, __) => Container(
            color: AppColors.ink1,
            alignment: Alignment.center,
            child: const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.ink4),
            ),
          ),
          errorWidget: (_, __, ___) => Container(
            color: AppColors.ink1,
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.broken_image_outlined, color: AppColors.ink4, size: 32),
                const SizedBox(height: 4),
                Text('Imagen no disponible', style: AppTheme.inter(fontSize: 11, color: AppColors.ink5)),
              ],
            ),
          ),
        ),
      );
    }
    return SizedBox(
      height: 180,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.all(8),
        itemCount: urls.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) => ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: CachedNetworkImage(
            imageUrl: normalizeImageUrl(urls[i]),
            width: 160,
            fit: BoxFit.cover,
            fadeInDuration: const Duration(milliseconds: 220),
            placeholder: (_, __) => Container(color: AppColors.ink1, width: 160),
            errorWidget: (_, __, ___) => Container(
              color: AppColors.ink1,
              width: 160,
              child: const Icon(Icons.broken_image_outlined, color: AppColors.ink4, size: 28),
            ),
          ),
        ),
      ),
    );
  }
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
          AppColors.infoBg,
          AppColors.infoBorder,
          AppColors.info,
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
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
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
