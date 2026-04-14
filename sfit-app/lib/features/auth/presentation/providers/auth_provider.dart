import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../../data/datasources/auth_api_service.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

part 'auth_provider.g.dart';

// ── Providers de infraestructura ──

@Riverpod(keepAlive: true)
FlutterSecureStorage secureStorage(Ref ref) =>
    const FlutterSecureStorage();

@Riverpod(keepAlive: true)
AuthApiService authApiService(Ref ref) =>
    AuthApiService(ref.watch(dioClientProvider).dio);

@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) => AuthRepositoryImpl(
      ref.watch(authApiServiceProvider),
      ref.watch(secureStorageProvider),
    );

// ── Estado de autenticación ──

enum AuthStatus { loading, authenticated, unauthenticated, pendingApproval }

class AuthState {
  final AuthStatus status;
  final UserEntity? user;
  final String? errorMessage;

  const AuthState({
    required this.status,
    this.user,
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    UserEntity? user,
    String? errorMessage,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        errorMessage: errorMessage,
      );

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isLoading => status == AuthStatus.loading;
}

// ── Notifier ──

@Riverpod(keepAlive: true)
class Auth extends _$Auth {
  @override
  AuthState build() {
    // Intentar auto-login al iniciar
    Future.microtask(() => _tryAutoLogin());
    return const AuthState(status: AuthStatus.loading);
  }

  Future<void> _tryAutoLogin() async {
    try {
      final result = await ref.read(authRepositoryProvider).tryAutoLogin();
      if (result != null) {
        state = AuthState(status: AuthStatus.authenticated, user: result.user);
      } else {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final result =
          await ref.read(authRepositoryProvider).login(email, password);
      state = AuthState(status: AuthStatus.authenticated, user: result.user);
      return true;
    } on AuthException catch (e) {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: e.message,
      );
      return false;
    } catch (_) {
      state = const AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: 'Error de conexión. Intenta nuevamente.',
      );
      return false;
    }
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String requestedRole,
    String? municipalityId,
  }) async {
    await ref.read(authRepositoryProvider).register(
          name: name,
          email: email,
          password: password,
          requestedRole: requestedRole,
          municipalityId: municipalityId,
        );
    // Queda en pendiente — no autentica
    state = const AuthState(status: AuthStatus.pendingApproval);
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}
