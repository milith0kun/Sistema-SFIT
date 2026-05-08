import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Pantalla pública para buscar un vehículo por placa.
///
/// El backend ya expone `GET /api/public/vehiculo?plate=...` y la página de
/// detalle vive en `/vehiculo-publico/:plate`. Esta pantalla es el "front
/// door" para que el ciudadano descubra esa funcionalidad sin necesidad de
/// escanear un QR primero.
class BuscarVehiculoPage extends StatefulWidget {
  const BuscarVehiculoPage({super.key});

  @override
  State<BuscarVehiculoPage> createState() => _BuscarVehiculoPageState();
}

class _BuscarVehiculoPageState extends State<BuscarVehiculoPage> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    final plate = _ctrl.text.trim().toUpperCase().replaceAll(RegExp(r'\s+'), '');
    if (plate.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Ingresa una placa válida (mínimo 4 caracteres).'),
          backgroundColor: AppColors.noApto,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    context.push('/vehiculo-publico/$plate');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Buscar vehículo',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: AppColors.goldBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.goldBorder, width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.directions_car_filled,
                      size: 38, color: AppColors.goldDark),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Consulta cualquier vehículo',
                textAlign: TextAlign.center,
                style: AppTheme.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink9,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Ingresa la placa para ver reputación, conductor habitual, empresa y última inspección.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(
                  fontSize: 13,
                  color: AppColors.ink6,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _ctrl,
                textCapitalization: TextCapitalization.characters,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9-]')),
                  LengthLimitingTextInputFormatter(10),
                ],
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  hintText: 'Ej. ABC-123',
                  hintStyle: AppTheme.inter(fontSize: 16, color: AppColors.ink4, tabular: true),
                  prefixIcon: const Icon(Icons.search, color: AppColors.ink5),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.ink2),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.gold, width: 2),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                ),
                style: AppTheme.inter(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  tabular: true,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.search_rounded, size: 18),
                  label: const Text('Consultar'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ink9,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(children: [
                const Expanded(child: Divider(color: AppColors.ink2)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    'o escanea el QR',
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                  ),
                ),
                const Expanded(child: Divider(color: AppColors.ink2)),
              ]),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: () => context.push('/qr'),
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                  label: const Text('Escanear código QR'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.ink8,
                    side: const BorderSide(color: AppColors.ink3),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
