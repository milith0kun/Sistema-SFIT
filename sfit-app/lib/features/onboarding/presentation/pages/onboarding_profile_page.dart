import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/services/apiperu_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../companies/data/datasources/companies_api_service.dart';
import '../../../companies/presentation/widgets/scope_badge.dart';

/// Onboarding obligatorio tras el primer login.
///
/// Flujo:
///   1. Pide DNI personal (8 dígitos) — auto-consulta RENIEC al completar.
///      Muestra nombres + apellidos. Obligatorio para todos los roles.
///   2. Si role == operador, pide RUC de empresa (11 dígitos) — auto-consulta
///      SUNAT. Muestra razón social + domicilio + ubigeo. Obligatorio para
///      operador, no se permite continuar sin él (sin empresa el operador no
///      puede ver vehículos/conductores/rutas).
///   3. Teléfono OPCIONAL.
///   4. POST /auth/onboarding/complete con todos los datos resueltos para
///      que el backend persista User.dni, User.phone, User.name (RENIEC) y
///      cree/upsert Company + User.companyId (operador).
class OnboardingProfilePage extends ConsumerStatefulWidget {
  const OnboardingProfilePage({super.key});

  @override
  ConsumerState<OnboardingProfilePage> createState() =>
      _OnboardingProfilePageState();
}

