// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'appeal_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AppealModel {

 String get id; String? get type;// sanction | inspection | report
 String? get sanctionId; String? get inspectionId; String? get reportId; String? get submitterId; String? get submitterName; String? get reason; String get status;// pendiente | resuelta | rechazada
 String? get resolution; String? get resolvedBy; DateTime? get submittedAt; DateTime? get resolvedAt; DateTime? get createdAt; DateTime? get updatedAt;
/// Create a copy of AppealModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AppealModelCopyWith<AppealModel> get copyWith => _$AppealModelCopyWithImpl<AppealModel>(this as AppealModel, _$identity);

  /// Serializes this AppealModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AppealModel&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.sanctionId, sanctionId) || other.sanctionId == sanctionId)&&(identical(other.inspectionId, inspectionId) || other.inspectionId == inspectionId)&&(identical(other.reportId, reportId) || other.reportId == reportId)&&(identical(other.submitterId, submitterId) || other.submitterId == submitterId)&&(identical(other.submitterName, submitterName) || other.submitterName == submitterName)&&(identical(other.reason, reason) || other.reason == reason)&&(identical(other.status, status) || other.status == status)&&(identical(other.resolution, resolution) || other.resolution == resolution)&&(identical(other.resolvedBy, resolvedBy) || other.resolvedBy == resolvedBy)&&(identical(other.submittedAt, submittedAt) || other.submittedAt == submittedAt)&&(identical(other.resolvedAt, resolvedAt) || other.resolvedAt == resolvedAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,type,sanctionId,inspectionId,reportId,submitterId,submitterName,reason,status,resolution,resolvedBy,submittedAt,resolvedAt,createdAt,updatedAt);

