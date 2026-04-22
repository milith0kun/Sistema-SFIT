import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../ai_ocr/presentation/pages/document_ocr_page.dart';
import '../../data/datasources/operator_api_service.dart';

/// RF-05-01 · Registro de conductor — Rol OPERADOR.
class NuevoConductorPage extends ConsumerStatefulWidget {
  const NuevoConductorPage({super.key});

  @override
  ConsumerState<NuevoConductorPage> createState() =>
      _NuevoConductorPageState();
}

class _NuevoConductorPageState extends ConsumerState<NuevoConductorPage> {
  final _formKey = GlobalKey<FormState>();

  final _nombreCtrl   = TextEditingController();
  final _dniCtrl      = TextEditingController();
  final _licNumCtrl   = TextEditingController();
  final _phoneCtrl    = TextEditingController();

  String? _licenseCategory;
  bool _saving = false;

  static const _licenseCategories = [
    'A-I', 'A-IIa', 'A-IIb', 'A-IIIa', 'A-IIIb', 'A-IIIc',
    'B-I', 'B-IIa', 'B-IIb',
  ];

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _dniCtrl.dispose();
    _licNumCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  // ── OCR helpers ────────────────────────────────────────────────

  Future<void> _scanDni() async {
    final result = await context.push<Map<String, dynamic>>(
      '/ocr-documento',
      extra: {'docType': OcrDocType.dni},
    );
    if (result == null || !mounted) return;

    int filled = 0;
    final nombre = result['nombre'] as String?;
    final dni    = result['numeroDocumento'] as String?;

    if (nombre != null && nombre.isNotEmpty) {
      _nombreCtrl.text = nombre;
      filled++;
    }
    if (dni != null && dni.isNotEmpty) {
      _dniCtrl.text = dni;
      filled++;
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('DNI escaneado — $filled campo${filled == 1 ? '' : 's'} rellenado${filled == 1 ? '' : 's'}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _scanLicencia() async {
    final result = await context.push<Map<String, dynamic>>(
      '/ocr-documento',
      extra: {'docType': OcrDocType.licencia},
    );
    if (result == null || !mounted) return;

    int filled = 0;
    final numero    = result['numeroLicencia'] as String?;
    final categoria = result['categoria'] as String?;

    if (numero != null && numero.isNotEmpty) {
      _licNumCtrl.text = numero;
      filled++;
    }
    if (categoria != null && categoria.isNotEmpty) {
      // Match case-insensitive against the list
      final match = _licenseCategories.cast<String?>().firstWhere(
        (c) => c!.toLowerCase() == categoria.toLowerCase(),
        orElse: () => null,
      );
      if (match != null) {
        setState(() => _licenseCategory = match);
        filled++;
      }
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Licencia escaneada — $filled campo${filled == 1 ? '' : 's'} rellenado${filled == 1 ? '' : 's'}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // ── Submit ──────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final svc = ref.read(operatorApiServiceProvider);
      await svc.createConductor(
        name:            _nombreCtrl.text.trim(),
        dni:             _dniCtrl.text.trim(),
        licenseNumber:   _licNumCtrl.text.trim(),
        licenseCategory: _licenseCategory!,
        phone:           _phoneCtrl.text.trim().isEmpty
                             ? null
                             : _phoneCtrl.text.trim(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al registrar conductor: $e'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.noApto,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Build ───────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink9,
        title: Text(
          'Registrar conductor',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Kicker
              Text(
                'RF-05-01 · OPERADOR',
                style: AppTheme.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink5,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Nuevo conductor',
                style: AppTheme.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.015,
                ),
              ),
              const SizedBox(height: 24),

              // ── Bloque OCR ─────────────────────────────────────
              _SectionLabel(label: 'Escanear documentos'),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _scanDni,
                      icon: const Icon(Icons.document_scanner_outlined, size: 18),
                      label: const Text('Escanear DNI'),
                      style: _ocrButtonStyle(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _scanLicencia,
                      icon: const Icon(Icons.document_scanner_outlined, size: 18),
                      label: const Text('Escanear licencia'),
                      style: _ocrButtonStyle(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // ── Campos del formulario ──────────────────────────
              _SectionLabel(label: 'Datos personales'),
              const SizedBox(height: 10),

              _buildField(
                controller: _nombreCtrl,
                label: 'Nombre completo',
                hint: 'Ej. Juan Pérez Quispe',
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 14),

              _buildField(
                controller: _dniCtrl,
                label: 'DNI',
                hint: '8 dígitos',
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Campo requerido';
                  if (v.trim().length != 8) return 'Debe tener 8 dígitos';
                  return null;
                },
              ),
              const SizedBox(height: 14),

              _buildField(
                controller: _phoneCtrl,
                label: 'Teléfono (opcional)',
                hint: 'Ej. 987654321',
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 28),

              _SectionLabel(label: 'Licencia de conducir'),
              const SizedBox(height: 10),

              _buildField(
                controller: _licNumCtrl,
                label: 'Número de licencia',
                hint: 'Ej. Q00234567',
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 14),

              // Dropdown categoría
              DropdownButtonFormField<String>(
                value: _licenseCategory,
                decoration: _fieldDecoration('Categoría de licencia'),
                hint: Text(
                  'Seleccionar categoría',
                  style: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
                ),
                items: _licenseCategories
                    .map(
                      (c) => DropdownMenuItem(
                        value: c,
                        child: Text(
                          c,
                          style: AppTheme.inter(
                            fontSize: 14,
                            color: AppColors.ink9,
                          ),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _saving
                    ? null
                    : (val) => setState(() => _licenseCategory = val),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Selecciona una categoría' : null,
              ),
              const SizedBox(height: 32),

              // ── Botón guardar ──────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: _saving ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ink9,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'Registrar conductor',
                          style: AppTheme.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers de estilo ───────────────────────────────────────────

  InputDecoration _fieldDecoration(String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      labelStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
      hintStyle: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.ink3),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.ink3),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.panel, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.noApto),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.noApto, width: 1.5),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    String? hint,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      enabled: !_saving,
      style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
      decoration: _fieldDecoration(label, hint: hint),
      validator: validator,
    );
  }

  ButtonStyle _ocrButtonStyle() => OutlinedButton.styleFrom(
        foregroundColor: AppColors.panel,
        side: const BorderSide(color: AppColors.ink3),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.symmetric(vertical: 12),
        textStyle: AppTheme.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      );
}

// ── Section label helper ──────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: AppTheme.inter(
        fontSize: 10.5,
        fontWeight: FontWeight.w700,
        color: AppColors.ink5,
        letterSpacing: 1.2,
      ),
    );
  }
}
