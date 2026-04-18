import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import '../../../../core/constants/api_constants.dart';

part 'auth_api_service.g.dart';

/// Wrapper genérico para respuestas del backend { success, data, error }
typedef JsonMap = Map<String, dynamic>;

@RestApi()
abstract class AuthApiService {
  factory AuthApiService(Dio dio, {String? baseUrl}) = _AuthApiService;

  @POST(ApiConstants.login)
  Future<HttpResponse<dynamic>> login(@Body() JsonMap body);

  @POST('/auth/google')
  Future<HttpResponse<dynamic>> loginWithGoogle(@Body() JsonMap body);

  @POST(ApiConstants.register)
  Future<HttpResponse<dynamic>> register(@Body() JsonMap body);

  @POST(ApiConstants.refreshToken)
  Future<HttpResponse<dynamic>> refreshToken(@Body() JsonMap body);

  @POST('/auth/logout')
  Future<HttpResponse<dynamic>> logout();
}
