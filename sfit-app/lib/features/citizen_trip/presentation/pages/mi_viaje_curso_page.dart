/// RF — Vista "Mi viaje en curso" para el ciudadano.
///
/// Polling cada 10s a `GET /api/ciudadano/viajes/en-curso`. Muestra:
///   - Datos del bus (placa, marca, modelo, foto).
///   - Empresa (razón social, RUC).
///   - Conductor si lo hay asignado.
///   - Velocidad instantánea en km/h.
///   - Tiempo desde la última actualización GPS.
///   - Botón "Finalizar viaje" → cierra el registro del ciudadano.
///
/// IMPORTANTE: NUNCA se muestran lat/lng ni mapa por privacidad.
library;

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

class MiViajeCursoPage extends ConsumerStatefulWidget {
  const MiViajeCursoPage({super.key});

  @override
  ConsumerState<MiViajeCursoPage> createState() => _MiViajeCursoPageState();
}

class _MiViajeCursoPageState extends ConsumerState<MiViajeCursoPage> {
  Timer? _poll;
  bool _loading = true;
  String? _error;
  List<_TripView> _trips = const [];
  bool _ending = false;

  @override
  void initState() {
    super.initState();
    _fetch();
    _poll = Timer.periodic(const Duration(seconds: 10), (_) => _fetch());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    try {
      final dio = ref.read(dioClientProvider).dio;
      final res = await dio.get(ApiConstants.ciudadanoViajesEnCurso);
      final data = (res.data as Map<String, dynamic>)['data'];
      final items = (data?['items'] as List?) ?? const [];
      if (!mounted) return;
      setState(() {
        _trips = items
            .whereType<Map<String, dynamic>>()
            .map(_TripView.fromJson)
            .toList();
        _loading = false;
        _error = null;
      });
    } on DioException catch (e) {
      final body = e.response?.data;
      String msg = 'Error de conexión.';
      if (body is Map<String, dynamic>) {
        final err = body['error'];
        if (err is String && err.isNotEmpty) msg = err;
      }
      if (!mounted) return;
      setState(() {
        _error = msg;
        _loading = false;
      });
    }
  }

  Future<void> _finalizar(_TripView t) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('¿Finalizar viaje?'),
        content: Text(
          'Vas a cerrar tu registro en el bus ${t.plate}. '
          'Si otros pasajeros siguen en el bus, ellos pueden continuar.',
          style: AppTheme.inter(fontSize: 13.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Finalizar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _ending = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.post(
        ApiConstants.ciudadanoViajeFinalizar(t.registrationId),
      );
      if (!mounted) return;
      // Volvemos a hacer fetch para limpiar la lista. Si quedó vacía, la UI
      // muestra el empty state.
      await _fetch();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Viaje finalizado')),
      );
    } on DioException catch (e) {
      final msg = (e.response?.data is Map &&
              (e.response?.data as Map)['error'] is String)
          ? (e.response?.data as Map)['error'] as String
          : 'No se pudo finalizar el viaje. Reintenta.';
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _ending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Mi viaje en curso',
          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _fetch,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Actualizar',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetch,
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _trips.isEmpty) {
      return _ErrorState(message: _error!, onRetry: _fetch);
    }
    if (_trips.isEmpty) {
      return _EmptyState(
        onRegister: () => context.push('/ciudadano/registrar-viaje'),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: _trips.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _TripCard(
        trip: _trips[i],
        ending: _ending,
        onEnd: () => _finalizar(_trips[i]),
      ),
    );
  }
}

class _TripView {
  final String registrationId;
  final String plate;
  final String? brand;
  final String? model;
  final String? photoUrl;
  final String? razonSocial;
  final String? ruc;
  final String? driverName;
  final double? speedMs;
  final DateTime? lastLocationUpdate;
  final DateTime? departureTime;
  final String registeredVia;

  _TripView({
    required this.registrationId,
    required this.plate,
    this.brand,
    this.model,
    this.photoUrl,
    this.razonSocial,
    this.ruc,
    this.driverName,
    this.speedMs,
    this.lastLocationUpdate,
    this.departureTime,
    required this.registeredVia,
  });

  factory _TripView.fromJson(Map<String, dynamic> j) {
    final vehicle = j['vehicle'] as Map<String, dynamic>?;
    final company = j['company'] as Map<String, dynamic>?;
    final driver = j['driver'] as Map<String, dynamic>?;
    return _TripView(
      registrationId: j['registrationId'] as String? ?? '',
      plate: vehicle?['plate'] as String? ?? '—',
      brand: vehicle?['brand'] as String?,
      model: vehicle?['model'] as String?,
      photoUrl: vehicle?['photoUrl'] as String?,
      razonSocial: company?['razonSocial'] as String?,
      ruc: company?['ruc'] as String?,
      driverName: driver?['name'] as String?,
      speedMs: (j['speedMs'] as num?)?.toDouble(),
      lastLocationUpdate: j['lastLocationUpdate'] != null
          ? DateTime.tryParse(j['lastLocationUpdate'] as String)
          : null,
      departureTime: j['departureTime'] != null
          ? DateTime.tryParse(j['departureTime'] as String)
          : null,
      registeredVia: j['registeredVia'] as String? ?? 'plate',
    );
  }

