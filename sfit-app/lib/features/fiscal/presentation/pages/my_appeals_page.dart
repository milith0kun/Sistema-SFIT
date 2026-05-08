import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/models/appeal_model.dart';
import '../../data/datasources/fiscal_api_service.dart';

/// Lista de apelaciones resueltas por el fiscal autenticado.
class MyAppealsPage extends ConsumerWidget {
  const MyAppealsPage({super.key});

  void _openDetail(BuildContext context, Map<String, dynamic> appeal) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _ResolvedAppealSheet(appeal: appeal),
    );
  }

  Map<String, dynamic> _toRaw(AppealModel a) {
    return <String, dynamic>{
      'id': a.id,
      'reason': a.reason,
      'resolution': a.resolution,
      'status': a.status,
      'createdAt': a.createdAt?.toIso8601String(),
      'resolvedAt': a.resolvedAt?.toIso8601String(),
      'submittedBy':
          a.submitterName != null ? {'name': a.submitterName} : null,
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appealsAsync = ref.watch(myResolvedAppealsProvider);

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Mis apelaciones resueltas',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: appealsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.gold),
        ),
        error: (_, __) => _ErrorState(
          message: 'No se pudieron cargar tus apelaciones resueltas.',
          onRetry: () => ref.invalidate(myResolvedAppealsProvider),
        ),
        data: (appeals) {
          if (appeals.isEmpty) {
            return const _EmptyState();
          }
          final items = appeals.map(_toRaw).toList();
          return RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () => ref.refresh(myResolvedAppealsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _ResolvedAppealCard(
                appeal: items[i],
                onTap: () => _openDetail(context, items[i]),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Tarjeta de apelacion resuelta ───────────────────────────────
class _ResolvedAppealCard extends StatelessWidget {
  final Map<String, dynamic> appeal;
  final VoidCallback onTap;

  const _ResolvedAppealCard({required this.appeal, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = appeal['status'] as String? ?? '';
    final isApproved = status == 'aprobada' || status == 'resuelta';
    final color = isApproved ? AppColors.apto : AppColors.noApto;
    final bg = isApproved ? AppColors.aptoBg : AppColors.noAptoBg;
    final border = isApproved ? AppColors.aptoBorder : AppColors.noAptoBorder;

    final vehicle = appeal['vehicle'] as Map?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final reason = appeal['reason'] as String? ?? '';
    final shortReason =
        reason.length > 100 ? '${reason.substring(0, 100)}…' : reason;
    final resolvedAt = appeal['resolvedAt'] as String?;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.ink2),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: bg,
                    shape: BoxShape.circle,
                    border: Border.all(color: border),
                  ),
                  child: Icon(
                    isApproved ? Icons.check : Icons.close,
                    size: 18,
                    color: color,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    plate,
                    style: AppTheme.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink9,
                      tabular: true,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: bg,
                    border: Border.all(color: border),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isApproved ? 'Aprobada' : 'Rechazada',
                    style: AppTheme.inter(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: color,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              shortReason,
              style: AppTheme.inter(
                fontSize: 13,
                color: AppColors.ink7,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.event_available,
                    size: 13, color: AppColors.ink5),
                const SizedBox(width: 4),
                Text(
                  'Resuelta: ${_formatDate(resolvedAt)}',
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink5,
                  ),
                ),
                const Spacer(),
                const Icon(Icons.chevron_right,
                    size: 16, color: AppColors.ink4),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDate(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      if (dt.day == now.day &&
          dt.month == now.month &&
          dt.year == now.year) {
        return 'Hoy ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      }
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '—';
    }
  }
}

// ── Bottom sheet con detalle completo ────────────────────────────
class _ResolvedAppealSheet extends StatelessWidget {
  final Map<String, dynamic> appeal;

  const _ResolvedAppealSheet({required this.appeal});

  @override
  Widget build(BuildContext context) {
    final status = appeal['status'] as String? ?? '';
    final isApproved = status == 'aprobada' || status == 'resuelta';
    final color = isApproved ? AppColors.apto : AppColors.noApto;
    final bg = isApproved ? AppColors.aptoBg : AppColors.noAptoBg;
    final border = isApproved ? AppColors.aptoBorder : AppColors.noAptoBorder;

    final vehicle = appeal['vehicle'] as Map?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final reason = appeal['reason'] as String? ?? '';
    final resolution = appeal['resolution'] as String? ?? '';
    final submitted = appeal['submittedBy'] as Map?;
    final submittedName = submitted?['name'] as String?;
    final resolvedAt = appeal['resolvedAt'] as String?;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.ink2,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Text(
                  plate,
                  style: AppTheme.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                    tabular: true,
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: bg,
                    border: Border.all(color: border),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isApproved ? 'Aprobada' : 'Rechazada',
                    style: AppTheme.inter(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
            if (submittedName != null) ...[
              const SizedBox(height: 4),
              Text(
                'Apelado por: $submittedName',
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
              ),
            ],
            if (resolvedAt != null) ...[
              const SizedBox(height: 2),
              Text(
                'Resuelta el ${_formatFullDate(resolvedAt)}',
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
              ),
            ],
            const SizedBox(height: 14),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 380),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Motivo',
                      style: AppTheme.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink5,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      reason,
                      style: AppTheme.inter(
                        fontSize: 14,
                        color: AppColors.ink8,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Resolucion',
                      style: AppTheme.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink5,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: bg,
                        border: Border.all(color: border),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        resolution.isNotEmpty
                            ? resolution
                            : 'Sin resolucion registrada',
                        style: AppTheme.inter(
                          fontSize: 13.5,
                          color: color,
                          height: 1.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size.fromHeight(46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(
                'Cerrar',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatFullDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year} '
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
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
                color: AppColors.ink1,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.ink2),
              ),
              child: const Icon(
                Icons.history_outlined,
                size: 30,
                color: AppColors.ink5,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Aun no resolviste apelaciones',
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Cuando resuelvas una apelacion aparecera aqui.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 12,
                color: AppColors.ink5,
                height: 1.4,
              ),
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
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 36, color: AppColors.noApto),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink7),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetry,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}
