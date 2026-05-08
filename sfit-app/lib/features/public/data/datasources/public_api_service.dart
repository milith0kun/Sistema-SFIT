import 'package:dio/dio.dart';
import '../../../../core/constants/api_constants.dart';
import '../models/public_vehicle_model.dart';

/// Llama al endpoint público RF-08 (sin autenticación).
class PublicApiService {
  final Dio _dio;

  PublicApiService() : _dio = Dio(BaseOptions(
    baseUrl: ApiConstants.baseUrl,
    connectTimeout: const Duration(milliseconds: ApiConstants.connectTimeout),
    receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
    headers: {
      ApiConstants.clientHeader: ApiConstants.clientToken,
    },
  ));

  Future<PublicVehicleModel> getVehicleByPlate(String plate) async {
    final resp = await _dio.get(
      '/public/vehiculo',
      queryParameters: {'plate': plate.toUpperCase()},
    );
    final data = (resp.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    return PublicVehicleModel.fromJson(data);
  }

  Future<PublicVehicleModel> getVehicleByQr(String qrJson) async {
    final resp = await _dio.get(
      '/public/vehiculo',
      queryParameters: {'qr': qrJson},
    );
    final data = (resp.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    return PublicVehicleModel.fromJson(data);
  }
}
