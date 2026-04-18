import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../providers/auth_provider.dart';

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
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [

              // ── Marca SFIT ─────────────────────────────────────
              Row(
                children: [
                  const _SfitMark(size: 34),
                  const SizedBox(width: 10),
                  Text(
                    'SFIT',
                    style: tt.titleLarge?.copyWith(
                      letterSpacing: 0.18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 44),

              // ── Encabezado ─────────────────────────────────────
              Text(
                'ACCESO AL SISTEMA',
                style: tt.labelSmall?.copyWith(
                  color: AppColors.gold,
                  letterSpacing: 2.0,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Ingresar',
                style: tt.headlineMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'Credenciales institucionales requeridas',
                style: tt.bodyMedium?.copyWith(color: AppColors.ink5),
              ),

              const SizedBox(height: 32),

              // ── Formulario ─────────────────────────────────────
              Form(
                key: _formKey,
                child: Column(
                  children: [

                    // Email
                    TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Correo electrónico',
                        hintText: 'nombre@municipalidad.gob.pe',
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Requerido';
                        if (!v.contains('@')) return 'Correo inválido';
                        return null;
                      },
                    ),

                    const SizedBox(height: 16),

                    // Contraseña
                    TextFormField(
                      controller: _passwordCtrl,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Contraseña',
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 20,
                            color: AppColors.ink4,
                          ),
                          onPressed: () =>
                              setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Requerido' : null,
                    ),

                    // ¿Olvidaste contraseña? (RF-01-09)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        child: const Text('¿Olvidaste tu contraseña?'),
                      ),
                    ),

                    const SizedBox(height: 4),

                    // Botón principal
                    FilledButton(
                      onPressed: _loading ? null : _submit,
                      child: _loading
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Ingresar al sistema'),
                    ),

                    const SizedBox(height: 20),

                    // Divider
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Text(
                            'o continúa con',
                            style: tt.bodySmall?.copyWith(color: AppColors.ink4),
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Botón Google (RF-01-01)
                    OutlinedButton(
                      onPressed: _googleLoading ? null : _submitGoogle,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 50),
                      ),
                      child: _googleLoading
                          ? const SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.ink6,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const _GoogleMark(),
                                const SizedBox(width: 10),
                                const Text('Continuar con Google'),
                              ],
                            ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Link a registro
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '¿No tienes cuenta? ',
                      style: tt.bodyMedium?.copyWith(color: AppColors.ink5),
                    ),
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

// ── SFIT diamond mark ──────────────────────────────────────────────
class _SfitMark extends StatelessWidget {
  final double size;
  const _SfitMark({required this.size});

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(size, size), painter: _SfitMarkPainter());
}

class _SfitMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    final stroke = Paint()
      ..color = AppColors.gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = s.width * 0.055
      ..strokeJoin = StrokeJoin.miter;

    final fill = Paint()
      ..color = AppColors.gold
      ..style = PaintingStyle.fill;

    canvas.drawPath(
      Path()
        ..moveTo(s.width * 0.5,   s.height * 0.094)
        ..lineTo(s.width * 0.906, s.height * 0.5)
        ..lineTo(s.width * 0.5,   s.height * 0.906)
        ..lineTo(s.width * 0.094, s.height * 0.5)
        ..close(),
      stroke,
    );
    canvas.drawPath(
      Path()
        ..moveTo(s.width * 0.5,   s.height * 0.297)
        ..lineTo(s.width * 0.703, s.height * 0.5)
        ..lineTo(s.width * 0.5,   s.height * 0.703)
        ..lineTo(s.width * 0.297, s.height * 0.5)
        ..close(),
      fill,
    );
  }

  @override
  bool shouldRepaint(_) => false;
}

// ── Google mark (SVG paths en Canvas) ────────────────────────────
class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: const Size(18, 18), painter: _GooglePainter());
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    final paint = Paint()..style = PaintingStyle.fill;
    final cx = s.width / 2;
    final cy = s.height / 2;
    final r  = s.width / 2;

    // Blue arc
    paint.color = const Color(0xFF4285F4);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: r),
      -1.571, // -90°
      3.665,  // ~210°
      false,
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = s.width * 0.22,
    );

    // Red arc
    paint
      ..color = const Color(0xFFEA4335)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s.width * 0.22;
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: r),
      -1.571,
      -1.309,
      false,
      paint,
    );

    // Horizontal bar (right side - blue)
    paint
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.fill;
    canvas.drawRect(
      Rect.fromLTWH(cx, cy - s.height * 0.11, r * 0.95, s.height * 0.22),
      paint,
    );
  }

  @override
  bool shouldRepaint(_) => false;
}
