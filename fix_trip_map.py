import re

with open("sfit-app/lib/features/trips/presentation/pages/trip_map_page.dart", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Modify the line right after `final visited = tracking.visitedStopIndices;`
target_1 = """    final visited = tracking.visitedStopIndices;

    return Stack("""

replacement_1 = """    final visited = tracking.visitedStopIndices;

    // Calcular el próximo paradero
    final ordered = [...waypoints]..sort((a, b) => a.order.compareTo(b.order));
    RouteWaypoint? nextWaypoint;
    for (final wp in ordered) {
      if (!visited.contains(wp.order)) {
        nextWaypoint = wp;
        break;
      }
    }

    return Stack("""

content = content.replace(target_1, replacement_1)

# 2. Modify the Polyline color for the local track
target_2 = """            // Track GPS real del conductor
            if (tracking.localTrack.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: tracking.localTrack,
                    color: AppColors.gold,
                    strokeWidth: 4.5,
                  ),
                ],
              ),"""

replacement_2 = """            // Track GPS real del conductor
            if (tracking.localTrack.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: tracking.localTrack,
                    color: tracking.isOffRoute ? AppColors.noApto : AppColors.gold,
                    strokeWidth: 4.5,
                  ),
                ],
              ),"""

content = content.replace(target_2, replacement_2)

# 3. Modify the marker color for the current position
target_3 = """                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.gold,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2.5),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.gold.withValues(alpha: 0.4),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ],
                      ),"""

replacement_3 = """                    child: Container(
                      decoration: BoxDecoration(
                        color: tracking.isOffRoute ? AppColors.noApto : AppColors.gold,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2.5),
                        boxShadow: [
                          BoxShadow(
                            color: (tracking.isOffRoute ? AppColors.noApto : AppColors.gold).withValues(alpha: 0.4),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ],
                      ),"""

content = content.replace(target_3, replacement_3)

# 4. Replace `_Header(tracking: tracking),` with the Column
target_4 = """        _Header(tracking: tracking),"""

replacement_4 = """        Positioned(
          top: 8,
          left: 8,
          right: 8,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _Header(tracking: tracking),
              if (tracking.isOffRoute) ...[
                const SizedBox(height: 8),
                const _OffRouteBanner(),
              ],
              if (nextWaypoint != null) ...[
                const SizedBox(height: 8),
                _NextStopCard(
                  waypoint: nextWaypoint,
                  lastVisited: tracking.lastVisitedLabel,
                ),
              ],
            ],
          ),
        ),"""

content = content.replace(target_4, replacement_4)

# 5. Append the classes
classes = """
class _OffRouteBanner extends StatelessWidget {
  const _OffRouteBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.noApto.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.noAptoDark),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Desvío detectado',
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Por favor, retorna a la ruta planificada.',
                  style: AppTheme.inter(
                    fontSize: 11,
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
  final RouteWaypoint waypoint;
  final String? lastVisited;

  const _NextStopCard({required this.waypoint, this.lastVisited});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.goldBorder),
            ),
            alignment: Alignment.center,
            child: Text(
              '${waypoint.order + 1}',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.goldDark,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
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
                const SizedBox(height: 2),
                Text(
                  waypoint.label ?? 'Paradero ${waypoint.order + 1}',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (lastVisited != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.check_circle, size: 12, color: AppColors.apto),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Pasaste: $lastVisited',
                          style: AppTheme.inter(
                            fontSize: 11,
                     
