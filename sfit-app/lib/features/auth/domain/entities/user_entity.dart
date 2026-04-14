/// Entidad de usuario para la capa de dominio
class UserEntity {
  final String id;
  final String name;
  final String email;
  final String role;
  final String status;
  final String? image;
  final String? municipalityId;
  final String? provinceId;

  const UserEntity({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.status,
    this.image,
    this.municipalityId,
    this.provinceId,
  });

  bool get isActive => status == 'activo';

  bool get isCiudadano => role == 'ciudadano';
  bool get isConductor => role == 'conductor';
  bool get isFiscal => role == 'fiscal';
  bool get isOperador => role == 'operador';
  bool get isAdminMunicipal => role == 'admin_municipal';
  bool get isAdminProvincial => role == 'admin_provincial';
  bool get isSuperAdmin => role == 'super_admin';
}
