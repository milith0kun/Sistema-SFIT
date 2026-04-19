import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// RF-17: Escáner de placa vehicular por OCR.
///
/// Permite al usuario tomar una foto de la placa con la cámara o
/// seleccionarla desde galería. Envía la imagen al endpoint
/// POST /api/ocr/placa y muestra la placa detectada.
/// Si el usuario acepta, navega a /vehiculo-publico/{plate}.
class PlateScannerPage extends ConsumerStatefulWidget {
  const PlateScannerPage({super.key});

  @override
  ConsumerState<PlateScannerPage> createState() => _PlateScannerPageState();
}

class _PlateScannerPageState extends ConsumerState<PlateScannerPage> {
  final _picker = ImagePicker();

  XFile? _imageFile;
  String? _rawText;
  String? _detectedPlate;
  double _confidence = 0;

  bool _loading = false;
  String? _errorMsg;

  // ── Tomar foto con cámara ────────────────────────────────────────────────
  Future<void> _pickFromCamera() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 90,
        maxWidth: 1920,
      );
      if (file != null) {
        setState(() { _imageFile = file; _rawText = null; _detectedPlate = null; _errorMsg = null; });
        await _runOcr(file);
      }
    } catch (e) {
      _setError('No se pudo acceder a la cámara: $e');
    }
  }

  // ── Seleccionar desde galería ────────────────────────────────────────────
  Future<void> _pickFromGallery() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
        maxWidth: 1920,
      );
      if (file != null) {
        setState(() { _imageFile = file; _rawText = null; _detectedPlate = null; _errorMsg = null; });
        await _runOcr(file);
      }
    } catch (e) {
      _setError('No se pudo acceder a la galería: $e');
    }
  }

  // ── Enviar imagen al endpoint OCR ────────────────────────────────────────
  Future<void> _runOcr(XFile file) async {
    setState(() { _loading = true; _errorMsg = null; });
    try {
      final dioClient = ref.read(dioClientProvider);
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(
          file.path,
          filename: file.name,
        ),
      });

      final response = await dioClient.dio.post(
        '${ApiConstants.baseUrl.replaceFirst('/api', '')}/api/ocr/placa',
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
          receiveTimeout: const Duration(seconds: 20),
        ),
      );

      final body = response.data;
      if (body is Map && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        setState(() {
          _rawText = data['raw'] as String? ?? '';
          _detectedPlate = data['plate'] as String?;
          _confidence = (data['confidence'] as num?)?.toDouble() ?? 0;
        });
      } else {
        final errMsg = (body is Map ? body['error'] : null) as String?;
        _setError(errMsg ?? 'No se pudo procesar la imagen');
      }
    } on DioException catch (e) {
      final errMsg = (e.response?.data is Map
          ? (e.response!.data as Map)['error']
          : null) as String?;
      _setError(errMsg ?? 'Error de red: ${e.message}');
    } catch (e) {
      _setError('Error inesperado: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _setError(String msg) {
    if (mounted) setState(() { _errorMsg = msg; _loading = false; });
  }

  void _usePlate() {
    if (_detectedPlate == null) return;
    context.push('/vehiculo-publico/$_detectedPlate');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text(
          'Escanear placa',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
        backgroundColor: AppColors.paper,
        foregroundColor: AppColors.ink9,
        elevation: 0,
        scrolledUnderElevation: 0.5,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Header kicker ────────────────────────────────────────────
            Text(
              'RF-17 · OCR DE PLACAS',
              style: AppTheme.inter(
                fontSize: 10.5, fontWeight: FontWeight.w700,
                color: AppColors.ink5, letterSpacing: 1.6,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Fotografía la placa del vehículo',
              style: AppTheme.inter(
                fontSize: 20, fontWeight: FontWeight.w700,
                color: AppColors.ink9, letterSpacing: -0.015,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'El sistema detectará automáticamente el número de placa. Asegúrate de que la imagen sea nítida y bien iluminada.',
              style: AppTheme.inter(fontSize: 13.5, color: AppColors.ink5, height: 1.5),
            ),
            const SizedBox(height: 24),

            // ── Botones de captura ────────────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: _ActionButton(
                    icon: Icons.camera_alt_outlined,
                    label: 'Cámara',
                    onTap: _loading ? null : _pickFromCamera,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.photo_library_outlined,
                    label: 'Galería',
                    onTap: _loading ? null : _pickFromGallery,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ── Preview de imagen ─────────────────────────────────────────
            if (_imageFile != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  File(_imageFile!.path),
                  height: 220,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Indicador de carga ────────────────────────────────────────
            if (_loading) ...[
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.ink2, width: 1.5),
                ),
                child: const Column(
                  children: [
                    CircularProgressIndicator(
                      color: AppColors.gold,
                      strokeWidth: 2.5,
                    ),
                    SizedBox(height: 14),
                    Text(
                      'Procesando imagen…',
                      style: TextStyle(
                        fontSize: 13.5, fontWeight: FontWeight.w500, color: AppColors.ink5,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Puede tomar hasta 15 segundos',
                      style: TextStyle(fontSize: 12, color: AppColors.ink4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Error ─────────────────────────────────────────────────────
            if (_errorMsg != null) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.noAptoBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.noAptoBorder, width: 1.5),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline, size: 18, color: AppColors.noApto),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _errorMsg!,
                        style: AppTheme.inter(fontSize: 13.5, color: AppColors.noApto, height: 1.45),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Resultado OCR ─────────────────────────────────────────────
            if (_rawText != null && !_loading) ...[
              // Placa detectada
              if (_detectedPlate != null) ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.aptoBorder, width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'PLACA DETECTADA',
                        style: AppTheme.inter(
                          fontSize: 10.5, fontWeight: FontWeight.w700,
                          color: AppColors.apto, letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                          decoration: BoxDecoration(
                            color: AppColors.ink9,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _detectedPlate!,
                            style: AppTheme.inter(
                              fontSize: 28, fontWeight: FontWeight.w800,
                              color: Colors.white, letterSpacing: 0.05, tabular: true,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Confianza
                      _ConfidenceBar(confidence: _confidence),
                      const SizedBox(height: 16),
                      // Botón usar placa
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _usePlate,
                          icon: const Icon(Icons.search, size: 18),
                          label: Text(
                            'Usar esta placa',
                            style: AppTheme.inter(fontSize: 14.5, fontWeight: FontWeight.w600, color: Colors.white),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.apto,
                            minimumSize: const Size(double.infinity, 48),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                // No se detectó placa
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.riesgoBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.riesgoBorder, width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning_amber_outlined, size: 18, color: AppColors.riesgo),
                          const SizedBox(width: 8),
                          Text(
                            'No se detectó placa',
                            style: AppTheme.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.riesgo),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Confianza insuficiente (${_confidence.toStringAsFixed(0)}%). Intenta con una imagen más nítida y con mejor iluminación.',
                        style: AppTheme.inter(fontSize: 13, color: AppColors.riesgo, height: 1.45),
                      ),
                    ],
                  ),
                ),
              ],

              // Texto crudo (colapsable)
              if (_rawText!.isNotEmpty) ...[
                const SizedBox(height: 12),
                _RawTextCard(raw: _rawText!),
              ],
            ],

            const SizedBox(height: 32),

            // ── Instrucciones ──────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.infoBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.infoBorder, width: 1.5),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Consejos para mejores resultados',
                    style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.info),
                  ),
                  const SizedBox(height: 8),
                  ...[
                    'Asegúrate de que la placa esté centrada y bien encuadrada.',
                    'Usa buena iluminación — evita sombras sobre la placa.',
                    'Toma la foto de frente, sin ángulo pronunciado.',
                    'Limpia la placa si está sucia o con barro.',
                  ].map((tip) => Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('•  ', style: AppTheme.inter(fontSize: 13, color: AppColors.info)),
                        Expanded(child: Text(tip, style: AppTheme.inter(fontSize: 13, color: AppColors.info, height: 1.4))),
                      ],
                    ),
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Widgets auxiliares ────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _ActionButton({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedOpacity(
        opacity: enabled ? 1 : 0.5,
        duration: const Duration(milliseconds: 150),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.ink2, width: 1.5),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color: AppColors.ink1,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 22, color: AppColors.ink7),
              ),
              const SizedBox(height: 10),
              Text(
                label,
                style: AppTheme.inter(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.ink9),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConfidenceBar extends StatelessWidget {
  final double confidence;
  const _ConfidenceBar({required this.confidence});

  @override
  Widget build(BuildContext context) {
    final color = confidence >= 80
        ? AppColors.apto
        : confidence >= 60
            ? AppColors.riesgo
            : AppColors.noApto;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Confianza OCR',
              style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.ink6),
            ),
            Text(
              '${confidence.toStringAsFixed(0)}%',
              style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w700, color: color, tabular: true),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: confidence / 100,
            minHeight: 6,
            backgroundColor: AppColors.ink1,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}

class _RawTextCard extends StatefulWidget {
  final String raw;
  const _RawTextCard({required this.raw});

  @override
  State<_RawTextCard> createState() => _RawTextCardState();
}

class _RawTextCardState extends State<_RawTextCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Text(
                    'Texto detectado (raw)',
                    style: AppTheme.inter(
                      fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.ink6,
                    ),
                  ),
                  const Spacer(),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: 16, color: AppColors.ink5,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Text(
                widget.raw.isEmpty ? '(sin texto)' : widget.raw,
                style: AppTheme.inter(
                  fontSize: 12, color: AppColors.ink7, height: 1.5,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
