import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/apiperu_service.dart';
import '../../data/datasources/admin_api_service.dart';

/// RF-04-01 · Registro y listado de empresas — Rol ADMIN MUNICIPAL.
class AdminEmpresasPage extends ConsumerStatefulWidget {
  const AdminEmpresasPage({super.key});

  @override
  ConsumerState<AdminEmpresasPage> createState() => _AdminEmpresasPageState();
}

class _AdminEmpresasPageState extends ConsumerState<AdminEmpresasPage> {
  List<Map<String, dynamic>> _empresas = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(adminApiServiceProvider).getEmpresas();
      if (mounted) {
        setState(() {
          _empresas = List<Map<String, dynamic>>.from(data['items'] as List);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _openCrear() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _NuevaEmpresaSheet(),
    );
    if (created == true) _load();
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
          'Empresas',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: _load,
            tooltip: 'Actualizar',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCrear,
        backgroundColor: AppColors.gold,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text('Nueva empresa', style: AppTheme.inter(fontWeight: FontWeight.w600)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : _empresas.isEmpty
                  ? _EmptyView(onAdd: _openCrear)
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _empresas.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) => _EmpresaTile(
                          empresa: _empresas[i],
                          onToggle: (active) async {
                            await ref
                                .read(adminApiServiceProvider)
                                .toggleEmpresaStatus(_empresas[i]['id'] as String, active: active);
                            _load();
                          },
                        ),
                      ),
                    ),
    );
  }
}

// ── Tile ────────────────────────────────────────────────────────────

class _EmpresaTile extends StatelessWidget {
  final Map<String, dynamic> empresa;
  final void Function(bool active) onToggle;

  const _EmpresaTile({required this.empresa, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final bool active = empresa['active'] as bool? ?? true;
    final rep = empresa['representanteLegal'] as Map<String, dynamic>?;
    final typeKeys = (empresa['vehicleTypeKeys'] as List?)?.cast<String>() ?? [];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      empresa['razonSocial'] as String? ?? '—',
                      style: AppTheme.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink9,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'RUC ${empresa['ruc'] as String? ?? '—'}',
                      style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                    ),
                  ],
                ),
              ),
              _StatusChip(active: active),
              const SizedBox(width: 8),
              Switch(
                value: active,
                onChanged: onToggle,
                activeThumbColor: AppColors.gold,
                activeTrackColor: AppColors.goldBorder,
              ),
            ],
          ),
          if (rep != null) ...[
            const SizedBox(height: 8),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.person_outline, size: 14, color: AppColors.ink5),
                const SizedBox(width: 4),
                Text(
                  rep['name'] as String? ?? '—',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink7),
                ),
                const SizedBox(width: 12),
                const Icon(Icons.badge_outlined, size: 14, color: AppColors.ink5),
                const SizedBox(width: 4),
                Text(
                  'DNI ${rep['dni'] as String? ?? '—'}',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink7),
                ),
              ],
            ),
          ],
          if (typeKeys.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              children: typeKeys.map((k) => _TypeChip(typeKey: k)).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final bool active;
  const _StatusChip({required this.active});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: active ? AppColors.apto.withAlpha(30) : AppColors.noApto.withAlpha(30),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        active ? 'Activa' : 'Inactiva',
        style: AppTheme.inter(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: active ? AppColors.apto : AppColors.noApto,
        ),
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String typeKey;
  const _TypeChip({required this.typeKey});

  static const _labels = {
    'transporte_publico': 'T. público',
    'limpieza_residuos': 'Limpieza',
    'emergencia': 'Emergencia',
    'maquinaria': 'Maquinaria',
    'municipal_general': 'General',
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.ink2,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        _labels[typeKey] ?? typeKey,
        style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.ink6),
      ),
    );
  }
}

// ── Bottom sheet de creación ────────────────────────────────────────

class _NuevaEmpresaSheet extends ConsumerStatefulWidget {
  const _NuevaEmpresaSheet();

  @override
  ConsumerState<_NuevaEmpresaSheet> createState() => _NuevaEmpresaSheetState();
}

class _NuevaEmpresaSheetState extends ConsumerState<_NuevaEmpresaSheet> {
  final _formKey      = GlobalKey<FormState>();
  final _rucCtrl      = TextEditingController();
  final _razonCtrl    = TextEditingController();
  final _repNombreCtrl = TextEditingController();
  final _repDniCtrl   = TextEditingController();
  final _repPhoneCtrl = TextEditingController();

  bool _lookingUpRuc = false;
  bool _lookingUpDni = false;
  bool _saving       = false;
  String? _rucError;

  static const _vehicleTypes = [
    ('transporte_publico', 'Transporte público'),
    ('limpieza_residuos',  'Limpieza'),
    ('emergencia',         'Emergencia'),
    ('maquinaria',         'Maquinaria'),
    ('municipal_general',  'Vehículo general'),
  ];

  final Set<String> _selectedTypes = {};

  @override
  void dispose() {
    _rucCtrl.dispose();
    _razonCtrl.dispose();
    _repNombreCtrl.dispose();
    _repDniCtrl.dispose();
    _repPhoneCtrl.dispose();
    super.dispose();
  }

  // ── Consultas API Perú ────────────────────────────────────────

  Future<void> _lookupRuc() async {
    final ruc = _rucCtrl.text.trim();
    if (ruc.length != 11) return;
    setState(() { _lookingUpRuc = true; _rucError = null; });
    try {
      final result = await ref.read(apiPeruServiceProvider).consultarRuc(ruc);
      if (!mounted) return;
      _razonCtrl.text = result.razonSocial;
      if (!result.esActivo) {
        setState(() => _rucError = 'Empresa ${result.estado} / ${result.condicion}');
      }
    } catch (e) {
      if (mounted) setState(() => _rucError = 'No se encontró el RUC en SUNAT');
    } finally {
      if (mounted) setState(() => _lookingUpRuc = false);
    }
  }

