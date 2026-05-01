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
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 320) {
      ref.read(feedProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedProvider);

    return Container(
      color: AppColors.ink1,
      child: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.read(feedProvider.notifier).refresh(),
        child: CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(width: 5, height: 5, decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        Text(
                          'COMUNIDAD SFIT',
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
                      'Feed de reportes',
                      style: AppTheme.inter(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink9,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _FilterBarDelegate(
                filters: state.filters,
                onChanged: (f) =>
                    ref.read(feedProvider.notifier).setFilters(f),
              ),
            ),
            if (state.loading)
              const SliverToBoxAdapter(child: _FeedLoading())
            else if (state.error != null && state.items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _FeedError(
                  message: state.error!,
                  onRetry: () =>
                      ref.read(feedProvider.notifier).refresh(),
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
                  return FeedPostCard(
                    report: r,
                    onTap: () => _openDetail(r),
                    onToggleApoyo: () => _toggleApoyo(r.id),
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

  @override
  double get minExtent => 96;
  @override
  double get maxExtent => 96;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: AppColors.ink1,
      child: Column(
        children: [
          // Fila 1: regiones (segmented)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: SegmentedButton<FeedRegion>(
              showSelectedIcon: false,
              style: ButtonStyle(
                visualDensity: VisualDensity.compact,
                textStyle: WidgetStatePropertyAll(
                  AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                backgroundColor: WidgetStateProperty.resolveWith((states) {
                  if (states.contains(WidgetState.selected)) {
                    return AppColors.primary;
                  }
                  return Colors.white;
                }),
                foregroundColor: WidgetStateProperty.resolveWith((states) {
                  if (states.contains(WidgetState.selected)) {
                    return Colors.white;
                  }
                  return AppColors.ink8;
                }),
                side: const WidgetStatePropertyAll(
                  BorderSide(color: AppColors.ink2),
                ),
              ),
              segments: FeedRegion.values
                  .map((r) => ButtonSegment(value: r, label: Text(r.label)))
                  .toList(),
              selected: {filters.region},
              onSelectionChanged: (sel) =>
                  onChanged(filters.copyWith(region: sel.first)),
            ),
          ),
          // Fila 2: categorías scrolleables + orden
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      _CategoryChip(
                        label: 'Todas',
                        selected: filters.category == null,
                        onTap: () => onChanged(filters.copyWith(category: null)),
                      ),
                      ...kReportCategories.map(
                        (c) => _CategoryChip(
                          label: c,
                          selected: filters.category == c,
                          onTap: () =>
                              onChanged(filters.copyWith(category: c)),
                        ),
                      ),
                    ],
                  ),
                ),
                _OrderButton(
                  current: filters.order,
                  onChange: (o) => onChanged(filters.copyWith(order: o)),
                ),
                const SizedBox(width: 8),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_FilterBarDelegate oldDelegate) =>
      oldDelegate.filters.region != filters.region ||
      oldDelegate.filters.category != filters.category ||
      oldDelegate.filters.order != filters.order;
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryChip({
    required this.label,
    required this.selected,
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
            child: Text(
              label,
              style: AppTheme.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppColors.ink7,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderButton extends StatelessWidget {
  final FeedOrder current;
  final ValueChanged<FeedOrder> onChange;

  const _OrderButton({required this.current, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<FeedOrder>(
      tooltip: 'Ordenar',
      initialValue: current,
      onSelected: onChange,
      itemBuilder: (_) => FeedOrder.values
          .map((o) => PopupMenuItem(value: o, child: Text(o.label)))
          .toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
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
              size: 14,
              color: AppColors.ink7,
            ),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more_rounded,
                size: 16, color: AppColors.ink5),
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
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 14),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: avatar + nombre + ubicación
          Row(
            children: [
              _ShimmerBox(controller: controller, width: 36, height: 36, radius: 18),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ShimmerBox(controller: controller, width: 120, height: 12, radius: 4),
                  const SizedBox(height: 6),
                  _ShimmerBox(controller: controller, width: 80, height: 10, radius: 3),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Imagen placeholder (4:3 como el carrusel real)
          AspectRatio(
            aspectRatio: 4 / 3,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: _ShimmerBox(
                controller: controller,
                width: double.infinity,
                height: double.infinity,
                radius: 8,
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Categoría + descripción (2 líneas)
          _ShimmerBox(controller: controller, width: 140, height: 12, radius: 4),
          const SizedBox(height: 8),
          _ShimmerBox(controller: controller, width: double.infinity, height: 10, radius: 3),
          const SizedBox(height: 6),
          _ShimmerBox(controller: controller, width: 220, height: 10, radius: 3),
        ],
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
              colors: const [
                AppColors.ink1,
                AppColors.ink2,
                AppColors.ink1,
              ],
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
          const Icon(Icons.cloud_off_rounded, size: 56, color: AppColors.noApto),
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
