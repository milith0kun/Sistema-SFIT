import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/api_constants.dart';
import '../constants/app_constants.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// RF-update: Comprueba si hay una nueva versión disponible al iniciar la app.
///
/// Lógica:
///   - Consulta GET /api/version en el servidor.
///   - Si current < minimumVersion  → diálogo FORZADO (sin opción "Más tarde").
///   - Si current < latestVersion   → diálogo opcional (con "Más tarde").
///   - Si el servidor no responde   → usa AppConstants.minimumVersion como fallback.
class UpdateService {
  UpdateService._();

  static bool _checked = false;

  static Future<void> checkAndPrompt(BuildContext context) async {
    if (_checked) return;
    _checked = true;

    try {
      final info = await PackageInfo.fromPlatform();
      final current = info.version;

      // Valores por defecto (fallback local)
      String minimumVersion = AppConstants.minimumVersion;
      String latestVersion  = AppConstants.appVersion;
      String storeUrl       = AppConstants.playStoreUrl;
      bool   forceUpdate    = false;
      String releaseNotes   = '';

      try {
        final dio = Dio(BaseOptions(
          baseUrl: ApiConstants.baseUrl,
          connectTimeout: const Duration(seconds: 6),
          receiveTimeout: const Duration(seconds: 6),
          headers: {
            ApiConstants.clientHeader: ApiConstants.clientToken,
          },
        ));
        final response = await dio.get<Map<String, dynamic>>('/version');
        final body = response.data;
        if (body != null && body['success'] == true) {
          final d = body['data'] as Map<String, dynamic>? ?? {};
          minimumVersion = (d['minimumVersion'] as String?) ?? minimumVersion;
          latestVersion  = (d['latestVersion']  as String?) ?? latestVersion;
          storeUrl       = (d['playStoreUrl']   as String?) ?? storeUrl;
          forceUpdate    = (d['forceUpdate']    as bool?)   ?? false;
          releaseNotes   = (d['releaseNotes']   as String?) ?? '';
        }
      } catch (_) {
        // Sin conexión → usamos fallback local
      }

      if (!context.mounted) return;

      final needsForce    = _isOlderThan(current, minimumVersion);
      final needsOptional = !needsForce && _isOlderThan(current, latestVersion);

      if (needsForce || needsOptional) {
        _showDialog(
          context,
          storeUrl:       storeUrl,
          currentVersion: current,
          newVersion:     needsForce ? minimumVersion : latestVersion,
          forceUpdate:    needsForce || forceUpdate,
          releaseNotes:   releaseNotes,
        );
      }
    } catch (_) {
      // PackageInfo no disponible en esta plataforma — ignorar
    }
  }

  /// true si [a] es una versión semántica más antigua que [b].
  static bool _isOlderThan(String a, String b) {
    try {
      List<int> parse(String v) =>
          v.split('.').map((p) => int.tryParse(p) ?? 0).toList();
      final va = parse(a), vb = parse(b);
      while (va.length < 3) va.add(0);
      while (vb.length < 3) vb.add(0);
      for (int i = 0; i < 3; i++) {
        if (va[i] < vb[i]) return true;
        if (va[i] > vb[i]) return false;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  static void _showDialog(
    BuildContext context, {
    required String storeUrl,
    required String currentVersion,
    required String newVersion,
    required bool forceUpdate,
    required String releaseNotes,
  }) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _UpdateDialog(
        storeUrl:       storeUrl,
        currentVersion: currentVersion,
        newVersion:     newVersion,
        forceUpdate:    forceUpdate,
        releaseNotes:   releaseNotes,
      ),
    );
  }
}

// ── Diálogo de actualización ─────────────────────────────────────────────────

class _UpdateDialog extends StatefulWidget {
  final String storeUrl;
  final String currentVersion;
  final String newVersion;
  final bool   forceUpdate;
  final String releaseNotes;

  const _UpdateDialog({
    required this.storeUrl,
    required this.currentVersion,
    required this.newVersion,
    required this.forceUpdate,
    required this.releaseNotes,
  });

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
      // Ignorar errores al abrir la URL
    } finally {
      if (mounted) setState(() => _launching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasNotes = widget.releaseNotes.isNotEmpty;

    return PopScope(
      // En actualización forzada el botón atrás no puede cerrar el diálogo
      canPop: !widget.forceUpdate,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: Colors.white,
        contentPadding: const EdgeInsets.fromLTRB(0, 0, 0, 0),
        titlePadding: EdgeInsets.zero,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        title: _Header(forceUpdate: widget.forceUpdate),
        content: Padding(
          padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Versión actual → nueva ─────────────────────────
              _VersionRow(
                currentVersion: widget.currentVersion,
                newVersion: widget.newVersion,
              ),
              const SizedBox(height: 16),

              // ── Texto descriptivo ──────────────────────────────
              Text(
                widget.forceUpdate
                    ? 'Esta versión ya no está soportada. Actualiza para seguir usando SFIT.'
                    : 'Hay mejoras y correcciones disponibles. Actualiza para tener la mejor experiencia.',
                style: AppTheme.inter(
                  fontSize: 13.5,
                  color: AppColors.ink6,
                  height: 1.5,
                ),
              ),

              // ── Notas de versión ───────────────────────────────
              if (hasNotes) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.goldBg,
                    border: Border.all(color: AppColors.goldBorder),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'NOVEDADES',
                        style: AppTheme.inter(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: AppColors.goldDark,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        widget.releaseNotes,
                        style: AppTheme.inter(
                          fontSize: 12.5,
                          color: AppColors.ink7,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 22),

              // ── Botón principal — Actualizar ───────────────────
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton.icon(
                  onPressed: _launching ? null : _openStore,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.panel,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
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
                    _launching ? 'Abriendo Play Store…' : 'Actualizar ahora',
                    style: AppTheme.inter(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),

              // ── "Más tarde" solo en actualización opcional ─────
              if (!widget.forceUpdate) ...[
                const SizedBox(height: 8),
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
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink5,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Header del diálogo ────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final bool forceUpdate;
  const _Header({required this.forceUpdate});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.panel,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.12),
              ),
            ),
            child: Icon(
              forceUpdate
                  ? Icons.system_update_rounded
                  : Icons.new_releases_rounded,
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
                  forceUpdate
                      ? 'Actualización requerida'
                      : 'Nueva versión disponible',
                  style: AppTheme.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  forceUpdate
                      ? 'Debes actualizar para continuar'
                      : 'Disponible en Play Store',
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
    );
  }
}

// ── Fila de versiones actual → nueva ─────────────────────────────────────────

class _VersionRow extends StatelessWidget {
  final String currentVersion;
  final String newVersion;
  const _VersionRow({required this.currentVersion, required this.newVersion});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _VersionChip(label: 'Instalada', version: 'v$currentVersion', dim: true),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 10),
            child: Icon(Icons.arrow_forward_rounded, size: 16, color: AppColors.ink4),
          ),
          _VersionChip(label: 'Nueva', version: 'v$newVersion', dim: false),
        ],
      ),
    );
  }
}

class _VersionChip extends StatelessWidget {
  final String label;
  final String version;
  final bool dim;
  const _VersionChip({required this.label, required this.version, required this.dim});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: AppTheme.inter(
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.1,
            color: AppColors.ink4,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          version,
          style: AppTheme.inter(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: dim ? AppColors.ink5 : AppColors.panel,
            tabular: true,
            letterSpacing: -0.3,
          ),
        ),
      ],
    );
  }
}
