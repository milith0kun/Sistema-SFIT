import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/entities/user_entity.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'sfit_mark.dart';

/// Drawer lateral de SFIT — espejo del patrón de la sidebar web (navy
/// `#0A1628`, kickers de sección en rojo SFIT, items con icono + label,
/// estado activo con fondo rojo 18%, footer con avatar + logout).
class SfitSidebar extends ConsumerWidget {
  /// Slug del tab activo (para resaltar el item correspondiente).
  final String currentSlug;

  /// Callback cuando el usuario toca un tab interno (cambia el `_index`
  /// de HomePage). Para items que son rutas externas la sidebar usa
  /// `context.push` directamente.
  final void Function(String slug) onSelectTab;

  /// Conteo de notificaciones sin leer (para mostrar badge en el item
  /// de Notificaciones).
  final int unreadNotifCount;

  /// `true` cuando un super_admin está previsualizando como otro rol.
  /// Muestra un banner arriba del drawer con botón "Volver a super admin".
  final bool inPreviewMode;

  const SfitSidebar({
    super.key,
    required this.currentSlug,
    required this.onSelectTab,
    this.unreadNotifCount = 0,
    this.inPreviewMode = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const SizedBox.shrink();
    final sections = _sectionsForRole(user.role);

    return Drawer(
      backgroundColor: AppColors.panel,
      width: 282,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(18),
          bottomRight: Radius.circular(18),
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            _Header(onClose: () => Navigator.of(context).pop()),
            const _Divider(),
            if (inPreviewMode)
              _PreviewBanner(
                onRevert: () async {
                  Navigator.of(context).pop();
                  await ref.read(authProvider.notifier).revertPreview();
                },
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: [
                  for (final section in sections) ...[
                    _SectionLabel(section.label),
                    for (final item in section.items)
                      _NavTile(
                        icon: item.icon,
                        label: item.label,
                        active: item.slug == currentSlug,
                        badge: item.slug == 'notificaciones'
                            ? unreadNotifCount
                            : 0,
                        onTap: () {
                          Navigator.of(context).pop(); // cerrar drawer
                          if (item.route != null) {
                            context.push(item.route!);
                          } else if (item.slug != null) {
                            onSelectTab(item.slug!);
                          }
                        },
                      ),
                    const SizedBox(height: 12),
                  ],
                ],
              ),
            ),
            const _Divider(),
            _Footer(
              user: user,
              onLogout: () {
                Navigator.of(context).pop();
                ref.read(authProvider.notifier).logout();
              },
            ),
          ],
        ),
      ),
    );
  }

  List<_NavSection> _sectionsForRole(String role) => switch (role) {
        'ciudadano' => const [
            _NavSection(label: 'Panel', items: [
              _NavItem(icon: Icons.home_outlined, label: 'Inicio', slug: 'inicio'),
              _NavItem(icon: Icons.dynamic_feed_outlined, label: 'Feed comunitario', slug: 'inicio-feed'),
              _NavItem(icon: Icons.notifications_outlined, label: 'Notificaciones', slug: 'notificaciones', route: '/notificaciones'),
            ]),
            _NavSection(label: 'Acciones', items: [
              _NavItem(icon: Icons.campaign_outlined, label: 'Reportar', slug: 'reportar'),
              _NavItem(icon: Icons.qr_code_scanner_outlined, label: 'Escanear QR', route: '/qr'),
            ]),
            _NavSection(label: 'Mi actividad', items: [
              _NavItem(icon: Icons.list_alt_outlined, label: 'Mis reportes', slug: 'mis-reportes'),
              _NavItem(icon: Icons.emoji_events_outlined, label: 'Premios', slug: 'premios'),
            ]),
            _NavSection(label: 'Mi cuenta', items: [
              _NavItem(icon: Icons.person_outline, label: 'Mi perfil', slug: 'perfil'),
            ]),
          ],
        'fiscal' => const [
            _NavSection(label: 'Panel', items: [
              _NavItem(icon: Icons.home_outlined, label: 'Inicio', slug: 'inicio'),
              _NavItem(icon: Icons.notifications_outlined, label: 'Notificaciones', slug: 'notificaciones', route: '/notificaciones'),
            ]),
            _NavSection(label: 'Inspección', items: [
              _NavItem(icon: Icons.assignment_outlined, label: 'Inspecciones', slug: 'inspecciones'),
              _NavItem(icon: Icons.qr_code_scanner_outlined, label: 'Escanear QR', slug: 'qr'),
              _NavItem(icon: Icons.flag_outlined, label: 'Reportes', slug: 'reportes'),
            ]),
            _NavSection(label: 'Mi cuenta', items: [
              _NavItem(icon: Icons.person_outline, label: 'Mi perfil', slug: 'perfil'),
            ]),
          ],
        'operador' => const [
            _NavSection(label: 'Panel', items: [
              _NavItem(icon: Icons.home_outlined, label: 'Inicio', slug: 'inicio'),
              _NavItem(icon: Icons.notifications_outlined, label: 'Notificaciones', slug: 'notificaciones', route: '/notificaciones'),
            ]),
            _NavSection(label: 'Operación', items: [
              _NavItem(icon: Icons.local_shipping_outlined, label: 'Flota', slug: 'flota'),
              _NavItem(icon: Icons.groups_2_outlined, label: 'Conductores', slug: 'conductores'),
              _NavItem(icon: Icons.directions_car_outlined, label: 'Vehículos', slug: 'vehiculos'),
              _NavItem(icon: Icons.bar_chart_outlined, label: 'Análisis', slug: 'analisis'),
            ]),
            _NavSection(label: 'Mi cuenta', items: [
              _NavItem(icon: Icons.person_outline, label: 'Mi perfil', slug: 'perfil'),
            ]),
          ],
        'conductor' => const [
            _NavSection(label: 'Panel', items: [
              _NavItem(icon: Icons.home_outlined, label: 'Inicio', slug: 'inicio'),
              _NavItem(icon: Icons.notifications_outlined, label: 'Notificaciones', slug: 'notificaciones', route: '/notificaciones'),
            ]),
            _NavSection(label: 'Operación', items: [
              _NavItem(icon: Icons.route_outlined, label: 'Mis rutas', slug: 'rutas'),
              _NavItem(icon: Icons.map_outlined, label: 'Mapa', slug: 'mapa'),
              _NavItem(icon: Icons.monitor_heart_outlined, label: 'Fatiga', slug: 'fatiga'),
              _NavItem(icon: Icons.timeline_outlined, label: 'Viajes', slug: 'viajes'),
            ]),
            _NavSection(label: 'Mi cuenta', items: [
              _NavItem(icon: Icons.person_outline, label: 'Mi perfil', slug: 'perfil'),
            ]),
          ],
        // admin_municipal/provincial/super_admin son web-only — la sidebar
        // del app no los expone (HomePage corta con StatusScreen antes).
        _ => const [
            _NavSection(label: 'Panel', items: [
              _NavItem(icon: Icons.home_outlined, label: 'Inicio', slug: 'inicio'),
            ]),
            _NavSection(label: 'Mi cuenta', items: [
              _NavItem(icon: Icons.person_outline, label: 'Mi perfil', slug: 'perfil'),
            ]),
          ],
      };
}

