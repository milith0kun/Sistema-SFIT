import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/rewards_api_service.dart';
import '../../data/models/reward_model.dart';

/// Pantalla de SFITCoins y recompensas para ciudadano — RF-15 / RF-16.
class RewardsPage extends ConsumerStatefulWidget {
  const RewardsPage({super.key});

  @override
  ConsumerState<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends ConsumerState<RewardsPage> {
  CoinsStatus? _status;
  List<RewardItem> _rewards = [];
  bool _loading = true;
  String? _error;
  String? _redeemingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(rewardsApiServiceProvider);
      final results = await Future.wait([
        svc.getCoinsStatus(),
        svc.getRewards(),
      ]);
      if (mounted) {
        setState(() {
          _status  = results[0] as CoinsStatus;
          _rewards = results[1] as List<RewardItem>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error   = 'No se pudo cargar la información. Verifica tu conexión.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _redeem(RewardItem reward) async {
    final status = _status;
    if (status == null || status.balance < reward.cost) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Confirmar canje'),
        content: Text(
          '¿Canjear "${reward.name}" por ${reward.cost} SFITCoins?\n\n'
          'Tu balance pasará de ${status.balance} a ${status.balance - reward.cost} coins.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.gold),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _redeemingId = reward.id);
    try {
      final svc = ref.read(rewardsApiServiceProvider);
      await svc.redeemReward(reward.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Canje exitoso: ${reward.name}'),
          backgroundColor: AppColors.apto,
        ));
        await _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error al canjear: ${e.toString()}'),
          backgroundColor: AppColors.noApto,
        ));
      }
    } finally {
      if (mounted) setState(() => _redeemingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    if (_loading) {
      return const SfitLoading.page(color: AppColors.gold);
    }

    if (_error != null) {
      return _ErrorState(message: _error!, onRetry: _load);
    }

    final status = _status!;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.gold,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Hero SFITCoins ─────────────────────────────────
              _CoinsHeroCard(status: status, userName: user?.name),
              const SizedBox(height: 12),

              // ── Acceso al ranking ──────────────────────────────
              _RankingAccessCard(onTap: () => context.push('/ranking')),
              const SizedBox(height: 16),

              // ── Catálogo de recompensas ────────────────────────
              const _SectionHeader(label: 'Catálogo de premios'),
              const SizedBox(height: 8),
              if (_rewards.isEmpty)
                const _EmptyRewardsCard()
              else
                ..._rewards.map((r) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _RewardCard(
                        reward: r,
                        balance: status.balance,
                        isRedeeming: _redeemingId == r.id,
                        onRedeem: () => _redeem(r),
                      ),
                    )),

              const SizedBox(height: 20),

              // ── Historial: Todas las transacciones / Sólo canjes ─
              _HistorySection(transactions: status.transactions),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Hero card ─────────────────────────────────────────────────────────────────
class _CoinsHeroCard extends StatelessWidget {
  final CoinsStatus status;
  final String? userName;

  const _CoinsHeroCard({required this.status, this.userName});

  @override
  Widget build(BuildContext context) {
    final (nivelColor, nivelIcon) = switch (status.nivel) {
      2 => (AppColors.ink5, Icons.looks_two_outlined),
      3 => (AppColors.gold, Icons.star_rounded),
      4 => (AppColors.info, Icons.diamond_outlined),
      _ => (AppColors.riesgo, Icons.looks_one_outlined), // Bronce
    };

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.panel, AppColors.panelMid],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
      child: Column(
        children: [
          // Icono
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.gold, width: 2),
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              size: 40,
              color: AppColors.gold,
            ),
          ),
          const SizedBox(height: 12),

          // Nombre de usuario
          if (userName != null)
            Text(
              userName!,
              style: AppTheme.inter(
                fontSize: 13,
                color: Colors.white60,
                fontWeight: FontWeight.w500,
              ),
            ),
          const SizedBox(height: 4),

          // Balance
          Text(
            '${status.balance}',
            style: AppTheme.inter(
              fontSize: 52,
              fontWeight: FontWeight.w900,
              color: AppColors.gold,
              letterSpacing: -2,
            ),
          ),
          Text(
            'SFITCoins',
            style: AppTheme.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Colors.white54,
              letterSpacing: 2.5,
            ),
          ),
          const SizedBox(height: 16),

          // Badge de nivel
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.goldBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(nivelIcon, size: 16, color: nivelColor),
                const SizedBox(width: 6),
                Text(
                  'Nivel ${status.nivelLabel}',
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: nivelColor,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Barra de progreso al siguiente nivel
          _NivelProgressBar(nivel: status.nivel, balance: status.balance),
        ],
      ),
    );
  }
}

