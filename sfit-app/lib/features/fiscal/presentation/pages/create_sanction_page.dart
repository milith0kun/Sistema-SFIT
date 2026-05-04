import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Formulario para emitir una sancion manual (rol fiscal).
///
/// Acepta opcionalmente `extra: { vehicleId, plate }` cuando se llega
/// desde un escaneo QR — preserva el vehiculo seleccionado y oculta
/// el autocomplete por placa.
class CreateSanctionPage extends ConsumerStatefulWidget {
  final String? presetVehicleId;
  final String? presetPlate;

  const CreateSanctionPage({
    super.key,
    this.presetVehicleId,
    this.presetPlate,
  });

  @override
  ConsumerState<CreateSanctionPage> createState() =>
      _CreateSanctionPageState();
}

class _CreateSanctionPageState extends ConsumerState<CreateSanctionPage> {
  final _formKey = GlobalKey<FormState>();
  final _searchCtrl = TextEditingController();
  final _amountSolesCtrl = TextEditingController();
  final _amountUitCtrl = TextEditingController();
  Timer? _debounce;

  String? _vehicleId;
  String? _plate;
  String? _faultType;
  bool _submitting = false;

  // Resultados de busqueda por placa
  List<Map<String, dynamic>> _searchResults = [];
  bool _searching = false;

  // Catalogo de tipos de falta segun el backend
  static const List<({String value, String label})> _faults = [
    (value: 'soat_vencido', label: 'SOAT vencido'),
    (
      value: 'revision_tecnica_vencida',
      label: 'Revision tecnica vencida'
    ),
    (value: 'exceso_velocidad', label: 'Exceso de velocidad'),
    (value: 'conduccion_temeraria', label: 'Conduccion temeraria'),
    (value: 'cobro_excesivo', label: 'Cobro excesivo'),
    (value: 'ruta_no_autorizada', label: 'Ruta no autorizada'),
    (
      value: 'documentacion_irregular',
      label: 'Documentacion irregular'
    ),
    (
      value: 'estado_mecanico_deficiente',
      label: 'Estado mecanico deficiente'
    ),
    (value: 'otro', label: 'Otro'),
  ];

  @override
  void initState() {
    super.initState();
    if (widget.presetVehicleId != null) {
      _vehicleId = widget.presetVehicleId;
      _plate = widget.presetPlate;
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _amountSolesCtrl.dispose();
    _amountUitCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  // ── Busqueda con debounce por placa/marca ───────────────────────
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    final term = value.trim();
    if (term.length < 2) {
      setState(() {
        _searchResults = [];
        _searching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _doSearch(term));
  }

  Future<void> _doSearch(String term) async {
    setState(() => _searching = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get(
        '/vehiculos',
        queryParameters: {'q': term, 'limit': 10},
      );
      final body = resp.data as Map?;
      if (body == null || body['success'] != true) {
        throw Exception('Respuesta invalida');
      }
      final data = body['data'] as Map<String, dynamic>;
      final items = (data['items'] as List? ?? const [])
          .cast<Map<String, dynamic>>();
      if (mounted) {
        setState(() {
          _searchResults = items;
          _searching = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _searchResults = [];
          _searching = false;
        });
      }
    }
  }

  void _selectVehicle(Map<String, dynamic> v) {
    setState(() {
      _vehicleId = v['id'] as String?;
      _plate = v['plate'] as String?;
      _searchResults = [];
      _searchCtrl.text = _plate ?? '';
    });
    FocusScope.of(context).unfocus();
  }

  // ── Submit ──────────────────────────────────────────────────────
  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_vehicleId == null) {
      _showSnack('Selecciona un vehiculo', AppColors.noApto);
      return;
    }
    if (_faultType == null) {
      _showSnack('Selecciona el tipo de falta', AppColors.noApto);
      return;
    }

    final amount = double.tryParse(_amountSolesCtrl.text.trim());
    if (amount == null || amount <= 0) {
      _showSnack('Monto en soles invalido', AppColors.noApto);
      return;
    }

    setState(() => _submitting = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.post(
        '/sanciones',
        data: {
          'vehicleId': _vehicleId,
          'faultType': _faultType,
          'amountSoles': amount,
          'amountUIT': _amountUitCtrl.text.trim(),
        },
      );
      final body = resp.data as Map?;
      if (body == null || body['success'] != true) {
        throw Exception(body?['error'] ?? 'No se pudo emitir la sancion');
      }
      final data = body['data'];
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sancion emitida correctamente'),
            backgroundColor: AppColors.apto,
            behavior: SnackBarBehavior.floating,
          ),
        );
        // Devolver al caller la sancion creada para refrescar listas
        context.pop(data);
      }
    } catch (e) {
      if (mounted) {
        _showSnack('Error: $e', AppColors.noApto);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: color),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasPreset = widget.presetVehicleId != null;

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Nueva sancion',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _SectionLabel(text: 'Vehiculo'),
              const SizedBox(height: 8),
              if (hasPreset)
                _ReadonlyPlateChip(plate: _plate ?? '—')
              else
                _VehicleSearchField(
                  controller: _searchCtrl,
                  selectedPlate: _plate,
                  searching: _searching,
                  results: _searchResults,
                  onChanged: _onSearchChanged,
                  onSelect: _selectVehicle,
                  onClear: () {
                    setState(() {
                      _vehicleId = null;
                      _plate = null;
                      _searchResults = [];
                      _searchCtrl.clear();
                    });
                  },
                ),
              const SizedBox(height: 18),

              const _SectionLabel(text: 'Tipo de falta'),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _faultType,
                isExpanded: true,
                decoration: _decoration(hint: 'Selecciona una falta'),
                items: _faults
                    .map((f) => DropdownMenuItem(
                          value: f.value,
                          child: Text(
                            f.label,
                            style: AppTheme.inter(
                                fontSize: 14, color: AppColors.ink8),
                          ),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _faultType = v),
                validator: (v) =>
                    v == null ? 'Selecciona una falta' : null,
              ),
              const SizedBox(height: 18),

              const _SectionLabel(text: 'Monto en soles'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountSolesCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                      RegExp(r'^\d*\.?\d{0,2}')),
                ],
                decoration: _decoration(hint: 'Ej: 252.50'),
                style: AppTheme.inter(
                    fontSize: 14, color: AppColors.ink8, tabular: true),
                validator: (v) {
                  final n = double.tryParse((v ?? '').trim());
                  if (n == null || n <= 0) {
                    return 'Ingresa un monto valido mayor a 0';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 18),

              const _SectionLabel(text: 'Monto en UIT'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountUitCtrl,
                decoration: _decoration(hint: 'Ej: 0.5 UIT'),
                style: AppTheme.inter(
                    fontSize: 14, color: AppColors.ink8),
                validator: (v) {
                  if ((v ?? '').trim().isEmpty) {
                    return 'Ingresa el monto en UIT';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 28),

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
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        'Emitir sancion',
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

  InputDecoration _decoration({required String hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
      isDense: true,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      filled: true,
      fillColor: Colors.white,
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
        borderSide:
            const BorderSide(color: AppColors.panel, width: 1.5),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel({required this.text});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTheme.inter(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: AppColors.ink7,
      ),
    );
  }
}

class _ReadonlyPlateChip extends StatelessWidget {
  final String plate;
  const _ReadonlyPlateChip({required this.plate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.goldBg,
        border: Border.all(color: AppColors.goldBorder),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.qr_code_scanner_rounded,
              size: 18, color: AppColors.goldDark),
          const SizedBox(width: 10),
          Text(
            plate,
            style: AppTheme.inter(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.ink9,
              tabular: true,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            'desde QR',
            style: AppTheme.inter(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.goldDark),
          ),
        ],
      ),
    );
  }
}

