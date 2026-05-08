import 'package:freezed_annotation/freezed_annotation.dart';

part 'company_brief_model.freezed.dart';
part 'company_brief_model.g.dart';

/// Resumen público de una empresa de transporte, suficiente para listarla
/// en pantallas de búsqueda/asociación. Mapea `/api/public/empresas` y
/// `/api/empresas` (modo lectura para conductores y operadores).
@freezed
abstract class CompanyBriefModel with _$CompanyBriefModel {
  const factory CompanyBriefModel({
    required String id,
    required String razonSocial,
    String? ruc,
    String? municipalityName,
    String? municipalityId,
    String? estado,
  }) = _CompanyBriefModel;

  factory CompanyBriefModel.fromJson(Map<String, dynamic> json) =>
      _$CompanyBriefModelFromJson(json);
}
