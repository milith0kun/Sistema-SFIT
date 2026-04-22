import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_disclaimer_banner.dart';

/// Onboarding de primera apertura — 3 slides con PageView.
/// Al completar guarda `onboarding_done: true` en SharedPreferences y navega a /login.
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _controller = PageController();
  int _currentPage = 0;

  static const _slides = [
    _SlideData(
      icon: Icons.assignment_turned_in_outlined,
      title: 'Inspecciona vehículos municipales',
      subtitle:
          'Escanea el código QR de cualquier vehículo y verifica al instante '
          'si está habilitado, con quién circula y cuál es su historial de inspecciones.',
    ),
    _SlideData(
      icon: Icons.campaign_outlined,
      title: 'Reporta anomalías y gana SFITCoins',
      subtitle:
          'Cuando detectas una irregularidad, repórtala en segundos. '
          'Tus reportes validados te otorgan SFITCoins canjeables por beneficios municipales.',
    ),
    _SlideData(
      icon: Icons.monitor_heart_outlined,
      title: 'Monitorea fatiga y rutas en tiempo real',
      subtitle:
          'Accede a información de fatiga del conductor y las rutas activas '
          'para contribuir a un transporte público más seguro en tu ciudad.',
    ),
  ];

  Future<void> _finish() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
    if (mounted) context.go('/login');
  }

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeInOut,
      );
    } else {
      _finish();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _currentPage == _slides.length - 1;

    return Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar: Omitir ────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (!isLast)
                    TextButton(
                      onPressed: _finish,
                      child: Text(
                        'Omitir',
                        style: AppTheme.inter(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink5,
                        ),
                      ),
                    )
                  else
                    const SizedBox(height: 40),
                ],
              ),
            ),

            // ── PageView ───────────────────────────────────────────────────
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _currentPage = i),
                itemBuilder: (context, index) =>
                    _SlidePage(data: _slides[index]),
              ),
            ),

            // ── Indicadores de página ──────────────────────────────────────
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _slides.length,
                  (i) => AnimatedContainer(
                    duration: const Duration(milliseconds: 260),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _currentPage ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _currentPage
                          ? AppColors.gold
                          : AppColors.ink3,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
            ),

            // ── Disclaimer ────────────────────────────────────────────────
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: SfitDisclaimerBanner(compact: true),
            ),

            // ── Botón acción ───────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
              child: FilledButton(
                onPressed: _nextPage,
                style: FilledButton.styleFrom(
                  backgroundColor: isLast ? AppColors.gold : AppColors.panel,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  isLast ? 'Comenzar' : 'Siguiente',
                  style: AppTheme.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Slide individual ───────────────────────────────────────────────────────────
class _SlideData {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SlideData({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
}

class _SlidePage extends StatelessWidget {
  final _SlideData data;
  const _SlidePage({required this.data});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // ── Ícono circular ───────────────────────────────────────────────
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.goldBorder, width: 2),
            ),
            child: Icon(
              data.icon,
              size: 56,
              color: AppColors.goldDark,
            ),
          ),
          const SizedBox(height: 36),

          // ── Título ───────────────────────────────────────────────────────
          Text(
            data.title,
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
              letterSpacing: -0.4,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 16),

          // ── Subtítulo ────────────────────────────────────────────────────
          Text(
            data.subtitle,
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 14.5,
              color: AppColors.ink5,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
