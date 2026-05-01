import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart' show DioException, DioExceptionType, FormData, MultipartFile;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/navigation/navigation_key.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/reports_api_service.dart';
import '../../data/models/report_model.dart';

/// Formulario de envío de reporte ciudadano — RF-12.
class SubmitReportPage extends ConsumerStatefulWidget {
  final String? vehiclePlate;
  final Map<String, dynamic>? vehicleData;
  const SubmitReportPage({super.key, this.vehiclePlate, this.vehicleData});

  @override
  ConsumerState<SubmitReportPage> createState() => _SubmitReportPageState();
}

class _SubmitReportPageState extends ConsumerState<SubmitReportPage> {
  // ── Búsqueda de vehículo ─────────────────────────────────────────
  final _plateCtrl = TextEditingController();
  bool _searching = false;
  Map<String, dynamic>? _foundVehicle;
  String? _searchError;

  // ── Formulario ───────────────────────────────────────────────────
  String? _selectedCategory;
  String? _suggestedCategory;
  final _descCtrl = TextEditingController();

  // ── Geolocalización ──────────────────────────────────────────────
  Position? _userPosition;
  LatLng? _selectedLatLng;
  bool _locationLoading = false;
  String? _locationError;

  // ── Fotos ────────────────────────────────────────────────────────
  final _imagePicker = ImagePicker();
  final List<XFile> _selectedImages = [];
  bool _uploadingImages = false;

