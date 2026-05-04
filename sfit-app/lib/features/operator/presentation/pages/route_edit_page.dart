import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

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
  String? _error;

  // Comunes
  final _nameCtl = TextEditingController();
  String _code = '';
  String _scope = 'urbano_distrital';

  // Urbano: paraderos
  List<_Wp> _wps = [];

  // Interprovincial: origen, destino, horarios
  final _originCtl = TextEditingController();
  final _destinationCtl = TextEditingController();
  List<String> _departureTimes = [];
  final _newTimeCtl = TextEditingController();

  bool get _isUrbano =>
      _scope == 'urbano_distrital' || _scope == 'urbano_provincial';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    _originCtl.dispose();
    _destinationCtl.dispose();
    _newTimeCtl.dispose();
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
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/rutas/${widget.routeId}');
      final body = resp.data as Map?;
      final d = (body?['data'] as Map<String, dynamic>?) ??
          (body as Map<String, dynamic>? ?? const {});
      _nameCtl.text = (d['name'] as String?) ?? '';
      _code = (d['code'] as String?) ?? '';
      _scope = (d['serviceScope'] as String?) ?? 'urbano_distrital';
      _originCtl.text = (d['origin'] as String?) ??
          ((d['origenLabel'] as String?) ?? '');
      _destinationCtl.text = (d['destination'] as String?) ??
          ((d['destinoLabel'] as String?) ?? '');
      _departureTimes = ((d['departureTimes'] as List?) ??
              (d['horariosSalida'] as List?) ??
              const [])
          .cast<dynamic>()
          .map((e) => e.toString())
          .toList();
      _wps = ((d['waypoints'] as List?) ?? const [])
          .map((w) {
            final m = w as Map<String, dynamic>;
            return _Wp(
              order: (m['order'] as num?)?.toInt() ?? 0,
              lat: (m['lat'] as num).toDouble(),
              lng: (m['lng'] as num).toDouble(),
              label: (m['label'] as String?) ?? '',
            );
          })
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));
      if (mounted) setState(() => _loading = false);
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudo cargar la ruta.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _save() async {
    if (_nameCtl.text.trim().length < 2) {
      _snack('Nombre muy corto');
      return;
    }
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
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
        payload['origin'] = _originCtl.text.trim();
        payload['destination'] = _destinationCtl.text.trim();
        payload['departureTimes'] = _departureTimes;
      }
      await dio.patch('/rutas/${widget.routeId}', data: payload);
      if (mounted) {
        _snack('Ruta actualizada.');
        context.pop(true);
      }
    } catch (e) {
      if (mounted) _snack('Error al guardar: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
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
        ],
      ),
    );
  }

  // ── Vista urbana ────────────────────────────────────────────────
  List<Widget> _buildUrbano() {
    return [
      const _SectionLabel(label: 'Recorrido'),
      const SizedBox(height: 8),
      // Mini-mapa con paraderos
      Container(
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
                  'Sin paraderos aún',
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
                  TileLayer(
                    urlTemplate:
                        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                    subdomains: const ['a', 'b', 'c', 'd'],
                    userAgentPackageName: 'com.sfit.sfit_app',
                  ),
                  if (_wps.length >= 2)
                    PolylineLayer(polylines: [
                      Polyline(
                        points: _wps
                            .map((w) => LatLng(w.lat, w.lng))
                            .toList(),
                        strokeWidth: 3,
                        color: AppColors.primary.withValues(alpha: 0.6),
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
      ),
      const SizedBox(height: 12),
      Row(children: [
        Text(
          'Paraderos (${_wps.length})',
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
              'Sin paraderos',
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
