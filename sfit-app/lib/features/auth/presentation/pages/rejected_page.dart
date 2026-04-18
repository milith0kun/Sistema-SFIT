import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../providers/auth_provider.dart';
import 'widgets/status_screen.dart';

/// RF-01-04 / RF-01-05: solicitud rechazada.
/// Paleta `noApto` (rojo) — estado final negativo.
class RejectedPage extends ConsumerWidget {
  const RejectedPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StatusScreen(
      mark: const SfitMark(size: 36),
      icon: Icons.cancel_outlined,
      iconColor: AppColors.noApto,
      iconBg: AppColors.noAptoBg,
      title: 'Solicitud rechazada',
      message:
          'Tu solicitud de acceso fue rechazada por el administrador municipal. Puedes crear una nueva cuenta o contactar al soporte.',
      onLogout: () => ref.read(authProvider.notifier).logout(),
      logoutLabel: 'Volver al inicio',
    );
  }
}
