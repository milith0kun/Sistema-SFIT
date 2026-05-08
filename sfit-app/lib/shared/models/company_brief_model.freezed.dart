// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'company_brief_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CompanyBriefModel {

 String get id; String get razonSocial; String? get ruc; String? get municipalityName; String? get municipalityId; String? get estado;
/// Create a copy of CompanyBriefModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CompanyBriefModelCopyWith<CompanyBriefModel> get copyWith => _$CompanyBriefModelCopyWithImpl<CompanyBriefModel>(this as CompanyBriefModel, _$identity);

  /// Serializes this CompanyBriefModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CompanyBriefModel&&(identical(other.id, id) || other.id == id)&&(identical(other.razonSocial, razonSocial) || other.razonSocial == razonSocial)&&(identical(other.ruc, ruc) || other.ruc == ruc)&&(identical(other.municipalityName, municipalityName) || other.municipalityName == municipalityName)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.estado, estado) || other.estado == estado));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,razonSocial,ruc,municipalityName,municipalityId,estado);

@override
String toString() {
  return 'CompanyBriefModel(id: $id, razonSocial: $razonSocial, ruc: $ruc, municipalityName: $municipalityName, municipalityId: $municipalityId, estado: $estado)';
}


}

/// @nodoc
abstract mixin class $CompanyBriefModelCopyWith<$Res>  {
  factory $CompanyBriefModelCopyWith(CompanyBriefModel value, $Res Function(CompanyBriefModel) _then) = _$CompanyBriefModelCopyWithImpl;
@useResult
$Res call({
 String id, String razonSocial, String? ruc, String? municipalityName, String? municipalityId, String? estado
});




}
/// @nodoc
class _$CompanyBriefModelCopyWithImpl<$Res>
    implements $CompanyBriefModelCopyWith<$Res> {
  _$CompanyBriefModelCopyWithImpl(this._self, this._then);

  final CompanyBriefModel _self;
  final $Res Function(CompanyBriefModel) _then;

/// Create a copy of CompanyBriefModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? razonSocial = null,Object? ruc = freezed,Object? municipalityName = freezed,Object? municipalityId = freezed,Object? estado = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,razonSocial: null == razonSocial ? _self.razonSocial : razonSocial // ignore: cast_nullable_to_non_nullable
as String,ruc: freezed == ruc ? _self.ruc : ruc // ignore: cast_nullable_to_non_nullable
as String?,municipalityName: freezed == municipalityName ? _self.municipalityName : municipalityName // ignore: cast_nullable_to_non_nullable
as String?,municipalityId: freezed == municipalityId ? _self.municipalityId : municipalityId // ignore: cast_nullable_to_non_nullable
as String?,estado: freezed == estado ? _self.estado : estado // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CompanyBriefModel].
extension CompanyBriefModelPatterns on CompanyBriefModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CompanyBriefModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CompanyBriefModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CompanyBriefModel value)  $default,){
final _that = this;
switch (_that) {
case _CompanyBriefModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CompanyBriefModel value)?  $default,){
final _that = this;
switch (_that) {
case _CompanyBriefModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String razonSocial,  String? ruc,  String? municipalityName,  String? municipalityId,  String? estado)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CompanyBriefModel() when $default != null:
return $default(_that.id,_that.razonSocial,_that.ruc,_that.municipalityName,_that.municipalityId,_that.estado);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String razonSocial,  String? ruc,  String? municipalityName,  String? municipalityId,  String? estado)  $default,) {final _that = this;
switch (_that) {
case _CompanyBriefModel():
return $default(_that.id,_that.razonSocial,_that.ruc,_that.municipalityName,_that.municipalityId,_that.estado);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String razonSocial,  String? ruc,  String? municipalityName,  String? municipalityId,  String? estado)?  $default,) {final _that = this;
switch (_that) {
case _CompanyBriefModel() when $default != null:
return $default(_that.id,_that.razonSocial,_that.ruc,_that.municipalityName,_that.municipalityId,_that.estado);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CompanyBriefModel implements CompanyBriefModel {
  const _CompanyBriefModel({required this.id, required this.razonSocial, this.ruc, this.municipalityName, this.municipalityId, this.estado});
  factory _CompanyBriefModel.fromJson(Map<String, dynamic> json) => _$CompanyBriefModelFromJson(json);

@override final  String id;
@override final  String razonSocial;
@override final  String? ruc;
@override final  String? municipalityName;
@override final  String? municipalityId;
@override final  String? estado;

/// Create a copy of CompanyBriefModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CompanyBriefModelCopyWith<_CompanyBriefModel> get copyWith => __$CompanyBriefModelCopyWithImpl<_CompanyBriefModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CompanyBriefModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CompanyBriefModel&&(identical(other.id, id) || other.id == id)&&(identical(other.razonSocial, razonSocial) || other.razonSocial == razonSocial)&&(identical(other.ruc, ruc) || other.ruc == ruc)&&(identical(other.municipalityName, municipalityName) || other.municipalityName == municipalityName)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.estado, estado) || other.estado == estado));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,razonSocial,ruc,municipalityName,municipalityId,estado);

@override
String toString() {
  return 'CompanyBriefModel(id: $id, razonSocial: $razonSocial, ruc: $ruc, municipalityName: $municipalityName, municipalityId: $municipalityId, estado: $estado)';
}


}

/// @nodoc
abstract mixin class _$CompanyBriefModelCopyWith<$Res> implements $CompanyBriefModelCopyWith<$Res> {
  factory _$CompanyBriefModelCopyWith(_CompanyBriefModel value, $Res Function(_CompanyBriefModel) _then) = __$CompanyBriefModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String razonSocial, String? ruc, String? municipalityName, String? municipalityId, String? estado
});




}
/// @nodoc
class __$CompanyBriefModelCopyWithImpl<$Res>
    implements _$CompanyBriefModelCopyWith<$Res> {
  __$CompanyBriefModelCopyWithImpl(this._self, this._then);

  final _CompanyBriefModel _self;
  final $Res Function(_CompanyBriefModel) _then;

/// Create a copy of CompanyBriefModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? razonSocial = null,Object? ruc = freezed,Object? municipalityName = freezed,Object? municipalityId = freezed,Object? estado = freezed,}) {
  return _then(_CompanyBriefModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,razonSocial: null == razonSocial ? _self.razonSocial : razonSocial // ignore: cast_nullable_to_non_nullable
as String,ruc: freezed == ruc ? _self.ruc : ruc // ignore: cast_nullable_to_non_nullable
as String?,municipalityName: freezed == municipalityName ? _self.municipalityName : municipalityName // ignore: cast_nullable_to_non_nullable
as String?,municipalityId: freezed == municipalityId ? _self.municipalityId : municipalityId // ignore: cast_nullable_to_non_nullable
as String?,estado: freezed == estado ? _self.estado : estado // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
