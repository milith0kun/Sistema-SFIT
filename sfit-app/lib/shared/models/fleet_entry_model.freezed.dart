// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'fleet_entry_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FleetEntryModel {

 String get id; String? get status;// disponible | en_ruta | cerrado | auto_cierre | mantenimiento | fuera_de_servicio
 String? get vehicleId; String? get vehiclePlate; String? get routeId; String? get routeName; String? get driverId; String? get driverName; String? get driverStatus;// apto | riesgo | no_apto
 String? get departureTime; String? get returnTime; double? get distanceMeters; int? get durationSeconds; double? get routeCompliancePercentage; int? get checkpointsHit; int? get totalCheckpoints; String? get observations; Map<String, dynamic>? get capture;// {status: validated|raw|merged|rejected|candidate}
 List<Map<String, dynamic>> get trackPoints; List<Map<String, dynamic>> get visitedStops; DateTime? get createdAt; DateTime? get updatedAt;
/// Create a copy of FleetEntryModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FleetEntryModelCopyWith<FleetEntryModel> get copyWith => _$FleetEntryModelCopyWithImpl<FleetEntryModel>(this as FleetEntryModel, _$identity);

  /// Serializes this FleetEntryModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FleetEntryModel&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.vehicleId, vehicleId) || other.vehicleId == vehicleId)&&(identical(other.vehiclePlate, vehiclePlate) || other.vehiclePlate == vehiclePlate)&&(identical(other.routeId, routeId) || other.routeId == routeId)&&(identical(other.routeName, routeName) || other.routeName == routeName)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.driverName, driverName) || other.driverName == driverName)&&(identical(other.driverStatus, driverStatus) || other.driverStatus == driverStatus)&&(identical(other.departureTime, departureTime) || other.departureTime == departureTime)&&(identical(other.returnTime, returnTime) || other.returnTime == returnTime)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.durationSeconds, durationSeconds) || other.durationSeconds == durationSeconds)&&(identical(other.routeCompliancePercentage, routeCompliancePercentage) || other.routeCompliancePercentage == routeCompliancePercentage)&&(identical(other.checkpointsHit, checkpointsHit) || other.checkpointsHit == checkpointsHit)&&(identical(other.totalCheckpoints, totalCheckpoints) || other.totalCheckpoints == totalCheckpoints)&&(identical(other.observations, observations) || other.observations == observations)&&const DeepCollectionEquality().equals(other.capture, capture)&&const DeepCollectionEquality().equals(other.trackPoints, trackPoints)&&const DeepCollectionEquality().equals(other.visitedStops, visitedStops)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,status,vehicleId,vehiclePlate,routeId,routeName,driverId,driverName,driverStatus,departureTime,returnTime,distanceMeters,durationSeconds,routeCompliancePercentage,checkpointsHit,totalCheckpoints,observations,const DeepCollectionEquality().hash(capture),const DeepCollectionEquality().hash(trackPoints),const DeepCollectionEquality().hash(visitedStops),createdAt,updatedAt]);

