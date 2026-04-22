import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/reports_api_service.dart';
import '../../data/models/report_model.dart';

/// Formulario de envío de reporte ciudadano — RF-Ciudadano.
class SubmitReportPage extends ConsumerStatefulWidget {
  const SubmitReportPage({super.key});

  @override
  ConsumerState<SubmitReportPage> createState() => _SubmitReportPageState();
}

class _SubmitReportPageState extends ConsumerState<SubmitReportPage> {
  // ── Step 1: búsqueda de vehículo ────────────────────────────────
  final _plateCtrl = TextEditingController();
  bool _searching = false;
  Map<String, dynamic>? _foundVehicle;
  String? _searchError;

  // ── Step 2: formulario de reporte ──────────────────────────────
  String? _selectedCategory;
  String? _suggestedCategory;
  final _descCtrl = TextEditingController();
  bool _submitting = false;

  // ── Geolocalización (RF-12-03) ──────────────────────────────────
  Position? _userPosition;
  bool _locationLoading = false;
  String? _locationError;

  // ── Éxito ───────────────────────────────────────────────────────
  bool _success = false;

  @override
  void dispose() {
    _plateCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _captureLocation() async {
    setState(() { _locationLoading = true; _locationError = null; });
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() {
            _locationError = 'Permiso de ubicación denegado';
            _locationLoading = false;
          });
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _locationError = 'Permiso permanentemente denegado. Habilítalo en ajustes.';
          _locationLoading = false;
        });
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      if (mounted) {
        setState(() { _userPosition = position; _locationLoading = false; });
      }
    } on TimeoutException catch (_) {
      if (mounted) {
        setState(() {
          _locationError = 'Tiempo de espera agotado. Intenta de nuevo.';
          _locationLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _locationError = 'No se pudo obtener ubicación: $e';
          _locationLoading = false;
        });
      }
    }
  }

  Future<void> _searchVehicle() async {
    final plate = _plateCtrl.text.trim().toUpperCase();
    if (plate.isEmpty) return;

    setState(() {
      _searching = true;
      _searchError = null;
      _foundVehicle = null;
      _selectedCategory = null;
      _descCtrl.clear();
    });

    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/public/vehiculo', queryParameters: {'plate': plate});

      final body = resp.data as Map;
      if (body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (mounted) {
          setState(() {
            _foundVehicle = data;
            _searching = false;
            _userPosition = null;
            _locationError = null;
          });
          _captureLocation(); // RF-12-03: capture location in background
        }
      } else {
        final msg = (body['error'] as String?) ?? 'Vehículo no encontrado';
        if (mounted) {
          setState(() {
            _searchError = msg;
            _searching = false;
          });
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _searchError = 'Vehículo no encontrado';
          _searching = false;
        });
      }
    }
  }

  Future<void> _submitReport() async {
    if (_foundVehicle == null) return;
    if (_selectedCategory == null) {
      _showError('Selecciona una categoría');
      return;
    }
    final desc = _descCtrl.text.trim();
    if (desc.length < 20) {
      _showError('La descripción debe tener al menos 20 caracteres');
      return;
    }

    setState(() => _submitting = true);

    try {
      final svc = ref.read(reportsApiServiceProvider);
      final plate = (_foundVehicle!['plate'] as String?)
          ?? _plateCtrl.text.trim().toUpperCase();
      await svc.submitReport(
        vehiclePlate: plate,
        category: _selectedCategory!,
        description: desc,
        vehicleTypeKey: _foundVehicle!['vehicleTypeKey'] as String?,
        latitude: _userPosition?.latitude,
        longitude: _userPosition?.longitude,
      );
      if (mounted) setState(() { _submitting = false; _success = true; });
    } catch (_) {
      if (mounted) {
        setState(() => _submitting = false);
        _showError('No se pudo enviar el reporte. Intenta de nuevo.');
      }
    }
  }

  void _inferCategory() {
    final text = _descCtrl.text.toLowerCase();
    if (text.length < 15) {
      if (_suggestedCategory != null) setState(() => _suggestedCategory = null);
      return;
    }
    const _kw = {
      'Conducción peligrosa': ['peligros', 'velocidad', 'rápido', 'rapido', 'acelerado', 'frenaz', 'semáforo', 'semaforo', 'maniobra', 'adelant'],
      'Cobro indebido':       ['cobro', 'cobró', 'precio', 'tarifa', 'excesivo', 'caro', 'pagó de más', 'cobró de más'],
      'Mal estado del vehículo': ['mal estado', 'roto', 'falla', 'humo', 'ruido', 'llanta', 'freno', 'avería', 'averia', 'descompuesto'],
    };
    String? best;
    int bestCount = 0;
    for (final entry in _kw.entries) {
      final count = entry.value.where((k) => text.contains(k)).length;
      if (count > bestCount) { bestCount = count; best = entry.key; }
    }
    final suggested = bestCount > 0 ? best : null;
    if (suggested != _suggestedCategory) setState(() => _suggestedCategory = suggested);
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.noApto,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_success) return _SuccessScreen(onBack: () => Navigator.of(context).pop());

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: const Text('Enviar reporte'),
        backgroundColor: AppColors.paper,
        elevation: 0,
        scrolledUnderElevation: 0.5,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Kicker ─────────────────────────────────────────
              _Kicker(),
              const SizedBox(height: 10),
              Text(
                'Reportar vehículo',
                style: AppTheme.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.5,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Busca el vehículo por placa y completa el formulario.',
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6, height: 1.4),
              ),

              const SizedBox(height: 28),

              // ── Step 1: Buscar vehículo ─────────────────────────
              const _SectionLabel('Paso 1 — Buscar vehículo'),
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
                      style: AppTheme.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink9,
                        tabular: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    height: 50,
                    child: FilledButton(
                      onPressed: _searching ? null : _searchVehicle,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(80, 50),
                        backgroundColor: AppColors.ink9,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: _searching
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              'Buscar',
                              style: AppTheme.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                ],
              ),

              // Error de búsqueda
              if (_searchError != null) ...[
                const SizedBox(height: 10),
                _InlineError(_searchError!),
              ],

              // Vehículo encontrado
              if (_foundVehicle != null) ...[
                const SizedBox(height: 14),
                _VehicleMiniCard(vehicle: _foundVehicle!),
                const SizedBox(height: 8),
                _LocationStatusRow(
                  loading: _locationLoading,
                  position: _userPosition,
                  error: _locationError,
                  onRetry: _captureLocation,
                ),
              ],

              // ── Step 2: Formulario (solo si hay vehículo) ───────
              if (_foundVehicle != null) ...[
                const SizedBox(height: 28),
                const _SectionLabel('Paso 2 — Detalle del reporte'),
                const SizedBox(height: 10),

                // Dropdown categoría
                const _FieldLabel('Categoría'),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: _selectedCategory,
                  items: kReportCategories
                      .map(
                        (cat) => DropdownMenuItem(
                          value: cat,
                          child: Text(cat, style: AppTheme.inter(fontSize: 14, color: AppColors.ink8)),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _selectedCategory = v),
                  hint: Text(
                    'Selecciona una categoría',
                    style: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
                  ),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.ink2, width: 1.5),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.ink2, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.ink9, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  ),
                  style: AppTheme.inter(fontSize: 14, color: AppColors.ink8),
                  dropdownColor: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                ),

                const SizedBox(height: 18),

                // Descripción
                const _FieldLabel('Descripción'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _descCtrl,
                  maxLines: 5,
                  maxLength: 500,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    hintText: 'Describe el incidente con el mayor detalle posible (mín. 20 caracteres)...',
                    alignLabelWithHint: true,
                  ),
                  onChanged: (_) { setState(() {}); _inferCategory(); },
                ),

                // Contador de caracteres / aviso mínimo
                if (_descCtrl.text.isNotEmpty && _descCtrl.text.trim().length < 20)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Mínimo 20 caracteres (${_descCtrl.text.trim().length}/20)',
                      style: AppTheme.inter(fontSize: 12, color: AppColors.noApto),
                    ),
                  ),

                if (_suggestedCategory != null && _selectedCategory == null) ...[
                  const SizedBox(height: 10),
                  _AISuggestionChip(
                    category: _suggestedCategory!,
                    onAccept: () => setState(() {
                      _selectedCategory = _suggestedCategory;
                      _suggestedCategory = null;
                    }),
                    onDismiss: () => setState(() => _suggestedCategory = null),
                  ),
                ],

                const SizedBox(height: 28),

                // Botón enviar
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submitReport,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ink9,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 18),
                    label: Text(
                      _submitting ? 'Enviando...' : 'Enviar reporte',
                      style: AppTheme.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
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

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Mini card del vehículo encontrado ──────────────────────────────
class _VehicleMiniCard extends StatelessWidget {
  final Map<String, dynamic> vehicle;

  const _VehicleMiniCard({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final plate = vehicle['plate'] as String? ?? '—';
    final typeKey = vehicle['vehicleTypeKey'] as String? ?? '';
    final status = vehicle['status'] as String? ?? '—';
    final brand = vehicle['brand'] as String?;
    final model = vehicle['model'] as String?;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.aptoBg,
        border: Border.all(color: AppColors.aptoBorder),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.aptoBorder),
            ),
            child: const Icon(Icons.directions_car_rounded,
                size: 20, color: AppColors.apto),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      plate,
                      style: AppTheme.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink9,
                        tabular: true,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.aptoBg,
                        border: Border.all(color: AppColors.aptoBorder),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        status,
                        style: AppTheme.inter(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.apto,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    _vehicleTypeLabel(typeKey),
                    if (brand != null) brand,
                    if (model != null) model,
                  ].join(' · '),
                  style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink6),
                ),
              ],
            ),
          ),
          const Icon(Icons.check_circle_rounded, size: 20, color: AppColors.apto),
        ],
      ),
    );
  }

  String _vehicleTypeLabel(String k) => switch (k) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos'  => 'Limpieza',
        'emergencia'         => 'Emergencia',
        'maquinaria'         => 'Maquinaria',
        _                    => 'Municipal',
      };
}

