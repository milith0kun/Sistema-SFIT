import re

with open('sfit-app/lib/features/trips/presentation/pages/trip_map_page.dart', 'r') as f:
    content = f.read()

# Replace track color
content = content.replace(
    'color: AppColors.gold,\n                    strokeWidth: 4.5,',
    'color: tracking.isOffRoute ? AppColors.noApto : AppColors.gold,\n                    strokeWidth: 4.5,'
)

# Replace marker color
content = content.replace(
    'color: AppColors.gold,\n                        shape: BoxShape.circle,',
    'color: tracking.isOffRoute ? AppColors.noApto : AppColors.gold,\n                        shape: BoxShape.circle,'
)

content = content.replace(
    'color: AppColors.gold.withValues(alpha: 0.4),',
    'color: (tracking.isOffRoute ? AppColors.noApto : AppColors.gold).withValues(alpha: 0.4),'
)

# Add banners to Stack
stack_insert = """        _Header(tracking: tracking),

        if (tracking.isOffRoute)
          const Positioned(
            top: 60,
            left: 8,
            right: 8,
            child: _OffRouteBanner(),
          ),

        Positioned(
          top: tracking.isOffRoute ? 120 : 60,
          left: 8,
          right: 8,
          child: _NextStopCard(tracking: tracking),
        ),"""

content = content.replace('        _Header(tracking: tracking),', stack_insert)

# Add new classes at the end
new_classes = """
class _OffRouteBanner extends StatelessWidget {
  const _OffRouteBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.noApto.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Desvío de ruta detectado',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Por favor, reincorpórese a la ruta asignada.',
                  style: AppTheme.inter(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NextStopCard extends StatelessWidget {
  final TrackingState tracking;
  const _NextStopCard({required this.tracking});

  @override
  Widget build(BuildContext context) {
    final waypoints = tracking.routeWaypoints;
    final visited = tracking.visitedStopIndices;
    final ordered = [...waypoints]..sort((a, b) => a.order.compareTo(b.order));
    
    RouteWaypoint? nextStop;
    for (final wp in ordered) {
      if (!visited.contains(wp.order)) {
        nextStop = wp;
        break;
      }
    }

    if (nextStop == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.panel,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.goldBorder),
            ),
            alignment: Alignment.center,
            child: Text(
              '${nextStop.order + 1}',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppColors.goldDark,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Próximo Paradero',
                  style: AppTheme.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink5,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  nextStop.label ?? 'Desconocido',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
"""

content += new_classes

with open('sfit-app/lib/features/trips/presentation/pages/trip_map_page.dart', 'w') as f:
    f.write(content)
