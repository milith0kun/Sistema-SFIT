import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Rutas del día para el rol Conductor — RF-10.
class MyRoutesPage extends ConsumerStatefulWidget {
  const MyRoutesPage({super.key});

  @override
  ConsumerState<MyRoutesPage> createState() => _MyRoutesPageState();
}

class _MyRoutesPageState extends ConsumerState<MyRoutesPage> {
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/flota', queryParameters: {'limit': 20});
      final data = (resp.data as Map)['data'] as Map;
      if (mounted) {
        setState(() {
          _entries = List<Map<String, dynamic>>.from(data['items'] as List);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Encabezado ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rutas del día',
                    style: AppTheme.inter(
                      fontSize: 20, fontWeight: FontWeight.w800,
                      color: AppColors.ink9, letterSpacing: -0.5)),
                if (user != null)
                  Text(user.name,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink4)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline,
                                color: AppColors.noApto, size: 32),
                            const SizedBox(height: 8),
                            Text('Error al cargar rutas.',
                                style: AppTheme.inter(
                                  fontSize: 14, color: AppColors.ink6)),
                            const SizedBox(height: 12),
                            TextButton(
                                onPressed: _load,
                                child: const Text('Reintentar')),
                          ],
                        ),
                      )
                    : _entries.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.route_outlined,
                                    size: 48, color: AppColors.ink2),
                                const SizedBox(height: 12),
                                Text('Sin rutas asignadas hoy.',
                                    style: AppTheme.inter(
                                      fontSize: 15, color: AppColors.ink4)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(12),
                              itemCount: _entries.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (_, i) =>
                                  _RouteCard(entry: _entries[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _RouteCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final status = entry['status'] as String? ?? 'en_ruta';
    final vehicle = entry['vehicleId'] as Map? ?? {};
    final route = entry['routeId'] as Map?;
    final dep = entry['departureTime'] as String?;
    final ret = entry['returnTime'] as String?;

    final (statusColor, statusBg, statusLabel) = switch (status) {
      'en_ruta'    => (AppColors.goldDark, AppColors.goldBg, 'EN RUTA'),
      'cerrado'    => (AppColors.apto,     AppColors.aptoBg, 'CERRADO'),
      'auto_cierre' => (AppColors.ink5,   AppColors.ink1,   'AUTO-CIERRE'),
      _             => (AppColors.ink5,   AppColors.ink1,    status.toUpperCase()),
    };

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink1),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.directions_bus, size: 18, color: AppColors.gold),
              const SizedBox(width: 6),
              Text(vehicle['plate'] as String? ?? '—',
                  style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w700,
                    color: AppColors.ink9)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusLabel,
                    style: AppTheme.inter(
                      fontSize: 10, fontWeight: FontWeight.w700,
                      color: statusColor)),
              ),
            ],
          ),
          if (route != null) ...[
            const SizedBox(height: 6),
            Text(route['name'] as String? ?? '—',
                style: AppTheme.inter(
                  fontSize: 13, color: AppColors.ink6, fontWeight: FontWeight.w500)),
          ],
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.login, size: 14, color: AppColors.ink4),
            const SizedBox(width: 4),
            Text(_fmtTime(dep), style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            const SizedBox(width: 14),
            if (ret != null) ...[
              const Icon(Icons.logout, size: 14, color: AppColors.ink4),
              const SizedBox(width: 4),
              Text(_fmtTime(ret), style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            ],
          ]),
        ],
      ),
    );
  }

  String _fmtTime(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return '—';
    }
  }
}
