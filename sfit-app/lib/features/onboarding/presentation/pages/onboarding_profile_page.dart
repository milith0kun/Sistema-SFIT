import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/services/apiperu_service.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Onboarding obligatorio tras el primer login con Google.
///
/// Pide DNI + teléfono y, según el rol del usuario, sugiere completar los
/// datos específicos en el siguiente paso (conductor → licencia/empresa,
/// operador → registrar empresa). El bloque común aquí es DNI + teléfono.
/// Llama POST /api/auth/onboarding/complete para marcar profileCompleted=true.
class OnboardingProfilePage extends ConsumerStatefulWidget {
  const OnboardingProfilePage({super.key});

  @override
  ConsumerState<OnboardingProfilePage> createState() =>
      _OnboardingProfilePageState();
}

class _OnboardingProfilePageState extends ConsumerState<OnboardingProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _dniCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String? _autoNombre;
  bool _consultandoDni = false;
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _dniCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _consultarDni() async {
    final dni = _dniCtrl.text.trim();
    if (dni.length != 8) return;
    setState(() {
      _consultandoDni = true;
      _autoNombre = null;
      _error = null;
    });
    try {
      final result = await ref.read(apiPeruServiceProvider).consultarDni(dni);
      if (!mounted) return;
      setState(() => _autoNombre = result.nombreCompleto);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo consultar el DNI en RENIEC');
    } finally {
      if (mounted) setState(() => _consultandoDni = false);
    }
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.post('/auth/onboarding/complete', data: {
        'dni': _dniCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
      });
      final body = resp.data;
      if (body is Map && body['success'] == true) {
        // Refrescamos el estado de auth para que el router avance al home
        // (con profileCompleted=true ya no nos vuelve a redirigir aquí).
        await ref.read(authProvider.notifier).refreshUserFromServer();
        if (!mounted) return;
        context.go('/home');
      } else {
        setState(() => _error = (body is Map ? body['error']?.toString() : null) ??
            'No se pudo guardar el perfil');
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Error de conexión: $e');
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
      'operador'   => 'Luego registrarás los datos de tu empresa.',
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
                TextFormField(
                  controller: _dniCtrl,
                  decoration: InputDecoration(
                    labelText: 'DNI',
                    hintText: '8 dígitos',
                    suffixIcon: _consultandoDni
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : IconButton(
                            icon: const Icon(Icons.search),
                            onPressed: _consultarDni,
                          ),
                  ),
                  keyboardType: TextInputType.number,
                  maxLength: 8,
                  validator: (v) {
                    if (v == null || v.trim().length != 8) {
                      return 'Debe tener exactamente 8 dígitos';
                    }
                    return null;
                  },
                ),
                if (_autoNombre != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'RENIEC: $_autoNombre',
                    style: TextStyle(color: Colors.green.shade700, fontSize: 13),
                  ),
                ],
                const SizedBox(height: 16),
                TextFormField(
                  controller: _phoneCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Teléfono',
                    hintText: '9 dígitos',
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (v) {
                    if (v == null || v.trim().length < 7) {
                      return 'Ingresa un teléfono válido';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _error!,
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
