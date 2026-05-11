import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../companies/presentation/widgets/scope_badge.dart';
import '../../data/datasources/operator_api_service.dart';

/// Creación de una ruta nueva desde la app móvil — RF-09 (mobile).
///
/// Pantalla minimalista: pide solo lo mínimo necesario para que el backend
/// acepte el POST `/api/rutas`. El refinado (paraderos GPS, horarios extra,
/// tags, parámetros) se hace luego en `RouteEditPage` que se abre
/// automáticamente tras crear con éxito.
///
/// El `serviceScope` lo lee del dashboard del operador — no se pregunta
/// porque ya quedó definido en el onboarding y debe ser consistente con
/// la empresa. Si la empresa es urbana, la ruta puede crearse con paraderos
/// vacíos y agregarse después. Si es interprovincial, exigimos UBIGEOs de
/// origen y destino + al menos un horario.
class NuevaRutaPage extends ConsumerStatefulWidget {
  const NuevaRutaPage({super.key});

  @override
  ConsumerState<NuevaRutaPage> createState() => _NuevaRutaPageState();
}

class _NuevaRutaPageState extends ConsumerState<NuevaRutaPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtl = TextEditingController();
  final _codeCtl = TextEditingController();
  final _originCtl = TextEditingController();
  final _destinationCtl = TextEditingController();
  final _firstScheduleCtl = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameCtl.dispose();
    _codeCtl.dispose();
    _originCtl.dispose();
    _destinationCtl.dispose();
    _firstScheduleCtl.dispose();
    super.dispose();
  }

  bool _isUrbano(String scope) =>
      scope == 'urbano_distrital' || scope == 'urbano_provincial';

  Future<void> _save(String scope) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final payload = <String, dynamic>{
        'name': _nameCtl.text.trim(),
        'code': _codeCtl.text.trim().toUpperCase(),
        'serviceScope': scope,
        'type': 'ruta',
      };
      if (_isUrbano(scope)) {
        // Sin waypoints aún — el operador los captura después con GPS.
        // El backend rechazará el POST si exige >= 2; en ese caso, el catch
        // muestra el error real al usuario.
        payload['waypoints'] = [];
        payload['stops'] = 0;
      } else {
        payload['originDistrictCode'] = _originCtl.text.trim();
        payload['destinationDistrictCode'] = _destinationCtl.text.trim();
        if (_firstScheduleCtl.text.trim().isNotEmpty) {
          payload['departureSchedules'] = [_firstScheduleCtl.text.trim()];
        } else {
          payload['departureSchedules'] = <String>[];
        }
      }
      final route = await ref
          .read(operatorApiServiceProvider)
          .createRoute(payload);
      if (!mounted) return;
      ref.invalidate(operadorRoutesProvider);
      // Abrir el editor para que el operador termine de configurar la ruta
      // (paraderos GPS, tags, capacidad). El pop replace devuelve a la lista.
      context.pushReplacement(
        '/operador/rutas/${route.id}/editar',
      );
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = (e.response?.data as Map?)?['error']?.toString() ??
            'No se pudo crear la ruta';
        _saving = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Error: $e';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(operatorDashboardProvider);
    final scope = dashboard.maybeWhen(
      data: (s) => s.company?.serviceScope,
      orElse: () => null,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nueva ruta'),
      ),
      body: SafeArea(
        child: scope == null
            ? const _LoadingOrNoCompany()
            : _buildForm(scope),
      ),
    );
  }

  Widget _buildForm(String scope) {
    final urbano = _isUrbano(scope);
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ScopeBadge(scope: scope),
          const SizedBox(height: 8),
          Text(
            urbano
                ? 'Vas a crear una ruta urbana. Después de guardar podrás capturar los paraderos con GPS.'
                : 'Vas a crear una ruta interprovincial. Necesitamos los UBIGEOs (6 dígitos) de origen y destino.',
            style: AppTheme.inter(
              fontSize: 12.5,
              color: AppColors.ink6,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),

          TextFormField(
            controller: _nameCtl,
            decoration: const InputDecoration(
              labelText: 'Nombre de la ruta *',
              hintText: 'Ej: Cusco - San Sebastián',
              border: OutlineInputBorder(),
            ),
            maxLength: 100,
            validator: (v) {
              if (v == null || v.trim().length < 3) {
                return 'Mínimo 3 caracteres';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _codeCtl,
            decoration: const InputDecoration(
              labelText: 'Código *',
              hintText: 'Ej: R-101',
              border: OutlineInputBorder(),
            ),
            maxLength: 20,
            textCapitalization: TextCapitalization.characters,
            validator: (v) {
              if (v == null || v.trim().length < 2) {
                return 'Mínimo 2 caracteres';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),

          if (!urbano) ...[
            TextFormField(
              controller: _originCtl,
              decoration: const InputDecoration(
                labelText: 'UBIGEO de origen *',
                hintText: '6 dígitos',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              validator: (v) {
                if (v == null || v.trim().length != 6) {
                  return 'Debe tener 6 dígitos';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _destinationCtl,
              decoration: const InputDecoration(
                labelText: 'UBIGEO de destino *',
                hintText: '6 dígitos',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              validator: (v) {
                if (v == null || v.trim().length != 6) {
                  return 'Debe tener 6 dígitos';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _firstScheduleCtl,
              decoration: const InputDecoration(
                labelText: 'Primer horario (opcional)',
                hintText: 'HH:mm — ej: 06:30',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.datetime,
              inputFormatters: [
                LengthLimitingTextInputFormatter(5),
                FilteringTextInputFormatter.allow(RegExp(r'[0-9:]')),
              ],
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                if (!RegExp(r'^\d{2}:\d{2}$').hasMatch(v.trim())) {
                  return 'Formato HH:mm';
                }
                return null;
              },
            ),
            const SizedBox(height: 8),
            Text(
              'Podrás agregar más horarios después en Editar ruta.',
              style: AppTheme.inter(
                fontSize: 11.5,
                color: AppColors.ink6,
              ).copyWith(fontStyle: FontStyle.italic),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.noAptoBg,
                border: Border.all(color: AppColors.noAptoBorder),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _error!,
                style: AppTheme.inter(
                  fontSize: 12.5,
                  color: AppColors.noApto,
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),

          SizedBox(
            height: 50,
            child: FilledButton.icon(
              onPressed: _saving ? null : () => _save(scope),
              icon: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.check_rounded),
              label: Text(
                urbano ? 'Crear y agregar paraderos' : 'Crear ruta',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingOrNoCompany extends ConsumerWidget {
  const _LoadingOrNoCompany();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(operatorDashboardProvider);
    return dashboard.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No se pudo cargar la empresa: $e',
            textAlign: TextAlign.center,
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink7),
          ),
        ),
      ),
      data: (_) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.business_outlined,
                  size: 48, color: AppColors.ink5),
              const SizedBox(height: 12),
              Text(
                'Tu cuenta no tiene una empresa con tipo de servicio definido. '
                'Completa el onboarding o pide al admin que configure tu empresa.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13.5, color: AppColors.ink7),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
