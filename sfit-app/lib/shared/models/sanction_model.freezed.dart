// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'sanction_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SanctionModel {

 String get id; String? get vehicleId; String? get vehiclePlate; String? get driverId; String? get driverName; String? get faultType; String? get description; num? get amountSoles; num? get amountUIT; String get status;// vigente | apelada | anulada | pagada
 String? get annulmentReason; String? get issuedBy; DateTime? get issuedAt; DateTime? get createdAt; DateTime? get updatedAt;
/// Create a copy of SanctionModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SanctionModelCopyWith<SanctionModel> get copyWith => _$SanctionModelCopyWithImpl<SanctionModel>(this as SanctionModel, _$identity);

  /// Serializes this SanctionModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SanctionModel&&(identical(other.id, id) || other.id == id)&&(identical(other.vehicleId, vehicleId) || other.vehicleId == vehicleId)&&(identical(other.vehiclePlate, vehiclePlate) || other.vehiclePlate == vehiclePlate)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.driverName, driverName) || other.driverName == driverName)&&(identical(other.faultType, faultType) || other.faultType == faultType)&&(identical(other.description, description) || other.description == description)&&(identical(other.amountSoles, amountSoles) || other.amountSoles == amountSoles)&&(identical(other.amountUIT, amountUIT) || other.amountUIT == amountUIT)&&(identical(other.status, status) || other.status == status)&&(identical(other.annulmentReason, annulmentReason) || other.annulmentReason == annulmentReason)&&(identical(other.issuedBy, issuedBy) || other.issuedBy == issuedBy)&&(identical(other.issuedAt, issuedAt) || other.issuedAt == issuedAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,vehicleId,vehiclePlate,driverId,driverName,faultType,description,amountSoles,amountUIT,status,annulmentReason,issuedBy,issuedAt,createdAt,updatedAt);

