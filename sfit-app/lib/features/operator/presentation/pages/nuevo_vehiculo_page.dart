import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../ai_ocr/presentation/pages/document_ocr_page.dart';
import '../../data/datasources/operator_api_service.dart';

/// RF-05-02 · Registro de vehículo — Rol OPERADOR.
class NuevoVehiculoPage extends ConsumerStatefulWidget {
  const NuevoVehiculoPage({super.key});

  @override
  ConsumerState<NuevoVehiculoPage> createState() => _NuevoVehiculoPageState();
}

class _NuevoVehiculoPageState extends ConsumerState<NuevoVehiculoPage> {
  final _formKey = GlobalKey<FormState>();

  final _plateCtrl      = TextEditingController();
  final _brandCtrl      = TextEditingController();
  final _modelCtrl      = TextEditingController();
  final _yearCtrl       = TextEditingController();
  final _soatExpiryCtrl = TextEditingController();

  String? _vehicleTypeKey;
  bool _saving = false;

  // Empresa del operador (cargada desde /api/operador/mi-empresa).
  // El backend deriva companyId del rol del operador, por eso este form
  // NO envía companyId — el banner es solo informativo / read-only.
  String? _companyName;
  bool _loadingCompany = true;
  String? _companyError;

  static const _vehicleTypes = [
    ('transporte_publico', 'Transporte público'),
    ('limpieza_residuos',  'Limpieza'),
    ('emergencia',         'Emergencia'),
    ('maquinaria',         'Maquinaria'),
    ('municipal_general',  'Vehículo general'),
  ];

  @override
  void initState() {
    super.initState();
    _loadMiEmpresa();
  }

