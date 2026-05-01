import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/navigation/navigation_key.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../providers/auth_provider.dart';

/// Selector de rol que se muestra cuando un super_admin entra al app
/// móvil. Permite "entrar como" un usuario activo de uno de los 4 roles
/// operativos para revisar la experiencia de cada uno.
class RolePreviewPage extends ConsumerStatefulWidget {
  const RolePreviewPage({super.key});

  @override
  ConsumerState<RolePreviewPage> createState() => _RolePreviewPageState();
}

class _RolePreviewPageState extends ConsumerState<RolePreviewPage> {
  String? _loadingRole;

  static const _roles = <_RoleOption>[
    _RoleOption(
      slug: 'ciudadano',
      label: 'Ciudadano',
      description: 'Reportar vehículos, feed comunitario, premios.',
      icon: Icons.person_pin_rounded,
      accent: AppColors.info,
      accentBg: AppColors.infoBg,
    ),
    _RoleOption(
      slug: 'conductor',
      label: 'Conductor',
      description: 'Rutas asignadas, turno activo, fatiga, viajes.',
      icon: Icons.directions_car_rounded,
      accent: AppColors.apto,
      accentBg: AppColors.aptoBg,
    ),
    _RoleOption(
      slug: 'fiscal',
      label: 'Fiscal',
      description: 'Inspecciones, escáner QR, validar reportes.',
      icon: Icons.assignment_turned_in_rounded,
      accent: AppColors.primary,
      accentBg: AppColors.primaryBg,
    ),
    _RoleOption(
      slug: 'operador',
      label: 'Operador',
      description: 'Flota del día, conductores, vehículos, análisis.',
      icon: Icons.local_shipping_rounded,
      accent: AppColors.riesgo,
      accentBg: AppColors.riesgoBg,
    ),
  ];

  Future<void> _enterAs(_RoleOption role) async {
    setState(() => _loadingRole = role.slug);
    final error = await ref.read(authProvider.notifier).previewAs(role.slug);
    if (!mounted) return;
    setState(() => _loadingRole = null);
    if (error != null) {
      showAppSnackBar(
        SnackBar(
          content: Text(error),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    // Si tuvo éxito, el AuthProvider cambió el state.user.role → el
    // GoRouter detecta el cambio y HomePage rebuildea con los tabs del
    // nuevo rol automáticamente.
  }

  Future<bool?> _confirmLogout(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(color: AppColors.noAptoBg, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: const Icon(Icons.logout_rounded, color: AppColors.noApto, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '¿Cerrar sesión?',
                style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
              ),
            ),
          ],
        ),
        content: Text(
          'Tendrás que volver a ingresar con tu correo o cuenta de Google la próxima vez.',
          style: AppTheme.inter(fontSize: 13, color: AppColors.ink6, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancelar', style: AppTheme.inter(fontSize: 13.5, color: AppColors.ink6, fontWeight: FontWeight.w600)),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.noApto,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text('Cerrar sesión', style: AppTheme.inter(fontSize: 13.5, color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldLogout = await _confirmLogout(context);
        if (shouldLogout == true && context.mounted) {
          await ref.read(authProvider.notifier).logout();
        }
      },
      child: Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const SfitMark(size: 32),
                  const SizedBox(width: 10),
                  Text(
                    'SFIT',
                    style: AppTheme.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink9,
                      letterSpacing: 2.4,
                    ),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () =>
                        ref.read(authProvider.notifier).logout(),
                    icon: const Icon(Icons.logout_rounded, size: 16, color: AppColors.ink5),
                    label: Text(
                      'Salir',
                      style: AppTheme.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink6,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Container(width: 5, height: 5, decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text(
                    'MODO SUPER ADMIN',
                    style: AppTheme.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                      letterSpacing: 1.6,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Vista por rol',
                style: AppTheme.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink9,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Sigues siendo tú — la app se adapta al rol que elijas para revisar la experiencia. Podrás volver desde la sidebar.',
                style: AppTheme.inter(
                  fontSize: 13,
                  color: AppColors.ink5,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 22),
              for (final role in _roles) ...[
                _RoleCard(
                  option: role,
                  loading: _loadingRole == role.slug,
                  disabled: _loadingRole != null && _loadingRole != role.slug,
                  onTap: () => _enterAs(role),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      ),
      ),
    );
  }
}

class _RoleOption {
  final String slug;
  final String label;
  final String description;
  final IconData icon;
  final Color accent;
  final Color accentBg;

  const _RoleOption({
    required this.slug,
    required this.label,
    required this.description,
    required this.icon,
    required this.accent,
    required this.accentBg,
  });
}

class _RoleCard extends StatelessWidget {
  final _RoleOption option;
  final bool loading;
  final bool disabled;
  final VoidCallback onTap;

  const _RoleCard({
    required this.option,
    required this.loading,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: disabled ? null : onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.ink2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: option.accentBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: option.accent.withValues(alpha: 0.3)),
                  ),
                  child: Icon(option.icon, size: 22, color: option.accent),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        option.label,
                        style: AppTheme.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        option.description,
                        style: AppTheme.inter(
                          fontSize: 12,
                          color: AppColors.ink5,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (loading)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.ink5),
                  )
                else
                  const Icon(Icons.chevron_right_rounded, color: AppColors.ink4, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
