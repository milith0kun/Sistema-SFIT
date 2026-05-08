// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'fleet_entry_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FleetEntryModel _$FleetEntryModelFromJson(Map<String, dynamic> json) =>
    _FleetEntryModel(
      id: json['id'] as String,
      status: json['status'] as String?,
      vehicleId: json['vehicleId'] as String?,
      vehiclePlate: json['vehiclePlate'] as String?,
      routeId: json['routeId'] as String?,
      routeName: json['routeName'] as String?,
      driverId: json['driverId'] as String?,
      driverName: json['driverName'] as String?,
      departureTime: json['departureTime'] as String?,
      returnTime: json['returnTime'] as String?,
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      routeCompliancePercentage:
          (json['routeCompliancePercentage'] as num?)?.toDouble(),
      checkpointsHit: (json['checkpointsHit'] as num?)?.toInt(),
      totalCheckpoints: (json['totalCheckpoints'] as num?)?.toInt(),
      observations: json['observations'] as String?,
      capture: json['capture'] as Map<String, dynamic>?,
      trackPoints:
          (json['trackPoints'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          const <Map<String, dynamic>>[],
      visitedStops:
          (json['visitedStops'] as List<dynamic>?)
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

Map<String, dynamic> _$FleetEntryModelToJson(_FleetEntryModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'vehicleId': instance.vehicleId,
      'vehiclePlate': instance.vehiclePlate,
      'routeId': instance.routeId,
      'routeName': instance.routeName,
      'driverId': instance.driverId,
      'driverName': instance.driverName,
      'departureTime': instance.departureTime,
      'returnTime': instance.returnTime,
      'distanceMeters': instance.distanceMeters,
      'durationSeconds': instance.durationSeconds,
      'routeCompliancePercentage': instance.routeCompliancePercentage,
      'checkpointsHit': instance.checkpointsHit,
      'totalCheckpoints': instance.totalCheckpoints,
      'observations': instance.observations,
      'capture': instance.capture,
      'trackPoints': instance.trackPoints,
      'visitedStops': instance.visitedStops,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
