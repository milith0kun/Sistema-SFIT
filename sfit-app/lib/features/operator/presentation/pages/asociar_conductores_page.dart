import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/models/conductor_model.dart';
import '../../data/datasources/operator_api_service.dart';

/// Pantalla del operador "Asociar conductores".
///
/// El operador busca conductores de su misma muni (que aún no están en su
/// empresa o están en otra) y los asocia con un tap. Es la otra mitad del
/// onboarding crowd: el conductor también puede elegir empresa por sí mismo
/// desde MiEmpresaPage.
class AsociarConductoresPage extends ConsumerStatefulWidget {
  const AsociarConductoresPage({super.key});

  @override
  ConsumerState<AsociarConductoresPage> createState() =>
      _AsociarConductoresPageState();
}

class _AsociarConductoresPageState extends ConsumerState<AsociarConductoresPage> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  bool _onlyUnassigned = true;
  List<ConductorModel> _items = [];
  // Si el operador no tiene empresa asignada (400/422 desde el backend),
  // mostramos un empty state explicativo en lugar del listado vacío.
  bool _noCompany = false;
  String? _noCompanyMessage;
  // ID de los conductores que están siendo asociados ahora mismo (para el spinner).
  final Set<String> _associating = {};

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(value));
  }

  Future<void> _search(String q) async {
    setState(() {
      _loading = true;
      _noCompany = false;
      _noCompanyMessage = null;
    });
    try {
      final svc = ref.read(operatorApiServiceProvider);
      final items = await svc.getOperadorConductores(q: q, limit: 30);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      final code = e.response?.statusCode ?? 0;
      if (code == 400 || code == 422) {
        final data = e.response?.data;
        final apiMsg = (data is Map && data['error'] is String)
            ? data['error'] as String
            : null;
        setState(() {
          _items = const [];
          _loading = false;
          _noCompany = true;
          _noCompanyMessage = apiMsg;
        });
        return;
      }
      setState(() {
        _items = const [];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() { _items = const []; _loading = false; });
    }
  }

  Future<void> _associate(ConductorModel driver) async {
    final id = driver.id;
    if (_associating.contains(id)) return;
    setState(() => _associating.add(id));
    try {
      final svc = ref.read(operatorApiServiceProvider);
      await svc.asociarConductor(id);
      ref.invalidate(operadorConductoresProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${driver.name} asociado'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.apto,
        ),
      );
      await _search(_searchCtrl.text);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${_extractError(e)}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.noApto,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _associating.remove(id));
    }
  }

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (data is Map && data['message'] is String) return data['message'] as String;
    }
    return 'No se pudo completar la operación';
  }

  @override
  Widget build(BuildContext context) {
    final myCompanyId = ref.watch(miEmpresaProvider).asData?.value['_id'] as String?
        ?? ref.watch(miEmpresaProvider).asData?.value['id'] as String?;
    final visibleItems = _onlyUnassigned
        ? _items.where((c) => c.companyId != myCompanyId).toList()
        : _items;
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Asociar conductores',
          style: AppTheme.inter(
              fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: Column(children: [
        // ── Buscador ─────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
          child: TextField(
            controller: _searchCtrl,
            onChanged: _onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Buscar por nombre o DNI',
              hintStyle: AppTheme.inter(fontSize: 14, color: AppColors.ink4),
              prefixIcon: const Icon(Icons.search, color: AppColors.ink5),
              suffixIcon: _loading
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
                          onPressed: () { _searchCtrl.clear(); _search(''); },
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
        // ── Filtro: solo no asignados ────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(children: [
            Switch.adaptive(
              value: _onlyUnassigned,
              activeThumbColor: AppColors.gold,
              onChanged: (v) {
                setState(() => _onlyUnassigned = v);
              },
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _onlyUnassigned
                    ? 'Solo conductores sin mi empresa'
                    : 'Mostrar todos los conductores',
                style: AppTheme.inter(
                  fontSize: 12.5, color: AppColors.ink7, fontWeight: FontWeight.w600),
              ),
            ),
          ]),
        ),
        // ── Lista ────────────────────────────────────────────────
        Expanded(
          child: visibleItems.isEmpty && !_loading
              ? (_noCompany
                  ? _NoCompanyState(message: _noCompanyMessage)
                  : const _EmptyState())
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: visibleItems.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final d = visibleItems[i];
                    final isMine = myCompanyId != null && d.companyId == myCompanyId;
                    return _DriverTile(
                      driver: d,
                      isMine: isMine,
                      busy: _associating.contains(d.id),
                      onAssociate: () => _associate(d),
                    );
                  },
                ),
        ),
      ]),
    );
  }
}

