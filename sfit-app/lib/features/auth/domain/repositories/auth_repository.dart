import '../../data/repositories/auth_repository_impl.dart';

/// Contrato de la capa de dominio para autenticación (RF-01).
abstract class AuthRepository {
  /// RF-01-06 / RF-01-07: Login correo+contraseña.
  Future<AuthResult> login(String email, String password);

  /// RF-01-01: Login con Google — requiere idToken del cliente.
  Future<AuthResult> loginWithGoogle(String idToken);

  /// RF-01-02 / RF-01-03: Registro — usuario queda en estado `pendiente`.
  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String requestedRole,
    String? municipalityId,
  });

  /// RF-01-08: Intenta restaurar sesión con el refresh token almacenado.
  Future<AuthResult?> tryAutoLogin();

  /// RF-01-08: Fuerza la rotación de tokens (expuesta para usos puntuales).
  Future<void> refreshTokens();

  /// RF-01-10: Cierre de sesión — revoca refresh y limpia almacenamiento.
  Future<void> logout();
}
