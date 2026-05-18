import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/navigation/navigation_key.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../../reports/data/models/report_model.dart';
import '../../data/models/feed_report_model.dart';
import '../providers/feed_provider.dart';
import '../widgets/feed_post_card.dart';

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({super.key});

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  final ScrollController _scroll = ScrollController();
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_initialized) {
        _initialized = true;
        ref.read(feedProvider.notifier).refresh();
      }
    });
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 320) {
      ref.read(feedProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedProvider);

    return Container(
      color: Colors.white,
      child: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.read(feedProvider.notifier).refresh(),
        child: CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPersistentHeader(
              pinned: true,
              delegate: _FilterBarDelegate(
                filters: state.filters,
                onChanged: (f) => ref.read(feedProvider.notifier).setFilters(f),
              ),
            ),
            if (state.loading)
              const SliverToBoxAdapter(child: _FeedLoading())
            else if (state.error != null && state.items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _FeedError(
                  message: state.error!,
                  onRetry: () => ref.read(feedProvider.notifier).refresh(),
                ),
              )
            else if (state.items.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: _FeedEmpty(),
              )
            else ...[
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              SliverList.builder(
                itemCount: state.items.length + (state.hasMore ? 1 : 0),
                itemBuilder: (context, i) {
                  if (i >= state.items.length) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    );
                  }
                  final r = state.items[i];
                  return _AnimatedFeedItem(
                    key: ValueKey(r.id),
                    child: FeedPostCard(
                      report: r,
                      onTap: () => _openDetail(r),
                      onToggleApoyo: () => _toggleApoyo(r.id),
                    ),
                  );
                },
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 32)),
            ],
          ],
        ),
      ),
    );
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

  void _openDetail(FeedReport r) {
    context.push('/feed/${r.id}', extra: r);
  }
}

class _FilterBarDelegate extends SliverPersistentHeaderDelegate {
  final FeedFilters filters;
  final ValueChanged<FeedFilters> onChanged;

  _FilterBarDelegate({required this.filters, required this.onChanged});