  // ── Envío ────────────────────────────────────────────────────────
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.vehicleData != null) {
      _foundVehicle = widget.vehicleData;
      if (widget.vehiclePlate != null) _plateCtrl.text = widget.vehiclePlate!;
      WidgetsBinding.instance.addPostFrameCallback((_) => _captureLocation());
    }
  }

  @override
  void dispose() {
    _plateCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  // ── GPS ──────────────────────────────────────────────────────────
  /// Estrategia híbrida para que el mapa aparezca de inmediato:
  /// 1. Pedir permisos (rápido si ya están concedidos).
  /// 2. Mostrar `getLastKnownPosition()` — caché del SO, instantáneo.
  /// 3. Lanzar `getCurrentPosition()` en background con timeout corto
  ///    para refinar la coordenada cuando llegue.
  Future<void> _captureLocation() async {
    setState(() { _locationLoading = true; _locationError = null; });
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
        if (perm == LocationPermission.denied) {
          if (mounted) setState(() { _locationError = 'Permiso denegado'; _locationLoading = false; });
          return;
        }
      }
      if (perm == LocationPermission.deniedForever) {
        if (mounted) setState(() { _locationError = 'Permiso bloqueado. Habilítalo en ajustes.'; _locationLoading = false; });
        return;
      }

      // Paso rápido: última ubicación conocida (instantáneo, viene de caché del SO)
      final cached = await Geolocator.getLastKnownPosition();
      if (cached != null && mounted) {
        setState(() {
          _userPosition = cached;
          _selectedLatLng ??= LatLng(cached.latitude, cached.longitude);
          _locationLoading = false;
        });
      }

      // Paso preciso: ubicación actual (en background, timeout corto)
      final fresh = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      if (mounted) {
        setState(() {
          _userPosition = fresh;
          // Solo actualizamos el marcador si el usuario no lo movió manualmente.
          if (cached == null) {
            _selectedLatLng ??= LatLng(fresh.latitude, fresh.longitude);
          }
          _locationLoading = false;
        });
      }
    } on TimeoutException {
      // Si el preciso falló pero ya tenemos cached, ignoramos el timeout.
      if (mounted && _userPosition == null) {
        setState(() { _locationError = 'Tiempo agotado'; _locationLoading = false; });
      } else if (mounted) {
        setState(() => _locationLoading = false);
      }
    } catch (e) {
      if (mounted && _userPosition == null) {
        setState(() { _locationError = 'No se pudo obtener la ubicación'; _locationLoading = false; });
      } else if (mounted) {
        setState(() => _locationLoading = false);
      }
    }
  }

  // ── Búsqueda por placa ───────────────────────────────────────────
  /// Formatos de placa peruana aceptados:
  /// - Autos: ABC-123 o ABC123 (3 letras + 3 dígitos)
  /// - Motos antiguas: A1B-234 o A1B234
  /// - Categorías especiales: AB-1234 o AB1234
  static final _plateRegex = RegExp(
    r'^([A-Z]{3}-?\d{3}|[A-Z]\d[A-Z]-?\d{3}|[A-Z]{2}-?\d{4})$',
  );

  Future<void> _searchVehicle() async {
    final plate = _plateCtrl.text.trim().toUpperCase();
    if (plate.isEmpty) {
      setState(() => _searchError = 'Ingresa una placa');
      return;
    }
    if (!_plateRegex.hasMatch(plate)) {
      setState(() => _searchError = 'Formato de placa inválido (ej: ABC-123)');
      return;
    }
    setState(() { _searching = true; _searchError = null; _foundVehicle = null; _selectedCategory = null; _descCtrl.clear(); });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/public/vehiculo', queryParameters: {'plate': plate});
      final body = resp.data as Map;
      if (body['success'] == true) {
        // El endpoint devuelve { qrSignatureValid, vehicle: {...}, driver: {...} }.
        // _foundVehicle espera estructura plana del vehículo (plate, brand, etc.)
        // — misma forma que se pasa desde la vista pública del QR.
        final data = body['data'] as Map<String, dynamic>;
        final vehicle = (data['vehicle'] as Map<String, dynamic>?) ?? data;
        if (mounted) {
          setState(() { _foundVehicle = vehicle; _searching = false; _userPosition = null; _selectedLatLng = null; _locationError = null; });
          _captureLocation();
        }
      } else {
        if (mounted) setState(() { _searchError = (body['error'] as String?) ?? 'Vehículo no encontrado'; _searching = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _searchError = 'Vehículo no encontrado'; _searching = false; });
    }
  }

  // ── Fotos ────────────────────────────────────────────────────────
  // Comprime y redimensiona en cliente antes de subir. El servidor luego
  // convierte a WebP (ver /api/uploads/reports), pero comprimir aquí reduce
  // el ancho de banda y la latencia de subida en redes móviles lentas.
  static const double _kMaxImageDim = 1920;
  static const int _kImageQuality = 80;

  Future<void> _pickFromGallery() async {
    if (_selectedImages.length >= 3) return;
    final remaining = 3 - _selectedImages.length;
    try {
      final picked = await _imagePicker.pickMultiImage(
        imageQuality: _kImageQuality,
        maxWidth: _kMaxImageDim,
        maxHeight: _kMaxImageDim,
        limit: remaining,
      );
      if (picked.isNotEmpty && mounted) {
        setState(() => _selectedImages.addAll(picked.take(remaining)));
      }
    } catch (e) {
      debugPrint('gallery pick error: $e');
      if (mounted) _showError('No se pudo abrir la galería. Verifica los permisos en ajustes.');
    }
  }

  Future<void> _pickFromCamera() async {
    if (_selectedImages.length >= 3) return;
    try {
      final picked = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: _kImageQuality,
        maxWidth: _kMaxImageDim,
        maxHeight: _kMaxImageDim,
      );
      if (picked != null && mounted) setState(() => _selectedImages.add(picked));
    } catch (e) {
      debugPrint('camera pick error: $e');
      if (mounted) _showError('No se pudo abrir la cámara. Verifica los permisos en ajustes.');
    }
  }

  void _removeImage(int index) => setState(() => _selectedImages.removeAt(index));

  /// Sube las imágenes recibidas y devuelve `urls` exitosas + `failed` con
  /// los `XFile` que fallaron junto al mensaje legible. Loggea cada error
  /// con `debugPrint` para que sea visible en `flutter logs`.
  Future<_UploadResult> _uploadImages(List<XFile> images) async {
    final urls = <String>[];
    final failed = <_UploadFailure>[];
    final dio = ref.read(dioClientProvider).dio;
    for (final img in images) {
      try {
        final bytes = await img.readAsBytes();
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(bytes, filename: img.name),
        });
        final resp = await dio.post('/uploads/reports', data: formData);
        final data = (resp.data as Map)['data'];
        final url = data is Map ? data['url'] as String? : null;
        if (url != null) {
          urls.add(url);
        } else {
          debugPrint('upload error: respuesta sin url para ${img.name}: ${resp.data}');
          failed.add(_UploadFailure(file: img, message: 'Respuesta inesperada del servidor'));
        }
      } on DioException catch (e) {
        final status = e.response?.statusCode;
        final msg = _readableUploadError(e);
        debugPrint('upload error [${img.name}] ($status): ${e.message}');
        failed.add(_UploadFailure(file: img, message: msg));
      } catch (e) {
        debugPrint('upload error [${img.name}]: $e');
        failed.add(_UploadFailure(file: img, message: 'No se pudo subir la foto'));
      }
    }
    return _UploadResult(urls: urls, failed: failed);
  }

  String _readableUploadError(DioException e) {
    final status = e.response?.statusCode;
    if (status == 401 || status == 403) return 'Sesión expirada — vuelve a iniciar sesión';
    if (status == 413) return 'La foto es demasiado pesada (máx. 5 MB)';
    if (status == 415) return 'Formato no permitido (JPG, PNG o WebP)';
    if (status != null && status >= 500) return 'Error del servidor — intenta de nuevo';
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'La conexión tardó demasiado';
    }
    return 'No se pudo subir la foto';
  }

  /// Si hubo fallos en la subida, ofrece al usuario reintentar, continuar
  /// o cancelar el envío. Devuelve el resultado final aceptado.
  Future<_UploadResult?> _resolveUploadFailures(_UploadResult initial) async {
    var current = initial;
    while (current.failed.isNotEmpty && mounted) {
      if (!mounted) return null;
      final action = await showDialog<_UploadFailureAction>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => _UploadFailureDialog(failed: current.failed),
      );
      if (action == null || action == _UploadFailureAction.cancel) return null;
      if (action == _UploadFailureAction.continueWithout) return current;
      // Reintento: solo las que fallaron antes
      if (!mounted) return null;
      setState(() => _uploadingImages = true);
      final retry = await _uploadImages(current.failed.map((f) => f.file).toList());
      if (!mounted) return null;
      setState(() => _uploadingImages = false);
      current = _UploadResult(
        urls: [...current.urls, ...retry.urls],
        failed: retry.failed,
      );
    }
    return current;
  }

  // ── Envío ────────────────────────────────────────────────────────
  Future<void> _submitReport() async {
    if (_foundVehicle == null) return;
    if (_selectedCategory == null) { _showError('Selecciona una categoría'); return; }
    final desc = _descCtrl.text.trim();
    if (desc.length < 10) { _showError('La descripción debe tener al menos 10 caracteres'); return; }

    setState(() => _submitting = true);
    try {
      List<String> imageUrls = [];
      if (_selectedImages.isNotEmpty) {
        setState(() => _uploadingImages = true);
        final result = await _uploadImages(_selectedImages);
        if (mounted) setState(() => _uploadingImages = false);

        if (result.failed.isNotEmpty) {
          final resolved = await _resolveUploadFailures(result);
          if (resolved == null) {
            // Usuario canceló el envío
            if (mounted) setState(() { _submitting = false; });
            return;
          }
          imageUrls = resolved.urls;
        } else {
          imageUrls = result.urls;
        }
      }

      final svc = ref.read(reportsApiServiceProvider);
      final plate = (_foundVehicle!['plate'] as String?) ?? _plateCtrl.text.trim().toUpperCase();
      await svc.submitReport(
        vehiclePlate: plate,
        category: _selectedCategory!,
        description: desc,
        vehicleTypeKey: _foundVehicle!['vehicleTypeKey'] as String?,
        latitude: _selectedLatLng?.latitude,
        longitude: _selectedLatLng?.longitude,
        imageUrls: imageUrls.isEmpty ? null : imageUrls,
      );

      if (!mounted) return;
      setState(() => _submitting = false);
      _onSubmitSuccess();
    } on ReportSubmitException catch (e) {
      debugPrint('submit report error (${e.statusCode}): ${e.message}');
      if (mounted) setState(() { _submitting = false; _uploadingImages = false; });
      // 429 = rate limit alcanzado → diálogo modal claro y bloqueante.
      // Otros errores → snackbar inline (no interrumpe).
      if (e.statusCode == 429 && mounted) {
        await showDialog<void>(
          context: context,
          builder: (_) => _RateLimitDialog(message: e.message),
        );
      } else {
        _showError(e.message);
      }
    } catch (e) {
      debugPrint('submit report error: $e');
      if (mounted) setState(() { _submitting = false; _uploadingImages = false; });
      _showError('No se pudo enviar el reporte. Intenta de nuevo.');
    }
  }

  /// Tras enviar el reporte, navega de forma útil:
  /// - Si la página fue empujada como ruta (vino desde vista pública del
  ///   vehículo), regresa a la pantalla anterior.
  /// - Si está montada como tab del HomePage, salta al tab "Mis reportes"
  ///   donde el usuario ve el reporte recién creado.
  /// En ambos casos muestra un snackbar de confirmación.
  void _onSubmitSuccess() {
    _resetForm();
    showAppSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '¡Reporte enviado! Será revisado por un fiscal.',
                style: AppTheme.inter(fontSize: 13.5, color: Colors.white, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.apto,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/home?tab=mis-reportes');
    }
  }

  // ── Sugerencia de categoría ──────────────────────────────────────
  void _inferCategory() {
    final text = _descCtrl.text.toLowerCase();
    if (text.length < 15) { if (_suggestedCategory != null) setState(() => _suggestedCategory = null); return; }
    const kw = {
      'Conducción peligrosa':  ['peligros', 'maniobra', 'frenaz', 'adelant', 'semáforo'],
      'Exceso de velocidad':   ['velocidad', 'rápido', 'rapido', 'acelerado'],
      'Cobro indebido':        ['cobro', 'precio', 'tarifa', 'excesivo', 'caro'],
      'Vehículo en mal estado':['mal estado', 'roto', 'humo', 'ruido', 'llanta', 'freno', 'avería'],
    };
    String? best; int bestCount = 0;
    for (final e in kw.entries) {
      final c = e.value.where((k) => text.contains(k)).length;
      if (c > bestCount) { bestCount = c; best = e.key; }
    }
    final suggested = bestCount > 0 ? best : null;
    if (suggested != _suggestedCategory) setState(() => _suggestedCategory = suggested);
  }

  void _showError(String msg) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(msg), backgroundColor: AppColors.noApto, behavior: SnackBarBehavior.floating),
  );

  /// Limpia el formulario tras un envío exitoso para dejarlo listo para el
  /// siguiente reporte. La navegación la hace `_onSubmitSuccess`.
  void _resetForm() {
    _plateCtrl.clear();
    _descCtrl.clear();
    _selectedImages.clear();
    setState(() {
      _foundVehicle = null;
      _searchError = null;
      _selectedCategory = null;
      _suggestedCategory = null;
      _userPosition = null;
      _selectedLatLng = null;
      _locationError = null;
      _submitting = false;
      _uploadingImages = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final String submitLabel = _uploadingImages
        ? 'Subiendo fotos...'
        : _submitting ? 'Enviando...' : 'Enviar reporte';

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: const Text('Enviar reporte'),
        backgroundColor: AppColors.paper,
        foregroundColor: AppColors.ink9,
        elevation: 0,
        scrolledUnderElevation: 0.5,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Kicker + título ──────────────────────────────────
              _Kicker(),
              const SizedBox(height: 8),
              Text(
                'Reportar vehículo',
                style: AppTheme.inter(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.ink9, letterSpacing: -0.5),
              ),
              const SizedBox(height: 4),
              Text(
                widget.vehicleData != null
                    ? 'Vehículo identificado. Completa el detalle del reporte.'
                    : 'Busca el vehículo por placa y completa el formulario.',
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5, height: 1.4),
              ),
              const SizedBox(height: 28),

              // ── Búsqueda (si no viene pre-llenado) ──────────────
              if (widget.vehicleData == null) ...[
                const _SectionLabel('Buscar vehículo'),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _plateCtrl,
                        textCapitalization: TextCapitalization.characters,
                        textInputAction: TextInputAction.search,
                        onFieldSubmitted: (_) => _searchVehicle(),
                        decoration: const InputDecoration(
                          hintText: 'Ej. ABC-123',
                          prefixIcon: Icon(Icons.search, size: 20, color: AppColors.ink4),
                        ),
                        style: AppTheme.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.ink9, tabular: true),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      height: 50,
                      child: FilledButton(
                        onPressed: _searching ? null : _searchVehicle,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(82, 50),
                          backgroundColor: AppColors.ink9,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: _searching
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text('Buscar', style: AppTheme.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                      ),
                    ),
                  ],
                ),
                if (_searchError != null) ...[
                  const SizedBox(height: 10),
                  _InlineError(_searchError!),
                ],
                const SizedBox(height: 24),
              ],

              // ── Vehículo encontrado ──────────────────────────────
              if (_foundVehicle != null) ...[
                const _SectionLabel('Vehículo'),
                const SizedBox(height: 8),
                _VehicleMiniCard(vehicle: _foundVehicle!),
                const SizedBox(height: 24),

                // ── Mapa / ubicación ─────────────────────────────
                const _SectionLabel('Ubicación'),
                const SizedBox(height: 8),
                _LocationSection(
                  loading: _locationLoading,
                  position: _userPosition,
                  initialLatLng: _selectedLatLng,
                  error: _locationError,
                  onRetry: _captureLocation,
                  onLocationChanged: (latLng) => setState(() => _selectedLatLng = latLng),
                ),
                const SizedBox(height: 24),

                // ── Evidencias fotográficas ──────────────────────
                const _SectionLabel('Evidencias fotográficas'),
                const SizedBox(height: 4),
                Text(
                  'Hasta 3 fotos del incidente (opcional)',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink4),
                ),
                const SizedBox(height: 10),
                _PhotoPickerSection(
                  images: _selectedImages,
                  onPickGallery: _pickFromGallery,
                  onPickCamera: _pickFromCamera,
                  onRemove: _removeImage,
                ),
                const SizedBox(height: 24),

                // ── Categoría ────────────────────────────────────
                const _SectionLabel('Categoría'),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey(_selectedCategory),
                  initialValue: _selectedCategory,
                  items: kReportCategories
                      .map((cat) => DropdownMenuItem(
                            value: cat,
                            child: Text(cat, style: AppTheme.inter(fontSize: 14, color: AppColors.ink8)),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedCategory = v),
                  hint: Text('Selecciona una categoría', style: AppTheme.inter(fontSize: 14, color: AppColors.ink4)),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.ink2, width: 1.5)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.ink2, width: 1.5)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.ink9, width: 1.5)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  ),
                  style: AppTheme.inter(fontSize: 14, color: AppColors.ink8),
                  dropdownColor: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                ),
                const SizedBox(height: 20),

                // ── Descripción ──────────────────────────────────
                const _SectionLabel('Descripción'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _descCtrl,
                  maxLines: 5,
                  maxLength: 500,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    hintText: 'Describe el incidente con detalle (mín. 10 caracteres)...',
                    alignLabelWithHint: true,
                  ),
                  onChanged: (_) { setState(() {}); _inferCategory(); },
                ),

                if (_descCtrl.text.isNotEmpty && _descCtrl.text.trim().length < 10)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      'Mínimo 10 caracteres (${_descCtrl.text.trim().length}/10)',
                      style: AppTheme.inter(fontSize: 12, color: AppColors.noApto),
                    ),
                  ),

                if (_suggestedCategory != null && _selectedCategory == null) ...[
                  const SizedBox(height: 10),
                  _AISuggestionChip(
                    category: _suggestedCategory!,
                    onAccept: () => setState(() { _selectedCategory = _suggestedCategory; _suggestedCategory = null; }),
                    onDismiss: () => setState(() => _suggestedCategory = null),
                  ),
                ],

                const SizedBox(height: 20),

                // ── Advertencia suave si no hay fotos ───────────
                if (_selectedImages.isEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.infoBg,
                      border: Border.all(color: AppColors.infoBorder),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.lightbulb_outline_rounded, size: 16, color: AppColors.info),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Los reportes con evidencia fotográfica se validan más rápido.',
                            style: AppTheme.inter(fontSize: 12, color: AppColors.info, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // ── Botón enviar ─────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton.icon(
                    onPressed: (_submitting || _uploadingImages) ? null : _submitReport,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ink9,
                      disabledBackgroundColor: AppColors.ink3,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: (_submitting || _uploadingImages)
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.send_rounded, size: 18),
                    label: Text(
                      submitLabel,
                      style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    'Tu reporte será revisado por un fiscal asignado.',
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink4),
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

