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

// ── Tipos de documento soportados ────────────────────────────────────────────

enum OcrDocType {
  dni,
  licencia,
  soat,
  tarjetaCirculacion,
}

extension OcrDocTypeX on OcrDocType {
  /// Valor que se envía en el campo `docType` del FormData.
  String get apiValue {
    switch (this) {
      case OcrDocType.dni:               return 'dni';
      case OcrDocType.licencia:          return 'licencia';
      case OcrDocType.soat:              return 'soat';
      case OcrDocType.tarjetaCirculacion: return 'tarjeta_circulacion';
    }
  }

  /// Etiqueta para el encabezado de la página.
  String get label {
    switch (this) {
      case OcrDocType.dni:               return 'DNI';
      case OcrDocType.licencia:          return 'Licencia de conducir';
      case OcrDocType.soat:              return 'SOAT';
      case OcrDocType.tarjetaCirculacion: return 'Tarjeta de circulación';
    }
  }

  /// Kicker corto en mayúsculas para el header de resultados.
  String get kicker {
    switch (this) {
      case OcrDocType.dni:               return 'DOCUMENTO DE IDENTIDAD';
      case OcrDocType.licencia:          return 'LICENCIA DE CONDUCIR';
      case OcrDocType.soat:              return 'SEGURO SOAT';
      case OcrDocType.tarjetaCirculacion: return 'TARJETA DE CIRCULACIÓN';
    }
  }

  /// Campos esperados para este tipo de documento.
  List<_FieldMeta> get expectedFields {
    switch (this) {
      case OcrDocType.dni:
        return [
          const _FieldMeta(key: 'nombre',          label: 'Nombre completo'),
          const _FieldMeta(key: 'numeroDocumento',  label: 'Nº de documento'),
          const _FieldMeta(key: 'fechaNacimiento',  label: 'Fecha de nacimiento'),
        ];
      case OcrDocType.licencia:
        return [
          const _FieldMeta(key: 'numeroLicencia',   label: 'Nº de licencia'),
          const _FieldMeta(key: 'categoria',         label: 'Categoría'),
          const _FieldMeta(key: 'fechaVencimiento',  label: 'Fecha de vencimiento'),
        ];
      case OcrDocType.soat:
        return [
          const _FieldMeta(key: 'numeroPoliza',     label: 'Nº de póliza'),
          const _FieldMeta(key: 'vigencia',         label: 'Vigencia'),
          const _FieldMeta(key: 'aseguradora',      label: 'Aseguradora'),
        ];
      case OcrDocType.tarjetaCirculacion:
        return [
          const _FieldMeta(key: 'placa',  label: 'Placa'),
          const _FieldMeta(key: 'marca',  label: 'Marca'),
          const _FieldMeta(key: 'modelo', label: 'Modelo'),
          const _FieldMeta(key: 'anio',   label: 'Año'),
        ];
    }
  }

  /// Consejos de captura específicos por tipo de documento.
  List<String> get tips {
    switch (this) {
      case OcrDocType.dni:
        return [
          'Coloca el DNI sobre una superficie plana y oscura.',
          'Asegúrate de que el nombre y número sean legibles.',
          'Evita reflejos — no uses flash directo.',
          'Encuadra todo el documento sin cortar bordes.',
        ];
      case OcrDocType.licencia:
        return [
          'Fotografía el lado frontal de la licencia.',
          'Incluye la categoría y fecha de vencimiento en el encuadre.',
          'Usa buena iluminación sin sombras sobre el texto.',
          'Mantén la cámara paralela al documento.',
        ];
      case OcrDocType.soat:
        return [
          'Fotografía la carátula del SOAT con todos los datos visibles.',
          'Asegúrate de que el número de póliza y vigencia sean nítidos.',
          'Evita doblar el documento antes de fotografiarlo.',
          'Usa luz natural siempre que sea posible.',
        ];
      case OcrDocType.tarjetaCirculacion:
        return [
          'Fotografía la tarjeta completa sin cortar bordes.',
          'La placa y el número de motor deben ser legibles.',
          'Evita brillos y reflejos sobre la tarjeta.',
          'Coloca el documento sobre una superficie plana.',
        ];
    }
  }
}