// ── Widget de estado de geolocalización (RF-12-03) ──────────────────
class _LocationStatusRow extends StatelessWidget {
  final bool loading;
  final Position? position;
  final String? error;
  final VoidCallback onRetry;

  const _LocationStatusRow({
    required this.loading,
    required this.position,
    required this.error,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.infoBg,
          border: Border.all(color: AppColors.infoBorder),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 13,
              height: 13,
              child: CircularProgressIndicator(
                strokeWidth: 1.8,
                color: AppColors.info,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Obteniendo ubicación...',
              style: AppTheme.inter(fontSize: 12.5, color: AppColors.info),
            ),
          ],
        ),
      );
    }

    if (error != null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.riesgoBg,
          border: Border.all(color: AppColors.riesgoBorder),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_off_rounded, size: 15, color: AppColors.riesgo),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                '$error — el reporte se enviará sin ubicación.',
                style: AppTheme.inter(fontSize: 12, color: AppColors.riesgo),
              ),
            ),
            const SizedBox(width: 6),
            GestureDetector(
              onTap: onRetry,
              child: Text(
                'Reintentar',
                style: AppTheme.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.riesgo,
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (position != null) {
      return Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.aptoBg,
          border: Border.all(color: AppColors.aptoBorder),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.location_on_rounded, size: 15, color: AppColors.apto),
            const SizedBox(width: 7),
            Text(
              'Ubicación capturada',
              style: AppTheme.inter(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.apto,
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}

// ── Error inline ────────────────────────────────────────────────────
class _InlineError extends StatelessWidget {
  final String message;
  const _InlineError(this.message);

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Expanded(
            child: Text(
              message,
              style: AppTheme.inter(
                fontSize: 13,
                color: AppColors.noApto,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Kicker / etiqueta de sección / field label ───────────────────────
class _Kicker extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: const BoxDecoration(
              color: AppColors.goldLight,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 7),
          Text(
            'PORTAL CIUDADANO',
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.goldDark,
              letterSpacing: 2.1,
            ),
          ),
        ],
      );
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              color: AppColors.gold,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: AppTheme.inter(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink7,
              letterSpacing: 0.1,
            ),
          ),
        ],
      );
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: AppTheme.inter(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: AppColors.ink9,
        ),
      );
}

