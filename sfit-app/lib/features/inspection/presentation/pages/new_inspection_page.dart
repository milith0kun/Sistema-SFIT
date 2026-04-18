import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/inspection_api_service.dart';
import '../../data/models/inspection_model.dart';

/// Formulario de inspección — RF-11.
/// Se llega aquí desde el escáner QR o desde la lista de inspecciones.
/// [vehicleId], [plate], [vehicleTypeKey] vienen como extra del router.
class NewInspectionPage extends ConsumerStatefulWidget {
  final String vehicleId;
  final String plate;
  final String vehicleTypeKey;
  final String? driverId;

  const NewInspectionPage({
    super.key,
    required this.vehicleId,
    required this.plate,
    required this.vehicleTypeKey,
    this.driverId,
  });

  @override
  ConsumerState<NewInspectionPage> createState() => _NewInspectionPageState();
}

class _NewInspectionPageState extends ConsumerState<NewInspectionPage> {
  late List<bool> _passed;
  final _obsCtrl = TextEditingController();
  bool _submitting = false;

  late List<String> _items;

  @override
  void initState() {
    super.initState();
    _items = checklistForType(widget.vehicleTypeKey);
    _passed = List.filled(_items.length, true);
  }

  @override
  void dispose() {
    _obsCtrl.dispose();
    super.dispose();
  }

  int get _score {
    if (_items.isEmpty) return 100;
    final passed = _passed.where((p) => p).length;
    return ((passed / _items.length) * 100).round();
  }

  String get _result {
    if (_score >= 85) return 'aprobada';
    if (_score >= 60) return 'observada';
    return 'rechazada';
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final svc = ref.read(inspectionApiServiceProvider);
      await svc.createInspection(
        vehicleId: widget.vehicleId,
        driverId: widget.driverId,
        vehicleTypeKey: widget.vehicleTypeKey,
        checklistResults: List.generate(
          _items.length,
          (i) => ChecklistItem(item: _items[i], passed: _passed[i]),
        ),
        score: _score,
        result: _result,
        observations: _obsCtrl.text.trim().isNotEmpty ? _obsCtrl.text.trim() : null,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Inspección registrada — $_result'),
            backgroundColor: _result == 'aprobada' ? AppColors.apto : AppColors.riesgo,
          ),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error al guardar la inspección.'),
            backgroundColor: AppColors.noApto,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (resultColor, resultBg) = switch (_result) {
      'aprobada'  => (AppColors.apto, AppColors.aptoBg),
      'observada' => (AppColors.riesgo, AppColors.riesgoBg),
      _           => (AppColors.noApto, AppColors.noAptoBg),
    };

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text('Nueva inspección',
            style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700)),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // ── Header con info del vehículo ───────────────────────
          Container(
            color: AppColors.panel,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Row(
              children: [
                const Icon(Icons.directions_car, color: Colors.white54, size: 18),
                const SizedBox(width: 8),
                Text(
                  widget.plate,
                  style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _vehicleTypeLabel(widget.vehicleTypeKey),
                  style: AppTheme.inter(fontSize: 12, color: Colors.white54),
                ),
              ],
            ),
          ),

          // ── Score en tiempo real ────────────────────────────────
          Container(
            color: resultBg,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Text(
                  'Puntaje: $_score/100',
                  style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w700, color: resultColor,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: LinearProgressIndicator(
                    value: _score / 100,
                    backgroundColor: Colors.white,
                    color: resultColor,
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: resultColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    _resultLabel(_result),
                    style: AppTheme.inter(
                      fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Lista de ítems ─────────────────────────────────────
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              itemCount: _items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 6),
              itemBuilder: (_, i) => _ChecklistRow(
                item: _items[i],
                passed: _passed[i],
                onChanged: (v) => setState(() => _passed[i] = v),
              ),
            ),
          ),

          // ── Observaciones + botón ───────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.ink2)),
            ),
            child: Column(
              children: [
                TextField(
                  controller: _obsCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'Observaciones (opcional)',
                    hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.ink2),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.ink2),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                  ),
                  style: AppTheme.inter(fontSize: 13, color: AppColors.ink8),
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.panel,
                    minimumSize: const Size(double.infinity, 46),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2),
                        )
                      : Text('Guardar inspección',
                          style: AppTheme.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          )),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _vehicleTypeLabel(String key) => switch (key) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos'  => 'Limpieza',
        'emergencia'         => 'Emergencia',
        'maquinaria'         => 'Maquinaria',
        _                    => 'Vehículo municipal',
      };

  String _resultLabel(String r) => switch (r) {
        'aprobada'  => 'APROBADA',
        'observada' => 'OBSERVADA',
        _           => 'RECHAZADA',
      };
}

class _ChecklistRow extends StatelessWidget {
  final String item;
  final bool passed;
  final ValueChanged<bool> onChanged;

  const _ChecklistRow({
    required this.item,
    required this.passed,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!passed),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: passed ? AppColors.aptoBg : AppColors.noAptoBg,
          border: Border.all(
            color: passed ? AppColors.aptoBorder : AppColors.noAptoBorder,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              passed ? Icons.check_circle : Icons.cancel,
              size: 20,
              color: passed ? AppColors.apto : AppColors.noApto,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                item,
                style: AppTheme.inter(
                  fontSize: 13,
                  color: passed ? AppColors.ink8 : AppColors.ink6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