@override
String toString() {
  return 'AppealModel(id: $id, type: $type, sanctionId: $sanctionId, inspectionId: $inspectionId, reportId: $reportId, submitterId: $submitterId, submitterName: $submitterName, reason: $reason, status: $status, resolution: $resolution, resolvedBy: $resolvedBy, submittedAt: $submittedAt, resolvedAt: $resolvedAt, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $AppealModelCopyWith<$Res>  {
  factory $AppealModelCopyWith(AppealModel value, $Res Function(AppealModel) _then) = _$AppealModelCopyWithImpl;
@useResult
$Res call({
 String id, String? type, String? sanctionId, String? inspectionId, String? reportId, String? submitterId, String? submitterName, String? reason, String status, String? resolution, String? resolvedBy, DateTime? submittedAt, DateTime? resolvedAt, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class _$AppealModelCopyWithImpl<$Res>
    implements $AppealModelCopyWith<$Res> {
  _$AppealModelCopyWithImpl(this._self, this._then);

  final AppealModel _self;
  final $Res Function(AppealModel) _then;

/// Create a copy of AppealModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? type = freezed,Object? sanctionId = freezed,Object? inspectionId = freezed,Object? reportId = freezed,Object? submitterId = freezed,Object? submitterName = freezed,Object? reason = freezed,Object? status = null,Object? resolution = freezed,Object? resolvedBy = freezed,Object? submittedAt = freezed,Object? resolvedAt = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String?,sanctionId: freezed == sanctionId ? _self.sanctionId : sanctionId // ignore: cast_nullable_to_non_nullable
as String?,inspectionId: freezed == inspectionId ? _self.inspectionId : inspectionId // ignore: cast_nullable_to_non_nullable
as String?,reportId: freezed == reportId ? _self.reportId : reportId // ignore: cast_nullable_to_non_nullable
as String?,submitterId: freezed == submitterId ? _self.submitterId : submitterId // ignore: cast_nullable_to_non_nullable
as String?,submitterName: freezed == submitterName ? _self.submitterName : submitterName // ignore: cast_nullable_to_non_nullable
as String?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,resolution: freezed == resolution ? _self.resolution : resolution // ignore: cast_nullable_to_non_nullable
as String?,resolvedBy: freezed == resolvedBy ? _self.resolvedBy : resolvedBy // ignore: cast_nullable_to_non_nullable
as String?,submittedAt: freezed == submittedAt ? _self.submittedAt : submittedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,resolvedAt: freezed == resolvedAt ? _self.resolvedAt : resolvedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [AppealModel].
extension AppealModelPatterns on AppealModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AppealModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AppealModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AppealModel value)  $default,){
final _that = this;
switch (_that) {
case _AppealModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AppealModel value)?  $default,){
final _that = this;
switch (_that) {
case _AppealModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String? type,  String? sanctionId,  String? inspectionId,  String? reportId,  String? submitterId,  String? submitterName,  String? reason,  String status,  String? resolution,  String? resolvedBy,  DateTime? submittedAt,  DateTime? resolvedAt,  DateTime? createdAt,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AppealModel() when $default != null:
return $default(_that.id,_that.type,_that.sanctionId,_that.inspectionId,_that.reportId,_that.submitterId,_that.submitterName,_that.reason,_that.status,_that.resolution,_that.resolvedBy,_that.submittedAt,_that.resolvedAt,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String? type,  String? sanctionId,  String? inspectionId,  String? reportId,  String? submitterId,  String? submitterName,  String? reason,  String status,  String? resolution,  String? resolvedBy,  DateTime? submittedAt,  DateTime? resolvedAt,  DateTime? createdAt,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _AppealModel():
return $default(_that.id,_that.type,_that.sanctionId,_that.inspectionId,_that.reportId,_that.submitterId,_that.submitterName,_that.reason,_that.status,_that.resolution,_that.resolvedBy,_that.submittedAt,_that.resolvedAt,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String? type,  String? sanctionId,  String? inspectionId,  String? reportId,  String? submitterId,  String? submitterName,  String? reason,  String status,  String? resolution,  String? resolvedBy,  DateTime? submittedAt,  DateTime? resolvedAt,  DateTime? createdAt,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _AppealModel() when $default != null:
return $default(_that.id,_that.type,_that.sanctionId,_that.inspectionId,_that.reportId,_that.submitterId,_that.submitterName,_that.reason,_that.status,_that.resolution,_that.resolvedBy,_that.submittedAt,_that.resolvedAt,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AppealModel implements AppealModel {
  const _AppealModel({required this.id, this.type, this.sanctionId, this.inspectionId, this.reportId, this.submitterId, this.submitterName, this.reason, this.status = 'pendiente', this.resolution, this.resolvedBy, this.submittedAt, this.resolvedAt, this.createdAt, this.updatedAt});
  factory _AppealModel.fromJson(Map<String, dynamic> json) => _$AppealModelFromJson(json);

@override final  String id;
@override final  String? type;
// sanction | inspection | report
@override final  String? sanctionId;
@override final  String? inspectionId;
@override final  String? reportId;
@override final  String? submitterId;
@override final  String? submitterName;
@override final  String? reason;
@override@JsonKey() final  String status;
// pendiente | resuelta | rechazada
@override final  String? resolution;
@override final  String? resolvedBy;
@override final  DateTime? submittedAt;
@override final  DateTime? resolvedAt;
@override final  DateTime? createdAt;
@override final  DateTime? updatedAt;

/// Create a copy of AppealModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AppealModelCopyWith<_AppealModel> get copyWith => __$AppealModelCopyWithImpl<_AppealModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AppealModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AppealModel&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.sanctionId, sanctionId) || other.sanctionId == sanctionId)&&(identical(other.inspectionId, inspectionId) || other.inspectionId == inspectionId)&&(identical(other.reportId, reportId) || other.reportId == reportId)&&(identical(other.submitterId, submitterId) || other.submitterId == submitterId)&&(identical(other.submitterName, submitterName) || other.submitterName == submitterName)&&(identical(other.reason, reason) || other.reason == reason)&&(identical(other.status, status) || other.status == status)&&(identical(other.resolution, resolution) || other.resolution == resolution)&&(identical(other.resolvedBy, resolvedBy) || other.resolvedBy == resolvedBy)&&(identical(other.submittedAt, submittedAt) || other.submittedAt == submittedAt)&&(identical(other.resolvedAt, resolvedAt) || other.resolvedAt == resolvedAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,type,sanctionId,inspectionId,reportId,submitterId,submitterName,reason,status,resolution,resolvedBy,submittedAt,resolvedAt,createdAt,updatedAt);

@override
String toString() {
  return 'AppealModel(id: $id, type: $type, sanctionId: $sanctionId, inspectionId: $inspectionId, reportId: $reportId, submitterId: $submitterId, submitterName: $submitterName, reason: $reason, status: $status, resolution: $resolution, resolvedBy: $resolvedBy, submittedAt: $submittedAt, resolvedAt: $resolvedAt, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$AppealModelCopyWith<$Res> implements $AppealModelCopyWith<$Res> {
  factory _$AppealModelCopyWith(_AppealModel value, $Res Function(_AppealModel) _then) = __$AppealModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String? type, String? sanctionId, String? inspectionId, String? reportId, String? submitterId, String? submitterName, String? reason, String status, String? resolution, String? resolvedBy, DateTime? submittedAt, DateTime? resolvedAt, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class __$AppealModelCopyWithImpl<$Res>
    implements _$AppealModelCopyWith<$Res> {
  __$AppealModelCopyWithImpl(this._self, this._then);

  final _AppealModel _self;
  final $Res Function(_AppealModel) _then;

/// Create a copy of AppealModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? type = freezed,Object? sanctionId = freezed,Object? inspectionId = freezed,Object? reportId = freezed,Object? submitterId = freezed,Object? submitterName = freezed,Object? reason = freezed,Object? status = null,Object? resolution = freezed,Object? resolvedBy = freezed,Object? submittedAt = freezed,Object? resolvedAt = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_AppealModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String?,sanctionId: freezed == sanctionId ? _self.sanctionId : sanctionId // ignore: cast_nullable_to_non_nullable
as String?,inspectionId: freezed == inspectionId ? _self.inspectionId : inspectionId // ignore: cast_nullable_to_non_nullable
as String?,reportId: freezed == reportId ? _self.reportId : reportId // ignore: cast_nullable_to_non_nullable
as String?,submitterId: freezed == submitterId ? _self.submitterId : submitterId // ignore: cast_nullable_to_non_nullable
as String?,submitterName: freezed == submitterName ? _self.submitterName : submitterName // ignore: cast_nullable_to_non_nullable
as String?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,resolution: freezed == resolution ? _self.resolution : resolution // ignore: cast_nullable_to_non_nullable
as String?,resolvedBy: freezed == resolvedBy ? _self.resolvedBy : resolvedBy // ignore: cast_nullable_to_non_nullable
as String?,submittedAt: freezed == submittedAt ? _self.submittedAt : submittedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,resolvedAt: freezed == resolvedAt ? _self.resolvedAt : resolvedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
