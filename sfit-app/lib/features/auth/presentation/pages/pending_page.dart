import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../providers/auth_provider.dart';
import 'widgets/status_screen.dart';

/// RF-01-03 / RF-01-04: Pantalla mostrada cuando la cuenta está en revisión.
class PendingPage extends ConsumerWidget {
  const PendingPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StatusScreen(
      mark: const SfitMark(size: 36),
      icon: Icons.hourglass_top_rounded,
      iconColor: AppColors.gold,
      iconBg: AppColors.goldBg,
      title: 'Solicitud enviada',
      message:
          'Tu cuenta está pendiente de aprobación. Recibirás una notificación cuando el administrador revise tu solicitud.',
      onLogout: () => ref.read(authProvider.notifier).logout(),
    );
  }
}
