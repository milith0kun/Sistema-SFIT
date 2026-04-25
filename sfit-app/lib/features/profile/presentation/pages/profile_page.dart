import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/services/apiperu_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_disclaimer_banner.dart';
import '../../../auth/domain/entities/user_entity.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Perfil del usuario autenticado — todos los roles.
/// Modo lectura por defecto; botón de edición para nombre, teléfono y DNI.
class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  bool _editMode = false;
  bool _saving = false;
  bool _verifyingDni = false;

  final _formKey   = GlobalKey<FormState>();
  final _nameCtrl  = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _dniCtrl   = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _dniCtrl.dispose();
    super.dispose();
  }

  void _enterEdit(UserEntity user) {
    _nameCtrl.text  = user.name;
    _phoneCtrl.text = user.phone ?? '';
    _dniCtrl.text   = user.dni   ?? '';
    setState(() => _editMode = true);
  }

  void _cancelEdit() => setState(() => _editMode = false);

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final error = await ref.read(authProvider.notifier).updatePerfil(
          name:  _nameCtrl.text.trim(),
          phone: _phoneCtrl.text.trim(),
          dni:   _dniCtrl.text.trim(),
        );
    if (!mounted) return;
    setState(() { _saving = false; _editMode = false; });
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $error'),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Perfil actualizado correctamente.'),
          backgroundColor: AppColors.apto,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _verificarDni() async {
    final dni = _dniCtrl.text.trim();
    if (dni.length != 8) return;
    setState(() => _verifyingDni = true);
    try {
      final result = await ref.read(apiPeruServiceProvider).consultarDni(dni);
      if (!mounted) return;
      if (result.nombreCompleto.isNotEmpty) {
        _nameCtrl.text = result.nombreCompleto;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Nombre verificado: ${result.nombreCompleto}'),
            backgroundColor: AppColors.apto,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      // Silencioso — el usuario puede escribir su nombre manualmente
    } finally {
      if (mounted) setState(() => _verifyingDni = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const SizedBox.shrink();

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Hero card ────────────────────────────────────────
            _ProfileHeroCard(
              user: user,
              onEdit: _editMode ? null : () => _enterEdit(user),
            ),
            const SizedBox(height: 22),

            // ── Formulario de edición ─────────────────────────────
            if (_editMode) ...[
              _EditForm(
                formKey: _formKey,
                nameCtrl: _nameCtrl,
                phoneCtrl: _phoneCtrl,
                dniCtrl: _dniCtrl,
                saving: _saving,
                verifyingDni: _verifyingDni,
                onVerifyDni: _verificarDni,
                onSave: _save,
                onCancel: _cancelEdit,
              ),
              const SizedBox(height: 22),
            ],

            // ── Información personal ──────────────────────────────
            if (!_editMode) ...[
              const _SectionLabel('INFORMACIÓN'),
              const SizedBox(height: 8),
              _InfoCard(children: [
                _InfoRow(
                  icon: Icons.email_outlined,
                  label: 'Correo',
                  value: user.email,
                ),
                if (user.phone != null && user.phone!.isNotEmpty)
                  _InfoRow(
                    icon: Icons.phone_outlined,
                    label: 'Teléfono',
                    value: user.phone!,
                  ),
                if (user.dni != null && user.dni!.isNotEmpty)
                  _InfoRow(
                    icon: Icons.badge_outlined,
                    label: 'DNI',
                    value: user.dni!,
                  ),
                _InfoRow(
                  icon: Icons.work_outline,
                  label: 'Rol',
                  value: _roleLabel(user.role),
                ),
              ]),
              const SizedBox(height: 22),
            ],

            // ── Cuenta ────────────────────────────────────────────
            const _SectionLabel('CUENTA'),
            const SizedBox(height: 8),
            _InfoCard(children: [
              _ActionRow(
                icon: Icons.lock_outline,
                label: 'Cambiar contraseña',
                onTap: () => context.push('/cambiar-password'),
              ),
            ]),
            const SizedBox(height: 22),

            // ── Acerca de ─────────────────────────────────────────
            const _SectionLabel('ACERCA DE'),
            const SizedBox(height: 8),
            const SfitDisclaimerBanner(),
            const SizedBox(height: 28),

            // ── Cerrar sesión ─────────────────────────────────────
            OutlinedButton.icon(
              onPressed: () => ref.read(authProvider.notifier).logout(),
              icon: const Icon(Icons.logout_rounded, size: 18, color: AppColors.noApto),
              label: Text(
                'Cerrar sesión',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.noApto,
                ),
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: AppColors.noAptoBorder),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _roleLabel(String role) => switch (role) {
        'ciudadano'         => 'Ciudadano',
        'conductor'         => 'Conductor',
        'fiscal'            => 'Fiscal / Inspector',
        'operador'          => 'Operador de Empresa',
        'admin_municipal'   => 'Administrador Municipal',
        'admin_provincial'  => 'Administrador Provincial',
        'super_admin'       => 'Super Admin',
        _                   => role,
      };
}

// ── Formulario de edición ─────────────────────────────────────────────────────

class _EditForm extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl;
  final TextEditingController phoneCtrl;
  final TextEditingController dniCtrl;
  final bool saving;
  final bool verifyingDni;
  final VoidCallback onVerifyDni;
  final VoidCallback onSave;
  final VoidCallback onCancel;

  const _EditForm({
    required this.formKey,
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.dniCtrl,
    required this.saving,
    required this.verifyingDni,
    required this.onVerifyDni,
    required this.onSave,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.edit_outlined, size: 16, color: AppColors.panel),
                const SizedBox(width: 6),
                Text(
                  'EDITAR PERFIL',
                  style: AppTheme.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.panel,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            _EditField(
              controller: nameCtrl,
              label: 'Nombre completo',
              icon: Icons.person_outlined,
              enabled: !saving,
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  (v == null || v.trim().length < 2) ? 'Mínimo 2 caracteres' : null,
            ),
            const SizedBox(height: 12),

            _EditField(
              controller: phoneCtrl,
              label: 'Teléfono (opcional)',
              icon: Icons.phone_outlined,
              enabled: !saving,
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 12),

            TextFormField(
              controller: dniCtrl,
              enabled: !saving,
              keyboardType: TextInputType.number,
              maxLength: 8,
              style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
              decoration: InputDecoration(
                labelText: 'DNI (opcional)',
                counterText: '',
                prefixIcon: const Icon(Icons.badge_outlined, size: 20),
                filled: true,
                fillColor: Colors.white,
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
                suffixIcon: verifyingDni
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.gold,
                          ),
                        ),
                      )
                    : Tooltip(
                        message: 'Verificar en RENIEC',
                        child: IconButton(
                          icon: const Icon(Icons.manage_search_outlined,
                              size: 22, color: AppColors.panel),
                          onPressed: saving ? null : onVerifyDni,
                        ),
                      ),
              ),
              validator: (v) {
                if (v != null && v.isNotEmpty && v.trim().length != 8) {
                  return 'El DNI debe tener 8 dígitos';
                }
                return null;
              },
            ),
            const SizedBox(height: 18),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: saving ? null : onCancel,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 44),
                      side: const BorderSide(color: AppColors.ink3),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(9)),
                    ),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: saving ? null : onSave,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.panel,
                      minimumSize: const Size(0, 44),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(9)),
                    ),
                    child: saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Guardar'),
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

