import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import 'operator_routes_page.dart' show Candidate;

/// Form: **"Crear como ruta nueva"** desde una captura GPS.
///
/// Llama a `POST /api/rutas/candidatas/:id/validar` con los datos del
/// formulario. Al éxito devuelve `true` por GoRouter para que la pantalla
/// anterior pueda hacer pop al listado.
class OperatorValidateCapturePage extends ConsumerStatefulWidget {
  final String candidateId;
  final Candidate? candidate;

  const OperatorValidateCapturePage({
    super.key,
    required this.candidateId,
    this.candidate,
  });

  @override
  ConsumerState<OperatorValidateCapturePage> createState() =>
      _OperatorValidateCapturePageState();
}

class _OperatorValidateCapturePageState
    extends ConsumerState<OperatorValidateCapturePage> {
  final _formKey = GlobalKey<FormState>();

  final _codeCtl = TextEditingController();
  final _nameCtl = TextEditingController();
  final _originCtl = TextEditingController();
  final _destCtl = TextEditingController();

  // Empresa: lista cargada del backend; pre-selecciona la primera disponible.
  bool _loadingCompanies = true;
  List<_CompanyOption> _companies = const [];
  String? _companyId;

  // Tipo de vehículo
  String? _vehicleTypeKey;
  static const _vehicleTypes = <_KV>[
    _KV('m1_auto', 'Auto / Taxi (M1)'),
    _KV('m2_combi', 'Combi (M2)'),
    _KV('m3_minibus', 'Minibús (M3)'),
    _KV('m3_omnibus', 'Ómnibus (M3)'),
    _KV('n1_camioneta', 'Camioneta (N1)'),
    _KV('otro', 'Otro'),
  ];

  // Alcance del servicio
  String _serviceScope = 'urbano_distrital';
  static const _scopes = <_KV>[
    _KV('urbano_distrital', 'Urbano distrital'),
    _KV('urbano_provincial', 'Urbano provincial'),
    _KV('interprovincial_regional', 'Interprovincial regional'),
    _KV('interregional_nacional', 'Interregional nacional'),
  ];

  bool _autoDetectStops = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _codeCtl.text = _generateCode();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadCompanies();
    });
  }

  @override
  void dispose() {
    _codeCtl.dispose();
    _nameCtl.dispose();
    _originCtl.dispose();
    _destCtl.dispose();
    super.dispose();
  }

  String _generateCode() {
    final r = math.Random();
    final n = r.nextInt(900) + 100; // 100..999
    return 'C-$n';
  }

  Future<void> _loadCompanies() async {
    setState(() => _loadingCompanies = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get(
        '/empresas',
        queryParameters: {'limit': 100},
      );
      final body = resp.data as Map?;
      final data = (body?['data'] as Map?) ?? body ?? const {};
      final raw = (data['items'] as List? ??
              data['empresas'] as List? ??
              const []);
      final list = raw
          .map((e) => _CompanyOption.fromJson(e as Map<String, dynamic>))
          .where((c) => c.id.isNotEmpty)
          .toList();
      if (mounted) {
        setState(() {
          _companies = list;
          // Pre-seleccionar la primera (asumimos que el backend filtró por
          // empresa del operador a través del JWT; si hay varias, deja al
          // usuario elegir).
          if (list.isNotEmpty) _companyId = list.first.id;
          _loadingCompanies = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _companies = const [];
          _loadingCompanies = false;
        });
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.post(
        '/rutas/candidatas/${widget.candidateId}/validar',
        data: {
          'code': _codeCtl.text.trim(),
          'name': _nameCtl.text.trim(),
          if (_companyId != null && _companyId!.isNotEmpty)
            'companyId': _companyId,
          if (_originCtl.text.trim().isNotEmpty)
            'originLabel': _originCtl.text.trim(),
          if (_destCtl.text.trim().isNotEmpty)
            'destinationLabel': _destCtl.text.trim(),
          if (_vehicleTypeKey != null) 'vehicleTypeKey': _vehicleTypeKey,
          'serviceScope': _serviceScope,
          'autoDetectStops': _autoDetectStops,
        },
      );

      final body = resp.data as Map?;
      final ok = body?['success'] == true;
      final data = (body?['data'] as Map?) ?? const {};
      final code = (data['code'] ?? _codeCtl.text.trim()).toString();
      final name = (data['name'] ?? _nameCtl.text.trim()).toString();

      if (!mounted) return;
      if (!ok) {
        throw _msgFromBody(body) ?? 'No se pudo crear la ruta';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Ruta creada: $code · $name'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.apto,
        ),
      );
      // Pop dos veces: salir del form y del detalle, volver al listado.
      Navigator.of(context).pop(true); // → detalle
      // El detalle observa la respuesta de su `_onCreateNewRoute` y hace
      // su propio pop hacia el listado.
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.noApto,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _msgFromBody(Map? body) {
    if (body == null) return null;
    final err = body['error'];
    if (err is String) return err;
    if (err is Map && err['message'] is String) {
      return err['message'] as String;
    }
    if (body['message'] is String) return body['message'] as String;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink9,
        title: Text(
          'Crear ruta desde captura',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'RF-09 · OPERADOR',
                style: AppTheme.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink5,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Validar captura',
                style: AppTheme.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.015,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Convertir esta captura GPS en una ruta oficial.',
                style: AppTheme.inter(
                  fontSize: 13,
                  color: AppColors.ink5,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 22),

              // ── Identificación ─────────────────────────────────
              const _SectionLabel(label: 'Identificación'),
              const SizedBox(height: 10),

              TextFormField(
                controller: _codeCtl,
                enabled: !_saving,
                style: AppTheme.inter(
                  fontSize: 14,
                  color: AppColors.ink9,
                  tabular: true,
                ),
                decoration: _decoration(
                  'Código',
                  hint: 'Ej. C-204',
                  suffixIcon: IconButton(
                    onPressed: _saving
                        ? null
                        : () => setState(() => _codeCtl.text = _generateCode()),
                    icon: const Icon(
                      Icons.refresh_rounded,
                      size: 20,
                      color: AppColors.ink6,
                    ),
                    tooltip: 'Regenerar código',
                  ),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _nameCtl,
                enabled: !_saving,
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
                decoration: _decoration(
                  'Nombre de la ruta',
                  hint: 'Ej. San Sebastián – Centro Histórico',
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 14),

              // ── Empresa ────────────────────────────────────────
              _loadingCompanies
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.ink2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(children: [
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
                          'Cargando empresas...',
                          style: AppTheme.inter(
                            fontSize: 13,
                            color: AppColors.ink5,
                          ),
                        ),
                      ]),
                    )
                  : _companies.length <= 1
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 14,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.ink1,
                            border: Border.all(color: AppColors.ink2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(children: [
                            const Icon(
                              Icons.business_outlined,
                              size: 17,
                              color: AppColors.ink6,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'EMPRESA',
                                    style: AppTheme.inter(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.ink5,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _companies.isEmpty
                                        ? 'Sin empresa asignada'
                                        : _companies.first.name,
                                    style: AppTheme.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.ink9,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ]),
                        )
                      : DropdownButtonFormField<String>(
                          value: _companyId,
                          decoration: _decoration('Empresa'),
                          items: _companies
                              .map((c) => DropdownMenuItem(
                                    value: c.id,
                                    child: Text(
                                      c.name,
                                      style: AppTheme.inter(
                                        fontSize: 14,
                                        color: AppColors.ink9,
                                      ),
                                    ),
                                  ))
                              .toList(),
                          onChanged: _saving
                              ? null
                              : (v) => setState(() => _companyId = v),
                          validator: (v) => (v == null || v.isEmpty)
                              ? 'Selecciona una empresa'
                              : null,
                        ),
              const SizedBox(height: 26),

              // ── Origen / Destino ───────────────────────────────
              const _SectionLabel(label: 'Origen y destino (opcionales)'),
              const SizedBox(height: 10),

              TextFormField(
                controller: _originCtl,
                enabled: !_saving,
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
                decoration: _decoration(
                  'Origen',
                  hint: 'Ej. Plaza San Sebastián',
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _destCtl,
                enabled: !_saving,
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
                decoration: _decoration(
                  'Destino',
                  hint: 'Ej. Plaza de Armas Cusco',
                ),
              ),
              const SizedBox(height: 26),

              // ── Tipo y alcance ─────────────────────────────────
              const _SectionLabel(label: 'Operación'),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _vehicleTypeKey,
                decoration: _decoration('Tipo de vehículo'),
                hint: Text(
                  'Seleccionar tipo',
                  style: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
                ),
                items: _vehicleTypes
                    .map((t) => DropdownMenuItem(
                          value: t.key,
                          child: Text(
                            t.label,
                            style: AppTheme.inter(
                              fontSize: 14,
                              color: AppColors.ink9,
                            ),
                          ),
                        ))
                    .toList(),
                onChanged: _saving
                    ? null
                    : (v) => setState(() => _vehicleTypeKey = v),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                value: _serviceScope,
                decoration: _decoration('Alcance del servicio'),
                items: _scopes
                    .map((s) => DropdownMenuItem(
                          value: s.key,
                          child: Text(
                            s.label,
                            style: AppTheme.inter(
                              fontSize: 14,
                              color: AppColors.ink9,
                            ),
                          ),
                        ))
                    .toList(),
                onChanged: _saving
                    ? null
                    : (v) =>
                        setState(() => _serviceScope = v ?? _serviceScope),
              ),
              const SizedBox(height: 22),

              // ── Auto-detect stops ──────────────────────────────
              Container(
                padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: AppColors.ink2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.infoBg,
                      border: Border.all(color: AppColors.infoBorder),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.auto_fix_high_outlined,
                      size: 18,
                      color: AppColors.info,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Detectar paradas automáticamente',
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: AppColors.ink9,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'El sistema marcará paradas donde el bus estuvo más de 30 segundos quieto.',
                          style: AppTheme.inter(
                            fontSize: 11.5,
                            color: AppColors.ink5,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _autoDetectStops,
                    onChanged: _saving
                        ? null
                        : (v) => setState(() => _autoDetectStops = v),
                    activeColor: AppColors.gold,
                  ),
                ]),
              ),
              const SizedBox(height: 26),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: _saving ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.ink3,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'Crear ruta',
                          style: AppTheme.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Decorations ────────────────────────────────────────────────────────

  InputDecoration _decoration(
    String label, {
    String? hint,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      labelStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
      hintStyle: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      suffixIcon: suffixIcon,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.ink3),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.ink3),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.panel, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.noApto),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.noApto, width: 1.5),
      ),
    );
  }
}

class _CompanyOption {
  final String id;
  final String name;
  const _CompanyOption({required this.id, required this.name});

  factory _CompanyOption.fromJson(Map<String, dynamic> j) => _CompanyOption(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        name: (j['name'] ?? j['razonSocial'] ?? '—').toString(),
      );
}

class _KV {
  final String key;
  final String label;
  const _KV(this.key, this.label);
}

class _SectionLabel extends StatelessWidget {
  final String label;
  // ignore: unused_element_parameter
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
