import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_url.dart';
import '../../data/models/feed_report_model.dart';

class FeedPostCard extends StatefulWidget {
  final FeedReport report;
  final VoidCallback onTap;
  final VoidCallback onToggleApoyo;

  const FeedPostCard({
    super.key,
    required this.report,
    required this.onTap,
    required this.onToggleApoyo,
  });

  @override
  State<FeedPostCard> createState() => _FeedPostCardState();
}

class _FeedPostCardState extends State<FeedPostCard> {
  int _imageIndex = 0;

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: widget.onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(r),
              if (r.imageUrls.isNotEmpty) _buildImageCarousel(r.imageUrls),
              _buildBody(r),
              _buildFooter(r),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(FeedReport r) {
    final showAuthorName = r.isMine ? 'Tu reporte' : (r.citizenName.isEmpty ? 'Ciudadano' : r.citizenName);
    final showInitial = r.isMine
        ? 'T'
        : (r.citizenName.isEmpty ? 'C' : r.citizenName.characters.first.toUpperCase());
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.primaryBg,
            child: Text(
              showInitial,
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        showAuthorName,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.inter(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        ),
                      ),
                    ),
                    if (r.isMine && r.status != 'validado') ...[
                      const SizedBox(width: 8),
                      _StatusPill(status: r.status),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined,
                        size: 11, color: AppColors.ink5),
                    const SizedBox(width: 2),
                    Flexible(
                      child: Text(
                        _locationLabel(r),
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.inter(
                          fontSize: 11.5,
                          color: AppColors.ink5,
                        ),
                      ),
                    ),
                    Text('  ·  ',
                        style: AppTheme.inter(
                            fontSize: 11.5, color: AppColors.ink4)),
                    Text(
                      _timeAgo(r.createdAt),
                      style: AppTheme.inter(
                        fontSize: 11.5,
                        color: AppColors.ink5,
                        tabular: true,
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

  Widget _buildImageCarousel(List<String> urls) {
    return AspectRatio(
      aspectRatio: 4 / 3,
      child: Stack(
        children: [
          PageView.builder(
            itemCount: urls.length,
            onPageChanged: (i) => setState(() => _imageIndex = i),
            itemBuilder: (context, i) => CachedNetworkImage(
              imageUrl: normalizeImageUrl(urls[i]),
              fit: BoxFit.cover,
              fadeInDuration: const Duration(milliseconds: 220),
              placeholder: (_, __) => Container(
                color: AppColors.ink1,
                alignment: Alignment.center,
                child: const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: AppColors.ink4),
                ),
              ),
              errorWidget: (_, __, ___) => Container(
                color: AppColors.ink1,
                alignment: Alignment.center,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.broken_image_outlined,
                        color: AppColors.ink4, size: 36),
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
          if (urls.length > 1)
            Positioned(
              bottom: 8,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  urls.length,
                  (i) => AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _imageIndex ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _imageIndex
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
            ),
          if (urls.length > 1)
            Positioned(
              top: 8,
              right: 8,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${_imageIndex + 1}/${urls.length}',
                  style: AppTheme.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                    tabular: true,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBody(FeedReport r) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _CategoryChip(category: r.category),
              const Spacer(),
              if (r.vehicle?.plate != null)
                _PlatePill(plate: r.vehicle!.plate!),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            r.description,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: AppTheme.inter(
              fontSize: 13.5,
              color: AppColors.ink8,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(FeedReport r) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 6),
      child: Row(
        children: [
          _ActionButton(
            icon: r.apoyado
                ? Icons.favorite_rounded
                : Icons.favorite_border_rounded,
            label: '${r.apoyosCount}',
            color: r.apoyado ? AppColors.noApto : AppColors.ink6,
            onTap: widget.onToggleApoyo,
          ),
          _ActionButton(
            icon: Icons.chat_bubble_outline_rounded,
            label: 'Comentar',
            color: AppColors.ink6,
            onTap: widget.onTap,
          ),
          if (r.latitude != null && r.longitude != null)
            _ActionButton(
              icon: Icons.map_outlined,
              label: 'Ubicación',
              color: AppColors.ink6,
              onTap: widget.onTap,
            ),
        ],
      ),
    );
  }

  String _locationLabel(FeedReport r) {
    if (r.municipalityName != null && r.provinceName != null) {
      return '${r.municipalityName}, ${r.provinceName}';
    }
    if (r.municipalityName != null) return r.municipalityName!;
    if (r.provinceName != null) return r.provinceName!;
    return 'Ubicación reservada';
  }

  String _timeAgo(DateTime when) {
    final diff = DateTime.now().difference(when);
    if (diff.inMinutes < 1) return 'ahora';
    if (diff.inHours < 1) return 'hace ${diff.inMinutes}min';
    if (diff.inDays < 1) return 'hace ${diff.inHours}h';
    if (diff.inDays < 7) return 'hace ${diff.inDays}d';
    if (diff.inDays < 30) return 'hace ${(diff.inDays / 7).floor()}sem';
    return 'hace ${(diff.inDays / 30).floor()}m';
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 19, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: color,
                  tabular: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String category;
  const _CategoryChip({required this.category});

  @override
  Widget build(BuildContext context) {
    final (icon, bg, fg) = _styleFor(category);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: 5),
          Text(
            category,
            style: AppTheme.inter(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: fg,
              letterSpacing: -0.1,
            ),
          ),
        ],
      ),
    );
  }

  (IconData, Color, Color) _styleFor(String c) {
    final lower = c.toLowerCase();
    if (lower.contains('peligros') ||
        lower.contains('velocidad') ||
        lower.contains('agresivo')) {
      return (Icons.warning_amber_rounded, AppColors.noAptoBg, AppColors.noApto);
    }
    if (lower.contains('cobro')) {
      return (Icons.payments_outlined, AppColors.riesgoBg, AppColors.riesgo);
    }
    if (lower.contains('mal estado') || lower.contains('mantenimiento')) {
      return (Icons.car_crash_outlined, AppColors.riesgoBg, AppColors.riesgo);
    }
    if (lower.contains('contamin')) {
      return (Icons.eco_outlined, AppColors.aptoBg, AppColors.apto);
    }
    if (lower.contains('ruta') || lower.contains('señaliz')) {
      return (Icons.alt_route_rounded, AppColors.infoBg, AppColors.info);
    }
    return (Icons.report_gmailerrorred_outlined, AppColors.ink1, AppColors.ink7);
  }
}

class _PlatePill extends StatelessWidget {
  final String plate;
  const _PlatePill({required this.plate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.ink9,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.directions_car_rounded,
              size: 12, color: Colors.white),
          const SizedBox(width: 4),
          Text(
            plate,
            style: AppTheme.inter(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: 0.4,
              tabular: true,
            ),
          ),
        ],
      ),
    );
  }
}

/// Pill compacto de estado para mostrar junto a "Tu reporte" cuando el
/// reporte propio aún no fue validado por un fiscal.
class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final (bg, fg, label) = switch (status) {
      'pendiente' => (AppColors.riesgoBg, AppColors.riesgo, 'EN REVISIÓN'),
      'en_revision' => (AppColors.infoBg, AppColors.info, 'EN REVISIÓN'),
      'rechazado' => (AppColors.noAptoBg, AppColors.noApto, 'RECHAZADO'),
      _ => (AppColors.ink1, AppColors.ink6, status.toUpperCase()),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: fg.withValues(alpha: 0.3), width: 1),
      ),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: fg,
          letterSpacing: 0.7,
        ),
      ),
    );
  }
}