class _EditField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final bool enabled;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final String? Function(String?)? validator;

  const _EditField({
    required this.controller,
    required this.label,
    required this.icon,
    required this.enabled,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.validator,
  });

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        enabled: enabled,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 20),
          filled: true,
          fillColor: Colors.white,
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
        ),
        validator: validator,
      );
}

// ── Hero card ──────────────────────────────────────────────────────────────────
class _ProfileHeroCard extends StatelessWidget {
  final UserEntity user;
  final VoidCallback? onEdit;
  const _ProfileHeroCard({required this.user, this.onEdit});

  @override
  Widget build(BuildContext context) {
    final initials = _initials(user.name);
    final (statusBg, statusBorder, statusFg, statusLabel) = switch (user.status) {
      'activo'     => (AppColors.aptoBg,   AppColors.aptoBorder,   AppColors.apto,   'Activo'),
      'pendiente'  => (AppColors.riesgoBg, AppColors.riesgoBorder, AppColors.riesgo, 'Pendiente'),
      'rechazado'  => (AppColors.noAptoBg, AppColors.noAptoBorder, AppColors.noApto, 'Rechazado'),
      'suspendido' => (AppColors.ink1,     AppColors.ink3,         AppColors.ink5,   'Suspendido'),
      _            => (AppColors.ink1,     AppColors.ink3,         AppColors.ink5,   user.status),
    };

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.panel, AppColors.panelMid],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      padding: const EdgeInsets.fromLTRB(24, 22, 24, 26),
      child: Stack(
        children: [
          // Botón editar (esquina superior derecha)
          if (onEdit != null)
            Positioned(
              top: 0,
              right: 0,
              child: Tooltip(
                message: 'Editar perfil',
                child: Material(
                  color: Colors.white10,
                  borderRadius: BorderRadius.circular(8),
                  child: InkWell(
                    onTap: onEdit,
                    borderRadius: BorderRadius.circular(8),
                    child: const Padding(
                      padding: EdgeInsets.all(7),
                      child: Icon(Icons.edit_outlined,
                          size: 18, color: Colors.white70),
                    ),
                  ),
                ),
              ),
            ),

          Column(
            children: [
              const SizedBox(height: 8),
              // Avatar
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.goldBg,
                  border: Border.all(color: AppColors.gold, width: 2.5),
                ),
                child: Center(
                  child: Text(
                    initials,
                    style: AppTheme.inter(
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      color: AppColors.goldDark,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              Text(
                user.name,
                textAlign: TextAlign.center,
                style: AppTheme.inter(
                  fontSize: 21,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 12),

              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 6,
                children: [
                  _HeroBadge(label: _roleLabel(user.role),
                      bg: AppColors.goldBg, border: AppColors.goldBorder, fg: AppColors.goldDark),
                  _StatusBadge(bg: statusBg, border: statusBorder, fg: statusFg, label: statusLabel),
                ],
              ),

              const SizedBox(height: 16),
              Container(height: 1, color: Colors.white10),
              const SizedBox(height: 14),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.email_outlined, size: 14, color: Colors.white38),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      user.email,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.inter(
                        fontSize: 13,
                        color: Colors.white60,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  static String _roleLabel(String role) => switch (role) {
        'ciudadano'         => 'Ciudadano',
        'conductor'         => 'Conductor',
        'fiscal'            => 'Fiscal',
        'operador'          => 'Operador',
        'admin_municipal'   => 'Admin Municipal',
        'admin_provincial'  => 'Admin Provincial',
        'super_admin'       => 'Super Admin',
        _                   => role,
      };
}

class _HeroBadge extends StatelessWidget {
  final String label;
  final Color bg, border, fg;
  const _HeroBadge({required this.label, required this.bg, required this.border, required this.fg});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: border),
        ),
        child: Text(
          label,
          style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w700, color: fg),
        ),
      );
}

class _StatusBadge extends StatelessWidget {
  final Color bg, border, fg;
  final String label;
  const _StatusBadge({required this.bg, required this.border, required this.fg, required this.label});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 6, height: 6,
                decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
            const SizedBox(width: 5),
            Text(label,
                style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
          ],
        ),
      );
}

