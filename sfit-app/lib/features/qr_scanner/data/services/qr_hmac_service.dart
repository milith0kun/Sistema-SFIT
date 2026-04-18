import 'dart:convert';
import 'package:crypto/crypto.dart';
import '../models/qr_payload.dart';

/// Verifica la firma HMAC-SHA256 del payload QR sin necesidad de conexión.
///
/// El secreto se inyecta en build time mediante:
///   flutter run --dart-define=SFIT_QR_SECRET=valor
///
/// En debug, cae en la clave de desarrollo si no se provee el define.
class QrHmacService {
  static const String _secret = String.fromEnvironment(
    'SFIT_QR_SECRET',
    defaultValue: 'sfit-dev-qr-secret',
  );

  static final _key = utf8.encode(_secret);

  /// Retorna `true` si la firma del payload es válida.
  static bool verify(QrPayload payload) {
    final input = utf8.encode(payload.signingInput);
    final hmac = Hmac(sha256, _key);
    final digest = hmac.convert(input).toString();
    return _constantTimeEquals(digest, payload.sig);
  }

  /// Parsea el JSON escaneado y retorna el payload (o null si mal formado).
  static QrPayload? parse(String rawJson) {
    try {
      final map = jsonDecode(rawJson) as Map<String, dynamic>;
      return QrPayload.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  /// Comparación en tiempo constante para evitar timing attacks.
  static bool _constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    var result = 0;
    for (var i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return result == 0;
  }
}
