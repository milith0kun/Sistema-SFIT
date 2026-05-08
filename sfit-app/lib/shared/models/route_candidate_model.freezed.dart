// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'route_candidate_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$RouteCandidateModel {

 String get id; String? get status; String? get suggestedName; String? get municipalityId; String? get assignedRouteId; String? get dismissedReason; String? get validatedRouteId; int? get sampleCount; double? get distanceMeters; double? get avgConfidence; List<Map<String, dynamic>> get points; List<Map<String, dynamic>> get detectedStops; DateTime? get createdAt; DateTime? get updatedAt;
/// Create a copy of RouteCandidateModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RouteCandidateModelCopyWith<RouteCandidateModel> get copyWith => _$RouteCandidateModelCopyWithImpl<RouteCandidateModel>(this as RouteCandidateModel, _$identity);

  /// Serializes this RouteCandidateModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RouteCandidateModel&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.suggestedName, suggestedName) || other.suggestedName == suggestedName)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.assignedRouteId, assignedRouteId) || other.assignedRouteId == assignedRouteId)&&(identical(other.dismissedReason, dismissedReason) || other.dismissedReason == dismissedReason)&&(identical(other.validatedRouteId, validatedRouteId) || other.validatedRouteId == validatedRouteId)&&(identical(other.sampleCount, sampleCount) || other.sampleCount == sampleCount)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.avgConfidence, avgConfidence) || other.avgConfidence == avgConfidence)&&const DeepCollectionEquality().equals(other.points, points)&&const DeepCollectionEquality().equals(other.detectedStops, detectedStops)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,suggestedName,municipalityId,assignedRouteId,dismissedReason,validatedRouteId,sampleCount,distanceMeters,avgConfidence,const DeepCollectionEquality().hash(points),const DeepCollectionEquality().hash(detectedStops),createdAt,updatedAt);

