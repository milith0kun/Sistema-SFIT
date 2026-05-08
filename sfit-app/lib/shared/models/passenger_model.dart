import 'package:freezed_annotation/freezed_annotation.dart';

part 'passenger_model.freezed.dart';
part 'passenger_model.g.dart';

/// Pasajero registrado en el manifiesto de un viaje. Mapea
/// `/api/viajes/:id/pasajeros`.
@freezed
abstract class PassengerModel with _$PassengerModel {
  const factory PassengerModel({
    required String id,
    required String name,
    String? dni,
    String? seat,
    String? contact,
    String? boardingStop,
    String? destinationStop,
    String? note,
    DateTime? createdAt,
  }) = _PassengerModel;

  factory PassengerModel.fromJson(Map<String, dynamic> json) =>
      _$PassengerModelFromJson(json);
}
