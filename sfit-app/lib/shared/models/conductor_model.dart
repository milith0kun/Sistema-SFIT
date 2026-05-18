/// Modelo del conductor compartido entre los flujos del propio conductor
/// (`features/conductor/`, `features/home/`) y la gestión que hace el
/// operador (`features/operator/`). Mapea la respuesta de
/// `GET /api/conductores`, `GET /api/conductores/:id` y
/// `GET /api/conductores/me`.
class ConductorModel {
  final String id;
  final String name;
  final String email;
  final String status; // apto | riesgo | no_apto
  final String? licenseCategory;
  final String? licenseNumber;
  /// Fecha de emisión de la licencia (MTC). El backend la guarda en
  /// `licenseIssuedAt`; tanto la web como la app la capturan en el
  /// onboarding del conductor o en su edición desde el panel admin.
  final DateTime? licenseIssuedAt;
  /// Fecha de vencimiento de la licencia. Backend serializa como
  /// `licenseExpiryDate` (alineado al cleanup); seguimos aceptando
  /// `licenseExpiry` como alias para back-compat de payloads antiguos.
  final DateTime? licenseExpiry;
  final String? phone;
  final String? dni;
  final double? continuousHours;
  final int? reputationScore;
  final String? companyId;
  final String? companyName;
  final String? companyRuc;

  const ConductorModel({
    required this.id,
    required this.name,
    required this.email,
    required this.status,
    this.licenseCategory,
    this.licenseNumber,
    this.licenseIssuedAt,
    this.licenseExpiry,
    this.phone,
    this.dni,
    this.continuousHours,
    this.reputationScore,
    this.companyId,
    this.companyName,
    this.companyRuc,
  });

  static DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    if (v is String) return DateTime.tryParse(v);
    return null;
  }

  factory ConductorModel.fromJson(Map<String, dynamic> j) => ConductorModel(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        email: j['email'] as String? ?? '',
        status: j['status'] as String? ?? 'apto',
        licenseCategory: j['licenseCategory'] as String?,
        licenseNumber: j['licenseNumber'] as String?,
        licenseIssuedAt: _parseDate(j['licenseIssuedAt']),
        // El backend devuelve `licenseExpiryDate` post-cleanup; mantenemos
        // `licenseExpiry` como fallback para clientes con payloads en cache.
        licenseExpiry:
            _parseDate(j['licenseExpiryDate']) ?? _parseDate(j['licenseExpiry']),
        phone: j['phone'] as String?,
        dni: j['dni'] as String?,
        continuousHours: (j['continuousHours'] as num?)?.toDouble(),
        reputationScore: (j['reputationScore'] as num?)?.toInt(),
        companyId: j['companyId'] as String?,
        companyName: j['companyName'] as String?,
        companyRuc: j['companyRuc'] as String?,
      );
}
