import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_loading.dart';
import '../../data/datasources/inspection_api_service.dart';
import '../../data/models/inspection_model.dart';

// ── Modelo de resumen diario ─────────────────────────────────────
class _DailySummary {
  final int total;
  final int approved;
  final int observed;
  final int rejected;

  const _DailySummary({
    required this.total,
    required this.approved,
    required this.observed,
    required this.rejected,
  });
}

/// Lista de inspecciones del fiscal — RF-11.
class InspectionsListPage extends ConsumerStatefulWidget {
  const InspectionsListPage({super.key});

  @override
  ConsumerState<InspectionsListPage> createState() => _InspectionsListPageState();
}

class _InspectionsListPageState extends ConsumerState<InspectionsListPage> {
  List<InspectionModel> _items = [];
  bool _loading     = true;
  String? _error;

  // ── Filtros ──────────────────────────────────────────────────
  String _selectedResult = 'todas'; // todas | aprobada | observada | rechazada
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  // ── Resumen diario ───────────────────────────────────────────
  _DailySummary? _summary;
  bool _loadingSummary = true;

  @override
  void initState() {
    super.initState();
    _load();
    _loadSummary();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  // ── Carga principal ─────────────────────────────────────────
  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(inspectionApiServiceProvider);
      final result = _selectedResult == 'todas' ? null : _selectedResult;
      final plate  = _searchCtrl.text.trim().isEmpty ? null : _searchCtrl.text.trim();
      final items  = await svc.getInspections(limit: 50, result: result, plate: plate);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _error = 'No se pudieron cargar las inspecciones.'; _loading = false; });
    }
  }

  // ── Carga del resumen diario ─────────────────────────────────
  Future<void> _loadSummary() async {
    setState(() => _loadingSummary = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/admin/stats/fiscal');
      final data = (resp.data as Map)['data'] as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _summary = _DailySummary(
            total:    (data['total']    as num?)?.toInt() ?? 0,
            approved: (data['aprobada'] as num?)?.toInt() ?? 0,
            observed: (data['observada'] as num?)?.toInt() ?? 0,
            rejected: (data['rechazada'] as num?)?.toInt() ?? 0,
          );
          _loadingSummary = false;
        });
      }
    } catch (_) {
      // Fallback: calcula de la lista si el endpoint no responde
      if (mounted) _buildSummaryFromList();
    }
  }

  void _buildSummaryFromList() {
    final today = DateTime.now();
    final todayItems = _items.where((e) =>
      e.date.year  == today.year &&
      e.date.month == today.month &&
      e.date.day   == today.day,
    ).toList();
    setState(() {
      _summary = _DailySummary(
        total:    todayItems.length,
        approved: todayItems.where((e) => e.result == 'aprobada').length,
        observed: todayItems.where((e) => e.result == 'observada').length,
        rejected: todayItems.where((e) => e.result == 'rechazada').length,
      );
      _loadingSummary = false;
    });
  }

  // ── Cambio de filtro por resultado ───────────────────────────
  void _onResultFilterChanged(String value) {
    setState(() => _selectedResult = value);
    _load();
  }

  // ── Cambio en el campo de búsqueda con debounce ──────────────
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), _load);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          // ── Header con botón nueva inspección ───────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text('Inspecciones',
                      style: AppTheme.inter(
                        fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink9,
                      )),
                ),
                FilledButton.icon(
                  onPressed: () => context.push('/qr').then((_) { _load(); _loadSummary(); }),
                  icon: const Icon(Icons.qr_code_scanner, size: 16),
                  label: const Text('Escanear QR'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.panel,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ),

          // ── Resumen diario (KPI strip) ────────────────────────────
          _DailySummaryStrip(summary: _summary, loading: _loadingSummary),

          // ── Filtro por resultado ──────────────────────────────────
          _ResultFilterChips(
            selected: _selectedResult,
            onChanged: _onResultFilterChanged,
          ),

          // ── Búsqueda por placa ────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                hintText: 'Buscar por placa…',
                hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
                prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.ink4),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 16, color: AppColors.ink4),
                        onPressed: () {
                          _searchCtrl.clear();
                          _load();
                          setState(() {});
                        },
                      )
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.ink2),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.ink2),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.ink7, width: 1.5),
                ),
                filled: true,
                fillColor: Colors.white,
              ),
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink9, tabular: true),
            ),
          ),

          // ── Lista ─────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const _InspectionsSkeleton()
                : _error != null
                    ? _ErrorState(message: _error!, onRetry: _load)
                    : _items.isEmpty
                        ? _EmptyState(onScan: () => context.push('/qr').then((_) { _load(); _loadSummary(); }))
                        : RefreshIndicator(
                            onRefresh: () async { await _load(); await _loadSummary(); },
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) => _InspectionCard(item: _items[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ── Widget: Resumen diario KPI ───────────────────────────────────
class _DailySummaryStrip extends StatelessWidget {
  final _DailySummary? summary;
  final bool loading;

  const _DailySummaryStrip({required this.summary, required this.loading});

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
        child: SizedBox(
          height: 62,
          child: Center(
            child: SfitLoading(size: 32),
          ),
        ),
      );
    }
    if (summary == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Row(
        children: [
          _SummaryKpi(
            label: 'Total hoy',
            value: '${summary!.total}',
            color: AppColors.info,
            bg: AppColors.infoBg,
          ),
          const SizedBox(width: 6),
          _SummaryKpi(
            label: 'Aprobadas',
            value: '${summary!.approved}',
            color: AppColors.apto,
            bg: AppColors.aptoBg,
          ),
          const SizedBox(width: 6),
          _SummaryKpi(
            label: 'Observadas',
            value: '${summary!.observed}',
            color: AppColors.riesgo,
            bg: AppColors.riesgoBg,
          ),
          const SizedBox(width: 6),
          _SummaryKpi(
            label: 'Rechazadas',
            value: '${summary!.rejected}',
            color: AppColors.noApto,
            bg: AppColors.noAptoBg,
          ),
        ],
      ),
    );
  }
}