class _NivelProgressBar extends StatelessWidget {
  final int nivel;
  final int balance;
  const _NivelProgressBar({required this.nivel, required this.balance});

  @override
  Widget build(BuildContext context) {
    final (current, next, nextLabel) = switch (nivel) {
      1 => (0,   50,  'Plata'),
      2 => (50,  200, 'Oro'),
      3 => (200, 500, 'Platino'),
      _ => (500, 500, 'Platino'), // ya es máximo
    };

    if (nivel >= 4) {
      return Text(
        'Nivel máximo alcanzado',
        style: AppTheme.inter(fontSize: 12, color: Colors.white38),
      );
    }

    final progress = ((balance - current) / (next - current)).clamp(0.0, 1.0);

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '$balance / $next coins para $nextLabel',
              style: AppTheme.inter(fontSize: 11, color: Colors.white54),
            ),
            Text(
              '${(progress * 100).toStringAsFixed(0)}%',
              style: AppTheme.inter(fontSize: 11, color: Colors.white54),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: Colors.white12,
            color: AppColors.gold,
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}

// ── Reward card ───────────────────────────────────────────────────────────────
class _RewardCard extends StatelessWidget {
  final RewardItem reward;
  final int balance;
  final bool isRedeeming;
  final VoidCallback onRedeem;

  const _RewardCard({
    required this.reward,
    required this.balance,
    required this.isRedeeming,
    required this.onRedeem,
  });

  @override
  Widget build(BuildContext context) {
    final canAfford = balance >= reward.cost;
    final hasStock  = reward.hasStock;
    final canRedeem = canAfford && hasStock;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(
          color: canRedeem ? AppColors.goldBorder : AppColors.ink2,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          // Icono categoría
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: canRedeem ? AppColors.goldBg : AppColors.ink1,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: canRedeem ? AppColors.goldBorder : AppColors.ink2,
              ),
            ),
            child: Icon(
              _categoryIcon(reward.category),
              size: 22,
              color: canRedeem ? AppColors.goldDark : AppColors.ink4,
            ),
          ),
          const SizedBox(width: 12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  reward.name,
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: canRedeem ? AppColors.ink9 : AppColors.ink4,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  reward.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.goldBg,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.goldBorder),
                      ),
                      child: Text(
                        '${reward.cost} coins',
                        style: AppTheme.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.goldDark,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      reward.stockLabel,
                      style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Botón canjear
          if (isRedeeming)
            const SizedBox(
              width: 22,
              height: 22,
              child: SfitLoading.inline(strokeWidth: 2, color: AppColors.gold),
            )
          else
            FilledButton(
              onPressed: canRedeem ? onRedeem : null,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                disabledBackgroundColor: AppColors.ink2,
                minimumSize: const Size(72, 36),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              child: Text(
                !hasStock ? 'Agotado' : !canAfford ? 'Faltan ${reward.cost - balance}' : 'Canjear',
                style: AppTheme.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: canRedeem ? Colors.white : AppColors.ink4,
                ),
              ),
            ),
        ],
      ),
    );
  }

  IconData _categoryIcon(String category) => switch (category) {
        'descuento'    => Icons.local_offer_outlined,
        'beneficio'    => Icons.card_giftcard_outlined,
        'certificado'  => Icons.workspace_premium_outlined,
        _              => Icons.redeem_outlined,
      };
}