class _DriverTile extends StatelessWidget {
  final ConductorModel driver;
  final bool isMine;
  final bool busy;
  final VoidCallback onAssociate;

  const _DriverTile({
    required this.driver,
    required this.isMine,
    required this.busy,
    required this.onAssociate,
  });

  Color _statusColor(String? s) => switch (s) {
        'apto' => AppColors.apto,
        'riesgo' => AppColors.riesgo,
        _ => AppColors.noApto,
      };

  @override
  Widget build(BuildContext context) {
    final company = driver.companyName;
    final status = driver.status;
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isMine ? AppColors.aptoBorder : AppColors.ink2),
      ),
      child: Row(children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            shape: BoxShape.circle,
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Icon(Icons.person, color: color, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                driver.name.isEmpty ? '—' : driver.name,
                style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.ink9),
                maxLines: 1, overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Row(children: [
                const Icon(Icons.badge_outlined, size: 11, color: AppColors.ink5),
                const SizedBox(width: 3),
                Text(
                  'DNI ${driver.dni ?? "—"}',
                  style: AppTheme.inter(fontSize: 11, color: AppColors.ink6, tabular: true),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.credit_card, size: 11, color: AppColors.ink5),
                const SizedBox(width: 3),
                Flexible(
                  child: Text(
                    driver.licenseNumber ?? '—',
                    style: AppTheme.inter(fontSize: 11, color: AppColors.ink6, tabular: true),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                  ),
                ),
              ]),
              if (company != null) ...[
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isMine ? AppColors.aptoBg : AppColors.ink1,
                    border: Border.all(color: isMine ? AppColors.aptoBorder : AppColors.ink2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isMine ? 'Tu empresa · $company' : company,
                    style: AppTheme.inter(
                      fontSize: 10, fontWeight: FontWeight.w700,
                      color: isMine ? AppColors.apto : AppColors.ink6),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 8),
        if (isMine)
          const Icon(Icons.check_circle, color: AppColors.apto, size: 22)
        else
          FilledButton(
            onPressed: busy ? null : onAssociate,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: busy
                ? const SizedBox(
                    width: 14, height: 14,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : Text(
                    'Asociar',
                    style: AppTheme.inter(
                      fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
          ),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: AppColors.ink1,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.ink2),
              ),
              child: const Icon(Icons.person_search, size: 30, color: AppColors.ink5),
            ),
            const SizedBox(height: 14),
            Text(
              'Sin conductores',
              style: AppTheme.inter(
                  fontSize: 14.5, fontWeight: FontWeight.w800, color: AppColors.ink9),
            ),
            const SizedBox(height: 4),
            Text(
              'No hay conductores que coincidan con tu búsqueda. Pide a los conductores que se registren en SFIT primero.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink6, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

/// Empty state cuando el backend devuelve 400/422 porque el operador no
/// tiene empresa/municipio asignado. Mostramos el mensaje del backend si
/// viene, o un fallback explicativo.
class _NoCompanyState extends StatelessWidget {
  final String? message;
  const _NoCompanyState({this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: AppColors.noAptoBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.noAptoBorder),
              ),
              child: const Icon(Icons.business_outlined,
                  size: 30, color: AppColors.noApto),
            ),
            const SizedBox(height: 14),
            Text(
              'Sin empresa asignada',
              style: AppTheme.inter(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink9),
            ),
            const SizedBox(height: 4),
            Text(
              message ??
                  'Tu cuenta no tiene una empresa asignada. Contacta al administrador municipal para que te vincule a una empresa antes de asociar conductores.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                  fontSize: 12, color: AppColors.ink6, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
