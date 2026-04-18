import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Pantalla principal — adapta el contenido según el rol del usuario (RF-05 a RF-16)
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    if (user == null) return const SizedBox.shrink();

    final tabs = _tabsForRole(user.role);

    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Row(
            children: [
              SfitMark(size: 26, color: AppColors.gold),
              SizedBox(width: 10),
              Text('SFIT', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 2)),
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
                  style: TextStyle(color: cs.primary, fontWeight: FontWeight.bold, fontSize: 13),
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
                      Text(user.name, style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      Text(_roleLabel(user.role), style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                    ],
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(value: 'logout', child: Text('Cerrar sesión')),
              ],
            ),
            const SizedBox(width: 8),
          ],
          bottom: tabs.length > 1
              ? TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  tabs: tabs.map((t) => Tab(text: t.label)).toList(),
                )
              : null,
        ),
        body: TabBarView(
          children: tabs.map((t) => t.builder(context)).toList(),
        ),
      ),
    );
  }

  List<_Tab> _tabsForRole(String role) {
    return switch (role) {
      'ciudadano' => [
          _Tab('Inicio', (ctx) => const _ComingSoon('Inicio ciudadano')),
          _Tab('Mis reportes', (ctx) => const _ComingSoon('Reportes ciudadanos')),
          _Tab('Recompensas', (ctx) => const _ComingSoon('Gamificación')),
        ],
      'conductor' => [
          _Tab('Mis rutas', (ctx) => const _ComingSoon('Rutas del día')),
          _Tab('Viajes', (ctx) => const _ComingSoon('Historial de viajes')),
          _Tab('Mi estado', (ctx) => const _ComingSoon('Estado de fatiga')),
        ],
      'fiscal' => [
          _Tab('Inspecciones', (ctx) => const _ComingSoon('Inspecciones')),
          _Tab('Escanear QR', (ctx) => const _ComingSoon('Scanner QR')),
          _Tab('Reportes', (ctx) => const _ComingSoon('Reportes ciudadanos')),
        ],
      'operador' => [
          _Tab('Flota del día', (ctx) => const _ComingSoon('Panel de flota')),
          _Tab('Conductores', (ctx) => const _ComingSoon('Estado conductores')),
          _Tab('Reportes', (ctx) => const _ComingSoon('Reportes operacionales')),
        ],
      _ => [_Tab('Inicio', (ctx) => const _ComingSoon('Dashboard'))],
    };
  }

  String _roleLabel(String role) => switch (role) {
    'ciudadano' => 'Ciudadano',
    'conductor' => 'Conductor',
    'fiscal' => 'Fiscal / Inspector',
    'operador' => 'Operador de Empresa',
    'admin_municipal' => 'Admin Municipal',
    _ => role,
  };
}

class _Tab {
  final String label;
  final Widget Function(BuildContext) builder;
  _Tab(this.label, this.builder);
}

class _ComingSoon extends StatelessWidget {
  final String name;
  const _ComingSoon(this.name);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.construction_rounded, size: 48, color: cs.primaryContainer),
          const SizedBox(height: 16),
          Text(
            name,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'Módulo en desarrollo',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