// ── Mapa de ubicación ─────────────────────────────────────────────────────────
class _LocationSection extends StatefulWidget {
  final bool loading;
  final Position? position;
  final LatLng? initialLatLng;
  final String? error;
  final VoidCallback onRetry;
  final ValueChanged<LatLng> onLocationChanged;

  const _LocationSection({
    required this.loading,
    required this.position,
    required this.initialLatLng,
    required this.error,
    required this.onRetry,
    required this.onLocationChanged,
  });

  @override
  State<_LocationSection> createState() => _LocationSectionState();
}

class _LocationSectionState extends State<_LocationSection> {
  LatLng? _marker;

  @override
  void didUpdateWidget(_LocationSection old) {
    super.didUpdateWidget(old);
    if (old.initialLatLng == null && widget.initialLatLng != null) {
      _marker = widget.initialLatLng;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Si no hay posición todavía y estamos cargando, mostrar skeleton del
    // mapa en lugar del banner — mismo alto, transición sin saltos.
    if (widget.loading && widget.position == null) {
      return _MapSkeleton();
    }

    if (widget.error != null && widget.position == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.riesgoBg,
          border: Border.all(color: AppColors.riesgoBorder),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_off_rounded, size: 16, color: AppColors.riesgo),
            const SizedBox(width: 8),
            Expanded(
              child: Text('${widget.error} — el reporte se enviará sin ubicación.',
                  style: AppTheme.inter(fontSize: 12.5, color: AppColors.riesgo)),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: widget.onRetry,
              child: Text('Reintentar', style: AppTheme.inter(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.riesgo)),
            ),
          ],
        ),
      );
    }

    final pos = widget.position;
    if (pos == null) return const SizedBox.shrink();

    final marker = _marker ?? LatLng(pos.latitude, pos.longitude);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Mini mapa interactivo
        Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: 210,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: marker,
                    initialZoom: 15.5,
                    onTap: (_, point) {
                      setState(() => _marker = point);
                      widget.onLocationChanged(point);
                    },
                  ),
                  children: [
                    // Tiles CartoDB Voyager — más limpios que OSM crudo,
                    // sin clutter de POIs y con paleta sobria.
                    TileLayer(
                      urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                      subdomains: const ['a', 'b', 'c', 'd'],
                      userAgentPackageName: 'com.sfit.app',
                      maxZoom: 19,
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: marker,
                          width: 48,
                          height: 56,
                          alignment: Alignment.topCenter,
                          child: _SfitMapPin(),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            // Indicador "Refinando GPS..." cuando ya hay marker pero
            // sigue cargando una posición más precisa
            if (widget.loading)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4, offset: const Offset(0, 1)),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(width: 10, height: 10, child: CircularProgressIndicator(strokeWidth: 1.4, color: AppColors.info)),
                      const SizedBox(width: 6),
                      Text('Refinando GPS', style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.info)),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        // Coordenadas + instrucción + link
        Row(
          children: [
            const Icon(Icons.location_on_rounded, size: 13, color: AppColors.info),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                '${marker.latitude.toStringAsFixed(5)}, ${marker.longitude.toStringAsFixed(5)}',
                style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5, tabular: true),
              ),
            ),
            GestureDetector(
              onTap: () async {
                final url = Uri.parse('https://www.google.com/maps?q=${marker.latitude},${marker.longitude}');
                if (await canLaunchUrl(url)) await launchUrl(url, mode: LaunchMode.externalApplication);
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.open_in_new_rounded, size: 12, color: AppColors.info),
                  const SizedBox(width: 3),
                  Text('Ver en Maps', style: AppTheme.inter(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.info)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('Toca el mapa para ajustar la ubicación exacta.', style: AppTheme.inter(fontSize: 11, color: AppColors.ink4)),
      ],
    );
  }
}