@override
String toString() {
  return 'RouteCandidateModel(id: $id, status: $status, suggestedName: $suggestedName, municipalityId: $municipalityId, assignedRouteId: $assignedRouteId, dismissedReason: $dismissedReason, validatedRouteId: $validatedRouteId, sampleCount: $sampleCount, distanceMeters: $distanceMeters, avgConfidence: $avgConfidence, points: $points, detectedStops: $detectedStops, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $RouteCandidateModelCopyWith<$Res>  {
  factory $RouteCandidateModelCopyWith(RouteCandidateModel value, $Res Function(RouteCandidateModel) _then) = _$RouteCandidateModelCopyWithImpl;
@useResult
$Res call({
 String id, String? status, String? suggestedName, String? municipalityId, String? assignedRouteId, String? dismissedReason, String? validatedRouteId, int? sampleCount, double? distanceMeters, double? avgConfidence, List<Map<String, dynamic>> points, List<Map<String, dynamic>> detectedStops, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class _$RouteCandidateModelCopyWithImpl<$Res>
    implements $RouteCandidateModelCopyWith<$Res> {
  _$RouteCandidateModelCopyWithImpl(this._self, this._then);

  final RouteCandidateModel _self;
  final $Res Function(RouteCandidateModel) _then;

/// Create a copy of RouteCandidateModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? status = freezed,Object? suggestedName = freezed,Object? municipalityId = freezed,Object? assignedRouteId = freezed,Object? dismissedReason = freezed,Object? validatedRouteId = freezed,Object? sampleCount = freezed,Object? distanceMeters = freezed,Object? avgConfidence = freezed,Object? points = null,Object? detectedStops = null,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,suggestedName: freezed == suggestedName ? _self.suggestedName : suggestedName // ignore: cast_nullable_to_non_nullable
as String?,municipalityId: freezed == municipalityId ? _self.municipalityId : municipalityId // ignore: cast_nullable_to_non_nullable
as String?,assignedRouteId: freezed == assignedRouteId ? _self.assignedRouteId : assignedRouteId // ignore: cast_nullable_to_non_nullable
as String?,dismissedReason: freezed == dismissedReason ? _self.dismissedReason : dismissedReason // ignore: cast_nullable_to_non_nullable
as String?,validatedRouteId: freezed == validatedRouteId ? _self.validatedRouteId : validatedRouteId // ignore: cast_nullable_to_non_nullable
as String?,sampleCount: freezed == sampleCount ? _self.sampleCount : sampleCount // ignore: cast_nullable_to_non_nullable
as int?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,avgConfidence: freezed == avgConfidence ? _self.avgConfidence : avgConfidence // ignore: cast_nullable_to_non_nullable
as double?,points: null == points ? _self.points : points // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,detectedStops: null == detectedStops ? _self.detectedStops : detectedStops // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [RouteCandidateModel].
extension RouteCandidateModelPatterns on RouteCandidateModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RouteCandidateModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RouteCandidateModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RouteCandidateModel value)  $default,){
final _that = this;
switch (_that) {
case _RouteCandidateModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RouteCandidateModel value)?  $default,){
final _that = this;
switch (_that) {
case _RouteCandidateModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String? status,  String? suggestedName,  String? municipalityId,  String? assignedRouteId,  String? dismissedReason,  String? validatedRouteId,  int? sampleCount,  double? distanceMeters,  double? avgConfidence,  List<Map<String, dynamic>> points,  List<Map<String, dynamic>> detectedStops,  DateTime? createdAt,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RouteCandidateModel() when $default != null:
return $default(_that.id,_that.status,_that.suggestedName,_that.municipalityId,_that.assignedRouteId,_that.dismissedReason,_that.validatedRouteId,_that.sampleCount,_that.distanceMeters,_that.avgConfidence,_that.points,_that.detectedStops,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String? status,  String? suggestedName,  String? municipalityId,  String? assignedRouteId,  String? dismissedReason,  String? validatedRouteId,  int? sampleCount,  double? distanceMeters,  double? avgConfidence,  List<Map<String, dynamic>> points,  List<Map<String, dynamic>> detectedStops,  DateTime? createdAt,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _RouteCandidateModel():
return $default(_that.id,_that.status,_that.suggestedName,_that.municipalityId,_that.assignedRouteId,_that.dismissedReason,_that.validatedRouteId,_that.sampleCount,_that.distanceMeters,_that.avgConfidence,_that.points,_that.detectedStops,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String? status,  String? suggestedName,  String? municipalityId,  String? assignedRouteId,  String? dismissedReason,  String? validatedRouteId,  int? sampleCount,  double? distanceMeters,  double? avgConfidence,  List<Map<String, dynamic>> points,  List<Map<String, dynamic>> detectedStops,  DateTime? createdAt,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _RouteCandidateModel() when $default != null:
return $default(_that.id,_that.status,_that.suggestedName,_that.municipalityId,_that.assignedRouteId,_that.dismissedReason,_that.validatedRouteId,_that.sampleCount,_that.distanceMeters,_that.avgConfidence,_that.points,_that.detectedStops,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RouteCandidateModel implements RouteCandidateModel {
  const _RouteCandidateModel({required this.id, this.status, this.suggestedName, this.municipalityId, this.assignedRouteId, this.dismissedReason, this.validatedRouteId, this.sampleCount, this.distanceMeters, this.avgConfidence, final  List<Map<String, dynamic>> points = const <Map<String, dynamic>>[], final  List<Map<String, dynamic>> detectedStops = const <Map<String, dynamic>>[], this.createdAt, this.updatedAt}): _points = points,_detectedStops = detectedStops;
  factory _RouteCandidateModel.fromJson(Map<String, dynamic> json) => _$RouteCandidateModelFromJson(json);

@override final  String id;
@override final  String? status;
@override final  String? suggestedName;
@override final  String? municipalityId;
@override final  String? assignedRouteId;
@override final  String? dismissedReason;
@override final  String? validatedRouteId;
@override final  int? sampleCount;
@override final  double? distanceMeters;
@override final  double? avgConfidence;
 final  List<Map<String, dynamic>> _points;
@override@JsonKey() List<Map<String, dynamic>> get points {
  if (_points is EqualUnmodifiableListView) return _points;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_points);
}

 final  List<Map<String, dynamic>> _detectedStops;
@override@JsonKey() List<Map<String, dynamic>> get detectedStops {
  if (_detectedStops is EqualUnmodifiableListView) return _detectedStops;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_detectedStops);
}

@override final  DateTime? createdAt;
@override final  DateTime? updatedAt;

/// Create a copy of RouteCandidateModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RouteCandidateModelCopyWith<_RouteCandidateModel> get copyWith => __$RouteCandidateModelCopyWithImpl<_RouteCandidateModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RouteCandidateModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RouteCandidateModel&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.suggestedName, suggestedName) || other.suggestedName == suggestedName)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.assignedRouteId, assignedRouteId) || other.assignedRouteId == assignedRouteId)&&(identical(other.dismissedReason, dismissedReason) || other.dismissedReason == dismissedReason)&&(identical(other.validatedRouteId, validatedRouteId) || other.validatedRouteId == validatedRouteId)&&(identical(other.sampleCount, sampleCount) || other.sampleCount == sampleCount)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.avgConfidence, avgConfidence) || other.avgConfidence == avgConfidence)&&const DeepCollectionEquality().equals(other._points, _points)&&const DeepCollectionEquality().equals(other._detectedStops, _detectedStops)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,suggestedName,municipalityId,assignedRouteId,dismissedReason,validatedRouteId,sampleCount,distanceMeters,avgConfidence,const DeepCollectionEquality().hash(_points),const DeepCollectionEquality().hash(_detectedStops),createdAt,updatedAt);

@override
String toString() {
  return 'RouteCandidateModel(id: $id, status: $status, suggestedName: $suggestedName, municipalityId: $municipalityId, assignedRouteId: $assignedRouteId, dismissedReason: $dismissedReason, validatedRouteId: $validatedRouteId, sampleCount: $sampleCount, distanceMeters: $distanceMeters, avgConfidence: $avgConfidence, points: $points, detectedStops: $detectedStops, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$RouteCandidateModelCopyWith<$Res> implements $RouteCandidateModelCopyWith<$Res> {
  factory _$RouteCandidateModelCopyWith(_RouteCandidateModel value, $Res Function(_RouteCandidateModel) _then) = __$RouteCandidateModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String? status, String? suggestedName, String? municipalityId, String? assignedRouteId, String? dismissedReason, String? validatedRouteId, int? sampleCount, double? distanceMeters, double? avgConfidence, List<Map<String, dynamic>> points, List<Map<String, dynamic>> detectedStops, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class __$RouteCandidateModelCopyWithImpl<$Res>
    implements _$RouteCandidateModelCopyWith<$Res> {
  __$RouteCandidateModelCopyWithImpl(this._self, this._then);

  final _RouteCandidateModel _self;
  final $Res Function(_RouteCandidateModel) _then;

/// Create a copy of RouteCandidateModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? status = freezed,Object? suggestedName = freezed,Object? municipalityId = freezed,Object? assignedRouteId = freezed,Object? dismissedReason = freezed,Object? validatedRouteId = freezed,Object? sampleCount = freezed,Object? distanceMeters = freezed,Object? avgConfidence = freezed,Object? points = null,Object? detectedStops = null,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_RouteCandidateModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,suggestedName: freezed == suggestedName ? _self.suggestedName : suggestedName // ignore: cast_nullable_to_non_nullable
as String?,municipalityId: freezed == municipalityId ? _self.municipalityId : municipalityId // ignore: cast_nullable_to_non_nullable
as String?,assignedRouteId: freezed == assignedRouteId ? _self.assignedRouteId : assignedRouteId // ignore: cast_nullable_to_non_nullable
as String?,dismissedReason: freezed == dismissedReason ? _self.dismissedReason : dismissedReason // ignore: cast_nullable_to_non_nullable
as String?,validatedRouteId: freezed == validatedRouteId ? _self.validatedRouteId : validatedRouteId // ignore: cast_nullable_to_non_nullable
as String?,sampleCount: freezed == sampleCount ? _self.sampleCount : sampleCount // ignore: cast_nullable_to_non_nullable
as int?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,avgConfidence: freezed == avgConfidence ? _self.avgConfidence : avgConfidence // ignore: cast_nullable_to_non_nullable
as double?,points: null == points ? _self._points : points // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,detectedStops: null == detectedStops ? _self._detectedStops : detectedStops // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
