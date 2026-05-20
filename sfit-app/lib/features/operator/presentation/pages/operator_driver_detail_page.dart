import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../../../shared/models/conductor_model.dart';
import '../../data/datasources/operator_api_service.dart';

/// Detalle del conductor para el rol OPERADOR.
///
/// Muestra datos completos (DNI, licencia, métricas) y permite tres acciones
/// administrativas sobre el conductor:
///   - **Editar**: nombre, DNI, licencia (number/categoría), teléfono.
///     PATCH `/api/conductores/:id`. El cambio de `status` (fatiga) está
///     bloqueado server-side para el operador.
///   - **Quitar de mi empresa**: setea Driver.companyId = null sin
///     desactivar al conductor. DELETE `/api/operador/conductores/:id/asociar`.
///   - **Desactivar**: marca active = false. El conductor desaparece de la
///     lista. DELETE `/api/conductores/:id`.
class OperatorDriverDetailPage extends ConsumerStatefulWidget {
  final String driverId;
  final ConductorModel? seed;

  const OperatorDriverDetailPage({
    super.key,
    required this.driverId,
    this.seed,
  });

  @override
  ConsumerState<OperatorDriverDetailPage> createState() =>
      _OperatorDriverDetailPageState();
}

class _OperatorDriverDetailPageState
    extends ConsumerState<OperatorDriverDetailPage> {
  ConductorModel? _driver;
  bool _loading = true;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _driver = widget.seed;
    _loading = widget.seed == null;
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final svc = ref.read(operatorApiServiceProvider);
      final data = await svc.getConductorDetail(widget.driverId);
      if (!mounted) return;
      setState(() {
        _driver = ConductorModel.fromJson(data);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudo cargar el conductor: ${_extractError(e)}';
        _loading = false;
      });
    }
  }

  Future<void> _openEdit() async {
    final d = _driver;
    if (d == null) return;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _EditDriverSheet(driver: d),
    );
    if (saved == true) await _load();
  }

  Future<void> _confirmAndUnlink() async {
    final d = _driver;
    if (d == null) return;
    final ok = await _confirm(
      title: 'Quitar de mi empresa',
      message:
          '${d.name} quedará disponible para asociarse a otra empresa. '
          'Sus datos y métricas se conservan.',
      confirmLabel: 'Quitar',
      destructive: false,
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(operatorApiServiceProvider).desasociarConductor(d.id);
      if (!mounted) return;
      _showSnack('${d.name} fue desasociado de tu empresa.', AppColors.apto);
      // Tras desasociar, el conductor ya no debe verse en la lista del
      // operador — cerramos la pantalla.
      context.pop(true);
    } catch (e) {
      if (!mounted) return;
      _showSnack('Error: ${_extractError(e)}', AppColors.noApto);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmAndDeactivate() async {
    final d = _driver;
    if (d == null) return;
    final ok = await _confirm(
      title: 'Desactivar conductor',
      message:
          '${d.name} dejará de aparecer en tu lista y no podrá iniciar '
          'turnos. La acción es reversible desde el panel municipal.',
      confirmLabel: 'Desactivar',
      destructive: true,
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(operatorApiServiceProvider).deactivateConductor(d.id);
      if (!mounted) return;
      _showSnack('${d.name} fue desactivado.', AppColors.apto);
      context.pop(true);
    } catch (e) {
      if (!mounted) return;
      _showSnack('Error: ${_extractError(e)}', AppColors.noApto);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool?> _confirm({
    required String title,
    required String message,
    required String confirmLabel,
    required bool destructive,
  }) =>
      showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor:
                    destructive ? AppColors.noApto : AppColors.ink9,
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(confirmLabel),
            ),
          ],
        ),
      );

  void _showSnack(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: color,
      ),
    );
  }

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) {
        return data['error'] as String;
      }
      if (data is Map && data['message'] is String) {
        return data['message'] as String;
      }
    }
    return 'Operación falló';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Conductor',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        actions: [
          if (!_loading && _driver != null)
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_outlined, color: AppColors.ink9),
              onPressed: _busy ? null : _openEdit,
            ),
        ],
      ),
      body: _loading
          ? const SfitLoading.page(color: AppColors.gold)
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _driver == null
                  ? const SizedBox.shrink()
                  : _buildContent(_driver!),
    );
  }

  Widget _buildContent(ConductorModel d) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        _Header(driver: d),
        const SizedBox(height: 16),
        _Section(
          title: 'Datos personales',
          icon: Icons.person_outline,
          children: [
            _Row(label: 'Nombre', value: d.name.isEmpty ? '—' : d.name),
            _Row(label: 'DNI', value: d.dni ?? '—', monospace: true),
            _Row(label: 'Teléfono', value: d.phone ?? '—', monospace: true),
            if (d.email.isNotEmpty)
              _Row(label: 'Email', value: d.email),
          ],
        ),
        const SizedBox(height: 10),
        _Section(
          title: 'Licencia',
          icon: Icons.credit_card_outlined,
          children: [
            _Row(label: 'Número', value: d.licenseNumber ?? '—', monospace: true),
            _Row(label: 'Categoría', value: d.licenseCategory ?? '—'),
            if (d.licenseExpiry != null)
              _Row(
                label: 'Vencimiento',
                value:
                    '${d.licenseExpiry!.year}-${d.licenseExpiry!.month.toString().padLeft(2, '0')}-${d.licenseExpiry!.day.toString().padLeft(2, '0')}',
                monospace: true,
              ),
          ],
        ),
        const SizedBox(height: 10),
        _Section(
          title: 'Empresa',
          icon: Icons.business_outlined,
          children: [
            _Row(label: 'Razón social', value: d.companyName ?? '—'),
            if (d.companyRuc != null && d.companyRuc!.isNotEmpty)
              _Row(label: 'RUC', value: d.companyRuc!, monospace: true),
          ],
        ),
        const SizedBox(height: 10),
        _Section(
          title: 'Operación',
          icon: Icons.timer_outlined,
          children: [
            _Row(
              label: 'Horas continuas',
              value: d.continuousHours != null
                  ? '${d.continuousHours!.toStringAsFixed(1)} h'
                  : '—',
              monospace: true,
            ),
            _Row(
              label: 'Reputación',
              value: d.reputationScore != null
                  ? '${d.reputationScore}/100'
                  : '—',
              monospace: true,
            ),
          ],
        ),
        const SizedBox(height: 20),
        // Kicker antes de los botones de acción para separar contenido
        // informativo de las operaciones administrativas.
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'ACCIONES',
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink5,
              letterSpacing: 1.6,
            ),
          ),
        ),
        // Acciones administrativas. Quitar es reversible (otra empresa o
        // el propio conductor puede re-asociar). Desactivar deshabilita
        // login del conductor — más severo, lo dejamos en último lugar y
        // con color rojo para que no se confunda.
        _ActionTile(
          icon: Icons.edit_outlined,
          label: 'Editar datos del conductor',
          description: 'Nombre, DNI, licencia, teléfono.',
          onTap: _busy ? null : _openEdit,
        ),
        const SizedBox(height: 8),
        _ActionTile(
          icon: Icons.link_off,
          label: 'Quitar de mi empresa',
          description:
              'El conductor queda libre para asociarse a otra empresa. '
              'Reversible.',
          onTap: _busy ? null : _confirmAndUnlink,
        ),
        const SizedBox(height: 8),
        _ActionTile(
          icon: Icons.person_off_outlined,
          label: 'Desactivar conductor',
          description: 'Deja de aparecer y no puede iniciar turnos.',
          destructive: true,
          onTap: _busy ? null : _confirmAndDeactivate,
        ),
      ],
    );
  }
}

