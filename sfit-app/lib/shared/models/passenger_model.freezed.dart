// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'passenger_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PassengerModel {

 String get id; String get name; String? get dni; String? get seat; String? get contact; String? get boardingStop; String? get destinationStop; String? get note; DateTime? get createdAt;
/// Create a copy of PassengerModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PassengerModelCopyWith<PassengerModel> get copyWith => _$PassengerModelCopyWithImpl<PassengerModel>(this as PassengerModel, _$identity);

  /// Serializes this PassengerModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PassengerModel&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.dni, dni) || other.dni == dni)&&(identical(other.seat, seat) || other.seat == seat)&&(identical(other.contact, contact) || other.contact == contact)&&(identical(other.boardingStop, boardingStop) || other.boardingStop == boardingStop)&&(identical(other.destinationStop, destinationStop) || other.destinationStop == destinationStop)&&(identical(other.note, note) || other.note == note)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,dni,seat,contact,boardingStop,destinationStop,note,createdAt);

@override
String toString() {
  return 'PassengerModel(id: $id, name: $name, dni: $dni, seat: $seat, contact: $contact, boardingStop: $boardingStop, destinationStop: $destinationStop, note: $note, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $PassengerModelCopyWith<$Res>  {
  factory $PassengerModelCopyWith(PassengerModel value, $Res Function(PassengerModel) _then) = _$PassengerModelCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? dni, String? seat, String? contact, String? boardingStop, String? destinationStop, String? note, DateTime? createdAt
});




}
/// @nodoc
class _$PassengerModelCopyWithImpl<$Res>
    implements $PassengerModelCopyWith<$Res> {
  _$PassengerModelCopyWithImpl(this._self, this._then);

  final PassengerModel _self;
  final $Res Function(PassengerModel) _then;

/// Create a copy of PassengerModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? dni = freezed,Object? seat = freezed,Object? contact = freezed,Object? boardingStop = freezed,Object? destinationStop = freezed,Object? note = freezed,Object? createdAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,dni: freezed == dni ? _self.dni : dni // ignore: cast_nullable_to_non_nullable
as String?,seat: freezed == seat ? _self.seat : seat // ignore: cast_nullable_to_non_nullable
as String?,contact: freezed == contact ? _self.contact : contact // ignore: cast_nullable_to_non_nullable
as String?,boardingStop: freezed == boardingStop ? _self.boardingStop : boardingStop // ignore: cast_nullable_to_non_nullable
as String?,destinationStop: freezed == destinationStop ? _self.destinationStop : destinationStop // ignore: cast_nullable_to_non_nullable
as String?,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [PassengerModel].
extension PassengerModelPatterns on PassengerModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PassengerModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PassengerModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PassengerModel value)  $default,){
final _that = this;
switch (_that) {
case _PassengerModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PassengerModel value)?  $default,){
final _that = this;
switch (_that) {
case _PassengerModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? dni,  String? seat,  String? contact,  String? boardingStop,  String? destinationStop,  String? note,  DateTime? createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PassengerModel() when $default != null:
return $default(_that.id,_that.name,_that.dni,_that.seat,_that.contact,_that.boardingStop,_that.destinationStop,_that.note,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? dni,  String? seat,  String? contact,  String? boardingStop,  String? destinationStop,  String? note,  DateTime? createdAt)  $default,) {final _that = this;
switch (_that) {
case _PassengerModel():
return $default(_that.id,_that.name,_that.dni,_that.seat,_that.contact,_that.boardingStop,_that.destinationStop,_that.note,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? dni,  String? seat,  String? contact,  String? boardingStop,  String? destinationStop,  String? note,  DateTime? createdAt)?  $default,) {final _that = this;
switch (_that) {
case _PassengerModel() when $default != null:
return $default(_that.id,_that.name,_that.dni,_that.seat,_that.contact,_that.boardingStop,_that.destinationStop,_that.note,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PassengerModel implements PassengerModel {
  const _PassengerModel({required this.id, required this.name, this.dni, this.seat, this.contact, this.boardingStop, this.destinationStop, this.note, this.createdAt});
  factory _PassengerModel.fromJson(Map<String, dynamic> json) => _$PassengerModelFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? dni;
@override final  String? seat;
@override final  String? contact;
@override final  String? boardingStop;
@override final  String? destinationStop;
@override final  String? note;
@override final  DateTime? createdAt;

/// Create a copy of PassengerModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PassengerModelCopyWith<_PassengerModel> get copyWith => __$PassengerModelCopyWithImpl<_PassengerModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PassengerModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PassengerModel&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.dni, dni) || other.dni == dni)&&(identical(other.seat, seat) || other.seat == seat)&&(identical(other.contact, contact) || other.contact == contact)&&(identical(other.boardingStop, boardingStop) || other.boardingStop == boardingStop)&&(identical(other.destinationStop, destinationStop) || other.destinationStop == destinationStop)&&(identical(other.note, note) || other.note == note)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,dni,seat,contact,boardingStop,destinationStop,note,createdAt);

@override
String toString() {
  return 'PassengerModel(id: $id, name: $name, dni: $dni, seat: $seat, contact: $contact, boardingStop: $boardingStop, destinationStop: $destinationStop, note: $note, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$PassengerModelCopyWith<$Res> implements $PassengerModelCopyWith<$Res> {
  factory _$PassengerModelCopyWith(_PassengerModel value, $Res Function(_PassengerModel) _then) = __$PassengerModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? dni, String? seat, String? contact, String? boardingStop, String? destinationStop, String? note, DateTime? createdAt
});




}
/// @nodoc
class __$PassengerModelCopyWithImpl<$Res>
    implements _$PassengerModelCopyWith<$Res> {
  __$PassengerModelCopyWithImpl(this._self, this._then);

  final _PassengerModel _self;
  final $Res Function(_PassengerModel) _then;

/// Create a copy of PassengerModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? dni = freezed,Object? seat = freezed,Object? contact = freezed,Object? boardingStop = freezed,Object? destinationStop = freezed,Object? note = freezed,Object? createdAt = freezed,}) {
  return _then(_PassengerModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,dni: freezed == dni ? _self.dni : dni // ignore: cast_nullable_to_non_nullable
as String?,seat: freezed == seat ? _self.seat : seat // ignore: cast_nullable_to_non_nullable
as String?,contact: freezed == contact ? _self.contact : contact // ignore: cast_nullable_to_non_nullable
as String?,boardingStop: freezed == boardingStop ? _self.boardingStop : boardingStop // ignore: cast_nullable_to_non_nullable
as String?,destinationStop: freezed == destinationStop ? _self.destinationStop : destinationStop // ignore: cast_nullable_to_non_nullable
as String?,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
