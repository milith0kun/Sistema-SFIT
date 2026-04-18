class ConductorModel {
  final String id;
  final String name;
  final String email;
  final String status; // apto | riesgo | no_apto
  final String? licenseCategory;
  final DateTime? licenseExpiry;
  final String? phone;
  final double? continuousHours;

  const ConductorModel({
    required this.id,
    required this.name,
    required this.email,
    required this.status,
    this.licenseCategory,
    this.licenseExpiry,
    this.phone,
    this.continuousHours,
  });

  factory ConductorModel.fromJson(Map<String, dynamic> j) => ConductorModel(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        email: j['email'] as String? ?? '',
        status: j['status'] as String? ?? 'apto',
        licenseCategory: j['licenseCategory'] as String?,
        licenseExpiry: j['licenseExpiry'] != null
            ? DateTime.tryParse(j['licenseExpiry'] as String)
            : null,
        phone: j['phone'] as String?,
        continuousHours: (j['continuousHours'] as num?)?.toDouble(),
      );
}
