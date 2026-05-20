import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';

/// Pantalla "Mis inspecciones" del conductor.
///
/// Lista las inspecciones donde el conductor figura como `driverId`.
/// Backend: `GET /api/inspecciones` (con filtro automático por driver del
/// usuario autenticado, agregado en esta tanda). Cada item se expande con
/// el checklist completo y observaciones del fiscal.
class MisInspeccionesPage extends ConsumerStatefulWidget {
  const MisInspeccionesPage({super.key});

  @override
  ConsumerState<MisInspeccionesPage> createState() => _MisInspeccionesPageState();
}

class _MisInspeccionesPageState extends ConsumerState<MisInspeccionesPage> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = const [];
  Map<String, dynamic> _stats = const {};

  static final _dateFormat = DateFormat("d 'de' MMM, HH:mm", 'es');

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
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/inspecciones', queryParameters: {'limit': 50});
      final data = (resp.data as Map)['data'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _items = (data['items'] as List? ?? const [])
            .cast<Map<String, dynamic>>();
        _stats = (data['stats'] as Map<String, dynamic>?) ?? const {};
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar las inspecciones.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Mis inspecciones',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: _loading
          ? const SfitLoading.page(color: AppColors.gold)
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _items.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.gold,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                        children: [
                          _StatsStrip(stats: _stats),
                          const SizedBox(height: 14),
                          ..._items.map((i) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _InspectionCard(
                                  item: i,
                                  dateFormat: _dateFormat,
                                ),
                              )),
                        ],
                      ),
                    ),
    );
  }
}

class _StatsStrip extends StatelessWidget {
  final Map<String, dynamic> stats;
  const _StatsStrip({required this.stats});

  @override
  Widget build(BuildContext context) {
    final aprobada = (stats['aprobada'] as num?)?.toInt() ?? 0;
    final observada = (stats['observada'] as num?)?.toInt() ?? 0;
    final rechazada = (stats['rechazada'] as num?)?.toInt() ?? 0;
    final avg = (stats['avgScore'] as num?)?.toInt() ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(
        children: [
          _Pill(label: 'Aprobadas', value: '$aprobada', color: AppColors.apto),
          const SizedBox(width: 10),
          _Pill(label: 'Observadas', value: '$observada', color: AppColors.riesgo),
          const SizedBox(width: 10),
          _Pill(label: 'Rechazadas', value: '$rechazada', color: AppColors.noApto),
          const SizedBox(width: 10),
          _Pill(label: 'Score', value: '$avg', color: AppColors.gold),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _Pill({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTheme.inter(
              fontSize: 8.5,
              fontWeight: FontWeight.w800,
              color: AppColors.ink5,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTheme.inter(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
              tabular: true,
            ),
          ),
        ],
      ),
    );
  }
}

class _InspectionCard extends StatefulWidget {
  final Map<String, dynamic> item;
  final DateFormat dateFormat;
  const _InspectionCard({required this.item, required this.dateFormat});

  @override
  State<_InspectionCard> createState() => _InspectionCardState();
}

class _InspectionCardState extends State<_InspectionCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final result = item['result'] as String? ?? 'observada';
    final score = (item['score'] as num?)?.toInt() ?? 0;
    final observations = item['observations'] as String?;
    final checklist = (item['checklistResults'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final vehicle = item['vehicle'] as Map<String, dynamic>?;
    final fiscal = item['fiscal'] as Map<String, dynamic>?;
    final date = item['date'];
    DateTime? when;
    if (date is String) when = DateTime.tryParse(date);

    final (badgeColor, badgeBg, badgeBorder) = _resultColors(result);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: badgeBg,
                      shape: BoxShape.circle,
                      border: Border.all(color: badgeBorder),
                    ),
                    alignment: Alignment.center,
                    child: Icon(_resultIcon(result), size: 22, color: badgeColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: badgeBg,
                              border: Border.all(color: badgeBorder),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              _resultLabel(result).toUpperCase(),
                              style: AppTheme.inter(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: badgeColor,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'Score $score',
                            style: AppTheme.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink8,
                              tabular: true,
                            ),
                          ),
                        ]),
                        const SizedBox(height: 6),
                        Text(
                          'Placa ${vehicle?['plate'] ?? '—'}',
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink9,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Fiscal: ${fiscal?['name'] ?? '—'} · ${when != null ? widget.dateFormat.format(when.toLocal()) : '—'}',
                          style: AppTheme.inter(
                            fontSize: 11.5,
                            color: AppColors.ink5,
                            tabular: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    color: AppColors.ink5,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const Divider(height: 1, color: AppColors.ink2),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (observations != null && observations.isNotEmpty) ...[
                    Text(
                      'OBSERVACIONES',
                      style: AppTheme.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink5,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.ink1,
                        border: Border.all(color: AppColors.ink2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        observations,
                        style: AppTheme.inter(
                          fontSize: 12.5,
                          color: AppColors.ink8,
                          height: 1.45,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (checklist.isNotEmpty) ...[
                    Text(
                      'CHECKLIST',
                      style: AppTheme.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink5,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ...checklist.map((c) {
                      final ok = c['passed'] == true;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              ok ? Icons.check_circle : Icons.cancel_outlined,
                              size: 16,
                              color: ok ? AppColors.apto : AppColors.noApto,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                (c['item'] as String?) ?? '',
                                style: AppTheme.inter(
                                  fontSize: 12.5,
                                  color: AppColors.ink8,
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  (Color, Color, Color) _resultColors(String r) => switch (r) {
        'aprobada' => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder),
        'observada' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder),
        'rechazada' => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
        _ => (AppColors.ink5, AppColors.ink1, AppColors.ink2),
      };

  IconData _resultIcon(String r) => switch (r) {
        'aprobada' => Icons.check_rounded,
        'observada' => Icons.warning_amber_rounded,
        'rechazada' => Icons.close_rounded,
        _ => Icons.help_outline,
      };

  String _resultLabel(String r) => switch (r) {
        'aprobada' => 'Aprobada',
        'observada' => 'Observada',
        'rechazada' => 'Rechazada',
        _ => r,
      };
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.aptoBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.aptoBorder, width: 1.5),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.fact_check_outlined, size: 30, color: AppColors.apto),
            ),
            const SizedBox(height: 14),
            Text(
              'Sin inspecciones registradas',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Aún no te han hecho inspecciones. Aparecerán aquí cuando un fiscal te inspeccione.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6, height: 1.45),
            ),
          ],
        ),
      ),
    );
  }
}

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
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
            const SizedBox(height: 14),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
