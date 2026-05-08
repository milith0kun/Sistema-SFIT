import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../drivers/data/datasources/driver_api_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Pantalla de edición del perfil del conductor — los datos personales que
/// el sistema necesita y que solo el propio conductor puede llenar.
///
/// Validaciones server-side: DNI único, número de licencia único. El backend
/// devuelve error 409 con mensaje legible cuando hay duplicado.
class EditarPerfilConductorPage extends ConsumerStatefulWidget {
  const EditarPerfilConductorPage({super.key});

  @override
  ConsumerState<EditarPerfilConductorPage> createState() =>
      _EditarPerfilConductorPageState();
}

class _EditarPerfilConductorPageState
    extends ConsumerState<EditarPerfilConductorPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _dniCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _dniCtrl.dispose();
    _licenseCtrl.dispose();
    _categoryCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await ref.read(driverApiServiceProvider).getMyDriverProfile();
      if (!mounted) return;
      setState(() {
        _nameCtrl.text = (data?['name'] as String?) ?? '';
        _dniCtrl.text = (data?['dni'] as String?) ?? '';
        _licenseCtrl.text = (data?['licenseNumber'] as String?) ?? '';
        _categoryCtrl.text = (data?['licenseCategory'] as String?) ?? 'A-IIB';
        _phoneCtrl.text = (data?['phone'] as String?) ?? '';
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref.read(driverApiServiceProvider).updateMyProfile(
            name: _nameCtrl.text.trim(),
            dni: _dniCtrl.text.trim(),
            licenseNumber: _licenseCtrl.text.trim(),
            licenseCategory: _categoryCtrl.text.trim(),
            phone: _phoneCtrl.text.trim(),
          );
      if (!mounted) return;
      ref.invalidate(myDriverProfileProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Datos actualizados'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.apto,
        ),
      );
      if (context.canPop()) context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_extractError(e)),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.noApto,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (data is Map && data['message'] is String) return data['message'] as String;
    }
    return 'No se pudo guardar el perfil';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.paper,
        body: Center(child: CircularProgressIndicator(color: AppColors.gold)),
      );
    }
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Mi perfil',
          style: AppTheme.inter(
              fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sectionLabel('IDENTIFICACIÓN'),
              const SizedBox(height: 8),
              _field(
                label: 'Nombre completo',
                controller: _nameCtrl,
                hint: 'Ej. Juan Pérez García',
                validator: (v) =>
                    v == null || v.trim().length < 3 ? 'Mínimo 3 caracteres' : null,
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 12),
              _field(
                label: 'DNI',
                controller: _dniCtrl,
                hint: '8 dígitos',
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(8),
                ],
                validator: (v) => RegExp(r'^\d{8}$').hasMatch(v ?? '')
                    ? null
                    : 'DNI debe tener 8 dígitos',
                icon: Icons.badge_outlined,
                helper: 'Único nacional. No puede repetirse con otro conductor.',
              ),
              const SizedBox(height: 20),
              _sectionLabel('LICENCIA DE CONDUCIR'),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  flex: 3,
                  child: _field(
                    label: 'Número',
                    controller: _licenseCtrl,
                    hint: 'Ej. Q12345678',
                    validator: (v) =>
                        v == null || v.trim().length < 5 ? 'Inválido' : null,
                    icon: Icons.credit_card,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: _field(
                    label: 'Categoría',
                    controller: _categoryCtrl,
                    hint: 'A-IIB',
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Requerido' : null,
                    icon: Icons.category_outlined,
                  ),
                ),
              ]),
              const SizedBox(height: 20),
              _sectionLabel('CONTACTO'),
              const SizedBox(height: 8),
              _field(
                label: 'Teléfono (opcional)',
                controller: _phoneCtrl,
                hint: 'Ej. 984123456',
                keyboardType: TextInputType.phone,
                icon: Icons.phone_outlined,
              ),
              const SizedBox(height: 28),
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                      )
                    : const Icon(Icons.check_rounded, size: 20),
                label: Text(
                  _saving ? 'Guardando…' : 'Guardar cambios',
                  style: AppTheme.inter(
                    fontSize: 14.5, fontWeight: FontWeight.w700, color: Colors.white),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  disabledBackgroundColor: AppColors.ink2,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) => Text(
        text,
        style: AppTheme.inter(
          fontSize: 11, fontWeight: FontWeight.w800,
          color: AppColors.ink5, letterSpacing: 1.2),
      );

  Widget _field({
    required String label,
    required TextEditingController controller,
    required String hint,
    String? helper,
    String? Function(String?)? validator,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    IconData? icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTheme.inter(
            fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink7),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: AppTheme.inter(fontSize: 13.5, color: AppColors.ink4),
            prefixIcon: icon != null ? Icon(icon, color: AppColors.ink5, size: 18) : null,
            helperText: helper,
            helperStyle: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
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
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            fillColor: Colors.white,
            filled: true,
          ),
          style: AppTheme.inter(fontSize: 14, color: AppColors.ink9, tabular: true),
        ),
      ],
    );
  }
}
