import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

String _groupLabel(DateTime dt) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final yesterday = today.subtract(const Duration(days: 1));
  final weekAgo = today.subtract(const Duration(days: 7));
  final itemDay = DateTime(dt.year, dt.month, dt.day);
  if (itemDay == today) return 'Hoy';
  if (itemDay == yesterday) return 'Ayer';
  if (!itemDay.isBefore(weekAgo)) return 'Esta semana';
  const months = ['', 'ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
  return '${months[dt.month]} ${dt.year}';
}

/// Devuelve `(icon, accentColor, bgColor)` según el `type` + `category`.
/// La categoría toma precedencia sobre el tipo cuando ambas están presentes
/// (ej. category=premio aunque type=info → trofeo dorado).
(IconData, Color, Color) _notifStyle(String type, String category) {
  final t = type.toLowerCase();
  final c = category.toLowerCase();

  // Categoría primero
  if (c.contains('premio') || c.contains('sfitcoin') || c.contains('reward')) {
    return (Icons.emoji_events_rounded, AppColors.primary, AppColors.primaryBg);
  }
  if (c.contains('reporte')) {
    if (t.contains('approv') || t.contains('valid') || t.contains('success')) {
      return (Icons.task_alt_rounded, AppColors.apto, AppColors.aptoBg);
    }
    if (t.contains('reject') || t.contains('error')) {
      return (Icons.cancel_rounded, AppColors.noApto, AppColors.noAptoBg);
    }
    return (Icons.flag_rounded, AppColors.info, AppColors.infoBg);
  }
  if (c.contains('inspec')) {
    return (Icons.assignment_turned_in_rounded, AppColors.info, AppColors.infoBg);
  }
  if (c.contains('fiscal')) {
    return (Icons.person_pin_circle_rounded, AppColors.info, AppColors.infoBg);
  }
  if (c.contains('empresa')) {
    return (Icons.apartment_rounded, AppColors.ink8, AppColors.ink1);
  }
  if (c.contains('ruta') || c.contains('viaje')) {
    return (Icons.alt_route_rounded, AppColors.info, AppColors.infoBg);
  }

  // Fallback por tipo
  if (t.contains('warn') || t.contains('alert')) {
    return (Icons.warning_amber_rounded, AppColors.riesgo, AppColors.riesgoBg);
  }
  if (t.contains('success') || t.contains('approv')) {
    return (Icons.check_circle_rounded, AppColors.apto, AppColors.aptoBg);
  }
  if (t.contains('error') || t.contains('reject')) {
    return (Icons.cancel_rounded, AppColors.noApto, AppColors.noAptoBg);
  }
  if (t.contains('action')) {
    return (Icons.notification_important_rounded, AppColors.primary, AppColors.primaryBg);
  }
  return (Icons.notifications_rounded, AppColors.ink6, AppColors.ink1);
}

String _timeLabel(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inSeconds < 60) return 'ahora';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays == 1) return 'ayer';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return '${dt.day}/${dt.month}';
}

// ── Página principal ──────────────────────────────────────────────────────────

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

