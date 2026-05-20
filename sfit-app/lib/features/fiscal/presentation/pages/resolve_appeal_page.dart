import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../data/datasources/fiscal_api_service.dart';

/// Lista y resolucion de apelaciones pendientes — RF-15 (rol fiscal).
///
/// El backend filtra automaticamente por la municipalidad del fiscal
/// autenticado, por lo que no es necesario pasar municipalityId.
class ResolveAppealPage extends ConsumerWidget {
  const ResolveAppealPage({super.key});

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (data is Map && data['message'] is String) return data['message'] as String;
    }
    return 'No se pudo completar la operación';
  }

  Future<void> _openAppealSheet(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> appeal,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _AppealDetailSheet(
        appeal: appeal,
        onResolve: (status) async {
          Navigator.of(context).pop();
          await _resolve(context, ref, appeal, status);
        },
      ),
    );
  }

  Future<void> _resolve(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> appeal,
    String status,
  ) async {
    final resolution = await _askResolution(context, status);
    if (resolution == null || resolution.trim().length < 5) return;

    final id = appeal['id'] as String?;
    if (id == null) return;

    try {
      await ref.read(fiscalApiServiceProvider).resolveAppeal(
            id,
            status: status,
            resolution: resolution.trim(),
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              status == 'aprobada'
                  ? 'Apelacion aprobada'
                  : 'Apelacion rechazada',
            ),
            backgroundColor:
                status == 'aprobada' ? AppColors.apto : AppColors.noApto,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      ref.invalidate(appealsToResolveProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No se pudo resolver: ${_extractError(e)}'),
            backgroundColor: AppColors.noApto,
          ),
        );
      }
    }
  }

  Future<String?> _askResolution(BuildContext context, String status) async {
    final ctrl = TextEditingController();
    final isApprove = status == 'aprobada';
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          isApprove ? 'Aprobar apelacion' : 'Rechazar apelacion',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: TextField(
          controller: ctrl,
          maxLines: 4,
          minLines: 3,
          autofocus: true,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            hintText:
                'Minimo 5 caracteres. Explica el motivo de la decision.',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text),
            style: FilledButton.styleFrom(
              backgroundColor: isApprove ? AppColors.apto : AppColors.noApto,
            ),
            child: Text(isApprove ? 'Aprobar' : 'Rechazar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appealsAsync = ref.watch(appealsToResolveProvider);

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Apelaciones pendientes',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: appealsAsync.when(
        loading: () => const SfitLoading.page(color: AppColors.gold),
        error: (_, __) => _ErrorState(
          message: 'No se pudieron cargar las apelaciones.',
          onRetry: () => ref.invalidate(appealsToResolveProvider),
        ),
        data: (appeals) {
          if (appeals.isEmpty) {
            return const _EmptyAppealsState();
          }
          return RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () => ref.refresh(appealsToResolveProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: appeals.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final raw = <String, dynamic>{
                  'id': appeals[i].id,
                  'reason': appeals[i].reason,
                  'createdAt': appeals[i].createdAt?.toIso8601String(),
                  'submittedBy': appeals[i].submitterName != null
                      ? {'name': appeals[i].submitterName}
                      : null,
                };
                return _AppealCard(
                  appeal: raw,
                  onTap: () => _openAppealSheet(context, ref, raw),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

// ── Tarjeta de apelacion ─────────────────────────────────────────
class _AppealCard extends StatelessWidget {
  final Map<String, dynamic> appeal;
  final VoidCallback onTap;

  const _AppealCard({required this.appeal, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final vehicle = appeal['vehicle'] as Map?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final reason = appeal['reason'] as String? ?? '';
    final shortReason =
        reason.length > 100 ? '${reason.substring(0, 100)}…' : reason;
    final createdAt = appeal['createdAt'] as String?;

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
                    color: AppColors.riesgoBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.riesgoBorder),
                  ),
                  child: const Icon(
                    Icons.balance_outlined,
                    size: 18,
                    color: AppColors.riesgo,
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
                    color: AppColors.riesgoBg,
                    border: Border.all(color: AppColors.riesgoBorder),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Pendiente',
                    style: AppTheme.inter(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.riesgo,
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
                const Icon(Icons.schedule,
                    size: 13, color: AppColors.ink5),
                const SizedBox(width: 4),
                Text(
                  _formatDate(createdAt),
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink5,
                  ),
                ),
                const Spacer(),
                Text(
                  'Tocar para resolver',
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gold,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right,
                    size: 16, color: AppColors.gold),
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
class _AppealDetailSheet extends StatelessWidget {
  final Map<String, dynamic> appeal;
  final ValueChanged<String> onResolve;

  const _AppealDetailSheet({required this.appeal, required this.onResolve});

  @override
  Widget build(BuildContext context) {
    final vehicle = appeal['vehicle'] as Map?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final reason = appeal['reason'] as String? ?? '';
    final submitted = appeal['submittedBy'] as Map?;
    final submittedName = submitted?['name'] as String?;

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
                    color: AppColors.riesgoBg,
                    border: Border.all(color: AppColors.riesgoBorder),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Pendiente',
                    style: AppTheme.inter(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.riesgo,
                    ),
                  ),
                ),
              ],
            ),
            if (submittedName != null) ...[
              const SizedBox(height: 4),
              Text(
                'Apelado por: $submittedName',
                style:
                    AppTheme.inter(fontSize: 12, color: AppColors.ink5),
              ),
            ],
            const SizedBox(height: 14),
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
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280),
              child: SingleChildScrollView(
                child: Text(
                  reason,
                  style: AppTheme.inter(
                    fontSize: 14,
                    color: AppColors.ink8,
                    height: 1.5,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => onResolve('rechazada'),
                    icon: const Icon(Icons.close, size: 18),
                    label: Text(
                      'Rechazar',
                      style: AppTheme.inter(
                          fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.noApto,
                      side: const BorderSide(color: AppColors.noAptoBorder),
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => onResolve('aprobada'),
                    icon: const Icon(Icons.check, size: 18),
                    label: Text(
                      'Aprobar',
                      style: AppTheme.inter(
                          fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.apto,
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
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

// ── Estado vacio ─────────────────────────────────────────────────
class _EmptyAppealsState extends StatelessWidget {
  const _EmptyAppealsState();

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
                Icons.balance_outlined,
                size: 30,
                color: AppColors.ink5,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Sin apelaciones pendientes',
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Cuando un operador presente una apelacion aparecera aqui.',
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
              style:
                  AppTheme.inter(fontSize: 13, color: AppColors.ink7),
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
