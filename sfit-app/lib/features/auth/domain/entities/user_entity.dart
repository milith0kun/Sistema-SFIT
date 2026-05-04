/// Entidad de usuario para la capa de dominio (RF-01).
///
/// `status` usa los valores del backend: `activo`, `pendiente`, `rechazado`, `suspendido`.
/// `role` usa los snake_case del backend: `super_admin`, `admin_regional`,
/// `admin_provincial`, `admin_municipal`, `fiscal`, `operador`, `conductor`,
/// `ciudadano`.
class UserEntity {
  final String id;
  final String name;
  final String email;
  final String role;
  final String status;
  final String? image;
  final String? municipalityId;
  final String? provinceId;
  final String? regionId;
  final String? phone;
  final String? dni;

  const UserEntity({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.status,
    this.image,
    this.municipalityId,
    this.provinceId,
    this.regionId,
    this.phone,
    this.dni,
  });

  // ── Status helpers ────────────────────────────────────────────
  bool get isActive => status == 'activo';
  bool get isPending => status == 'pendiente';
  bool get isRejected => status == 'rechazado';
  bool get isSuspended => status == 'suspendido';

  // ── Role helpers ──────────────────────────────────────────────
  bool get isCiudadano        => role == 'ciudadano';
  bool get isConductor        => role == 'conductor';
  bool get isFiscal           => role == 'fiscal';
  bool get isOperador         => role == 'operador';
  bool get isAdminMunicipal   => role == 'admin_municipal';
  bool get isAdminProvincial  => role == 'admin_provincial';
  bool get isAdminRegional    => role == 'admin_regional';
  bool get isSuperAdmin       => role == 'super_admin';

  /// Roles que SOLO operan desde el panel web.
  /// Los roles de administración (municipal/provincial/regional/super)
  /// gestionan flujos pesados de aprobación, gestión de usuarios y reportes
  /// — más cómodos en el dashboard web. En el app móvil se les muestra una
  /// pantalla que los redirige a `sfit.ecosdelseo.com`.
  bool get isWebOnlyRole =>
      isAdminMunicipal || isAdminProvincial || isAdminRegional || isSuperAdmin;
}
