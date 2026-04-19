import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Cambio de contraseña — todos los roles.
class ChangePasswordPage extends ConsumerStatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  ConsumerState<ChangePasswordPage> createState() =>
      _ChangePasswordPageState();
}

class _ChangePasswordPageState extends ConsumerState<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;
  bool _submitting = false;
  bool _success = false;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.post('/auth/cambiar-password', data: {
        'currentPassword': _currentCtrl.text,
        'newPassword': _newCtrl.text,
      });
      if (mounted) {
        setState(() { _success = true; _submitting = false; });
      }
    } catch (e) {
      if (mounted) {
        final msg = _extractError(e);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: AppColors.noApto),
        );
        setState(() => _submitting = false);
      }
    }
  }

  String _extractError(Object e) {
    final s = e.toString();
    if (s.contains('403') || s.contains('incorrecta') || s.contains('actual')) {
      return 'La contraseña actual es incorrecta.';
    }
    if (s.contains('400')) {
      return 'Datos inválidos. Verifica los campos.';
    }
    return 'Error al cambiar la contraseña. Intenta de nuevo.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text(
          'Cambiar contraseña',
          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: _success ? _SuccessView(onClose: () => context.pop()) : _Form(),
    );
  }

  Widget _Form() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Contraseña actual ──────────────────────────────
            _PasswordField(
              controller: _currentCtrl,
              label: 'Contraseña actual',
              showPassword: _showCurrent,
              onToggle: () => setState(() => _showCurrent = !_showCurrent),
              validator: (v) {
                if (v == null || v.isEmpty) {
                  return 'Ingresa tu contraseña actual';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),

            // ── Nueva contraseña ──────────────────────────────
            _PasswordField(
              controller: _newCtrl,
              label: 'Nueva contraseña',
              showPassword: _showNew,
              onToggle: () => setState(() => _showNew = !_showNew),
              validator: (v) {
                if (v == null || v.length < 8) {
                  return 'Mínimo 8 caracteres';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),

            // ── Confirmar nueva contraseña ─────────────────────
            _PasswordField(
              controller: _confirmCtrl,
              label: 'Confirmar nueva contraseña',
              showPassword: _showConfirm,
              onToggle: () => setState(() => _showConfirm = !_showConfirm),
              validator: (v) {
                if (v != _newCtrl.text) {
                  return 'Las contraseñas no coinciden';
                }
                return null;
              },
            ),
            const SizedBox(height: 28),

            // ── Botón ─────────────────────────────────────────
            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text(
                      'Guardar contraseña',
                      style: AppTheme.inter(
                        fontSize: 15,
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
}

// ── Campo de contraseña ───────────────────────────────────────────────────────

class _PasswordField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool showPassword;
  final VoidCallback onToggle;
  final String? Function(String?) validator;

  const _PasswordField({
    required this.controller,
    required this.label,
    required this.showPassword,
    required this.onToggle,
    required this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: !showPassword,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
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
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        suffixIcon: IconButton(
          icon: Icon(
            showPassword ? Icons.visibility_off : Icons.visibility,
            size: 20,
            color: AppColors.ink4,
          ),
          onPressed: onToggle,
        ),
      ),
      style: AppTheme.inter(fontSize: 14, color: AppColors.ink8),
      validator: validator,
    );
  }
}

// ── Vista de éxito ────────────────────────────────────────────────────────────

class _SuccessView extends StatelessWidget {
  final VoidCallback onClose;

  const _SuccessView({required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: AppColors.aptoBg,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.lock_open,
                  size: 52, color: AppColors.apto),
            ),
            const SizedBox(height: 20),
            Text(
              'Contraseña actualizada',
              style: AppTheme.inter(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Tu contraseña fue cambiada correctamente.',
              textAlign: TextAlign.center,
              style:
                  AppTheme.inter(fontSize: 14, color: AppColors.ink6),
            ),
            const SizedBox(height: 28),
            FilledButton(
              onPressed: onClose,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(200, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(
                'Volver al perfil',
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
}
