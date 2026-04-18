import 'package:flutter/material.dart';
import '../../../../../core/theme/app_colors.dart';

/// Widget reutilizable para pantallas informativas de estado (pending / rejected /
/// rol exclusivo de web). Muestra un ícono dentro de un círculo, título, mensaje
/// y un botón para cerrar sesión.
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
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (mark != null) ...[
                mark!,
                const SizedBox(height: 40),
              ],
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: iconColor.withValues(alpha: 0.3),
                    width: 1.5,
                  ),
                ),
                child: Icon(icon, size: 34, color: iconColor),
              ),
              const SizedBox(height: 24),
              Text(title, style: tt.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Text(
                message,
                style: tt.bodyMedium?.copyWith(color: AppColors.ink5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              OutlinedButton(onPressed: onLogout, child: Text(logoutLabel)),
            ],
          ),
        ),
      ),
    );
  }
}
