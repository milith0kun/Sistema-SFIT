import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/widgets.dart';

class RouteEditPage extends ConsumerStatefulWidget {
  final String routeId;
  final String routeName;
  const RouteEditPage({super.key, required this.routeId, required this.routeName});
  @override
  ConsumerState<RouteEditPage> createState() => _RouteEditPageState();
}

class _RouteEditPageState extends ConsumerState<RouteEditPage> {
  bool _loading = true, _saving = false;
  String? _error;
  final _nameCtl = TextEditingController();
  List<String> _freqs = [];
  List<_Wp> _wps = [];
  final _freqCtl = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { _nameCtl.dispose(); _freqCtl.dispose(); for (final w in _wps) w.ctl.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/rutas/${widget.routeId}');
      final d = (resp.data as Map)['data'] as Map<String, dynamic>? ?? resp.data as Map<String, dynamic>;
      _nameCtl.text = d['name'] as String? ?? '';
      _freqs = (d['frequencies'] as List?)?.cast<String>() ?? [];
      _wps = ((d['waypoints'] as List?) ?? []).map((w) {
        final m = w as Map<String, dynamic>;
        return _Wp(order: m['order'] as int? ?? 0, lat: (m['lat'] as num).toDouble(), lng: (m['lng'] as num).toDouble(), label: m['label'] as String? ?? '');
      }).toList()..sort((a, b) => a.order.compareTo(b.order));
      if (mounted) setState(() => _loading = false);
    } catch (_) { if (mounted) setState(() { _error = 'No se pudo cargar la ruta.'; _loading = false; }); }
  }

  Future<void> _save() async {
    if (_nameCtl.text.trim().length < 2) { _snack('Nombre muy corto'); return; }
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final wps = _wps.asMap().entries.map((e) => {'order': e.key, 'lat': e.value.lat, 'lng': e.value.lng, 'label': e.value.ctl.text.trim()}).toList();
      await dio.patch('/rutas/${widget.routeId}', data: {'name': _nameCtl.text.trim(), 'frequencies': _freqs, 'waypoints': wps, 'stops': wps.length});
      if (mounted) { _snack('Ruta actualizada.'); context.pop(); }
    } catch (e) { if (mounted) _snack('Error: $e'); }
    finally { if (mounted) setState(() => _saving = false); }
  }

  Future<void> _addGPS() async {
    try {
      final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)));
      if (!mounted) return;
      setState(() => _wps.add(_Wp(order: _wps.length, lat: p.latitude, lng: p.longitude, label: 'Paradero ${_wps.length + 1}')));
    } catch (_) { if (mounted) _snack('No se obtuvo GPS'); }
  }

  void _snack(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m), behavior: SnackBarBehavior.floating));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0, surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.close, color: AppColors.ink9), onPressed: () => context.pop()),
        title: Text('Editar ruta', style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9)),
        actions: [
          Padding(padding: const EdgeInsets.only(right: 12), child: FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(backgroundColor: AppColors.gold, minimumSize: const Size(80, 36), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
            child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text('Guardar', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
          )),
        ],
      ),
      body: _loading ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(_error!, style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)), const SizedBox(height: 12), FilledButton(onPressed: _load, child: const Text('Reintentar'))]))
          : _form(),
    );
  }

  Widget _form() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SfitHeroCard(kicker: 'EDICIÓN DE RUTA', title: widget.routeName, rfCode: 'RF-09', pills: [SfitHeroPill(label: 'Paradas', value: '${_wps.length}')]),
        const SizedBox(height: 20),
        // Nombre
        Text('Nombre de la ruta', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink7)),
        const SizedBox(height: 6),
        TextField(controller: _nameCtl, style: AppTheme.inter(fontSize: 14, color: AppColors.ink9), decoration: InputDecoration(hintText: 'Ej: San Sebastián - Centro', filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.ink2)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.ink2)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.gold, width: 2)), contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12))),
        const SizedBox(height: 20),
        // Frecuencias
        Text('Frecuencias', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink7)),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [
          ..._freqs.asMap().entries.map((e) => InputChip(label: Text(e.value, style: AppTheme.inter(fontSize: 12, color: AppColors.ink8)), deleteIcon: const Icon(Icons.close, size: 14), onDeleted: () => setState(() => _freqs.removeAt(e.key)), backgroundColor: AppColors.goldBg, side: const BorderSide(color: AppColors.goldBorder), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)))),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: TextField(controller: _freqCtl, style: AppTheme.inter(fontSize: 13, color: AppColors.ink9), decoration: InputDecoration(hintText: 'Ej: 10 min', isDense: true, filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.ink2)), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)), onSubmitted: (_) { if (_freqCtl.text.trim().isNotEmpty) { setState(() => _freqs.add(_freqCtl.text.trim())); _freqCtl.clear(); } })),
          const SizedBox(width: 8),
          IconButton.filled(onPressed: () { if (_freqCtl.text.trim().isNotEmpty) { setState(() => _freqs.add(_freqCtl.text.trim())); _freqCtl.clear(); } }, icon: const Icon(Icons.add, size: 18), style: IconButton.styleFrom(backgroundColor: AppColors.gold, foregroundColor: Colors.white, minimumSize: const Size(38, 38))),
        ]),
        const SizedBox(height: 24),
        // Paraderos
        Row(children: [
          Text('Paraderos (${_wps.length})', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink7)),
          const Spacer(),
          TextButton.icon(onPressed: _addGPS, icon: const Icon(Icons.gps_fixed, size: 14), label: Text('GPS', style: AppTheme.inter(fontSize: 11, fontWeight: FontWeight.w600)), style: TextButton.styleFrom(foregroundColor: AppColors.gold, minimumSize: const Size(0, 30), padding: const EdgeInsets.symmetric(horizontal: 8))),
          TextButton.icon(onPressed: () => setState(() => _wps.add(_Wp(order: _wps.length, lat: -13.5319, lng: -71.9675, label: 'Paradero ${_wps.length + 1}'))), icon: const Icon(Icons.add, size: 14), label: Text('Manual', style: AppTheme.inter(fontSize: 11, fontWeight: FontWeight.w600)), style: TextButton.styleFrom(foregroundColor: AppColors.ink6, minimumSize: const Size(0, 30), padding: const EdgeInsets.symmetric(horizontal: 8))),
        ]),
        const SizedBox(height: 8),
        if (_wps.isEmpty)
          Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.ink2), borderRadius: BorderRadius.circular(12)), child: Column(children: [const Icon(Icons.place_outlined, size: 32, color: AppColors.ink3), const SizedBox(height: 8), Text('Sin paraderos', style: AppTheme.inter(fontSize: 13, color: AppColors.ink5))]))
        else
          ReorderableListView.builder(
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: _wps.length,
            onReorder: (o, n) { setState(() { if (n > o) n--; final it = _wps.removeAt(o); _wps.insert(n, it); }); },
            itemBuilder: (_, i) {
              final w = _wps[i];
              return Container(
                key: ValueKey('wp_${w.hashCode}_$i'),
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
                decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.ink2), borderRadius: BorderRadius.circular(10)),
                child: Row(children: [
                  Container(width: 26, height: 26, decoration: BoxDecoration(color: AppColors.goldBg, border: Border.all(color: AppColors.goldBorder), shape: BoxShape.circle), alignment: Alignment.center, child: Text('${i + 1}', style: AppTheme.inter(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.goldDark, tabular: true))),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SizedBox(height: 28, child: TextField(controller: w.ctl, style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.ink8), decoration: const InputDecoration(isDense: true, border: InputBorder.none, contentPadding: EdgeInsets.zero))),
                    Text('${w.lat.toStringAsFixed(5)}, ${w.lng.toStringAsFixed(5)}', style: AppTheme.inter(fontSize: 9.5, color: AppColors.ink4, tabular: true)),
                  ])),
                  ReorderableDragStartListener(index: i, child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.drag_handle, size: 18, color: AppColors.ink4))),
                  IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.noApto), onPressed: () { setState(() { w.ctl.dispose(); _wps.removeAt(i); }); }, visualDensity: VisualDensity.compact),
                ]),
              );
            },
          ),
      ]),
    );
  }
}

class _Wp {
  int order; double lat, lng;
  final TextEditingController ctl;
  _Wp({required this.order, required this.lat, required this.lng, required String label}) : ctl = TextEditingController(text: label);
}