// ── Modelos internos ─────────────────────────────────────────────────────────

class _NavSection {
  final String label;
  final List<_NavItem> items;
  const _NavSection({required this.label, required this.items});
}

class _NavItem {
  final IconData icon;
  final String label;

  /// Slug del tab interno (mapea a `_Tab.slug` de HomePage). Si es null,
  /// el item es solo una ruta externa.
  final String? slug;

  /// Ruta de GoRouter para `context.push`. Si es null, el item solo
  /// cambia de tab interno usando `slug`.
  final String? route;

  const _NavItem({
    required this.icon,
    required this.label,
    this.slug,
    this.route,
  });
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final VoidCallback onClose;
  const _Header({required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 12, 14),
      child: Row(
        children: [
          const SfitMark(size: 32),
          const SizedBox(width: 10),
          Text(
            'SFIT',
            style: AppTheme.inter(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 2.4,
            ),
          ),
          const Spacer(),
          IconButton(
            tooltip: 'Cerrar',
            icon: const Icon(Icons.close_rounded, size: 20, color: Colors.white70),
            onPressed: onClose,
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: Text(
        label.toUpperCase(),
        style: AppTheme.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: Colors.white.withValues(alpha: 0.40),
          letterSpacing: 1.6,
        ),
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final int badge;
  final VoidCallback onTap;

  const _NavTile({
    required this.icon,
    required this.label,
    required this.active,
    required this.badge,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? Colors.white : Colors.white.withValues(alpha: 0.65);
    final bg = active
        ? AppColors.primary.withValues(alpha: 0.18)
        : Colors.transparent;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 1),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Icon(icon, size: 18, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                      color: color,
                    ),
                  ),
                ),
                if (badge > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.20),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      badge > 99 ? '99+' : '$badge',
                      style: AppTheme.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  final UserEntity user;
  final VoidCallback onLogout;

  const _Footer({required this.user, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.28),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.primaryLight.withValues(alpha: 0.40),
                    width: 1.5,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name,
                      style: AppTheme.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      user.email,
                      style: AppTheme.inter(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.50),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: AppColors.primaryLight.withValues(alpha: 0.35),
              ),
            ),
            child: Text(
              _roleLabel(user.role).toUpperCase(),
              style: AppTheme.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 1.2,
              ),
            ),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: onLogout,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.logout_rounded, size: 16, color: AppColors.noAptoBorder),
                  const SizedBox(width: 8),
                  Text(
                    'Cerrar sesión',
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.noAptoBorder,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _roleLabel(String role) => switch (role) {
        'ciudadano' => 'Ciudadano',
        'conductor' => 'Conductor',
        'fiscal' => 'Fiscal',
        'operador' => 'Operador',
        'admin_municipal' => 'Admin municipal',
        'admin_provincial' => 'Admin provincial',
        'super_admin' => 'Super admin',
        _ => role,
      };
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1,
      color: Colors.white.withValues(alpha: 0.06),
    );
  }
}

/// Banner que se muestra arriba del drawer cuando el super_admin está
/// previsualizando como otro rol. Permite volver a su sesión original
/// con un solo tap.
class _PreviewBanner extends StatelessWidget {
  final Future<void> Function() onRevert;
  const _PreviewBanner({required this.onRevert});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
      color: AppColors.primary.withValues(alpha: 0.16),
      child: Row(
        children: [
          Icon(
            Icons.shield_outlined,
            size: 14,
            color: Colors.white.withValues(alpha: 0.9),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'MODO PREVIEW',
                  style: AppTheme.inter(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryLight,
                    letterSpacing: 1.2,
                  ),
                ),
                Text(
                  'Estás viendo como otro rol',
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          TextButton(
            onPressed: onRevert,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              minimumSize: const Size(0, 28),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              backgroundColor: Colors.white.withValues(alpha: 0.12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            child: Text(
              'Volver',
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 0.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
