// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'company_brief_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_CompanyBriefModel _$CompanyBriefModelFromJson(Map<String, dynamic> json) =>
    _CompanyBriefModel(
      id: json['id'] as String,
      razonSocial: json['razonSocial'] as String,
      ruc: json['ruc'] as String?,
      municipalityName: json['municipalityName'] as String?,
      municipalityId: json['municipalityId'] as String?,
      estado: json['estado'] as String?,
    );

Map<String, dynamic> _$CompanyBriefModelToJson(_CompanyBriefModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'razonSocial': instance.razonSocial,
      'ruc': instance.ruc,
      'municipalityName': instance.municipalityName,
      'municipalityId': instance.municipalityId,
      'estado': instance.estado,
    };