enum _NotifFilter { todas, sinLeer }

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  List<_NotifItem> _items = [];
  bool _loading = true;
  String? _error;
  bool _markingAll = false;
  _NotifFilter _filter = _NotifFilter.todas;

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
          _items = rawItems.map((e) => _NotifItem.fromJson(e as Map<String, dynamic>)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _error = 'No se pudieron cargar las notificaciones.'; _loading = false; });
    }
  }

  Future<void> _markOneRead(String id) async {
    final idx = _items.indexWhere((n) => n.id == id);
    if (idx == -1 || _items[idx].read) return;
    setState(() => _items[idx] = _items[idx].copyWith(read: true));
    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/notificaciones/$id');
    } catch (_) {
      if (mounted) setState(() => _items[idx] = _items[idx].copyWith(read: false));
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
      if (mounted) setState(() => _items = _items.map((n) => n.copyWith(read: true)).toList());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al marcar todas como leídas'), behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  int get _unreadCount => _items.where((n) => !n.read).length;

  // Construye la lista plana con separadores de grupo, aplicando el
  // filtro activo (todas / sin leer).
  List<Object> _buildRows() {
    final filtered = _filter == _NotifFilter.sinLeer
        ? _items.where((n) => !n.read).toList()
        : _items;
    final rows = <Object>[];
    String? lastLabel;
    for (final item in filtered) {
      final label = _groupLabel(item.createdAt);
      if (label != lastLabel) {
        rows.add(label);
        lastLabel = label;
      }
      rows.add(item);
    }
    return rows;
  }

  /// Tap en una notif: marca como leída + navega si tiene `link` interno.
  /// Las notifs con link suelen ser deep-links a /feed/:id, /reportes/:id, etc.
  void _handleNotifTap(_NotifItem item) {
    _markOneRead(item.id);
    final link = item.link;
    if (link != null && link.isNotEmpty && link.startsWith('/')) {
      context.push(link);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _buildRows();

    return Scaffold(
      backgroundColor: Colors.white,
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
              style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
            ),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.ink9,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$_unreadCount',
                  style: AppTheme.inter(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (!_loading && _unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: TextButton.icon(
                onPressed: _markingAll ? null : _markAllRead,
                icon: Icon(
                  Icons.done_all_rounded,
                  size: 16,
                  color: _markingAll ? AppColors.ink4 : AppColors.ink9,
                ),
                label: Text(
                  _markingAll ? 'Marcando…' : 'Marcar leídas',
                  style: AppTheme.inter(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: _markingAll ? AppColors.ink4 : AppColors.ink9,
                  ),
                ),
              ),
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppColors.ink2),
        ),
      ),
      body: _loading
          ? const SfitLoading.page(color: AppColors.ink9, strokeWidth: 2)
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : Column(
                  children: [
                    // Filter chips Todas / Sin leer
                    if (_items.isNotEmpty) _buildFilterBar(),
                    Expanded(
                      child: rows.isEmpty
                          ? _EmptyState(
                              filtered: _filter == _NotifFilter.sinLeer,
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              color: AppColors.ink9,
                              child: ListView.builder(
                                padding: const EdgeInsets.only(bottom: 24),
                                itemCount: rows.length,
                                itemBuilder: (_, i) {
                                  final row = rows[i];
                                  if (row is String) {
                                    return _GroupHeader(label: row);
                                  }
                                  final item = row as _NotifItem;
                                  return _AnimatedNotifItem(
                                    key: ValueKey(item.id),
                                    child: _NotifTile(
                                      item: item,
                                      onTap: () => _handleNotifTap(item),
                                    ),
                                  );
                                },
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildFilterBar() {
    final unread = _unreadCount;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.ink2, width: 0.5)),
      ),
      child: Row(
        children: [
          _FilterChip(
            label: 'Todas',
            count: _items.length,
            selected: _filter == _NotifFilter.todas,
            onTap: () => setState(() => _filter = _NotifFilter.todas),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Sin leer',
            count: unread,
            selected: _filter == _NotifFilter.sinLeer,
            onTap: () => setState(() => _filter = _NotifFilter.sinLeer),
            accent: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  final Color? accent;

  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final color = accent ?? AppColors.ink9;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: selected ? color : Colors.white,
            border: Border.all(color: selected ? color : AppColors.ink2, width: 1.2),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.ink7,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: selected
                      ? Colors.white.withValues(alpha: 0.25)
                      : AppColors.ink1,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$count',
                  style: AppTheme.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : AppColors.ink6,
                    tabular: true,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Wrap que anima la primera aparición de un tile de notificación
/// (fade + slide). Solo dispara una vez por instancia.
class _AnimatedNotifItem extends StatefulWidget {
  final Widget child;
  const _AnimatedNotifItem({super.key, required this.child});

  @override
  State<_AnimatedNotifItem> createState() => _AnimatedNotifItemState();
}

class _AnimatedNotifItemState extends State<_AnimatedNotifItem>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 280),
      vsync: this,
    );
    _opacity = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _offset = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}

// ── Group header ──────────────────────────────────────────────────────────────

class _GroupHeader extends StatelessWidget {
  final String label;
  const _GroupHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Row(
        children: [
          Text(
            label.toUpperCase(),
            style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.ink5, letterSpacing: 1.2),
          ),
          const SizedBox(width: 10),
          const Expanded(child: Divider(color: AppColors.ink2, thickness: 1, height: 1)),
        ],
      ),
    );
  }
}

// ── Notification tile ─────────────────────────────────────────────────────────

class _NotifTile extends StatelessWidget {
  final _NotifItem item;
  final VoidCallback onTap;

  const _NotifTile({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final (icon, accent, bg) = _notifStyle(item.type, item.category);

    return InkWell(
      onTap: onTap,
      splashColor: accent.withValues(alpha: 0.12),
      highlightColor: accent.withValues(alpha: 0.06),
      child: Container(
        decoration: BoxDecoration(
          border: Border(
            left: item.read
                ? BorderSide.none
                : BorderSide(color: accent, width: 3),
            bottom: const BorderSide(color: AppColors.ink2, width: 0.5),
          ),
          color: item.read ? Colors.white : AppColors.paper,
        ),
        padding: EdgeInsets.only(
          left: item.read ? 16 : 13,
          right: 16,
          top: 12,
          bottom: 12,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon chip — fondo y color según semántica de la notif
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: bg,
                border: Border.all(color: accent.withValues(alpha: 0.25)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: accent, size: 19),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      if (!item.read) ...[
                        Container(
                          width: 6,
                          height: 6,
                          margin: const EdgeInsets.only(right: 6, top: 2),
                          decoration: const BoxDecoration(
                            color: AppColors.ink9,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                      Expanded(
                        child: Text(
                          item.title,
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: item.read ? FontWeight.w500 : FontWeight.w700,
                            color: AppColors.ink9,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _timeLabel(item.createdAt),
                        style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.body,
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink6, height: 1.4),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (item.category.isNotEmpty && item.category != 'otro') ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.ink1,
                        border: Border.all(color: AppColors.ink2),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        item.category,
                        style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.ink6),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Empty / Error states ──────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  /// `true` cuando el usuario está viendo el filtro "Sin leer" pero no hay
  /// pendientes — el copy se adapta para felicitarlo en lugar de sonar a error.
  final bool filtered;

  const _EmptyState({this.filtered = false});

  @override
  Widget build(BuildContext context) {
    final (icon, iconColor, iconBg, title, subtitle) = filtered
        ? (
            Icons.check_circle_rounded,
            AppColors.apto,
            AppColors.aptoBg,
            '¡Estás al día!',
            'No tienes notificaciones pendientes de leer.',
          )
        : (
            Icons.notifications_none_rounded,
            AppColors.ink5,
            AppColors.ink1,
            'Sin notificaciones',
            'Aquí aparecerán tus alertas, validaciones y premios.',
          );

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: iconBg,
                shape: BoxShape.circle,
                border: Border.all(color: iconColor.withValues(alpha: 0.2), width: 1.5),
              ),
              child: Icon(icon, size: 36, color: iconColor),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 12.5,
                color: AppColors.ink5,
                height: 1.45,
              ),
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
            const Icon(Icons.error_outline, size: 36, color: AppColors.ink5),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: onRetry,
              child: Text('Reintentar', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink9)),
            ),
          ],
        ),
      ),
    );
  }
}