// ── Diálogo modal cuando el ciudadano alcanza el límite diario ───────────────
class _RateLimitDialog extends StatelessWidget {
  final String message;
  const _RateLimitDialog({required this.message});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      title: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.riesgoBg,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.timer_outlined, color: AppColors.riesgo, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Llegaste al límite de hoy',
              style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message,
            style: AppTheme.inter(fontSize: 13.5, color: AppColors.ink7, height: 1.5),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.infoBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.infoBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, size: 14, color: AppColors.info),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'El contador se reinicia mañana. Tus reportes ya están en revisión.',
                    style: AppTheme.inter(fontSize: 12, color: AppColors.info, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.ink9,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Text(
            'Entendido',
            style: AppTheme.inter(fontSize: 13.5, color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

// ── Skeleton del mapa mientras carga el GPS ──────────────────────────────────
class _MapSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 210,
        color: AppColors.ink1,
        child: Stack(
          children: [
            // Patrón sutil de cuadrícula simulando tiles
            Positioned.fill(
              child: CustomPaint(painter: _GridPainter()),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.info)),
                  const SizedBox(height: 10),
                  Text(
                    'Obteniendo tu ubicación…',
                    style: AppTheme.inter(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink6),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.ink2
      ..strokeWidth = 1;
    const step = 32.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) => false;
}

// ── Pin del mapa con sombra y tilde institucional ────────────────────────────
class _SfitMapPin extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.bottomCenter,
      children: [
        // Sombra circular bajo el pin (proyección)
        Positioned(
          bottom: 0,
          child: Container(
            width: 16,
            height: 5,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        // Pin
        Positioned(
          bottom: 4,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.35),
                  blurRadius: 10,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: const Icon(Icons.location_on_rounded, size: 16, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

// ── Picker de fotos ───────────────────────────────────────────────────────────
class _PhotoPickerSection extends StatelessWidget {
  final List<XFile> images;
  final VoidCallback onPickGallery;
  final VoidCallback onPickCamera;
  final ValueChanged<int> onRemove;

  const _PhotoPickerSection({
    required this.images,
    required this.onPickGallery,
    required this.onPickCamera,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final canAdd = images.length < 3;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Miniaturas existentes
        if (images.isNotEmpty) ...[
          SizedBox(
            height: 88,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => _PhotoThumb(image: images[i], onRemove: () => onRemove(i)),
            ),
          ),
          const SizedBox(height: 10),
        ],
        // Botones añadir
        Row(
          children: [
            _PhotoAddButton(
              icon: Icons.photo_library_outlined,
              label: 'Galería',
              enabled: canAdd,
              onTap: onPickGallery,
            ),
            const SizedBox(width: 8),
            _PhotoAddButton(
              icon: Icons.camera_alt_outlined,
              label: 'Cámara',
              enabled: canAdd,
              onTap: onPickCamera,
            ),
            const Spacer(),
            Text(
              '${images.length}/3',
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink4, tabular: true),
            ),
          ],
        ),
      ],
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  final XFile image;
  final VoidCallback onRemove;

  const _PhotoThumb({required this.image, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Image.file(
            File(image.path),
            width: 88,
            height: 88,
            fit: BoxFit.cover,
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                color: Color(0xCC000000),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close_rounded, size: 13, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}

class _PhotoAddButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  const _PhotoAddButton({required this.icon, required this.label, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: enabled ? AppColors.ink9 : AppColors.ink2,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: enabled ? Colors.white : AppColors.ink4),
            const SizedBox(width: 6),
            Text(
              label,
              style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600, color: enabled ? Colors.white : AppColors.ink4),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Tarjeta mini del vehículo ─────────────────────────────────────────────────
class _VehicleMiniCard extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  const _VehicleMiniCard({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final plate   = vehicle['plate']          as String? ?? '—';
    final typeKey = vehicle['vehicleTypeKey'] as String? ?? '';
    final status  = vehicle['status']         as String? ?? '—';
    final brand   = vehicle['brand']          as String?;
    final model   = vehicle['model']          as String?;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.infoBg,
        border: Border.all(color: AppColors.infoBorder),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.infoBorder),
            ),
            child: const Icon(Icons.directions_car_rounded, size: 20, color: AppColors.info),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(plate, style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink9, tabular: true)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.infoBg,
                        border: Border.all(color: AppColors.infoBorder),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(status, style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.info)),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  [_typeLabel(typeKey), if (brand != null) brand, if (model != null) model].join(' · '),
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                ),
              ],
            ),
          ),
          const Icon(Icons.check_circle_rounded, size: 20, color: AppColors.info),
        ],
      ),
    );
  }

  String _typeLabel(String k) => switch (k) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos'  => 'Limpieza',
        'emergencia'         => 'Emergencia',
        'maquinaria'         => 'Maquinaria',
        _                    => 'Municipal',
      };
}

