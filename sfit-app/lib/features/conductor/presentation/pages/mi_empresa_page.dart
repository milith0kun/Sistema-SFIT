import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../companies/data/datasources/companies_api_service.dart';
import '../../../drivers/data/datasources/driver_api_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Pantalla de onboarding "Mi empresa" para el conductor.
///
/// El conductor llega aquí cuando entra por primera vez sin tener un
/// `companyId` asignado en su `Driver` doc. Permite buscar empresas activas
/// (público, sin filtro por municipio) y asociarse a la elegida con un
/// PATCH /api/conductores/me.
class MiEmpresaPage extends ConsumerStatefulWidget {
  const MiEmpresaPage({super.key});

  @override
  ConsumerState<MiEmpresaPage> createState() => _MiEmpresaPageState();
}

class _MiEmpresaPageState extends ConsumerState<MiEmpresaPage> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  bool _loadingProfile = true;
  bool _searching = false;
  bool _saving = false;

  /// Empresa actualmente asignada al conductor (puede ser null en primer login).
  Map<String, dynamic>? _currentCompany;
  /// Resultados de búsqueda.
  List<Map<String, dynamic>> _results = [];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    await Future.wait([_loadProfile(), _search('')]);
  }

  Future<void> _loadProfile() async {
    try {
      final data = await ref.read(driverApiServiceProvider).getMyDriverProfile();
      if (!mounted) return;
      setState(() {
        if (data != null && data['companyId'] != null) {
          _currentCompany = {
            'id': data['companyId'],
            'razonSocial': data['companyName'],
          };
        }
        _loadingProfile = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingProfile = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(value));
  }

  Future<void> _search(String q) async {
    setState(() => _searching = true);
    try {
      final items = await ref
          .read(companiesApiServiceProvider)
          .searchPublic(q: q, limit: 30);
      if (!mounted) return;
      setState(() { _results = items; _searching = false; });
    } catch (_) {
      if (mounted) setState(() { _results = const []; _searching = false; });
    }
  }

  Future<void> _selectCompany(Map<String, dynamic> company) async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final data = await ref
          .read(driverApiServiceProvider)
          .setMyCompany(company['id'] as String);
      if (!mounted) return;
      setState(() {
        _currentCompany = {
          'id': data['companyId'],
          'razonSocial': data['companyName'],
          'ruc': data['companyRuc'],
        };
        _saving = false;
      });
      ref.invalidate(myDriverProfileProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Te asociaste a ${data['companyName']}'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.apto,
        ),
      );
      // Si vinimos del onboarding (sin empresa previa), volvemos al home.
      await Future.delayed(const Duration(milliseconds: 600));
      if (mounted && context.canPop()) {
        context.pop();
      } else if (mounted) {
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${_extractError(e)}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.noApto,
          ),
        );
      }
    }
  }

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (data is Map && data['message'] is String) return data['message'] as String;
    }
    return 'No se pudo guardar';
  }

  @override
  Widget build(BuildContext context) {
    final hasCompany = _currentCompany != null;

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: context.canPop() ? const BackButton() : null,
        title: Text(
          'Mi empresa',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: _loadingProfile
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : Column(children: [
              // ── Card de estado actual ────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                child: hasCompany
                    ? _CurrentCompanyCard(
                        company: _currentCompany!,
                        onChange: () => setState(() => _currentCompany = null),
                      )
                    : _OnboardingCard(),
              ),
              // ── Buscador ─────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: _onSearchChanged,
                  decoration: InputDecoration(
                    hintText: 'Buscar por RUC o razón social',
                    hintStyle: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
                    prefixIcon: const Icon(Icons.search, color: AppColors.ink5),
                    suffixIcon: _searching
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.gold),
                            ),
                          )
                        : (_searchCtrl.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.close, size: 18, color: AppColors.ink5),
                                onPressed: () {
                                  _searchCtrl.clear();
                                  _search('');
                                },
                              )
                            : null),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.ink2),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.ink2),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.gold, width: 2),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    fillColor: Colors.white,
                    filled: true,
                  ),
                  style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
                ),
              ),
              // ── Lista ────────────────────────────────────────
              Expanded(
                child: _results.isEmpty && !_searching
                    ? const _EmptyResults()
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        itemCount: _results.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final c = _results[i];
                          final isCurrent = _currentCompany?['id'] == c['id'];
                          return _CompanyTile(
                            company: c,
                            isCurrent: isCurrent,
                            disabled: _saving,
                            onTap: () => _selectCompany(c),
                          );
                        },
                      ),
              ),
            ]),
    );
  }
}

