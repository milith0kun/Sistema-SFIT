import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_loading.dart';

/// Pantalla de QR firmado HMAC-SHA256 para un vehículo — rol OPERADOR.
/// Llama a GET /api/vehiculos/:id/qr y muestra el código QR generado.
class VehicleQrPage extends ConsumerStatefulWidget {
  final String vehicleId;
  final String plate;

  const VehicleQrPage({
    super.key,
    required this.vehicleId,
    required this.plate,
  });

  @override
  ConsumerState<VehicleQrPage> createState() => _VehicleQrPageState();
}

class _VehicleQrPageState extends ConsumerState<VehicleQrPage> {
  bool _loading = true;
  String? _error;
  String? _qrJson;
  String? _pngDataUrl; // base64 PNG devuelto por la API
  Map<String, dynamic>? _payload;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/vehiculos/${widget.vehicleId}/qr');
      final data = (resp.data as Map)['data'] as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _qrJson    = data['qrJson'] as String?;
          _pngDataUrl = data['pngDataUrl'] as String?;
          _payload   = data['payload'] as Map<String, dynamic>?;
          _loading   = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error   = 'No se pudo generar el QR. Verifica tu conexión.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _share() async {
    if (_qrJson == null) return;
    // share_plus no está en pubspec — usamos Clipboard + snackbar informativo
    // como fallback robusto sin nueva dependencia.
    await Clipboard.setData(ClipboardData(text: _qrJson!));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Payload QR copiado al portapapeles.',
          style: AppTheme.inter(fontSize: 13, color: Colors.white),
        ),
        backgroundColor: AppColors.panel,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _openDataUrl() async {
    if (_pngDataUrl == null) return;
    // Abre el data URL en el browser para que el usuario pueda guardar la imagen.
    final uri = Uri.parse(_pngDataUrl!);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'No se pudo abrir el navegador para descargar el QR.',
            style: AppTheme.inter(fontSize: 13, color: Colors.white),
          ),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text(
          'QR · ${widget.plate}',
          style: AppTheme.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
            letterSpacing: -0.3,
          ),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppColors.ink2),
        ),
      ),
      body: _loading
          ? const SfitLoading()
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : _QrView(
                  plate: widget.plate,
                  qrJson: _qrJson!,
                  payload: _payload,
                  onShare: _share,
                  onDownload: _pngDataUrl != null ? _openDataUrl : null,
                ),
    );
  }
}

// ── Vista principal con QR ────────────────────────────────────────────────────

class _QrView extends StatelessWidget {
  final String plate;
  final String qrJson;
  final Map<String, dynamic>? payload;
  final VoidCallback onShare;
  final VoidCallback? onDownload;

  const _QrView({
    required this.plate,
    required this.qrJson,
    required this.onShare,
    this.payload,
    this.onDownload,
  });

  @override
  Widget build(BuildContext context) {
    final expiry = payload?['exp'] as int?;
    final expDate = expiry != null
        ? DateTime.fromMillisecondsSinceEpoch(expiry * 1000)
        : null;

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Kicker ──────────────────────────────────────────────
            Text(
              'QR FIRMADO HMAC-SHA256',
              style: AppTheme.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.goldDark,
                letterSpacing: 1.8,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              plate,
              style: AppTheme.inter(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
                letterSpacing: -0.5,
                tabular: true,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),

            // ── QR Widget ────────────────────────────────────────────
            Center(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.ink2, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.ink2.withValues(alpha: 0.5),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: QrImageView(
                  data: qrJson,
                  version: QrVersions.auto,
                  size: 240,
                  errorCorrectionLevel: QrErrorCorrectLevel.H,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: Color(0xFF0A1628), // AppColors.panel
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: Color(0xFF0A1628),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Info de expiración ───────────────────────────────────
            if (expDate != null)
              _InfoRow(
                icon: Icons.schedule_outlined,
                label: 'Válido hasta',
                value: _formatDate(expDate),
              ),
            if (payload?['vehicleTypeKey'] != null)
              _InfoRow(
                icon: Icons.directions_car_outlined,
                label: 'Tipo',
                value: _vehicleTypeLabel(payload!['vehicleTypeKey'] as String),
              ),
            const SizedBox(height: 24),

            // ── Botones ─────────────────────────────────────────────
            FilledButton.icon(
              onPressed: onShare,
              icon: const Icon(Icons.copy_outlined, size: 18),
              label: const Text('Copiar payload QR'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
            if (onDownload != null) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: onDownload,
                icon: const Icon(Icons.download_outlined, size: 18),
                label: const Text('Abrir imagen PNG'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.ink7,
                  side: const BorderSide(color: AppColors.ink3),
                  minimumSize: const Size(double.infinity, 48),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
            const SizedBox(height: 16),

            // ── Nota informativa ─────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.goldBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline,
                      size: 16, color: AppColors.goldDark),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Este QR contiene la firma HMAC del vehículo. '
                      'El fiscal puede escanearlo sin conexión para verificar su autenticidad.',
                      style: AppTheme.inter(
                          fontSize: 12, color: AppColors.goldDark, height: 1.45),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/'
      '${d.month.toString().padLeft(2, '0')}/'
      '${d.year}  ${d.hour.toString().padLeft(2, '0')}:'
      '${d.minute.toString().padLeft(2, '0')}';

  String _vehicleTypeLabel(String k) => switch (k) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos'  => 'Limpieza',
        'emergencia'         => 'Emergencia',
        'maquinaria'         => 'Maquinaria',
        _                    => 'Municipal',
      };
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 15, color: AppColors.ink4),
          const SizedBox(width: 6),
          Text(
            '$label: ',
            style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink5),
          ),
          Text(
            value,
            style: AppTheme.inter(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppColors.ink7,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Vista de error ────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.qr_code_2_outlined,
                size: 56, color: AppColors.ink3),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 14, color: AppColors.ink6, height: 1.4),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
