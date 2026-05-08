import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/sanctions_api_service.dart';

/// Pantalla "Mis sanciones" del conductor.
///
/// Lista las sanciones donde el conductor figura como `driverId`. El conductor
/// puede ver el detalle (falta + monto + estado) y apelar las que aún están
/// en estado `emitida` o `notificada`. Las apeladas/confirmadas/anuladas son
/// sólo de lectura.
class MisSancionesPage extends ConsumerStatefulWidget {
  const MisSancionesPage({super.key});

  @override
  ConsumerState<MisSancionesPage> createState() => _MisSancionesPageState();
}

class _MisSancionesPageState extends ConsumerState<MisSancionesPage> {
  bool _loading = true;
  String? _error;
  SanctionsListResponse? _data;

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
      final svc = ref.read(sanctionsApiServiceProvider);
      final data = await svc.getMySanctions(limit: 50);
      if (mounted) setState(() { _data = data; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar las sanciones.';
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
          'Mis sanciones',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _MisSancionesContent(data: _data!, onRefresh: _load),
    );
  }
}

class _MisSancionesContent extends StatelessWidget {
  final SanctionsListResponse data;
  final Future<void> Function() onRefresh;
  const _MisSancionesContent({required this.data, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (data.items.isEmpty) return const _EmptyState();

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.gold,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
        children: [
          _StatsStrip(stats: data.stats),
          const SizedBox(height: 14),
          ...data.items.map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _SanctionCard(
                  item: s,
                  onTap: () => _openDetail(context, s, onRefresh),
                ),
              )),
        ],
      ),
    );
  }

  void _openDetail(
    BuildContext context,
    SanctionItem item,
    Future<void> Function() onRefresh,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _SanctionDetailSheet(item: item),
    ).then((didAppeal) {
      if (didAppeal == true) onRefresh();
    });
  }
}

class _StatsStrip extends StatelessWidget {
  final SanctionsStats stats;
  const _StatsStrip({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(
        children: [
          _StatPill(
            label: 'Pendientes',
            value: '${stats.pendientes}',
            color: AppColors.gold,
          ),
          const SizedBox(width: 10),
          _StatPill(
            label: 'Apeladas',
            value: '${stats.apelada}',
            color: AppColors.riesgo,
          ),
          const SizedBox(width: 10),
          _StatPill(
            label: 'Confirmadas',
            value: '${stats.confirmada}',
            color: AppColors.noApto,
          ),
        ],
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatPill({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTheme.inter(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              color: AppColors.ink5,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTheme.inter(
              fontSize: 22,
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

class _SanctionCard extends StatelessWidget {
  final SanctionItem item;
  final VoidCallback onTap;
  const _SanctionCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final (badgeColor, badgeBg, badgeBorder) = _statusColors(item.status);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: badgeBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: badgeBorder),
                  ),
                  alignment: Alignment.center,
                  child: Icon(Icons.gavel_outlined, size: 18, color: badgeColor),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.faultType,
                        style: AppTheme.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      if (item.plate != null)
                        Text(
                          'Placa ${item.plate} · ${_formatDate(item.createdAt)}',
                          style: AppTheme.inter(
                            fontSize: 11.5,
                            color: AppColors.ink5,
                            tabular: true,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: badgeBg,
                    border: Border.all(color: badgeBorder),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _statusLabel(item.status).toUpperCase(),
                    style: AppTheme.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: badgeColor,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  'S/. ${item.amountSoles.toStringAsFixed(2)}',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                    tabular: true,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

class _SanctionDetailSheet extends ConsumerStatefulWidget {
  final SanctionItem item;
  const _SanctionDetailSheet({required this.item});

  @override
  ConsumerState<_SanctionDetailSheet> createState() => _SanctionDetailSheetState();
}

class _SanctionDetailSheetState extends ConsumerState<_SanctionDetailSheet> {
  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final (badgeColor, badgeBg, badgeBorder) = _statusColors(item.status);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.ink2,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: badgeBg,
                border: Border.all(color: badgeBorder),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                _statusLabel(item.status).toUpperCase(),
                style: AppTheme.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: badgeColor,
                  letterSpacing: 0.8,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              item.faultType,
              style: AppTheme.inter(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 8),
            _DetailRow(
              icon: Icons.directions_car_outlined,
              label: 'Vehículo',
              value: item.plate ?? '—',
            ),
            _DetailRow(
              icon: Icons.payments_outlined,
              label: 'Monto',
              value: 'S/. ${item.amountSoles.toStringAsFixed(2)} · ${item.amountUIT}',
            ),
            _DetailRow(
              icon: Icons.event_outlined,
              label: 'Fecha',
              value: _formatDate(item.createdAt),
            ),
            if (item.appealNotes != null && item.appealNotes!.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                'NOTAS',
                style: AppTheme.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink5,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.ink1,
                  border: Border.all(color: AppColors.ink2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  item.appealNotes!,
                  style: AppTheme.inter(
                    fontSize: 12,
                    color: AppColors.ink7,
                    height: 1.45,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 18),
            if (item.canAppeal)
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton.icon(
                  onPressed: () async {
                    final navigator = Navigator.of(context);
                    final result = await navigator.push<bool>(
                      MaterialPageRoute(
                        builder: (_) => NuevaApelacionPage(sanctionId: item.id),
                      ),
                    );
                    if (result == true) navigator.pop(true);
                  },
                  icon: const Icon(Icons.gavel_rounded, size: 18),
                  label: const Text('Apelar sanción'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.ink1,
                  border: Border.all(color: AppColors.ink2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  const Icon(Icons.info_outline, size: 18, color: AppColors.ink5),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Esta sanción ya no se puede apelar (estado: ${_statusLabel(item.status)}).',
                      style: AppTheme.inter(
                        fontSize: 12,
                        color: AppColors.ink6,
                        height: 1.4,
                      ),
                    ),
                  ),
                ]),
              ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} · ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _DetailRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.ink5),
          const SizedBox(width: 8),
          SizedBox(
            width: 84,
            child: Text(
              label,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.ink9,
              ),
            ),
          ),
        ],
      ),
    );
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
                color: AppColors.aptoBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.aptoBorder, width: 1.5),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.shield_outlined, size: 30, color: AppColors.apto),
            ),
            const SizedBox(height: 14),
            Text(
              'Sin sanciones',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'No tienes sanciones registradas. Sigue conduciendo de manera responsable.',
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

(Color, Color, Color) _statusColors(String status) => switch (status) {
      'emitida' || 'notificada' => (AppColors.gold, AppColors.goldBg, AppColors.goldBorder),
      'apelada' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder),
      'confirmada' => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
      'anulada' => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder),
      _ => (AppColors.ink5, AppColors.ink1, AppColors.ink2),
    };

String _statusLabel(String s) => switch (s) {
      'emitida' => 'Emitida',
      'notificada' => 'Notificada',
      'apelada' => 'Apelada',
      'confirmada' => 'Confirmada',
      'anulada' => 'Anulada',
      _ => s,
    };

/// Pantalla de formulario para apelar una sanción. Se accede desde el detalle
/// de una sanción cuando `canAppeal == true`.
class NuevaApelacionPage extends ConsumerStatefulWidget {
  final String sanctionId;
  const NuevaApelacionPage({super.key, required this.sanctionId});

