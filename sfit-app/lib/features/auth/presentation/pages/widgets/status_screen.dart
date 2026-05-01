import 'package:flutter/material.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';

/// Pantalla informativa de estado (pending / rejected / rol web-only).
/// Ícono circular con borde tintado, título, mensaje y botones outlined.
class StatusScreen extends StatelessWidget {
  final Widget? mark;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String message;
  final VoidCallback onLogout;
  final String logoutLabel;

  /// CTA principal opcional (botón filled arriba del logout). Útil para
  /// roles web-only: "Abrir panel web" que abre `sfit.ecosdelseo.com`.
  final VoidCallback? onPrimary;
  final IconData? primaryIcon;
  final String? primaryLabel;

  const StatusScreen({
    super.key,
    this.mark,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.message,
    required this.onLogout,
    this.logoutLabel = 'Cerrar sesión',
    this.onPrimary,
    this.primaryIcon,
    this.primaryLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (mark != null) ...[
                mark!,
                const SizedBox(height: 36),
              ],
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: iconColor.withValues(alpha: 0.35),
                    width: 1.5,
                  ),
                ),
                child: Icon(icon, size: 34, color: iconColor),
              ),
              const SizedBox(height: 22),
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppTheme.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: AppTheme.inter(
                  fontSize: 14,
                  color: AppColors.ink6,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              if (onPrimary != null) ...[
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton.icon(
                    onPressed: onPrimary,
                    icon: Icon(primaryIcon ?? Icons.open_in_new_rounded, size: 18),
                    label: Text(
                      primaryLabel ?? 'Continuar',
                      style: AppTheme.inter(fontSize: 14.5, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ink9,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton(
                  onPressed: onLogout,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.ink2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    logoutLabel,
                    style: AppTheme.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.ink8),
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
