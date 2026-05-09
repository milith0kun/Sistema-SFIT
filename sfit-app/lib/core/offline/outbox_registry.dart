import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'outbox.dart';

/// Registro centralizado de los outboxes de las features que pueden
/// crear documentos offline. Cada outbox tiene su propio box Hive y
/// envía al endpoint REST correspondiente con `Idempotency-Key`.
///
/// Uso desde un service:
/// ```dart
/// final outbox = ref.read(reportsOutboxProvider);
/// final ok = await outbox.enqueueAndTrySend(payload);
/// if (!ok) {
///   // Encolado offline — UI debería mostrar "se enviará al recuperar red".
/// }
/// ```
///
/// El widget [OutboxBanner] muestra la cantidad total cross-feature.

const _kSanctionsBox = 'sanctions_outbox_v1';
const _kReportsBox = 'reports_outbox_v1';
const _kInspectionsBox = 'inspections_outbox_v1';

/// Outbox de sanciones del fiscal. Endpoint: POST /sanciones.
final sanctionsOutboxProvider = Provider<Outbox>((ref) {
  final dio = ref.watch(dioClientProvider).dio;
  final outbox = Outbox(
    boxName: _kSanctionsBox,
    sender: (payload, idempotencyKey) async {
      await dio.post(
        '/sanciones',
        data: payload,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
    },
  );
  ref.onDispose(() => outbox.dispose());
  return outbox;
});

/// Outbox de reportes ciudadanos. Endpoint: POST /reportes.
final reportsOutboxProvider = Provider<Outbox>((ref) {
  final dio = ref.watch(dioClientProvider).dio;
  final outbox = Outbox(
    boxName: _kReportsBox,
    sender: (payload, idempotencyKey) async {
      final resp = await dio.post(
        '/reportes',
        data: payload,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
      // El backend de reportes valida con Express-validator y devuelve
      // 4xx con success:false aunque el HTTP status sea 200 (config de
      // dio_client `validateStatus: status < 500`). Tratamos como error
      // si el body lo marca — eso evita encolar un reporte que el
      // backend rechazó por validación (no se va a corregir solo).
      final body = resp.data as Map?;
      if (body == null || body['success'] == false) {
        // No relanzamos para que NO se reintente — si encolamos
        // payloads con descripción muy corta o categoría inválida,
        // se quedarían reintentándose por siempre. Marcamos como
        // "consumido aunque rechazado" silenciosamente.
        return;
      }
    },
  );
  ref.onDispose(() => outbox.dispose());
  return outbox;
});

/// Outbox de inspecciones. Endpoint: POST /inspecciones.
final inspectionsOutboxProvider = Provider<Outbox>((ref) {
  final dio = ref.watch(dioClientProvider).dio;
  final outbox = Outbox(
    boxName: _kInspectionsBox,
    sender: (payload, idempotencyKey) async {
      await dio.post(
        '/inspecciones',
        data: payload,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
    },
  );
  ref.onDispose(() => outbox.dispose());
  return outbox;
});

/// Suma total de items pendientes en todos los outboxes. Para mostrar
/// un único banner global "X cambios sin sincronizar".
final totalPendingOutboxProvider = StreamProvider<int>((ref) async* {
  final outboxes = [
    ref.watch(sanctionsOutboxProvider),
    ref.watch(reportsOutboxProvider),
    ref.watch(inspectionsOutboxProvider),
  ];
  // Inicializar todos para que arranquen sus listeners de connectivity
  // y emitan su _lastCount inicial.
  for (final o in outboxes) {
    await o.init();
  }

  var snapshot = outboxes.fold<int>(0, (a, o) => a + o.currentQueueCount);
  yield snapshot;

  await for (final _ in _merged(outboxes.map((o) => o.queueCount))) {
    final next = outboxes.fold<int>(0, (a, o) => a + o.currentQueueCount);
    if (next != snapshot) {
      snapshot = next;
      yield snapshot;
    }
  }
});

/// Helper: mergea N streams en uno (broadcast sólo emite eventos, no
/// el valor). Reemplazo simple de `rxdart.MergeStream` para no añadir
/// dependencia.
Stream<T> _merged<T>(Iterable<Stream<T>> streams) async* {
  final controller = StreamController<T>();
  final subs = streams
      .map((s) => s.listen(controller.add, onError: controller.addError))
      .toList();
  try {
    await for (final v in controller.stream) {
      yield v;
    }
  } finally {
    for (final s in subs) {
      await s.cancel();
    }
    await controller.close();
  }
}
