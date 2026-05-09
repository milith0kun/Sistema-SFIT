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
mixin _$RoutePolylineGeometry {

/// Lista de [lat, lng] en orden, siguiendo calles reales.
 List<List<double>> get coords; int get distanceMeters; int get durationSecondsBaseline; DateTime? get computedAt;
/// Create a copy of RoutePolylineGeometry
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RoutePolylineGeometryCopyWith<RoutePolylineGeometry> get copyWith => _$RoutePolylineGeometryCopyWithImpl<RoutePolylineGeometry>(this as RoutePolylineGeometry, _$identity);

  /// Serializes this RoutePolylineGeometry to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RoutePolylineGeometry&&const DeepCollectionEquality().equals(other.coords, coords)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.durationSecondsBaseline, durationSecondsBaseline) || other.durationSecondsBaseline == durationSecondsBaseline)&&(identical(other.computedAt, computedAt) || other.computedAt == computedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(coords),distanceMeters,durationSecondsBaseline,computedAt);

@override
String toString() {
  return 'RoutePolylineGeometry(coords: $coords, distanceMeters: $distanceMeters, durationSecondsBaseline: $durationSecondsBaseline, computedAt: $computedAt)';
}


}

/// @nodoc
abstract mixin class $RoutePolylineGeometryCopyWith<$Res>  {
  factory $RoutePolylineGeometryCopyWith(RoutePolylineGeometry value, $Res Function(RoutePolylineGeometry) _then) = _$RoutePolylineGeometryCopyWithImpl;
@useResult
$Res call({
 List<List<double>> coords, int distanceMeters, int durationSecondsBaseline, DateTime? computedAt
});




}
/// @nodoc
class _$RoutePolylineGeometryCopyWithImpl<$Res>
    implements $RoutePolylineGeometryCopyWith<$Res> {
  _$RoutePolylineGeometryCopyWithImpl(this._self, this._then);

  final RoutePolylineGeometry _self;
  final $Res Function(RoutePolylineGeometry) _then;

/// Create a copy of RoutePolylineGeometry
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? coords = null,Object? distanceMeters = null,Object? durationSecondsBaseline = null,Object? computedAt = freezed,}) {
  return _then(_self.copyWith(
coords: null == coords ? _self.coords : coords // ignore: cast_nullable_to_non_nullable
as List<List<double>>,distanceMeters: null == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as int,durationSecondsBaseline: null == durationSecondsBaseline ? _self.durationSecondsBaseline : durationSecondsBaseline // ignore: cast_nullable_to_non_nullable
as int,computedAt: freezed == computedAt ? _self.computedAt : computedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [RoutePolylineGeometry].
extension RoutePolylineGeometryPatterns on RoutePolylineGeometry {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RoutePolylineGeometry value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RoutePolylineGeometry() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RoutePolylineGeometry value)  $default,){
final _that = this;
switch (_that) {
case _RoutePolylineGeometry():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RoutePolylineGeometry value)?  $default,){
final _that = this;
switch (_that) {
case _RoutePolylineGeometry() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<List<double>> coords,  int distanceMeters,  int durationSecondsBaseline,  DateTime? computedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RoutePolylineGeometry() when $default != null:
return $default(_that.coords,_that.distanceMeters,_that.durationSecondsBaseline,_that.computedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<List<double>> coords,  int distanceMeters,  int durationSecondsBaseline,  DateTime? computedAt)  $default,) {final _that = this;
switch (_that) {
case _RoutePolylineGeometry():
return $default(_that.coords,_that.distanceMeters,_that.durationSecondsBaseline,_that.computedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<List<double>> coords,  int distanceMeters,  int durationSecondsBaseline,  DateTime? computedAt)?  $default,) {final _that = this;
switch (_that) {
case _RoutePolylineGeometry() when $default != null:
return $default(_that.coords,_that.distanceMeters,_that.durationSecondsBaseline,_that.computedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RoutePolylineGeometry implements RoutePolylineGeometry {
  const _RoutePolylineGeometry({final  List<List<double>> coords = const <List<double>>[], this.distanceMeters = 0, this.durationSecondsBaseline = 0, this.computedAt}): _coords = coords;
  factory _RoutePolylineGeometry.fromJson(Map<String, dynamic> json) => _$RoutePolylineGeometryFromJson(json);

/// Lista de [lat, lng] en orden, siguiendo calles reales.
 final  List<List<double>> _coords;
/// Lista de [lat, lng] en orden, siguiendo calles reales.
@override@JsonKey() List<List<double>> get coords {
  if (_coords is EqualUnmodifiableListView) return _coords;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_coords);
}

@override@JsonKey() final  int distanceMeters;
@override@JsonKey() final  int durationSecondsBaseline;
@override final  DateTime? computedAt;

/// Create a copy of RoutePolylineGeometry
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RoutePolylineGeometryCopyWith<_RoutePolylineGeometry> get copyWith => __$RoutePolylineGeometryCopyWithImpl<_RoutePolylineGeometry>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RoutePolylineGeometryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RoutePolylineGeometry&&const DeepCollectionEquality().equals(other._coords, _coords)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.durationSecondsBaseline, durationSecondsBaseline) || other.durationSecondsBaseline == durationSecondsBaseline)&&(identical(other.computedAt, computedAt) || other.computedAt == computedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_coords),distanceMeters,durationSecondsBaseline,computedAt);

@override
String toString() {
  return 'RoutePolylineGeometry(coords: $coords, distanceMeters: $distanceMeters, durationSecondsBaseline: $durationSecondsBaseline, computedAt: $computedAt)';
}


}

/// @nodoc
abstract mixin class _$RoutePolylineGeometryCopyWith<$Res> implements $RoutePolylineGeometryCopyWith<$Res> {
  factory _$RoutePolylineGeometryCopyWith(_RoutePolylineGeometry value, $Res Function(_RoutePolylineGeometry) _then) = __$RoutePolylineGeometryCopyWithImpl;
@override @useResult
$Res call({
 List<List<double>> coords, int distanceMeters, int durationSecondsBaseline, DateTime? computedAt
});




}
/// @nodoc
class __$RoutePolylineGeometryCopyWithImpl<$Res>
    implements _$RoutePolylineGeometryCopyWith<$Res> {
  __$RoutePolylineGeometryCopyWithImpl(this._self, this._then);

  final _RoutePolylineGeometry _self;
  final $Res Function(_RoutePolylineGeometry) _then;

/// Create a copy of RoutePolylineGeometry
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? coords = null,Object? distanceMeters = null,Object? durationSecondsBaseline = null,Object? computedAt = freezed,}) {
  return _then(_RoutePolylineGeometry(
coords: null == coords ? _self._coords : coords // ignore: cast_nullable_to_non_nullable
as List<List<double>>,distanceMeters: null == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as int,durationSecondsBaseline: null == durationSecondsBaseline ? _self.durationSecondsBaseline : durationSecondsBaseline // ignore: cast_nullable_to_non_nullable
as int,computedAt: freezed == computedAt ? _self.computedAt : computedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$RouteHoraPico {

 String get from; String get to;
/// Create a copy of RouteHoraPico
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RouteHoraPicoCopyWith<RouteHoraPico> get copyWith => _$RouteHoraPicoCopyWithImpl<RouteHoraPico>(this as RouteHoraPico, _$identity);

  /// Serializes this RouteHoraPico to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RouteHoraPico&&(identical(other.from, from) || other.from == from)&&(identical(other.to, to) || other.to == to));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,from,to);

@override
String toString() {
  return 'RouteHoraPico(from: $from, to: $to)';
}


}

/// @nodoc
abstract mixin class $RouteHoraPicoCopyWith<$Res>  {
  factory $RouteHoraPicoCopyWith(RouteHoraPico value, $Res Function(RouteHoraPico) _then) = _$RouteHoraPicoCopyWithImpl;
@useResult
$Res call({
 String from, String to
});




}
/// @nodoc
class _$RouteHoraPicoCopyWithImpl<$Res>
    implements $RouteHoraPicoCopyWith<$Res> {
  _$RouteHoraPicoCopyWithImpl(this._self, this._then);

  final RouteHoraPico _self;
  final $Res Function(RouteHoraPico) _then;

/// Create a copy of RouteHoraPico
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? from = null,Object? to = null,}) {
  return _then(_self.copyWith(
from: null == from ? _self.from : from // ignore: cast_nullable_to_non_nullable
as String,to: null == to ? _self.to : to // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [RouteHoraPico].
extension RouteHoraPicoPatterns on RouteHoraPico {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RouteHoraPico value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RouteHoraPico() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RouteHoraPico value)  $default,){
final _that = this;
switch (_that) {
case _RouteHoraPico():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RouteHoraPico value)?  $default,){
final _that = this;
switch (_that) {
case _RouteHoraPico() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String from,  String to)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RouteHoraPico() when $default != null:
return $default(_that.from,_that.to);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String from,  String to)  $default,) {final _that = this;
switch (_that) {
case _RouteHoraPico():
return $default(_that.from,_that.to);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String from,  String to)?  $default,) {final _that = this;
switch (_that) {
case _RouteHoraPico() when $default != null:
return $default(_that.from,_that.to);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RouteHoraPico implements RouteHoraPico {
  const _RouteHoraPico({required this.from, required this.to});
  factory _RouteHoraPico.fromJson(Map<String, dynamic> json) => _$RouteHoraPicoFromJson(json);

@override final  String from;
@override final  String to;

/// Create a copy of RouteHoraPico
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RouteHoraPicoCopyWith<_RouteHoraPico> get copyWith => __$RouteHoraPicoCopyWithImpl<_RouteHoraPico>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RouteHoraPicoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RouteHoraPico&&(identical(other.from, from) || other.from == from)&&(identical(other.to, to) || other.to == to));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,from,to);

@override
String toString() {
  return 'RouteHoraPico(from: $from, to: $to)';
}


}

/// @nodoc
abstract mixin class _$RouteHoraPicoCopyWith<$Res> implements $RouteHoraPicoCopyWith<$Res> {
  factory _$RouteHoraPicoCopyWith(_RouteHoraPico value, $Res Function(_RouteHoraPico) _then) = __$RouteHoraPicoCopyWithImpl;
@override @useResult
$Res call({
 String from, String to
});




}
/// @nodoc
class __$RouteHoraPicoCopyWithImpl<$Res>
    implements _$RouteHoraPicoCopyWith<$Res> {
  __$RouteHoraPicoCopyWithImpl(this._self, this._then);

  final _RouteHoraPico _self;
  final $Res Function(_RouteHoraPico) _then;

/// Create a copy of RouteHoraPico
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? from = null,Object? to = null,}) {
  return _then(_RouteHoraPico(
from: null == from ? _self.from : from // ignore: cast_nullable_to_non_nullable
as String,to: null == to ? _self.to : to // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$RouteParameters {

 int? get frecuenciaMinutos; int? get capacidadAsientos; List<RouteHoraPico> get horarioPico; String? get observaciones;
/// Create a copy of RouteParameters
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RouteParametersCopyWith<RouteParameters> get copyWith => _$RouteParametersCopyWithImpl<RouteParameters>(this as RouteParameters, _$identity);

  /// Serializes this RouteParameters to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RouteParameters&&(identical(other.frecuenciaMinutos, frecuenciaMinutos) || other.frecuenciaMinutos == frecuenciaMinutos)&&(identical(other.capacidadAsientos, capacidadAsientos) || other.capacidadAsientos == capacidadAsientos)&&const DeepCollectionEquality().equals(other.horarioPico, horarioPico)&&(identical(other.observaciones, observaciones) || other.observaciones == observaciones));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,frecuenciaMinutos,capacidadAsientos,const DeepCollectionEquality().hash(horarioPico),observaciones);

@override
String toString() {
  return 'RouteParameters(frecuenciaMinutos: $frecuenciaMinutos, capacidadAsientos: $capacidadAsientos, horarioPico: $horarioPico, observaciones: $observaciones)';
}


}

/// @nodoc
abstract mixin class $RouteParametersCopyWith<$Res>  {
  factory $RouteParametersCopyWith(RouteParameters value, $Res Function(RouteParameters) _then) = _$RouteParametersCopyWithImpl;
@useResult
$Res call({
 int? frecuenciaMinutos, int? capacidadAsientos, List<RouteHoraPico> horarioPico, String? observaciones
});




}
/// @nodoc
class _$RouteParametersCopyWithImpl<$Res>
    implements $RouteParametersCopyWith<$Res> {
  _$RouteParametersCopyWithImpl(this._self, this._then);

  final RouteParameters _self;
  final $Res Function(RouteParameters) _then;

/// Create a copy of RouteParameters
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? frecuenciaMinutos = freezed,Object? capacidadAsientos = freezed,Object? horarioPico = null,Object? observaciones = freezed,}) {
  return _then(_self.copyWith(
frecuenciaMinutos: freezed == frecuenciaMinutos ? _self.frecuenciaMinutos : frecuenciaMinutos // ignore: cast_nullable_to_non_nullable
as int?,capacidadAsientos: freezed == capacidadAsientos ? _self.capacidadAsientos : capacidadAsientos // ignore: cast_nullable_to_non_nullable
as int?,horarioPico: null == horarioPico ? _self.horarioPico : horarioPico // ignore: cast_nullable_to_non_nullable
as List<RouteHoraPico>,observaciones: freezed == observaciones ? _self.observaciones : observaciones // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [RouteParameters].
extension RouteParametersPatterns on RouteParameters {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RouteParameters value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RouteParameters() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RouteParameters value)  $default,){
final _that = this;
switch (_that) {
case _RouteParameters():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RouteParameters value)?  $default,){
final _that = this;
switch (_that) {
case _RouteParameters() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int? frecuenciaMinutos,  int? capacidadAsientos,  List<RouteHoraPico> horarioPico,  String? observaciones)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RouteParameters() when $default != null:
return $default(_that.frecuenciaMinutos,_that.capacidadAsientos,_that.horarioPico,_that.observaciones);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int? frecuenciaMinutos,  int? capacidadAsientos,  List<RouteHoraPico> horarioPico,  String? observaciones)  $default,) {final _that = this;
switch (_that) {
case _RouteParameters():
return $default(_that.frecuenciaMinutos,_that.capacidadAsientos,_that.horarioPico,_that.observaciones);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int? frecuenciaMinutos,  int? capacidadAsientos,  List<RouteHoraPico> horarioPico,  String? observaciones)?  $default,) {final _that = this;
switch (_that) {
case _RouteParameters() when $default != null:
return $default(_that.frecuenciaMinutos,_that.capacidadAsientos,_that.horarioPico,_that.observaciones);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RouteParameters implements RouteParameters {
  const _RouteParameters({this.frecuenciaMinutos, this.capacidadAsientos, final  List<RouteHoraPico> horarioPico = const <RouteHoraPico>[], this.observaciones}): _horarioPico = horarioPico;
  factory _RouteParameters.fromJson(Map<String, dynamic> json) => _$RouteParametersFromJson(json);

@override final  int? frecuenciaMinutos;
@override final  int? capacidadAsientos;
 final  List<RouteHoraPico> _horarioPico;
@override@JsonKey() List<RouteHoraPico> get horarioPico {
  if (_horarioPico is EqualUnmodifiableListView) return _horarioPico;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_horarioPico);
}

@override final  String? observaciones;

/// Create a copy of RouteParameters
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RouteParametersCopyWith<_RouteParameters> get copyWith => __$RouteParametersCopyWithImpl<_RouteParameters>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RouteParametersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RouteParameters&&(identical(other.frecuenciaMinutos, frecuenciaMinutos) || other.frecuenciaMinutos == frecuenciaMinutos)&&(identical(other.capacidadAsientos, capacidadAsientos) || other.capacidadAsientos == capacidadAsientos)&&const DeepCollectionEquality().equals(other._horarioPico, _horarioPico)&&(identical(other.observaciones, observaciones) || other.observaciones == observaciones));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,frecuenciaMinutos,capacidadAsientos,const DeepCollectionEquality().hash(_horarioPico),observaciones);

@override
String toString() {
  return 'RouteParameters(frecuenciaMinutos: $frecuenciaMinutos, capacidadAsientos: $capacidadAsientos, horarioPico: $horarioPico, observaciones: $observaciones)';
}


}

/// @nodoc
abstract mixin class _$RouteParametersCopyWith<$Res> implements $RouteParametersCopyWith<$Res> {
  factory _$RouteParametersCopyWith(_RouteParameters value, $Res Function(_RouteParameters) _then) = __$RouteParametersCopyWithImpl;
@override @useResult
$Res call({
 int? frecuenciaMinutos, int? capacidadAsientos, List<RouteHoraPico> horarioPico, String? observaciones
});




}
/// @nodoc
class __$RouteParametersCopyWithImpl<$Res>
    implements _$RouteParametersCopyWith<$Res> {
  __$RouteParametersCopyWithImpl(this._self, this._then);

  final _RouteParameters _self;
  final $Res Function(_RouteParameters) _then;

/// Create a copy of RouteParameters
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? frecuenciaMinutos = freezed,Object? capacidadAsientos = freezed,Object? horarioPico = null,Object? observaciones = freezed,}) {
  return _then(_RouteParameters(
frecuenciaMinutos: freezed == frecuenciaMinutos ? _self.frecuenciaMinutos : frecuenciaMinutos // ignore: cast_nullable_to_non_nullable
as int?,capacidadAsientos: freezed == capacidadAsientos ? _self.capacidadAsientos : capacidadAsientos // ignore: cast_nullable_to_non_nullable
as int?,horarioPico: null == horarioPico ? _self._horarioPico : horarioPico // ignore: cast_nullable_to_non_nullable
as List<RouteHoraPico>,observaciones: freezed == observaciones ? _self.observaciones : observaciones // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$RouteModel {

 String get id; String? get code; String? get name; String? get type; String? get status;@JsonKey(name: 'length') String? get lengthLabel; int? get stops; String? get municipalityId; String? get siblingRouteId; List<Map<String, dynamic>> get waypoints;/// Geometría siguiendo calles. Null si Google Routes no respondió aún —
/// usar getter `polylineCoords` que cae al fallback de waypoints.
 RoutePolylineGeometry? get polylineGeometry;/// Override manual del operador: id de la pasada (FleetEntry) marcada
/// como la "mejor" del corredor. Cuando está presente gana sobre el
/// `isBest` automático calculado por score.
 String? get preferredCaptureId; DateTime? get preferredAt;/// Etiquetas operativas (presets + custom). Ej: "congestionada", "rapida".
 List<String> get tags;/// Metadata estructurada para reportes y operación.
 RouteParameters? get parameters; DateTime? get createdAt; DateTime? get updatedAt;
/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RouteModelCopyWith<RouteModel> get copyWith => _$RouteModelCopyWithImpl<RouteModel>(this as RouteModel, _$identity);

  /// Serializes this RouteModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RouteModel&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.name, name) || other.name == name)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.lengthLabel, lengthLabel) || other.lengthLabel == lengthLabel)&&(identical(other.stops, stops) || other.stops == stops)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.siblingRouteId, siblingRouteId) || other.siblingRouteId == siblingRouteId)&&const DeepCollectionEquality().equals(other.waypoints, waypoints)&&(identical(other.polylineGeometry, polylineGeometry) || other.polylineGeometry == polylineGeometry)&&(identical(other.preferredCaptureId, preferredCaptureId) || other.preferredCaptureId == preferredCaptureId)&&(identical(other.preferredAt, preferredAt) || other.preferredAt == preferredAt)&&const DeepCollectionEquality().equals(other.tags, tags)&&(identical(other.parameters, parameters) || other.parameters == parameters)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,name,type,status,lengthLabel,stops,municipalityId,siblingRouteId,const DeepCollectionEquality().hash(waypoints),polylineGeometry,preferredCaptureId,preferredAt,const DeepCollectionEquality().hash(tags),parameters,createdAt,updatedAt);

@override
String toString() {
  return 'RouteModel(id: $id, code: $code, name: $name, type: $type, status: $status, lengthLabel: $lengthLabel, stops: $stops, municipalityId: $municipalityId, siblingRouteId: $siblingRouteId, waypoints: $waypoints, polylineGeometry: $polylineGeometry, preferredCaptureId: $preferredCaptureId, preferredAt: $preferredAt, tags: $tags, parameters: $parameters, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $RouteModelCopyWith<$Res>  {
  factory $RouteModelCopyWith(RouteModel value, $Res Function(RouteModel) _then) = _$RouteModelCopyWithImpl;
@useResult
$Res call({
 String id, String? code, String? name, String? type, String? status,@JsonKey(name: 'length') String? lengthLabel, int? stops, String? municipalityId, String? siblingRouteId, List<Map<String, dynamic>> waypoints, RoutePolylineGeometry? polylineGeometry, String? preferredCaptureId, DateTime? preferredAt, List<String> tags, RouteParameters? parameters, DateTime? createdAt, DateTime? updatedAt
});


$RoutePolylineGeometryCopyWith<$Res>? get polylineGeometry;$RouteParametersCopyWith<$Res>? get parameters;

}
/// @nodoc
class _$RouteModelCopyWithImpl<$Res>
    implements $RouteModelCopyWith<$Res> {
  _$RouteModelCopyWithImpl(this._self, this._then);

  final RouteModel _self;
  final $Res Function(RouteModel) _then;

/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? code = freezed,Object? name = freezed,Object? type = freezed,Object? status = freezed,Object? lengthLabel = freezed,Object? stops = freezed,Object? municipalityId = freezed,Object? siblingRouteId = freezed,Object? waypoints = null,Object? polylineGeometry = freezed,Object? preferredCaptureId = freezed,Object? preferredAt = freezed,Object? tags = null,Object? parameters = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
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
as List<Map<String, dynamic>>,polylineGeometry: freezed == polylineGeometry ? _self.polylineGeometry : polylineGeometry // ignore: cast_nullable_to_non_nullable
as RoutePolylineGeometry?,preferredCaptureId: freezed == preferredCaptureId ? _self.preferredCaptureId : preferredCaptureId // ignore: cast_nullable_to_non_nullable
as String?,preferredAt: freezed == preferredAt ? _self.preferredAt : preferredAt // ignore: cast_nullable_to_non_nullable
as DateTime?,tags: null == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,parameters: freezed == parameters ? _self.parameters : parameters // ignore: cast_nullable_to_non_nullable
as RouteParameters?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}
/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RoutePolylineGeometryCopyWith<$Res>? get polylineGeometry {
    if (_self.polylineGeometry == null) {
    return null;
  }

  return $RoutePolylineGeometryCopyWith<$Res>(_self.polylineGeometry!, (value) {
    return _then(_self.copyWith(polylineGeometry: value));
  });
}/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RouteParametersCopyWith<$Res>? get parameters {
    if (_self.parameters == null) {
    return null;
  }

  return $RouteParametersCopyWith<$Res>(_self.parameters!, (value) {
    return _then(_self.copyWith(parameters: value));
  });
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String? code,  String? name,  String? type,  String? status, @JsonKey(name: 'length')  String? lengthLabel,  int? stops,  String? municipalityId,  String? siblingRouteId,  List<Map<String, dynamic>> waypoints,  RoutePolylineGeometry? polylineGeometry,  String? preferredCaptureId,  DateTime? preferredAt,  List<String> tags,  RouteParameters? parameters,  DateTime? createdAt,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RouteModel() when $default != null:
return $default(_that.id,_that.code,_that.name,_that.type,_that.status,_that.lengthLabel,_that.stops,_that.municipalityId,_that.siblingRouteId,_that.waypoints,_that.polylineGeometry,_that.preferredCaptureId,_that.preferredAt,_that.tags,_that.parameters,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String? code,  String? name,  String? type,  String? status, @JsonKey(name: 'length')  String? lengthLabel,  int? stops,  String? municipalityId,  String? siblingRouteId,  List<Map<String, dynamic>> waypoints,  RoutePolylineGeometry? polylineGeometry,  String? preferredCaptureId,  DateTime? preferredAt,  List<String> tags,  RouteParameters? parameters,  DateTime? createdAt,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _RouteModel():
return $default(_that.id,_that.code,_that.name,_that.type,_that.status,_that.lengthLabel,_that.stops,_that.municipalityId,_that.siblingRouteId,_that.waypoints,_that.polylineGeometry,_that.preferredCaptureId,_that.preferredAt,_that.tags,_that.parameters,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String? code,  String? name,  String? type,  String? status, @JsonKey(name: 'length')  String? lengthLabel,  int? stops,  String? municipalityId,  String? siblingRouteId,  List<Map<String, dynamic>> waypoints,  RoutePolylineGeometry? polylineGeometry,  String? preferredCaptureId,  DateTime? preferredAt,  List<String> tags,  RouteParameters? parameters,  DateTime? createdAt,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _RouteModel() when $default != null:
return $default(_that.id,_that.code,_that.name,_that.type,_that.status,_that.lengthLabel,_that.stops,_that.municipalityId,_that.siblingRouteId,_that.waypoints,_that.polylineGeometry,_that.preferredCaptureId,_that.preferredAt,_that.tags,_that.parameters,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RouteModel implements RouteModel {
  const _RouteModel({required this.id, this.code, this.name, this.type, this.status, @JsonKey(name: 'length') this.lengthLabel, this.stops, this.municipalityId, this.siblingRouteId, final  List<Map<String, dynamic>> waypoints = const <Map<String, dynamic>>[], this.polylineGeometry, this.preferredCaptureId, this.preferredAt, final  List<String> tags = const <String>[], this.parameters, this.createdAt, this.updatedAt}): _waypoints = waypoints,_tags = tags;
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

/// Geometría siguiendo calles. Null si Google Routes no respondió aún —
/// usar getter `polylineCoords` que cae al fallback de waypoints.
@override final  RoutePolylineGeometry? polylineGeometry;
/// Override manual del operador: id de la pasada (FleetEntry) marcada
/// como la "mejor" del corredor. Cuando está presente gana sobre el
/// `isBest` automático calculado por score.
@override final  String? preferredCaptureId;
@override final  DateTime? preferredAt;
/// Etiquetas operativas (presets + custom). Ej: "congestionada", "rapida".
 final  List<String> _tags;
/// Etiquetas operativas (presets + custom). Ej: "congestionada", "rapida".
@override@JsonKey() List<String> get tags {
  if (_tags is EqualUnmodifiableListView) return _tags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_tags);
}

/// Metadata estructurada para reportes y operación.
@override final  RouteParameters? parameters;
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
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RouteModel&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.name, name) || other.name == name)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.lengthLabel, lengthLabel) || other.lengthLabel == lengthLabel)&&(identical(other.stops, stops) || other.stops == stops)&&(identical(other.municipalityId, municipalityId) || other.municipalityId == municipalityId)&&(identical(other.siblingRouteId, siblingRouteId) || other.siblingRouteId == siblingRouteId)&&const DeepCollectionEquality().equals(other._waypoints, _waypoints)&&(identical(other.polylineGeometry, polylineGeometry) || other.polylineGeometry == polylineGeometry)&&(identical(other.preferredCaptureId, preferredCaptureId) || other.preferredCaptureId == preferredCaptureId)&&(identical(other.preferredAt, preferredAt) || other.preferredAt == preferredAt)&&const DeepCollectionEquality().equals(other._tags, _tags)&&(identical(other.parameters, parameters) || other.parameters == parameters)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,code,name,type,status,lengthLabel,stops,municipalityId,siblingRouteId,const DeepCollectionEquality().hash(_waypoints),polylineGeometry,preferredCaptureId,preferredAt,const DeepCollectionEquality().hash(_tags),parameters,createdAt,updatedAt);

@override
String toString() {
  return 'RouteModel(id: $id, code: $code, name: $name, type: $type, status: $status, lengthLabel: $lengthLabel, stops: $stops, municipalityId: $municipalityId, siblingRouteId: $siblingRouteId, waypoints: $waypoints, polylineGeometry: $polylineGeometry, preferredCaptureId: $preferredCaptureId, preferredAt: $preferredAt, tags: $tags, parameters: $parameters, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$RouteModelCopyWith<$Res> implements $RouteModelCopyWith<$Res> {
  factory _$RouteModelCopyWith(_RouteModel value, $Res Function(_RouteModel) _then) = __$RouteModelCopyWithImpl;
@override @useResult
$Res call({
 String id, String? code, String? name, String? type, String? status,@JsonKey(name: 'length') String? lengthLabel, int? stops, String? municipalityId, String? siblingRouteId, List<Map<String, dynamic>> waypoints, RoutePolylineGeometry? polylineGeometry, String? preferredCaptureId, DateTime? preferredAt, List<String> tags, RouteParameters? parameters, DateTime? createdAt, DateTime? updatedAt
});


@override $RoutePolylineGeometryCopyWith<$Res>? get polylineGeometry;@override $RouteParametersCopyWith<$Res>? get parameters;

}
/// @nodoc
class __$RouteModelCopyWithImpl<$Res>
    implements _$RouteModelCopyWith<$Res> {
  __$RouteModelCopyWithImpl(this._self, this._then);

  final _RouteModel _self;
  final $Res Function(_RouteModel) _then;

/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? code = freezed,Object? name = freezed,Object? type = freezed,Object? status = freezed,Object? lengthLabel = freezed,Object? stops = freezed,Object? municipalityId = freezed,Object? siblingRouteId = freezed,Object? waypoints = null,Object? polylineGeometry = freezed,Object? preferredCaptureId = freezed,Object? preferredAt = freezed,Object? tags = null,Object? parameters = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
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
as List<Map<String, dynamic>>,polylineGeometry: freezed == polylineGeometry ? _self.polylineGeometry : polylineGeometry // ignore: cast_nullable_to_non_nullable
as RoutePolylineGeometry?,preferredCaptureId: freezed == preferredCaptureId ? _self.preferredCaptureId : preferredCaptureId // ignore: cast_nullable_to_non_nullable
as String?,preferredAt: freezed == preferredAt ? _self.preferredAt : preferredAt // ignore: cast_nullable_to_non_nullable
as DateTime?,tags: null == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,parameters: freezed == parameters ? _self.parameters : parameters // ignore: cast_nullable_to_non_nullable
as RouteParameters?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RoutePolylineGeometryCopyWith<$Res>? get polylineGeometry {
    if (_self.polylineGeometry == null) {
    return null;
  }

  return $RoutePolylineGeometryCopyWith<$Res>(_self.polylineGeometry!, (value) {
    return _then(_self.copyWith(polylineGeometry: value));
  });
}/// Create a copy of RouteModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RouteParametersCopyWith<$Res>? get parameters {
    if (_self.parameters == null) {
    return null;
  }

  return $RouteParametersCopyWith<$Res>(_self.parameters!, (value) {
    return _then(_self.copyWith(parameters: value));
  });
}
}

// dart format on
