import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

// ── Modelo de notificación in-app ─────────────────────────────────────────────
class _NotifItem {
  final String id;
  final String title;
  final String body;
  final String type;
  final String category;
  final String? link;
  final bool read;
  final DateTime createdAt;

  const _NotifItem({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.category,
    required this.read,
    required this.createdAt,
    this.link,
  });

  factory _NotifItem.fromJson(Map<String, dynamic> j) => _NotifItem(
        id: j['id'] as String,
        title: j['title'] as String,
        body: j['body'] as String,
        type: j['type'] as String? ?? 'info',
        category: j['category'] as String? ?? 'otro',
        link: j['link'] as String?,
        read: j['read'] as bool? ?? false,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );

  _NotifItem copyWith({bool? read}) => _NotifItem(
        id: id,
        title: title,
        body: body,
        type: type,
        category: category,
        link: link,
        read: read ?? this.read,
        createdAt: createdAt,
      );
}

// ── Página de notificaciones ───────────────────────────────────────────────────
class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  List<_NotifItem> _items = [];
  bool _loading = true;
  String? _error;
  bool _markingAll = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/notificaciones');
      final data = (resp.data as Map)['data'] as Map<String, dynamic>;
      final rawItems = data['items'] as List;
      if (mounted) {
        setState(() {
          _items = rawItems
              .map((e) => _NotifItem.fromJson(e as Map<String, dynamic>))
              .toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar las notificaciones.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _markOneRead(String id) async {
    final idx = _items.indexWhere((n) => n.id == id);
    if (idx == -1 || _items[idx].read) return;
    setState(() {
      _items[idx] = _items[idx].copyWith(read: true);
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/notificaciones/$id');
    } catch (_) {
      // Revertir si falla
      if (mounted) {
        setState(() {
          _items[idx] = _items[idx].copyWith(read: false);
        });
      }
    }
  }

  Future<void> _markAllRead() async {
    if (_markingAll) return;
    final unread = _items.where((n) => !n.read).toList();
    if (unread.isEmpty) return;
    setState(() => _markingAll = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/notificaciones', data: {'markAllRead': true});
      if (mounted) {
        setState(() {
          _items = _items.map((n) => n.copyWith(read: true)).toList();
        });
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error al marcar todas como leídas'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  int get _unreadCount => _items.where((n) => !n.read).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.ink9),
          onPressed: () => context.pop(),
        ),
        title: Row(
          children: [
            Text(
              'Notificaciones',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
              ),
            ),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.noApto,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$_unreadCount',
                  style: AppTheme.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (!_loading && _unreadCount > 0)
            TextButton(
              onPressed: _markingAll ? null : _markAllRead,
              child: Text(
                'Marcar todo',
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _markingAll ? AppColors.ink4 : AppColors.gold,
                ),
              ),
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _items.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.gold,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(0, 4, 0, 24),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, color: AppColors.ink2),
                        itemBuilder: (_, i) {
                          final item = _items[i];
                          return Dismissible(
                            key: ValueKey(item.id),
                            direction: DismissDirection.startToEnd,
                            background: Container(
                              color: AppColors.aptoBg,
                              alignment: Alignment.centerLeft,
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              child: const Row(
                                children: [
                                  Icon(Icons.mark_email_read_outlined,
                                      color: AppColors.apto),
                                  SizedBox(width: 8),
                                  Text(
                                    'Marcar leída',
                                    style: TextStyle(
                                      color: AppColors.apto,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            confirmDismiss: (_) async {
                              await _markOneRead(item.id);
                              return false; // No desaparece, sólo cambia estado
                            },
                            child: _NotificationTile(
                              item: item,
                              onTap: () => _markOneRead(item.id),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

// ── Tile de notificación ──────────────────────────────────────────────────────
class _NotificationTile extends StatelessWidget {
  final _NotifItem item;
  final VoidCallback onTap;

  const _NotificationTile({required this.item, required this.onTap});

  static const _typeIcons = <String, IconData>{
    'info': Icons.info_outline,
    'success': Icons.check_circle_outline,
    'warning': Icons.warning_amber_outlined,
    'error': Icons.error_outline,
    'action_required': Icons.notification_important_outlined,
  };

  static const _typeColors = <String, Color>{
    'info': AppColors.info,
    'success': AppColors.apto,
    'warning': AppColors.riesgo,
    'error': AppColors.noApto,
    'action_required': AppColors.riesgo,
  };

  static const _typeBgs = <String, Color>{
    'info': AppColors.infoBg,
    'success': AppColors.aptoBg,
    'warning': AppColors.riesgoBg,
    'error': AppColors.noAptoBg,
    'action_required': AppColors.riesgoBg,
  };

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'hace un momento';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'hace ${diff.inHours} h';
    if (diff.inDays == 1) return 'ayer';
    if (diff.inDays < 7) return 'hace ${diff.inDays} días';
    final d = dt.toLocal();
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final icon = _typeIcons[item.type] ?? Icons.notifications_outlined;
    final iconColor = _typeColors[item.type] ?? AppColors.info;
    final iconBg = _typeBgs[item.type] ?? AppColors.infoBg;

    return InkWell(
      onTap: onTap,
      child: Container(
        color: item.read ? Colors.white : AppColors.infoBg.withOpacity(0.35),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Ícono de tipo
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: iconBg,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: AppTheme.inter(
                            fontSize: 14,
                            fontWeight:
                                item.read ? FontWeight.w500 : FontWeight.w700,
                            color: AppColors.ink9,
                          ),
                        ),
                      ),
                      Text(
                        _relativeTime(item.createdAt),
                        style: AppTheme.inter(
                          fontSize: 11,
                          color: AppColors.ink4,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.body,
                    style: AppTheme.inter(
                      fontSize: 13,
                      color: AppColors.ink6,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // Punto no leído
            if (!item.read) ...[
              const SizedBox(width: 8),
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6),
                decoration: const BoxDecoration(
                  color: AppColors.info,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Estados auxiliares ────────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.notifications_none_outlined,
              size: 56,
              color: AppColors.ink3,
            ),
            const SizedBox(height: 12),
            Text(
              'Sin notificaciones',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Aquí aparecerán tus notificaciones del sistema',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: AppColors.noApto),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
            const SizedBox(height: 14),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