class _VehicleSearchField extends StatelessWidget {
  final TextEditingController controller;
  final String? selectedPlate;
  final bool searching;
  final List<Map<String, dynamic>> results;
  final ValueChanged<String> onChanged;
  final ValueChanged<Map<String, dynamic>> onSelect;
  final VoidCallback onClear;

  const _VehicleSearchField({
    required this.controller,
    required this.selectedPlate,
    required this.searching,
    required this.results,
    required this.onChanged,
    required this.onSelect,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: controller,
          onChanged: onChanged,
          textCapitalization: TextCapitalization.characters,
          decoration: InputDecoration(
            hintText: 'Buscar por placa…',
            hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
            prefixIcon:
                const Icon(Icons.search, size: 18, color: AppColors.ink4),
            suffixIcon: searching
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.gold,
                      ),
                    ),
                  )
                : (controller.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close,
                            size: 18, color: AppColors.ink4),
                        onPressed: onClear,
                      )
                    : null),
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            filled: true,
            fillColor: Colors.white,
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
              borderSide: const BorderSide(
                  color: AppColors.panel, width: 1.5),
            ),
          ),
          style: AppTheme.inter(
              fontSize: 14, color: AppColors.ink8, tabular: true),
        ),
        if (selectedPlate != null) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.aptoBg,
              border: Border.all(color: AppColors.aptoBorder),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle,
                    size: 16, color: AppColors.apto),
                const SizedBox(width: 8),
                Text(
                  'Seleccionado: $selectedPlate',
                  style: AppTheme.inter(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.apto,
                    tabular: true,
                  ),
                ),
              ],
            ),
          ),
        ],
        if (results.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.ink2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: results.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: AppColors.ink1),
              itemBuilder: (_, i) {
                final v = results[i];
                final plate = v['plate'] as String? ?? '—';
                final brand = v['brand'] as String? ?? '';
                final model = v['model'] as String? ?? '';
                return ListTile(
                  dense: true,
                  onTap: () => onSelect(v),
                  leading: const Icon(Icons.directions_car_outlined,
                      size: 20, color: AppColors.ink5),
                  title: Text(
                    plate,
                    style: AppTheme.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink9,
                      tabular: true,
                    ),
                  ),
                  subtitle: Text(
                    [brand, model]
                        .where((s) => s.isNotEmpty)
                        .join(' '),
                    style: AppTheme.inter(
                        fontSize: 12, color: AppColors.ink5),
                  ),
                  trailing: const Icon(Icons.chevron_right,
                      size: 18, color: AppColors.ink4),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}