  @override
  void dispose() {
    _plateCtrl.dispose();
    _brandCtrl.dispose();
    _modelCtrl.dispose();
    _yearCtrl.dispose();
    _soatExpiryCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMiEmpresa() async {
    try {
      final data = await ref.read(operatorApiServiceProvider).getMiEmpresa();
      if (!mounted) return;
      setState(() {
        _companyName = data['razonSocial'] as String?;
        _loadingCompany = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      final code = e.response?.statusCode;
      String msg;
      if (code == 404) {
        msg = 'Tu cuenta no tiene una empresa asignada.';
      } else {
        final data = e.response?.data;
        if (data is Map && data['error'] is String) {
          msg = data['error'] as String;
        } else {
          msg = 'No se pudo cargar tu empresa.';
        }
      }
      setState(() {
        _companyError = msg;
        _loadingCompany = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _companyError = 'No se pudo cargar tu empresa.';
        _loadingCompany = false;
      });
    }
  }

  // ── OCR helpers ────────────────────────────────────────────────

  Future<void> _scanTarjetaCirculacion() async {
    final result = await context.push<Map<String, dynamic>>(
      '/ocr-documento',
      extra: {'docType': OcrDocType.tarjetaCirculacion},
    );
    if (result == null || !mounted) return;

    int filled = 0;
    final placa  = result['placa'] as String?;
    final marca  = result['marca'] as String?;
    final modelo = result['modelo'] as String?;
    final anio   = result['anio'];

    if (placa != null && placa.isNotEmpty) {
      _plateCtrl.text = placa.toUpperCase();
      filled++;
    }
    if (marca != null && marca.isNotEmpty) {
      _brandCtrl.text = marca;
      filled++;
    }
    if (modelo != null && modelo.isNotEmpty) {
      _modelCtrl.text = modelo;
      filled++;
    }
    if (anio != null) {
      _yearCtrl.text = anio.toString();
      filled++;
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Tarjeta escaneada — $filled campo${filled == 1 ? '' : 's'} rellenado${filled == 1 ? '' : 's'}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _scanSoat() async {
    final result = await context.push<Map<String, dynamic>>(
      '/ocr-documento',
      extra: {'docType': OcrDocType.soat},
    );
    if (result == null || !mounted) return;

    int filled = 0;
    final vigencia = result['vigencia'] as String?;

    if (vigencia != null && vigencia.isNotEmpty) {
      _soatExpiryCtrl.text = vigencia;
      filled++;
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'SOAT escaneado — $filled campo${filled == 1 ? '' : 's'} rellenado${filled == 1 ? '' : 's'}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // ── Submit ──────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final svc  = ref.read(operatorApiServiceProvider);
      final year = int.tryParse(_yearCtrl.text.trim()) ?? 0;
      await svc.createVehiculo(
        plate:          _plateCtrl.text.trim().toUpperCase(),
        brand:          _brandCtrl.text.trim(),
        model:          _modelCtrl.text.trim(),
        year:           year,
        vehicleTypeKey: _vehicleTypeKey!,
        soatExpiry:     _soatExpiryCtrl.text.trim().isEmpty
                            ? null
                            : _soatExpiryCtrl.text.trim(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al registrar vehículo: $e'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.noApto,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Build ───────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink9,
        title: Text(
          'Registrar vehículo',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Kicker
              Text(
                'RF-05-02 · OPERADOR',
                style: AppTheme.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink5,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Nuevo vehículo',
                style: AppTheme.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.015,
                ),
              ),
              const SizedBox(height: 16),

              // ── Banner empresa del operador (read-only) ───────
              _CompanyBanner(
                loading: _loadingCompany,
                companyName: _companyName,
                error: _companyError,
              ),
              const SizedBox(height: 20),

              // ── Bloque OCR ─────────────────────────────────────
              _SectionLabel(label: 'Escanear documentos'),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _scanTarjetaCirculacion,
                      icon: const Icon(Icons.document_scanner_outlined, size: 18),
                      label: const Text('Tarjeta circulación'),
                      style: _ocrButtonStyle(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _scanSoat,
                      icon: const Icon(Icons.document_scanner_outlined, size: 18),
                      label: const Text('Escanear SOAT'),
                      style: _ocrButtonStyle(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // ── Datos del vehículo ─────────────────────────────
              _SectionLabel(label: 'Datos del vehículo'),
              const SizedBox(height: 10),

              // Placa (uppercase forced)
              TextFormField(
                controller: _plateCtrl,
                enabled: !_saving,
                textCapitalization: TextCapitalization.characters,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\-]')),
                  _UpperCaseFormatter(),
                ],
                style: AppTheme.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  tabular: true,
                  letterSpacing: 0.5,
                ),
                decoration: _fieldDecoration('Placa', hint: 'Ej. ABC-123'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: _buildField(
                      controller: _brandCtrl,
                      label: 'Marca',
                      hint: 'Ej. Toyota',
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? 'Campo requerido'
                          : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: _buildField(
                      controller: _modelCtrl,
                      label: 'Modelo',
                      hint: 'Ej. Hiace',
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? 'Campo requerido'
                          : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Año
              TextFormField(
                controller: _yearCtrl,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: AppTheme.inter(
                  fontSize: 14,
                  color: AppColors.ink9,
                  tabular: true,
                ),
                decoration: _fieldDecoration('Año', hint: 'Ej. 2022'),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Campo requerido';
                  final y = int.tryParse(v.trim());
                  if (y == null || y < 1990 || y > 2026) {
                    return 'Año entre 1990 y 2026';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Dropdown tipo de vehículo
              DropdownButtonFormField<String>(
                value: _vehicleTypeKey,
                decoration: _fieldDecoration('Tipo de vehículo'),
                hint: Text(
                  'Seleccionar tipo',
                  style: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
                ),
                items: _vehicleTypes
                    .map(
                      (t) => DropdownMenuItem(
                        value: t.$1,
                        child: Text(
                          t.$2,
                          style: AppTheme.inter(
                            fontSize: 14,
                            color: AppColors.ink9,
                          ),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _saving
                    ? null
                    : (val) => setState(() => _vehicleTypeKey = val),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Selecciona un tipo' : null,
              ),
              const SizedBox(height: 28),

              // ── SOAT ──────────────────────────────────────────
              _SectionLabel(label: 'Seguro SOAT (opcional)'),
              const SizedBox(height: 10),

              _buildField(
                controller: _soatExpiryCtrl,
                label: 'Vencimiento SOAT',
                hint: 'DD/MM/AAAA',
                keyboardType: TextInputType.datetime,
              ),
              const SizedBox(height: 32),

              // ── Botón guardar ──────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: (_saving || _companyName == null) ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ink9,
                    foregroundColor: Colors.white,
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
                          'Registrar vehículo',
                          style: AppTheme.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers de estilo ───────────────────────────────────────────

  InputDecoration _fieldDecoration(String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      labelStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
      hintStyle: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    String? hint,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      enabled: !_saving,
      style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
      decoration: _fieldDecoration(label, hint: hint),
      validator: validator,
    );
  }

  ButtonStyle _ocrButtonStyle() => OutlinedButton.styleFrom(
        foregroundColor: AppColors.panel,
        side: const BorderSide(color: AppColors.ink3),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.symmetric(vertical: 12),
        textStyle: AppTheme.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      );
}

// ── UpperCase formatter ───────────────────────────────────────────────────────

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}

// ── Section label helper ──────────────────────────────────────────────────────

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

// ── Company banner (read-only) ────────────────────────────────────────────────
//
// Muestra la razón social de la empresa del operador autenticado. El operador
// NO puede elegir empresa: el backend deriva companyId de su sesión. Este
// banner es informativo para que sepa a qué empresa quedará vinculado el
// recurso.

class _CompanyBanner extends StatelessWidget {
  final bool loading;
  final String? companyName;
  final String? error;

  const _CompanyBanner({
    required this.loading,
    required this.companyName,
    required this.error,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.ink1,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.ink5,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'Cargando empresa…',
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
          ],
        ),
      );
    }

    final hasError = error != null || companyName == null;
    if (hasError) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.noAptoBg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.noAptoBorder),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline,
                size: 18, color: AppColors.noApto),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                error ??
                    'Tu cuenta no tiene una empresa asignada. Contacta al administrador.',
                style: AppTheme.inter(
                  fontSize: 12.5,
                  color: AppColors.noApto,
                  fontWeight: FontWeight.w600,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.aptoBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.aptoBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.business, size: 18, color: AppColors.apto),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Se registrará en tu empresa',
                  style: AppTheme.inter(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.apto,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  companyName!,
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
