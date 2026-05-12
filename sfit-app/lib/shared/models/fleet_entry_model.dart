import 'package:freezed_annotation/freezed_annotation.dart';

part 'fleet_entry_model.freezed.dart';
part 'fleet_entry_model.g.dart';

/// Entrada de turno en flota — un FleetEntry representa un viaje del
/// conductor desde que inicia turno (`status: en_ruta`) hasta que cierra
/// (`status: cerrado`). Mapea `/api/flota` y `/api/flota/:id`.
///
/// Los `trackPoints` y `visitedStops` se mantienen como
/// `List<Map<String, dynamic>>` porque la UI los consume con campos
/// heterogéneos (lat, lng, label, stopIndex, visitedAt).
@freezed
abstract class FleetEntryModel with _$FleetEntryModel {
  const factory FleetEntryModel({
    required String id,
    String? status, // disponible | en_ruta | cerrado | auto_cierre | mantenimiento | fuera_de_servicio
    String? vehicleId,
    String? vehiclePlate,
    String? routeId,
    String? routeName,
    String? driverId,
    String? driverName,
    String? driverStatus, // apto | riesgo | no_apto
    String? departureTime,
    String? returnTime,
    double? distanceMeters,
    int? durationSeconds,
    double? routeCompliancePercentage,
    int? checkpointsHit,
    int? totalCheckpoints,
    String? observations,
    Map<String, dynamic>? capture, // {status: validated|raw|merged|rejected|candidate}
    @Default(<Map<String, dynamic>>[]) List<Map<String, dynamic>> trackPoints,
    @Default(<Map<String, dynamic>>[]) List<Map<String, dynamic>> visitedStops,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _FleetEntryModel;

  factory FleetEntryModel.fromJson(Map<String, dynamic> json) =>
      _$FleetEntryModelFromJson(json);
}
