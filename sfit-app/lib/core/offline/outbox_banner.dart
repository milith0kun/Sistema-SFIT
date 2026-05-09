import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'outbox_registry.dart';

/// Banner que aparece bajo el AppBar cuando hay items pendientes en
/// alguno de los outboxes (sanciones, reportes, inspecciones). Espejo
/// del patrón de `ConnectivityBanner` pero con semántica distinta:
///
/// - Conectividad → "Sin conexión · Modo offline" (rojo).
/// - Outbox      → "X cambios pendientes de sincronizar" (ámbar).
///
/// Pueden coexistir: un usuario puede estar online pero el backend
/// rechazó por timeout y los items están en cola de retry.
class OutboxBanner extends ConsumerWidget {
  const OutboxBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncCount = ref.watch(totalPendingOutboxProvider);
    final count = asyncCount.valueOrNull ?? 0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      height: count > 0 ? 36 : 0,
      color: AppColors.riesgoBg,
      child: count > 0 ? _Content(count: count) : const SizedBox.shrink(),
    );
  }
}

class _Content extends StatelessWidget {
  final int count;
  const _Content({required this.count});

  @override
  Widget build(BuildContext context) {
    final label = count == 1
        ? '1 cambio pendiente de sincronizar'
        : '$count cambios pendientes de sincronizar';
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(
          Icons.cloud_upload_outlined,
          color: AppColors.riesgo,
          size: 14,
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: AppTheme.inter(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: AppColors.riesgo,
            letterSpacing: 0.1,
          ),
        ),
      ],
    );
  }
}
