import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../models/conductor_model.dart';
import '../models/vehicle_model.dart';

part 'operator_api_service.g.dart';

@riverpod
OperatorApiService operatorApiService(Ref ref) =>
    OperatorApiService(ref.watch(dioClientProvider).dio);

class OperatorApiService {
  final Dio _dio;
  OperatorApiService(this._dio);

  Future<List<ConductorModel>> getConductores({int limit = 50}) async {
    final resp = await _dio.get('/conductores', queryParameters: {'limit': limit});
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => ConductorModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<VehicleModel>> getVehiculos({int limit = 50}) async {
    final resp = await _dio.get('/vehiculos', queryParameters: {'limit': limit});
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => VehicleModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
