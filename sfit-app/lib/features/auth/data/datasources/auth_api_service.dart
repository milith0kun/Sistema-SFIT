import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import '../../../../core/constants/api_constants.dart';
import '../models/auth_models.dart';

part 'auth_api_service.g.dart';

@RestApi()
abstract class AuthApiService {
  factory AuthApiService(Dio dio, {String? baseUrl}) = _AuthApiService;

  /// RF-01-06 / RF-01-07: Login con correo y contraseña
  @POST(ApiConstants.login)
  Future<HttpResponse<Map<String, dynamic>>> login(
    @Body() Map<String, dynamic> body,
  );

  /// RF-01-02: Registro con correo
  @POST(ApiConstants.register)
  Future<HttpResponse<Map<String, dynamic>>> register(
    @Body() Map<String, dynamic> body,
  );

  /// RF-01-08: Refresh token
  @POST(ApiConstants.refreshToken)
  Future<HttpResponse<Map<String, dynamic>>> refreshToken(
    @Body() Map<String, dynamic> body,
  );

  /// RF-01-10: Logout
  @POST('/auth/logout')
  Future<HttpResponse<Map<String, dynamic>>> logout();
}
