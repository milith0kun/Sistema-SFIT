import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_disclaimer_banner.dart';
import '../../../auth/domain/entities/user_entity.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Perfil del usuario autenticado — todos los roles.
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const SizedBox.shrink();

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Hero card ─────────────────────────────────────────
            _ProfileHeroCard(user: user),
            const SizedBox(height: 22),

            // ── Información personal ──────────────────────────────
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
              _InfoRow(
                icon: Icons.badge_outlined,
                label: 'Rol',
                value: _roleLabel(user.role),
              ),
            ]),
            const SizedBox(height: 22),

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

// ── Hero card ──────────────────────────────────────────────────────────────────
class _ProfileHeroCard extends StatelessWidget {
  final UserEntity user;
  const _ProfileHeroCard({required this.user});

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
      padding: const EdgeInsets.fromLTRB(24, 30, 24, 26),
      child: Column(
        children: [
          // Avatar con inicial(es)
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

          // Nombre
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

          // Chips: rol + estado
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              // Badge rol
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.goldBorder),
                ),
                child: Text(
                  _roleLabel(user.role),
                  style: AppTheme.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.goldDark,
                  ),
                ),
              ),

              // Badge estado
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: statusBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: statusFg,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      statusLabel,
                      style: AppTheme.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: statusFg,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Separador + email (dato clave siempre visible)
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

// ── Info card ──────────────────────────────────────────────────────────────────
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

// ── Info row ───────────────────────────────────────────────────────────────────
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
              width: 32,
              height: 32,
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
                  Text(
                    label,
                    style: AppTheme.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink4,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    value,
                    style: AppTheme.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink9,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

// ── Section label ─────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 2),
        child: Text(
          text,
          style: AppTheme.inter(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.ink4,
            letterSpacing: 0.8,
          ),
        ),
      );
}

// ── Action row ────────────────────────────────────────────────────────────────
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
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.ink1,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: AppColors.ink5),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink8,
                  ),
                ),
              ),
              const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.ink3),
            ],
          ),
        ),
      );
}
