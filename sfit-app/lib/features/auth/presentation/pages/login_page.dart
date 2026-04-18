import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../providers/auth_provider.dart';

/// Usuarios de prueba precargados (solo visibles en modo debug).
const _debugTestUsers = <({String label, String email, String password})>[
  (label: 'Fiscal',     email: 'fiscal@sfit.test',     password: 'Sfit2026!'),
  (label: 'Operador',   email: 'operador@sfit.test',   password: 'Sfit2026!'),
  (label: 'Conductor',  email: 'conductor@sfit.test',  password: 'Sfit2026!'),
  (label: 'Ciudadano',  email: 'ciudadano@sfit.test',  password: 'Sfit2026!'),
];

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey      = GlobalKey<FormState>();
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure       = true;
  bool _loading       = false;
  bool _googleLoading = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final ok = await ref
        .read(authProvider.notifier)
        .login(_emailCtrl.text.trim(), _passwordCtrl.text);
    if (mounted) setState(() => _loading = false);
    if (!ok && mounted) {
      final err = ref.read(authProvider).errorMessage;
      _showError(err ?? 'Error al iniciar sesión');
    }
  }

  Future<void> _submitGoogle() async {
    setState(() => _googleLoading = true);
    final ok = await ref.read(authProvider.notifier).loginWithGoogle();
    if (mounted) setState(() => _googleLoading = false);
    if (!ok && mounted) {
      final err = ref.read(authProvider).errorMessage;
      if (err != null) _showError(err);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.danger,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 36),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [

              // ── Marca ─────────────────────────────────────────
              const SfitFullLogo(width: 160),

              const SizedBox(height: 48),

              // ── Encabezado ────────────────────────────────────
              Text(
                'ACCESO AL SISTEMA',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gold,
                  letterSpacing: 2.2,
                ),
              ),
              const SizedBox(height: 10),
              Text('Ingresar', style: tt.headlineMedium),
              const SizedBox(height: 6),
              Text(
                'Credenciales institucionales requeridas',
                style: tt.bodyMedium,
              ),

              const SizedBox(height: 36),

              // ── Formulario ────────────────────────────────────
              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [

                    _FieldLabel('Correo electrónico'),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        hintText: 'nombre@municipalidad.gob.pe',
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Requerido';
                        if (!v.contains('@')) return 'Correo inválido';
                        return null;
                      },
                    ),

                    const SizedBox(height: 20),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _FieldLabel('Contraseña'),
                        TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('¿Olvidaste tu contraseña?'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _passwordCtrl,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 20,
                            color: AppColors.ink4,
                          ),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Requerido' : null,
                    ),

                    const SizedBox(height: 28),

                    FilledButton(
                      onPressed: _loading ? null : _submit,
                      child: _loading
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Ingresar al sistema'),
                    ),

                    const SizedBox(height: 24),

                    // Divider
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Text('o continúa con', style: tt.bodySmall),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),

                    const SizedBox(height: 16),

                    OutlinedButton(
                      onPressed: _googleLoading ? null : _submitGoogle,
                      child: _googleLoading
                          ? const SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.ink6),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                _GoogleMark(),
                                SizedBox(width: 10),
                                Text('Continuar con Google'),
                              ],
                            ),
                    ),

                    // ── Autofill de prueba (solo en debug) ──────
                    if (kDebugMode) ...[
                      const SizedBox(height: 24),
                      _DebugAutofill(
                        onPick: (email, password) {
                          _emailCtrl.text = email;
                          _passwordCtrl.text = password;
                        },
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 36),

              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('¿No tienes cuenta?  ', style: tt.bodyMedium),
                    GestureDetector(
                      onTap: () => context.go('/register'),
                      child: Text(
                        'Solicitar acceso',
                        style: tt.bodyMedium?.copyWith(
                          color: AppColors.gold,
                          fontWeight: FontWeight.w600,
                        ),
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

// ── Label explícito encima del campo ──────────────────────────────
class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: GoogleFonts.plusJakartaSans(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      color: AppColors.ink9,
    ),
  );
}

// ── Google mark ──────────────────────────────────────────────────
class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: const Size(18, 18), painter: _GooglePainter());
}

// ── Debug autofill ───────────────────────────────────────────────
class _DebugAutofill extends StatelessWidget {
  final void Function(String email, String password) onPick;
  const _DebugAutofill({required this.onPick});

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bug_report_outlined, size: 14, color: AppColors.ink5),
              const SizedBox(width: 6),
              Text(
                'AUTOFILL DE PRUEBA (debug)',
                style: tt.labelSmall?.copyWith(
                  fontSize: 10,
                  color: AppColors.ink5,
                  letterSpacing: 1.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _debugTestUsers
                .map(
                  (u) => ActionChip(
                    label: Text(u.label),
                    onPressed: () => onPick(u.email, u.password),
                    visualDensity: VisualDensity.compact,
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: AppColors.ink2),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    final p = Paint()..style = PaintingStyle.fill;
    // Blue (right half)
    p.color = const Color(0xFF4285F4);
    canvas.drawRect(Rect.fromLTWH(s.width * 0.5, s.height * 0.35, s.width * 0.47, s.height * 0.3), p);
    // Full circle outlines using arcs
    p ..style = PaintingStyle.stroke ..strokeWidth = s.width * 0.21;
    p.color = const Color(0xFF4285F4);
    canvas.drawArc(Rect.fromLTWH(0, 0, s.width, s.height), -1.57, 3.66, false, p);
    p.color = const Color(0xFFEA4335);
    canvas.drawArc(Rect.fromLTWH(0, 0, s.width, s.height), -1.57, -1.31, false, p);
    p.color = const Color(0xFF34A853);
    canvas.drawArc(Rect.fromLTWH(0, 0, s.width, s.height), 1.57, 1.05, false, p);
    p.color = const Color(0xFFFBBC05);
    canvas.drawArc(Rect.fromLTWH(0, 0, s.width, s.height), 2.62, 0.96, false, p);
  }

  @override
  bool shouldRepaint(_) => false;
}
