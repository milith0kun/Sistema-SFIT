import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

/// Cliente del API de sanciones para el conductor — sólo expone los endpoints
/// que necesita el rol CONDUCTOR. Operador/fiscal usan otros datasources.
class SanctionsApiService {
  final Dio _dio;
  SanctionsApiService(this._dio);

  /// GET /api/sanciones — lista las sanciones del conductor autenticado.
  /// El backend resuelve el Driver por userId/DNI y filtra automáticamente.
  Future<SanctionsListResponse> getMySanctions({int limit = 30}) async {
    final resp = await _dio.get('/sanciones', queryParameters: {'limit': limit});
    final body = resp.data as Map;
    final data = body['data'] as Map<String, dynamic>;
    final items = (data['items'] as List? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(SanctionItem.fromJson)
        .toList();
    final stats = data['stats'] as Map<String, dynamic>? ?? const {};
    return SanctionsListResponse(
      items: items,
      stats: SanctionsStats.fromJson(stats),
    );
  }

  /// POST /api/sanciones/[id]/apelar — el conductor apela una sanción suya.
  Future<void> appealSanction(
    String sanctionId, {
    required String reason,
    List<String>? evidence,
  }) async {
    await _dio.post('/sanciones/$sanctionId/apelar', data: {
      'reason': reason,
      if (evidence != null && evidence.isNotEmpty) 'evidence': evidence,
    });
  }
}

final sanctionsApiServiceProvider = Provider<SanctionsApiService>((ref) {
  return SanctionsApiService(ref.watch(dioClientProvider).dio);
});

class SanctionsListResponse {
  final List<SanctionItem> items;
  final SanctionsStats stats;
  const SanctionsListResponse({required this.items, required this.stats});
}

class SanctionsStats {
  final int emitida;
  final int notificada;
  final int apelada;
  final int confirmada;
  final int anulada;
  final num montoConfirmado;

  const SanctionsStats({
    this.emitida = 0,
    this.notificada = 0,
    this.apelada = 0,
    this.confirmada = 0,
    this.anulada = 0,
    this.montoConfirmado = 0,
  });

  factory SanctionsStats.fromJson(Map<String, dynamic> j) => SanctionsStats(
        emitida: (j['emitida'] as num?)?.toInt() ?? 0,
        notificada: (j['notificada'] as num?)?.toInt() ?? 0,
        apelada: (j['apelada'] as num?)?.toInt() ?? 0,
        confirmada: (j['confirmada'] as num?)?.toInt() ?? 0,
        anulada: (j['anulada'] as num?)?.toInt() ?? 0,
        montoConfirmado: (j['montoConfirmado'] as num?) ?? 0,
      );

  int get pendientes => emitida + notificada;
}

class SanctionItem {
  final String id;
  final String? plate;
  final String faultType;
  final num amountSoles;
  final String amountUIT;
  final String status;
  final String? appealNotes;
  final DateTime? resolvedAt;
  final DateTime createdAt;

  const SanctionItem({
    required this.id,
    this.plate,
    required this.faultType,
    required this.amountSoles,
    required this.amountUIT,
    required this.status,
    this.appealNotes,
    this.resolvedAt,
    required this.createdAt,
  });

  factory SanctionItem.fromJson(Map<String, dynamic> j) {
    final vehicle = j['vehicle'] as Map<String, dynamic>?;
    return SanctionItem(
      id: j['id'] as String,
      plate: vehicle?['plate'] as String?,
      faultType: (j['faultType'] as String?) ?? '—',
      amountSoles: (j['amountSoles'] as num?) ?? 0,
      amountUIT: (j['amountUIT'] as String?) ?? '',
      status: (j['status'] as String?) ?? 'emitida',
      appealNotes: j['appealNotes'] as String?,
      resolvedAt: j['resolvedAt'] != null ? DateTime.tryParse(j['resolvedAt'] as String) : null,
      createdAt: DateTime.parse(j['createdAt'] as String),
    );
  }

  bool get canAppeal => status == 'emitida' || status == 'notificada';
}