  int? get speedKmh =>
      speedMs == null ? null : (speedMs! * 3.6).round();
}

class _TripCard extends StatelessWidget {
  final _TripView trip;
  final bool ending;
  final VoidCallback onEnd;
  const _TripCard({
    required this.trip,
    required this.ending,
    required this.onEnd,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primaryBg,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.primaryBorder),
                ),
                child: Text(
                  'INTERPROVINCIAL',
                  style: AppTheme.inter(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
              const Spacer(),
              Icon(
                trip.registeredVia == 'qr'
                    ? Icons.qr_code_2_rounded
                    : Icons.text_fields_rounded,
                size: 14,
                color: AppColors.ink5,
              ),
              const SizedBox(width: 4),
              Text(
                trip.registeredVia == 'qr' ? 'Por QR' : 'Por placa',
                style: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              if (trip.photoUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    trip.photoUrl!,
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _busPlaceholder(),
                  ),
                )
              else
                _busPlaceholder(),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      trip.plate,
                      style: AppTheme.inter(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                        color: AppColors.ink9,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [trip.brand, trip.model].whereType<String>().join(' '),
                      style: AppTheme.inter(
                        fontSize: 13,
                        color: AppColors.ink6,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _KV(label: 'Empresa', value: trip.razonSocial ?? '—'),
          if (trip.ruc != null) _KV(label: 'RUC', value: trip.ruc!),
          _KV(
            label: 'Conductor',
            value: trip.driverName ?? 'Aún no asignado',
          ),
          const SizedBox(height: 12),
          _SpeedBadge(speedKmh: trip.speedKmh, updatedAt: trip.lastLocationUpdate),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.ink1,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.privacy_tip_outlined,
                    size: 14, color: AppColors.ink6),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Por privacidad de las rutas largas, no mostramos la '
                    'ubicación exacta del bus en el mapa.',
                    style: AppTheme.inter(
                      fontSize: 11.5,
                      color: AppColors.ink6,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: ending ? null : onEnd,
            icon: const Icon(Icons.stop_circle_outlined),
            label: Text(ending ? 'Finalizando…' : 'Finalizar viaje'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44),
              foregroundColor: AppColors.noApto,
              side: BorderSide(color: AppColors.noAptoBorder),
            ),
          ),
        ],
      ),
    );
  }

  Widget _busPlaceholder() {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(Icons.directions_bus_filled_rounded,
          color: AppColors.ink5, size: 32),
    );
  }
}

class _KV extends StatelessWidget {
  final String label;
  final String value;
  const _KV({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label.toUpperCase(),
              style: AppTheme.inter(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                color: AppColors.ink5,
                letterSpacing: 0.5,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.ink9,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpeedBadge extends StatelessWidget {
  final int? speedKmh;
  final DateTime? updatedAt;
  const _SpeedBadge({this.speedKmh, this.updatedAt});

  @override
  Widget build(BuildContext context) {
    final hasSpeed = speedKmh != null;
    final ago = updatedAt == null
        ? null
        : DateTime.now().difference(updatedAt!);
    final stale = ago != null && ago.inSeconds > 90;
    final color = !hasSpeed
        ? AppColors.ink5
        : stale
            ? AppColors.riesgo
            : AppColors.apto;
    final bg = !hasSpeed
        ? AppColors.ink1
        : stale
            ? AppColors.riesgoBg
            : AppColors.aptoBg;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.speed_rounded, color: color, size: 22),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Velocidad actual',
                style: AppTheme.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  color: color,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                hasSpeed ? '$speedKmh km/h' : 'Sin datos',
                style: AppTheme.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
            ],
          ),
          const Spacer(),
          if (ago != null)
            Text(
              _formatAgo(ago),
              style: AppTheme.inter(
                fontSize: 11,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }

  String _formatAgo(Duration d) {
    if (d.inSeconds < 60) return 'hace ${d.inSeconds}s';
    if (d.inMinutes < 60) return 'hace ${d.inMinutes} min';
    return 'hace ${d.inHours}h';
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onRegister;
  const _EmptyState({required this.onRegister});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 80),
        Center(
          child: Icon(
            Icons.directions_bus_outlined,
            size: 64,
            color: AppColors.ink4,
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(
            'No tienes viajes en curso',
            style: AppTheme.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.ink9,
            ),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              'Si subiste a un bus interprovincial, escanea su QR o ingresa '
              'la placa para registrar el viaje.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 12.5,
                color: AppColors.ink6,
                height: 1.4,
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: ElevatedButton.icon(
            onPressed: onRegister,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Registrar viaje'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 80),
        Icon(Icons.cloud_off_rounded, size: 56, color: AppColors.ink5),
        const SizedBox(height: 14),
        Center(
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.ink9,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: OutlinedButton(
            onPressed: onRetry,
            child: const Text('Reintentar'),
          ),
        ),
      ],
    );
  }
}
