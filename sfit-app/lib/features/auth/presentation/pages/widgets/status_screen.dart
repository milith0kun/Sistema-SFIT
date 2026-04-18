import 'package:flutter/material.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';

/// Pantalla informativa de estado (pending / rejected / rol web-only).
/// Ícono circular con borde tintado, título, mensaje y botón outlined.
class StatusScreen extends StatelessWidget {
  final Widget? mark;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String message;
  final VoidCallback onLogout;
  final String logoutLabel;

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
              const SizedBox(height: 36),
              OutlinedButton(onPressed: onLogout, child: Text(logoutLabel)),
            ],
          ),
        ),
      ),
    );
  }
}
