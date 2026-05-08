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
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
      children: [
        // Strip de KPIs — más prominentes que la versión anterior
        // (antes se veían como rectángulos blancos casi vacíos).
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
            itemBuilder: (context, index) => _AnimatedReportItem(
              key: ValueKey(_items[index]['id']),
              child: _ReportCard(item: _items[index]),
            ),
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
    final radius = BorderRadius.circular(10);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: AppColors.ink9.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              child: ColoredBox(color: color),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 5, height: 5,
                        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          label.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTheme.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink5,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: AppTheme.inter(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: color,
                      tabular: true,
                      letterSpacing: -0.5,
                      height: 1.0,
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

/// Wrap que anima la primera aparición de cada card de reporte:
/// fade + slide vertical sutil. Solo dispara una vez por instancia.
class _AnimatedReportItem extends StatefulWidget {
  final Widget child;
  const _AnimatedReportItem({super.key, required this.child});

  @override
  State<_AnimatedReportItem> createState() => _AnimatedReportItemState();
}

class _AnimatedReportItemState extends State<_AnimatedReportItem>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 320),
      vsync: this,
    );
    _opacity = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _offset = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
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

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openDetailSheet(context, item),
        splashColor: AppColors.primaryBg.withValues(alpha: 0.3),
        highlightColor: AppColors.primaryBg.withValues(alpha: 0.12),
        child: Ink(
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
        ),
      ),
    );
  }

  void _openDetailSheet(BuildContext context, Map<String, dynamic> item) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => _ReportDetailSheet(item: item),
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

/// Bottom sheet con el detalle completo de un reporte propio.
///
/// Muestra: galería de fotos (full width, sin clipar), categoría, descripción
/// completa (sin truncar), placa del vehículo, ubicación si tiene, fecha, y
/// timeline de estado (Enviado · En revisión · Validado/Rechazado).
///
/// El sheet usa DraggableScrollableSheet (initial 0.65 → expand a 0.95) para
/// que el usuario pueda arrastrar arriba si quiere ver más contenido.
class _ReportDetailSheet extends StatelessWidget {
  final Map<String, dynamic> item;
  const _ReportDetailSheet({required this.item});

  static final _dateFormat = DateFormat("d 'de' MMMM 'de' yyyy, HH:mm", 'es');