// ── Transaction tile ──────────────────────────────────────────────────────────
class _TransactionTile extends StatelessWidget {
  final CoinTransaction tx;
  const _TransactionTile({required this.tx});

  @override
  Widget build(BuildContext context) {
    final isGanado = tx.amount > 0;
    return ListTile(
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: isGanado ? AppColors.aptoBg : AppColors.noAptoBg,
          borderRadius: BorderRadius.circular(9),
          border: Border.all(
            color: isGanado ? AppColors.aptoBorder : AppColors.noAptoBorder,
          ),
        ),
        child: Icon(
          isGanado ? Icons.add_circle_outline : Icons.remove_circle_outline,
          size: 18,
          color: isGanado ? AppColors.apto : AppColors.noApto,
        ),
      ),
      title: Text(
        tx.reasonLabel,
        style: AppTheme.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.ink9,
        ),
      ),
      subtitle: Text(
        _formatDate(tx.date),
        style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '${isGanado ? '+' : ''}${tx.amount}',
            style: AppTheme.inter(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isGanado ? AppColors.apto : AppColors.noApto,
            ),
          ),
          Text(
            'Saldo: ${tx.balance}',
            style: AppTheme.inter(fontSize: 10, color: AppColors.ink4),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month && d.year == now.year) {
      return 'Hoy ${_twoDigits(d.hour)}:${_twoDigits(d.minute)}';
    }
    return '${_twoDigits(d.day)}/${_twoDigits(d.month)}/${d.year}';
  }

  String _twoDigits(int n) => n.toString().padLeft(2, '0');
}

// ── Section header ────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              color: AppColors.gold,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: AppTheme.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
            ),
          ),
        ],
      );
}

// ── Empty / Error states ──────────────────────────────────────────────────────
class _EmptyRewardsCard extends StatelessWidget {
  const _EmptyRewardsCard();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            const Icon(Icons.card_giftcard_outlined,
                size: 40, color: AppColors.ink3),
            const SizedBox(height: 10),
            Text(
              'Sin recompensas disponibles',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.ink6,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'El catálogo de recompensas estará disponible próximamente.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink4),
            ),
          ],
        ),
      );
}

class _EmptyTransactionsCard extends StatelessWidget {
  const _EmptyTransactionsCard();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.receipt_long_outlined,
                size: 28, color: AppColors.ink3),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Aún no tienes transacciones. ¡Envía reportes para ganar SFITCoins!',
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
              ),
            ),
          ],
        ),
      );
}

