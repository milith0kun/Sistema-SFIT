// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'route_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_RouteModel _$RouteModelFromJson(Map<String, dynamic> json) => _RouteModel(
  id: json['id'] as String,
  code: json['code'] as String?,
  name: json['name'] as String?,
  type: json['type'] as String?,
  status: json['status'] as String?,
  lengthLabel: json['length'] as String?,
  stops: (json['stops'] as num?)?.toInt(),
  municipalityId: json['municipalityId'] as String?,
  siblingRouteId: json['siblingRouteId'] as String?,
  waypoints:
      (json['waypoints'] as List<dynamic>?)
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

Map<String, dynamic> _$RouteModelToJson(_RouteModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'name': instance.name,
      'type': instance.type,
      'status': instance.status,
      'length': instance.lengthLabel,
      'stops': instance.stops,
      'municipalityId': instance.municipalityId,
      'siblingRouteId': instance.siblingRouteId,
      'waypoints': instance.waypoints,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
