import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
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

  @override
  Widget build(BuildContext context) {
    // Si el feed actualizó el reporte (por toggle de apoyo), reflejar esos
    // cambios aquí buscándolo por id en el state.
    final inFeed = ref
        .watch(feedProvider)
        .items
        .firstWhere((r) => r.id == widget.report.id, orElse: () => widget.report);
    final r = inFeed;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Reporte ciudadano'),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.ink9,
        shape: const Border(bottom: BorderSide(color: AppColors.ink2)),
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
                const SizedBox(height: 14),
                Text(
                  r.description,
                  style: AppTheme.inter(
                    fontSize: 14.5,
                    color: AppColors.ink8,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 18),
                _buildApoyoBar(r),
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
                      imageUrl: urls[i],
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: AppColors.ink1),
                      errorWidget: (_, __, ___) => Container(
                        color: AppColors.ink1,
                        alignment: Alignment.center,
                        child: const Icon(Icons.broken_image_outlined,
                            color: AppColors.ink4, size: 36),
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
            r.citizenName.characters.first.toUpperCase(),
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
                DateFormat("d 'de' MMMM 'a las' HH:mm", 'es')
                    .format(r.createdAt.toLocal()),
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
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.noAptoBg,
            border: Border.all(color: AppColors.noAptoBorder),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.warning_amber_rounded,
                  size: 14, color: AppColors.noApto),
              const SizedBox(width: 5),
              Text(
                r.category,
                style: AppTheme.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.noApto,
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

  Widget _buildApoyoBar(FeedReport r) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(
            r.apoyado ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            color: r.apoyado ? AppColors.noApto : AppColors.ink6,
            size: 22,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              r.apoyosCount == 0
                  ? 'Sé el primero en apoyar'
                  : 'Apoyado por ${r.apoyosCount} ${r.apoyosCount == 1 ? "ciudadano" : "ciudadanos"}',
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.ink8,
              ),
            ),
          ),
          FilledButton.icon(
            onPressed: () => _toggleApoyo(r.id),
            icon: Icon(
              r.apoyado
                  ? Icons.favorite_rounded
                  : Icons.favorite_border_rounded,
              size: 16,
            ),
            label: Text(r.apoyado ? 'Apoyando' : 'Apoyar'),
            style: FilledButton.styleFrom(
              backgroundColor: r.apoyado ? AppColors.noApto : AppColors.ink9,
              foregroundColor: Colors.white,
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              textStyle:
                  AppTheme.inter(fontSize: 12.5, fontWeight: FontWeight.w700),
            ),
          ),
        ],
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
          Text(
            'Ubicación reportada',
            style: AppTheme.inter(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
            ),
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
        ],
      ),
    );
  }

  Future<void> _toggleApoyo(String id) async {
    try {
      await ref.read(feedProvider.notifier).toggleApoyo(id);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No se pudo registrar el apoyo: $e'),
            backgroundColor: AppColors.noApto,
          ),
        );
      }
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
                  imageUrl: widget.urls[i],
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