  // Una sola fila de chips (Solo míos · Orden · Categorías). El feed
  // siempre muestra reportes de la municipalidad activa — el filtro de
  // región (distrito/provincia/Perú) se retiró con el cleanup municipal.
  @override
  double get minExtent => 48;
  @override
  double get maxExtent => 48;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.ink2, width: 1)),
      ),
      child: ShaderMask(
        shaderCallback:
            (bounds) => const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              stops: [0.0, 0.015, 0.985, 1.0],
              colors: [
                Colors.transparent,
                Colors.black,
                Colors.black,
                Colors.transparent,
              ],
            ).createShader(bounds),
        blendMode: BlendMode.dstIn,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 8,
          ),
          children: [
            _CategoryChip(
              label: 'Solo míos',
              selected: filters.mine,
              onTap: () => onChanged(filters.copyWith(mine: !filters.mine)),
              icon: Icons.person_rounded,
            ),
            Container(
              width: 1,
              height: 22,
              color: AppColors.ink2,
              margin: const EdgeInsets.symmetric(horizontal: 8),
            ),
            _OrderChip(
              current: filters.order,
              onChange: (o) => onChanged(filters.copyWith(order: o)),
            ),
            Container(
              width: 1,
              height: 22,
              color: AppColors.ink2,
              margin: const EdgeInsets.symmetric(horizontal: 8),
            ),
            _CategoryChip(
              label: 'Todas',
              selected: filters.category == null,
              onTap: () => onChanged(filters.copyWith(category: null)),
            ),
            ...kReportCategories.map(
              (c) => _CategoryChip(
                label: c,
                selected: filters.category == c,
                onTap: () => onChanged(filters.copyWith(category: c)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(_FilterBarDelegate oldDelegate) =>
      oldDelegate.filters.category != filters.category ||
      oldDelegate.filters.order != filters.order ||
      oldDelegate.filters.mine != filters.mine;
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  const _CategoryChip({
    required this.label,
    required this.selected,
    this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: selected ? AppColors.ink9 : Colors.white,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: selected ? AppColors.ink9 : AppColors.ink2,
              ),
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(
                    icon,
                    size: 13,
                    color: selected ? Colors.white : AppColors.ink7,
                  ),
                  const SizedBox(width: 5),
                ],
                Text(
                  label,
                  style: AppTheme.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white : AppColors.ink7,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Chip de orden integrado en la fila de chips de categoría.
///
/// Visualmente igual a un `_CategoryChip` pero con un ícono distintivo y
/// abre un PopupMenu con las opciones (Recientes / Más apoyados). El estado
/// activo cambia el color del chip a primaryBg cuando hay una opción no-default.
class _OrderChip extends StatelessWidget {
  final FeedOrder current;
  final ValueChanged<FeedOrder> onChange;

  const _OrderChip({required this.current, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<FeedOrder>(
      tooltip: 'Ordenar feed',
      initialValue: current,
      onSelected: onChange,
      offset: const Offset(0, 36),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      color: Colors.white,
      itemBuilder:
          (_) =>
              FeedOrder.values.map((o) {
                final selected = o == current;
                return PopupMenuItem(
                  value: o,
                  height: 40,
                  child: Row(
                    children: [
                      Icon(
                        o == FeedOrder.recent
                            ? Icons.schedule_rounded
                            : Icons.local_fire_department_rounded,
                        size: 16,
                        color: selected ? AppColors.primary : AppColors.ink6,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        o.label,
                        style: AppTheme.inter(
                          fontSize: 13,
                          fontWeight:
                              selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected ? AppColors.primary : AppColors.ink8,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              current == FeedOrder.recent
                  ? Icons.schedule_rounded
                  : Icons.local_fire_department_rounded,
              size: 13,
              color: AppColors.ink7,
            ),
            const SizedBox(width: 5),
            Text(
              current.label,
              style: AppTheme.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(width: 2),
            const Icon(
              Icons.expand_more_rounded,
              size: 14,
              color: AppColors.ink5,
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedLoading extends StatefulWidget {
  const _FeedLoading();

  @override
  State<_FeedLoading> createState() => _FeedLoadingState();
}

class _FeedLoadingState extends State<_FeedLoading>
    with SingleTickerProviderStateMixin {
  // Un único AnimationController compartido entre los 3 skeletons.
  // Antes cada SkeletonCard creaba su propio controller, gastando GPU
  // y memoria innecesariamente.
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1100),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 32),
      child: Column(
        children: [
          _SkeletonCard(controller: _ctrl),
          _SkeletonCard(controller: _ctrl),
          _SkeletonCard(controller: _ctrl),
        ],
      ),
    );
  }
}

/// Card placeholder con shimmer animado mientras carga el feed.
/// Recibe el `AnimationController` desde el padre para no crear uno
/// por instancia.
class _SkeletonCard extends StatelessWidget {
  final AnimationController controller;
  const _SkeletonCard({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.ink2, width: 1)),
      ),
      child: Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: avatar + nombre + ubicación
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _ShimmerBox(
                    controller: controller,
                    width: 40,
                    height: 40,
                    radius: 20,
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ShimmerBox(
                        controller: controller,
                        width: 120,
                        height: 14,
                        radius: 4,
                      ),
                      const SizedBox(height: 6),
                      _ShimmerBox(
                        controller: controller,
                        width: 80,
                        height: 10,
                        radius: 3,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            // Imagen placeholder (4:3 como el carrusel real) sin márgenes laterales
            AspectRatio(
              aspectRatio: 4 / 3,
              child: _ShimmerBox(
                controller: controller,
                width: double.infinity,
                height: double.infinity,
                radius: 0,
              ),
            ),
            const SizedBox(height: 12),
            // Categoría + descripción (2 líneas)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ShimmerBox(
                    controller: controller,
                    width: 140,
                    height: 12,
                    radius: 4,
                  ),
                  const SizedBox(height: 8),
                  _ShimmerBox(
                    controller: controller,
                    width: double.infinity,
                    height: 10,
                    radius: 3,
                  ),
                  const SizedBox(height: 6),
                  _ShimmerBox(
                    controller: controller,
                    width: 220,
                    height: 10,
                    radius: 3,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _ShimmerBox(
                        controller: controller,
                        width: 60,
                        height: 24,
                        radius: 12,
                      ),
                      const SizedBox(width: 16),
                      _ShimmerBox(
                        controller: controller,
                        width: 60,
                        height: 24,
                        radius: 12,
                      ),
                      const SizedBox(width: 16),
                      _ShimmerBox(
                        controller: controller,
                        width: 60,
                        height: 24,
                        radius: 12,
                      ),
                    ],
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

class _ShimmerBox extends StatelessWidget {
  final AnimationController controller;
  final double width;
  final double height;
  final double radius;

  const _ShimmerBox({
    required this.controller,
    required this.width,
    required this.height,
    required this.radius,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (_, __) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: LinearGradient(
              begin: Alignment(-1 + controller.value * 2, -0.3),
              end: Alignment(1 + controller.value * 2, 0.3),
              colors: const [AppColors.ink1, AppColors.ink2, AppColors.ink1],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
        );
      },
    );
  }
}

class _FeedEmpty extends StatelessWidget {
  const _FeedEmpty();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 60),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.feed_outlined, size: 56, color: AppColors.ink4),
          const SizedBox(height: 14),
          Text(
            'No hay reportes en este filtro',
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Prueba cambiar de región o categoría, o sé el primero en reportar.',
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 13,
              color: AppColors.ink5,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          SfitPrimaryButton(
            label: 'Reportar ahora',
            icon: Icons.campaign_outlined,
            expand: false,
            onPressed: () => context.go('/home?tab=reportar'),
          ),
        ],
      ),
    );
  }
}

class _FeedError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _FeedError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 60),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            size: 56,
            color: AppColors.noApto,
          ),
          const SizedBox(height: 14),
          Text(
            'No se pudo cargar el feed',
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: AppTheme.inter(
              fontSize: 12,
              color: AppColors.ink5,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('Reintentar'),
          ),
        ],
      ),
    );
  }
}

/// Wrap que anima la primera aparición de una card del feed:
/// fade + slide vertical sutil (12px abajo → 0). Solo dispara una vez por
/// instancia gracias al `ValueKey(report.id)` del padre — al volver a
/// visualizar una card ya construida no se re-anima.
class _AnimatedFeedItem extends StatefulWidget {
  final Widget child;
  const _AnimatedFeedItem({super.key, required this.child});

  @override
  State<_AnimatedFeedItem> createState() => _AnimatedFeedItemState();
}

class _AnimatedFeedItemState extends State<_AnimatedFeedItem>
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