/// Metadato de un campo esperado.
class _FieldMeta {
  final String key;
  final String label;
  const _FieldMeta({required this.key, required this.label});
}

// ── Modelo de resultado de un campo ──────────────────────────────────────────

class _OcrField {
  final String key;
  final String label;
  final String value;
  final double confidence; // 0.0 – 1.0

  const _OcrField({
    required this.key,
    required this.label,
    required this.value,
    required this.confidence,
  });

  /// Nivel de confianza categorizado.
  _ConfidenceLevel get level {
    if (confidence >= 0.80) return _ConfidenceLevel.high;
    if (confidence >= 0.60) return _ConfidenceLevel.medium;
    return _ConfidenceLevel.low;
  }
}

enum _ConfidenceLevel { high, medium, low }

// ── Página principal ──────────────────────────────────────────────────────────

/// RF-17: OCR de documentos de conductor y vehículo.
///
/// Recibe un [docType] y permite al operador fotografiar o seleccionar
/// un documento. Envía la imagen a `POST /api/ocr/documento` junto con
/// el campo `docType`, muestra los campos extraídos con su nivel de
/// confianza y, al pulsar "Usar datos", regresa a la pantalla anterior
/// con un `Map<String, dynamic>` de los valores extraídos.
class DocumentOcrPage extends ConsumerStatefulWidget {
  final OcrDocType docType;

  const DocumentOcrPage({super.key, required this.docType});

  @override
  ConsumerState<DocumentOcrPage> createState() => _DocumentOcrPageState();
}

class _DocumentOcrPageState extends ConsumerState<DocumentOcrPage> {
  final _picker = ImagePicker();

  XFile? _imageFile;
  String? _rawText;
  List<_OcrField>? _fields;

  bool _loading = false;
  String? _errorMsg;

  // ── Captura de imagen ────────────────────────────────────────────────────