// ── Card acceso ranking ───────────────────────────────────────────────────────
class _RankingAccessCard extends StatelessWidget {
  final VoidCallback onTap;
  const _RankingAccessCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.goldBorder),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.goldBorder),
                ),
                child: const Icon(
                  Icons.leaderboard_rounded,
                  size: 20,
                  color: AppColors.goldDark,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ver ranking',
                      style: AppTheme.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink9,
                      ),
                    ),
                    Text(
                      'Tabla de posiciones por SFITCoins',
                      style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: AppColors.ink4,
                size: 20,
              ),
            ],
          ),
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
            TextButton(
              onPressed: onRetry,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sección de historial con dos tabs: "Todas las transacciones" (fuente:
/// CoinsStatus.transactions ya cargado) y "Mis canjes" (fuente: nuevo
/// endpoint `/ciudadano/recompensas/historial` con detalle de recompensa).
class _HistorySection extends ConsumerStatefulWidget {
  final List<CoinTransaction> transactions;
  const _HistorySection({required this.transactions});

  @override
  ConsumerState<_HistorySection> createState() => _HistorySectionState();
}

class _HistorySectionState extends ConsumerState<_HistorySection> {
  /// 0 = todas, 1 = canjes
  int _tab = 0;
  bool _loadedRedemptions = false;
  bool _loadingRedemptions = false;
  List<RedemptionHistoryItem> _redemptions = const [];
  String? _redemptionsError;

  Future<void> _loadRedemptions() async {
    setState(() {
      _loadingRedemptions = true;
      _redemptionsError = null;
    });
    try {
      final svc = ref.read(rewardsApiServiceProvider);
      final items = await svc.getRedemptionHistory();
      if (!mounted) return;
      setState(() {
        _redemptions = items;
        _loadedRedemptions = true;
        _loadingRedemptions = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _redemptionsError = 'No se pudo cargar el historial de canjes.';
          _loadingRedemptions = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionHeader(label: 'Mis transacciones'),
        const SizedBox(height: 8),
        // Tabs
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: AppColors.ink1,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.ink2),
          ),
          child: Row(children: [
            _HistoryTab(
              label: 'Todas',
              selected: _tab == 0,
              onTap: () => setState(() => _tab = 0),
            ),
            _HistoryTab(
              label: 'Mis canjes',
              selected: _tab == 1,
              onTap: () {
                setState(() => _tab = 1);
                if (!_loadedRedemptions && !_loadingRedemptions) {
                  _loadRedemptions();
                }
              },
            ),
          ]),
        ),
        const SizedBox(height: 10),
        if (_tab == 0)
          _AllTransactionsList(transactions: widget.transactions)
        else
          _RedemptionsList(
            loading: _loadingRedemptions,
            error: _redemptionsError,
            items: _redemptions,
            onRetry: _loadRedemptions,
          ),
      ],
    );
  }
}

class _HistoryTab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _HistoryTab({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 36,
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: selected ? Border.all(color: AppColors.ink2) : null,
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppTheme.inter(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: selected ? AppColors.ink9 : AppColors.ink6,
            ),
          ),
        ),
      ),
    );
  }
}

class _AllTransactionsList extends StatelessWidget {
  final List<CoinTransaction> transactions;
  const _AllTransactionsList({required this.transactions});

  @override
  Widget build(BuildContext context) {
    if (transactions.isEmpty) return const _EmptyTransactionsCard();
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          for (int i = 0; i < transactions.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.ink1),
            _TransactionTile(tx: transactions[i]),
          ],
        ],
      ),
    );
  }
}

class _RedemptionsList extends StatelessWidget {
  final bool loading;
  final String? error;
  final List<RedemptionHistoryItem> items;
  final VoidCallback onRetry;

  const _RedemptionsList({
    required this.loading,
    required this.error,
    required this.items,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Container(
        height: 90,
        alignment: Alignment.center,
        child: const SfitLoading.inline(color: AppColors.gold),
      );
    }
    if (error != null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            const Icon(Icons.error_outline, size: 28, color: AppColors.noApto),
            const SizedBox(height: 6),
            Text(
              error!,
              style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink6),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      );
    }
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.fromLTRB(16, 22, 16, 22),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            const Icon(Icons.redeem_outlined, size: 32, color: AppColors.ink4),
            const SizedBox(height: 8),
            Text(
              'Aún no has canjeado premios',
              style: AppTheme.inter(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink8,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Cuando canjees un premio aparecerá aquí.',
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          for (int i = 0; i < items.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.ink1),
            _RedemptionTile(item: items[i]),
          ],
        ],
      ),
    );
  }
}

class _RedemptionTile extends StatelessWidget {
  final RedemptionHistoryItem item;
  const _RedemptionTile({required this.item});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.goldBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.goldBorder),
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.redeem_rounded, size: 20, color: AppColors.goldDark),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.name,
                style: AppTheme.inter(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                _formatDate(item.createdAt),
                style: AppTheme.inter(
                  fontSize: 11,
                  color: AppColors.ink5,
                  tabular: true,
                ),
              ),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '-${item.amount}',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.noApto,
                tabular: true,
              ),
            ),
            Text(
              'Saldo: ${item.balanceAfter}',
              style: AppTheme.inter(
                fontSize: 10.5,
                color: AppColors.ink5,
                tabular: true,
              ),
            ),
          ],
        ),
      ]),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} · ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}
