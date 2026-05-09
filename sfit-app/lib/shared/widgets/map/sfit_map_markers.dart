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

/// Marker del bus: círculo dorado con icono de navegación. Escala con zoom
/// y cambia a rojo si está fuera de ruta. Sombra suave para destacar sobre
/// el mapa sin tapar demasiado.
///
/// Uso:
/// ```dart
/// MarkerLayer(markers: [
///   sfitBusMarker(point: pos, zoom: _currentZoom, isOffRoute: false),
/// ])
/// ```
Marker sfitBusMarker({
  required LatLng point,
  required double zoom,
  bool isOffRoute = false,
  double rotation = 0,
}) {
  final size = SfitMapStyle.busMarkerSize(zoom);
  final color = isOffRoute ? AppColors.noApto : AppColors.gold;
  final iconSize = size * 0.5;
  final borderWidth = size < 30 ? 1.6 : 2.5;
  return Marker(
    point: point,
    width: size,
    height: size,
    alignment: Alignment.center,
    child: Container(
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: borderWidth),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: size * 0.25,
            spreadRadius: size * 0.06,
          ),
        ],
      ),
      child: Transform.rotate(
        angle: rotation,
        child: Icon(
          Icons.navigation_rounded,
          color: Colors.white,
          size: iconSize,
        ),
      ),
    ),
  );
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