  Future<void> _lookupDni() async {
    final dni = _repDniCtrl.text.trim();
    if (dni.length != 8) return;
    setState(() => _lookingUpDni = true);
    try {
      final result = await ref.read(apiPeruServiceProvider).consultarDni(dni);
      if (!mounted) return;
      if (result.nombreCompleto.isNotEmpty) {
        _repNombreCtrl.text = result.nombreCompleto;
      }
    } catch (_) {
      // Silencioso — usuario puede escribir el nombre
    } finally {
      if (mounted) setState(() => _lookingUpDni = false);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref.read(adminApiServiceProvider).createEmpresa(
            ruc: _rucCtrl.text.trim(),
            razonSocial: _razonCtrl.text.trim(),
            repNombre: _repNombreCtrl.text.trim(),
            repDni: _repDniCtrl.text.trim(),
            repPhone: _repPhoneCtrl.text.trim().isEmpty ? null : _repPhoneCtrl.text.trim(),
            vehicleTypeKeys: _selectedTypes.toList(),
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Build ──────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottom),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.ink3,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Nueva empresa',
                style: AppTheme.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.ink9),
              ),
              const SizedBox(height: 20),

              // ── RUC ─────────────────────────────────────────
              _SectionLabel('Datos de la empresa'),
              const SizedBox(height: 10),
              TextFormField(
                controller: _rucCtrl,
                keyboardType: TextInputType.number,
                maxLength: 11,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: _deco(
                  label: 'RUC *',
                  hint: '11 dígitos',
                  counterText: '',
                  suffixIcon: _lookingUpRuc
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : IconButton(
                          icon: const Icon(Icons.search, size: 20),
                          tooltip: 'Consultar SUNAT',
                          onPressed: _lookupRuc,
                        ),
                ),
                onChanged: (v) {
                  if (v.length == 11) _lookupRuc();
                },
                validator: (v) {
                  if (v == null || v.trim().length != 11) return 'RUC debe tener 11 dígitos';
                  return null;
                },
              ),
              if (_rucError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4, left: 12),
                  child: Text(_rucError!, style: AppTheme.inter(fontSize: 12, color: AppColors.noApto)),
                ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _razonCtrl,
                textCapitalization: TextCapitalization.characters,
                decoration: _deco(label: 'Razón social *', hint: 'Se autocompleta con RUC'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 20),

              // ── Representante legal ──────────────────────────
              _SectionLabel('Representante legal'),
              const SizedBox(height: 10),
              TextFormField(
                controller: _repDniCtrl,
                keyboardType: TextInputType.number,
                maxLength: 8,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: _deco(
                  label: 'DNI *',
                  hint: '8 dígitos',
                  counterText: '',
                  suffixIcon: _lookingUpDni
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : IconButton(
                          icon: const Icon(Icons.search, size: 20),
                          tooltip: 'Consultar RENIEC',
                          onPressed: _lookupDni,
                        ),
                ),
                onChanged: (v) {
                  if (v.length == 8) _lookupDni();
                },
                validator: (v) {
                  if (v == null || v.trim().length < 6) return 'DNI requerido';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _repNombreCtrl,
                decoration: _deco(label: 'Nombre completo *', hint: 'Se autocompleta con DNI'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _repPhoneCtrl,
                keyboardType: TextInputType.phone,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: _deco(label: 'Teléfono (opcional)', hint: '9XXXXXXXX'),
              ),
              const SizedBox(height: 20),

              // ── Tipos de vehículo ────────────────────────────
              _SectionLabel('Tipos de vehículo (opcional)'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _vehicleTypes.map((type) {
                  final key      = type.$1;
                  final label    = type.$2;
                  final selected = _selectedTypes.contains(key);
                  return FilterChip(
                    label: Text(
                      label,
                      style: AppTheme.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: selected ? Colors.white : AppColors.ink7,
                      ),
                    ),
                    selected: selected,
                    onSelected: (v) => setState(() {
                      if (v) { _selectedTypes.add(key); } else { _selectedTypes.remove(key); }
                    }),
                    selectedColor: AppColors.gold,
                    backgroundColor: AppColors.ink1,
                    checkmarkColor: Colors.white,
                    side: BorderSide.none,
                  );
                }).toList(),
              ),
              const SizedBox(height: 28),

              // ── Botón guardar ────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          'Registrar empresa',
                          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
                        ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _deco({
    required String label,
    String? hint,
    Widget? suffixIcon,
    String? counterText,
  }) =>
      InputDecoration(
        labelText: label,
        hintText: hint,
        counterText: counterText,
        suffixIcon: suffixIcon,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink3),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.gold, width: 1.5),
        ),
        filled: true,
        fillColor: AppColors.ink1,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      );
}

// ── Helpers ─────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: AppTheme.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.ink5,
          letterSpacing: 1.2,
        ),
      );
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 48, color: AppColors.ink4),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: onRetry,
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      );
}

class _EmptyView extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyView({required this.onAdd});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.business_outlined, size: 56, color: AppColors.ink3),
              const SizedBox(height: 12),
              Text(
                'No hay empresas registradas',
                style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink6),
              ),
              const SizedBox(height: 6),
              Text(
                'Agrega la primera empresa de tu municipalidad.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: onAdd,
                icon: const Icon(Icons.add),
                label: const Text('Nueva empresa'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(160, 44),
                ),
              ),
            ],
          ),
        ),
      );
}
