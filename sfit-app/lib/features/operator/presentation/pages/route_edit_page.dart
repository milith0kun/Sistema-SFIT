import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../../../../shared/widgets/map/sfit_map_tiles.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/operator_api_service.dart';

/// Edición de ruta para el OPERADOR — RF-09 (mobile).
/// Adapta la UI según `serviceScope`:
///   - urbano_distrital / urbano_provincial → paraderos con GPS y mini-mapa.
///   - interprovincial_regional / interregional_nacional → origen/destino +
///     horarios fijos de salida (HH:mm).
class RouteEditPage extends ConsumerStatefulWidget {
  final String routeId;
  const RouteEditPage({super.key, required this.routeId});

  @override
  ConsumerState<RouteEditPage> createState() => _RouteEditPageState();
}

class _RouteEditPageState extends ConsumerState<RouteEditPage> {
  bool _loading = true;
  bool _saving = false;
  bool _recalculating = false;
  String? _error;

  // Comunes
  final _nameCtl = TextEditingController();
  String _code = '';
  String _scope = 'urbano_distrital';

  // Urbano: paraderos
  List<_Wp> _wps = [];

  /// Trazado por calles devuelto por el backend (snap-to-roads de Google
  /// Routes v2). Vacío si la geometría aún no se calculó — el mapa pinta
  /// líneas rectas entre waypoints como fallback.
  List<LatLng> _streetPolyline = const [];

  // Interprovincial: origen, destino, horarios
  final _originCtl = TextEditingController();
  final _destinationCtl = TextEditingController();
  List<String> _departureTimes = [];
  final _newTimeCtl = TextEditingController();

  // Etiquetas y parámetros operativos (compartidos por urbano e interprov)
  List<String> _tags = [];
  final _frecuenciaCtl = TextEditingController();
  final _capacidadCtl = TextEditingController();
  final _observacionesCtl = TextEditingController();
  final _newTagCtl = TextEditingController();

  // Catálogo de presets que se ofrecen como sugerencia para el operador.
  // Más rápido que pedirle escribir cada tag desde cero. Acepta custom igual.
  static const _tagPresets = <String>[
    'congestionada',
    'rapida',
    'alternativa_lluvia',
    'turismo',
    'escolar',
    'nocturna',
  ];

