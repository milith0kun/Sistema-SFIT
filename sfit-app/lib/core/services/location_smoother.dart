import 'package:latlong2/latlong.dart';

/// Suavizado exponencial sobre samples GPS para uso visual.
///
/// El backend recibe los samples crudos (sin smoothing) — esto solo afecta
/// lo que pintamos en pantalla. Reduce el zigzag visible en la polyline real
/// (oro) del conductor y hace que los marcadores de buses en el mapa público
/// "deslicen" entre polls de 8 segundos en lugar de saltar.
///
/// Algoritmo: media móvil exponencial con peso adaptativo según accuracy.
/// - alpha = 0.4 normal (60% histórico, 40% nuevo)
/// - alpha = 0.2 cuando accuracy > 30m (más peso al histórico, el nuevo es ruidoso)
class LocationSmoother {
  static const double _alphaNormal = 0.4;
  static const double _alphaNoisy = 0.2;
  static const double _accuracyThreshold = 30.0;

  LatLng? _last;

  /// Suaviza un nuevo punto. Si es el primer sample devuelve el punto crudo.
  LatLng smooth(LatLng raw, {double accuracy = 0}) {
    final last = _last;
    if (last == null) {
      _last = raw;
      return raw;
    }
    final alpha = accuracy > _accuracyThreshold ? _alphaNoisy : _alphaNormal;
    final lat = last.latitude * (1 - alpha) + raw.latitude * alpha;
    final lng = last.longitude * (1 - alpha) + raw.longitude * alpha;
    final smoothed = LatLng(lat, lng);
    _last = smoothed;
    return smoothed;
  }

  /// Reinicia el smoother — útil al cambiar de turno o al re-seleccionar bus.
  void reset() {
    _last = null;
  }

  /// Último valor suavizado, sin alterar el estado.
  LatLng? get last => _last;
}
