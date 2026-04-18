import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/report_api_service.dart';

/// Formulario para enviar reportes ciudadanos — RF-12 / RF-15.
class CitizenReportFormPage extends ConsumerStatefulWidget {
  const CitizenReportFormPage({super.key});

  @override
  ConsumerState<CitizenReportFormPage> createState() =>
      _CitizenReportFormPageState();
}

class _CitizenReportFormPageState
    extends ConsumerState<CitizenReportFormPage> {
  final _plateCtrl = TextEditingController();
  final _descCtrl  = TextEditingController();
  String? _selectedCategory;
  bool _submitting = false;
  bool _submitted  = false;

  static const _categories = [
    ('conductor_agresivo',  'Conductor agresivo'),
    ('velocidad_excesiva',  'Velocidad excesiva'),
    ('exceso_pasajeros',    'Exceso de pasajeros'),
    ('estado_vehiculo',     'Mal estado del vehículo'),
    ('documentos',          'Documentos irregulares'),
    ('otro',                'Otro'),
  ];

  @override
  void dispose() {
    _plateCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedCategory == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona una categoría.')));
      return;
    }
    final desc = _descCtrl.text.trim();
    if (desc.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Describe el problema (mínimo 10 caracteres).')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final user = ref.read(authProvider).user;
      final svc  = ref.read(reportApiServiceProvider);
      await svc.submitReport(
        category: _selectedCategory!,
        description: desc,
        vehiclePlate: _plateCtrl.text.trim().isEmpty ? null : _plateCtrl.text.trim(),
        municipalityId: user?.municipalityId,
      );
      if (mounted) setState(() => _submitted = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al enviar: $e'),
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
    if (_submitted) {
      return _SuccessView(onNew: () => setState(() {
        _submitted = false;
        _selectedCategory = null;
        _plateCtrl.clear();
        _descCtrl.clear();
      }));
    }

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Cabecera ─────────────────────────────────────────
            Text('Reportar anomalía',
                style: AppTheme.inter(
                  fontSize: 20, fontWeight: FontWeight.w800,
                  color: AppColors.ink9, letterSpacing: -0.5)),
            const SizedBox(height: 4),
            Text('Tu reporte es anónimo y ayuda a mejorar el transporte.',
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
            const SizedBox(height: 20),

            // ── Categoría ────────────────────────────────────────
            _label('Tipo de anomalía *'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _categories.map((c) {
                final sel = _selectedCategory == c.$1;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCategory = c.$1),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: sel ? AppColors.panel : Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: sel ? AppColors.panel : AppColors.ink2),
                    ),
                    child: Text(c.$2,
                        style: AppTheme.inter(
                          fontSize: 13,
                          fontWeight:
                              sel ? FontWeight.w600 : FontWeight.w400,
                          color: sel ? Colors.white : AppColors.ink7,
                        )),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // ── Placa (opcional) ────────────────────────────────
            _label('Placa del vehículo (opcional)'),
            const SizedBox(height: 8),
            TextField(
              controller: _plateCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: _inputDecoration('Ej. ABC-123'),
              style: AppTheme.inter(
                fontSize: 14, fontWeight: FontWeight.w600,
                color: AppColors.ink9),
            ),
            const SizedBox(height: 16),

            // ── Descripción ──────────────────────────────────────
            _label('Descripción del problema *'),
            const SizedBox(height: 8),
            TextField(
              controller: _descCtrl,
              maxLines: 4,
              maxLength: 2000,
              decoration: _inputDecoration(
                  'Describe qué ocurrió, dónde y cuándo...'),
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink8),
            ),
            const SizedBox(height: 24),

            // ── Aviso anti-fraude ────────────────────────────────
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.goldBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.shield_outlined,
                      size: 16, color: AppColors.goldDark),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Los reportes son analizados automáticamente. '
                      'Reportes falsos o maliciosos pueden resultar en penalización.',
                      style: AppTheme.inter(
                          fontSize: 12, color: AppColors.goldDark),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text('Enviar reporte',
                      style: AppTheme.inter(
                        fontSize: 15, fontWeight: FontWeight.w700,
                        color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text,
      style: AppTheme.inter(
        fontSize: 12, fontWeight: FontWeight.w600,
        color: AppColors.ink5, letterSpacing: 0.4));

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink3),
        border:
            OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.panel, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      );
}

class _SuccessView extends StatelessWidget {
  final VoidCallback onNew;
  const _SuccessView({required this.onNew});

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: AppColors.aptoBg,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_circle_outline,
                      size: 40, color: AppColors.apto),
                ),
                const SizedBox(height: 20),
                Text('¡Reporte enviado!',
                    style: AppTheme.inter(
                      fontSize: 20, fontWeight: FontWeight.w800,
                      color: AppColors.ink9)),
                const SizedBox(height: 8),
                Text(
                  'Tu reporte ha sido registrado y será revisado por el equipo fiscal. '
                  'Gracias por contribuir al transporte seguro.',
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
                ),
                const SizedBox(height: 28),
                OutlinedButton(
                  onPressed: onNew,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.panel),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    minimumSize: const Size(200, 46),
                  ),
                  child: Text('Nuevo reporte',
                      style: AppTheme.inter(
                        fontSize: 14, fontWeight: FontWeight.w600,
                        color: AppColors.panel)),
                ),
              ],
            ),
          ),
        ),
      );
}
