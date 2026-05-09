import 'package:freezed_annotation/freezed_annotation.dart';

part 'route_model.freezed.dart';
part 'route_model.g.dart';

/// Geometría real de la ruta siguiendo calles (cacheada de Google Routes API
/// v2 server-side). Cuando es null la app cae al fallback de líneas rectas
/// entre waypoints — esa polyline atraviesa manzanas y casas, así que la
/// preferencia es siempre usar `coords` cuando estén disponibles.
@freezed
abstract class RoutePolylineGeometry with _$RoutePolylineGeometry {
  const factory RoutePolylineGeometry({
    /// Lista de [lat, lng] en orden, siguiendo calles reales.
    @Default(<List<double>>[]) List<List<double>> coords,
    @Default(0) int distanceMeters,
    @Default(0) int durationSecondsBaseline,
    DateTime? computedAt,
  }) = _RoutePolylineGeometry;

  factory RoutePolylineGeometry.fromJson(Map<String, dynamic> json) =>
      _$RoutePolylineGeometryFromJson(json);
}

/// Ventana horaria de hora pico (formato HH:mm 24h).
@freezed
abstract class RouteHoraPico with _$RouteHoraPico {
  const factory RouteHoraPico({
    required String from,
    required String to,
  }) = _RouteHoraPico;

  factory RouteHoraPico.fromJson(Map<String, dynamic> json) =>
      _$RouteHoraPicoFromJson(json);
}

/// Parámetros operativos editables por el operador. Reemplazan/extienden a
/// `frequencies` (texto libre legacy) con campos estructurados.
@freezed
abstract class RouteParameters with _$RouteParameters {
  const factory RouteParameters({
    int? frecuenciaMinutos,
    int? capacidadAsientos,
    @Default(<RouteHoraPico>[]) List<RouteHoraPico> horarioPico,
    String? observaciones,
  }) = _RouteParameters;

  factory RouteParameters.fromJson(Map<String, dynamic> json) =>
      _$RouteParametersFromJson(json);
}

/// Ruta operativa de transporte. Mapea `/api/rutas` y `/api/rutas/:id`.
/// Los `waypoints` se mantienen como `List<Map<String, dynamic>>` porque la
/// UI los consume con campos heterogéneos (lat, lng, label, order, type).
@freezed
abstract class RouteModel with _$RouteModel {
  const factory RouteModel({
    required String id,
    String? code,
    String? name,
    String? type,
    String? status,
    @JsonKey(name: 'length') String? lengthLabel,
    int? stops,
    String? municipalityId,
    String? siblingRouteId,
    @Default(<Map<String, dynamic>>[]) List<Map<String, dynamic>> waypoints,
    /// Geometría siguiendo calles. Null si Google Routes no respondió aún —
    /// usar getter `polylineCoords` que cae al fallback de waypoints.
    RoutePolylineGeometry? polylineGeometry,
    /// Override manual del operador: id de la pasada (FleetEntry) marcada
    /// como la "mejor" del corredor. Cuando está presente gana sobre el
    /// `isBest` automático calculado por score.
    String? preferredCaptureId,
    DateTime? preferredAt,
    /// Etiquetas operativas (presets + custom). Ej: "congestionada", "rapida".
    @Default(<String>[]) List<String> tags,
    /// Metadata estructurada para reportes y operación.
    RouteParameters? parameters,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _RouteModel;

  factory RouteModel.fromJson(Map<String, dynamic> json) =>
      _$RouteModelFromJson(json);
}

/// Helpers que evitan que cada pantalla repita la lógica de decidir
/// `polylineGeometry.coords` vs fallback a `waypoints`.
extension RouteModelGeometry on RouteModel {
  /// Coordenadas para pintar la `Polyline`. Preferimos la geometría real
  /// (siguiendo calles); si no existe, caemos a los waypoints — lo que
  /// produce líneas rectas que pueden atravesar manzanas. La app debe
  /// invocar `POST /rutas/:id/recalcular` o un nuevo PATCH waypoints
  /// cuando esto ocurra para regenerar la geometría.
  List<List<double>> get polylineCoords {
    final geom = polylineGeometry;
    if (geom != null && geom.coords.length >= 2) return geom.coords;
    return waypoints
        .where((w) => w['lat'] is num && w['lng'] is num)
        .map((w) => <double>[(w['lat'] as num).toDouble(), (w['lng'] as num).toDouble()])
        .toList();
  }

  /// `true` cuando se está pintando un trazado real por calles. Útil para
  /// mostrar un badge "trazado por calles" o un warning "líneas rectas".
  bool get hasSnappedGeometry =>
      (polylineGeometry?.coords.length ?? 0) >= 2;
}
