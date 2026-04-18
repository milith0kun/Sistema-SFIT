/// Payload que viaja dentro del QR de cada vehículo SFIT.
/// Versión 1 — firmado con HMAC-SHA256.
class QrPayload {
  final int v;      // version
  final String id;  // vehicleId
  final String pl;  // plate
  final String mu;  // municipalityId
  final String ty;  // vehicleTypeKey
  final int ts;     // Unix timestamp (seconds)
  final String sig; // HMAC-SHA256 hex

  const QrPayload({
    required this.v,
    required this.id,
    required this.pl,
    required this.mu,
    required this.ty,
    required this.ts,
    required this.sig,
  });

  factory QrPayload.fromJson(Map<String, dynamic> json) => QrPayload(
        v: (json['v'] as num).toInt(),
        id: json['id'] as String,
        pl: json['pl'] as String,
        mu: json['mu'] as String,
        ty: json['ty'] as String,
        ts: (json['ts'] as num).toInt(),
        sig: json['sig'] as String,
      );

  Map<String, dynamic> toJson() => {
        'v': v,
        'id': id,
        'pl': pl,
        'mu': mu,
        'ty': ty,
        'ts': ts,
        'sig': sig,
      };

  String get signingInput => 'v$v|$id|$pl|$mu|$ty|$ts';
}
