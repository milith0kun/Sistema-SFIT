import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/inspection_api_service.dart';

/// Formulario para apelar una inspección rechazada u observada.
class NewAppealPage extends ConsumerStatefulWidget {
  final String inspectionId;

  const NewAppealPage({super.key, required this.inspectionId});

  @override
  ConsumerState<NewAppealPage> createState() => _NewAppealPageState();
}

class _NewAppealPageState extends ConsumerState<NewAppealPage> {
  final _reasonCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  List<XFile> _photos = [];
  bool _submitting = false;
  String? _successMessage;

  static const int _maxPhotos = 3;
  static const int _minReasonLength = 20;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    if (_photos.length >= _maxPhotos) {
      _showSnack('Máximo $_maxPhotos fotos permitidas', AppColors.riesgo);
      return;
    }
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 75,
        maxWidth: 1280,
      );
      if (file != null && mounted) {
        setState(() => _photos = [..._photos, file]);
      }
    } catch (e) {
      if (mounted) _showSnack('No se pudo seleccionar la imagen', AppColors.noApto);
    }
  }

  void _removePhoto(int index) {
    setState(() {
      final list = List<XFile>.from(_photos);
      list.removeAt(index);
      _photos = list;
    });
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);
    try {
      final svc = ref.read(inspectionApiServiceProvider);
      await svc.createAppeal(
        inspectionId: widget.inspectionId,
        reason: _reasonCtrl.text.trim(),
      );
      if (mounted) {
        setState(() {
          _successMessage =
              'Apelación enviada correctamente. Recibirás una respuesta pronto.';
          _submitting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        _showSnack('Error al enviar la apelación. Intenta de nuevo.',
            AppColors.noApto);
        setState(() => _submitting = false);
      }
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: color),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text(
          'Nueva apelación',
          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: _successMessage != null
          ? _SuccessView(
              message: _successMessage!,
              onClose: () => context.pop(),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Info inspección ───────────────────────────
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.riesgoBg,
                        border: Border.all(color: AppColors.riesgoBorder),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline,
                              size: 18, color: AppColors.riesgo),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Apelando inspección #${widget.inspectionId.length > 8 ? widget.inspectionId.substring(widget.inspectionId.length - 8) : widget.inspectionId}',
                              style: AppTheme.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.riesgo,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ── Motivo ────────────────────────────────────
                    Text(
                      'Motivo de apelación',
                      style: AppTheme.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink7,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _reasonCtrl,
                      maxLines: 5,
                      maxLength: 500,
                      decoration: InputDecoration(
                        hintText:
                            'Explica detalladamente el motivo de tu apelación...',
                        hintStyle: AppTheme.inter(
                            fontSize: 13, color: AppColors.ink4),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide:
                              const BorderSide(color: AppColors.ink3),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide:
                              const BorderSide(color: AppColors.ink3),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide:
                              const BorderSide(color: AppColors.panel, width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.all(14),
                        counterStyle:
                            AppTheme.inter(fontSize: 11, color: AppColors.ink4),
                      ),
                      style: AppTheme.inter(
                          fontSize: 14, color: AppColors.ink8),
                      validator: (v) {
                        if (v == null || v.trim().length < _minReasonLength) {
                          return 'El motivo debe tener al menos $_minReasonLength caracteres';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),

                    // ── Fotos adjuntas ────────────────────────────
                    Row(
                      children: [
                        Text(
                          'Fotos adjuntas',
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink7,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '(máx. $_maxPhotos)',
                          style: AppTheme.inter(
                              fontSize: 12, color: AppColors.ink4),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Grilla de fotos
                    if (_photos.isNotEmpty) ...[
                      SizedBox(
                        height: 100,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _photos.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 8),
                          itemBuilder: (_, i) => _PhotoThumb(
                            file: _photos[i],
                            onRemove: () => _removePhoto(i),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],

                    if (_photos.length < _maxPhotos)
                      OutlinedButton.icon(
                        onPressed: _pickPhoto,
                        icon: const Icon(Icons.add_photo_alternate_outlined,
                            size: 18, color: AppColors.ink6),
                        label: Text(
                          'Adjuntar foto',
                          style: AppTheme.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.ink6),
                        ),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 44),
                          side: const BorderSide(
                              color: AppColors.ink3, style: BorderStyle.solid),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                      ),

                    const SizedBox(height: 28),

                    // ── Botón enviar ──────────────────────────────
                    FilledButton(
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.panel,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      child: _submitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2),
                            )
                          : Text(
                              'Enviar apelación',
                              style: AppTheme.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

// ── Thumbnail de foto ─────────────────────────────────────────────────────────

class _PhotoThumb extends StatelessWidget {
  final XFile file;
  final VoidCallback onRemove;

  const _PhotoThumb({required this.file, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(
            File(file.path),
            width: 100,
            height: 100,
            fit: BoxFit.cover,
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black.withAlpha(160),
                shape: BoxShape.circle,
              ),
              padding: const EdgeInsets.all(3),
              child: const Icon(Icons.close, size: 14, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Vista de éxito ────────────────────────────────────────────────────────────

class _SuccessView extends StatelessWidget {
  final String message;
  final VoidCallback onClose;

  const _SuccessView({required this.message, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: AppColors.aptoBg,
                shape: BoxShape.circle,
              ),
              child:
                  const Icon(Icons.check_circle, size: 52, color: AppColors.apto),
            ),
            const SizedBox(height: 20),
            Text(
              'Apelación enviada',
              style: AppTheme.inter(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 14, color: AppColors.ink6),
            ),
            const SizedBox(height: 28),
            FilledButton(
              onPressed: onClose,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(200, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(
                'Volver',
                style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
