// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'route_candidate_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_RouteCandidateModel _$RouteCandidateModelFromJson(Map<String, dynamic> json) =>
    _RouteCandidateModel(
      id: json['id'] as String,
      status: json['status'] as String?,
      suggestedName: json['suggestedName'] as String?,
      municipalityId: json['municipalityId'] as String?,
      assignedRouteId: json['assignedRouteId'] as String?,
      dismissedReason: json['dismissedReason'] as String?,
      validatedRouteId: json['validatedRouteId'] as String?,
      sampleCount: (json['sampleCount'] as num?)?.toInt(),
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
      avgConfidence: (json['avgConfidence'] as num?)?.toDouble(),
      points:
          (json['points'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          const <Map<String, dynamic>>[],
      detectedStops:
          (json['detectedStops'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          const <Map<String, dynamic>>[],
      createdAt:
          json['createdAt'] == null
              ? null
              : DateTime.parse(json['createdAt'] as String),
      updatedAt:
          json['updatedAt'] == null
              ? null
              : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$RouteCandidateModelToJson(
  _RouteCandidateModel instance,
) => <String, dynamic>{
  'id': instance.id,
  'status': instance.status,
  'suggestedName': instance.suggestedName,
  'municipalityId': instance.municipalityId,
  'assignedRouteId': instance.assignedRouteId,
  'dismissedReason': instance.dismissedReason,
  'validatedRouteId': instance.validatedRouteId,
  'sampleCount': instance.sampleCount,
  'distanceMeters': instance.distanceMeters,
  'avgConfidence': instance.avgConfidence,
  'points': instance.points,
  'detectedStops': instance.detectedStops,
  'createdAt': instance.createdAt?.toIso8601String(),
  'updatedAt': instance.updatedAt?.toIso8601String(),
};
