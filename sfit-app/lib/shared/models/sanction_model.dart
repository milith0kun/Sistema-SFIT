import 'package:freezed_annotation/freezed_annotation.dart';

part 'sanction_model.freezed.dart';
part 'sanction_model.g.dart';

/// Sanción aplicada a un vehículo/conductor. Mapea `/api/sanciones`.
/// El fiscal/admin la crea desde `create_sanction_page` o desde una
/// inspección con resultado "no apto".
@freezed
abstract class SanctionModel with _$SanctionModel {
  const factory SanctionModel({
    required String id,
    String? vehicleId,
    String? vehiclePlate,
    String? driverId,
    String? driverName,
    String? faultType,
    String? description,
    num? amountSoles,
    num? amountUIT,
    @Default('vigente') String status, // vigente | apelada | anulada | pagada
    String? annulmentReason,
    String? issuedBy,
    DateTime? issuedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _SanctionModel;

  factory SanctionModel.fromJson(Map<String, dynamic> json) =>
      _$SanctionModelFromJson(json);
}
