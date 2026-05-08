import 'package:freezed_annotation/freezed_annotation.dart';

part 'route_candidate_model.freezed.dart';
part 'route_candidate_model.g.dart';

/// Candidata a ruta — propuesta generada a partir de capturas GPS de
/// conductores reales. El operador la valida (la convierte en `RouteModel`),
/// la asigna a una ruta existente, o la descarta.
///
/// Mapea `/api/rutas/candidatas` y `/api/rutas/candidatas/:id`.
@freezed
abstract class RouteCandidateModel with _$RouteCandidateModel {
  const factory RouteCandidateModel({
    required String id,
    String? status,
    String? suggestedName,
    String? municipalityId,
    String? assignedRouteId,
    String? dismissedReason,
    String? validatedRouteId,
    int? sampleCount,
    double? distanceMeters,
    double? avgConfidence,
    @Default(<Map<String, dynamic>>[]) List<Map<String, dynamic>> points,
    @Default(<Map<String, dynamic>>[]) List<Map<String, dynamic>> detectedStops,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _RouteCandidateModel;

  factory RouteCandidateModel.fromJson(Map<String, dynamic> json) =>
      _$RouteCandidateModelFromJson(json);
}