@override
String toString() {
  return 'FleetEntryModel(id: $id, status: $status, vehicleId: $vehicleId, vehiclePlate: $vehiclePlate, routeId: $routeId, routeName: $routeName, driverId: $driverId, driverName: $driverName, driverStatus: $driverStatus, departureTime: $departureTime, returnTime: $returnTime, distanceMeters: $distanceMeters, durationSeconds: $durationSeconds, routeCompliancePercentage: $routeCompliancePercentage, checkpointsHit: $checkpointsHit, totalCheckpoints: $totalCheckpoints, observations: $observations, capture: $capture, trackPoints: $trackPoints, visitedStops: $visitedStops, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $FleetEntryModelCopyWith<$Res>  {
  factory $FleetEntryModelCopyWith(FleetEntryModel value, $Res Function(FleetEntryModel) _then) = _$FleetEntryModelCopyWithImpl;
@useResult
$Res call({
 String id, String? status, String? vehicleId, String? vehiclePlate, String? routeId, String? routeName, String? driverId, String? driverName, String? driverStatus, String? departureTime, String? returnTime, double? distanceMeters, int? durationSeconds, double? routeCompliancePercentage, int? checkpointsHit, int? totalCheckpoints, String? observations, Map<String, dynamic>? capture, List<Map<String, dynamic>> trackPoints, List<Map<String, dynamic>> visitedStops, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class _$FleetEntryModelCopyWithImpl<$Res>
    implements $FleetEntryModelCopyWith<$Res> {
  _$FleetEntryModelCopyWithImpl(this._self, this._then);

  final FleetEntryModel _self;
  final $Res Function(FleetEntryModel) _then;

/// Create a copy of FleetEntryModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? status = freezed,Object? vehicleId = freezed,Object? vehiclePlate = freezed,Object? routeId = freezed,Object? routeName = freezed,Object? driverId = freezed,Object? driverName = freezed,Object? driverStatus = freezed,Object? departureTime = freezed,Object? returnTime = freezed,Object? distanceMeters = freezed,Object? durationSeconds = freezed,Object? routeCompliancePercentage = freezed,Object? checkpointsHit = freezed,Object? totalCheckpoints = freezed,Object? observations = freezed,Object? capture = freezed,Object? trackPoints = null,Object? visitedStops = null,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,vehicleId: freezed == vehicleId ? _self.vehicleId : vehicleId // ignore: cast_nullable_to_non_nullable
as String?,vehiclePlate: freezed == vehiclePlate ? _self.vehiclePlate : vehiclePlate // ignore: cast_nullable_to_non_nullable
as String?,routeId: freezed == routeId ? _self.routeId : routeId // ignore: cast_nullable_to_non_nullable
as String?,routeName: freezed == routeName ? _self.routeName : routeName // ignore: cast_nullable_to_non_nullable
as String?,driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,driverName: freezed == driverName ? _self.driverName : driverName // ignore: cast_nullable_to_non_nullable
as String?,driverStatus: freezed == driverStatus ? _self.driverStatus : driverStatus // ignore: cast_nullable_to_non_nullable
as String?,departureTime: freezed == departureTime ? _self.departureTime : departureTime // ignore: cast_nullable_to_non_nullable
as String?,returnTime: freezed == returnTime ? _self.returnTime : returnTime // ignore: cast_nullable_to_non_nullable
as String?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,durationSeconds: freezed == durationSeconds ? _self.durationSeconds : durationSeconds // ignore: cast_nullable_to_non_nullable
as int?,routeCompliancePercentage: freezed == routeCompliancePercentage ? _self.routeCompliancePercentage : routeCompliancePercentage // ignore: cast_nullable_to_non_nullable
as double?,checkpointsHit: freezed == checkpointsHit ? _self.checkpointsHit : checkpointsHit // ignore: cast_nullable_to_non_nullable
as int?,totalCheckpoints: freezed == totalCheckpoints ? _self.totalCheckpoints : totalCheckpoints // ignore: cast_nullable_to_non_nullable
as int?,observations: freezed == observations ? _self.observations : observations // ignore: cast_nullable_to_non_nullable
as String?,capture: freezed == capture ? _self.capture : capture // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,trackPoints: null == trackPoints ? _self.trackPoints : trackPoints // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,visitedStops: null == visitedStops ? _self.visitedStops : visitedStops // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [FleetEntryModel].
extension FleetEntryModelPatterns on FleetEntryModel {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FleetEntryModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FleetEntryModel() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FleetEntryModel value)  $default,){
final _that = this;
switch (_that) {
case _FleetEntryModel():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FleetEntryModel value)?  $default,){
final _that = this;
switch (_that) {
case _FleetEntryModel() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String? status,  String? vehicleId,  String? vehiclePlate,  String? routeId,  String? routeName,  String? driverId,  String? driverName,  String? driverStatus,  String? departureTime,  String? returnTime,  double? distanceMeters,  int? durationSeconds,  double? routeCompliancePercentage,  int? checkpointsHit,  int? totalCheckpoints,  String? observations,  Map<String, dynamic>? capture,  List<Map<String, dynamic>> trackPoints,  List<Map<String, dynamic>> visitedStops,  DateTime? createdAt,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FleetEntryModel() when $default != null:
return $default(_that.id,_that.status,_that.vehicleId,_that.vehiclePlate,_that.routeId,_that.routeName,_that.driverId,_that.driverName,_that.driverStatus,_that.departureTime,_that.returnTime,_that.distanceMeters,_that.durationSeconds,_that.routeCompliancePercentage,_that.checkpointsHit,_that.totalCheckpoints,_that.observations,_that.capture,_that.trackPoints,_that.visitedStops,_that.createdAt,_that.updatedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String? status,  String? vehicleId,  String? vehiclePlate,  String? routeId,  String? routeName,  String? driverId,  String? driverName,  String? driverStatus,  String? departureTime,  String? returnTime,  double? distanceMeters,  int? durationSeconds,  double? routeCompliancePercentage,  int? checkpointsHit,  int? totalCheckpoints,  String? observations,  Map<String, dynamic>? capture,  List<Map<String, dynamic>> trackPoints,  List<Map<String, dynamic>> visitedStops,  DateTime? createdAt,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _FleetEntryModel():
return $default(_that.id,_that.status,_that.vehicleId,_that.vehiclePlate,_that.routeId,_that.routeName,_that.driverId,_that.driverName,_that.driverStatus,_that.departureTime,_that.returnTime,_that.distanceMeters,_that.durationSeconds,_that.routeCompliancePercentage,_that.checkpointsHit,_that.totalCheckpoints,_that.observations,_that.capture,_that.trackPoints,_that.visitedStops,_that.createdAt,_that.updatedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String? status,  String? vehicleId,  String? vehiclePlate,  String? routeId,  String? routeName,  String? driverId,  String? driverName,  String? driverStatus,  String? departureTime,  String? returnTime,  double? distanceMeters,  int? durationSeconds,  double? routeCompliancePercentage,  int? checkpointsHit,  int? totalCheckpoints,  String? observations,  Map<String, dynamic>? capture,  List<Map<String, dynamic>> trackPoints,  List<Map<String, dynamic>> visitedStops,  DateTime? createdAt,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _FleetEntryModel() when $default != null:
return $default(_that.id,_that.status,_that.vehicleId,_that.vehiclePlate,_that.routeId,_that.routeName,_that.driverId,_that.driverName,_that.driverStatus,_that.departureTime,_that.returnTime,_that.distanceMeters,_that.durationSeconds,_that.routeCompliancePercentage,_that.checkpointsHit,_that.totalCheckpoints,_that.observations,_that.capture,_that.trackPoints,_that.visitedStops,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FleetEntryModel implements FleetEntryModel {
  const _FleetEntryModel({required this.id, this.status, this.vehicleId, this.vehiclePlate, this.routeId, this.routeName, this.driverId, this.driverName, this.driverStatus, this.departureTime, this.returnTime, this.distanceMeters, this.durationSeconds, this.routeCompliancePercentage, this.checkpointsHit, this.totalCheckpoints, this.observations, final  Map<String, dynamic>? capture, final  List<Map<String, dynamic>> trackPoints = const <Map<String, dynamic>>[], final  List<Map<String, dynamic>> visitedStops = const <Map<String, dynamic>>[], this.createdAt, this.updatedAt}): _capture = capture,_trackPoints = trackPoints,_visitedStops = visitedStops;
  factory _FleetEntryModel.fromJson(Map<String, dynamic> json) => _$FleetEntryModelFromJson(json);

@override final  String id;
@override final  String? status;
// disponible | en_ruta | cerrado | auto_cierre | mantenimiento | fuera_de_servicio
@override final  String? vehicleId;
@override final  String? vehiclePlate;
@override final  String? routeId;
@override final  String? routeName;
@override final  String? driverId;
@override final  String? driverName;
@override final  String? driverStatus;
// apto | riesgo | no_apto
@override final  String? departureTime;
@override final  String? returnTime;
@override final  double? distanceMeters;
@override final  int? durationSeconds;
@override final  double? routeCompliancePercentage;
@override final  int? checkpointsHit;
@override final  int? totalCheckpoints;
@override final  String? observations;
 final  Map<String, dynamic>? _capture;
@override Map<String, dynamic>? get capture {
  final value = _capture;
  if (value == null) return null;
  if (_capture is EqualUnmodifiableMapView) return _capture;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}

// {status: validated|raw|merged|rejected|candidate}
 final  List<Map<String, dynamic>> _trackPoints;
// {status: validated|raw|merged|rejected|candidate}
@override@JsonKey() List<Map<String, dynamic>> get trackPoints {
  if (_trackPoints is EqualUnmodifiableListView) return _trackPoints;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_trackPoints);
}

 final  List<Map<String, dynamic>> _visitedStops;
@override@JsonKey() List<Map<String, dynamic>> get visitedStops {
  if (_visitedStops is EqualUnmodifiableListView) return _visitedStops;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_visitedStops);
}

@override final  DateTime? createdAt;
@override final  DateTime? updatedAt;

/// Create a copy of FleetEntryModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FleetEntryModelCopyWith<_FleetEntryModel> get copyWith => __$FleetEntryModelCopyWithImpl<_FleetEntryModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FleetEntryModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FleetEntryModel&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.vehicleId, vehicleId) || other.vehicleId == vehicleId)&&(identical(other.vehiclePlate, vehiclePlate) || other.vehiclePlate == vehiclePlate)&&(identical(other.routeId, routeId) || other.routeId == routeId)&&(identical(other.routeName, routeName) || other.routeName == routeName)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.driverName, driverName) || other.driverName == driverName)&&(identical(other.driverStatus, driverStatus) || other.driverStatus == driverStatus)&&(identical(other.departureTime, departureTime) || other.departureTime == departureTime)&&(identical(other.returnTime, returnTime) || other.returnTime == returnTime)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.durationSeconds, durationSeconds) || other.durationSeconds == durationSeconds)&&(identical(other.routeCompliancePercentage, routeCompliancePercentage) || other.routeCompliancePercentage == routeCompliancePercentage)&&(identical(other.checkpointsHit, checkpointsHit) || other.checkpointsHit == checkpointsHit)&&(identical(other.totalCheckpoints, totalCheckpoints) || other.totalCheckpoints == totalCheckpoints)&&(identical(other.observations, observations) || other.observations == observations)&&const DeepCollectionEquality().equals(other._capture, _capture)&&const DeepCollectionEquality().equals(other._trackPoints, _trackPoints)&&const DeepCollectionEquality().equals(other._visitedStops, _visitedStops)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,status,vehicleId,vehiclePlate,routeId,routeName,driverId,driverName,driverStatus,departureTime,returnTime,distanceMeters,durationSeconds,routeCompliancePercentage,checkpointsHit,totalCheckpoints,observations,const DeepCollectionEquality().hash(_capture),const DeepCollectionEquality().hash(_trackPoints),const DeepCollectionEquality().hash(_visitedStops),createdAt,updatedAt]);

@override
String toString() {
  return 'FleetEntryModel(id: $id, status: $status, vehicleId: $vehicleId, vehiclePlate: $vehiclePlate, routeId: $routeId, routeName: $routeName, driverId: $driverId, driverName: $driverName, driverStatus: $driverStatus, departureTime: $departureTime, returnTime: $returnTime, distanceMeters: $distanceMeters, durationSeconds: $durationSeconds, routeCompliancePercentage: $routeCompliancePercentage, checkpointsHit: $checkpointsHit, totalCheckpoints: $totalCheckpoints, observations: $observations, capture: $capture, trackPoints: $trackPoints, visitedStops: $visitedStops, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$FleetEntryModelCopyWith<$Res> implements $FleetEntryModelCopyWith<$Res> {
  factory _$FleetEntryModelCopyWith(_FleetEntryModel value, $Res Function(_FleetEntryModel) _then) = __$FleetEntryModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String? status, String? vehicleId, String? vehiclePlate, String? routeId, String? routeName, String? driverId, String? driverName, String? driverStatus, String? departureTime, String? returnTime, double? distanceMeters, int? durationSeconds, double? routeCompliancePercentage, int? checkpointsHit, int? totalCheckpoints, String? observations, Map<String, dynamic>? capture, List<Map<String, dynamic>> trackPoints, List<Map<String, dynamic>> visitedStops, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class __$FleetEntryModelCopyWithImpl<$Res>
    implements _$FleetEntryModelCopyWith<$Res> {
  __$FleetEntryModelCopyWithImpl(this._self, this._then);

  final _FleetEntryModel _self;
  final $Res Function(_FleetEntryModel) _then;

/// Create a copy of FleetEntryModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? status = freezed,Object? vehicleId = freezed,Object? vehiclePlate = freezed,Object? routeId = freezed,Object? routeName = freezed,Object? driverId = freezed,Object? driverName = freezed,Object? driverStatus = freezed,Object? departureTime = freezed,Object? returnTime = freezed,Object? distanceMeters = freezed,Object? durationSeconds = freezed,Object? routeCompliancePercentage = freezed,Object? checkpointsHit = freezed,Object? totalCheckpoints = freezed,Object? observations = freezed,Object? capture = freezed,Object? trackPoints = null,Object? visitedStops = null,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_FleetEntryModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,vehicleId: freezed == vehicleId ? _self.vehicleId : vehicleId // ignore: cast_nullable_to_non_nullable
as String?,vehiclePlate: freezed == vehiclePlate ? _self.vehiclePlate : vehiclePlate // ignore: cast_nullable_to_non_nullable
as String?,routeId: freezed == routeId ? _self.routeId : routeId // ignore: cast_nullable_to_non_nullable
as String?,routeName: freezed == routeName ? _self.routeName : routeName // ignore: cast_nullable_to_non_nullable
as String?,driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,driverName: freezed == driverName ? _self.driverName : driverName // ignore: cast_nullable_to_non_nullable
as String?,driverStatus: freezed == driverStatus ? _self.driverStatus : driverStatus // ignore: cast_nullable_to_non_nullable
as String?,departureTime: freezed == departureTime ? _self.departureTime : departureTime // ignore: cast_nullable_to_non_nullable
as String?,returnTime: freezed == returnTime ? _self.returnTime : returnTime // ignore: cast_nullable_to_non_nullable
as String?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,durationSeconds: freezed == durationSeconds ? _self.durationSeconds : durationSeconds // ignore: cast_nullable_to_non_nullable
as int?,routeCompliancePercentage: freezed == routeCompliancePercentage ? _self.routeCompliancePercentage : routeCompliancePercentage // ignore: cast_nullable_to_non_nullable
as double?,checkpointsHit: freezed == checkpointsHit ? _self.checkpointsHit : checkpointsHit // ignore: cast_nullable_to_non_nullable
as int?,totalCheckpoints: freezed == totalCheckpoints ? _self.totalCheckpoints : totalCheckpoints // ignore: cast_nullable_to_non_nullable
as int?,observations: freezed == observations ? _self.observations : observations // ignore: cast_nullable_to_non_nullable
as String?,capture: freezed == capture ? _self._capture : capture // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,trackPoints: null == trackPoints ? _self._trackPoints : trackPoints // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,visitedStops: null == visitedStops ? _self._visitedStops : visitedStops // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
