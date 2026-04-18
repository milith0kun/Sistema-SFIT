import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../../data/datasources/auth_api_service.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

part 'auth_provider.g.dart';

// ── Providers de infraestructura ─────────────────────────────────

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

// ── Estado ───────────────────────────────────────────────────────

enum AuthStatus {
  loading,
  authenticated,
  unauthenticated,
  pendingApproval,
  rejected,
}

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
  bool get isLoading       => status == AuthStatus.loading;
}

// ── Notifier ─────────────────────────────────────────────────────

@Riverpod(keepAlive: true)
class Auth extends _$Auth {
  static final _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: '378647499793-b7rgmnj93drlu538daeblde7216o1vp9.apps.googleusercontent.com', // Web Client ID
  );

  @override
  AuthState build() {
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

  // ── RF-01-06 / RF-01-07: Login con correo ─────────────────────
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

  // ── RF-01-01: Login con Google ────────────────────────────────
  Future<bool> loginWithGoogle() async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // El usuario canceló
        state = const AuthState(status: AuthStatus.unauthenticated);
        return false;
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) {
        throw AuthException('No se pudo obtener el token de Google');
      }

      final result =
          await ref.read(authRepositoryProvider).loginWithGoogle(idToken);
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
        errorMessage: 'Error con Google. Intenta nuevamente.',
      );
      return false;
    }
  }

  // ── RF-01-02 / RF-01-03: Registro ────────────────────────────
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
    state = const AuthState(status: AuthStatus.pendingApproval);
  }

  // ── RF-01-10: Logout ──────────────────────────────────────────
  Future<void> logout() async {
    await _googleSignIn.signOut().catchError((_) {});
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}
