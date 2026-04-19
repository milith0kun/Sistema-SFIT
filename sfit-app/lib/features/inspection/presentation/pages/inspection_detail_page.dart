import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/inspection_api_service.dart';
import '../../data/models/inspection_model.dart';

/// Detalle de una inspección — RF-11 / Operador.
class InspectionDetailPage extends ConsumerStatefulWidget {
  final String inspectionId;

  const InspectionDetailPage({super.key, required this.inspectionId});

  @override
  ConsumerState<InspectionDetailPage> createState() =>
      _InspectionDetailPageState();
}

class _InspectionDetailPageState
    extends ConsumerState<InspectionDetailPage> {
  InspectionModel? _inspection;
  bool _loading = true;
  String? _error;

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
      final svc = ref.read(inspectionApiServiceProvider);
      final data = await svc.getInspectionById(widget.inspectionId);
      if (mounted) setState(() { _inspection = data; _loading = false; });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'No se pudo cargar la inspección.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text(
          'Detalle de inspección',
          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _inspection == null
                  ? const SizedBox.shrink()
                  : _Body(
                      inspection: _inspection!,
                      isOperador: user?.isOperador ?? false,
                    ),
    );
  }
}

// ── Body ─────────────────────────────────────────────────────────────────────

class _Body extends StatefulWidget {
  final InspectionModel inspection;
  final bool isOperador;

  const _Body({required this.inspection, required this.isOperador});

  @override
  State<_Body> createState() => _BodyState();
}

class _BodyState extends State<_Body> {
  bool _checklistExpanded = true;

  @override
  Widget build(BuildContext context) {
    final insp = widget.inspection;
    final (color, bg, border) = _resultColors(insp.result);
    final canAppeal = widget.isOperador &&
        (insp.result == 'rechazada' || insp.result == 'observada');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Vehículo ───────────────────────────────────────────
          _SectionCard(children: [
            _Row(
              icon: Icons.directions_car_outlined,
              label: 'Placa',
              value: insp.vehicle?.plate ?? '—',
              valueWeight: FontWeight.w800,
            ),
            _Divider(),
            _Row(
              icon: Icons.category_outlined,
              label: 'Tipo',
              value: _vehicleTypeLabel(
                  insp.vehicle?.vehicleTypeKey ?? insp.vehicleTypeKey),
            ),
            if (insp.vehicle != null) ...[
              _Divider(),
              _Row(
                icon: Icons.car_repair_outlined,
                label: 'Vehículo',
                value:
                    '${insp.vehicle!.brand} ${insp.vehicle!.model}',
              ),
            ],
          ]),
          const SizedBox(height: 12),

          // ── Resultado + score ──────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: bg,
              border: Border.all(color: border),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Resultado',
                        style: AppTheme.inter(
                            fontSize: 11, color: color.withAlpha(180)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _resultLabel(insp.result),
                        style: AppTheme.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${insp.score}/100',
                      style: AppTheme.inter(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: color,
                        tabular: true,
                      ),
                    ),
                    Text(
                      'puntaje',
                      style: AppTheme.inter(
                          fontSize: 11, color: color.withAlpha(180)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Fecha + fiscal ────────────────────────────────────
          _SectionCard(children: [
            _Row(
              icon: Icons.calendar_today_outlined,
              label: 'Fecha',
              value: DateFormat('dd/MM/yyyy HH:mm').format(insp.date),
            ),
            if (insp.fiscal != null) ...[
              _Divider(),
              _Row(
                icon: Icons.badge_outlined,
                label: 'Inspector',
                value: insp.fiscal!['name'] as String? ?? '—',
              ),
            ],
          ]),
          const SizedBox(height: 12),

          // ── Checklist expandible ───────────────────────────────
          // (el modelo no trae el checklist detallado en la lista general;
          //  si la API lo incluye en el detalle, lo mostramos)
          if (insp.observations != null && insp.observations!.isNotEmpty) ...[
            _SectionCard(children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.notes_outlined,
                            size: 16, color: AppColors.ink5),
                        const SizedBox(width: 8),
                        Text(
                          'Observaciones',
                          style: AppTheme.inter(
                              fontSize: 12, color: AppColors.ink5),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      insp.observations!,
                      style: AppTheme.inter(
                          fontSize: 14, color: AppColors.ink8),
                    ),
                  ],
                ),
              ),
            ]),
            const SizedBox(height: 12),
          ],

          // ── Botón apelar ──────────────────────────────────────
          if (canAppeal) ...[
            const SizedBox(height: 4),
            FilledButton.icon(
              onPressed: () => context
                  .push('/apelacion-nueva?inspectionId=${insp.id}'),
              icon: const Icon(Icons.gavel, size: 18),
              label: Text(
                'Apelar inspección',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.riesgo,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  (Color, Color, Color) _resultColors(String result) => switch (result) {
        'aprobada' => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder),
        'observada' => (
          AppColors.riesgo,
          AppColors.riesgoBg,
          AppColors.riesgoBorder
        ),
        _ => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
      };

  String _resultLabel(String r) => switch (r) {
        'aprobada' => 'Aprobada',
        'observada' => 'Observada',
        _ => 'Rechazada',
      };

  String _vehicleTypeLabel(String k) => switch (k) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos' => 'Limpieza',
        'emergencia' => 'Emergencia',
        'maquinaria' => 'Maquinaria',
        _ => 'Municipal',
      };
}

// ── Widgets auxiliares ────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final List<Widget> children;
  const _SectionCard({required this.children});

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(children: children),
      );
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final FontWeight valueWeight;

  const _Row({
    required this.icon,
    required this.label,
    required this.value,
    this.valueWeight = FontWeight.w600,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(icon, size: 16, color: AppColors.ink4),
            const SizedBox(width: 10),
            Text(
              label,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
            ),
            const Spacer(),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: valueWeight,
                  color: AppColors.ink8,
                ),
              ),
            ),
          ],
        ),
      );
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) =>
      const Divider(height: 1, color: AppColors.ink2, indent: 16, endIndent: 16);
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  size: 40, color: AppColors.noApto),
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