class _OnboardingProfilePageState extends ConsumerState<OnboardingProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _dniCtrl = TextEditingController();
  final _rucCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  // Resultados de consulta — los persistimos en estado para enviarlos al
  // backend junto con dni/ruc cuando se confirma el formulario.
  DniResult? _dniData;
  RucResult? _rucData;

  bool _consultandoDni = false;
  bool _consultandoRuc = false;
  bool _enviando = false;

  // Errores granulares para distinguir DNI no encontrado, RUC inactivo, etc.
  String? _errorDni;
  String? _errorRuc;
  String? _errorEnvio;

  // Debounce para auto-consulta — evita llamar al API en cada tecla.
  Timer? _dniDebounce;
  Timer? _rucDebounce;

  // ── Conductor: selección de empresa (opcional) ──────────────────
  final _empresaCtrl = TextEditingController();
  Timer? _empresaDebounce;
  bool _searchingEmpresas = false;
  List<Map<String, dynamic>> _empresasResults = [];
  Map<String, dynamic>? _selectedCompany;

  // ── Operador: selección de tipo de servicio ─────────────────────
  String? _serviceScope;

  bool get _isOperador =>
      (ref.read(authProvider).user?.role ?? '') == 'operador';
  bool get _isConductor =>
      (ref.read(authProvider).user?.role ?? '') == 'conductor';

  @override
  void dispose() {
    _dniDebounce?.cancel();
    _rucDebounce?.cancel();
    _empresaDebounce?.cancel();
    _dniCtrl.dispose();
    _rucCtrl.dispose();
    _phoneCtrl.dispose();
    _empresaCtrl.dispose();
    super.dispose();
  }

  // ── Buscador de empresa (solo conductor) ────────────────────────
  void _onEmpresaChanged(String value) {
    _empresaDebounce?.cancel();
    final q = value.trim();
    if (q.length < 2) {
      setState(() {
        _empresasResults = [];
        _searchingEmpresas = false;
      });
      return;
    }
    _empresaDebounce = Timer(const Duration(milliseconds: 350), () => _buscarEmpresas(q));
  }

  Future<void> _buscarEmpresas(String q) async {
    setState(() => _searchingEmpresas = true);
    try {
      final items = await ref
          .read(companiesApiServiceProvider)
          .searchPublic(q: q, limit: 20);
      if (!mounted) return;
      setState(() {
        _empresasResults = items;
        _searchingEmpresas = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _empresasResults = [];
        _searchingEmpresas = false;
      });
    }
  }

  /// Auto-consulta cuando el DNI alcanza 8 dígitos. Debounce 400ms para
  /// evitar disparos en pegado/edición rápida.
  void _onDniChanged(String value) {
    final dni = value.trim();
    setState(() {
      // Si el operador modifica un DNI ya validado, limpiamos los datos.
      if (_dniData != null && dni != _dniData?.nombreCompleto) _dniData = null;
      _errorDni = null;
    });
    _dniDebounce?.cancel();
    if (dni.length != 8) return;
    _dniDebounce = Timer(const Duration(milliseconds: 400), _consultarDni);
  }

  void _onRucChanged(String value) {
    final ruc = value.trim();
    setState(() {
      if (_rucData != null && ruc != _rucData?.ruc) _rucData = null;
      _errorRuc = null;
    });
    _rucDebounce?.cancel();
    if (ruc.length != 11) return;
    _rucDebounce = Timer(const Duration(milliseconds: 400), _consultarRuc);
  }

  Future<void> _consultarDni() async {
    final dni = _dniCtrl.text.trim();
    if (dni.length != 8) return;
    setState(() {
      _consultandoDni = true;
      _dniData = null;
      _errorDni = null;
    });
    try {
      final result = await ref.read(apiPeruServiceProvider).consultarDni(dni);
      if (!mounted) return;
      setState(() => _dniData = result);
    } catch (_) {
      if (!mounted) return;
      setState(() => _errorDni = 'No se pudo consultar el DNI en RENIEC');
    } finally {
      if (mounted) setState(() => _consultandoDni = false);
    }
  }

  Future<void> _consultarRuc() async {
    final ruc = _rucCtrl.text.trim();
    if (ruc.length != 11) return;
    setState(() {
      _consultandoRuc = true;
      _rucData = null;
      _errorRuc = null;
    });
    try {
      final result = await ref.read(apiPeruServiceProvider).consultarRuc(ruc);
      if (!mounted) return;
      setState(() {
        _rucData = result;
        // Si la empresa figura inactiva o no habida, marcamos warning pero
        // dejamos continuar (el admin puede regularizar después).
        if (!result.esActivo) {
          _errorRuc = 'Empresa no activa/habida en SUNAT — verifica antes de continuar.';
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _errorRuc = 'No se pudo consultar el RUC en SUNAT');
    } finally {
      if (mounted) setState(() => _consultandoRuc = false);
    }
  }

  /// Convierte el ubigeo 6-dig devuelto por SUNAT (cuando aplica) en
  /// componentes departamentCode/provinceCode/districtCode. Si el RUC trae
  /// nombres en vez de códigos, los códigos quedan vacíos y el backend
  /// usa solo razón social + domicilio.
  ({String? dept, String? prov, String? dist}) _ubigeoFromRuc(RucResult r) {
    // apiperu suele devolver `ubigeo` (string 6) en algunos planes; si no,
    // dejamos los componentes nulos. Aún sin ubigeo, el backend persiste
    // razón social + domicilio textual sin romper nada.
    return (dept: null, prov: null, dist: null);
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    // Si el rol es operador, exigir RUC consultado OK — sin empresa el
    // operador no puede operar nada en la app.
    if (_isOperador && _rucData == null) {
      setState(() => _errorRuc = 'Consulta el RUC de tu empresa antes de continuar');
      return;
    }
    // Operador también debe elegir tipo de servicio: define si las rutas
    // que cree exigirán paraderos o solo origen/destino.
    if (_isOperador && _serviceScope == null) {
      setState(() => _errorRuc = 'Elige el tipo de servicio de tu empresa');
      return;
    }
    // Si la consulta RENIEC sigue en curso, esperamos a que termine antes de
    // enviar — pero NO bloqueamos por `_dniData == null` definitivo: RENIEC
    // puede estar offline y el backend acepta el DNI sin enriquecimiento.
    if (_consultandoDni) {
      setState(() => _errorDni = 'Espera a que termine la consulta');
      return;
    }

    setState(() {
      _enviando = true;
      _errorEnvio = null;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final body = <String, dynamic>{
        'dni': _dniCtrl.text.trim(),
        if (_phoneCtrl.text.trim().isNotEmpty) 'phone': _phoneCtrl.text.trim(),
        if (_dniData != null)
          'reniec': {
            'nombres': _dniData!.nombres,
            'apellidoPaterno': _dniData!.apellidoPaterno,
            'apellidoMaterno': _dniData!.apellidoMaterno,
          },
      };
      if (_isOperador && _rucData != null) {
        final ub = _ubigeoFromRuc(_rucData!);
        body['company'] = {
          'ruc': _rucData!.ruc,
          'razonSocial': _rucData!.razonSocial,
          if (_rucData!.domicilio != null) 'domicilio': _rucData!.domicilio,
          if (ub.dept != null) 'departmentCode': ub.dept,
          if (ub.prov != null) 'provinceCode': ub.prov,
          if (ub.dist != null) 'districtCode': ub.dist,
          if (_serviceScope != null) 'serviceScope': _serviceScope,
        };
      }
      // Conductor que eligió empresa durante el onboarding — el backend hace
      // upsert del Driver con companyId aunque no llegue la licencia (que se
      // captura después en "Editar perfil").
      if (_isConductor && _selectedCompany != null) {
        body['driver'] = {
          'companyId': _selectedCompany!['id'],
        };
      }

      final resp = await dio.post('/auth/onboarding/complete', data: body);
      final respBody = resp.data;
      if (respBody is Map && respBody['success'] == true) {
        // Aplicar el user actualizado DIRECTAMENTE desde la respuesta del
        // onboarding. Antes dependíamos de un GET /auth/perfil adicional
        // (refreshUserFromServer); si esa segunda llamada fallaba en silencio
        // (red intermitente, etc.) el `profileCompleted` quedaba en false y
        // el router te devolvía al onboarding eternamente — el bug que el
        // usuario reportó como "cada vez me pide el DNI".
        await ref
            .read(authProvider.notifier)
            .applyOnboardingResponse(respBody['data'] as Map?);
        if (!mounted) return;
        context.go('/home');
      } else {
        setState(() => _errorEnvio =
            (respBody is Map ? respBody['error']?.toString() : null) ??
                'No se pudo guardar el perfil');
      }
    } catch (e) {
      if (mounted) setState(() => _errorEnvio = 'Error de conexión: $e');
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('¿Cerrar sesión?'),
        content: const Text(
          'Tendrás que volver a iniciar sesión. Los datos que escribiste se perderán.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final role = user?.role ?? 'ciudadano';
    final hint = switch (role) {
      'conductor'  => 'Luego completarás tu licencia y empresa.',
      'operador'   => 'Necesitamos verificar tu DNI y el RUC de tu empresa.',
      'fiscal'     => 'Tras esto podrás emitir inspecciones.',
      _            => 'Solo tomará un momento.',
    };

    return Scaffold(
      appBar: AppBar(
        title: const Text('Completar perfil'),
        automaticallyImplyLeading: false,
        actions: [
          // Escape obligatorio: si el usuario no puede avanzar (RENIEC caído,
          // API offline, datos rechazados) debe poder cerrar sesión y reintentar
          // con otra cuenta o más tarde. Antes esta pantalla atrapaba al user.
          TextButton.icon(
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Salir'),
            onPressed: _enviando ? null : _logout,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: ListView(
              children: [
                Text(
                  '¡Bienvenido, ${user?.name.split(' ').first ?? ''}!',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 6),
                Text(hint, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 24),

                // ── DNI personal ─────────────────────────────────────
                TextFormField(
                  controller: _dniCtrl,
                  decoration: InputDecoration(
                    labelText: 'DNI *',
                    hintText: '8 dígitos',
                    suffixIcon: _consultandoDni
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : (_dniData != null
                            ? const Icon(Icons.check_circle, color: Colors.green)
                            : null),
                  ),
                  keyboardType: TextInputType.number,
                  maxLength: 8,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: _onDniChanged,
                  validator: (v) {
                    if (v == null || v.trim().length != 8) {
                      return 'Debe tener exactamente 8 dígitos';
                    }
                    return null;
                  },
                ),
                if (_dniData != null) _ReniecCard(data: _dniData!),
                if (_errorDni != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      _errorDni!,
                      style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                    ),
                  ),
                const SizedBox(height: 16),

                // ── RUC empresa (solo operador) ──────────────────────
                if (_isOperador) ...[
                  TextFormField(
                    controller: _rucCtrl,
                    decoration: InputDecoration(
                      labelText: 'RUC de la empresa *',
                      hintText: '11 dígitos',
                      suffixIcon: _consultandoRuc
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 16, height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : (_rucData != null
                              ? Icon(
                                  _rucData!.esActivo
                                      ? Icons.check_circle
                                      : Icons.warning_amber,
                                  color: _rucData!.esActivo
                                      ? Colors.green
                                      : Colors.orange,
                                )
                              : null),
                    ),
                    keyboardType: TextInputType.number,
                    maxLength: 11,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    onChanged: _onRucChanged,
                    validator: (v) {
                      if (v == null || v.trim().length != 11) {
                        return 'Debe tener exactamente 11 dígitos';
                      }
                      return null;
                    },
                  ),
                  if (_rucData != null) _SunatCard(data: _rucData!),
                  if (_errorRuc != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        _errorRuc!,
                        style: TextStyle(
                          color: _rucData?.esActivo == false
                              ? Colors.orange.shade800
                              : Colors.red.shade700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  const SizedBox(height: 18),
                  // ── Selector de tipo de servicio (operador) ───────
                  // El operador define si su empresa opera rutas urbanas
                  // (con paraderos fijos) o interprovinciales (origen+destino
                  // sin paraderos). Esto se persiste en Company.serviceScope
                  // y condiciona la validación al crear rutas más adelante.
                  Text(
                    'Tipo de servicio *',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Define si tus rutas tendrán paraderos fijos o solo origen y destino.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.ink6,
                        ),
                  ),
                  const SizedBox(height: 8),
                  _ScopeSelector(
                    value: _serviceScope,
                    onChanged: (v) => setState(() {
                      _serviceScope = v;
                      _errorRuc = null;
                    }),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Empresa (solo conductor, opcional) ────────────────
                // El conductor puede asociarse a su empresa durante el
                // onboarding o saltar el paso y hacerlo después en "Mi
                // empresa". El home muestra un banner si quedó sin asociar.
                if (_isConductor) ...[
                  Text(
                    'Tu empresa (opcional)',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Búscala por razón social o RUC. Podrás asociarte después en Mi empresa.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.ink6,
                        ),
                  ),
                  const SizedBox(height: 8),
                  if (_selectedCompany != null)
                    _SelectedCompanyCard(
                      company: _selectedCompany!,
                      onClear: () => setState(() {
                        _selectedCompany = null;
                        _empresaCtrl.clear();
                        _empresasResults = [];
                      }),
                    )
                  else ...[
                    TextField(
                      controller: _empresaCtrl,
                      decoration: InputDecoration(
                        labelText: 'Buscar empresa',
                        hintText: 'Mín. 2 caracteres',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: _searchingEmpresas
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 16, height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                ),
                              )
                            : null,
                        border: const OutlineInputBorder(),
                      ),
                      onChanged: _onEmpresaChanged,
                    ),
                    if (_empresasResults.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(top: 8),
                        constraints: const BoxConstraints(maxHeight: 260),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.ink2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: _empresasResults.length,
                          separatorBuilder: (_, __) =>
                              const Divider(height: 1),
                          itemBuilder: (_, i) => _CompanyTileForOnboarding(
                            company: _empresasResults[i],
                            onTap: () => setState(() {
                              _selectedCompany = _empresasResults[i];
                              _empresasResults = [];
                            }),
                          ),
                        ),
                      )
                    else if (_empresaCtrl.text.trim().length >= 2 &&
                        !_searchingEmpresas)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Sin resultados. Si tu empresa no está aquí, puedes asociarte después.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.ink6,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                  ],
                  const SizedBox(height: 16),
                ],

                // ── Teléfono OPCIONAL ────────────────────────────────
                TextFormField(
                  controller: _phoneCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Teléfono (opcional)',
                    hintText: '9 dígitos',
                  ),
                  keyboardType: TextInputType.phone,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  validator: (v) {
                    // Vacío = OK. Si pone algo, exigimos longitud razonable.
                    if (v == null || v.trim().isEmpty) return null;
                    if (v.trim().length < 7) {
                      return 'Si lo ingresas, debe tener al menos 7 dígitos';
                    }
                    return null;
                  },
                ),
                // Espacio extra para que el último campo no quede pegado al
                // botón sticky de abajo cuando el teclado está cerrado.
                const SizedBox(height: 80),
              ],
            ),
          ),
        ),
      ),
      // Botón sticky inferior — siempre visible, no scrollea con el form.
      // Se eleva sobre el teclado gracias a `resizeToAvoidBottomInset` (default
      // del Scaffold) y respeta el inset del SafeArea del navegador inferior.
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            border: Border(
              top: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_errorEnvio != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    _errorEnvio!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                  ),
                ),
              // Centro horizontal con ancho contenido (no full-width).
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: 360,
                    minWidth: 220,
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: _enviando ? null : _guardar,
                      child: _enviando
                          ? const SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white,
                              ),
                            )
                          : const Text('Guardar y continuar'),
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
}

