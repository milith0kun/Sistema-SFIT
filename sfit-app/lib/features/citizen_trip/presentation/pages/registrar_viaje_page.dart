/// RF — Registro auto-servicio del ciudadano a un viaje interprovincial.
///
/// Dos caminos de entrada:
///   1. Desde el QrScannerPage con `forCitizenTrip:true` → ya viene `qrRaw`.
///      Se llama al backend automáticamente al cargar la página.
///   2. Sin `qrRaw` (acceso directo desde menú) → muestra un formulario
///      para ingresar la placa manualmente.
///
/// Tras el registro exitoso navega a `/ciudadano/mi-viaje` (replace para
/// que el botón atrás vuelva al feed, no a este formulario).
library;

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

class RegistrarViajePage extends ConsumerStatefulWidget {
  /// JSON crudo del QR escaneado (puede venir como `Map` ya parseado o
  /// `String` JSON). Si es null, la página muestra el formulario de placa.
  final dynamic qrRaw;

  /// Si `true`, ya verificamos offline la firma HMAC del QR en el scanner.
  /// El backend reverificará igualmente, pero esta info acelera la UI.
  final bool offlineVerified;

  const RegistrarViajePage({
    super.key,
    this.qrRaw,
    this.offlineVerified = false,
  });

  @override
  ConsumerState<RegistrarViajePage> createState() =>
      _RegistrarViajePageState();
}

class _RegistrarViajePageState extends ConsumerState<RegistrarViajePage> {
  bool _submitting = false;
  String? _error;
  final _plateCtl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    // Si el ciudadano llegó por QR, dispara el POST en cuanto se monte.
    if (widget.qrRaw != null) {
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _submitFromQr(widget.qrRaw));
    }
  }

  @override
  void dispose() {
    _plateCtl.dispose();
    super.dispose();
  }

  Future<void> _submitFromQr(dynamic raw) async {
    Map<String, dynamic>? qrPayload;
    try {
      if (raw is String) {
        qrPayload = jsonDecode(raw) as Map<String, dynamic>;
      } else if (raw is Map<String, dynamic>) {
        qrPayload = raw;
      }
    } catch (_) {
      qrPayload = null;
    }
    if (qrPayload == null) {
      setState(() => _error = 'El QR escaneado no se pudo interpretar.');
      return;
    }
    await _submit(qrPayload: qrPayload);
  }

  Future<void> _submitFromPlate() async {
    if (!_formKey.currentState!.validate()) return;
    await _submit(plate: _plateCtl.text.trim().toUpperCase());
  }

  Future<void> _submit({Map<String, dynamic>? qrPayload, String? plate}) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final res = await dio.post(
        ApiConstants.ciudadanoViajesRegistrar,
        data: {
          if (qrPayload != null) 'qrPayload': qrPayload,
          if (plate != null && plate.isNotEmpty) 'plate': plate,
        },
      );
      final data = (res.data as Map<String, dynamic>)['data'];
      final tripId = data?['tripId'] as String?;
      if (!mounted) return;
      if (tripId == null) {
        setState(() {
          _error =
              'El servidor no devolvió un identificador de viaje. Reintenta.';
          _submitting = false;
        });
        return;
      }
      // Reemplazamos la pila para que "atrás" no vuelva al scanner ni a este
      // formulario — el ciudadano debe quedar en la pantalla de "mi viaje".
      context.pushReplacement('/ciudadano/mi-viaje');
    } on DioException catch (e) {
      final body = e.response?.data;
      String msg = 'No se pudo registrar el viaje. Verifica tu conexión.';
      if (body is Map<String, dynamic>) {
        final err = body['error'];
        if (err is String && err.isNotEmpty) msg = err;
      }
      if (!mounted) return;
      setState(() {
        _error = msg;
        _submitting = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Error inesperado al registrar el viaje.';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasQr = widget.qrRaw != null;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          hasQr ? 'Registrando viaje' : 'Registrar mi viaje',
          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: hasQr ? _buildQrFlow() : _buildPlateForm(),
        ),
      ),
    );
  }

  Widget _buildQrFlow() {
    if (_submitting) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 20),
            Text(
              'Asociando tu viaje al bus…',
              style: AppTheme.inter(fontSize: 14, color: AppColors.ink6),
            ),
          ],
        ),
      );
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: AppColors.noApto),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: () => context.pop(),
              child: const Text('Volver'),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildPlateForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Registrar viaje interprovincial',
            style: AppTheme.inter(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.ink9,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Escanea el QR del bus o ingresa su placa para asociar tu viaje. '
            'No verás la ubicación del bus en el mapa (privacidad), pero sí '
            'su velocidad y datos de la empresa.',
            style: AppTheme.inter(
              fontSize: 13,
              color: AppColors.ink6,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _plateCtl,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              labelText: 'Placa del bus',
              hintText: 'Ej. ABC-123',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            validator: (v) {
              final s = (v ?? '').trim();
              if (s.length < 5) return 'Ingresa una placa válida';
              return null;
            },
          ),
          const SizedBox(height: 14),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.noAptoBg,
                  border: Border.all(color: AppColors.noAptoBorder),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.error_outline_rounded,
                      color: AppColors.noApto,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: AppTheme.inter(
                          fontSize: 12.5,
                          color: AppColors.noApto,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ElevatedButton.icon(
            onPressed: _submitting ? null : _submitFromPlate,
            icon: _submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle_outline_rounded),
            label: Text(
              _submitting ? 'Registrando…' : 'Registrar viaje',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _submitting
                ? null
                : () => context.push('/qr', extra: {'forCitizenTrip': true}),
            icon: const Icon(Icons.qr_code_scanner_rounded),
            label: const Text('Escanear QR del bus'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ],
      ),
    );
  }
}
