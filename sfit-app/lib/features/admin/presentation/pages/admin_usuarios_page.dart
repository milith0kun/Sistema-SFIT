import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_loading.dart';
import '../../data/datasources/admin_api_service.dart';

class AdminUsuariosPage extends ConsumerStatefulWidget {
  const AdminUsuariosPage({super.key});

  @override
  ConsumerState<AdminUsuariosPage> createState() => _AdminUsuariosPageState();
}

class _AdminUsuariosPageState extends ConsumerState<AdminUsuariosPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  List<Map<String, dynamic>> _pendientes = [];
  List<Map<String, dynamic>> _todos = [];
  bool _loadingPendientes = true;
  bool _loadingTodos = true;
  String? _errorPendientes;
  String? _errorTodos;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _loadPendientes();
    _loadTodos();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPendientes() async {
    setState(() { _loadingPendientes = true; _errorPendientes = null; });
    try {
      final result = await ref
          .read(adminApiServiceProvider)
          .getUsers(status: 'pendiente', limit: 50);
      if (mounted) {
        setState(() {
          _pendientes = List<Map<String, dynamic>>.from(result['items'] as List);
          _loadingPendientes = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _errorPendientes = e.toString(); _loadingPendientes = false; });
    }
  }

  Future<void> _loadTodos() async {
    setState(() { _loadingTodos = true; _errorTodos = null; });
    try {
      final result = await ref.read(adminApiServiceProvider).getUsers(limit: 50);
      if (mounted) {
        setState(() {
          _todos = List<Map<String, dynamic>>.from(result['items'] as List);
          _loadingTodos = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _errorTodos = e.toString(); _loadingTodos = false; });
    }
  }

  Future<void> _aprobar(String id) async {
    try {
      await ref.read(adminApiServiceProvider).approveUser(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Usuario aprobado.'),
          backgroundColor: AppColors.apto,
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _loadPendientes();
      await _loadTodos();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo aprobar el usuario.'),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _rechazar(String id) async {
    final reason = await _showReasonDialog();
    if (reason == null) return;
    try {
      await ref.read(adminApiServiceProvider).rejectUser(id, reason: reason);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Usuario rechazado.'),
          backgroundColor: AppColors.riesgo,
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _loadPendientes();
      await _loadTodos();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo rechazar el usuario.'),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<String?> _showReasonDialog() async {
    String reason = '';
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Motivo de rechazo'),
        content: TextField(
          onChanged: (v) => reason = v,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Describe el motivo (opcional)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, reason),
            style: FilledButton.styleFrom(backgroundColor: AppColors.noApto),
            child: const Text('Rechazar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        toolbarHeight: 0,
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Pendientes'),
                  if (_pendientes.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.riesgo,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '${_pendientes.length}',
                        style: AppTheme.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Tab(text: 'Todos'),
          ],
          indicatorColor: AppColors.panel,
          labelColor: AppColors.panel,
          unselectedLabelColor: AppColors.ink5,
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _PendientesTab(
            loading: _loadingPendientes,
            error: _errorPendientes,
            items: _pendientes,
            onRefresh: _loadPendientes,
            onAprobar: _aprobar,
            onRechazar: _rechazar,
          ),
          _TodosTab(
            loading: _loadingTodos,
            error: _errorTodos,
            items: _todos,
            onRefresh: _loadTodos,
          ),
        ],
      ),
    );
  }
}

// ── Tab Pendientes ────────────────────────────────────────────────────────────

class _PendientesTab extends StatelessWidget {
  final bool loading;
  final String? error;
  final List<Map<String, dynamic>> items;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String) onAprobar;
  final Future<void> Function(String) onRechazar;

  const _PendientesTab({
    required this.loading,
    required this.error,
    required this.items,
    required this.onRefresh,
    required this.onAprobar,
    required this.onRechazar,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const SfitLoading();
    if (error != null) return _ErrorRetry(message: error!, onRetry: onRefresh);

    if (items.isEmpty) {
      return RefreshIndicator(
        color: AppColors.gold,
        onRefresh: onRefresh,
        child: ListView(
          padding: const EdgeInsets.all(32),
          children: [
            const Icon(Icons.check_circle_outline, size: 52, color: AppColors.apto),
            const SizedBox(height: 14),
            Text(
              'Sin solicitudes pendientes',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Todas las solicitudes de registro han sido procesadas.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink5, height: 1.45),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _UserPendingCard(
          item: items[i],
          onAprobar: onAprobar,
          onRechazar: onRechazar,
        ),
      ),
    );
  }
}

class _UserPendingCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final Future<void> Function(String) onAprobar;
  final Future<void> Function(String) onRechazar;

  const _UserPendingCard({
    required this.item,
    required this.onAprobar,
    required this.onRechazar,
  });

  @override
  Widget build(BuildContext context) {
    final id = item['_id'] as String? ?? item['id'] as String? ?? '';
    final name = item['name'] as String? ?? 'Sin nombre';
    final email = item['email'] as String? ?? '';
    final role = item['role'] as String? ?? item['requestedRole'] as String? ?? '';
    final createdAtRaw = item['createdAt'];
    DateTime? date;
    if (createdAtRaw is String) date = DateTime.tryParse(createdAtRaw);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.riesgoBorder),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: AppColors.riesgoBg,
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : 'U',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.riesgo,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink9,
                      ),
                    ),
                    Text(
                      email,
                      style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              _RoleBadge(role: role),
            ],
          ),
          if (date != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.schedule_outlined, size: 12, color: AppColors.ink4),
                const SizedBox(width: 4),
                Text(
                  'Solicitó: ${DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal())}',
                  style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink4),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => onRechazar(id),
                  icon: const Icon(Icons.close, size: 16),
                  label: const Text('Rechazar'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.noApto,
                    side: const BorderSide(color: AppColors.noAptoBorder),
                    minimumSize: const Size(0, 40),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => onAprobar(id),
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('Aprobar'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.apto,
                    minimumSize: const Size(0, 40),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Tab Todos ─────────────────────────────────────────────────────────────────

class _TodosTab extends StatelessWidget {
  final bool loading;
  final String? error;
  final List<Map<String, dynamic>> items;
  final Future<void> Function() onRefresh;

  const _TodosTab({
    required this.loading,
    required this.error,
    required this.items,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const SfitLoading();
    if (error != null) return _ErrorRetry(message: error!, onRetry: onRefresh);

    if (items.isEmpty) {
      return RefreshIndicator(
        color: AppColors.gold,
        onRefresh: onRefresh,
        child: ListView(
          padding: const EdgeInsets.all(32),
          children: [
            const Icon(Icons.people_outline, size: 52, color: AppColors.ink3),
            const SizedBox(height: 14),
            Text(
              'Sin usuarios registrados',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) => _UserRow(item: items[i]),
      ),
    );
  }
}

class _UserRow extends StatelessWidget {
  final Map<String, dynamic> item;
  const _UserRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final name = item['name'] as String? ?? 'Sin nombre';
    final email = item['email'] as String? ?? '';
    final role = item['role'] as String? ?? '';
    final status = item['status'] as String? ?? 'activo';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.ink1,
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : 'U',
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.ink6,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink9,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  email,
                  style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _RoleBadge(role: role),
              const SizedBox(height: 3),
              _StatusDot(status: status),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Widgets auxiliares ────────────────────────────────────────────────────────

class _RoleBadge extends StatelessWidget {
  final String role;
  const _RoleBadge({required this.role});

  @override
  Widget build(BuildContext context) {
    final label = switch (role) {
      'fiscal' => 'Fiscal',
      'operador' => 'Operador',
      'conductor' => 'Conductor',
      'ciudadano' => 'Ciudadano',
      'admin_municipal' => 'Admin M.',
      'admin_provincial' => 'Admin P.',
      'admin_regional' => 'Admin R.',
      'super_admin' => 'Super',
      _ => role.isEmpty ? '—' : role,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.infoBg,
        border: Border.all(color: AppColors.infoBorder),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          color: AppColors.info,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final String status;
  const _StatusDot({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      'activo' => (AppColors.apto, 'activo'),
      'pendiente' => (AppColors.riesgo, 'pendiente'),
      'rechazado' => (AppColors.noApto, 'rechazado'),
      'suspendido' => (AppColors.noApto, 'suspendido'),
      _ => (AppColors.ink4, status),
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTheme.inter(fontSize: 10.5, color: color, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  final String message;
  final Future<void> Function() onRetry;
  const _ErrorRetry({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.people_outline, size: 48, color: AppColors.ink3),
            const SizedBox(height: 14),
            Text(
              'No se pudo cargar la lista.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 14, color: AppColors.ink6),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
