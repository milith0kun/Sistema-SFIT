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
    Map<String, String>? headers,
    this.maxAge = const Duration(days: 30),
  }) : super(headers: headers ?? const {});

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
      } catch (e) {
        // Sin red: si tenemos el archivo aunque esté vencido, lo usamos.
        if (await file.exists()) {
          try {
            bytes = await file.readAsBytes();
          } catch (_) {/* fallthrough */}
        }
        if (bytes == null) rethrow;
      }
    }

    final finalBytes = bytes;
    if (finalBytes == null) {
      throw StateError('No se pudo obtener el tile ${coords.z}/${coords.x}/${coords.y}');
    }
    return decode(await ui.ImmutableBuffer.fromUint8List(finalBytes));
  }

  static Future<void> _safeWriteBytes(File file, Uint8List bytes) async {
    try {
      await file.writeAsBytes(bytes, flush: false);
    } catch (_) {/* silencioso */}
  }

  @override
  bool operator ==(Object other) =>
      other is _CachedTileImage && other.url == url;

  @override
  int get hashCode => url.hashCode;
}