// ── Error inline ──────────────────────────────────────────────────────────────
class _InlineError extends StatelessWidget {
  final String message;
  const _InlineError(this.message);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.noAptoBg,
          border: Border.all(color: AppColors.noAptoBorder),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline, size: 16, color: AppColors.noApto),
            const SizedBox(width: 8),
            Expanded(child: Text(message, style: AppTheme.inter(fontSize: 13, color: AppColors.noApto, fontWeight: FontWeight.w500))),
          ],
        ),
      );
}

// ── Kicker ────────────────────────────────────────────────────────────────────
class _Kicker extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: const BoxDecoration(color: AppColors.info, shape: BoxShape.circle)),
          const SizedBox(width: 7),
          Text(
            'PORTAL CIUDADANO',
            style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.info, letterSpacing: 2.1),
          ),
        ],
      );
}

// ── Etiqueta de sección ───────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(color: AppColors.info, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: AppTheme.inter(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.ink8),
          ),
        ],
      );
}

// ── Sugerencia IA ─────────────────────────────────────────────────────────────
class _AISuggestionChip extends StatelessWidget {
  final String category;
  final VoidCallback onAccept;
  final VoidCallback onDismiss;
  const _AISuggestionChip({required this.category, required this.onAccept, required this.onDismiss});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.infoBg,
          border: Border.all(color: AppColors.infoBorder),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.auto_awesome_outlined, size: 16, color: AppColors.info),
            const SizedBox(width: 8),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: AppTheme.inter(fontSize: 12.5, color: AppColors.info),
                  children: [
                    const TextSpan(text: 'Sugerencia: '),
                    TextSpan(text: category, style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onAccept,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: AppColors.info, borderRadius: BorderRadius.circular(6)),
                child: Text('Usar', style: AppTheme.inter(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ),
            const SizedBox(width: 6),
            GestureDetector(onTap: onDismiss, child: const Icon(Icons.close, size: 16, color: AppColors.infoBorder)),
          ],
        ),
      );
}

