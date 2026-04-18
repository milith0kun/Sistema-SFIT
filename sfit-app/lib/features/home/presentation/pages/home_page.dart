import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../../../auth/presentation/pages/widgets/status_screen.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Pantalla principal — adapta el contenido al rol del usuario (RF-05 a RF-16).
///
/// Estructura:
/// - Roles web-only (super_admin, admin_provincial, admin_municipal) → pantalla
///   informativa sugiriendo el uso del panel web.
/// - Resto → `Scaffold` con `BottomNavigationBar` cuyos tabs dependen del rol.
///   Cada tab renderiza un placeholder hasta que la feature se implemente.
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const _BlankLoading();

    // ── Roles que operan SOLO en el panel web ────────────────────
    if (user.isWebOnlyRole) {
      return StatusScreen(
        mark: const SfitMark(size: 36),
        icon: Icons.desktop_windows_outlined,
        iconColor: AppColors.gold,
        iconBg: AppColors.goldBg,
        title: 'Usa la web para este rol',
        message:
            'Tu rol (${_roleLabel(user.role)}) opera desde el panel web de SFIT. '
            'Ingresa a sfit.ecosdelseo.com con tus mismas credenciales.',
        onLogout: () => ref.read(authProvider.notifier).logout(),
      );
    }

    final tabs = _tabsForRole(user.role);
    // Mantener el índice válido si cambia el rol dinámicamente
    final safeIndex = _index.clamp(0, tabs.length - 1);
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            SfitMark(size: 24, color: AppColors.gold),
            SizedBox(width: 10),
            Text(
              'SFIT',
              style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 2),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          PopupMenuButton<String>(
            icon: CircleAvatar(
              radius: 16,
              backgroundColor: cs.primaryContainer,
              child: Text(
                user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                style: TextStyle(
                    color: cs.onPrimaryContainer,
                    fontWeight: FontWeight.bold,
                    fontSize: 13),
              ),
            ),
            onSelected: (v) {
              if (v == 'logout') ref.read(authProvider.notifier).logout();
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.name,
                        style: tt.titleSmall
                            ?.copyWith(fontWeight: FontWeight.w600)),
                    Text(_roleLabel(user.role),
                        style: tt.bodySmall
                            ?.copyWith(color: cs.onSurfaceVariant)),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'logout', child: Text('Cerrar sesión')),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: IndexedStack(
        index: safeIndex,
        children: tabs.map((t) => t.builder(context)).toList(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: tabs
            .map((t) => NavigationDestination(
                  icon: Icon(t.icon),
                  selectedIcon: Icon(t.iconFilled ?? t.icon),
                  label: t.label,
                ))
            .toList(),
      ),
    );
  }

  List<_Tab> _tabsForRole(String role) {
    return switch (role) {
      'fiscal' => const [
          _Tab('Inspecciones', Icons.assignment_outlined,
              _ComingSoon('Inspecciones', 'Registrar y revisar inspecciones de campo'),
              iconFilled: Icons.assignment),
          _Tab('QR Scanner', Icons.qr_code_scanner_outlined,
              _ComingSoon('Escanear QR', 'Validar vehículos por QR — funciona offline')),
          _Tab('Reportes', Icons.flag_outlined,
              _ComingSoon('Reportes ciudadanos', 'Revisar y validar reportes'),
              iconFilled: Icons.flag),
          _Tab('Perfil', Icons.person_outline,
              _ComingSoon('Perfil', 'Datos del fiscal y sesión'),
              iconFilled: Icons.person),
        ],
      'operador' => const [
          _Tab('Flota', Icons.local_shipping_outlined,
              _ComingSoon('Panel de flota', 'Entradas, salidas y estado de la flota'),
              iconFilled: Icons.local_shipping),
          _Tab('Conductores', Icons.groups_2_outlined,
              _ComingSoon('Conductores', 'Estado de aptitud y asignación'),
              iconFilled: Icons.groups_2),
          _Tab('Vehículos', Icons.directions_car_outlined,
              _ComingSoon('Vehículos', 'Lista de vehículos y mantenimiento'),
              iconFilled: Icons.directions_car),
          _Tab('Perfil', Icons.person_outline,
              _ComingSoon('Perfil', 'Datos del operador y sesión'),
              iconFilled: Icons.person),
        ],
      'conductor' => const [
          _Tab('Mis rutas', Icons.route_outlined,
              _ComingSoon('Rutas del día', 'Rutas o zonas asignadas'),
              iconFilled: Icons.route),
          _Tab('Fatiga', Icons.monitor_heart_outlined,
              _ComingSoon('Estado de fatiga', 'Horas acumuladas y descanso'),
              iconFilled: Icons.monitor_heart),
          _Tab('Viajes', Icons.timeline_outlined,
              _ComingSoon('Viajes', 'Historial de viajes'),
              iconFilled: Icons.timeline),
          _Tab('Perfil', Icons.person_outline,
              _ComingSoon('Perfil', 'Datos del conductor y sesión'),
              iconFilled: Icons.person),
        ],
      'ciudadano' => const [
          _Tab('Vista pública', Icons.qr_code_2_outlined,
              _ComingSoon('Consultar vehículo',
                  'Escanea el QR o busca por placa para ver el estado.'),
              iconFilled: Icons.qr_code_2),
          _Tab('Reportes', Icons.campaign_outlined,
              _ComingSoon('Mis reportes', 'Reportar anomalías y ver su estado'),
              iconFilled: Icons.campaign),
          _Tab('Recompensas', Icons.emoji_events_outlined,
              _ComingSoon('Recompensas', 'SFITCoins, nivel y catálogo de beneficios'),
              iconFilled: Icons.emoji_events),
          _Tab('Perfil', Icons.person_outline,
              _ComingSoon('Perfil', 'Datos del ciudadano y sesión'),
              iconFilled: Icons.person),
        ],
      _ => const [
          _Tab('Inicio', Icons.home_outlined, _ComingSoon('Inicio', 'Dashboard general'),
              iconFilled: Icons.home),
          _Tab('Perfil', Icons.person_outline,
              _ComingSoon('Perfil', 'Tu cuenta y sesión'),
              iconFilled: Icons.person),
        ],
    };
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
}

class _Tab {
  final String label;
  final IconData icon;
  final IconData? iconFilled;
  final Widget builderValue;
  const _Tab(this.label, this.icon, this.builderValue, {this.iconFilled});
  Widget builder(BuildContext _) => builderValue;
}

class _ComingSoon extends StatelessWidget {
  final String title;
  final String subtitle;
  const _ComingSoon(this.title, this.subtitle);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                shape: BoxShape.circle,
                border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.3), width: 1.5),
              ),
              child: const Icon(Icons.construction_rounded,
                  size: 34, color: AppColors.goldDark),
            ),
            const SizedBox(height: 20),
            Text(title, style: tt.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.4), width: 1),
              ),
              child: const Text(
                'Próximamente',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.goldDark,
                    letterSpacing: 1.2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BlankLoading extends StatelessWidget {
  const _BlankLoading();
  @override
  Widget build(BuildContext context) => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
}