class _CurrentCompanyCard extends StatelessWidget {
  final Map<String, dynamic> company;
  final VoidCallback onChange;

  const _CurrentCompanyCard({required this.company, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.aptoBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.aptoBorder),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: AppColors.apto.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_circle, color: AppColors.apto, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Empresa asociada',
                style: AppTheme.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppColors.apto,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                (company['razonSocial'] ?? '—').toString(),
                style: AppTheme.inter(
                  fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink9),
                maxLines: 2, overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: onChange,
          child: Text(
            'Cambiar',
            style: AppTheme.inter(
              fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.goldDark),
          ),
        ),
      ]),
    );
  }
}

class _OnboardingCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.goldBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.goldBorder),
      ),
      child: Row(children: [
        const Icon(Icons.apartment_rounded, size: 22, color: AppColors.goldDark),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Asóciate a tu empresa',
                style: AppTheme.inter(
                  fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.ink9),
              ),
              const SizedBox(height: 2),
              Text(
                'Elige la empresa de transporte para la que conduces. Esto te habilita a iniciar turno.',
                style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink6),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

class _CompanyTile extends StatelessWidget {
  final Map<String, dynamic> company;
  final bool isCurrent;
  final bool disabled;
  final VoidCallback onTap;

  const _CompanyTile({
    required this.company,
    required this.isCurrent,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: disabled ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isCurrent ? AppColors.goldBorder : AppColors.ink2,
            width: isCurrent ? 1.5 : 1,
          ),
        ),
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: const BoxDecoration(
              color: AppColors.ink1,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.apartment_rounded, color: AppColors.ink6, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (company['razonSocial'] ?? '—').toString(),
                  style: AppTheme.inter(
                    fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.ink9),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(children: [
                  const Icon(Icons.numbers, size: 11, color: AppColors.ink5),
                  const SizedBox(width: 3),
                  Text(
                    'RUC ${company['ruc'] ?? '—'}',
                    style: AppTheme.inter(
                      fontSize: 11, color: AppColors.ink6, tabular: true),
                  ),
                  if (company['municipalityName'] != null) ...[
                    const SizedBox(width: 8),
                    const Icon(Icons.place_outlined, size: 11, color: AppColors.ink5),
                    const SizedBox(width: 3),
                    Flexible(
                      child: Text(
                        (company['municipalityName'] ?? '').toString(),
                        style: AppTheme.inter(fontSize: 11, color: AppColors.ink6),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ]),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (isCurrent)
            const Icon(Icons.check_circle, color: AppColors.apto, size: 22)
          else
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.ink4),
        ]),
      ),
    );
  }
}

class _EmptyResults extends StatelessWidget {
  const _EmptyResults();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: AppColors.ink1,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.ink2),
              ),
              child: const Icon(Icons.apartment_outlined, size: 26, color: AppColors.ink5),
            ),
            const SizedBox(height: 14),
            Text(
              'Sin resultados',
              style: AppTheme.inter(
                fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink9),
            ),
            const SizedBox(height: 4),
            Text(
              'Pide a tu empresa que se registre en SFIT para que aparezca aquí.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
            ),
          ],
        ),
      ),
    );
  }
}
