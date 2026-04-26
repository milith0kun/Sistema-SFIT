import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../constants/api_constants.dart';

part 'dio_client.g.dart';

@Riverpod(keepAlive: true)
DioClient dioClient(Ref ref) => DioClient();

/// Cliente HTTP configurado para la API de SFIT.
/// Instala AuthInterceptor (inyecta Bearer + refresca al 401) y LogInterceptor en debug.
class DioClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  DioClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(milliseconds: ApiConstants.connectTimeout),
        receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ApiConstants.clientHeader: ApiConstants.clientToken,
        },
        // Aceptar 2xx y 4xx sin tirar excepción — nuestro backend devuelve
        // errores con { success:false, error } en 400/401/403/409/422.
        // Así el repositorio lee `body.error` y muestra mensaje real al usuario.
        // 5xx siguen tirando DioException (fallo real del servidor).
        validateStatus: (status) => status != null && status < 500,
      ),
    );

    _dio.interceptors.add(_AuthInterceptor(_storage, _dio));
    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(
          request: true,
          requestBody: true,
          responseBody: true,
          error: true,
          logPrint: (o) => debugPrint('[dio] $o'),
        ),
      );
    }
  }

  Dio get dio => _dio;
}

/// Interceptor de autenticación — RF-01-08.
/// 1. Adjunta `Authorization: Bearer <access>` a peticiones no-auth.
/// 2. Al 401, intenta refresh con el refresh token almacenado. Si falla, limpia storage.
class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  final Dio _dio;
  bool _isRefreshing = false;

  _AuthInterceptor(this._storage, this._dio);

  bool _isAuthEndpoint(String path) =>
      path.contains('/auth/login') ||
      path.contains('/auth/register') ||
      path.contains('/auth/google') ||
      path.contains('/auth/refresh');

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (_isAuthEndpoint(options.path)) {
      return handler.next(options);
    }

    final token = await _storage.read(key: ApiConstants.accessTokenKey);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Solo intentar refresh si no estamos ya refrescando y es 401 en endpoint autenticado
    if (err.response?.statusCode == 401 &&
        !_isRefreshing &&
        !_isAuthEndpoint(err.requestOptions.path)) {
      _isRefreshing = true;
      try {
        final refreshToken = await _storage.read(key: ApiConstants.refreshTokenKey);
        if (refreshToken == null) {
          await _clearAuth();
          return handler.next(err);
        }

        final refreshDio = Dio(BaseOptions(
          baseUrl: _dio.options.baseUrl,
          connectTimeout: _dio.options.connectTimeout,
          receiveTimeout: _dio.options.receiveTimeout,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ApiConstants.clientHeader: ApiConstants.clientToken,
          },
        ));
        final res = await refreshDio.post(
          ApiConstants.refreshToken,
          data: {'refreshToken': refreshToken},
        );

        final data = res.data;
        if (data is Map && data['success'] == true) {
          final body = data['data'] as Map<String, dynamic>;
          final newAccess  = body['accessToken'] as String;
          final newRefresh = body['refreshToken'] as String;
          await _storage.write(key: ApiConstants.accessTokenKey,  value: newAccess);
          await _storage.write(key: ApiConstants.refreshTokenKey, value: newRefresh);

          // Reintentar request original con el nuevo token
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newAccess';
          final response = await _dio.fetch(opts);
          return handler.resolve(response);
        }
        await _clearAuth();
      } catch (_) {
        await _clearAuth();
      } finally {
        _isRefreshing = false;
      }
    }
    handler.next(err);
  }

  Future<void> _clearAuth() async {
    await _storage.delete(key: ApiConstants.accessTokenKey);
    await _storage.delete(key: ApiConstants.refreshTokenKey);
    await _storage.delete(key: ApiConstants.userJsonKey);
  }
}