  Future<void> _pickFromCamera() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 90,
        maxWidth: 1920,
      );
      if (file != null) {
        setState(() {
          _imageFile = file;
          _rawText   = null;
          _fields    = null;
          _errorMsg  = null;
        });
        await _runOcr(file);
      }
    } catch (e) {
      _setError('No se pudo acceder a la cámara: $e');
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
        maxWidth: 1920,
      );
      if (file != null) {
        setState(() {
          _imageFile = file;
          _rawText   = null;
          _fields    = null;
          _errorMsg  = null;
        });
        await _runOcr(file);
      }
    } catch (e) {
      _setError('No se pudo acceder a la galería: $e');
    }
  }

  // ── Llamada al endpoint OCR ──────────────────────────────────────────────

  Future<void> _runOcr(XFile file) async {
    setState(() { _loading = true; _errorMsg = null; });
    try {
      final dioClient = ref.read(dioClientProvider);
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(
          file.path,
          filename: file.name,
        ),
        'docType': widget.docType.apiValue,
      });

      final response = await dioClient.dio.post(
        '${ApiConstants.baseUrl}/ocr/documento',
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
          receiveTimeout: const Duration(seconds: 30),
        ),
      );

      final body = response.data;

      // 501 → tesseract no instalado en el servidor
      if (response.statusCode == 501) {
        _setError(
          'El servicio OCR no está disponible en el servidor (tesseract no instalado). '
          'Contacta al administrador del sistema.',
        );
        return;
      }

      if (body is Map && body['success'] == true) {
        final data   = body['data'] as Map<String, dynamic>;
        final rawStr = data['raw'] as String? ?? '';
        final rawFields = data['fields'] as Map<String, dynamic>? ?? {};

        final fields = _parseFields(rawFields);

        setState(() {
          _rawText = rawStr;
          _fields  = fields;
        });
      } else {
        final errMsg = (body is Map ? body['error'] : null) as String?;
        _setError(errMsg ?? 'No se pudo procesar la imagen');
      }
    } on DioException catch (e) {
      // 501 puede llegar como DioException si validateStatus no lo acepta
      if (e.response?.statusCode == 501) {
        _setError(
          'El servicio OCR no está disponible en el servidor (tesseract no instalado).',
        );
        return;
      }
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

  /// Convierte el mapa de campos del backend en [_OcrField] para todos
  /// los campos esperados del documento. Si el backend no devuelve un campo,
  /// se construye con valor vacío y confianza baja.
  List<_OcrField> _parseFields(Map<String, dynamic> rawFields) {
    return widget.docType.expectedFields.map((meta) {
      final entry = rawFields[meta.key];
      if (entry == null) {
        return _OcrField(key: meta.key, label: meta.label, value: '', confidence: 0.30);
      }
      if (entry is Map<String, dynamic>) {
        final value      = (entry['value'] as String?) ?? '';
        final rawConf    = (entry['confidence'] as num?)?.toDouble();
        final confidence = rawConf ?? (value.isNotEmpty ? 0.85 : 0.30);
        return _OcrField(key: meta.key, label: meta.label, value: value, confidence: confidence);
      }
      // El campo es un String directo (backend simplificado)
      final value = entry.toString();
      return _OcrField(
        key: meta.key, label: meta.label,
        value: value,
        confidence: value.isNotEmpty ? 0.85 : 0.30,
      );
    }).toList();
  }

  void _setError(String msg) {
    if (mounted) setState(() { _errorMsg = msg; _loading = false; });
  }

  // ── Acción "Usar datos" ──────────────────────────────────────────────────

  void _useData() {
    if (_fields == null) return;
    final result = <String, dynamic>{
      for (final f in _fields!) f.key: f.value,
    };
    context.pop(result);
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final hasResults = _fields != null && !_loading;
    final hasUsableData = hasResults && _fields!.any((f) => f.value.isNotEmpty);

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text(
          'OCR · ${widget.docType.label}',
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
              'RF-17 · OCR DE DOCUMENTOS',
              style: AppTheme.inter(
                fontSize: 10.5, fontWeight: FontWeight.w700,
                color: AppColors.ink5, letterSpacing: 1.6,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Escanear ${widget.docType.label}',
              style: AppTheme.inter(
                fontSize: 20, fontWeight: FontWeight.w700,
                color: AppColors.ink9, letterSpacing: -0.015,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Toma una foto o selecciona una imagen del documento. '
              'El sistema extraerá los datos automáticamente.',
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
                padding: const EdgeInsets.symmetric(vertical: 28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.ink2, width: 1.5),
                ),
                child: Column(
                  children: [
                    const CircularProgressIndicator(
                      color: AppColors.gold,
                      strokeWidth: 2.5,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Procesando documento…',
                      style: AppTheme.inter(
                        fontSize: 13.5, fontWeight: FontWeight.w500, color: AppColors.ink5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Puede tomar hasta 30 segundos',
                      style: AppTheme.inter(fontSize: 12, color: AppColors.ink4),
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
                        style: AppTheme.inter(
                          fontSize: 13.5, color: AppColors.noApto, height: 1.45,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Resultados OCR ────────────────────────────────────────────
            if (hasResults) ...[
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: hasUsableData ? AppColors.aptoBorder : AppColors.riesgoBorder,
                    width: 1.5,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Kicker de resultados
                    Row(
                      children: [
                        Icon(
                          hasUsableData
                              ? Icons.check_circle_outline
                              : Icons.warning_amber_outlined,
                          size: 16,
                          color: hasUsableData ? AppColors.apto : AppColors.riesgo,
                        ),
                        const SizedBox(width: 7),
                        Text(
                          widget.docType.kicker,
                          style: AppTheme.inter(
                            fontSize: 10.5, fontWeight: FontWeight.w700,
                            color: hasUsableData ? AppColors.apto : AppColors.riesgo,
                            letterSpacing: 1.4,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Campos extraídos
                    ...List.generate(_fields!.length, (i) {
                      final field = _fields![i];
                      return Padding(
                        padding: EdgeInsets.only(bottom: i < _fields!.length - 1 ? 12 : 0),
                        child: _FieldRow(field: field),
                      );
                    }),

                    // Botón "Usar datos"
                    if (hasUsableData) ...[
                      const SizedBox(height: 18),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _useData,
                          icon: const Icon(Icons.check_rounded, size: 18),
                          label: Text(
                            'Usar datos',
                            style: AppTheme.inter(
                              fontSize: 14.5, fontWeight: FontWeight.w600, color: Colors.white,
                            ),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.apto,
                            minimumSize: const Size(double.infinity, 48),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                    ] else ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.riesgoBg,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.riesgoBorder),
                        ),
                        child: Text(
                          'No se pudo extraer ningún dato. '
                          'Intenta con una imagen más nítida y mejor iluminada.',
                          style: AppTheme.inter(
                            fontSize: 13, color: AppColors.riesgo, height: 1.45,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Texto crudo (colapsable)
              if (_rawText != null && _rawText!.isNotEmpty)
                _RawTextCard(raw: _rawText!),
            ],

            const SizedBox(height: 32),

            // ── Consejos ───────────────────────────────────────────────────
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
                    style: AppTheme.inter(
                      fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.info,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...widget.docType.tips.map((tip) => Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('•  ', style: AppTheme.inter(fontSize: 13, color: AppColors.info)),
                        Expanded(
                          child: Text(
                            tip,
                            style: AppTheme.inter(fontSize: 13, color: AppColors.info, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  )),
                ],
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// ── Widgets auxiliares ────────────────────────────────────────────────────────

/// Botón de acción (cámara / galería) — mismo estilo que plate_scanner_page.
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
                style: AppTheme.inter(
                  fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.ink9,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fila de campo extraído con indicador de confianza coloreado.
class _FieldRow extends StatelessWidget {
  final _OcrField field;
  const _FieldRow({required this.field});

  Color get _color {
    switch (field.level) {
      case _ConfidenceLevel.high:   return AppColors.apto;
      case _ConfidenceLevel.medium: return AppColors.riesgo;
      case _ConfidenceLevel.low:    return AppColors.noApto;
    }
  }

  Color get _bgColor {
    switch (field.level) {
      case _ConfidenceLevel.high:   return AppColors.aptoBg;
      case _ConfidenceLevel.medium: return AppColors.riesgoBg;
      case _ConfidenceLevel.low:    return AppColors.noAptoBg;
    }
  }

  Color get _borderColor {
    switch (field.level) {
      case _ConfidenceLevel.high:   return AppColors.aptoBorder;
      case _ConfidenceLevel.medium: return AppColors.riesgoBorder;
      case _ConfidenceLevel.low:    return AppColors.noAptoBorder;
    }
  }

  String get _confidenceLabel {
    final pct = (field.confidence * 100).toStringAsFixed(0);
    switch (field.level) {
      case _ConfidenceLevel.high:   return '$pct% — Alta';
      case _ConfidenceLevel.medium: return '$pct% — Media';
      case _ConfidenceLevel.low:    return '$pct% — Baja';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: _bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _borderColor, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Punto de confianza
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Container(
              width: 8, height: 8,
              decoration: BoxDecoration(
                color: _color,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  field.label,
                  style: AppTheme.inter(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: _color, letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  field.value.isNotEmpty ? field.value : '—',
                  style: AppTheme.inter(
                    fontSize: 14.5, fontWeight: FontWeight.w600,
                    color: field.value.isNotEmpty ? AppColors.ink9 : AppColors.ink4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Badge de confianza
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: _borderColor),
            ),
            child: Text(
              _confidenceLabel,
              style: AppTheme.inter(
                fontSize: 10.5, fontWeight: FontWeight.w600,
                color: _color, tabular: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sección colapsable con el texto crudo devuelto por el backend.
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
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink7, height: 1.5),
              ),
            ),
        ],
      ),
    );
  }
}
