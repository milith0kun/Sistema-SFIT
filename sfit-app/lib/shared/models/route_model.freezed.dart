// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'route_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$RouteModel {

 String get id; String? get code; String? get name; String? get type; String? get status;@JsonKey(name: 'length') String? get lengthLabel; int? get stops; String? get municipalityId; String? get siblingRouteId; List<Map<String, dynamic>> get waypoints; DateTime? get createdAt; DateTime? get updatedAt;
/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RouteModelCopyWith<RouteModel> get copyWith => _$RouteModelCopyWithImpl<RouteModel>(this as RouteModel, _$identity);

  /// Serializes this RouteModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RouteModel&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.name, name) || other.name == name)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.lengthLabel, lengthLabel) || other.lengthLabel == lengthLabel)&&(identical(other.stops, stops) || other.stops == stops)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.siblingRouteId, siblingRouteId) || other.siblingRouteId == siblingRouteId)&&const DeepCollectionEquality().equals(other.waypoints, waypoints)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,name,type,status,lengthLabel,stops,municipalityId,siblingRouteId,const DeepCollectionEquality().hash(waypoints),createdAt,updatedAt);

@override
String toString() {
  return 'RouteModel(id: $id, code: $code, name: $name, type: $type, status: $status, lengthLabel: $lengthLabel, stops: $stops, municipalityId: $municipalityId, siblingRouteId: $siblingRouteId, waypoints: $waypoints, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $RouteModelCopyWith<$Res>  {
  factory $RouteModelCopyWith(RouteModel value, $Res Function(RouteModel) _then) = _$RouteModelCopyWithImpl;
@useResult
$Res call({
 String id, String? code, String? name, String? type, String? status,@JsonKey(name: 'length') String? lengthLabel, int? stops, String? municipalityId, String? siblingRouteId, List<Map<String, dynamic>> waypoints, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class _$RouteModelCopyWithImpl<$Res>
    implements $RouteModelCopyWith<$Res> {
  _$RouteModelCopyWithImpl(this._self, this._then);

  final RouteModel _self;
  final $Res Function(RouteModel) _then;

/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? code = freezed,Object? name = freezed,Object? type = freezed,Object? status = freezed,Object? lengthLabel = freezed,Object? stops = freezed,Object? municipalityId = freezed,Object? siblingRouteId = freezed,Object? waypoints = null,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: freezed == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String?,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String?,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,lengthLabel: freezed == lengthLabel ? _self.lengthLabel : lengthLabel // ignore: cast_nullable_to_non_nullable
as String?,stops: freezed == stops ? _self.stops : stops // ignore: cast_nullable_to_non_nullable
as int?,municipalityId: freezed == municipalityId ? _self.municipalityId : municipalityId // ignore: cast_nullable_to_non_nullable
as String?,siblingRouteId: freezed == siblingRouteId ? _self.siblingRouteId : siblingRouteId // ignore: cast_nullable_to_non_nullable
as String?,waypoints: null == waypoints ? _self.waypoints : waypoints // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [RouteModel].
extension RouteModelPatterns on RouteModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RouteModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RouteModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RouteModel value)  $default,){
final _that = this;
switch (_that) {
case _RouteModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RouteModel value)?  $default,){
final _that = this;
switch (_that) {
case _RouteModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String? code,  String? name,  String? type,  String? status, @JsonKey(name: 'length')  String? lengthLabel,  int? stops,  String? municipalityId,  String? siblingRouteId,  List<Map<String, dynamic>> waypoints,  DateTime? createdAt,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RouteModel() when $default != null:
return $default(_that.id,_that.code,_that.name,_that.type,_that.status,_that.lengthLabel,_that.stops,_that.municipalityId,_that.siblingRouteId,_that.waypoints,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String? code,  String? name,  String? type,  String? status, @JsonKey(name: 'length')  String? lengthLabel,  int? stops,  String? municipalityId,  String? siblingRouteId,  List<Map<String, dynamic>> waypoints,  DateTime? createdAt,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _RouteModel():
return $default(_that.id,_that.code,_that.name,_that.type,_that.status,_that.lengthLabel,_that.stops,_that.municipalityId,_that.siblingRouteId,_that.waypoints,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String? code,  String? name,  String? type,  String? status, @JsonKey(name: 'length')  String? lengthLabel,  int? stops,  String? municipalityId,  String? siblingRouteId,  List<Map<String, dynamic>> waypoints,  DateTime? createdAt,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _RouteModel() when $default != null:
return $default(_that.id,_that.code,_that.name,_that.type,_that.status,_that.lengthLabel,_that.stops,_that.municipalityId,_that.siblingRouteId,_that.waypoints,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RouteModel implements RouteModel {
  const _RouteModel({required this.id, this.code, this.name, this.type, this.status, @JsonKey(name: 'length') this.lengthLabel, this.stops, this.municipalityId, this.siblingRouteId, final  List<Map<String, dynamic>> waypoints = const <Map<String, dynamic>>[], this.createdAt, this.updatedAt}): _waypoints = waypoints;
  factory _RouteModel.fromJson(Map<String, dynamic> json) => _$RouteModelFromJson(json);

@override final  String id;
@override final  String? code;
@override final  String? name;
@override final  String? type;
@override final  String? status;
@override@JsonKey(name: 'length') final  String? lengthLabel;
@override final  int? stops;
@override final  String? municipalityId;
@override final  String? siblingRouteId;
 final  List<Map<String, dynamic>> _waypoints;
@override@JsonKey() List<Map<String, dynamic>> get waypoints {
  if (_waypoints is EqualUnmodifiableListView) return _waypoints;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_waypoints);
}

@override final  DateTime? createdAt;
@override final  DateTime? updatedAt;

/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RouteModelCopyWith<_RouteModel> get copyWith => __$RouteModelCopyWithImpl<_RouteModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RouteModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RouteModel&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.name, name) || other.name == name)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.lengthLabel, lengthLabel) || other.lengthLabel == lengthLabel)&&(identical(other.stops, stops) || other.stops == stops)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.siblingRouteId, siblingRouteId) || other.siblingRouteId == siblingRouteId)&&const DeepCollectionEquality().equals(other._waypoints, _waypoints)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,name,type,status,lengthLabel,stops,municipalityId,siblingRouteId,const DeepCollectionEquality().hash(_waypoints),createdAt,updatedAt);

