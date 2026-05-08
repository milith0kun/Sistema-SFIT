import 'package:freezed_annotation/freezed_annotation.dart';

part 'appeal_model.freezed.dart';
part 'appeal_model.g.dart';

/// Apelación presentada por un conductor o ciudadano contra una sanción,
/// inspección o reporte. El fiscal/admin la resuelve. Mapea `/api/apelaciones`.
@freezed
abstract class AppealModel with _$AppealModel {
  const factory AppealModel({
    required String id,
    String? type, // sanction | inspection | report
    String? sanctionId,
    String? inspectionId,
    String? reportId,
    String? submitterId,
    String? submitterName,
    String? reason,
    @Default('pendiente') String status, // pendiente | resuelta | rechazada
    String? resolution,
    String? resolvedBy,
    DateTime? submittedAt,
    DateTime? resolvedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _AppealModel;

  factory AppealModel.fromJson(Map<String, dynamic> json) =>
      _$AppealModelFromJson(json);
}
