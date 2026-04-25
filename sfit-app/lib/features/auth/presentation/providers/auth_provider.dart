import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/services/fcm_service.dart';
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
    serverClientId: '378647499793-tbks1mfqq15thpmii1dbirm3o21fkhd3.apps.googleusercontent.com', // Web Client ID
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
        state = AuthState(status: _statusFor(result.user), user: result.user);
        // RF-18 — Registrar token FCM si la sesión se restaura automáticamente
        if (_statusFor(result.user) == AuthStatus.authenticated) {
          FcmService.initialize(ref);
        }
      } else {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// Mapea user.status → AuthStatus (RF-01-03, RF-01-04)
  AuthStatus _statusFor(UserEntity user) {
    switch (user.status) {
      case 'activo':     return AuthStatus.authenticated;
      case 'pendiente':  return AuthStatus.pendingApproval;
      case 'rechazado':  return AuthStatus.rejected;
      default:           return AuthStatus.unauthenticated;
    }
  }

  // ── RF-01-06 / RF-01-07: Login con correo ─────────────────────
  Future<bool> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final result =
          await ref.read(authRepositoryProvider).login(email, password);
      state = AuthState(status: _statusFor(result.user), user: result.user);
      // RF-18 — Inicializar FCM tras login exitoso (no-bloqueante)
      if (_statusFor(result.user) == AuthStatus.authenticated) {
        FcmService.initialize(ref);
      }
      return true;
    } on AuthException catch (e) {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: e.message,
      );
      return false;
    } catch (e, st) {
      // ignore: avoid_print
      print('[Auth.login] unexpected error: $e\n$st');
      final msg = _networkErrorMsg(e);
      state = AuthState(status: AuthStatus.unauthenticated, errorMessage: msg);
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
      state = AuthState(status: _statusFor(result.user), user: result.user);
      // RF-18 — Inicializar FCM tras login con Google exitoso (no-bloqueante)
      if (_statusFor(result.user) == AuthStatus.authenticated) {
        FcmService.initialize(ref);
      }
      return true;
    } on AuthException catch (e) {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: e.message,
      );
      return false;
    } catch (e) {
      // ignore: avoid_print
      print('[Auth.loginWithGoogle] error: $e');
      final msg = _networkErrorMsg(e);
      state = AuthState(status: AuthStatus.unauthenticated, errorMessage: msg);
      return false;
    }
  }

  // ── RF-01-02 / RF-01-03: Registro (roles operativos → pendiente) ─────
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

  // ── RF-01-03: Registro ciudadano — auto-aprobado ──────────────
  /// Retorna `true` si el registro fue exitoso y el usuario quedó autenticado.
  Future<bool> registerCiudadano({
    required String name,
    required String email,
    required String password,
    String? municipalityId,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final result = await ref.read(authRepositoryProvider).registerCiudadano(
            name: name,
            email: email,
            password: password,
            municipalityId: municipalityId,
          );
      state = AuthState(status: _statusFor(result.user), user: result.user);
      // RF-18 — Inicializar FCM si ciudadano quedó autenticado inmediatamente
      if (_statusFor(result.user) == AuthStatus.authenticated) {
        FcmService.initialize(ref);
      }
      return true;
    } on AuthException catch (e) {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: e.message,
      );
      return false;
    } catch (e) {
      // ignore: avoid_print
      print('[Auth.registerCiudadano] error: $e');
      final msg = _networkErrorMsg(e);
      state = AuthState(status: AuthStatus.unauthenticated, errorMessage: msg);
      return false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  String _networkErrorMsg(Object e) {
    final s = e.toString();
    if (s.contains('Connection refused') || s.contains('SocketException')) {
      return 'Sin conexión al servidor.\n'
          'Asegúrate de que el backend esté corriendo y ejecuta:\n'
          'adb reverse tcp:3000 tcp:3000';
    }
    if (s.contains('sign_in_failed') || s.contains('ApiException')) {
      return 'Google Sign In falló ($s).\n'
          'Verifica que el SHA-1 del keystore debug esté registrado en GCP.';
    }
    return 'Error: $s';
  }

  // ── Actualizar perfil propio ──────────────────────────────────
  /// Devuelve `null` si tuvo éxito, o el mensaje de error.
  Future<String?> updatePerfil({String? name, String? phone, String? dni}) async {
    try {
      final updated = await ref.read(authRepositoryProvider).updatePerfil(
            name: name,
            phone: phone,
            dni: dni,
          );
      state = state.copyWith(user: updated);
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  // ── RF-01-10: Logout ──────────────────────────────────────────
  Future<void> logout() async {
    // RF-18 — Eliminar token FCM del backend antes de cerrar sesión
    await FcmService.unregisterToken(ref);

    try {
      await _googleSignIn.signOut();
    } catch (_) {
      // Silencioso: si no hay sesión Google activa, no pasa nada.
    }
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}
