import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../reports/data/datasources/reports_api_service.dart';
import '../../data/models/feed_report_model.dart';

class FeedFilters {
  final FeedRegion region;
  final FeedOrder order;
  final String? category;

  const FeedFilters({
    this.region = FeedRegion.municipality,
    this.order = FeedOrder.recent,
    this.category,
  });

  FeedFilters copyWith({
    FeedRegion? region,
    FeedOrder? order,
    Object? category = _kSentinel,
  }) =>
      FeedFilters(
        region: region ?? this.region,
        order: order ?? this.order,
        category: category == _kSentinel ? this.category : category as String?,
      );

  static const _kSentinel = Object();
}

class FeedState {
  final List<FeedReport> items;
  final FeedFilters filters;
  final bool loading;
  final bool loadingMore;
  final bool hasMore;
  final int page;
  final String? error;

  const FeedState({
    this.items = const [],
    this.filters = const FeedFilters(),
    this.loading = false,
    this.loadingMore = false,
    this.hasMore = true,
    this.page = 0,
    this.error,
  });

  FeedState copyWith({
    List<FeedReport>? items,
    FeedFilters? filters,
    bool? loading,
    bool? loadingMore,
    bool? hasMore,
    int? page,
    Object? error = _kSentinel,
  }) =>
      FeedState(
        items: items ?? this.items,
        filters: filters ?? this.filters,
        loading: loading ?? this.loading,
        loadingMore: loadingMore ?? this.loadingMore,
        hasMore: hasMore ?? this.hasMore,
        page: page ?? this.page,
        error: error == _kSentinel ? this.error : error as String?,
      );

  static const _kSentinel = Object();
}

class FeedNotifier extends StateNotifier<FeedState> {
  FeedNotifier(this._api) : super(const FeedState());

  final ReportsApiService _api;
  static const int _pageSize = 15;

  Future<void> refresh() async {
    state = state.copyWith(
      loading: true,
      page: 0,
      items: [],
      hasMore: true,
      error: null,
    );
    await _fetch(reset: true);
  }

  Future<void> loadMore() async {
    if (state.loadingMore || state.loading || !state.hasMore) return;
    state = state.copyWith(loadingMore: true);
    await _fetch(reset: false);
  }

  Future<void> setFilters(FeedFilters filters) async {
    state = state.copyWith(
      filters: filters,
      loading: true,
      page: 0,
      items: [],
      hasMore: true,
      error: null,
    );
    await _fetch(reset: true);
  }

  Future<void> _fetch({required bool reset}) async {
    final nextPage = reset ? 1 : state.page + 1;
    try {
      final result = await _api.getFeed(
        region: state.filters.region.apiValue,
        category: state.filters.category,
        order: state.filters.order.apiValue,
        page: nextPage,
        limit: _pageSize,
      );
      final items = (result['items'] as List)
          .map((e) => FeedReport.fromJson(e as Map<String, dynamic>))
          .toList();
      final hasMore = result['hasMore'] as bool? ?? false;
      state = state.copyWith(
        items: reset ? items : [...state.items, ...items],
        loading: false,
        loadingMore: false,
        hasMore: hasMore,
        page: nextPage,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        loadingMore: false,
        error: e.toString(),
      );
    }
  }

  Future<void> toggleApoyo(String reportId) async {
    // Actualización optimista
    final original = state.items;
    final idx = original.indexWhere((r) => r.id == reportId);
    if (idx == -1) return;
    final current = original[idx];
    final optimistic = current.copyWith(
      apoyado: !current.apoyado,
      apoyosCount: current.apoyosCount + (current.apoyado ? -1 : 1),
    );
    final next = [...original]..[idx] = optimistic;
    state = state.copyWith(items: next);

    try {
      final result = await _api.toggleApoyo(reportId);
      final apoyado = result['apoyado'] as bool;
      final total = result['totalApoyos'] as int;
      final updated = optimistic.copyWith(apoyado: apoyado, apoyosCount: total);
      final reverted = [...state.items];
      final i = reverted.indexWhere((r) => r.id == reportId);
      if (i != -1) {
        reverted[i] = updated;
        state = state.copyWith(items: reverted);
      }
    } catch (_) {
      // Revertir en caso de error
      final reverted = [...state.items];
      final i = reverted.indexWhere((r) => r.id == reportId);
      if (i != -1) {
        reverted[i] = current;
        state = state.copyWith(items: reverted);
      }
      rethrow;
    }
  }
}

final feedProvider = StateNotifierProvider<FeedNotifier, FeedState>((ref) {
  return FeedNotifier(ref.watch(reportsApiServiceProvider));
});