@override
String toString() {
  return 'SanctionModel(id: $id, vehicleId: $vehicleId, vehiclePlate: $vehiclePlate, driverId: $driverId, driverName: $driverName, faultType: $faultType, description: $description, amountSoles: $amountSoles, amountUIT: $amountUIT, status: $status, annulmentReason: $annulmentReason, issuedBy: $issuedBy, issuedAt: $issuedAt, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $SanctionModelCopyWith<$Res>  {
  factory $SanctionModelCopyWith(SanctionModel value, $Res Function(SanctionModel) _then) = _$SanctionModelCopyWithImpl;
@useResult
$Res call({
 String id, String? vehicleId, String? vehiclePlate, String? driverId, String? driverName, String? faultType, String? description, num? amountSoles, num? amountUIT, String status, String? annulmentReason, String? issuedBy, DateTime? issuedAt, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class _$SanctionModelCopyWithImpl<$Res>
    implements $SanctionModelCopyWith<$Res> {
  _$SanctionModelCopyWithImpl(this._self, this._then);

  final SanctionModel _self;
  final $Res Function(SanctionModel) _then;

/// Create a copy of SanctionModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? vehicleId = freezed,Object? vehiclePlate = freezed,Object? driverId = freezed,Object? driverName = freezed,Object? faultType = freezed,Object? description = freezed,Object? amountSoles = freezed,Object? amountUIT = freezed,Object? status = null,Object? annulmentReason = freezed,Object? issuedBy = freezed,Object? issuedAt = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,vehicleId: freezed == vehicleId ? _self.vehicleId : vehicleId // ignore: cast_nullable_to_non_nullable
as String?,vehiclePlate: freezed == vehiclePlate ? _self.vehiclePlate : vehiclePlate // ignore: cast_nullable_to_non_nullable
as String?,driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,driverName: freezed == driverName ? _self.driverName : driverName // ignore: cast_nullable_to_non_nullable
as String?,faultType: freezed == faultType ? _self.faultType : faultType // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,amountSoles: freezed == amountSoles ? _self.amountSoles : amountSoles // ignore: cast_nullable_to_non_nullable
as num?,amountUIT: freezed == amountUIT ? _self.amountUIT : amountUIT // ignore: cast_nullable_to_non_nullable
as num?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,annulmentReason: freezed == annulmentReason ? _self.annulmentReason : annulmentReason // ignore: cast_nullable_to_non_nullable
as String?,issuedBy: freezed == issuedBy ? _self.issuedBy : issuedBy // ignore: cast_nullable_to_non_nullable
as String?,issuedAt: freezed == issuedAt ? _self.issuedAt : issuedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [SanctionModel].
extension SanctionModelPatterns on SanctionModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SanctionModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SanctionModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SanctionModel value)  $default,){
final _that = this;
switch (_that) {
case _SanctionModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SanctionModel value)?  $default,){
final _that = this;
switch (_that) {
case _SanctionModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String? vehicleId,  String? vehiclePlate,  String? driverId,  String? driverName,  String? faultType,  String? description,  num? amountSoles,  num? amountUIT,  String status,  String? annulmentReason,  String? issuedBy,  DateTime? issuedAt,  DateTime? createdAt,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SanctionModel() when $default != null:
return $default(_that.id,_that.vehicleId,_that.vehiclePlate,_that.driverId,_that.driverName,_that.faultType,_that.description,_that.amountSoles,_that.amountUIT,_that.status,_that.annulmentReason,_that.issuedBy,_that.issuedAt,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String? vehicleId,  String? vehiclePlate,  String? driverId,  String? driverName,  String? faultType,  String? description,  num? amountSoles,  num? amountUIT,  String status,  String? annulmentReason,  String? issuedBy,  DateTime? issuedAt,  DateTime? createdAt,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _SanctionModel():
return $default(_that.id,_that.vehicleId,_that.vehiclePlate,_that.driverId,_that.driverName,_that.faultType,_that.description,_that.amountSoles,_that.amountUIT,_that.status,_that.annulmentReason,_that.issuedBy,_that.issuedAt,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String? vehicleId,  String? vehiclePlate,  String? driverId,  String? driverName,  String? faultType,  String? description,  num? amountSoles,  num? amountUIT,  String status,  String? annulmentReason,  String? issuedBy,  DateTime? issuedAt,  DateTime? createdAt,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _SanctionModel() when $default != null:
return $default(_that.id,_that.vehicleId,_that.vehiclePlate,_that.driverId,_that.driverName,_that.faultType,_that.description,_that.amountSoles,_that.amountUIT,_that.status,_that.annulmentReason,_that.issuedBy,_that.issuedAt,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SanctionModel implements SanctionModel {
  const _SanctionModel({required this.id, this.vehicleId, this.vehiclePlate, this.driverId, this.driverName, this.faultType, this.description, this.amountSoles, this.amountUIT, this.status = 'vigente', this.annulmentReason, this.issuedBy, this.issuedAt, this.createdAt, this.updatedAt});
  factory _SanctionModel.fromJson(Map<String, dynamic> json) => _$SanctionModelFromJson(json);

@override final  String id;
@override final  String? vehicleId;
@override final  String? vehiclePlate;
@override final  String? driverId;
@override final  String? driverName;
@override final  String? faultType;
@override final  String? description;
@override final  num? amountSoles;
@override final  num? amountUIT;
@override@JsonKey() final  String status;
// vigente | apelada | anulada | pagada
@override final  String? annulmentReason;
@override final  String? issuedBy;
@override final  DateTime? issuedAt;
@override final  DateTime? createdAt;
@override final  DateTime? updatedAt;

/// Create a copy of SanctionModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SanctionModelCopyWith<_SanctionModel> get copyWith => __$SanctionModelCopyWithImpl<_SanctionModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SanctionModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SanctionModel&&(identical(other.id, id) || other.id == id)&&(identical(other.vehicleId, vehicleId) || other.vehicleId == vehicleId)&&(identical(other.vehiclePlate, vehiclePlate) || other.vehiclePlate == vehiclePlate)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.driverName, driverName) || other.driverName == driverName)&&(identical(other.faultType, faultType) || other.faultType == faultType)&&(identical(other.description, description) || other.description == description)&&(identical(other.amountSoles, amountSoles) || other.amountSoles == amountSoles)&&(identical(other.amountUIT, amountUIT) || other.amountUIT == amountUIT)&&(identical(other.status, status) || other.status == status)&&(identical(other.annulmentReason, annulmentReason) || other.annulmentReason == annulmentReason)&&(identical(other.issuedBy, issuedBy) || other.issuedBy == issuedBy)&&(identical(other.issuedAt, issuedAt) || other.issuedAt == issuedAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,vehicleId,vehiclePlate,driverId,driverName,faultType,description,amountSoles,amountUIT,status,annulmentReason,issuedBy,issuedAt,createdAt,updatedAt);

@override
String toString() {
  return 'SanctionModel(id: $id, vehicleId: $vehicleId, vehiclePlate: $vehiclePlate, driverId: $driverId, driverName: $driverName, faultType: $faultType, description: $description, amountSoles: $amountSoles, amountUIT: $amountUIT, status: $status, annulmentReason: $annulmentReason, issuedBy: $issuedBy, issuedAt: $issuedAt, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$SanctionModelCopyWith<$Res> implements $SanctionModelCopyWith<$Res> {
  factory _$SanctionModelCopyWith(_SanctionModel value, $Res Function(_SanctionModel) _then) = __$SanctionModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String? vehicleId, String? vehiclePlate, String? driverId, String? driverName, String? faultType, String? description, num? amountSoles, num? amountUIT, String status, String? annulmentReason, String? issuedBy, DateTime? issuedAt, DateTime? createdAt, DateTime? updatedAt
});




}
/// @nodoc
class __$SanctionModelCopyWithImpl<$Res>
    implements _$SanctionModelCopyWith<$Res> {
  __$SanctionModelCopyWithImpl(this._self, this._then);

  final _SanctionModel _self;
  final $Res Function(_SanctionModel) _then;

/// Create a copy of SanctionModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? vehicleId = freezed,Object? vehiclePlate = freezed,Object? driverId = freezed,Object? driverName = freezed,Object? faultType = freezed,Object? description = freezed,Object? amountSoles = freezed,Object? amountUIT = freezed,Object? status = null,Object? annulmentReason = freezed,Object? issuedBy = freezed,Object? issuedAt = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_SanctionModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,vehicleId: freezed == vehicleId ? _self.vehicleId : vehicleId // ignore: cast_nullable_to_non_nullable
as String?,vehiclePlate: freezed == vehiclePlate ? _self.vehiclePlate : vehiclePlate // ignore: cast_nullable_to_non_nullable
as String?,driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,driverName: freezed == driverName ? _self.driverName : driverName // ignore: cast_nullable_to_non_nullable
as String?,faultType: freezed == faultType ? _self.faultType : faultType // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,amountSoles: freezed == amountSoles ? _self.amountSoles : amountSoles // ignore: cast_nullable_to_non_nullable
as num?,amountUIT: freezed == amountUIT ? _self.amountUIT : amountUIT // ignore: cast_nullable_to_non_nullable
as num?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,annulmentReason: freezed == annulmentReason ? _self.annulmentReason : annulmentReason // ignore: cast_nullable_to_non_nullable
as String?,issuedBy: freezed == issuedBy ? _self.issuedBy : issuedBy // ignore: cast_nullable_to_non_nullable
as String?,issuedAt: freezed == issuedAt ? _self.issuedAt : issuedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
