import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../../core/constants/api_constants.dart';
import '../datasources/auth_api_service.dart';
import '../models/auth_models.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthApiService _api;
  final FlutterSecureStorage _storage;
  /// Dio sin interceptor de auth, para endpoints públicos.
  final Dio? _publicDio;

  AuthRepositoryImpl(this._api, this._storage, {Dio? publicDio})
      : _publicDio = publicDio;

  // ── RF-01-06 / RF-01-07: Login correo ────────────────────────
  @override
  Future<AuthResult> login(String email, String password) async {
    final res = await _api.login({'email': email, 'password': password});
    return _handleAuthResponse(res.data as Map<String, dynamic>);
  }

  // ── RF-01-01: Login Google ────────────────────────────────────
  @override
  Future<AuthResult> loginWithGoogle(String idToken) async {
    final res = await _api.loginWithGoogle({'idToken': idToken});
    return _handleAuthResponse(res.data as Map<String, dynamic>);
  }

  // ── RF-01-02 / RF-01-03: Registro (roles operativos → pendiente) ────────
  @override
  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String requestedRole,
    String? municipalityId,
  }) async {
    final res = await _api.register({
      'name': name,
      'email': email,
      'password': password,
      'requestedRole': requestedRole,
      if (municipalityId != null) 'municipalityId': municipalityId,
    });
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error al registrarse');
    }
  }

  // ── RF-01-03: Registro ciudadano — auto-aprobado, tokens inmediatos ───
  @override
  Future<AuthResult> registerCiudadano({
    required String name,
    required String email,
    required String password,
    String? municipalityId,
  }) async {
    final res = await _api.register({
      'name': name,
      'email': email,
      'password': password,
      'requestedRole': 'ciudadano',
      if (municipalityId != null) 'municipalityId': municipalityId,
    });
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error al registrarse');
    }
    return _handleAuthResponse(body);
  }

  // ── RF-01-08: Auto-login con refresh token ────────────────────
  @override
  Future<AuthResult?> tryAutoLogin() async {
    final storedRefreshToken =
        await _storage.read(key: ApiConstants.refreshTokenKey);
    final userJsonStr = await _storage.read(key: ApiConstants.userJsonKey);

    if (storedRefreshToken == null || userJsonStr == null) return null;

    try {
      final res =
          await _api.refreshToken({'refreshToken': storedRefreshToken});
      final body = res.data as Map<String, dynamic>;
      if (body['success'] != true) return null;

      final data = body['data'] as Map<String, dynamic>;
      final newAccessToken  = data['accessToken']  as String;
      final newRefreshToken = data['refreshToken'] as String;

      await _storage.write(
          key: ApiConstants.accessTokenKey, value: newAccessToken);
      await _storage.write(
          key: ApiConstants.refreshTokenKey, value: newRefreshToken);

      final userJson = jsonDecode(userJsonStr) as Map<String, dynamic>;
      final userModel = UserModel.fromJson(userJson);

      return AuthResult(
        token: AuthTokenModel.fromJson({
          'accessToken':  newAccessToken,
          'refreshToken': newRefreshToken,
          'expiresIn':    (data['expiresIn'] as num?)?.toInt() ?? 900,
          'user':         userJson,
        }),
        user: _mapUser(userModel),
      );
    } catch (_) {
      await logout();
      return null;
    }
  }

  // ── RF-01-10: Logout ──────────────────────────────────────────
  @override
  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {}
    await _storage.deleteAll();
  }

  // ── Helpers ───────────────────────────────────────────────────

  Future<AuthResult> _handleAuthResponse(Map<String, dynamic> body) async {
    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error de autenticación');
    }
    final tokenData =
        AuthTokenModel.fromJson(body['data'] as Map<String, dynamic>);
    await _persistTokens(tokenData);
    return AuthResult(
      token: tokenData,
      user: _mapUser(tokenData.user!),
    );
  }

  Future<void> _persistTokens(AuthTokenModel tokenData) async {
    await _storage.write(
        key: ApiConstants.accessTokenKey, value: tokenData.accessToken);
    await _storage.write(
        key: ApiConstants.refreshTokenKey, value: tokenData.refreshToken);
    if (tokenData.user != null) {
      await _storage.write(
          key: ApiConstants.userJsonKey,
          value: jsonEncode(tokenData.user!.toJson()));
    }
  }

  UserEntity _mapUser(UserModel model) => UserEntity(
        id: model.id,
        name: model.name,
        email: model.email,
        role: model.role,
        status: model.status,
        image: model.image,
        municipalityId: model.municipalityId,
        provinceId: model.provinceId,
        phone: model.phone,
      );

  @override
  Future<void> refreshTokens() async {
    final refreshToken = await _storage.read(key: ApiConstants.refreshTokenKey);
    if (refreshToken == null) {
      throw AuthException('No hay refresh token almacenado');
    }
    final res = await _api.refreshToken({'refreshToken': refreshToken});
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error al refrescar token');
    }
    final data = body['data'] as Map<String, dynamic>;
    await _storage.write(
        key: ApiConstants.accessTokenKey, value: data['accessToken'] as String);
    await _storage.write(
        key: ApiConstants.refreshTokenKey, value: data['refreshToken'] as String);
  }

  // ── Endpoints públicos — datos geográficos ────────────────────

  @override
  Future<List<Map<String, dynamic>>> fetchProvincias() async {
    final dio = _publicDio ?? _buildPublicDio();
    final res = await dio.get('/public/provincias');
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error al obtener provincias');
    }
    return List<Map<String, dynamic>>.from(body['data'] as List);
  }

  @override
  Future<List<Map<String, dynamic>>> fetchMunicipalidades(String provinceId) async {
    final dio = _publicDio ?? _buildPublicDio();
    final res = await dio.get(
      '/public/municipalidades',
      queryParameters: {'provinceId': provinceId},
    );
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error al obtener municipalidades');
    }
    return List<Map<String, dynamic>>.from(body['data'] as List);
  }

  Dio _buildPublicDio() => Dio(
        BaseOptions(
          baseUrl: ApiConstants.baseUrl,
          connectTimeout: const Duration(milliseconds: ApiConstants.connectTimeout),
          receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          validateStatus: (s) => s != null && s < 500,
        ),
      );
}

class AuthException implements Exception {
  final String message;
  AuthException(this.message);

  @override
  String toString() => message;
}

class AuthResult {
  final AuthTokenModel token;
  final UserEntity user;
  AuthResult({required this.token, required this.user});
}