@override
String toString() {
  return 'RouteModel(id: $id, code: $code, name: $name, type: $type, status: $status, lengthLabel: $lengthLabel, stops: $stops, municipalityId: $municipalityId, siblingRouteId: $siblingRouteId, waypoints: $waypoints, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$RouteModelCopyWith<$Res> implements $RouteModelCopyWith<$Res> {
  factory _$RouteModelCopyWith(_RouteModel value, $Res Function(_RouteModel) _then) = __$RouteModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String? code, String? name, String? type, String? status,@JsonKey(name: 'length') String? lengthLabel, int? stops, String? municipalityId, String? siblingRouteId, List<Map<String, dynamic>> waypoints, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class __$RouteModelCopyWithImpl<$Res>
    implements _$RouteModelCopyWith<$Res> {
  __$RouteModelCopyWithImpl(this._self, this._then);

  final _RouteModel _self;
  final $Res Function(_RouteModel) _then;

/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? code = freezed,Object? name = freezed,Object? type = freezed,Object? status = freezed,Object? lengthLabel = freezed,Object? stops = freezed,Object? municipalityId = freezed,Object? siblingRouteId = freezed,Object? waypoints = null,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_RouteModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: freezed == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String?,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String?,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,lengthLabel: freezed == lengthLabel ? _self.lengthLabel : lengthLabel // ignore: cast_nullable_to_non_nullable
as String?,stops: freezed == stops ? _self.stops : stops // ignore: cast_nullable_to_non_nullable
as int?,municipalityId: freezed == municipalityId ? _self.municipalityId : municipalityId // ignore: cast_nullable_to_non_nullable
as String?,siblingRouteId: freezed == siblingRouteId ? _self.siblingRouteId : siblingRouteId // ignore: cast_nullable_to_non_nullable
as String?,waypoints: null == waypoints ? _self._waypoints : waypoints // ignore: cast_nullable_to_non_nullable
as List<Map<String, dynamic>>,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
