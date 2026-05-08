// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sanction_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SanctionModel _$SanctionModelFromJson(Map<String, dynamic> json) =>
    _SanctionModel(
      id: json['id'] as String,
      vehicleId: json['vehicleId'] as String?,
      vehiclePlate: json['vehiclePlate'] as String?,
      driverId: json['driverId'] as String?,
      driverName: json['driverName'] as String?,
      faultType: json['faultType'] as String?,
      description: json['description'] as String?,
      amountSoles: json['amountSoles'] as num?,
      amountUIT: json['amountUIT'] as num?,
      status: json['status'] as String? ?? 'vigente',
      annulmentReason: json['annulmentReason'] as String?,
      issuedBy: json['issuedBy'] as String?,
      issuedAt:
          json['issuedAt'] == null
              ? null
              : DateTime.parse(json['issuedAt'] as String),
      createdAt:
          json['createdAt'] == null
              ? null
              : DateTime.parse(json['createdAt'] as String),
      updatedAt:
          json['updatedAt'] == null
              ? null
              : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$SanctionModelToJson(_SanctionModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'vehicleId': instance.vehicleId,
      'vehiclePlate': instance.vehiclePlate,
      'driverId': instance.driverId,
      'driverName': instance.driverName,
      'faultType': instance.faultType,
      'description': instance.description,
      'amountSoles': instance.amountSoles,
      'amountUIT': instance.amountUIT,
      'status': instance.status,
      'annulmentReason': instance.annulmentReason,
      'issuedBy': instance.issuedBy,
      'issuedAt': instance.issuedAt?.toIso8601String(),
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
