import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../../core/constants/api_constants.dart';
import '../datasources/auth_api_service.dart';
import '../models/auth_models.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthApiService _api;
  final FlutterSecureStorage _storage;

  AuthRepositoryImpl(this._api, this._storage);

  @override
  Future<AuthResult> login(String email, String password) async {
    final res = await _api.login({'email': email, 'password': password});
    final body = res.data;

    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error de autenticación');
    }

    final tokenData = AuthTokenModel.fromJson(body['data'] as Map<String, dynamic>);
    await _persistTokens(tokenData);

    return AuthResult(
      token: tokenData,
      user: _mapUser(tokenData.user!),
    );
  }

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

    final body = res.data;
    if (body['success'] != true) {
      throw AuthException(body['error'] ?? 'Error al registrarse');
    }
  }

  @override
  Future<AuthResult?> tryAutoLogin() async {
    final accessToken = await _storage.read(key: ApiConstants.accessTokenKey);
    final refreshTokenVal = await _storage.read(key: ApiConstants.refreshTokenKey);
    final userJson = await _storage.read(key: 'sfit_user');

    if (accessToken == null || refreshTokenVal == null || userJson == null) {
      return null;
    }

    // Intentar refresh token para validar sesión
    try {
      final res = await _api.refreshToken({'refreshToken': refreshTokenVal});
      final body = res.data;

      if (body['success'] != true) return null;

      final tokenData = AuthTokenModel.fromJson(body['data'] as Map<String, dynamic>);
      await _persistTokens(tokenData);

      // Reconstruir usuario desde storage (el refresh no devuelve user)
      final storedUser = UserModel.fromJson(
        Map<String, dynamic>.from(
          (await _storage.read(key: 'sfit_user') != null)
              ? {} // fallback
              : {},
        ),
      );

      return null; // Retornar null si no hay datos de usuario
    } catch (_) {
      await logout();
      return null;
    }
  }

  @override
  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {}
    await _storage.deleteAll();
  }

  Future<void> _persistTokens(AuthTokenModel tokenData) async {
    await _storage.write(
        key: ApiConstants.accessTokenKey, value: tokenData.accessToken);
    await _storage.write(
        key: ApiConstants.refreshTokenKey, value: tokenData.refreshToken);
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
