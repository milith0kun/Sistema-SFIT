import re

# -------------------------------------------------------------
# 1. BusDetailSheet.dart
# -------------------------------------------------------------
with open('sfit-app/lib/features/live_bus/presentation/pages/bus_detail_sheet.dart', 'r', encoding='utf-8') as f:
    sheet_code = f.read()

# Change show signature to return Future<bool?>
sheet_code = sheet_code.replace(
    'static Future<void> show(BuildContext context, BusData bus)',
    'static Future<bool?> show(BuildContext context, BusData bus)'
)

# Add "Seguir este bus" button in the header
header_btn = """
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, size: 20),
                  color: AppColors.ink5,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(true), // Return true for Focus Mode
              icon: const Icon(Icons.my_location, size: 18),
              label: Text(
                'Seguir este bus',
                style: AppTheme.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                minimumSize: const Size(double.infinity, 44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(height: 12),
"""
sheet_code = sheet_code.replace("""                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, size: 20),
                  color: AppColors.ink5,
                ),
              ],
            ),
          ),""", header_btn)

# Change list to Metro Timeline
old_list = """            ...bus.etaByStop.asMap().entries.map((entry) {
              final i = entry.key;
              final s = entry.value;
              final isFirst = i == 0;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.ink1)),
                ),
                child: Row(children: [
                  // Marcador con número
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: isFirst ? AppColors.gold : Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: isFirst ? AppColors.gold : AppColors.ink3, width: 2),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '${s.stopIndex + 1}',
                      style: AppTheme.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: isFirst ? Colors.white : AppColors.ink6,
                        tabular: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          s.label,
                          style: AppTheme.inter(
                            fontSize: 14,
                            fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500,
                            color: AppColors.ink9,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'a ${_formatDistance(s.distanceFromBusMeters)} del bus',
                          style: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // ETA
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: isFirst ? AppColors.goldBg : AppColors.ink1,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: isFirst ? AppColors.goldBorder : AppColors.ink2),
                    ),
                    child: Text(
                      _formatEta(s.etaSeconds),
                      style: AppTheme.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isFirst ? AppColors.goldDark : AppColors.ink7,
                      ),
                    ),
                  ),
                ]),
              );
            }),"""

new_timeline = """            ...bus.etaByStop.asMap().entries.map((entry) {
              final i = entry.key;
              final s = entry.value;
              final isFirst = i == 0;
              final isLast = i == bus.etaByStop.length - 1;
              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      width: 56,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          if (!isLast) Positioned(top: 24, bottom: -24, child: Container(width: 3, color: AppColors.gold.withValues(alpha: 0.3))),
                          if (!isFirst) Positioned(top: -24, bottom: 24, child: Container(width: 3, color: AppColors.gold.withValues(alpha: 0.3))),
                          Container(
                            width: 24, height: 24,
                            decoration: BoxDecoration(
                              color: isFirst ? AppColors.gold : Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.gold, width: 2.5),
                              boxShadow: isFirst ? [BoxShadow(color: AppColors.gold.withValues(alpha: 0.4), blurRadius: 4)] : [],
                            ),
                            alignment: Alignment.center,
                            child: isFirst 
                              ? const Icon(Icons.directions_bus, size: 12, color: Colors.white)
                              : Text('${s.stopIndex + 1}', style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.gold)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(0, 16, 16, 16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    s.label,
                                    style: AppTheme.inter(fontSize: 14, fontWeight: isFirst ? FontWeight.bold : FontWeight.w600, color: AppColors.ink9),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'a ${_formatDistance(s.distanceFromBusMeters)}',
                                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                                