  bool get _isUrbano =>
      _scope == 'urbano_distrital' || _scope == 'urbano_provincial';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    _originCtl.dispose();
    _destinationCtl.dispose();
    _newTimeCtl.dispose();
    _frecuenciaCtl.dispose();
    _capacidadCtl.dispose();
    _observacionesCtl.dispose();
    _newTagCtl.dispose();
    for (final w in _wps) {
      w.ctl.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final service = ref.read(operatorApiServiceProvider);
      final r = await service.getRouteDetail(widget.routeId);
      _nameCtl.text = r.name ?? '';
      _code = r.code ?? '';
      _scope = r.type ?? 'urbano_distrital';
      _wps = r.waypoints
          .map((m) => _Wp(
                order: (m['order'] as num?)?.toInt() ?? 0,
                lat: (m['lat'] as num).toDouble(),
                lng: (m['lng'] as num).toDouble(),
                label: (m['label'] as String?) ?? '',
              ))
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));
      // Etiquetas y parámetros operativos.
      _tags = List<String>.from(r.tags);
      final p = r.parameters;
      _frecuenciaCtl.text = p?.frecuenciaMinutos?.toString() ?? '';
      _capacidadCtl.text = p?.capacidadAsientos?.toString() ?? '';
      _observacionesCtl.text = p?.observaciones ?? '';
      // Trazado real (snap-to-roads). Si polylineGeometry es null, el
      // getter `polylineCoords` devuelve los waypoints — para el overlay
      // queremos sólo la versión por calles, así que filtramos por presencia.
      final geom = r.polylineGeometry;
      _streetPolyline = (geom != null && geom.coords.length >= 2)
          ? geom.coords
              .where((c) => c.length >= 2)
              .map((c) => LatLng(c[0], c[1]))
              .toList()
          : const [];
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _extractError(e);
          _loading = false;
        });
      }
    }
  }

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (data is Map && data['message'] is String) return data['message'] as String;
    }
    return 'No se pudo cargar la ruta.';
  }

  Future<void> _save() async {
    if (_nameCtl.text.trim().length < 2) {
      _snack('Nombre muy corto');
      return;
    }
    setState(() => _saving = true);
    try {
      final service = ref.read(operatorApiServiceProvider);
      final payload = <String, dynamic>{
        'name': _nameCtl.text.trim(),
      };
      if (_isUrbano) {
        final wps = _wps
            .asMap()
            .entries
            .map((e) => {
                  'order': e.key,
                  'lat': e.value.lat,
                  'lng': e.value.lng,
                  'label': e.value.ctl.text.trim(),
                })
            .toList();
        payload['waypoints'] = wps;
        payload['stops'] = wps.length;
      } else {
        // Backend Track A: rutas interprovinciales requieren UBIGEOs (6 dígitos)
        // y horarios HH:mm en `departureSchedules`.
        final origin = _originCtl.text.trim();
        final destination = _destinationCtl.text.trim();
        if (origin.isNotEmpty) payload['originDistrictCode'] = origin;
        if (destination.isNotEmpty) {
          payload['destinationDistrictCode'] = destination;
        }
        payload['departureSchedules'] = _departureTimes;
      }

      // Etiquetas y parámetros — siempre se envían (los dos modos los
      // soportan). Backend valida con zod y los almacena como Route.tags +
      // Route.parameters. Campos numéricos vacíos se envían como null para
      // limpiar valores anteriores.
      payload['tags'] = _tags;
      payload['parameters'] = <String, dynamic>{
        'frecuenciaMinutos': _frecuenciaCtl.text.trim().isEmpty
            ? null
            : int.tryParse(_frecuenciaCtl.text.trim()),
        'capacidadAsientos': _capacidadCtl.text.trim().isEmpty
            ? null
            : int.tryParse(_capacidadCtl.text.trim()),
        'observaciones': _observacionesCtl.text.trim().isEmpty
            ? null
            : _observacionesCtl.text.trim(),
      };

      await service.updateRoute(widget.routeId, payload);
      if (mounted) {
        ref.invalidate(operadorRoutesProvider);
        _snack('Ruta actualizada.');
        context.pop(true);
      }
    } catch (e) {
      if (mounted) _snack('Error al guardar: ${_extractError(e)}');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Re-converge capturas GPS y vuelve a calcular `polylineGeometry` por
  /// calles. Recarga la ruta tras terminar para refrescar el overlay del mapa.
  ///
  /// El recompute de geometría corre fire-and-forget en el backend; esperamos
  /// ~3s antes de recargar para darle margen a la primera respuesta de Google.
  Future<void> _recalculateStreetTrace() async {
    setState(() => _recalculating = true);
    try {
      final service = ref.read(operatorApiServiceProvider);
      await service.recalculateRoute(widget.routeId);
      if (!mounted) return;
      _snack('Recalculando trazado…');
      await Future<void>.delayed(const Duration(seconds: 3));
      if (!mounted) return;
      await _load();
      if (mounted && _streetPolyline.length >= 2) {
        _snack('Trazado actualizado por calles.');
      } else if (mounted) {
        _snack('Geometría aún procesando — vuelve a abrir en unos segundos.');
      }
    } catch (e) {
      if (mounted) _snack('No se pudo recalcular: ${_extractError(e)}');
    } finally {
      if (mounted) setState(() => _recalculating = false);
    }
  }

  Future<void> _addWaypointGps() async {
    try {
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      if (!mounted) return;
      setState(() {
        _wps.add(_Wp(
          order: _wps.length,
          lat: p.latitude,
          lng: p.longitude,
          label: 'Paradero ${_wps.length + 1}',
        ));
      });
    } catch (_) {
      if (mounted) _snack('No se obtuvo GPS.');
    }
  }

  void _addTime() {
    final t = _newTimeCtl.text.trim();
    if (!_isValidTime(t)) {
      _snack('Formato HH:mm (ej: 06:00)');
      return;
    }
    setState(() {
      _departureTimes = [..._departureTimes, t]..sort();
      _newTimeCtl.clear();
    });
  }

  bool _isValidTime(String s) {
    final m = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$').firstMatch(s);
    return m != null;
  }

  void _snack(String m) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(m), behavior: SnackBarBehavior.floating),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.close, color: AppColors.ink9),
        ),
        title: Text(
          'Editar ruta',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        actions: [
          // Recalcular: re-converge capturas GPS y vuelve a hacer
          // snap-to-roads. Solo visible para rutas urbanas (las únicas con
          // waypoints intermedios). Skip si la ruta no tiene capturas asociadas
          // — el backend devolverá 400 con mensaje claro.
          if (_isUrbano)
            IconButton(
              tooltip: 'Recalcular trazado por calles',
              onPressed: _recalculating ? null : _recalculateStreetTrace,
              icon: _recalculating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    )
                  : const Icon(
                      Icons.alt_route_outlined,
                      color: AppColors.primary,
                    ),
            ),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                minimumSize: const Size(80, 36),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      'Guardar',
                      style: AppTheme.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(
                      _error!,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Reintentar'),
                    ),
                  ]),
                )
              : _form(),
    );
  }

  Widget _form() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Cabecera con scope
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.panel,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'EDICIÓN DE RUTA',
                  style: AppTheme.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.55),
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _nameCtl.text.isEmpty ? 'Ruta' : _nameCtl.text,
                  style: AppTheme.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  if (_code.isNotEmpty)
                    _Pill(label: _code, fg: Colors.white),
                  _Pill(
                    label: _scopeLabel(_scope),
                    fg: Colors.white,
                    bg: AppColors.primary.withValues(alpha: 0.5),
                  ),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const _SectionLabel(label: 'Datos generales'),
          const SizedBox(height: 8),
          TextField(
            controller: _nameCtl,
            onChanged: (_) => setState(() {}),
            decoration: _dec('Nombre de la ruta'),
          ),
          const SizedBox(height: 10),
          TextField(
            enabled: false,
            controller: TextEditingController(text: _code),
            decoration: _dec('Código (read-only)'),
          ),
          const SizedBox(height: 18),
          if (_isUrbano) ..._buildUrbano() else ..._buildInterprov(),
          const SizedBox(height: 22),
          ..._buildTagsAndParameters(),
        ],
      ),
    );
  }

  // ── Etiquetas y parámetros operativos ──────────────────────────
  // Editables tanto en rutas urbanas como interprovinciales. Los presets
  // sugieren valores comunes (congestionada, escolar...) pero acepta libres.
  List<Widget> _buildTagsAndParameters() {
    final allTags = <String>{..._tagPresets, ..._tags}.toList();
    return [
      const _SectionLabel(label: 'Etiquetas operativas'),
      const SizedBox(height: 8),
      Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final tag in allTags)
            FilterChip(
              label: Text(
                tag,
                style: AppTheme.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              selected: _tags.contains(tag),
              onSelected: (selected) => setState(() {
                if (selected) {
                  _tags = [..._tags, tag];
                } else {
                  _tags = _tags.where((t) => t != tag).toList();
                }
              }),
              selectedColor: AppColors.primary.withValues(alpha: 0.15),
              checkmarkColor: AppColors.primary,
            ),
        ],
      ),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(
          child: TextField(
            controller: _newTagCtl,
            decoration: _dec('Agregar etiqueta…').copyWith(isDense: true),
            onSubmitted: (_) => _addCustomTag(),
          ),
        ),
        const SizedBox(width: 8),
        TextButton.icon(
          onPressed: _addCustomTag,
          icon: const Icon(Icons.add, size: 14),
          label: Text(
            'Añadir',
            style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ),
      ]),
      const SizedBox(height: 18),
      const _SectionLabel(label: 'Parámetros operativos'),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(
          child: TextField(
            controller: _frecuenciaCtl,
            keyboardType: TextInputType.number,
            decoration: _dec('Frecuencia (min)'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(
            controller: _capacidadCtl,
            keyboardType: TextInputType.number,
            decoration: _dec('Capacidad (asientos)'),
          ),
        ),
      ]),
      const SizedBox(height: 10),
      TextField(
        controller: _observacionesCtl,
        maxLines: 2,
        maxLength: 500,
        decoration: _dec('Observaciones (opcional)'),
      ),
    ];
  }

  void _addCustomTag() {
    final raw = _newTagCtl.text.trim().toLowerCase();
    if (raw.isEmpty) return;
    if (raw.length > 40) {
      _snack('La etiqueta es muy larga (máx 40)');
      return;
    }
    if (_tags.contains(raw)) {
      _newTagCtl.clear();
      return;
    }
    if (_tags.length >= 16) {
      _snack('Máximo 16 etiquetas por ruta');
      return;
    }
    setState(() {
      _tags = [..._tags, raw];
      _newTagCtl.clear();
    });
  }

  // ── Mini-mapa con paraderos (compartido urbano / interprov) ─────
  Widget _buildMapPreview({String emptyLabel = 'Sin paraderos aún'}) {
    return Container(
      height: 180,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: _wps.isEmpty
          ? Center(
              child: Text(
                emptyLabel,
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
              ),
            )
          : FlutterMap(
              options: MapOptions(
                initialCenter: LatLng(_wps.first.lat, _wps.first.lng),
                initialZoom: 13,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
                ),
              ),
              children: [
                sfitCartoVoyagerTile(),
                if (_wps.length >= 2)
                  PolylineLayer(polylines: [
                    Polyline(
                      points:
                          _wps.map((w) => LatLng(w.lat, w.lng)).toList(),
                      strokeWidth: 2,
                      color: _streetPolyline.length >= 2
                          ? AppColors.ink4.withValues(alpha: 0.45)
                          : AppColors.primary.withValues(alpha: 0.6),
                    ),
                    if (_streetPolyline.length >= 2)
                      Polyline(
                        points: _streetPolyline,
                        strokeWidth: 4,
                        color: AppColors.primary.withValues(alpha: 0.85),
                      ),
                  ]),
                MarkerLayer(
                  markers: _wps
                      .asMap()
                      .entries
                      .map((e) => Marker(
                            point: LatLng(e.value.lat, e.value.lng),
                            width: 26,
                            height: 26,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 2,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '${e.key + 1}',
                                style: AppTheme.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  tabular: true,
                                ),
                              ),
                            ),
                          ))
                      .toList(),
                ),
              ],
            ),
    );
  }

  // ── Editor de waypoints (cabecera + lista reordenable). Compartido. ─
  List<Widget> _buildWaypointsEditor({required String headerLabel}) {
    return [
      Row(children: [
        Text(
          '$headerLabel (${_wps.length})',
          style: AppTheme.inter(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.ink8,
          ),
        ),
        const Spacer(),
        TextButton.icon(
          onPressed: _addWaypointGps,
          icon: const Icon(Icons.gps_fixed, size: 14),
          label: Text(
            'Capturar GPS',
            style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w700),
          ),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            minimumSize: const Size(0, 32),
            padding: const EdgeInsets.symmetric(horizontal: 10),
          ),
        ),
      ]),
      const SizedBox(height: 8),
      if (_wps.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.ink2),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(children: [
            const Icon(
              Icons.place_outlined,
              size: 32,
              color: AppColors.ink3,
            ),
            const SizedBox(height: 8),
            Text(
              'Sin puntos',
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
            ),
          ]),
        )
      else
        ReorderableListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _wps.length,
          onReorder: (o, n) => setState(() {
            if (n > o) n--;
            final it = _wps.removeAt(o);
            _wps.insert(n, it);
          }),
          itemBuilder: (_, i) {
            final w = _wps[i];
            return Container(
              key: ValueKey('wp_${w.hashCode}_$i'),
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: AppColors.ink2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: AppColors.primaryBg,
                    border: Border.all(color: AppColors.primaryBorder),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${i + 1}',
                    style: AppTheme.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryDark,
                      tabular: true,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        height: 26,
                        child: TextField(
                          controller: w.ctl,
                          style: AppTheme.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink8,
                          ),
                          decoration: const InputDecoration(
                            isDense: true,
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ),
                      Text(
                        '${w.lat.toStringAsFixed(5)}, ${w.lng.toStringAsFixed(5)}',
                        style: AppTheme.inter(
                          fontSize: 9.5,
                          color: AppColors.ink4,
                          tabular: true,
                        ),
                      ),
                    ],
                  ),
                ),
                ReorderableDragStartListener(
                  index: i,
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(
                      Icons.drag_handle,
                      size: 18,
                      color: AppColors.ink4,
                    ),
                  ),
                ),
                GestureDetector(
                  onLongPress: () => setState(() {
                    w.ctl.dispose();
                    _wps.removeAt(i);
                  }),
                  child: IconButton(
                    icon: const Icon(
                      Icons.delete_outline,
                      size: 18,
                      color: AppColors.noApto,
                    ),
                    onPressed: () => setState(() {
                      w.ctl.dispose();
                      _wps.removeAt(i);
                    }),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ]),
            );
          },
        ),
    ];
  }

  // ── Vista urbana ────────────────────────────────────────────────
  List<Widget> _buildUrbano() {
    return [
      const _SectionLabel(label: 'Recorrido'),
      const SizedBox(height: 8),
      _buildMapPreview(),
      const SizedBox(height: 12),
      ..._buildWaypointsEditor(headerLabel: 'Paraderos'),
    ];
  }

  // ── Vista interprovincial ───────────────────────────────────────
  List<Widget> _buildInterprov() {
    return [
      const _SectionLabel(label: 'Origen y destino'),
      const SizedBox(height: 8),
      TextField(
        controller: _originCtl,
        decoration: _dec('Origen', hint: 'Ej: Cusco - Wanchaq'),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: _destinationCtl,
        decoration: _dec('Destino', hint: 'Ej: Lima - Ate'),
      ),
      const SizedBox(height: 18),
      const _SectionLabel(label: 'Horarios de salida'),
      const SizedBox(height: 8),
      Wrap(
        spacing: 6,
        runSpacing: 6,
        children: _departureTimes
            .asMap()
            .entries
            .map((e) => InputChip(
                  label: Text(
                    e.value,
                    style: AppTheme.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink8,
                      tabular: true,
                    ),
                  ),
                  deleteIcon: const Icon(Icons.close, size: 14),
                  onDeleted: () => setState(
                      () => _departureTimes.removeAt(e.key)),
                  backgroundColor: AppColors.primaryBg,
                  side: const BorderSide(color: AppColors.primaryBorder),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ))
            .toList(),
      ),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(
          child: TextField(
            controller: _newTimeCtl,
            keyboardType: TextInputType.datetime,
            style: AppTheme.inter(
              fontSize: 13,
              color: AppColors.ink9,
              tabular: true,
            ),
            decoration: _dec('Hora HH:mm', hint: 'Ej: 06:00').copyWith(
              isDense: true,
            ),
            onSubmitted: (_) => _addTime(),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          onPressed: _addTime,
          icon: const Icon(Icons.add, size: 18),
          style: IconButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            minimumSize: const Size(38, 38),
          ),
        ),
      ]),
      const SizedBox(height: 24),
      const _SectionLabel(label: 'Paradas intermedias (opcional)'),
      const SizedBox(height: 8),
      _buildMapPreview(
        emptyLabel: 'Captura GPS o suma paradas para ver el trazado',
      ),
      const SizedBox(height: 12),
      ..._buildWaypointsEditor(headerLabel: 'Paradas'),
    ];
  }

  InputDecoration _dec(String label, {String? hint}) => InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      );
}

String _scopeLabel(String s) => switch (s) {
      'urbano_distrital' => 'Urbano distrital',
      'urbano_provincial' => 'Urbano provincial',
      'interprovincial_regional' => 'Interprovincial regional',
      'interregional_nacional' => 'Interregional nacional',
      _ => s,
    };

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: AppTheme.inter(
        fontSize: 10.5,
        fontWeight: FontWeight.w700,
        color: AppColors.ink5,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final Color fg;
  final Color? bg;
  const _Pill({required this.label, required this.fg, this.bg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg ?? Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: fg,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _Wp {
  int order;
  double lat, lng;
  final TextEditingController ctl;
  _Wp({
    required this.order,
    required this.lat,
    required this.lng,
    required String label,
  }) : ctl = TextEditingController(text: label);
}
