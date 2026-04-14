import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../constants/api_constants.dart';

part 'dio_client.g.dart';

@Riverpod(keepAlive: true)
DioClient dioClient(Ref ref) => DioClient();

/// Cliente HTTP configurado para la API de SFIT
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
        },
      ),
    );

    _dio.interceptors.addAll([
      _AuthInterceptor(_storage, _dio),
      LogInterceptor(requestBody: false, responseBody: false),
    ]);
  }

  Dio get dio => _dio;
}

/// Adjunta JWT y gestiona refresh automático (RF-01-08)
class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  final Dio _dio;
  bool _isRefreshing = false;

  _AuthInterceptor(this._storage, this._dio);

  @override
  void onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    // No agregar token a las rutas de auth
    if (options.path.contains('/auth/login') ||
        options.path.contains('/auth/register')) {
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
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshToken =
            await _storage.read(key: ApiConstants.refreshTokenKey);
        if (refreshToken == null) {
          await _storage.deleteAll();
          return handler.next(err);
        }

        final res = await _dio.post(
          ApiConstants.refreshToken,
          data: {'refreshToken': refreshToken},
          options: Options(headers: {'Authorization': null}),
        );

        if (res.data['success'] == true) {
          final newAccess = res.data['data']['accessToken'] as String;
          final newRefresh = res.data['data']['refreshToken'] as String;
          await _storage.write(
              key: ApiConstants.accessTokenKey, value: newAccess);
          await _storage.write(
              key: ApiConstants.refreshTokenKey, value: newRefresh);

          // Reintentar request original
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newAccess';
          final response = await _dio.fetch(opts);
          return handler.resolve(response);
        }
      } catch (_) {
        await _storage.deleteAll();
      } finally {
        _isRefreshing = false;
      }
    }
    handler.next(err);
  }
}
