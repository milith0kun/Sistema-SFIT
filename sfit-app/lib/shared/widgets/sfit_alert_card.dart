import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Tono visual de `SfitAlertCard`.
enum AlertTone { danger, warning, info, success }

class SfitAlert {
  final String title;
  final String? detail;

  const SfitAlert({required this.title, this.detail});
}

class _ToneDef {
  final Color color;
  final Color bg;
  final Color border;
  final IconData icon;
  const _ToneDef(this.color, this.bg, this.border, this.icon);
}

const _tones = <AlertTone, _ToneDef>{
  AlertTone.danger: _ToneDef(
      AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder,
      Icons.error_outline_rounded),
  AlertTone.warning: _ToneDef(
      AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder,
      Icons.warning_amber_rounded),
  AlertTone.info: _ToneDef(
      AppColors.info, AppColors.infoBg, AppColors.infoBorder,
      Icons.info_outline_rounded),
  AlertTone.success: _ToneDef(
      AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder,
      Icons.check_circle_outline_rounded),
};

/// Card de alertas: tono + icono + título + lista. Réplica del patrón
/// usado en `/flota` (modal checklist + alertas críticas).
class SfitAlertCard extends StatelessWidget {
  final AlertTone tone;
  final String title;
  final List<SfitAlert> alerts;
  final VoidCallback? onClose;

  const SfitAlertCard({
    super.key,
    required this.tone,
    required this.title,
    required this.alerts,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final t = _tones[tone]!;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: t.bg,
        border: Border.all(color: t.border, width: 1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(t.icon, size: 18, color: t.color),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: AppTheme.inter(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: t.color,
                  ),
                ),
              ),
              if (onClose != null)
                GestureDetector(
                  onTap: onClose,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Icon(Icons.close_rounded, size: 16, color: t.color),
                  ),
                ),
            ],
          ),
          if (alerts.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...alerts.map(
              (a) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 6, right: 8),
                      width: 4,
                      height: 4,
                      decoration:
                          BoxDecoration(color: t.color, shape: BoxShape.circle),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            a.title,
                            style: AppTheme.inter(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w500,
                              color: AppColors.ink8,
                              height: 1.4,
                            ),
                          ),
                          if (a.detail != null)
                            Text(
                              a.detail!,
                              style: AppTheme.inter(
                                fontSize: 11.5,
                                color: AppColors.ink6,
                                height: 1.35,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
