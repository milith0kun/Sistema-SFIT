import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

const _roles = [
  (value: 'ciudadano', label: 'Ciudadano', desc: 'Reportar anomalías', icon: Icons.person_outlined),
  (value: 'conductor', label: 'Conductor', desc: 'Ver rutas y viajes', icon: Icons.drive_eta_outlined),
  (value: 'fiscal', label: 'Fiscal / Inspector', desc: 'Inspecciones y actas', icon: Icons.search_outlined),
  (value: 'operador', label: 'Operador de Empresa', desc: 'Gestionar flota', icon: Icons.business_outlined),
];

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscurePassword = true;
  bool _loading = false;
  int _step = 0; // 0 = datos, 1 = rol
  String? _selectedRole;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedRole == null) return;
    setState(() => _loading = true);

    try {
      await ref.read(authProvider.notifier).register(
            name: _nameCtrl.text.trim(),
            email: _emailCtrl.text.trim(),
            password: _passwordCtrl.text,
            requestedRole: _selectedRole!,
          );
      // El router redirige a /pending
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: Theme.of(context).colorScheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: cs.surface,
      appBar: AppBar(
        leading: _step == 1
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _step = 0),
              )
            : null,
        title: const Text('Crear cuenta'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: (_step + 1) / 2,
            backgroundColor: cs.surfaceContainerHighest,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: _step == 0 ? _buildDatosStep(cs, tt) : _buildRolStep(cs, tt),
          ),
        ),
      ),
    );
  }

  Widget _buildDatosStep(ColorScheme cs, TextTheme tt) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Tus datos', style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text('Paso 1 de 2', style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
          const SizedBox(height: 28),

          TextFormField(
            controller: _nameCtrl,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Nombre completo',
              prefixIcon: Icon(Icons.person_outlined),
            ),
            validator: (v) {
              if (v == null || v.trim().length < 2) return 'Ingresa tu nombre completo';
              return null;
            },
          ),

          const SizedBox(height: 16),

          TextFormField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Correo electrónico',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: (v) {
              if (v == null || !v.contains('@')) return 'Correo inválido';
              return null;
            },
          ),

          const SizedBox(height: 16),

          TextFormField(
            controller: _passwordCtrl,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(
              labelText: 'Contraseña',
              prefixIcon: const Icon(Icons.lock_outlined),
              suffixIcon: IconButton(
                icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: (v) {
              if (v == null || v.length < 8) return 'Mínimo 8 caracteres';
              return null;
            },
          ),

          const SizedBox(height: 32),

          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                if (_formKey.currentState!.validate()) {
                  setState(() => _step = 1);
                }
              },
              child: const Text('Continuar'),
            ),
          ),

          const SizedBox(height: 20),

          Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('¿Ya tienes cuenta? ', style: tt.bodyMedium),
                GestureDetector(
                  onTap: () => context.go('/login'),
                  child: Text(
                    'Inicia sesión',
                    style: tt.bodyMedium?.copyWith(color: cs.primary, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRolStep(ColorScheme cs, TextTheme tt) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Selecciona tu rol', style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text('Paso 2 de 2 — El administrador aprobará tu solicitud',
            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
        const SizedBox(height: 28),

        ..._roles.map((rol) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: InkWell(
            onTap: () => setState(() => _selectedRole = rol.value),
            borderRadius: BorderRadius.circular(16),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _selectedRole == rol.value ? cs.primary : cs.outlineVariant,
                  width: _selectedRole == rol.value ? 2 : 1,
                ),
                color: _selectedRole == rol.value
                    ? cs.primaryContainer.withAlpha(128)
                    : cs.surface,
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: _selectedRole == rol.value
                          ? cs.primary
                          : cs.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      rol.icon,
                      color: _selectedRole == rol.value ? cs.onPrimary : cs.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(rol.label, style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                        Text(rol.desc, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                      ],
                    ),
                  ),
                  if (_selectedRole == rol.value)
                    Icon(Icons.check_circle_rounded, color: cs.primary),
                ],
              ),
            ),
          ),
        )),

        const SizedBox(height: 8),

        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: (_selectedRole != null && !_loading) ? _submit : null,
            child: _loading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Solicitar acceso'),
          ),
        ),
      ],
    );
  }
}
