import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_disclaimer_banner.dart';
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
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Avatar + nombre ──────────────────────────────────
            Container(
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 38,
                    backgroundColor: AppColors.goldBg,
                    child: Text(
                      user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                      style: AppTheme.inter(
                        fontSize: 30, fontWeight: FontWeight.w800,
                        color: AppColors.goldDark,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user.name,
                    style: AppTheme.inter(
                      fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.goldBg,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      _roleLabel(user.role),
                      style: AppTheme.inter(
                        fontSize: 12, fontWeight: FontWeight.w600,
                        color: AppColors.goldDark,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Info ─────────────────────────────────────────────
            _InfoCard(children: [
              _InfoRow(icon: Icons.email_outlined, label: 'Correo', value: user.email),
              _InfoRow(icon: Icons.badge_outlined, label: 'Rol', value: _roleLabel(user.role)),
              _InfoRow(icon: Icons.circle, label: 'Estado', value: _statusLabel(user.status)),
            ]),
            const SizedBox(height: 16),

            // ── SFITCoins (solo ciudadano) ────────────────────────
            if (user.isCiudadano) ...[
              _InfoCard(children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      const Icon(Icons.monetization_on_outlined,
                          size: 20, color: AppColors.gold),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'SFITCoins',
                              style: AppTheme.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink7,
                              ),
                            ),
                            Text(
                              'Gana puntos por reportar y verificar',
                              style: AppTheme.inter(
                                  fontSize: 11, color: AppColors.ink4),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          // Navegar a la tab de recompensas (index 2 en home)
                          // El home navega por tabs — usamos context.go al home
                          // con parámetro de tab si está disponible.
                          context.go('/home');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.goldBg,
                            border: Border.all(color: AppColors.goldBorder),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Ver recompensas',
                            style: AppTheme.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.goldDark,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ]),
              const SizedBox(height: 16),
            ],

            // ── Cuenta ────────────────────────────────────────────
            const _SectionLabel(label: 'Cuenta'),
            const SizedBox(height: 8),
            _InfoCard(children: [
              _ActionRow(
                icon: Icons.lock_outline,
                label: 'Cambiar contraseña',
                onTap: () => context.push('/cambiar-password'),
              ),
            ]),
            const SizedBox(height: 16),

            // ── Acerca de ─────────────────────────────────────────
            const _SectionLabel(label: 'Acerca de'),
            const SizedBox(height: 8),
            const SfitDisclaimerBanner(),
            const SizedBox(height: 16),

            // ── Sesión ────────────────────────────────────────────
            const _SectionLabel(label: 'Sesión'),
            const SizedBox(height: 8),

            // ── Cerrar sesión ─────────────────────────────────────
            OutlinedButton.icon(
              onPressed: () => ref.read(authProvider.notifier).logout(),
              icon: const Icon(Icons.logout, size: 18, color: AppColors.noApto),
              label: Text(
                'Cerrar sesión',
                style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.noApto),
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                side: const BorderSide(color: AppColors.noAptoBorder),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _roleLabel(String role) => switch (role) {
        'ciudadano'         => 'Ciudadano',
        'conductor'         => 'Conductor',
        'fiscal'            => 'Fiscal / Inspector',
        'operador'          => 'Operador de Empresa',
        'admin_municipal'   => 'Administrador Municipal',
        'admin_provincial'  => 'Administrador Provincial',
        'super_admin'       => 'Super Admin',
        _                   => role,
      };

  String _statusLabel(String s) => switch (s) {
        'activo'     => 'Activo',
        'pendiente'  => 'Pendiente de aprobación',
        'rechazado'  => 'Rechazado',
        'suspendido' => 'Suspendido',
        _            => s,
      };
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

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

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(icon, size: 18, color: AppColors.ink4),
            const SizedBox(width: 12),
            Text(label,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
            const Spacer(),
            Flexible(
              child: Text(value,
                  textAlign: TextAlign.end,
                  style: AppTheme.inter(
                      fontSize: 13, fontWeight: FontWeight.w600,
                      color: AppColors.ink8)),
            ),
          ],
        ),
      );
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(
          label.toUpperCase(),
          style: AppTheme.inter(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.ink4,
            letterSpacing: 0.6,
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
              Icon(icon, size: 18, color: AppColors.ink5),
              const SizedBox(width: 12),
              Expanded(
                  child: Text(label,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink8))),
              const Icon(Icons.chevron_right, size: 18, color: AppColors.ink3),
            ],
          ),
        ),
      );
}

