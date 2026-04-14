import '../entities/user_entity.dart';
import '../../data/repositories/auth_repository_impl.dart';

abstract class AuthRepository {
  Future<AuthResult> login(String email, String password);

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String requestedRole,
    String? municipalityId,
  });

  Future<AuthResult?> tryAutoLogin();
  Future<void> logout();
}
