import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart' show FormData, MultipartFile;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
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
  bool _success = false;

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
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      if (mounted) {
        final latLng = LatLng(pos.latitude, pos.longitude);
        setState(() {
          _userPosition = pos;
          _selectedLatLng ??= latLng;
          _locationLoading = false;
        });
      }
    } on TimeoutException {
      if (mounted) setState(() { _locationError = 'Tiempo agotado'; _locationLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _locationError = 'No se pudo obtener la ubicación'; _locationLoading = false; });
    }
  }

  // ── Búsqueda por placa ───────────────────────────────────────────
  Future<void> _searchVehicle() async {
    final plate = _plateCtrl.text.trim().toUpperCase();
    if (plate.isEmpty) return;
    setState(() { _searching = true; _searchError = null; _foundVehicle = null; _selectedCategory = null; _descCtrl.clear(); });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/public/vehiculo', queryParameters: {'plate': plate});
      final body = resp.data as Map;
      if (body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (mounted) {
          setState(() { _foundVehicle = data; _searching = false; _userPosition = null; _selectedLatLng = null; _locationError = null; });
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
  Future<void> _pickFromGallery() async {
    if (_selectedImages.length >= 3) return;
    final remaining = 3 - _selectedImages.length;
    try {
      final picked = await _imagePicker.pickMultiImage(imageQuality: 80, limit: remaining);
      if (picked.isNotEmpty && mounted) {
        setState(() => _selectedImages.addAll(picked.take(remaining)));
      }
    } catch (_) {}
  }

  Future<void> _pickFromCamera() async {
    if (_selectedImages.length >= 3) return;
    try {
      final picked = await _imagePicker.pickImage(source: ImageSource.camera, imageQuality: 80);
      if (picked != null && mounted) setState(() => _selectedImages.add(picked));
    } catch (_) {}
  }

  void _removeImage(int index) => setState(() => _selectedImages.removeAt(index));

  Future<List<String>> _uploadImages() async {
    final urls = <String>[];
    final dio = ref.read(dioClientProvider).dio;
    for (final img in _selectedImages) {
      try {
        final bytes = await img.readAsBytes();
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(bytes, filename: img.name),
        });
        final resp = await dio.post('/uploads/reports', data: formData);
        final url = (resp.data as Map)['data']['url'] as String?;
        if (url != null) urls.add(url);
      } catch (_) {
        // Fallo silencioso — seguimos sin esa imagen
      }
    }
    return urls;
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
        imageUrls = await _uploadImages();
        if (mounted) setState(() => _uploadingImages = false);
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
      if (mounted) setState(() { _submitting = false; _success = true; });
    } catch (_) {
      if (mounted) setState(() { _submitting = false; _uploadingImages = false; });
      _showError('No se pudo enviar el reporte. Intenta de nuevo.');
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

  @override
  Widget build(BuildContext context) {
    if (_success) return _SuccessScreen(onBack: () => Navigator.of(context).pop());

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

                const SizedBox(height: 28),

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
    if (widget.loading) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.infoBg,
          border: Border.all(color: AppColors.infoBorder),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 1.8, color: AppColors.info)),
            const SizedBox(width: 10),
            Text('Obteniendo ubicación GPS...', style: AppTheme.inter(fontSize: 13, color: AppColors.info)),
          ],
        ),
      );
    }

    if (widget.error != null) {
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
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.sfit.app',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: marker,
                      width: 44,
                      height: 44,
                      child: const Icon(Icons.location_pin, color: AppColors.info, size: 44),
                    ),
                  ],
                ),
              ],
            ),
          ),
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

// ── Pantalla de éxito ─────────────────────────────────────────────────────────
class _SuccessScreen extends StatelessWidget {
  final VoidCallback onBack;
  const _SuccessScreen({required this.onBack});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.paper,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.elasticOut,
                    builder: (_, v, child) => Transform.scale(scale: v, child: child),
                    child: Container(
                      width: 84,
                      height: 84,
                      decoration: const BoxDecoration(color: AppColors.infoBg, shape: BoxShape.circle),
                      child: const Icon(Icons.check_rounded, size: 46, color: AppColors.info),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text('¡Reporte enviado!', style: AppTheme.inter(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.ink9, letterSpacing: -0.4)),
                  const SizedBox(height: 10),
                  Text(
                    'Tu reporte fue registrado y será revisado\npor un fiscal asignado a la brevedad.',
                    textAlign: TextAlign.center,
                    style: AppTheme.inter(fontSize: 14, color: AppColors.ink6, height: 1.5),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      onPressed: onBack,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.ink9,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text('Volver', style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}
