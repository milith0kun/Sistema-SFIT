import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/services/qr_hmac_service.dart';

/// Escáner QR de SFIT — verifica la firma HMAC localmente (offline-first).
///
/// [forInspection] = true → navega a nueva inspección (rol fiscal).
/// [forInspection] = false (default) → navega a vista pública del vehículo.
class QrScannerPage extends StatefulWidget {
  final bool forInspection;
  const QrScannerPage({super.key, this.forInspection = false});

  @override
  State<QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<QrScannerPage> {
  MobileScannerController? _ctrl;
  bool _processing    = false;
  bool _permDenied    = false;
  bool _permChecked   = false;
  String? _errorMsg;
  Timer? _errorTimer;

  @override
  void initState() {
    super.initState();
    _checkCameraPermission();
  }

  Future<void> _checkCameraPermission() async {
    final status = await Permission.camera.request();
    if (!mounted) return;

    if (status.isGranted) {
      setState(() {
        _permChecked = true;
        _permDenied  = false;
        _ctrl = MobileScannerController(
          facing: CameraFacing.back,
          detectionSpeed: DetectionSpeed.normal,
        );
      });
    } else {
      setState(() {
        _permChecked = true;
        _permDenied  = true;
      });
    }
  }

  @override
  void dispose() {
    _ctrl?.dispose();
    _errorTimer?.cancel();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_processing) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;

    setState(() { _processing = true; _errorMsg = null; });

    final payload = QrHmacService.parse(raw);
    if (payload == null) {
      _showError('Código QR no reconocido como SFIT.');
      return;
    }

    final valid = QrHmacService.verify(payload);

    if (widget.forInspection) {
      context.push('/nueva-inspeccion', extra: {
        'vehicleId':    payload.id,
        'plate':        payload.pl,
        'vehicleTypeKey': payload.ty,
      });
    } else {
      context.push(
        '/vehiculo-publico/${payload.pl}',
        extra: {'qrJson': raw, 'offlineVerified': valid},
      );
    }
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _processing = false);
    });
  }

  void _showError(String msg) {
    setState(() { _errorMsg = msg; _processing = false; });
    _errorTimer?.cancel();
    _errorTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _errorMsg = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text('Escanear QR', style: AppTheme.inter(
          fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white,
        )),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
        actions: [
          if (_ctrl != null)
            IconButton(
              tooltip: 'Linterna',
              icon: ValueListenableBuilder(
                valueListenable: _ctrl!,
                builder: (_, value, __) => Icon(
                  value.torchState == TorchState.on
                      ? Icons.flash_on
                      : Icons.flash_off,
                  color: Colors.white,
                ),
              ),
              onPressed: _ctrl!.toggleTorch,
            ),
        ],
      ),
      body: !_permChecked
          // Esperando respuesta del sistema
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _permDenied
              // Permiso denegado — mostrar pantalla explicativa
              ? _PermissionDeniedView(onRetry: _checkCameraPermission)
              // Cámara disponible
              : Stack(
                  children: [
                    MobileScanner(
                      controller: _ctrl!,
                      onDetect: _onDetect,
                    ),
                    CustomPaint(
                      painter: _ScanOverlayPainter(),
                      child: const SizedBox.expand(),
                    ),
                    Positioned(
                      bottom: 40,
                      left: 24,
                      right: 24,
                      child: Column(
                        children: [
                          if (_errorMsg != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: AppColors.noAptoBg,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.noAptoBorder),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline,
                                      size: 16, color: AppColors.noApto),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(_errorMsg!,
                                        style: AppTheme.inter(
                                          fontSize: 13, color: AppColors.noApto,
                                        )),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 12),
                          Text(
                            'Apunta la cámara al QR del vehículo',
                            textAlign: TextAlign.center,
                            style: AppTheme.inter(
                                fontSize: 13, color: Colors.white70),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'La verificación funciona sin conexión',
                            textAlign: TextAlign.center,
                            style: AppTheme.inter(
                                fontSize: 11, color: Colors.white38),
                          ),
                        ],
                      ),
                    ),
                    if (_processing)
                      Container(
                        color: Colors.black45,
                        child: const Center(
                          child: CircularProgressIndicator(
                              color: AppColors.gold),
                        ),
                      ),
                  ],
                ),
    );
  }
}

// ── Pantalla de permiso denegado ────────────────────────────────────────────

class _PermissionDeniedView extends StatelessWidget {
  final VoidCallback onRetry;
  const _PermissionDeniedView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.noAptoBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.noAptoBorder),
              ),
              child: const Icon(Icons.camera_alt_outlined,
                  size: 34, color: AppColors.noApto),
            ),
            const SizedBox(height: 20),
            Text(
              'Permiso de cámara requerido',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'SFIT necesita acceso a la cámara para escanear el código QR del vehículo.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 14, color: Colors.white60, height: 1.5,
              ),
            ),
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: () async {
                await openAppSettings();
              },
              icon: const Icon(Icons.settings_outlined, size: 17),
              label: const Text('Abrir ajustes'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white70,
                side: const BorderSide(color: Colors.white24),
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Overlay visor QR ────────────────────────────────────────────────────────

class _ScanOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const sideLen    = 220.0;
    const cornerLen  = 28.0;
    const cornerWidth = 4.0;

    final cx   = size.width / 2;
    final cy   = size.height / 2 - 40;
    final rect = Rect.fromCenter(
      center: Offset(cx, cy),
      width:  sideLen,
      height: sideLen,
    );

    final backdrop = Paint()..color = Colors.black54;
    canvas.drawRect(
        Rect.fromLTWH(0, 0, size.width, rect.top), backdrop);
    canvas.drawRect(
        Rect.fromLTWH(0, rect.bottom, size.width, size.height - rect.bottom),
        backdrop);
    canvas.drawRect(
        Rect.fromLTWH(0, rect.top, rect.left, sideLen), backdrop);
    canvas.drawRect(
        Rect.fromLTWH(rect.right, rect.top, size.width - rect.right, sideLen),
        backdrop);

    final corner = Paint()
      ..color      = AppColors.gold
      ..strokeWidth = cornerWidth
      ..style      = PaintingStyle.stroke
      ..strokeCap  = StrokeCap.round;

    canvas.drawLine(rect.topLeft, rect.topLeft + const Offset(cornerLen, 0), corner);
    canvas.drawLine(rect.topLeft, rect.topLeft + const Offset(0, cornerLen), corner);
    canvas.drawLine(rect.topRight, rect.topRight + const Offset(-cornerLen, 0), corner);
    canvas.drawLine(rect.topRight, rect.topRight + const Offset(0, cornerLen), corner);
    canvas.drawLine(rect.bottomLeft, rect.bottomLeft + const Offset(cornerLen, 0), corner);
    canvas.drawLine(rect.bottomLeft, rect.bottomLeft + const Offset(0, -cornerLen), corner);
    canvas.drawLine(rect.bottomRight, rect.bottomRight + const Offset(-cornerLen, 0), corner);
    canvas.drawLine(rect.bottomRight, rect.bottomRight + const Offset(0, -cornerLen), corner);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
