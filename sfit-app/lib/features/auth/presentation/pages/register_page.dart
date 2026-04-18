import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/widgets.dart';
import '../providers/auth_provider.dart';

const _roles = <({String value, String label, String desc, IconData icon})>[
  (
    value: 'ciudadano',
    label: 'Ciudadano',
    desc: 'Reportar anomalías',
    icon: Icons.person_outlined,
  ),
  (
    value: 'conductor',
    label: 'Conductor',
    desc: 'Ver rutas y viajes',
    icon: Icons.drive_eta_outlined,
  ),
  (
    value: 'fiscal',
    label: 'Fiscal / Inspector',
    desc: 'Inspecciones y actas',
    icon: Icons.search_outlined,
  ),
  (
    value: 'operador',
    label: 'Operador de Empresa',
    desc: 'Gestionar flota',
    icon: Icons.business_outlined,
  ),
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
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.noApto,
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
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: AppColors.paper,
        elevation: 0,
        leading: _step == 1
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => setState(() => _step = 0),
              )
            : IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => context.go('/login'),
              ),
        title: Text(
          'Crear cuenta',
          style: AppTheme.inter(
            fontSize: 15.5,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: LinearProgressIndicator(
            value: (_step + 1) / 2,
            backgroundColor: AppColors.ink2,
            color: AppColors.gold,
            minHeight: 3,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SfitHeroCard(
                kicker: _step == 0 ? 'Paso 1 de 2' : 'Paso 2 de 2',
                title: _step == 0 ? 'Tus datos' : 'Selecciona tu rol',
                subtitle: _step == 0
                    ? 'Necesitamos tu nombre, correo institucional y una contraseña segura.'
                    : 'El administrador municipal aprobará tu solicitud.',
                rfCode: 'RF-01',
              ),
              const SizedBox(height: 22),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: _step == 0 ? _buildDatosStep() : _buildRolStep(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDatosStep() {
    return Form(
      key: _formKey,
      child: Column(
        key: const ValueKey('datos-step'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          const SizedBox(height: 16),

          const _FieldLabel('Correo electrónico'),
          const SizedBox(height: 8),
          TextFormField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              hintText: 'nombre@municipalidad.gob.pe',
              prefixIcon: Icon(Icons.email_outlined, size: 20),
            ),
            validator: (v) {
              if (v == null || !v.contains('@')) return 'Correo inválido';
              return null;
            },
          ),
          const SizedBox(height: 16),

          const _FieldLabel('Contraseña'),
          const SizedBox(height: 8),
          TextFormField(
            controller: _passwordCtrl,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.done,
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

          const SizedBox(height: 28),

          SfitPrimaryButton(
            label: 'Continuar',
            icon: Icons.arrow_forward_rounded,
            onPressed: () {
              if (_formKey.currentState!.validate()) {
                setState(() => _step = 1);
              }
            },
          ),
          const SizedBox(height: 18),
          Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '¿Ya tienes cuenta? ',
                  style: AppTheme.inter(
                    fontSize: 13.5, color: AppColors.ink6,
                  ),
                ),
                GestureDetector(
                  onTap: () => context.go('/login'),
                  child: Text(
                    'Inicia sesión',
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
    );
  }

  Widget _buildRolStep() {
    return Column(
      key: const ValueKey('rol-step'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ..._roles.map((rol) => _RoleTile(
              label: rol.label,
              desc: rol.desc,
              icon: rol.icon,
              selected: _selectedRole == rol.value,
              onTap: () => setState(() => _selectedRole = rol.value),
            )),
        const SizedBox(height: 20),
        SfitPrimaryButton(
          label: 'Solicitar acceso',
          icon: Icons.send_rounded,
          loading: _loading,
          enabled: _selectedRole != null,
          onPressed: _selectedRole != null ? _submit : null,
        ),
      ],
    );
  }
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

class _RoleTile extends StatelessWidget {
  final String label;
  final String desc;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _RoleTile({
    required this.label,
    required this.desc,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: selected ? AppColors.goldBg : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? AppColors.gold : AppColors.ink2,
                width: selected ? 1.75 : 1.25,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: selected ? AppColors.gold : AppColors.ink1,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    icon,
                    size: 20,
                    color: selected ? Colors.white : AppColors.ink6,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: AppTheme.inter(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink9,
                        ),
                      ),
                      Text(
                        desc,
                        style: AppTheme.inter(
                          fontSize: 12.5,
                          color: AppColors.ink5,
                        ),
                      ),
                    ],
                  ),
                ),
                if (selected)
                  const Icon(Icons.check_circle_rounded,
                      color: AppColors.gold, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