class _SummaryKpi extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final Color bg;

  const _SummaryKpi({
    required this.label,
    required this.value,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: color.withValues(alpha: 0.25)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(value,
                style: AppTheme.inter(
                    fontSize: 18, fontWeight: FontWeight.w800,
                    color: color, tabular: true)),
            Text(label,
                style: AppTheme.inter(fontSize: 9.5, color: color.withValues(alpha: 0.85)),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

// ── Widget: Chips de filtro por resultado ─────────────────────────
class _ResultFilterChips extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const _ResultFilterChips({required this.selected, required this.onChanged});

  static const _filters = [
    ('todas',     'Todas'),
    ('aprobada',  'Aprobadas'),
    ('observada', 'Observadas'),
    ('rechazada', 'Rechazadas'),
  ];

  Color _chipColor(String key) => switch (key) {
    'aprobada'  => AppColors.apto,
    'observada' => AppColors.riesgo,
    'rechazada' => AppColors.noApto,
    _           => AppColors.panel,
  };

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (key, label) = _filters[i];
          final isSelected = selected == key;
          final color = _chipColor(key);
          return GestureDetector(
            onTap: () => onChanged(key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? color : Colors.white,
                border: Border.all(
                  color: isSelected ? color : AppColors.ink2,
                  width: isSelected ? 1.5 : 1,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                label,
                style: AppTheme.inter(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : AppColors.ink6,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Tarjeta de inspección ─────────────────────────────────────────
class _InspectionCard extends StatelessWidget {
  final InspectionModel item;
  const _InspectionCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border) = switch (item.result) {
      'aprobada'  => (AppColors.apto,   AppColors.aptoBg,   AppColors.aptoBorder),
      'observada' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder),
      _           => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
    };

    final plate = item.vehicle?.plate ?? '—';
    final type  = item.vehicle?.vehicleTypeKey ?? item.vehicleTypeKey;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: bg, border: Border.all(color: border),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '${item.score}',
              style: AppTheme.inter(
                  fontSize: 16, fontWeight: FontWeight.w800, color: color, tabular: true),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(plate,
                    style: AppTheme.inter(
                        fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink9)),
                Text(_vehicleTypeLabel(type),
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _resultLabel(item.result),
                style: AppTheme.inter(
                    fontSize: 12, fontWeight: FontWeight.w700, color: color),
              ),
              Text(
                _formatDate(item.date),
                style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _vehicleTypeLabel(String k) => switch (k) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos'  => 'Limpieza',
        'emergencia'         => 'Emergencia',
        'maquinaria'         => 'Maquinaria',
        _                    => 'Municipal',
      };

  String _resultLabel(String r) => switch (r) {
        'aprobada'  => 'Aprobada',
        'observada' => 'Observada',
        _           => 'Rechazada',
      };

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month) return 'Hoy';
    return '${d.day}/${d.month}/${d.year}';
  }
}

// ── Estado vacío ──────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final VoidCallback onScan;
  const _EmptyState({required this.onScan});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.assignment_outlined, size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text('Sin inspecciones',
                style: AppTheme.inter(
                    fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink7)),
            const SizedBox(height: 6),
            Text('Escanea el QR de un vehículo para iniciar',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onScan,
              icon: const Icon(Icons.qr_code_scanner, size: 18),
              label: const Text('Escanear QR'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Estado de error ───────────────────────────────────────────────
class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: AppColors.noApto),
            const SizedBox(height: 10),
            Text(message, textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
            const SizedBox(height: 14),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}

// ── Skeleton de carga — shimmer básico con TweenAnimationBuilder ──────────────

/// Muestra 4 tarjetas fantasma mientras las inspecciones se cargan.
/// No requiere dependencia shimmer — usa TweenAnimationBuilder con opacidad
/// alternante entre 0.3 y 0.7.
class _InspectionsSkeleton extends StatelessWidget {
  const _InspectionsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.3, end: 0.7),
        duration: Duration(milliseconds: 900 + i * 100),
        curve: Curves.easeInOut,
        builder: (context, opacity, child) {
          return Opacity(opacity: opacity, child: child);
        },
        onEnd: null, // TweenAnimationBuilder no hace loop nativo;
        // el efecto se reinicia al rebuild del widget.
        child: const _SkeletonCard(),
      ),
    );
  }
}

class _SkeletonCard extends StatefulWidget {
  const _SkeletonCard();

  @override
  State<_SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<_SkeletonCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.3, end: 0.7).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, child) => Opacity(opacity: _opacity.value, child: child),
      child: Container(
        height: 58,
        decoration: BoxDecoration(
          color: AppColors.ink2,
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Score placeholder
            Container(
              width: 36,
              height: 34,
              decoration: BoxDecoration(
                color: AppColors.ink3,
                borderRadius: BorderRadius.circular(6),
              ),
            ),
            const SizedBox(width: 12),
            // Text placeholder
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    height: 12,
                    width: 100,
                    decoration: BoxDecoration(
                      color: AppColors.ink3,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    height: 10,
                    width: 70,
                    decoration: BoxDecoration(
                      color: AppColors.ink3,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ),
            // Right placeholder
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  height: 11,
                  width: 55,
                  decoration: BoxDecoration(
                    color: AppColors.ink3,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  height: 10,
                  width: 40,
                  decoration: BoxDecoration(
                    color: AppColors.ink3,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
