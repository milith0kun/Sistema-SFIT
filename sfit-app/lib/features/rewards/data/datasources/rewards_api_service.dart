import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../models/reward_model.dart';

part 'rewards_api_service.g.dart';

@riverpod
RewardsApiService rewardsApiService(Ref ref) =>
    RewardsApiService(ref.watch(dioClientProvider).dio);

class RewardsApiService {
  final Dio _dio;
  RewardsApiService(this._dio);

  /// GET /ciudadano/coins — Balance, nivel y últimas 20 transacciones.
  /// Si el backend responde sin campo `data` (perfil incompleto, error
  /// silencioso), devolvemos un `CoinsStatus` vacío en vez de propagar un
  /// cast nulo que reventaría el dashboard.
  Future<CoinsStatus> getCoinsStatus() async {
    final resp = await _dio.get('/ciudadano/coins');
    final body = resp.data;
    final raw = (body is Map && body['data'] is Map) ? body['data'] as Map : const {};
    return CoinsStatus.fromJson(Map<String, dynamic>.from(raw));
  }

  /// GET /ciudadano/recompensas — Catálogo de recompensas activas.
  Future<List<RewardItem>> getRewards() async {
    final resp = await _dio.get('/ciudadano/recompensas');
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => RewardItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /ciudadano/recompensas — Canjea una recompensa por su ID.
  Future<Map<String, dynamic>> redeemReward(String recompensaId) async {
    final resp = await _dio.post(
      '/ciudadano/recompensas',
      data: {'recompensaId': recompensaId},
    );
    return (resp.data as Map)['data'] as Map<String, dynamic>;
  }

  /// GET /ciudadano/recompensas/historial — historial de canjes con detalle
  /// de la recompensa (nombre, categoría, imagen) y monto descontado.
  Future<List<RedemptionHistoryItem>> getRedemptionHistory({int limit = 30}) async {
    final resp = await _dio.get(
      '/ciudadano/recompensas/historial',
      queryParameters: {'limit': limit},
    );
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => RedemptionHistoryItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

/// Entrada del historial de canjes: nombre/categoría/imagen de la recompensa,
/// monto canjeado y balance resultante.
class RedemptionHistoryItem {
  final String id;
  final String name;
  final String? category;
  final String? imageUrl;
  final int amount;
  final int balanceAfter;
  final DateTime createdAt;

  const RedemptionHistoryItem({
    required this.id,
    required this.name,
    this.category,
    this.imageUrl,
    required this.amount,
    required this.balanceAfter,
    required this.createdAt,
  });

  factory RedemptionHistoryItem.fromJson(Map<String, dynamic> j) =>
      RedemptionHistoryItem(
        id: j['id'] as String,
        name: (j['name'] as String?) ?? 'Recompensa',
        category: j['category'] as String?,
        imageUrl: j['imageUrl'] as String?,
        amount: (j['amount'] as num?)?.toInt() ?? 0,
        balanceAfter: (j['balanceAfter'] as num?)?.toInt() ?? 0,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}
