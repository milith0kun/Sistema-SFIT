import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:path_provider/path_provider.dart';

/// `TileProvider` para `flutter_map` que cachea los tiles en disco.
///
/// Diseñado para no requerir paquetes nuevos (usa `dio` + `path_provider`
/// ya presentes en el proyecto). Cuando se solicita un tile:
///   1. Busca en `<appCacheDir>/sfit_tiles/{z}/{x}-{y}.png`.
///   2. Si existe y está dentro del TTL, lo sirve sin red.
///   3. Si no, lo descarga, lo guarda y lo devuelve.
///   4. Si no hay red pero el archivo existe vencido, lo sirve igualmente
///      (mejor mostrar un tile viejo que pantalla blanca).
///
/// Permite que los mapas funcionen offline en zonas que el usuario ya
/// visitó. Carto Voyager y OpenStreetMap permiten caching en cliente para
/// uso personal (TOS estándar).
class CachedTileProvider extends TileProvider {
  CachedTileProvider({
    super.headers,
    this.maxAge = const Duration(days: 30),
  });

  /// Edad máxima de un tile cacheado fresco. Pasado este tiempo se vuelve
  /// a pedir; si la red falla, igual se sirve el archivo viejo como
  /// fallback.
  final Duration maxAge;

  static Directory? _cacheDirMemo;
  static final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 12),
    responseType: ResponseType.bytes,
  ));

  /// Tope de tamaño del cache en disco. Pasado este límite se purgan los
  /// tiles más viejos hasta volver al 80% del tope. Evita que la caché crezca
  /// sin control y llene el storage del usuario en sesiones largas con mapas.
  static const int _maxCacheBytes = 200 * 1024 * 1024; // 200 MB
  static const int _maxCacheTargetBytes = 160 * 1024 * 1024; // 80% del tope

  /// Contador en memoria de bytes escritos desde la última verificación.
  /// Cuando supera 10MB ejecuta una purga asíncrona (sin bloquear el render).
  static int _bytesWrittenSinceCheck = 0;
  static const int _purgeCheckThreshold = 10 * 1024 * 1024; // 10 MB
  static bool _purging = false;

  static Future<Directory> _cacheDir() async {
    final cached = _cacheDirMemo;
    if (cached != null) return cached;
    final base = await getApplicationCacheDirectory();
    final dir = Directory('${base.path}/sfit_tiles');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    _cacheDirMemo = dir;
    return dir;
  }

  Future<File> _fileFor(TileCoordinates coords) async {
    final dir = await _cacheDir();
    final sub = Directory('${dir.path}/${coords.z}');
    if (!await sub.exists()) {
      await sub.create(recursive: true);
    }
    return File('${sub.path}/${coords.x}-${coords.y}.png');
  }

  @override
  ImageProvider getImage(TileCoordinates coords, TileLayer options) {
    final url = getTileUrl(coords, options);
    return _CachedTileImage(
      url: url,
      coords: coords,
      headers: headers,
      provider: this,
    );
  }
}

/// Metadata de un archivo del caché para el cómputo de purga LRU.
class _FileMeta {
  final File file;
  final int size;
  final DateTime modified;
  const _FileMeta(this.file, this.size, this.modified);
}

