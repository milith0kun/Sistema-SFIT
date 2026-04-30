import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../reports/data/models/report_model.dart';
import '../../data/models/feed_report_model.dart';
import '../providers/feed_provider.dart';
import '../widgets/feed_post_card.dart';
import 'feed_detail_page.dart';

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
            SliverPersistentHeader(
              pinned: true,
              delegate: _FilterBarDelegate(
                filters: state.filters,
                onChanged: (f) =>
                    ref.read(feedProvider.notifier).setFilters(f),
              ),
            ),
            if (state.loading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: _FeedLoading(),
              )
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

  void _openDetail(FeedReport r) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => FeedDetailPage(report: r)),
    );
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

class _FeedLoading extends StatelessWidget {
  const _FeedLoading();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: SizedBox(
        height: 30,
        width: 30,
        child: CircularProgressIndicator(
          strokeWidth: 2.4,
          color: AppColors.primary,
        ),
      ),
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
          FilledButton.icon(
            onPressed: () => context.go('/home?tab=reportar'),
            icon: const Icon(Icons.campaign_outlined, size: 18),
            label: const Text('Reportar ahora'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
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
