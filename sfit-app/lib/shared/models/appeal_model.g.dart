// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'appeal_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AppealModel _$AppealModelFromJson(Map<String, dynamic> json) => _AppealModel(
  id: json['id'] as String,
  type: json['type'] as String?,
  sanctionId: json['sanctionId'] as String?,
  inspectionId: json['inspectionId'] as String?,
  reportId: json['reportId'] as String?,
  submitterId: json['submitterId'] as String?,
  submitterName: json['submitterName'] as String?,
  reason: json['reason'] as String?,
  status: json['status'] as String? ?? 'pendiente',
  resolution: json['resolution'] as String?,
  resolvedBy: json['resolvedBy'] as String?,
  submittedAt:
      json['submittedAt'] == null
          ? null
          : DateTime.parse(json['submittedAt'] as String),
  resolvedAt:
      json['resolvedAt'] == null
          ? null
          : DateTime.parse(json['resolvedAt'] as String),
  createdAt:
      json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
  updatedAt:
      json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$AppealModelToJson(_AppealModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'sanctionId': instance.sanctionId,
      'inspectionId': instance.inspectionId,
      'reportId': instance.reportId,
      'submitterId': instance.submitterId,
      'submitterName': instance.submitterName,
      'reason': instance.reason,
      'status': instance.status,
      'resolution': instance.resolution,
      'resolvedBy': instance.resolvedBy,
      'submittedAt': instance.submittedAt?.toIso8601String(),
      'resolvedAt': instance.resolvedAt?.toIso8601String(),
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
