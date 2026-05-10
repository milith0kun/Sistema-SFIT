import 'dart:math' as math;
import 'package:latlong2/latlong.dart';

/// Distancia en metros entre dos puntos usando la fórmula del haversine.
/// Suficientemente precisa para distancias urbanas (< 100 km). El backend
/// usa la misma fórmula en `sfit-web/src/lib/geo/haversine.ts`.
double haversineMeters(LatLng a, LatLng b) {
  const earthRadiusM = 6371000.0;
  final lat1 = a.latitude * math.pi / 180;
  final lat2 = b.latitude * math.pi / 180;
  final dLat = (b.latitude - a.latitude) * math.pi / 180;
  final dLng = (b.longitude - a.longitude) * math.pi / 180;
  final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(lat1) * math.cos(lat2) *
          math.sin(dLng / 2) * math.sin(dLng / 2);
  final c = 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
  return earthRadiusM * c;
}

/// Estimación del tiempo de caminata entre dos puntos. Usa haversine × 1.25
/// (factor urbano, las calles raramente son línea recta) y velocidad de
/// caminata de 1.4 m/s (≈ 5 km/h, OMS). Devuelve segundos.
double walkSecondsBetween(LatLng from, LatLng to) {
  final straightLineMeters = haversineMeters(from, to);
  final urbanMeters = straightLineMeters * 1.25;
  return urbanMeters / 1.4;
}

/// Formato compacto de duración para etiqueta peatonal: "2 min", "12 min",
/// "1h 5m". Pensado para el sheet del ciudadano.
String formatWalkDuration(double seconds) {
  if (seconds < 60) return '< 1 min';
  final m = seconds ~/ 60;
  if (m < 60) return '$m min';
  final h = m ~/ 60;
  final mr = m % 60;
  if (mr == 0) return '${h}h';
  return '${h}h ${mr}m';
}
