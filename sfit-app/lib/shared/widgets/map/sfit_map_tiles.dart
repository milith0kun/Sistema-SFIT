import 'package:flutter_map/flutter_map.dart';
import '../../../core/services/cached_tile_provider.dart';

/// Helpers de TileLayer compartidos por todas las pantallas con `FlutterMap`.
/// Centralizan la URL del proveedor + el cache offline en disco
/// (`CachedTileProvider`), de modo que cualquier zona ya visitada por el
/// usuario quede disponible aunque pierda la red.
///
/// Antes cada pantalla creaba su propio `TileLayer(...)` sin caché → al
/// perder señal el mapa quedaba en blanco.

const String _kCartoVoyagerUrl =
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';
const String _kCartoLightUrl =
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';
const String _kOsmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/// Tile de Carto Voyager (paleta neutra clara, ideal para mapas SFIT).
TileLayer sfitCartoVoyagerTile() => TileLayer(
      urlTemplate: _kCartoVoyagerUrl,
      subdomains: const ['a', 'b', 'c', 'd'],
      userAgentPackageName: 'com.sfit.sfit_app',
      tileProvider: CachedTileProvider(),
    );

/// Tile de Carto Light (más blanco, usado en mini-mapas de "Mis rutas").
TileLayer sfitCartoLightTile() => TileLayer(
      urlTemplate: _kCartoLightUrl,
      subdomains: const ['a', 'b', 'c', 'd'],
      userAgentPackageName: 'com.sfit.sfit_app',
      tileProvider: CachedTileProvider(),
    );

/// Tile de OpenStreetMap estándar.
TileLayer sfitOsmTile() => TileLayer(
      urlTemplate: _kOsmUrl,
      userAgentPackageName: 'com.sfit.sfit_app',
      tileProvider: CachedTileProvider(),
    );
