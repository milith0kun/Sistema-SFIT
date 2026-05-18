import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:logger/logger.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/services/fcm_service.dart';
import '../../data/datasources/auth_api_service.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

part 'auth_provider.g.dart';

final _log = Logger(
  printer: PrettyPrinter(methodCount: 0, errorMethodCount: 0, lineLength: 80),
);

// Storage keys para guardar la sesión original del super_admin mientras
// está en modo "preview" como otro rol. Permite revertir sin re-loguear.
const _kPreviewOriginalAccessKey = 'preview_original_access';
const _kPreviewOriginalRefreshKey = 'preview_original_refresh';
const _kPreviewOriginalUserKey = 'preview_original_user';

// ── Providers de infraestructura ─────────────────────────────────

@Riverpod(keepAlive: true)
FlutterSecureStorage secureStorage(Ref ref) => const FlutterSecureStorage();

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

  const AuthState({required this.status, this.user, this.errorMessage});

  AuthState copyWith({
    AuthStatus? status,
    UserEntity? user,
    String? errorMessage,
  }) => AuthState(
    status: status ?? this.status,
    user: user ?? this.user,
    errorMessage: errorMessage,
  );

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isLoading => status == AuthStatus.loading;
}

// ── Notifier ─────────────────────────────────────────────────────

