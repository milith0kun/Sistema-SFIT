import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Banner de no afiliación gubernamental.
/// Requerido por las políticas de Google Play (Afirmaciones Engañosas).
class SfitDisclaimerBanner extends StatelessWidget {
  /// [compact] = true para la versión de una línea (onboarding).
  final bool compact;
  const SfitDisclaimerBanner({super.key, this.compact = false});

  static const _mtcUrl    = 'https://www.gob.pe/mtc';
  static const _sutranUrl = 'https://www.sutran.gob.pe';

  Future<void> _open(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) => compact
      ? _CompactBanner(onTap: () => _open(_mtcUrl))
      : _FullBanner(
          onTapMtc:    () => _open(_mtcUrl),
          onTapSutran: () => _open(_sutranUrl),
        );
}

class _FullBanner extends StatelessWidget {
  final VoidCallback onTapMtc;
  final VoidCallback onTapSutran;
  const _FullBanner({required this.onTapMtc, required this.onTapSutran});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.ink1,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.info_outline, size: 13, color: AppColors.ink5),
                const SizedBox(width: 6),
                Text(
                  'APLICACIÓN NO OFICIAL',
                  style: AppTheme.inter(
                    fontSize: 9.5, fontWeight: FontWeight.w700,
                    color: AppColors.ink5, letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'SFIT es una plataforma académica de gestión de transporte urbano. '
              'No está afiliada ni representa a ninguna entidad pública ni '
              'organismo gubernamental del Perú.',
              style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5, height: 1.5),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: onTapMtc,
              child: Text(
                '🔗 Fuente oficial: Ministerio de Transportes → gob.pe/mtc',
                style: AppTheme.inter(
                  fontSize: 11, color: AppColors.goldDark,
                  fontWeight: FontWeight.w600, height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 4),
            GestureDetector(
              onTap: onTapSutran,
              child: Text(
                '🔗 SUTRAN — Superintendencia de Transporte → sutran.gob.pe',
                style: AppTheme.inter(
                  fontSize: 11, color: AppColors.goldDark,
                  fontWeight: FontWeight.w600, height: 1.4,
                ),
              ),
            ),
          ],
        ),
      );
}

class _CompactBanner extends StatelessWidget {
  final VoidCallback onTap;
  const _CompactBanner({required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.ink1,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.ink2),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline, size: 13, color: AppColors.ink5),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'App no oficial · No afiliada a entidades públicas · '
                  'Fuente oficial: gob.pe/mtc',
                  style: AppTheme.inter(fontSize: 10.5, color: AppColors.ink5, height: 1.4),
                ),
              ),
              const Icon(Icons.open_in_new, size: 11, color: AppColors.goldDark),
            ],
          ),
        ),
      );
}
