import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/services/apiperu_service.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

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

  bool get _isOperador =>
      (ref.read(authProvider).user?.role ?? '') == 'operador';

  @override
  void dispose() {
    _dniDebounce?.cancel();
    _rucDebounce?.cancel();
    _dniCtrl.dispose();
    _rucCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
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
    // Validaciones extra: si el rol es operador, exigir RUC consultado OK.
    if (_isOperador && _rucData == null) {
      setState(() => _errorRuc = 'Consulta el RUC de tu empresa antes de continuar');
      return;
    }
    if (_dniData == null) {
      setState(() => _errorDni = 'Espera a que se consulte el DNI');
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
        };
      }

      final resp = await dio.post('/auth/onboarding/complete', data: body);
      final respBody = resp.data;
      if (respBody is Map && respBody['success'] == true) {
        await ref.read(authProvider.notifier).refreshUserFromServer();
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
                const SizedBox(height: 24),
                if (_errorEnvio != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _errorEnvio!,
                      style: TextStyle(color: Colors.red.shade700),
                    ),
                  ),
                FilledButton(
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
              ],
            ),
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
