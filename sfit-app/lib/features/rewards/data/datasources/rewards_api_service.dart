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
  Future<CoinsStatus> getCoinsStatus() async {
    final resp = await _dio.get('/ciudadano/coins');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return CoinsStatus.fromJson(data);
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
}
