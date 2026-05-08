import 'package:freezed_annotation/freezed_annotation.dart';

part 'route_model.freezed.dart';
part 'route_model.g.dart';

/// Ruta operativa de transporte. Mapea `/api/rutas` y `/api/rutas/:id`.
/// Los `waypoints` se mantienen como `List<Map<String, dynamic>>` porque la
/// UI los consume con campos heterogéneos (lat, lng, label, order, type).
@freezed
abstract class RouteModel with _$RouteModel {
  const factory RouteModel({
    required String id,
    String? code,
    String? name,
    String? type,
    String? status,
    @JsonKey(name: 'length') String? lengthLabel,
    int? stops,
    String? municipalityId,
    String? siblingRouteId,
    @Default(<Map<String, dynamic>>[]) List<Map<String, dynamic>> waypoints,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _RouteModel;

  factory RouteModel.fromJson(Map<String, dynamic> json) =>
      _$RouteModelFromJson(json);
}
