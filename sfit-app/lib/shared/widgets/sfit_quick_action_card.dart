import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Card de acción principal para los dashboards por rol.
/// Espejo de `QuickModuleLink` de la web.
///
/// Tiene un gradiente de fondo, un ícono de marca de agua decorativo,
/// una banda lateral de acento y un CTA tipo pill.
class SfitQuickActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final String label;

  const SfitQuickActionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.label = 'Acción principal',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryDark.withValues(alpha: 0.06),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Material(
          color: Colors.white,
          child: InkWell(
            onTap: onTap,
            child: Container(
              constraints: const BoxConstraints(minHeight: 100),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.primaryBorder, width: 1.5),
                borderRadius: BorderRadius.circular(14),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white,
                    AppColors.primaryBg,
                    Color(0xFFF4D5D5),
                  ],
                  stops: [0.0, 0.6, 1.0],
                ),
              ),
              child: Stack(
                children: [
                  // Banda lateral de acento
                  Positioned(
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [AppColors.primaryLight, AppColors.primaryDark],
                        ),
                      ),
                    ),
                  ),

                  // Ícono watermark decorativo
                  Positioned(
                    right: -10,
                    bottom: -16,
                    child: Opacity(
                      opacity: 0.11,
                      child: Icon(
                        icon,
                        size: 138,
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ),

                  // Contenido
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        // En pantallas estrechas (< 360px de ancho útil) la pill
                        // se reduce a un botón circular con sólo flecha — el
                        // texto del título queda con espacio para 2 líneas.
                        final isCompact = constraints.maxWidth < 320;
                        return Row(
                          children: [
                            // Chip de ícono
                            Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                color: AppColors.primaryBg,
                                border: Border.all(color: AppColors.primaryBorder, width: 1.5),
                                borderRadius: BorderRadius.circular(13),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.white.withValues(alpha: 0.5),
                                    blurRadius: 0,
                                    spreadRadius: 1,
                                    offset: const Offset(0, 1),
                                  ),
                                ],
                              ),
                              child: Icon(
                                icon,
                                size: 24,
                                color: AppColors.primaryDark,
                              ),
                            ),
                            const SizedBox(width: 16),

                            // Textos
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    label.toUpperCase(),
                                    style: AppTheme.inter(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.primaryDark,
                                      letterSpacing: 1.6,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTheme.inter(
                                      fontSize: 16.5,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.ink,
                                      letterSpacing: -0.2,
                                      height: 1.18,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    subtitle,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTheme.inter(
                                      fontSize: 12.5,
                                      color: AppColors.ink6,
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(width: 10),

                            // CTA — pill con texto si hay espacio, círculo icónico si no.
                            if (isCompact)
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: AppColors.panel,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.panel.withValues(alpha: 0.25),
                                      blurRadius: 2,
                                      offset: const Offset(0, 1),
                                    ),
                                  ],
                                ),
                                alignment: Alignment.center,
                                child: const Icon(
                                  Icons.arrow_outward_rounded,
                                  size: 16,
                                  color: Colors.white,
                                ),
                              )
                            else
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                                decoration: BoxDecoration(
                                  color: AppColors.panel,
                                  borderRadius: BorderRadius.circular(9),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.panel.withValues(alpha: 0.25),
                                      blurRadius: 2,
                                      offset: const Offset(0, 1),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      'Acceder',
                                      style: AppTheme.inter(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    const Icon(
                                      Icons.arrow_outward_rounded,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
