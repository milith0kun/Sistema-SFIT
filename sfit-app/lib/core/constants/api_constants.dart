/// Constantes de la API
class ApiConstants {
  ApiConstants._();

  // TODO: Configurar la URL base del backend (Next.js API)
  static const String baseUrl = 'http://localhost:3000/api';
  
  // Timeouts
  static const int connectTimeout = 15000;
  static const int receiveTimeout = 15000;
  
  // Auth endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String refreshToken = '/auth/refresh';
  static const String googleAuth = '/auth/google';
  
  // Token
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
}
