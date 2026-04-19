import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../../../../shared/widgets/widgets.dart';
import '../providers/auth_provider.dart';

// ── Modelos locales ──────────────────────────────────────────────

class _Provincia {
  final String id;
  final String name;
  const _Provincia({required this.id, required this.name});
}

class _Municipio {
  final String id;
  final String name;
  const _Municipio({required this.id, required this.name});
}

// ── Página ───────────────────────────────────────────────────────

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey       = GlobalKey<FormState>();
  final _nameCtrl      = TextEditingController();
  final _emailCtrl     = TextEditingController();
  final _passwordCtrl  = TextEditingController();
  final _confirmCtrl   = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirm  = true;
  bool _loading         = false;

  // Provincia / Municipio
  List<_Provincia> _provincias   = [];
  List<_Municipio> _municipios   = [];
  _Provincia?      _selProvincia;
  _Municipio?      _selMunicipio;
  bool _loadingProvincias  = false;
  bool _loadingMunicipios  = false;
  String? _geoError;

  @override
  void initState() {
    super.initState();
    _loadProvincias();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  // ── Carga de datos geográficos ────────────────────────────────

  Future<void> _loadProvincias() async {
    setState(() { _loadingProvincias = true; _geoError = null; });
    try {
      final data = await ref
          .read(authRepositoryProvider)
          .fetchProvincias();
      if (mounted) {
        setState(() {
          _provincias = data
              .map((m) => _Provincia(id: m['id'] as String, name: m['name'] as String))
              .toList();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _geoError = 'No se pudieron cargar las provincias');
    } finally {
      if (mounted) setState(() => _loadingProvincias = false);
    }
  }

  Future<void> _loadMunicipios(String provinciaId) async {
    setState(() { _loadingMunicipios = true; _municipios = []; _selMunicipio = null; });
    try {
      final data = await ref
          .read(authRepositoryProvider)
          .fetchMunicipalidades(provinciaId);
      if (mounted) {
        setState(() {
          _municipios = data
              .map((m) => _Municipio(id: m['id'] as String, name: m['name'] as String))
              .toList();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _geoError = 'No se pudieron cargar las municipalidades');
    } finally {
      if (mounted) setState(() => _loadingMunicipios = false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      final ok = await ref.read(authProvider.notifier).registerCiudadano(
            name: _nameCtrl.text.trim(),
            email: _emailCtrl.text.trim(),
            password: _passwordCtrl.text,
            municipalityId: _selMunicipio?.id,
          );
      if (!ok && mounted) {
        final err = ref.read(authProvider).errorMessage;
        _showError(err ?? 'Error al registrarse');
      }
      // Si ok=true, GoRouter redirige automáticamente a /home (ciudadano activo)
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
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

  // ── Build ─────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Marca ─────────────────────────────────────────
              const SfitFullLogo(width: 150),
              const SizedBox(height: 40),

              // ── Kicker + título ───────────────────────────────
              const _Kicker(),
              const SizedBox(height: 10),
              Text(
                'Crear cuenta',
                style: AppTheme.inter(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  letterSpacing: -0.6,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Registro de ciudadano — acceso inmediato',
                style: AppTheme.inter(
                  fontSize: 14,
                  color: AppColors.ink6,
                  height: 1.45,
                ),
              ),

              const SizedBox(height: 32),

              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Nombre completo
                    const _FieldLabel('Nombre completo'),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _nameCtrl,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        hintText: 'Juan Pérez',
                        prefixIcon: Icon(Icons.person_outlined, size: 20),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().length < 2) {
                          return 'Ingresa tu nombre completo';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 18),

                    // Correo
                    const _FieldLabel('Correo electrónico'),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        hintText: 'nombre@correo.com',
                        prefixIcon: Icon(Icons.email_outlined, size: 20),
                      ),
                      validator: (v) {
                        if (v == null || !v.contains('@')) return 'Correo inválido';
                        return null;
                      },
                    ),

                    const SizedBox(height: 18),

                    // Contraseña
                    const _FieldLabel('Contraseña'),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _passwordCtrl,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        hintText: 'Mínimo 8 caracteres',
                        prefixIcon: const Icon(Icons.lock_outlined, size: 20),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 20,
                            color: AppColors.ink4,
                          ),
                          onPressed: () =>
                              setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                      validator: (v) {
                        if (v == null || v.length < 8) return 'Mínimo 8 caracteres';
                        return null;
                      },
                    ),

                    const SizedBox(height: 18),

                    // Confirmar contraseña
                    const _FieldLabel('Confirmar contraseña'),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _confirmCtrl,
                      obscureText: _obscureConfirm,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        prefixIcon: const Icon(Icons.lock_outlined, size: 20),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscureConfirm
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 20,
                            color: AppColors.ink4,
                          ),
                          onPressed: () =>
                              setState(() => _obscureConfirm = !_obscureConfirm),
                        ),
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Requerido';
                        if (v != _passwordCtrl.text) return 'Las contraseñas no coinciden';
                        return null;
                      },
                    ),

                    const SizedBox(height: 24),

                    // ── Provincia / Municipio ────────────────────
                    const _FieldLabel('Provincia (opcional)'),
                    const SizedBox(height: 8),
                    _GeoDropdown<_Provincia>(
                      hint: 'Selecciona tu provincia',
                      items: _provincias,
                      value: _selProvincia,
                      loading: _loadingProvincias,
                      itemLabel: (p) => p.name,
                      onChanged: (p) {
                        setState(() { _selProvincia = p; _selMunicipio = null; _municipios = []; });
                        if (p != null) _loadMunicipios(p.id);
                      },
                    ),

                    if (_selProvincia != null) ...[
                      const SizedBox(height: 16),
                      const _FieldLabel('Municipalidad'),
                      const SizedBox(height: 8),
                      _GeoDropdown<_Municipio>(
                        hint: 'Selecciona tu municipalidad',
                        items: _municipios,
                        value: _selMunicipio,
                        loading: _loadingMunicipios,
                        itemLabel: (m) => m.name,
                        onChanged: (m) => setState(() => _selMunicipio = m),
                      ),
                    ],

                    if (_geoError != null) ...[
                      const SizedBox(height: 8),
                      _ErrorNote(_geoError!),
                    ],

                    const SizedBox(height: 28),

                    SfitPrimaryButton(
                      label: 'Registrarme',
                      icon: Icons.arrow_forward_rounded,
                      loading: _loading,
                      onPressed: _submit,
                    ),

                    const SizedBox(height: 22),

                    Center(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '¿Ya tienes cuenta?  ',
                            style: AppTheme.inter(
                              fontSize: 13.5,
                              color: AppColors.ink6,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => context.go('/login'),
                            child: Text(
                              'Iniciar sesión',
                              style: AppTheme.inter(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.goldDark,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Widgets auxiliares ───────────────────────────────────────────

class _Kicker extends StatelessWidget {
  const _Kicker();

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

class _ErrorNote extends StatelessWidget {
  final String message;
  const _ErrorNote(this.message);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.noAptoBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.noAptoBorder),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, size: 16, color: AppColors.noApto),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: AppTheme.inter(fontSize: 12.5, color: AppColors.noApto),
              ),
            ),
          ],
        ),
      );
}

class _GeoDropdown<T> extends StatelessWidget {
  final String hint;
  final List<T> items;
  final T? value;
  final bool loading;
  final String Function(T) itemLabel;
  final ValueChanged<T?> onChanged;

  const _GeoDropdown({
    required this.hint,
    required this.items,
    required this.value,
    required this.loading,
    required this.itemLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.ink2),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.gold,
              ),
            ),
            SizedBox(width: 12),
            Text('Cargando...'),
          ],
        ),
      );
    }

    return DropdownButtonFormField<T>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        hintText: hint,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      items: items
          .map((item) => DropdownMenuItem<T>(
                value: item,
                child: Text(itemLabel(item), overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: onChanged,
    );
  }
}
