import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/api_constants.dart';
import '../constants/app_constants.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Verifica si hay una nueva versión de la app disponible.
///
/// Consulta [ApiConstants.baseUrl]/version para obtener la versión mínima
/// requerida. Si el servidor no responde, usa [AppConstants.minimumVersion]
/// como fallback. Muestra un diálogo con enlace a Play Store si corresponde.
class UpdateService {
  UpdateService._();

  static bool _checked = false;

  /// Llamar una sola vez por sesión (normalmente en el primer frame del app).
  static Future<void> checkAndPrompt(BuildContext context) async {
    if (_checked) return;
    _checked = true;

    try {
      final info = await PackageInfo.fromPlatform();
      final current = info.version;

      String minimumVersion = AppConstants.minimumVersion;
      String storeUrl       = AppConstants.playStoreUrl;

      // Intentar obtener versión mínima desde la API (sin auth)
      try {
        final dio = Dio(BaseOptions(
          baseUrl: ApiConstants.baseUrl,
          connectTimeout: const Duration(seconds: 6),
          receiveTimeout: const Duration(seconds: 6),
        ));
        final response = await dio.get<Map<String, dynamic>>('/version');
        final body = response.data;
        if (body != null && body['success'] == true) {
          final d = body['data'] as Map<String, dynamic>?;
          minimumVersion = (d?['minimumVersion'] as String?) ?? minimumVersion;
          storeUrl       = (d?['playStoreUrl']   as String?) ?? storeUrl;
        }
      } catch (_) {
        // Ignorar errores de red — usamos el fallback local
      }

      if (!context.mounted) return;

      if (_needsUpdate(current, minimumVersion)) {
        _showDialog(context, storeUrl, minimumVersion);
      }
    } catch (_) {
      // Ignorar errores de PackageInfo en plataformas sin soporte
    }
  }

  /// Compara versiones semánticas. Devuelve true si current < minimum.
  static bool _needsUpdate(String current, String minimum) {
    try {
      List<int> parse(String v) =>
          v.split('.').map((p) => int.tryParse(p) ?? 0).toList();
      final c = parse(current);
      final m = parse(minimum);
      while (c.length < 3) { c.add(0); }
      while (m.length < 3) { m.add(0); }
      for (int i = 0; i < 3; i++) {
        if (c[i] < m[i]) return true;
        if (c[i] > m[i]) return false;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  static void _showDialog(
      BuildContext context, String storeUrl, String requiredVersion) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _UpdateDialog(
        storeUrl: storeUrl,
        requiredVersion: requiredVersion,
      ),
    );
  }
}

// ── Diálogo de actualización ─────────────────────────────────────────────────

class _UpdateDialog extends StatefulWidget {
  final String storeUrl;
  final String requiredVersion;

  const _UpdateDialog({required this.storeUrl, required this.requiredVersion});

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _launching = false;

  Future<void> _openStore() async {
    setState(() => _launching = true);
    try {
      final uri = Uri.parse(widget.storeUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      // Ignorar
    } finally {
      if (mounted) setState(() => _launching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      backgroundColor: Colors.white,
      contentPadding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
      titlePadding: EdgeInsets.zero,
      title: Container(
        decoration: const BoxDecoration(
          color: AppColors.panel,
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.system_update_rounded,
                color: AppColors.goldLight,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Nueva versión disponible',
                    style: AppTheme.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Versión ${widget.requiredVersion}',
                    style: AppTheme.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.goldLight,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 18),
          Text(
            'Hay una actualización de SFIT en Play Store con mejoras y correcciones importantes.',
            style: AppTheme.inter(
              fontSize: 14,
              color: AppColors.ink7,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Actualiza ahora para continuar usando la aplicación correctamente.',
            style: AppTheme.inter(
              fontSize: 13,
              color: AppColors.ink5,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: FilledButton.icon(
              onPressed: _launching ? null : _openStore,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              icon: _launching
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.open_in_new_rounded, size: 18),
              label: Text(
                _launching ? 'Abriendo…' : 'Ir a Play Store',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 40,
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(),
              style: TextButton.styleFrom(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                'Más tarde',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
