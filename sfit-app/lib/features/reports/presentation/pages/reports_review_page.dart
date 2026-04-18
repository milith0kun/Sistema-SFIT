import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/reports_api_service.dart';
import '../../data/models/report_model.dart';

/// Lista de reportes ciudadanos para el FISCAL — revisión y validación.
class ReportsReviewPage extends ConsumerStatefulWidget {
  const ReportsReviewPage({super.key});

  @override
  ConsumerState<ReportsReviewPage> createState() => _ReportsReviewPageState();
}

class _ReportsReviewPageState extends ConsumerState<ReportsReviewPage> {
  List<ReportModel> _items = [];
  bool _loading = true;
  String? _error;

  /// null = Todos, 'pendiente', 'en_revision'
  String? _filterStatus;

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
      final svc = ref.read(reportsApiServiceProvider);
      final items = await svc.getReports(status: _filterStatus, limit: 30);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar los reportes.';
          _loading = false;
        });
      }
    }
  }

  void _onFilterChanged(String? status) {
    setState(() => _filterStatus = status);
    _load();
  }

  void _showDetail(ReportModel report) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ReportDetailSheet(
        report: report,
        onAction: (status, {rejectionReason}) async {
          Navigator.of(context).pop();
          try {
            final svc = ref.read(reportsApiServiceProvider);
            await svc.updateReportStatus(
              report.id,
              status,
              rejectionReason: rejectionReason,
            );
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    status == 'validado'
                        ? 'Reporte validado correctamente.'
                        : 'Reporte rechazado.',
                  ),
                  backgroundColor:
                      status == 'validado' ? AppColors.apto : AppColors.noApto,
                  behavior: SnackBarBehavior.floating,
                ),
              );
              _load();
            }
          } catch (_) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('No se pudo actualizar el reporte.'),
                  backgroundColor: AppColors.noApto,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          // ── Header ─────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Reportes ciudadanos',
                    style: AppTheme.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink9,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Filtro de estado (chip row) ─────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: 'Todos',
                    selected: _filterStatus == null,
                    onTap: () => _onFilterChanged(null),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Pendientes',
                    selected: _filterStatus == 'pendiente',
                    onTap: () => _onFilterChanged('pendiente'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'En revisión',
                    selected: _filterStatus == 'en_revision',
                    onTap: () => _onFilterChanged('en_revision'),
                  ),
                ],
              ),
            ),
          ),

          // ── Lista ───────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.gold))
                : _error != null
                    ? _ErrorState(message: _error!, onRetry: _load)
                    : _items.isEmpty
                        ? const _EmptyState()
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (_, i) => _ReportCard(
                                item: _items[i],
                                onTap: () => _showDetail(_items[i]),
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ── Chip de filtro ──────────────────────────────────────────────────
class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.ink9 : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? AppColors.ink9 : AppColors.ink2,
          ),
        ),
        child: Text(
          label,
          style: AppTheme.inter(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.ink7,
          ),
        ),
      ),
    );
  }
}

// ── Card de reporte ─────────────────────────────────────────────────
class _ReportCard extends StatelessWidget {
  final ReportModel item;
  final VoidCallback onTap;

  const _ReportCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final (badgeColor, badgeBg, badgeBorder) = _statusColors(item.status);
    final plate = item.vehicle?.plate ?? '—';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Badge de estado
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: badgeBg,
                border: Border.all(color: badgeBorder),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                _statusLabel(item.status),
                style: AppTheme.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: badgeColor,
                  letterSpacing: 0.2,
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
                      Text(
                        plate,
                        style: AppTheme.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                          tabular: true,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          item.category,
                          style: AppTheme.inter(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink6,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.description,
                    style: AppTheme.inter(
                      fontSize: 12.5,
                      color: AppColors.ink5,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _formatDate(item.createdAt),
                    style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.ink3),
          ],
        ),
      ),
    );
  }

  (Color, Color, Color) _statusColors(String s) => switch (s) {
        'pendiente'   => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder),
        'en_revision' => (AppColors.gold,   AppColors.goldBg,   AppColors.goldBorder),
        'validado'    => (AppColors.apto,   AppColors.aptoBg,   AppColors.aptoBorder),
        _             => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
      };

  String _statusLabel(String s) => switch (s) {
        'pendiente'   => 'Pendiente',
        'en_revision' => 'En revisión',
        'validado'    => 'Validado',
        _             => 'Rechazado',
      };

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month && d.year == now.year) {
      return 'Hoy ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    }
    return '${d.day}/${d.month}/${d.year}';
  }
}

// ── Bottom sheet de detalle ─────────────────────────────────────────
typedef _OnAction = void Function(
  String status, {
  String? rejectionReason,
});

class _ReportDetailSheet extends StatefulWidget {
  final ReportModel report;
  final _OnAction onAction;

  const _ReportDetailSheet({
    required this.report,
    required this.onAction,
  });

  @override
  State<_ReportDetailSheet> createState() => _ReportDetailSheetState();
}

class _ReportDetailSheetState extends State<_ReportDetailSheet> {
  final _rejectCtrl = TextEditingController();
  bool _showRejectField = false;

  @override
  void dispose() {
    _rejectCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    final plate = r.vehicle?.plate ?? '—';
    final citizenName =
        r.citizen != null ? r.citizen!['name'] as String? ?? 'Ciudadano' : 'Ciudadano';

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.ink3,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Título
          Text(
            'Detalle del reporte',
            style: AppTheme.inter(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
            ),
          ),
          const SizedBox(height: 16),

          // Campos de info
          _DetailRow(label: 'Placa', value: plate),
          _DetailRow(label: 'Categoría', value: r.category),
          _DetailRow(label: 'Ciudadano', value: citizenName),
          _DetailRow(label: 'Estado', value: _statusLabel(r.status)),
          const SizedBox(height: 8),

          Text(
            'Descripción',
            style: AppTheme.inter(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppColors.ink5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            r.description,
            style: AppTheme.inter(
              fontSize: 14,
              color: AppColors.ink8,
              height: 1.5,
            ),
          ),

          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 12),

          if (_showRejectField) ...[
            Text(
              'Motivo de rechazo',
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _rejectCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Describa el motivo del rechazo...',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _showRejectField = false),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => widget.onAction(
                      'rechazado',
                      rejectionReason: _rejectCtrl.text.trim(),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.noApto,
                    ),
                    child: const Text('Confirmar rechazo'),
                  ),
                ),
              ],
            ),
          ] else ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _showRejectField = true),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.noApto,
                      side: const BorderSide(color: AppColors.noApto),
                    ),
                    child: const Text('Rechazar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => widget.onAction('validado'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.apto,
                    ),
                    child: const Text('Validar'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _statusLabel(String s) => switch (s) {
        'pendiente'   => 'Pendiente',
        'en_revision' => 'En revisión',
        'validado'    => 'Validado',
        _             => 'Rechazado',
      };
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: AppTheme.inter(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.ink5,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTheme.inter(
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
                color: AppColors.ink8,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Estados vacío / error ───────────────────────────────────────────
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
            const Icon(Icons.inbox_outlined, size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text(
              'Sin reportes',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'No hay reportes con el filtro seleccionado.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
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