/// Tarjeta con los datos resueltos por RENIEC.
class _ReniecCard extends StatelessWidget {
  final DniResult data;
  const _ReniecCard({required this.data});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        border: Border.all(color: Colors.green.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.verified_user, size: 16, color: Colors.green.shade700),
            const SizedBox(width: 6),
            Text(
              'Datos verificados (RENIEC)',
              style: TextStyle(
                color: Colors.green.shade800,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ]),
          const SizedBox(height: 6),
          if (data.nombres.isNotEmpty)
            _KV(label: 'Nombres', value: data.nombres),
          if (data.apellidoPaterno.isNotEmpty)
            _KV(label: 'Apellido paterno', value: data.apellidoPaterno),
          if (data.apellidoMaterno.isNotEmpty)
            _KV(label: 'Apellido materno', value: data.apellidoMaterno),
        ],
      ),
    );
  }
}

/// Tarjeta con los datos resueltos por SUNAT (RUC).
class _SunatCard extends StatelessWidget {
  final RucResult data;
  const _SunatCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final activa = data.esActivo;
    final color = activa ? Colors.green : Colors.orange;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.shade50,
        border: Border.all(color: color.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(
              activa ? Icons.business_center : Icons.warning_amber,
              size: 16,
              color: color.shade700,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                activa
                    ? 'Empresa verificada (SUNAT)'
                    : 'Estado: ${data.estado} · ${data.condicion}',
                style: TextStyle(
                  color: color.shade800,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          ]),
          const SizedBox(height: 6),
          _KV(label: 'Razón social', value: data.razonSocial),
          if (data.nombreComercial != null && data.nombreComercial!.isNotEmpty)
            _KV(label: 'Nombre comercial', value: data.nombreComercial!),
          if (data.domicilio != null && data.domicilio!.isNotEmpty)
            _KV(label: 'Domicilio', value: data.domicilio!),
          if (data.departamento != null ||
              data.provincia != null ||
              data.distrito != null)
            _KV(
              label: 'Ubicación',
              value: [data.distrito, data.provincia, data.departamento]
                  .where((s) => s != null && s.isNotEmpty)
                  .join(' · '),
            ),
        ],
      ),
    );
  }
}

