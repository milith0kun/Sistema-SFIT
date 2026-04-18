import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
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

            // ── Acciones ──────────────────────────────────────────
            _InfoCard(children: [
              _ActionRow(
                icon: Icons.lock_outline,
                label: 'Privacidad y seguridad',
                onTap: () {},
              ),
              const Divider(height: 1, color: AppColors.ink1),
              _ActionRow(
                icon: Icons.help_outline,
                label: 'Ayuda',
                onTap: () {},
              ),
            ]),
            const SizedBox(height: 16),

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
