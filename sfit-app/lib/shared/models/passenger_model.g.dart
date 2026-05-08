// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'passenger_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PassengerModel _$PassengerModelFromJson(Map<String, dynamic> json) =>
    _PassengerModel(
      id: json['id'] as String,
      name: json['name'] as String,
      dni: json['dni'] as String?,
      seat: json['seat'] as String?,
      contact: json['contact'] as String?,
      boardingStop: json['boardingStop'] as String?,
      destinationStop: json['destinationStop'] as String?,
      note: json['note'] as String?,
      createdAt:
          json['createdAt'] == null
              ? null
              : DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$PassengerModelToJson(_PassengerModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'dni': instance.dni,
      'seat': instance.seat,
      'contact': instance.contact,
      'boardingStop': instance.boardingStop,
      'destinationStop': instance.destinationStop,
      'note': instance.note,
      'createdAt': instance.createdAt?.toIso8601String(),
    };