@Riverpod(keepAlive: true)
class Auth extends _$Auth {
  static final _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: const String.fromEnvironment(
      'SFIT_GOOGLE_CLIENT_ID',
      defaultValue:
          '378647499793-tbks1mfqq15thpmii1dbirm3o21fkhd3.apps.googleusercontent.com',
    ),
  );

  @override
  AuthState build() {
    // Cuando el servidor invalida la sesión por cambio de rol del usuario
    // (response 401 + code SESSION_INVALIDATED), el interceptor Dio limpia
    // tokens y dispara este callback para que la UI vuelva al login.
    DioClient.onSessionInvalidated = () {
      state = const AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: 'Tu rol fue actualizado. Vuelve a iniciar sesión.',
      );
    };
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
      case 'activo':
        return AuthStatus.authenticated;
      case 'pendiente':
        return AuthStatus.pendingApproval;
      case 'rechazado':
        return AuthStatus.rejected;
      default:
        return AuthStatus.unauthenticated;
    }
  }

  // ── RF-01-06 / RF-01-07: Login con correo ─────────────────────
  Future<bool> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final result = await ref
          .read(authRepositoryProvider)
          .login(email, password);
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
      _log.e('[Auth.login] unexpected error', error: e, stackTrace: st);
      final msg = _networkErrorMsg(e);
      state = AuthState(status: AuthStatus.unauthenticated, errorMessage: msg);
      return false;
    }
  }

  // ── RF-01-01: Login con Google ────────────────────────────────
  Future<bool> loginWithGoogle() async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      _log.i('[Auth.loginWithGoogle] iniciando Google Sign In...');
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // signIn() retorna null en dos casos indistinguibles:
        // 1) El usuario canceló el diálogo de cuenta
        // 2) Google Play Services rechaza el sign-in (SHA-1 no registrado,
        //    Play Services desactualizado, etc.)
        // Como no hay forma de diferenciarlos, mostramos un mensaje
        // informativo que cubre ambos casos sin alarmar.
        _log.w(
          '[Auth.loginWithGoogle] signIn() retornó null (cancelación o fallo silencioso del plugin)',
        );
        state = const AuthState(
          status: AuthStatus.unauthenticated,
          errorMessage:
              'No se completó el inicio con Google. Si no cancelaste, revisa Google Play Services o vuelve a intentar.',
        );
        return false;
      }
      _log.i('[Auth.loginWithGoogle] cuenta seleccionada: ${googleUser.email}');

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) {
        _log.e(
          '[Auth.loginWithGoogle] idToken es null — serverClientId probablemente mal configurado',
        );
        throw AuthException(
          'Google no devolvió token de identidad. Revisa la configuración de la cuenta o intenta más tarde.',
        );
      }
      _log.i('[Auth.loginWithGoogle] idToken obtenido, enviando al backend...');

      final result = await ref
          .read(authRepositoryProvider)
          .loginWithGoogle(idToken);
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
      _log.e('[Auth.loginWithGoogle] error: $e');
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
    await ref
        .read(authRepositoryProvider)
        .register(
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
      final result = await ref
          .read(authRepositoryProvider)
          .registerCiudadano(
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
      _log.e('[Auth.registerCiudadano] error: $e');
      final msg = _networkErrorMsg(e);
      state = AuthState(status: AuthStatus.unauthenticated, errorMessage: msg);
      return false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  String _networkErrorMsg(Object e) {
    final s = e.toString();
    if (s.contains('TimeoutException') ||
        s.contains('connectTimeout') ||
        s.contains('receiveTimeout')) {
      return 'Tiempo de espera agotado. Verifica tu conexión e inténtalo de nuevo.';
    }
    if (s.contains('Connection refused') ||
        s.contains('SocketException') ||
        s.contains('Failed host lookup')) {
      return 'Sin conexión al servidor. Verifica tu Internet e inténtalo de nuevo.';
    }
    if (s.contains('HandshakeException') || s.contains('CERTIFICATE')) {
      return 'No se pudo establecer una conexión segura con el servidor.';
    }
    if (s.contains('sign_in_failed') || s.contains('ApiException')) {
      return 'No se pudo iniciar sesión con Google. Inténtalo más tarde.';
    }
    return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }

  // ── Aplicar respuesta del onboarding ──────────────────────────
  /// Sincroniza el `UserEntity` local con la respuesta del endpoint
  /// `/auth/onboarding/complete` SIN hacer una segunda llamada a `/perfil`.
  ///
  /// El segundo fetch era frágil — si fallaba (red intermitente, 401 por
  /// rate limit, etc.) el flag `profileCompleted` quedaba en `false` local y
  /// el router redirigía de vuelta al onboarding eternamente. La response
  /// del onboarding ya trae los campos actualizados; los usamos directo.
  ///
  /// Si `data` viene `null` o sin campos clave, cae a `refreshUserFromServer`
  /// como fallback.
  Future<void> applyOnboardingResponse(Map? data) async {
    if (data == null) {
      await refreshUserFromServer();
      return;
    }
    final current = state.user;
    final next = UserEntity(
      id: (data['id'] ?? current?.id ?? '').toString(),
      name: (data['name'] ?? current?.name ?? '').toString(),
      email: (data['email'] ?? current?.email ?? '').toString(),
      role: (data['role'] ?? current?.role ?? 'ciudadano').toString(),
      status: (data['status'] ?? current?.status ?? 'activo').toString(),
      image: data['image'] as String? ?? current?.image,
      municipalityId:
          data['municipalityId'] as String? ?? current?.municipalityId,
      provinceId: data['provinceId'] as String? ?? current?.provinceId,
      regionId: current?.regionId,
      phone: data['phone'] as String? ?? current?.phone,
      dni: data['dni'] as String? ?? current?.dni,
      profileCompleted: data['profileCompleted'] as bool? ?? true,
    );
    state = AuthState(status: _statusFor(next), user: next);
  }

  // ── Refrescar usuario desde el servidor ───────────────────────
  /// Vuelve a leer `/auth/perfil` para sincronizar el `UserEntity` local
  /// (rol, profileCompleted, datos territoriales) con la BD. Útil tras
  /// completar onboarding o cuando un admin cambió algo del usuario y
  /// queremos reflejarlo sin forzar un re-login.
  Future<void> refreshUserFromServer() async {
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/auth/perfil');
      final body = resp.data;
      if (body is! Map || body['success'] != true) return;
      final data = body['data'];
      if (data is! Map) return;
      final current = state.user;
      final next = UserEntity(
        id: (data['id'] ?? current?.id ?? '').toString(),
        name: (data['name'] ?? current?.name ?? '').toString(),
        email: (data['email'] ?? current?.email ?? '').toString(),
        role: (data['role'] ?? current?.role ?? 'ciudadano').toString(),
        status: (data['status'] ?? current?.status ?? 'activo').toString(),
        image: data['image'] as String? ?? current?.image,
        municipalityId:
            data['municipalityId'] as String? ?? current?.municipalityId,
        provinceId: data['provinceId'] as String? ?? current?.provinceId,
        regionId: current?.regionId,
        phone: data['phone'] as String? ?? current?.phone,
        dni: data['dni'] as String? ?? current?.dni,
        profileCompleted:
            data['profileCompleted'] as bool? ??
            current?.profileCompleted ??
            true,
      );
      state = AuthState(status: _statusFor(next), user: next);
    } catch (_) {
      // Silencioso: el caller decide qué hacer si necesita la actualización.
    }
  }

  // ── Actualizar perfil propio ──────────────────────────────────
  /// Devuelve `null` si tuvo éxito, o el mensaje de error.
  Future<String?> updatePerfil({
    String? name,
    String? phone,
    String? dni,
  }) async {
    try {
      final updated = await ref
          .read(authRepositoryProvider)
          .updatePerfil(name: name, phone: phone, dni: dni);
      state = state.copyWith(user: updated);
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  // ── Preview-as (super_admin → ciudadano/conductor/fiscal/operador) ──
  /// Permite al super_admin "entrar como" un usuario activo de uno de
  /// los 4 roles operativos. Guarda los tokens originales del super
  /// admin en slots de respaldo para poder revertir con `revertPreview`.
  /// Devuelve `null` en éxito o el mensaje de error.
  Future<String?> previewAs(String role) async {
    final storage = ref.read(secureStorageProvider);
    final dio = ref.read(dioClientProvider).dio;

    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      // Respaldar la sesión actual del super_admin antes de pisarla.
      final origAccess = await storage.read(key: ApiConstants.accessTokenKey);
      final origRefresh = await storage.read(key: ApiConstants.refreshTokenKey);
      final origUser = await storage.read(key: ApiConstants.userJsonKey);
      if (origAccess != null) {
        await storage.write(key: _kPreviewOriginalAccessKey, value: origAccess);
      }
      if (origRefresh != null) {
        await storage.write(
          key: _kPreviewOriginalRefreshKey,
          value: origRefresh,
        );
      }
      if (origUser != null) {
        await storage.write(key: _kPreviewOriginalUserKey, value: origUser);
      }

      final resp = await dio.post('/auth/preview-as', data: {'role': role});
      final body = resp.data as Map?;
      if (body == null || body['success'] != true) {
        state = state.copyWith(status: AuthStatus.authenticated);
        return (body?['error'] as String?) ?? 'No se pudo cambiar de rol';
      }

      final data = body['data'] as Map<String, dynamic>;
      final newAccess = data['accessToken'] as String;
      final newRefresh = data['refreshToken'] as String;
      final userJson = data['user'] as Map<String, dynamic>;

      await storage.write(key: ApiConstants.accessTokenKey, value: newAccess);
      await storage.write(key: ApiConstants.refreshTokenKey, value: newRefresh);
      await storage.write(
        key: ApiConstants.userJsonKey,
        value: jsonEncode(userJson),
      );

      final newUser = UserEntity(
        id: userJson['id'] as String,
        name: userJson['name'] as String? ?? '',
        email: userJson['email'] as String? ?? '',
        role: userJson['role'] as String,
        status: userJson['status'] as String? ?? 'activo',
        image: userJson['image'] as String?,
        municipalityId: userJson['municipalityId'] as String?,
        provinceId: userJson['provinceId'] as String?,
        phone: userJson['phone'] as String?,
        dni: userJson['dni'] as String?,
      );
      state = AuthState(status: _statusFor(newUser), user: newUser);
      return null;
    } catch (e) {
      state = state.copyWith(status: AuthStatus.authenticated);
      return _networkErrorMsg(e);
    }
  }

  /// `true` si actualmente el super_admin está previsualizando como otro
  /// rol (existen tokens originales respaldados).
  Future<bool> isInPreviewMode() async {
    final storage = ref.read(secureStorageProvider);
    final orig = await storage.read(key: _kPreviewOriginalAccessKey);
    return orig != null;
  }

  /// Restaura la sesión original del super_admin. Si no había sesión
  /// previa respaldada, hace logout normal.
  Future<void> revertPreview() async {
    final storage = ref.read(secureStorageProvider);
    final origAccess = await storage.read(key: _kPreviewOriginalAccessKey);
    final origRefresh = await storage.read(key: _kPreviewOriginalRefreshKey);
    final origUserStr = await storage.read(key: _kPreviewOriginalUserKey);

    if (origAccess == null || origRefresh == null || origUserStr == null) {
      await logout();
      return;
    }

    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    await storage.write(key: ApiConstants.accessTokenKey, value: origAccess);
    await storage.write(key: ApiConstants.refreshTokenKey, value: origRefresh);
    await storage.write(key: ApiConstants.userJsonKey, value: origUserStr);
    await storage.delete(key: _kPreviewOriginalAccessKey);
    await storage.delete(key: _kPreviewOriginalRefreshKey);
    await storage.delete(key: _kPreviewOriginalUserKey);

    final userJson = jsonDecode(origUserStr) as Map<String, dynamic>;
    final restoredUser = UserEntity(
      id: userJson['id'] as String,
      name: userJson['name'] as String? ?? '',
      email: userJson['email'] as String? ?? '',
      role: userJson['role'] as String,
      status: userJson['status'] as String? ?? 'activo',
      image: userJson['image'] as String?,
      municipalityId: userJson['municipalityId'] as String?,
      provinceId: userJson['provinceId'] as String?,
      phone: userJson['phone'] as String?,
      dni: userJson['dni'] as String?,
    );
    state = AuthState(status: _statusFor(restoredUser), user: restoredUser);
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