// ── Resultado de subida y diálogo de fallo ───────────────────────────────────

enum _UploadFailureAction { retry, continueWithout, cancel }

class _UploadFailure {
  final XFile file;
  final String message;
  const _UploadFailure({required this.file, required this.message});
}

class _UploadResult {
  final List<String> urls;
  final List<_UploadFailure> failed;
  const _UploadResult({required this.urls, required this.failed});
}

class _UploadFailureDialog extends StatelessWidget {
  final List<_UploadFailure> failed;
  const _UploadFailureDialog({required this.failed});

  @override
  Widget build(BuildContext context) {
    final count = failed.length;
    final plural = count == 1 ? 'foto' : 'fotos';
    final firstMessage = failed.first.message;
    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.noApto, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'No se pudieron subir $count $plural',
              style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            firstMessage,
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink7, height: 1.4),
          ),
          const SizedBox(height: 8),
          Text(
            'Puedes reintentar la subida o enviar el reporte sin esas evidencias.',
            style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, height: 1.4),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(_UploadFailureAction.cancel),
          child: Text(
            'Cancelar envío',
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink5, fontWeight: FontWeight.w600),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(_UploadFailureAction.continueWithout),
          child: Text(
            'Continuar sin esas',
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink8, fontWeight: FontWeight.w600),
          ),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_UploadFailureAction.retry),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.ink9,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Text(
            'Reintentar',
            style: AppTheme.inter(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