class _KV extends StatelessWidget {
  final String label;
  final String value;
  const _KV({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: RichText(
        text: TextSpan(
          style: DefaultTextStyle.of(context).style.copyWith(fontSize: 12.5),
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }
}

/// Selector visual de `Company.serviceScope` para el onboarding del operador.
///
/// Las 4 opciones del enum se agrupan en 2 columnas para visualizar la
/// diferencia: izquierda urbano (con paraderos), derecha interprovincial
/// (sin paraderos). El usuario marca una y se persiste en `Company.serviceScope`.
class _ScopeSelector extends StatelessWidget {
  final String? value;
  final ValueChanged<String> onChanged;

  const _ScopeSelector({required this.value, required this.onChanged});

  static const _options = <({String value, String title, String subtitle, IconData icon, bool isUrban})>[
    (
      value: 'urbano',
      title: 'Urbano',
      subtitle: 'Rutas con paraderos dentro de los 6 distritos de Cotabambas',
      icon: Icons.directions_bus_filled_rounded,
      isUrban: true,
    ),
    (
      value: 'interprovincial',
      title: 'Interprovincial',
      subtitle: 'Rutas a Cusco / Abancay / Arequipa, sin paraderos intermedios',
      icon: Icons.alt_route_rounded,
      isUrban: false,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: _options.map((opt) {
        final selected = value == opt.value;
        final accent = opt.isUrban
            ? AppColors.info
            : const Color(0xFF7C3AED);
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: InkWell(
            onTap: () => onChanged(opt.value),
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: selected ? accent.withValues(alpha: 0.06) : Colors.white,
                border: Border.all(
                  color: selected ? accent : AppColors.ink2,
                  width: selected ? 2 : 1,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(opt.icon, color: accent, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          opt.title,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                            color: AppColors.ink9,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          opt.subtitle,
                          style: TextStyle(
                            fontSize: 11.5,
                            color: AppColors.ink6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: selected ? accent : AppColors.ink4,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

/// Card que muestra la empresa que el conductor ya eligió durante el
/// onboarding, con botón para cambiar.
class _SelectedCompanyCard extends StatelessWidget {
  final Map<String, dynamic> company;
  final VoidCallback onClear;

  const _SelectedCompanyCard({required this.company, required this.onClear});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.aptoBg,
        border: Border.all(color: AppColors.aptoBorder),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle, color: AppColors.apto, size: 18),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  company['razonSocial']?.toString() ?? '—',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 18),
                tooltip: 'Cambiar',
                onPressed: onClear,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'RUC ${company['ruc'] ?? '—'}',
                style: TextStyle(fontSize: 12, color: AppColors.ink6),
              ),
              if (company['municipalityName'] != null)
                Text(
                  '· ${company['municipalityName']}',
                  style: TextStyle(fontSize: 12, color: AppColors.ink6),
                ),
              ScopeBadge(
                scope: company['serviceScope'] as String?,
                compact: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Fila de empresa en el listado del buscador del onboarding.
class _CompanyTileForOnboarding extends StatelessWidget {
  final Map<String, dynamic> company;
  final VoidCallback onTap;

  const _CompanyTileForOnboarding({
    required this.company,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              company['razonSocial']?.toString() ?? '—',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13.5,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'RUC ${company['ruc'] ?? '—'}',
                  style: TextStyle(fontSize: 11.5, color: AppColors.ink6),
                ),
                if (company['municipalityName'] != null)
                  Text(
                    '· ${company['municipalityName']}',
                    style: TextStyle(fontSize: 11.5, color: AppColors.ink6),
                  ),
                ScopeBadge(
                  scope: company['serviceScope'] as String?,
                  compact: true,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
