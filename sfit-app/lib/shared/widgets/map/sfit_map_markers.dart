import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/theme/app_colors.dart';

/// Helpers de estilos consistentes para todos los mapas de SFIT
/// (turno conductor, resumen, buses en vivo, mapa público para ciudadanos).
///
/// Los markers y polylines escalan según el `zoom` del mapa para no
/// solaparse al alejar y mantener legibilidad al acercar. Para usarlos:
///   1. Mantén un `double _currentZoom` en el State.
///   2. En `MapOptions(onPositionChanged: (p, _) { ... })` actualiza
///      `_currentZoom = p.zoom`.
///   3. Pasa `_currentZoom` a las helpers.

class SfitMapStyle {
  SfitMapStyle._();

  /// Grosor del polyline del trazo histórico (recorrido completo).
  /// Más fino al alejarse para no inundar la vista.
  static double historicalStroke(double zoom) {
    if (zoom < 12) return 1.6;
    if (zoom < 14) return 2.2;
    if (zoom < 16) return 3.0;
    return 3.6;
  }

  /// Grosor del polyline del tramo reciente (live, encima del histórico).
  static double recentStroke(double zoom) {
    if (zoom < 12) return 2.4;
    if (zoom < 14) return 3.4;
    if (zoom < 16) return 4.6;
    return 5.4;
  }

  /// Grosor de la ruta planeada (waypoints punteados).
  static double plannedStroke(double zoom) {
    if (zoom < 12) return 1.8;
    if (zoom < 14) return 2.6;
    if (zoom < 16) return 3.2;
    return 3.8;
  }

  /// Tamaño (px) del marker del bus.
  static double busMarkerSize(double zoom) {
    if (zoom < 11) return 22;
    if (zoom < 13) return 30;
    if (zoom < 15) return 38;
    return 46;
  }

  /// Tamaño (px) del marker "tú estás aquí" (centrado en el conductor).
  static double myLocationSize(double zoom) {
    if (zoom < 11) return 14;
    if (zoom < 13) return 18;
    if (zoom < 15) return 22;
    return 26;
  }

  /// Tamaño (px) del marker de paradero/checkpoint.
  static double stopMarkerSize(double zoom) {
    if (zoom < 11) return 16;
    if (zoom < 13) return 22;
    if (zoom < 15) return 28;
    return 36;
  }

  /// Si los labels de paraderos deben mostrarse (sólo en zoom alto).
  static bool showStopLabels(double zoom) => zoom >= 15;
}

/// Marker del bus: el ícono `directions_bus_filled_rounded` mostrado completo
/// y a tamaño según el zoom (sin círculo de fondo encima del ícono pequeño).
/// Color por estado del vehículo, halo blanco para legibilidad sobre cualquier
/// fondo del mapa. Si el bus está fuera de ruta, se cambia el color base.
///
/// Uso:
/// ```dart
/// MarkerLayer(markers: [
///   sfitBusMarker(point: pos, zoom: _currentZoom, statusColor: c),
/// ])
/// ```
Marker sfitBusMarker({
  required LatLng point,
  required double zoom,
  Color? statusColor,
  bool isOffRoute = false,
  double rotation = 0,
  VoidCallback? onTap,
}) {
  final size = SfitMapStyle.busMarkerSize(zoom);
  final base = statusColor ?? (isOffRoute ? AppColors.noApto : AppColors.gold);
  final tap = onTap;
  return Marker(
    point: point,
    width: size,
    height: size,
    alignment: Alignment.center,
    child: GestureDetector(
      onTap: tap,
      behavior: tap != null ? HitTestBehavior.opaque : HitTestBehavior.deferToChild,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Halo blanco — ensancha el contraste sobre tiles oscuras o claras.
          Icon(
            Icons.directions_bus_filled_rounded,
            size: size,
            color: Colors.white,
          ),
          // Ícono coloreado encima, ligeramente más chico para que el halo
          // blanco se note como borde.
          Transform.rotate(
            angle: rotation,
            child: Icon(
              Icons.directions_bus_filled_rounded,
              size: size * 0.86,
              color: base,
              shadows: const [
                Shadow(color: Color(0x55000000), blurRadius: 4, offset: Offset(0, 1)),
              ],
            ),
          ),
          if (isOffRoute)
            Positioned(
              right: 0,
              top: 0,
              child: Container(
                width: size * 0.30,
                height: size * 0.30,
                decoration: BoxDecoration(
                  color: const Color(0xFFB45309),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.4),
                ),
                child: Icon(
                  Icons.warning_amber_rounded,
                  size: size * 0.18,
                  color: Colors.white,
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

/// Trunca una polyline al punto más cercano a [currentPos]. Devuelve dos
/// listas: `(traveled, remaining)`. La primera es lo que el bus YA recorrió
/// (de inicio hasta el punto más cercano, inclusive), la segunda es lo que
/// le falta. Útil para que la línea trazada no aparezca "más adelante" del
/// marker del bus cuando el backend manda la geometría completa de la ruta.
({List<LatLng> traveled, List<LatLng> remaining}) splitPolylineAtPosition(
  List<LatLng> path,
  LatLng currentPos,
) {
  if (path.length < 2) {
    return (traveled: const <LatLng>[], remaining: path);
  }
  int closestIdx = 0;
  double minSq = double.infinity;
  for (var i = 0; i < path.length; i++) {
    final p = path[i];
    final dLat = p.latitude - currentPos.latitude;
    final dLng = p.longitude - currentPos.longitude;
    final sq = dLat * dLat + dLng * dLng;
    if (sq < minSq) {
      minSq = sq;
      closestIdx = i;
    }
  }
  final traveled = path.sublist(0, closestIdx + 1);
  // Insertamos `currentPos` al inicio del remaining para que la línea
  // futura arranque exactamente desde el bus, no desde el waypoint anterior.
  final remaining = <LatLng>[currentPos, ...path.sublist(closestIdx + 1)];
  return (traveled: traveled, remaining: remaining);
}

/// Marker "tú estás aquí" para el conductor (cuando no es el bus, sino la
/// ubicación visualmente distinta). Punto azul con halo. Útil en
/// contextos donde el bus no se mueve (ej. el conductor consulta su
/// posición sin estar en turno).
Marker sfitMyLocationMarker({
  required LatLng point,
  required double zoom,
}) {
  final size = SfitMapStyle.myLocationSize(zoom);
  return Marker(
    point: point,
    width: size * 2.2,
    height: size * 2.2,
    alignment: Alignment.center,
    child: Stack(
      alignment: Alignment.center,
      children: [
        // Halo
        Container(
          width: size * 2.2,
          height: size * 2.2,
          decoration: BoxDecoration(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.18),
            shape: BoxShape.circle,
          ),
        ),
        // Punto sólido con borde blanco
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: const Color(0xFF3B82F6),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: size * 0.12),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// Marker compacto de inicio/fin del trazo (verde para inicio, rojo para fin).
/// Usado en el resumen post-cierre cuando el conductor revisa el viaje.
Marker sfitTrackEndpointMarker({
  required LatLng point,
  required double zoom,
  required bool isStart,
}) {
  final size = SfitMapStyle.busMarkerSize(zoom) * 0.75;
  final color = isStart ? AppColors.apto : AppColors.noApto;
  return Marker(
    point: point,
    width: size,
    height: size,
    alignment: Alignment.center,
    child: Container(
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: 8,
            spreadRadius: 1,
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Icon(
        isStart ? Icons.play_arrow_rounded : Icons.stop_rounded,
        size: size * 0.55,
        color: Colors.white,
      ),
    ),
  );
}
