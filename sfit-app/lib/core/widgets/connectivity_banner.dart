import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ── Provider de conectividad ──────────────────────────────────────────────────

/// Stream de estado de conectividad: `true` = con internet, `false` = sin internet.
/// Se define como `keepAlive` para que no se recree en cada reconstrucción.
final connectivityProvider = StreamProvider<bool>((ref) {
  return Connectivity().onConnectivityChanged.map(
    (results) => results.any((r) => r != ConnectivityResult.none),
  );
});

// ── Banner animado ────────────────────────────────────────────────────────────

/// Banner que aparece cuando no hay conexión a internet.
/// Se inyecta como primer elemento del `Column` del body en `HomePage`.
///
/// Uso:
/// ```dart
/// body: Column(
///   children: [
///     const ConnectivityBanner(),
///     Expanded(child: yourBody),
///   ],
/// )
/// ```
class ConnectivityBanner extends ConsumerWidget {
  const ConnectivityBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivityAsync = ref.watch(connectivityProvider);

    // Mientras carga o hay conexión, no mostrar nada.
    final isOnline = connectivityAsync.valueOrNull ?? true;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      height: isOnline ? 0 : 40,
      color: const Color(0xFFEF4444), // red-500
      child: isOnline
          ? const SizedBox.shrink()
          : const _BannerContent(),
    );
  }
}

class _BannerContent extends StatelessWidget {
  const _BannerContent();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.wifi_off_outlined, color: Colors.white, size: 16),
        SizedBox(width: 8),
        Text(
          'Sin conexión · Modo offline',
          style: TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      ],
    );
  }
}
