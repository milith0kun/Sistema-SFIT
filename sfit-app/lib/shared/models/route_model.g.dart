// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'route_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_RoutePolylineGeometry _$RoutePolylineGeometryFromJson(
  Map<String, dynamic> json,
) => _RoutePolylineGeometry(
  coords:
      (json['coords'] as List<dynamic>?)
          ?.map(
            (e) =>
                (e as List<dynamic>).map((e) => (e as num).toDouble()).toList(),
          )
          .toList() ??
      const <List<double>>[],
  distanceMeters: (json['distanceMeters'] as num?)?.toInt() ?? 0,
  durationSecondsBaseline:
      (json['durationSecondsBaseline'] as num?)?.toInt() ?? 0,
  computedAt:
      json['computedAt'] == null
          ? null
          : DateTime.parse(json['computedAt'] as String),
);

Map<String, dynamic> _$RoutePolylineGeometryToJson(
  _RoutePolylineGeometry instance,
) => <String, dynamic>{
  'coords': instance.coords,
  'distanceMeters': instance.distanceMeters,
  'durationSecondsBaseline': instance.durationSecondsBaseline,
  'computedAt': instance.computedAt?.toIso8601String(),
};

_RouteHoraPico _$RouteHoraPicoFromJson(Map<String, dynamic> json) =>
    _RouteHoraPico(from: json['from'] as String, to: json['to'] as String);

Map<String, dynamic> _$RouteHoraPicoToJson(_RouteHoraPico instance) =>
    <String, dynamic>{'from': instance.from, 'to': instance.to};

_RouteParameters _$RouteParametersFromJson(Map<String, dynamic> json) =>
    _RouteParameters(
      frecuenciaMinutos: (json['frecuenciaMinutos'] as num?)?.toInt(),
      capacidadAsientos: (json['capacidadAsientos'] as num?)?.toInt(),
      horarioPico:
          (json['horarioPico'] as List<dynamic>?)
              ?.map((e) => RouteHoraPico.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <RouteHoraPico>[],
      observaciones: json['observaciones'] as String?,
    );

Map<String, dynamic> _$RouteParametersToJson(_RouteParameters instance) =>
    <String, dynamic>{
      'frecuenciaMinutos': instance.frecuenciaMinutos,
      'capacidadAsientos': instance.capacidadAsientos,
      'horarioPico': instance.horarioPico,
      'observaciones': instance.observaciones,
    };

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
  polylineGeometry:
      json['polylineGeometry'] == null
          ? null
          : RoutePolylineGeometry.fromJson(
            json['polylineGeometry'] as Map<String, dynamic>,
          ),
  preferredCaptureId: json['preferredCaptureId'] as String?,
  preferredAt:
      json['preferredAt'] == null
          ? null
          : DateTime.parse(json['preferredAt'] as String),
  tags:
      (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const <String>[],
  parameters:
      json['parameters'] == null
          ? null
          : RouteParameters.fromJson(
            json['parameters'] as Map<String, dynamic>,
          ),
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
      'polylineGeometry': instance.polylineGeometry,
      'preferredCaptureId': instance.preferredCaptureId,
      'preferredAt': instance.preferredAt?.toIso8601String(),
      'tags': instance.tags,
      'parameters': instance.parameters,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
