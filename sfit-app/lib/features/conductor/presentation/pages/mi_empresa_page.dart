import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../companies/data/datasources/companies_api_service.dart';
import '../../../companies/presentation/widgets/scope_badge.dart';
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
            'ruc': data['companyRuc'],
            'serviceScope': data['companyServiceScope'],
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
          'serviceScope': data['companyServiceScope'],
        };
        _saving = false;
      });
      // Refresh sincrónico (await): nos aseguramos que cuando el usuario
      // haga back, el dashboard ya tenga el nuevo profile cacheado en el
      // provider. Antes usábamos `invalidate` (async) y el dashboard
      // ocasionalmente renderizaba con la versión vieja durante 1-2
      // frames antes del refetch — daba la sensación de "no se guardó".
      try {
        await ref.refresh(myDriverProfileProvider.future);
      } catch (_) {/* no bloqueante */}
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Te asociaste a ${data['companyName']}'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.apto,
          duration: const Duration(seconds: 3),
        ),
      );
      // NO hacemos pop automático: el usuario debe ver la card de
      // "Empresa asociada" actualizada con el badge correcto para
      // confirmar visualmente que el cambio se aplicó. Si quiere volver,
      // usa el back arrow del AppBar. Antes el pop instantáneo daba la
      // sensación de "no pasó nada" porque la pantalla anterior aún no
      // había refrescado el provider.
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
                        onChange: () => _confirmChangeCompany(),
                      )
                    : _OnboardingCard(),
              ),
              // El buscador y la lista solo se muestran si:
              //   a) el conductor aún no se asoció a ninguna empresa, o
              //   b) tocó "Cambiar" en la card actual (que ahora pasa por
              //      un dialog de confirmación que limpia _currentCompany).
              // Antes el buscador estaba siempre visible incluso con empresa
              // asociada → el conductor podía seleccionar otra por accidente.
              if (hasCompany) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                  child: Text(
                    'Estás asociado correctamente. Si necesitas cambiar de '
                    'empresa, toca "Cambiar" arriba.',
                    style: AppTheme.inter(
                      fontSize: 12.5,
                      color: AppColors.ink6,
                      height: 1.4,
                    ),
                  ),
                ),
                const Spacer(),
              ] else ...[
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
              ], // ← cierra el bloque "else hasCompany" (sin empresa)
            ]),
    );
  }

  /// Pregunta al conductor si realmente quiere cambiar de empresa antes de
  /// ocultar el card actual y volver a mostrar el buscador. Sin esta
  /// confirmación, un tap accidental en "Cambiar" disparaba el flujo de
  /// re-selección y el usuario podía asociarse por error a otra empresa.
  Future<void> _confirmChangeCompany() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cambiar de empresa'),
        content: const Text(
          'Vas a desasociarte de tu empresa actual y buscar otra. ¿Continuar?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sí, cambiar'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      setState(() => _currentCompany = null);
    }
  }
}

class _CurrentCompanyCard extends StatelessWidget {
  final Map<String, dynamic> company;
  final VoidCallback onChange;

  const _CurrentCompanyCard({required this.company, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final scope = company['serviceScope'] as String?;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.aptoBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.aptoBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
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
                  if (company['ruc'] != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'RUC ${company['ruc']}',
                      style: AppTheme.inter(
                        fontSize: 11.5, color: AppColors.ink6, tabular: true),
                    ),
                  ],
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
          const SizedBox(height: 10),
          // Tipo de servicio: el badge ya dice si la empresa opera con o sin
          // paraderos. El texto debajo explica las implicancias prácticas
          // para que el conductor sepa qué esperar al iniciar turno.
          Row(children: [ScopeBadge(scope: scope)]),
          const SizedBox(height: 6),
          Text(
            scopeExplanation(scope),
            style: AppTheme.inter(
              fontSize: 12, color: AppColors.ink7, height: 1.4),
          ),
        ],
      ),
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
                // Badge SIEMPRE visible — si la empresa no tiene scope
                // (legacy) muestra "Sin clasificar" para que el usuario
                // sepa que es un dato pendiente de completar.
                const SizedBox(height: 5),
                ScopeBadge(
                  scope: company['serviceScope'] as String?,
                  compact: true,
                ),
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
