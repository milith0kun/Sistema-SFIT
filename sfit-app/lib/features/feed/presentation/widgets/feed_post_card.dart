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

class _FeedPostCardState extends State<FeedPostCard>
    with SingleTickerProviderStateMixin {
  int _imageIndex = 0;

  // Memoización: el valor relativo solo cambia cuando cambia minuto/hora,
  // no en cada rebuild (que puede ocurrir muchas veces por scroll/like).
  String? _cachedTimeAgo;
  DateTime? _cachedTimeAgoFor;

  // Animación del corazón overlay al double-tap (estilo IG).
  late final AnimationController _heartCtrl;
  late final Animation<double> _heartScale;
  late final Animation<double> _heartOpacity;

  @override
  void initState() {
    super.initState();
    _heartCtrl = AnimationController(
      duration: const Duration(milliseconds: 700),
      vsync: this,
    );
    _heartScale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.2), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 1.2, end: 1.0), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.7), weight: 20),
    ]).animate(CurvedAnimation(parent: _heartCtrl, curve: Curves.easeOut));
    _heartOpacity = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 20),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 30),
    ]).animate(_heartCtrl);
  }

  @override
  void dispose() {
    _heartCtrl.dispose();
    super.dispose();
  }

  /// Double-tap en la imagen: dispara el corazón flotante + toggle de apoyo
  /// (solo si no estaba apoyado — evita el "untap accidental" típico de IG).
  void _handleDoubleTapImage() {
    _heartCtrl.forward(from: 0);
    if (!widget.report.apoyado) {
      widget.onToggleApoyo();
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    final hasImage = r.imageUrls.isNotEmpty;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.ink2, width: 1)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          splashColor: AppColors.primaryBg.withValues(alpha: 0.25),
          highlightColor: AppColors.primaryBg.withValues(alpha: 0.08),
          child: Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(r),
                const SizedBox(height: 8),
                if (hasImage) _buildImageCarousel(r.imageUrls),
                _buildBody(r, hasImage: hasImage),
                const SizedBox(height: 4),
                _buildFooter(r),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(FeedReport r) {
    final showAuthorName =
        r.isMine
            ? 'Tu reporte'
            : (r.citizenName.isEmpty ? 'Ciudadano' : r.citizenName);
    final showInitial =
        r.isMine
            ? 'T'
            : (r.citizenName.isEmpty
                ? 'C'
                : r.citizenName.characters.first.toUpperCase());
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primaryBg,
            child: Text(
              showInitial,
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
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        showAuthorName,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (r.isMine && r.status != 'validado')
                      _StatusPill(status: r.status),
                    const Spacer(),
                    Text(
                      _timeAgo(r.createdAt),
                      style: AppTheme.inter(
                        fontSize: 13,
                        color: AppColors.ink5,
                        tabular: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 13,
                      color: AppColors.ink5,
                    ),
                    const SizedBox(width: 2),
                    Flexible(
                      child: Text(
                        _locationLabel(r),
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.inter(
                          fontSize: 13,
                          color: AppColors.ink5,
                        ),
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
            onPageChanged: (i) {
              setState(() => _imageIndex = i);
              // Precachear la siguiente imagen para que el swipe sea inmediato.
              final next = i + 1;
              if (next < urls.length) {
                precacheImage(
                  CachedNetworkImageProvider(normalizeImageUrl(urls[next])),
                  context,
                );
              }
            },
            itemBuilder:
                (context, i) => GestureDetector(
                  onDoubleTap: _handleDoubleTapImage,
                  child: CachedNetworkImage(
                    imageUrl: normalizeImageUrl(urls[i]),
                    fit: BoxFit.cover,
                    fadeInDuration: const Duration(milliseconds: 220),
                    placeholder:
                        (_, __) => Container(
                          color: AppColors.ink1,
                          alignment: Alignment.center,
                          child: const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.ink4,
                            ),
                          ),
                        ),
                    errorWidget:
                        (_, __, ___) => Container(
                          color: AppColors.ink1,
                          alignment: Alignment.center,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.broken_image_outlined,
                                color: AppColors.ink4,
                                size: 36,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Imagen no disponible',
                                style: AppTheme.inter(
                                  fontSize: 11,
                                  color: AppColors.ink5,
                                ),
                              ),
                            ],
                          ),
                        ),
                  ),
                ),
          ),
          // Corazón flotante overlay — aparece al double-tap, anima
          // scale 0→1.2→1 y luego fade-out. IgnorePointer para no
          // bloquear el tap normal de la imagen.
          IgnorePointer(
            child: Center(
              child: AnimatedBuilder(
                animation: _heartCtrl,
                builder: (_, __) {
                  if (_heartCtrl.value == 0) return const SizedBox.shrink();
                  return Opacity(
                    opacity: _heartOpacity.value,
                    child: Transform.scale(
                      scale: _heartScale.value,
                      child: Icon(
                        Icons.favorite_rounded,
                        size: 96,
                        color: Colors.white.withValues(alpha: 0.95),
                        shadows: [
                          Shadow(
                            color: Colors.black.withValues(alpha: 0.4),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                    ),
                  );
                },
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
                      color:
                          i == _imageIndex
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
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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

  Widget _buildBody(FeedReport r, {required bool hasImage}) {
    final hasDesc = r.description.trim().isNotEmpty;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, hasImage ? 12 : 4, 16, hasDesc ? 6 : 2),
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
          if (hasDesc) ...[
            const SizedBox(height: 12),
            Text(
              r.description,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.inter(
                fontSize: 15,
                color: AppColors.ink9,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFooter(FeedReport r) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          _LikeButton(
            apoyado: r.apoyado,
            count: r.apoyosCount,
            onTap: widget.onToggleApoyo,
          ),
          const SizedBox(width: 8),
          _ActionButton(
            icon: Icons.chat_bubble_outline_rounded,
            label: 'Comentar',
            color: AppColors.ink6,
            onTap: widget.onTap,
          ),
          const SizedBox(width: 8),
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
    // Cache: si el reporte es el mismo y ya calculamos antes, reusar.
    // El tiempo relativo cambia poco (cada minuto en el peor caso), así
    // que reusar entre rebuilds del scroll es seguro y mucho más rápido.
    if (_cachedTimeAgoFor == when && _cachedTimeAgo != null) {
      return _cachedTimeAgo!;
    }
    final diff = DateTime.now().difference(when);
    final result = switch (diff) {
      _ when diff.inMinutes < 1 => 'ahora',
      _ when diff.inHours < 1 => 'hace ${diff.inMinutes}min',
      _ when diff.inDays < 1 => 'hace ${diff.inHours}h',
      _ when diff.inDays < 7 => 'hace ${diff.inDays}d',
      _ when diff.inDays < 30 => 'hace ${(diff.inDays / 7).floor()}sem',
      _ => 'hace ${(diff.inDays / 30).floor()}m',
    };
    _cachedTimeAgo = result;
    _cachedTimeAgoFor = when;
    return result;
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
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 22, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: color,
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
    // Granular: cada categoría con su ícono distintivo (no todas con
    // warning_amber). Mantienen la paleta semántica por gravedad:
    // - rojo (noApto) para peligros directos a personas
    // - naranja (riesgo) para problemas operativos
    // - verde (apto) para impacto ambiental
    // - azul (info) para incumplimientos administrativos
    if (lower.contains('peligros')) {
      return (
        Icons.warning_amber_rounded,
        AppColors.noAptoBg,
        AppColors.noApto,
      );
    }
    if (lower.contains('velocidad')) {
      return (Icons.speed_rounded, AppColors.noAptoBg, AppColors.noApto);
    }
    if (lower.contains('agresivo')) {
      return (
        Icons.sentiment_very_dissatisfied_rounded,
        AppColors.noAptoBg,
        AppColors.noApto,
      );
    }
    if (lower.contains('cobro')) {
      return (Icons.payments_outlined, AppColors.riesgoBg, AppColors.riesgo);
    }
    if (lower.contains('mal estado')) {
      return (Icons.car_crash_outlined, AppColors.riesgoBg, AppColors.riesgo);
    }
    if (lower.contains('mantenimiento')) {
      return (
        Icons.build_circle_outlined,
        AppColors.riesgoBg,
        AppColors.riesgo,
      );
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
    return (
      Icons.report_gmailerrorred_outlined,
      AppColors.ink1,
      AppColors.ink7,
    );
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
          const Icon(
            Icons.directions_car_rounded,
            size: 12,
            color: Colors.white,
          ),
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

/// Botón de "apoyo" estilo Instagram-like con animación de scale al tap.
///
/// Cuando el usuario tap-ea, el ícono hace un pulse de 1.0 → 1.35 → 1.0 en
/// 280ms con `easeOutBack` (overshoot leve) — feedback táctil que se siente
/// "vivo". Si pasa de no-apoyado a apoyado, además cambia color con
/// AnimatedSwitcher para reforzar el estado.
class _LikeButton extends StatefulWidget {
  final bool apoyado;
  final int count;
  final VoidCallback onTap;

  const _LikeButton({
    required this.apoyado,
    required this.count,
    required this.onTap,
  });

  @override
  State<_LikeButton> createState() => _LikeButtonState();
}

class _LikeButtonState extends State<_LikeButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 280),
      vsync: this,
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.35), weight: 40),
      TweenSequenceItem(tween: Tween(begin: 1.35, end: 1.0), weight: 60),
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
    final color = widget.apoyado ? AppColors.noApto : AppColors.ink6;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: _handleTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ScaleTransition(
                scale: _scale,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  transitionBuilder:
                      (child, anim) =>
                          ScaleTransition(scale: anim, child: child),
                  child: Icon(
                    widget.apoyado
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    key: ValueKey(widget.apoyado),
                    size: 22,
                    color: color,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '${widget.count}',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
