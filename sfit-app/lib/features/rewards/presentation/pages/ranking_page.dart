import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// RF-16: Ranking de ciudadanos por SFITCoins.
class RankingPage extends ConsumerStatefulWidget {
  const RankingPage({super.key});

  @override
  ConsumerState<RankingPage> createState() => _RankingPageState();
}

class _RankingPageState extends ConsumerState<RankingPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  // Datos por periodo
  List<Map<String, dynamic>> _weekData  = [];
  List<Map<String, dynamic>> _monthData = [];
  List<Map<String, dynamic>> _totalData = [];

  bool _loading = true;

  static const _periods = ['semana', 'mes', 'total'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this, initialIndex: 2);
    _loadAll();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() { _loading = true; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final results = await Future.wait(
        _periods.map(
          (p) => dio
              .get('/ciudadano/ranking', queryParameters: {'period': p, 'limit': 50})
              .then((r) => _parseItems(r.data))
              .catchError((_) => <Map<String, dynamic>>[]),
        ),
      );
      if (mounted) {
        setState(() {
          _weekData  = results[0];
          _monthData = results[1];
          _totalData = results[2];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          // No bloqueamos la pantalla; mostramos estado vacío
        });
      }
    }
  }

  List<Map<String, dynamic>> _parseItems(dynamic body) {
    if (body == null) return [];
    try {
      final map  = body as Map<String, dynamic>;
      final data = map['data'];
      if (data is List) return data.cast<Map<String, dynamic>>();
      if (data is Map) {
        final items = data['items'];
        if (items is List) return items.cast<Map<String, dynamic>>();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  String _anonimizar(String? nombre) {
    if (nombre == null || nombre.isEmpty) return '—';
    final parts = nombre.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts[0];
    // "Juan García" → "Juan G."
    return '${parts.first} ${parts.last[0].toUpperCase()}.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ranking SFIT'),
        leading: const BackButton(),
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: AppColors.goldDark,
          unselectedLabelColor: AppColors.ink5,
          indicatorColor: AppColors.gold,
          indicatorWeight: 2.5,
          labelStyle: AppTheme.inter(
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
          unselectedLabelStyle: AppTheme.inter(
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
          tabs: const [
            Tab(text: 'Semana'),
            Tab(text: 'Mes'),
            Tab(text: 'Total'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _RankingList(items: _weekData,  anonimizar: _anonimizar),
                _RankingList(items: _monthData, anonimizar: _anonimizar),
                _RankingList(items: _totalData, anonimizar: _anonimizar),
              ],
            ),
    );
  }
}

// ── Lista de ranking ───────────────────────────────────────────────────────────
class _RankingList extends ConsumerWidget {
  final List<Map<String, dynamic>> items;
  final String Function(String?) anonimizar;

  const _RankingList({required this.items, required this.anonimizar});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) {
      return const _EmptyState();
    }

    final currentUser = ref.watch(authProvider).user;
    final currentId   = currentUser?.id ?? '';

    return RefreshIndicator(
      onRefresh: () async {},
      color: AppColors.gold,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 6),
        itemBuilder: (_, i) {
          final item      = items[i];
          final pos       = i + 1;
          final id        = item['_id']?.toString() ?? item['id']?.toString() ?? '';
          final nombre    = item['name']  as String?
                          ?? item['nombre'] as String?;
          final puntos    = (item['coins']  as num?)?.toInt()
                          ?? (item['puntos'] as num?)?.toInt()
                          ?? 0;
          final nivel     = (item['nivel'] as num?)?.toInt() ?? 1;
          final isMe      = id.isNotEmpty && id == currentId;

          return _RankingTile(
            position: pos,
            name:     anonimizar(nombre),
            points:   puntos,
            nivel:    nivel,
            isMe:     isMe,
          );
        },
      ),
    );
  }
}

// ── Tile de ranking ────────────────────────────────────────────────────────────
class _RankingTile extends StatelessWidget {
  final int position;
  final String name;
  final int points;
  final int nivel;
  final bool isMe;

  const _RankingTile({
    required this.position,
    required this.name,
    required this.points,
    required this.nivel,
    required this.isMe,
  });

  (Color bg, Color border) get _rowColors {
    if (isMe) return (const Color(0xFFFDF8EC), AppColors.goldBorder);
    if (position <= 3) return (Colors.white, AppColors.ink2);
    return (Colors.white, AppColors.ink2);
  }

  // Nivel → badge color y label
  (Color color, Color bg, Color border, String label) get _nivelDef => switch (nivel) {
    2 => (AppColors.ink6,  AppColors.ink1,   AppColors.ink3,   'Plata'),
    3 => (AppColors.gold,  AppColors.goldBg, AppColors.goldBorder, 'Oro'),
    4 => (AppColors.info,  AppColors.infoBg, AppColors.infoBorder, 'Platino'),
    _ => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder, 'Bronce'),
  };

  Widget _positionWidget() {
    if (position == 1) {
      return const Icon(Icons.looks_one, size: 28, color: Color(0xFFFFD700));
    } else if (position == 2) {
      return const Icon(Icons.looks_two, size: 28, color: Color(0xFFB0B0B0));
    } else if (position == 3) {
      return const Icon(Icons.looks_3, size: 28, color: Color(0xFFCD7F32));
    }
    return SizedBox(
      width: 28,
      child: Text(
        '$position',
        textAlign: TextAlign.center,
        style: AppTheme.inter(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.ink5,
          tabular: true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final (bg, border) = _rowColors;
    final (nColor, nBg, nBorder, nLabel) = _nivelDef;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(
          color: isMe ? AppColors.gold : border,
          width: isMe ? 1.5 : 1.0,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          // Posición / medalla
          SizedBox(width: 32, child: _positionWidget()),
          const SizedBox(width: 10),

          // Nombre + nivel badge
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        style: AppTheme.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: isMe ? AppColors.goldDark : AppColors.ink9,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isMe) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.goldBg,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.goldBorder),
                        ),
                        child: Text(
                          'Tú',
                          style: AppTheme.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.goldDark,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: nBg,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: nBorder),
                  ),
                  child: Text(
                    'Nivel $nLabel',
                    style: AppTheme.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: nColor,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Puntos
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$points',
                style: AppTheme.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: isMe ? AppColors.goldDark : AppColors.ink9,
                  tabular: true,
                ),
              ),
              Text(
                'coins',
                style: AppTheme.inter(
                  fontSize: 10,
                  color: AppColors.ink4,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Estado vacío ───────────────────────────────────────────────────────────────
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
              Icons.emoji_events_outlined,
              size: 52,
              color: AppColors.ink3,
            ),
            const SizedBox(height: 14),
            Text(
              'Sin datos de ranking',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Aún no hay participantes en este período.\n¡Envía reportes para aparecer aquí!',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
            ),
          ],
        ),
      ),
    );
  }
}
