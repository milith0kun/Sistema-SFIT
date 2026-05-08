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
    this.licenseExpiry,
    this.phone,
    this.dni,
    this.continuousHours,
    this.reputationScore,
    this.companyId,
    this.companyName,
    this.companyRuc,
  });

  factory ConductorModel.fromJson(Map<String, dynamic> j) => ConductorModel(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        email: j['email'] as String? ?? '',
        status: j['status'] as String? ?? 'apto',
        licenseCategory: j['licenseCategory'] as String?,
        licenseNumber: j['licenseNumber'] as String?,
        licenseExpiry: j['licenseExpiry'] != null
            ? DateTime.tryParse(j['licenseExpiry'] as String)
            : null,
        phone: j['phone'] as String?,
        dni: j['dni'] as String?,
        continuousHours: (j['continuousHours'] as num?)?.toDouble(),
        reputationScore: (j['reputationScore'] as num?)?.toInt(),
        companyId: j['companyId'] as String?,
        companyName: j['companyName'] as String?,
        companyRuc: j['companyRuc'] as String?,
      );
}
