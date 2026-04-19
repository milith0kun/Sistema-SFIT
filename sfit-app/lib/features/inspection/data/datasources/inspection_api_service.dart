import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../models/inspection_model.dart';

part 'inspection_api_service.g.dart';

@riverpod
InspectionApiService inspectionApiService(Ref ref) =>
    InspectionApiService(ref.watch(dioClientProvider).dio);

class InspectionApiService {
  final Dio _dio;
  InspectionApiService(this._dio);

  Future<List<InspectionModel>> getInspections({
    String? vehicleId,
    String? result,
    int limit = 50,
  }) async {
    final resp = await _dio.get('/inspecciones', queryParameters: {
      'limit': limit,
      if (vehicleId != null) 'vehicleId': vehicleId,
      if (result != null) 'result': result,
    });
    final data = (resp.data as Map)['data'] as Map;
    final items = data['items'] as List;
    return items
        .map((e) => InspectionModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<String> createInspection({
    required String vehicleId,
    String? driverId,
    required String vehicleTypeKey,
    required List<ChecklistItem> checklistResults,
    required int score,
    required String result,
    String? observations,
  }) async {
    final resp = await _dio.post('/inspecciones', data: {
      'vehicleId': vehicleId,
      if (driverId != null) 'driverId': driverId,
      'vehicleTypeKey': vehicleTypeKey,
      'checklistResults': checklistResults.map((e) => e.toJson()).toList(),
      'score': score,
      'result': result,
      if (observations != null && observations.isNotEmpty) 'observations': observations,
    });
    final data = (resp.data as Map)['data'] as Map;
    return data['id'] as String;
  }

  Future<InspectionModel> getInspectionById(String id) async {
    final resp = await _dio.get('/inspecciones/$id');
    final data = (resp.data as Map)['data'] as Map<String, dynamic>;
    return InspectionModel.fromJson(data);
  }

  Future<void> createAppeal({
    required String inspectionId,
    required String reason,
  }) async {
    await _dio.post('/apelaciones', data: {
      'inspectionId': inspectionId,
      'reason': reason,
    });
  }
}