// ── Sugerencia IA de categoría ──────────────────────────────────────
class _AISuggestionChip extends StatelessWidget {
  final String category;
  final VoidCallback onAccept;
  final VoidCallback onDismiss;
  const _AISuggestionChip({required this.category, required this.onAccept, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        border: Border.all(color: const Color(0xFF93C5FD)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome_outlined, size: 16, color: Color(0xFF2563EB)),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: AppTheme.inter(fontSize: 12.5, color: const Color(0xFF1E40AF)),
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
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text('Usar', style: AppTheme.inter(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onDismiss,
            child: const Icon(Icons.close, size: 16, color: Color(0xFF93C5FD)),
          ),
        ],
      ),
    );
  }
}

// ── Pantalla de éxito ───────────────────────────────────────────────
class _SuccessScreen extends StatelessWidget {
  final VoidCallback onBack;
  const _SuccessScreen({required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Icono animado de éxito
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.0, end: 1.0),
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.elasticOut,
                  builder: (_, v, child) =>
                      Transform.scale(scale: v, child: child),
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: const BoxDecoration(
                      color: AppColors.aptoBg,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 44,
                      color: AppColors.apto,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  '¡Reporte enviado!',
                  style: AppTheme.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Tu reporte fue registrado y será revisado\npor un fiscal asignado a la brevedad.',
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(
                    fontSize: 14,
                    color: AppColors.ink6,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton(
                    onPressed: onBack,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ink9,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: Text(
                      'Volver',
                      style: AppTheme.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