  @override
  ConsumerState<NuevaApelacionPage> createState() => _NuevaApelacionPageState();
}

class _NuevaApelacionPageState extends ConsumerState<NuevaApelacionPage> {
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reasonCtrl.text.trim();
    if (reason.length < 20) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('El motivo debe tener al menos 20 caracteres.'),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final svc = ref.read(sanctionsApiServiceProvider);
      await svc.appealSanction(widget.sanctionId, reason: reason);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Apelación enviada. El fiscal la revisará pronto.'),
          backgroundColor: AppColors.apto,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${_extractError(e)}'),
            backgroundColor: AppColors.noApto,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String _extractError(Object e) {
    final m = RegExp(r'"error"\s*:\s*"([^"]+)"').firstMatch(e.toString());
    return m?.group(1) ?? 'No se pudo enviar la apelación';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: const BackButton(),
        title: Text(
          'Apelar sanción',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  border: Border.all(color: AppColors.goldBorder),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(children: [
                  const Icon(Icons.info_outline, size: 18, color: AppColors.goldDark),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Explica con claridad por qué esta sanción no procede. El fiscal revisará tu apelación.',
                      style: AppTheme.inter(
                        fontSize: 12,
                        color: AppColors.ink8,
                        height: 1.4,
                      ),
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 14),
              Text(
                'Motivo de apelación *',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink8,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _reasonCtrl,
                maxLines: 8,
                maxLength: 2000,
                enabled: !_submitting,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Mínimo 20 caracteres. Sé específico: fecha, lugar, circunstancias, etc.',
                  hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.gold, width: 2),
                  ),
                ),
                style: AppTheme.inter(fontSize: 13.5, color: AppColors.ink9, height: 1.4),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 16, height: 16,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.4),
                        )
                      : const Icon(Icons.send_rounded, size: 18),
                  label: Text(_submitting ? 'Enviando...' : 'Enviar apelación'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
