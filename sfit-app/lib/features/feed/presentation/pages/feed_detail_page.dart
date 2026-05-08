import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/navigation/navigation_key.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_url.dart';
import '../../data/models/feed_report_model.dart';
import '../providers/feed_provider.dart';

class FeedDetailPage extends ConsumerStatefulWidget {
  final FeedReport report;

  const FeedDetailPage({super.key, required this.report});

  @override
  ConsumerState<FeedDetailPage> createState() => _FeedDetailPageState();
}

class _FeedDetailPageState extends ConsumerState<FeedDetailPage> {
  int _photoIndex = 0;

  // DateFormat es relativamente caro de instanciar (parsea el patrón).
  // Estático para reusar la misma instancia en todos los rebuilds.
  static final _detailDateFormat = DateFormat("d 'de' MMMM 'a las' HH:mm", 'es');

  @override
  Widget build(BuildContext context) {
    // Si el feed actualizó el reporte (por toggle de apoyo), reflejar esos
    // cambios. Usamos `select` para que esta página solo se reconstruya
    // cuando el reporte específico cambia, no en cualquier cambio del feed
    // (filtros, paginación, etc.).
    final r = ref.watch(
      feedProvider.select(
        (s) => s.items.firstWhere(
          (r) => r.id == widget.report.id,
          orElse: () => widget.report,
        ),
      ),
    );

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Reporte ciudadano'),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.ink9,
        shape: const Border(bottom: BorderSide(color: AppColors.ink2)),
        actions: [
          IconButton(
            tooltip: 'Compartir',
            icon: const Icon(Icons.share_outlined, size: 20),
            onPressed: () => _shareReport(r),
          ),
        ],
      ),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (r.imageUrls.isNotEmpty) _buildGallery(r.imageUrls),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(r),
                const SizedBox(height: 18),
                _buildCategoryAndPlate(r),
                if (r.description.trim().isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    decoration: BoxDecoration(
                      color: AppColors.ink1,
                      border: Border.all(color: AppColors.ink2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      r.description,
                      style: AppTheme.inter(
                        fontSize: 14,
                        color: AppColors.ink8,
                        height: 1.55,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                _AnimatedApoyoBar(
                  apoyado: r.apoyado,
                  count: r.apoyosCount,
                  onTap: () => _toggleApoyo(r.id),
                ),
              ],
            ),
          ),
          if (r.latitude != null && r.longitude != null) _buildMap(r),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildGallery(List<String> urls) {
    return Column(
      children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: Stack(
            children: [
              PageView.builder(
                itemCount: urls.length,
                onPageChanged: (i) => setState(() => _photoIndex = i),
                itemBuilder: (context, i) => GestureDetector(
                  onTap: () => _openFullscreen(urls, i),
                  child: Hero(
                    tag: 'feed-photo-${widget.report.id}-$i',
                    child: CachedNetworkImage(
                      imageUrl: normalizeImageUrl(urls[i]),
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
                            const Icon(Icons.broken_image_outlined, color: AppColors.ink4, size: 36),
                            const SizedBox(height: 6),
                            Text(
                              'Imagen no disponible',
                              style: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (urls.length > 1)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${_photoIndex + 1}/${urls.length}',
                      style: AppTheme.inter(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        tabular: true,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (urls.length > 1)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                urls.length,
                (i) => Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    color: i == _photoIndex
                        ? AppColors.ink9
                        : AppColors.ink3,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildHeader(FeedReport r) {
    return Row(
      children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: AppColors.primaryBg,
          child: Text(
            r.citizenName.isEmpty ? 'C' : r.citizenName.characters.first.toUpperCase(),
            style: AppTheme.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                r.citizenName,
                style: AppTheme.inter(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                _locationLabel(r),
                style: AppTheme.inter(
                  fontSize: 12,
                  color: AppColors.ink5,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                _detailDateFormat.format(r.createdAt.toLocal()),
                style: AppTheme.inter(
                  fontSize: 11.5,
                  color: AppColors.ink5,
                  tabular: true,
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.aptoBg,
            border: Border.all(color: AppColors.aptoBorder),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.verified_rounded,
                  size: 12, color: AppColors.apto),
              const SizedBox(width: 3),
              Text(
                'VALIDADO',
                style: AppTheme.inter(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  color: AppColors.apto,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryAndPlate(FeedReport r) {
    final (icon, bg, fg) = _categoryStyle(r.category);
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: bg,
            border: Border.all(color: fg.withValues(alpha: 0.25)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: fg),
              const SizedBox(width: 5),
              Text(
                r.category,
                style: AppTheme.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
        if (r.vehicle?.plate != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.ink9,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.directions_car_rounded,
                    size: 13, color: Colors.white),
                const SizedBox(width: 5),
                Text(
                  r.vehicle!.plate!,
                  style: AppTheme.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: 0.5,
                    tabular: true,
                  ),
                ),
                if (r.vehicle?.brand != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    '${r.vehicle!.brand}${r.vehicle?.model != null ? " ${r.vehicle!.model}" : ""}',
                    style: AppTheme.inter(
                      fontSize: 11.5,
                      color: AppColors.ink3,
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }

  // ── Helpers compartidos: categoría → (icon, bg, fg) ────────────────────
  // Mismo mapping que `feed_post_card.dart` para mantener consistencia
  // visual entre la card del feed y este detalle.
  (IconData, Color, Color) _categoryStyle(String c) {
    final lower = c.toLowerCase();
    if (lower.contains('peligros')) {
      return (Icons.warning_amber_rounded, AppColors.noAptoBg, AppColors.noApto);
    }
    if (lower.contains('velocidad')) {
      return (Icons.speed_rounded, AppColors.noAptoBg, AppColors.noApto);
    }
    if (lower.contains('agresivo')) {
      return (Icons.sentiment_very_dissatisfied_rounded, AppColors.noAptoBg, AppColors.noApto);
    }
    if (lower.contains('cobro')) {
      return (Icons.payments_outlined, AppColors.riesgoBg, AppColors.riesgo);
    }
    if (lower.contains('mal estado')) {
      return (Icons.car_crash_outlined, AppColors.riesgoBg, AppColors.riesgo);
    }
    if (lower.contains('mantenimiento')) {
      return (Icons.build_circle_outlined, AppColors.riesgoBg, AppColors.riesgo);
    }
    if (lower.contains('contamin')) {
      return (Icons.eco_outlined, AppColors.aptoBg, AppColors.apto);
    }
    if (lower.contains('ruta')) {
      return (Icons.alt_route_rounded, AppColors.infoBg, AppColors.info);
    }
    if (lower.contains('señaliz')) {
      return (Icons.traffic_outlined, AppColors.infoBg, AppColors.info);
    }
    return (Icons.report_gmailerrorred_outlined, AppColors.ink1, AppColors.ink7);
  }

  // ── Compartir reporte: texto al portapapeles + snackbar de confirmación ──
  Future<void> _shareReport(FeedReport r) async {
    final plate = r.vehicle?.plate ?? '—';
    final loc = _locationLabel(r);
    final shareText = 'Reporte SFIT · ${r.category}\n'
        'Vehículo: $plate\n'
        'Lugar: $loc\n'
        'Estado: ${r.status.toUpperCase()}\n'
        '${r.description}';
    await Clipboard.setData(ClipboardData(text: shareText));
    if (!mounted) return;
    showAppSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 10),
            Text(
              'Texto del reporte copiado',
              style: AppTheme.inter(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ],
        ),
        backgroundColor: AppColors.apto,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Widget _buildMap(FeedReport r) {
    final point = LatLng(r.latitude!, r.longitude!);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.location_on_rounded, size: 16, color: AppColors.ink7),
              const SizedBox(width: 6),
              Text(
                'Ubicación reportada',
                style: AppTheme.inter(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              height: 200,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: point,
                  initialZoom: 15,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.sfit.sfit_app',
                  ),
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: point,
                        width: 36,
                        height: 36,
                        child: const Icon(
                          Icons.location_on_rounded,
                          color: AppColors.noApto,
                          size: 36,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Coordenadas + link a Google Maps externo
          Row(
            children: [
              Expanded(
                child: Text(
                  '${r.latitude!.toStringAsFixed(5)}, ${r.longitude!.toStringAsFixed(5)}',
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink5,
                    tabular: true,
                  ),
                ),
              ),
              InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => _openInMaps(r.latitude!, r.longitude!),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.open_in_new_rounded, size: 13, color: AppColors.info),
                      const SizedBox(width: 4),
                      Text(
                        'Ver en Maps',
                        style: AppTheme.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.info,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openInMaps(double lat, double lng) async {
    final url = Uri.parse('https://www.google.com/maps?q=$lat,$lng');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _toggleApoyo(String id) async {
    try {
      await ref.read(feedProvider.notifier).toggleApoyo(id);
    } catch (e) {
      showAppSnackBar(
        SnackBar(
          content: Text('No se pudo registrar el apoyo: $e'),
          backgroundColor: AppColors.noApto,
        ),
      );
    }
  }

  void _openFullscreen(List<String> urls, int initial) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, __, ___) => _FullscreenGallery(
          urls: urls,
          initialIndex: initial,
          heroTagPrefix: 'feed-photo-${widget.report.id}',
        ),
      ),
    );
  }

  String _locationLabel(FeedReport r) {
    if (r.municipalityName != null && r.provinceName != null) {
      return '${r.municipalityName}, ${r.provinceName}';
    }
    return r.municipalityName ?? r.provinceName ?? 'Ubicación reservada';
  }
}

class _FullscreenGallery extends StatefulWidget {
  final List<String> urls;
  final int initialIndex;
  final String heroTagPrefix;

  const _FullscreenGallery({
    required this.urls,
    required this.initialIndex,
    required this.heroTagPrefix,
  });

  @override
  State<_FullscreenGallery> createState() => _FullscreenGalleryState();
}

class _FullscreenGalleryState extends State<_FullscreenGallery> {
  late int _index;
  late final PageController _controller;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _controller = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.urls.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) => InteractiveViewer(
              minScale: 1,
              maxScale: 4,
              child: Hero(
                tag: '${widget.heroTagPrefix}-$i',
                child: CachedNetworkImage(
                  imageUrl: normalizeImageUrl(widget.urls[i]),
                  fit: BoxFit.contain,
                  placeholder: (_, __) => const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                  errorWidget: (_, __, ___) => const Icon(
                    Icons.broken_image_outlined,
                    color: Colors.white54,
                    size: 56,
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ),
          if (widget.urls.length > 1)
            Positioned(
              bottom: 24,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${_index + 1} / ${widget.urls.length}',
                    style: AppTheme.inter(
                      fontSize: 13,
                      color: Colors.white,
                      tabular: true,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Barra de apoyo con corazón animado (scale pulse + cross-fade) + counter
/// dinámico. Reemplaza la versión estática anterior. Al tap dispara una
/// animación 1.0 → 1.4 → 1.0 con `easeOutBack` (overshoot leve), luego
/// llama al callback de toggle.
class _AnimatedApoyoBar extends StatefulWidget {
  final bool apoyado;
  final int count;
  final VoidCallback onTap;

  const _AnimatedApoyoBar({
    required this.apoyado,
    required this.count,
    required this.onTap,
  });

  @override
  State<_AnimatedApoyoBar> createState() => _AnimatedApoyoBarState();
}

class _AnimatedApoyoBarState extends State<_AnimatedApoyoBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 320),
      vsync: this,
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.4), weight: 40),
      TweenSequenceItem(tween: Tween(begin: 1.4, end: 1.0), weight: 60),
    ]).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _handleTap() {
    _ctrl.forward(from: 0);
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.apoyado ? AppColors.noApto : AppColors.ink8;
    final label = widget.count == 0
        ? 'Sé el primero en apoyar'
        : 'Apoyado por ${widget.count} ${widget.count == 1 ? "ciudadano" : "ciudadanos"}';

    return Material(
      color: AppColors.ink1,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: _handleTap,
        splashColor: AppColors.noAptoBg.withValues(alpha: 0.6),
        highlightColor: AppColors.noAptoBg.withValues(alpha: 0.25),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.ink2),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              ScaleTransition(
                scale: _scale,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  transitionBuilder: (child, anim) =>
                      ScaleTransition(scale: anim, child: child),
                  child: Icon(
                    widget.apoyado
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    key: ValueKey(widget.apoyado),
                    size: 24,
                    color: accent,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink8,
                    height: 1.3,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: widget.apoyado ? AppColors.noApto : AppColors.ink9,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      widget.apoyado
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      widget.apoyado ? 'Apoyando' : 'Apoyar',
                      style: AppTheme.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
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
}