/// PNG 1×1 totalmente transparente. Sirve como fallback cuando el tile no
/// está disponible (sin red y sin caché), evitando que FlutterMap propague
/// la excepción al render tree y dispare el ErrorWidget global.
final Uint8List _kTransparentPng = Uint8List.fromList(const [
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

class _CachedTileImage extends ImageProvider<_CachedTileImage> {
  final String url;
  final TileCoordinates coords;
  final Map<String, String> headers;
  final CachedTileProvider provider;

  _CachedTileImage({
    required this.url,
    required this.coords,
    required this.headers,
    required this.provider,
  });

  @override
  Future<_CachedTileImage> obtainKey(ImageConfiguration configuration) {
    return SynchronousFuture<_CachedTileImage>(this);
  }

  @override
  ImageStreamCompleter loadImage(_CachedTileImage key, ImageDecoderCallback decode) {
    return MultiFrameImageStreamCompleter(
      codec: _loadAsync(decode),
      scale: 1.0,
      debugLabel: 'CachedTile(${coords.z}/${coords.x}/${coords.y})',
    );
  }

  Future<ui.Codec> _loadAsync(ImageDecoderCallback decode) async {
    final file = await provider._fileFor(coords);
    Uint8List? bytes;

    // 1) Intento de servir desde caché si existe y está fresco.
    if (await file.exists()) {
      try {
        final stat = await file.stat();
        final age = DateTime.now().difference(stat.modified);
        if (age <= provider.maxAge) {
          bytes = await file.readAsBytes();
        }
      } catch (_) {
        // Lectura falló — caer al fetch de red.
      }
    }

    // 2) Sin caché válido → descargar.
    if (bytes == null) {
      try {
        final resp = await CachedTileProvider._dio.get<List<int>>(
          url,
          options: Options(headers: headers, responseType: ResponseType.bytes),
        );
        final body = resp.data;
        if (body != null && body.isNotEmpty) {
          bytes = Uint8List.fromList(body);
          // Escritura best-effort en disco; si falla no rompemos el render.
          unawaited(_safeWriteBytes(file, bytes));
        }
      } catch (_) {
        // Sin red: si tenemos el archivo aunque esté vencido, lo usamos.
        if (await file.exists()) {
          try {
            bytes = await file.readAsBytes();
          } catch (_) {/* fallthrough */}
        }
      }
    }

    // 3) Fallback final: si no logramos obtener bytes, devolvemos un tile
    // transparente 1×1 en lugar de throw. Throw aquí burbujea al render
    // tree de FlutterMap y dispara el ErrorWidget.builder global, matando
    // toda la card que contiene el mini-mapa. Mejor mostrar mapa sin tile
    // (polyline visible) que romper el subtree entero.
    final finalBytes = bytes ?? _kTransparentPng;
    return decode(await ui.ImmutableBuffer.fromUint8List(finalBytes));
  }

  static Future<void> _safeWriteBytes(File file, Uint8List bytes) async {
    try {
      await file.writeAsBytes(bytes, flush: false);
      CachedTileProvider._bytesWrittenSinceCheck += bytes.length;
      if (CachedTileProvider._bytesWrittenSinceCheck >=
              CachedTileProvider._purgeCheckThreshold &&
          !CachedTileProvider._purging) {
        CachedTileProvider._bytesWrittenSinceCheck = 0;
        unawaited(_maybePurge());
      }
    } catch (_) {/* silencioso */}
  }

  /// Purga LRU: si el directorio supera `_maxCacheBytes`, borra los archivos
  /// modificados hace más tiempo hasta bajar a `_maxCacheTargetBytes`. Se
  /// ejecuta en background y nunca bloquea el render del mapa.
  static Future<void> _maybePurge() async {
    if (CachedTileProvider._purging) return;
    CachedTileProvider._purging = true;
    try {
      final dir = await CachedTileProvider._cacheDir();
      final entries = <_FileMeta>[];
      int total = 0;
      await for (final ent in dir.list(recursive: true, followLinks: false)) {
        if (ent is! File) continue;
        try {
          final stat = await ent.stat();
          entries.add(_FileMeta(ent, stat.size, stat.modified));
          total += stat.size;
        } catch (_) {/* skip */}
      }
      if (total <= CachedTileProvider._maxCacheBytes) return;
      entries.sort((a, b) => a.modified.compareTo(b.modified));
      var remaining = total;
      for (final m in entries) {
        if (remaining <= CachedTileProvider._maxCacheTargetBytes) break;
        try {
          await m.file.delete();
          remaining -= m.size;
        } catch (_) {/* skip */}
      }
    } catch (_) {/* silencioso */} finally {
      CachedTileProvider._purging = false;
    }
  }

  @override
  bool operator ==(Object other) =>
      other is _CachedTileImage && other.url == url;

  @override
  int get hashCode => url.hashCode;
}