  @override
  Widget build(BuildContext context) {
    final category = item['category'] as String? ?? 'Sin categoría';
    final status = item['status'] as String? ?? 'pendiente';
    final vehiclePlate = item['vehiclePlate'] as String?;
    final description = item['description'] as String? ?? '';
    final imageUrls = (item['imageUrls'] as List?)?.cast<String>() ?? const [];
    final createdAtRaw = item['createdAt'];
    DateTime? createdAt;
    if (createdAtRaw is String) createdAt = DateTime.tryParse(createdAtRaw);
    final lat = (item['latitude'] as num?)?.toDouble();
    final lng = (item['longitude'] as num?)?.toDouble();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (ctx, scrollCtrl) => Column(
        children: [
          // Handle de drag
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 10),
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: AppColors.ink2,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header con título + close
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 8, 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Detalle del reporte',
                    style: AppTheme.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink9,
                      letterSpacing: -0.3,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  icon: const Icon(Icons.close_rounded, color: AppColors.ink7, size: 22),
                  tooltip: 'Cerrar',
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.ink2),
          // Contenido scrollable
          Expanded(
            child: ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
              children: [
                // Estado destacado
                Row(
                  children: [
                    _StatusBadge(status: status),
                    const Spacer(),
                    if (createdAt != null)
                      Text(
                        _dateFormat.format(createdAt.toLocal()),
                        style: AppTheme.inter(
                          fontSize: 11.5,
                          color: AppColors.ink5,
                          tabular: true,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                // Categoría
                Text(
                  category,
                  style: AppTheme.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                    letterSpacing: -0.4,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 14),
                // Galería de fotos
                if (imageUrls.isNotEmpty) ...[
                  _DetailPhotoGallery(urls: imageUrls),
                  const SizedBox(height: 16),
                ],
                // Vehículo (placa)
                if (vehiclePlate != null && vehiclePlate.isNotEmpty) ...[
                  _DetailRow(
                    icon: Icons.directions_car_rounded,
                    label: 'Vehículo',
                    value: vehiclePlate,
                    valueIsTabular: true,
                  ),
                  const SizedBox(height: 8),
                ],
                // Ubicación (lat, lng)
                if (lat != null && lng != null) ...[
                  _DetailRow(
                    icon: Icons.location_on_rounded,
                    label: 'Ubicación',
                    value: '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}',
                    valueIsTabular: true,
                  ),
                  const SizedBox(height: 8),
                ],
                // Descripción
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'DESCRIPCIÓN',
                    style: AppTheme.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink5,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.ink1,
                      border: Border.all(color: AppColors.ink2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      description,
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        color: AppColors.ink8,
                        height: 1.55,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                // Timeline de estado
                _StatusTimeline(status: status, createdAt: createdAt),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool valueIsTabular;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueIsTabular = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: AppColors.ink1,
            border: Border.all(color: AppColors.ink2),
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 16, color: AppColors.ink7),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink5,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                value,
                style: AppTheme.inter(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink9,
                  tabular: valueIsTabular,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Galería full-width que muestra las fotos en un PageView con dots.
class _DetailPhotoGallery extends StatefulWidget {
  final List<String> urls;
  const _DetailPhotoGallery({required this.urls});

  @override
  State<_DetailPhotoGallery> createState() => _DetailPhotoGalleryState();
}

class _DetailPhotoGalleryState extends State<_DetailPhotoGallery> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: PageView.builder(
              itemCount: widget.urls.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (_, i) => CachedNetworkImage(
                imageUrl: normalizeImageUrl(widget.urls[i]),
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: AppColors.ink1),
                errorWidget: (_, __, ___) => Container(
                  color: AppColors.ink1,
                  alignment: Alignment.center,
                  child: const Icon(Icons.broken_image_outlined,
                      color: AppColors.ink4, size: 32),
                ),
              ),
            ),
          ),
        ),
        if (widget.urls.length > 1) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.urls.length, (i) {
              final active = i == _index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active ? AppColors.primary : AppColors.ink3,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}

/// Timeline visual del estado del reporte: Enviado → Revisado → Resuelto.
class _StatusTimeline extends StatelessWidget {
  final String status;
  final DateTime? createdAt;

  const _StatusTimeline({required this.status, required this.createdAt});

  @override
  Widget build(BuildContext context) {
    // Estado actual: pendiente=0, en_revision=1, validado/rechazado=2
    final stage = switch (status) {
      'pendiente' => 0,
      'en_revision' => 1,
      'validado' || 'rechazado' => 2,
      _ => 0,
    };
    final rejected = status == 'rechazado';

    Color colorFor(int i) {
      if (i > stage) return AppColors.ink3;
      if (i == 2 && rejected) return AppColors.noApto;
      return AppColors.apto;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'PROGRESO',
          style: AppTheme.inter(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: AppColors.ink5,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _TimelineStep(
              label: 'Enviado',
              icon: Icons.send_rounded,
              color: colorFor(0),
              done: stage >= 0,
            ),
            Expanded(
              child: Container(
                height: 2,
                color: stage >= 1 ? colorFor(1) : AppColors.ink2,
              ),
            ),
            _TimelineStep(
              label: 'En revisión',
              icon: Icons.search_rounded,
              color: colorFor(1),
              done: stage >= 1,
            ),
            Expanded(
              child: Container(
                height: 2,
                color: stage >= 2 ? colorFor(2) : AppColors.ink2,
              ),
            ),
            _TimelineStep(
              label: rejected ? 'Rechazado' : 'Validado',
              icon: rejected ? Icons.close_rounded : Icons.check_rounded,
              color: colorFor(2),
              done: stage >= 2,
            ),
          ],
        ),
      ],
    );
  }
}

class _TimelineStep extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool done;

  const _TimelineStep({
    required this.label,
    required this.icon,
    required this.color,
    required this.done,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: done ? color : Colors.white,
            border: Border.all(color: color, width: 2),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 16, color: done ? Colors.white : color),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppTheme.inter(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: done ? AppColors.ink8 : AppColors.ink5,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }
}
