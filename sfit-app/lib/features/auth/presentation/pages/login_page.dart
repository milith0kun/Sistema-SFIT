import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/navigation/navigation_key.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_mark.dart';
import '../../../../shared/widgets/widgets.dart';
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
    if (!mounted) return;
    if (ok) {
      // Notifica al sistema de autofill (Google Password Manager / 1Password /
      // Bitwarden / LastPass) que el flujo terminó bien y debe ofrecer guardar
      // o actualizar la credencial. Sin esta llamada el SO no muestra el prompt
      // "¿Guardar contraseña?".
      TextInput.finishAutofillContext();
      final user = ref.read(authProvider).user;
      _showSuccess(user?.name);
    } else {
      final err = ref.read(authProvider).errorMessage;
      _showError(err ?? 'Error al iniciar sesión');
    }
  }

  Future<void> _submitGoogle() async {
    setState(() => _googleLoading = true);
    final ok = await ref.read(authProvider.notifier).loginWithGoogle();
    if (mounted) setState(() => _googleLoading = false);
    if (!mounted) return;
    if (ok) {
      final user = ref.read(authProvider).user;
      _showSuccess(user?.name);
    } else {
      final err = ref.read(authProvider).errorMessage;
      if (err != null) _showError(err);
    }
  }

  void _showSuccess(String? userName) {
    final greeting = userName != null && userName.isNotEmpty
        ? 'Bienvenido, ${userName.split(' ').first}'
        : 'Sesión iniciada correctamente';
    showAppSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded,
                color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(greeting)),
          ],
        ),
        backgroundColor: AppColors.apto,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showError(String msg) {
    showAppSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline_rounded,
                color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(msg)),
          ],
        ),
        backgroundColor: AppColors.noApto,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  Future<void> _openForgotPassword() async {
    final webBase = ApiConstants.baseUrl.replaceFirst('/api', '');
    final uri = Uri.parse('$webBase/reset-password');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

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

              // ── Kicker + título (Inter, no Syne) ─────────────
              const _Kicker(),
              const SizedBox(height: 10),
              Text(
                'Ingresar',
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
                'Ingresa con tu correo y contraseña',
                style: AppTheme.inter(
                  fontSize: 14,
                  color: AppColors.ink6,
                  height: 1.45,
                ),
              ),

              const SizedBox(height: 32),

              Form(
                key: _formKey,
                // AutofillGroup permite que Google Password Manager / Bitwarden /
                // 1Password / LastPass ofrezcan guardar y autocompletar email +
                // contraseña como un par. Sin esto el SO trata cada campo de
                // forma aislada y no ofrece guardar.
                child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _FieldLabel('Correo electrónico'),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [
                        AutofillHints.username,
                        AutofillHints.email,
                      ],
                      decoration: const InputDecoration(
                        hintText: 'nombre@municipalidad.gob.pe',
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Requerido';
                        if (!v.contains('@')) return 'Correo inválido';
                        return null;
                      },
                    ),
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const _FieldLabel('Contraseña'),
                        TextButton(
                          onPressed: _openForgotPassword,
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
                      autofillHints: const [AutofillHints.password],
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

                    const SizedBox(height: 26),

                    SfitPrimaryButton(
                      label: 'Ingresar al sistema',
                      onPressed: _submit,
                      loading: _loading,
                      icon: Icons.arrow_forward_rounded,
                    ),

                    const SizedBox(height: 22),

                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Text(
                            'o continúa con',
                            style: AppTheme.inter(
                              fontSize: 12.5,
                              color: AppColors.ink5,
                            ),
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),

                    const SizedBox(height: 14),

                    OutlinedButton(
                      onPressed: _googleLoading ? null : _submitGoogle,
                      child: _googleLoading
                          ? const SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.ink6,
                              ),
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


                  ],
                ),
                ),
              ),

              const SizedBox(height: 32),

              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '¿No tienes cuenta?  ',
                      style: AppTheme.inter(
                        fontSize: 13.5, color: AppColors.ink6,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/register'),
                      child: Text(
                        'Solicitar acceso',
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

              const SizedBox(height: 28),
              const SfitDisclaimerBanner(),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Kicker uppercase con dot gold ───────────────────────────────
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
            'ACCESO AL SISTEMA',
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

class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: const Size(18, 18), painter: _GooglePainter());
}



class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    final p = Paint()..style = PaintingStyle.fill;
    p.color = const Color(0xFF4285F4);
    canvas.drawRect(
      Rect.fromLTWH(s.width * 0.5, s.height * 0.35, s.width * 0.47, s.height * 0.3),
      p,
    );
    p
      ..style = PaintingStyle.stroke
      ..strokeWidth = s.width * 0.21;
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
