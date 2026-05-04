import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Subir foto del manifiesto firmado por los pasajeros — RF-09 (mobile).
class UploadManifestPhotoPage extends ConsumerStatefulWidget {
  final String tripId;
  const UploadManifestPhotoPage({super.key, required this.tripId});

  @override
  ConsumerState<UploadManifestPhotoPage> createState() =>
      _UploadManifestPhotoPageState();
}

class _UploadManifestPhotoPageState
    extends ConsumerState<UploadManifestPhotoPage> {
  final _picker = ImagePicker();
  bool _loading = true;
  bool _uploading = false;
  List<String> _photos = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      // El backend no expone un GET dedicado de fotos del manifiesto: el
      // listado vive en Trip.manifestPhotoUrls (Track A). Lo hidratamos desde
      // el detalle del viaje.
      final resp = await dio.get('/viajes/${widget.tripId}');
      final body = resp.data as Map?;
      final data = (body?['data'] as Map?) ?? body ?? const {};
      final list = (data['manifestPhotoUrls'] as List? ?? const [])
          .map((e) => e?.toString() ?? '')
          .where((s) => s.isNotEmpty)
          .toList();
      if (mounted) {
        setState(() {
          _photos = List<String>.from(list);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _photos = const [];
          _loading = false;
        });
      }
    }
  }

  Future<void> _pick(ImageSource src) async {
    if (_uploading) return;
    try {
      // image_picker comprime targetando ~maxWidth/Height; con jpegQuality 75
      // los manifiestos quedan en general < 1.5MB. Suficiente para legibilidad.
      final XFile? file = await _picker.pickImage(
        source: src,
        imageQuality: 75,
        maxWidth: 1800,
        maxHeight: 1800,
      );
      if (file == null) return;
      await _upload(file);
    } catch (e) {
      _snack('No se pudo abrir $e');
    }
  }

  Future<void> _upload(XFile file) async {
    setState(() => _uploading = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final bytes = await file.readAsBytes();
      final mp = MultipartFile.fromBytes(bytes, filename: file.name);
      // Backend Track A espera la key "file" (no "photo"); reescribe a webp
      // server-side y devuelve { url, id, manifestPhotoUrls }.
      final form = FormData.fromMap({'file': mp});
      await dio.post(
        '/viajes/${widget.tripId}/manifest-photo',
        data: form,
        options: Options(
          headers: {'Content-Type': 'multipart/form-data'},
        ),
      );
      _snack('Foto subida.');
      await _load();
    } catch (e) {
      _snack('No se pudo subir la foto: $e');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(m), behavior: SnackBarBehavior.floating),
    );
  }

  void _openFullscreen(String url) {
    showDialog(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(children: [
          Center(
            child: InteractiveViewer(
              maxScale: 5,
              child: CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.contain,
                progressIndicatorBuilder: (_, __, ___) => const Center(
                  child:
                      CircularProgressIndicator(color: AppColors.primary),
                ),
              ),
            ),
          ),
          Positioned(
            top: 12,
            right: 12,
            child: IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
            ),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Manifiesto firmado',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 100),
          children: [
            // Botones de acción
            Row(children: [
              Expanded(
                child: SizedBox(
                  height: 56,
                  child: FilledButton.icon(
                    onPressed: _uploading
                        ? null
                        : () => _pick(ImageSource.camera),
                    icon: const Icon(Icons.photo_camera, size: 18),
                    label: Text(
                      'Tomar foto',
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SizedBox(
                  height: 56,
                  child: OutlinedButton.icon(
                    onPressed: _uploading
                        ? null
                        : () => _pick(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined, size: 18),
                    label: Text(
                      'Galería',
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.ink8,
                      side: const BorderSide(color: AppColors.ink2),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
            if (_uploading) ...[
              const SizedBox(height: 14),
              Row(children: [
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  'Subiendo foto…',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink6),
                ),
              ]),
            ],
            const SizedBox(height: 22),
            Text(
              'Fotos subidas (${_photos.length})',
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.ink5,
                letterSpacing: 1.1,
              ),
            ),
            const SizedBox(height: 10),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 30),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (_photos.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: AppColors.ink2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(children: [
                  const Icon(
                    Icons.photo_outlined,
                    size: 36,
                    color: AppColors.ink4,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sin fotos todavía',
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink8,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Sube la foto del manifiesto firmado para tener evidencia.',
                    textAlign: TextAlign.center,
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                  ),
                ]),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _photos.length,
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 6,
                  mainAxisSpacing: 6,
                  childAspectRatio: 1,
                ),
                itemBuilder: (_, i) {
                  final url = _photos[i];
                  return InkWell(
                    onTap: () => _openFullscreen(url),
                    borderRadius: BorderRadius.circular(8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: url,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: AppColors.ink1,
                          child: const Center(
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: AppColors.ink1,
                          child: const Icon(
                            Icons.broken_image_outlined,
                            color: AppColors.ink4,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