// ── Widgets reutilizables ─────────────────────────────────────────────────────

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (int i = 0; i < children.length; i++) {
      rows.add(children[i]);
      if (i < children.length - 1) {
        rows.add(const Divider(height: 1, indent: 48, color: AppColors.ink1));
      }
    }
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(children: rows),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: AppColors.ink1,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: AppColors.ink5),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: AppTheme.inter(
                          fontSize: 11, fontWeight: FontWeight.w600,
                          color: AppColors.ink4, letterSpacing: 0.3)),
                  const SizedBox(height: 1),
                  Text(value,
                      style: AppTheme.inter(
                          fontSize: 14, fontWeight: FontWeight.w600,
                          color: AppColors.ink9)),
                ],
              ),
            ),
          ],
        ),
      );
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 2),
        child: Text(
          text,
          style: AppTheme.inter(
            fontSize: 11, fontWeight: FontWeight.w700,
            color: AppColors.ink4, letterSpacing: 0.8,
          ),
        ),
      );
}

class _ActionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _ActionRow({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: AppColors.ink1,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: AppColors.ink5),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label,
                    style: AppTheme.inter(
                        fontSize: 14, fontWeight: FontWeight.w500,
                        color: AppColors.ink8)),
              ),
              const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.ink3),
            ],
          ),
        ),
      );
}