// ── Acción individual (tile) ───────────────────────────────────────────────

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String description;
  final bool destructive;
  final VoidCallback? onTap;

  const _ActionTile({
    required this.icon,
    required this.label,
    required this.description,
    this.onTap,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.noApto : AppColors.ink9;
    final borderColor =
        destructive ? AppColors.noAptoBorder : AppColors.ink2;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: destructive ? AppColors.noAptoBg : AppColors.ink1,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: color,
                        letterSpacing: -0.005,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: AppTheme.inter(
                        fontSize: 11.5,
                        color: AppColors.ink5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Icon(Icons.chevron_right,
                  size: 18,
                  color:
                      destructive ? AppColors.noApto : AppColors.ink4),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Bottom sheet de edición ────────────────────────────────────────────────

class _EditDriverSheet extends ConsumerStatefulWidget {
  final ConductorModel driver;
  const _EditDriverSheet({required this.driver});

  @override
  ConsumerState<_EditDriverSheet> createState() => _EditDriverSheetState();
}

class _EditDriverSheetState extends ConsumerState<_EditDriverSheet> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _name;
  late TextEditingController _dni;
  late TextEditingController _licNumber;
  late TextEditingController _licCategory;
  late TextEditingController _phone;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.driver.name);
    _dni = TextEditingController(text: widget.driver.dni ?? '');
    _licNumber = TextEditingController(text: widget.driver.licenseNumber ?? '');
    _licCategory =
        TextEditingController(text: widget.driver.licenseCategory ?? '');
    _phone = TextEditingController(text: widget.driver.phone ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _dni.dispose();
    _licNumber.dispose();
    _licCategory.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(operatorApiServiceProvider).updateConductor(
            widget.driver.id,
            name: _name.text.trim(),
            dni: _dni.text.trim(),
            licenseNumber: _licNumber.text.trim(),
            licenseCategory: _licCategory.text.trim(),
            phone: _phone.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _extractError(e);
        _saving = false;
      });
    }
  }

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) {
        return data['error'] as String;
      }
      if (data is Map && data['message'] is String) {
        return data['message'] as String;
      }
    }
    return 'No se pudo guardar';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Handle bar — feedback de "draggable"
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: BoxDecoration(
                    color: AppColors.ink3,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              Text(
                'Editar conductor',
                style: AppTheme.inter(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.01,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'El estado de fatiga (apto / riesgo / no apto) solo lo '
                'puede cambiar la municipalidad o la autoridad de campo.',
                style: AppTheme.inter(
                  fontSize: 12,
                  color: AppColors.ink5,
                  height: 1.4,
                  letterSpacing: -0.005,
                ),
              ),
              const SizedBox(height: 16),
              _Field(
                controller: _name,
                label: 'Nombre',
                validator: (v) => v == null || v.trim().length < 2
                    ? 'Mínimo 2 caracteres'
                    : null,
              ),
              const SizedBox(height: 12),
              _Field(
                controller: _dni,
                label: 'DNI',
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(20),
                ],
                validator: (v) => v == null || v.trim().length < 6
                    ? 'Mínimo 6 dígitos'
                    : null,
              ),
              const SizedBox(height: 12),
              _Field(
                controller: _licNumber,
                label: 'Número de licencia',
                validator: (v) => v == null || v.trim().length < 4
                    ? 'Mínimo 4 caracteres'
                    : null,
              ),
              const SizedBox(height: 12),
              _Field(
                controller: _licCategory,
                label: 'Categoría (A-IIIB, etc.)',
                validator: (v) => v == null || v.trim().length < 2
                    ? 'Mínimo 2 caracteres'
                    : null,
              ),
              const SizedBox(height: 12),
              _Field(
                controller: _phone,
                label: 'Teléfono (opcional)',
                keyboardType: TextInputType.phone,
                validator: null,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.noAptoBg,
                    border: Border.all(color: AppColors.noAptoBorder),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          size: 14, color: AppColors.noApto),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: AppTheme.inter(
                            fontSize: 12,
                            color: AppColors.noApto,
                            letterSpacing: -0.005,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 18),
              // Botones con theme defaults (FilledButton = ink9, Outlined =
              // ink2 border 1.5). El height 48 viene del theme — no
              // pisamos padding para conservar la altura canónica.
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('Guardar'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final String? Function(String?)? validator;

  const _Field({
    required this.controller,
    required this.label,
    this.keyboardType,
    this.inputFormatters,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    // Sin `decoration` propio — usa `inputDecorationTheme` canónico
    // (border ink2 1.5 / focus ink9 1.5 / radius 8 / fill blanco).
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      validator: validator,
      style: AppTheme.inter(
        fontSize: 14,
        color: AppColors.ink9,
        letterSpacing: -0.005,
      ),
      decoration: InputDecoration(labelText: label),
    );
  }
}

// ── Widgets compartidos ────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final ConductorModel driver;
  const _Header({required this.driver});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border, label) = switch (driver.status) {
      'apto' => (
        AppColors.apto,
        AppColors.aptoBg,
        AppColors.aptoBorder,
        'APTO'
      ),
      'riesgo' => (
        AppColors.riesgo,
        AppColors.riesgoBg,
        AppColors.riesgoBorder,
        'EN RIESGO'
      ),
      _ => (
        AppColors.noApto,
        AppColors.noAptoBg,
        AppColors.noAptoBorder,
        'NO APTO'
      ),
    };

    final initial =
        driver.name.isNotEmpty ? driver.name[0].toUpperCase() : '?';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2, width: 1.5),
      ),
      child: Row(
        children: [
          // Avatar cuadrado con bordes — más distintivo y consistente con
          // el patrón de "tile" del resto de la app (vs CircleAvatar que
          // no aparece en otras pantallas operador).
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: border, width: 1.5),
            ),
            alignment: Alignment.center,
            child: Text(
              initial,
              style: AppTheme.inter(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  driver.name.isEmpty ? '—' : driver.name,
                  style: AppTheme.inter(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                    letterSpacing: -0.01,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (driver.companyName != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    driver.companyName!,
                    style: AppTheme.inter(
                      fontSize: 12.5,
                      color: AppColors.ink6,
                      letterSpacing: -0.005,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: bg,
                    border: Border.all(color: border),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    label,
                    style: AppTheme.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: color,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final IconData? icon;
  final List<Widget> children;

  const _Section({required this.title, this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2, width: 1.5),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Kicker uppercase — labelSmall canónico (10.5 / w700 / ls 1.6).
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 12, color: AppColors.ink5),
                const SizedBox(width: 6),
              ],
              Text(
                title.toUpperCase(),
                style: AppTheme.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink5,
                  letterSpacing: 1.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final bool monospace;

  const _Row({
    required this.label,
    required this.value,
    this.monospace = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 108,
            child: Text(
              label,
              style: AppTheme.inter(
                fontSize: 12.5,
                color: AppColors.ink5,
                letterSpacing: -0.005,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTheme.inter(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: AppColors.ink9,
                tabular: monospace,
                letterSpacing: -0.005,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 40, color: AppColors.noApto),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
            const SizedBox(height: 14),
            TextButton(
              onPressed: onRetry,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}
