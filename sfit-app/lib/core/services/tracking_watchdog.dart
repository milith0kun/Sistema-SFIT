import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

/// Tarea periódica de WorkManager que actúa como "watchdog" del tracking GPS.
///
/// **Problema que resuelve**: si Android mata el proceso de SFIT por memory
/// pressure (raro pero posible en celulares low-end), o el usuario reinicia
/// el teléfono durante un turno activo, o un OEM hostil bota el foreground
/// service silenciosamente, el conductor no se entera hasta que cierra
/// turno horas después y ve un trazo vacío. El watchdog corre cada 15min
/// (mínimo de WorkManager) en un isolate separado del proceso principal:
/// abre el Hive box `location_track_v2` y la SharedPreferences, comprueba
/// si hay un `active_entry_id_v1` registrado, y si el último ping persistido
/// es de hace >5min, dispara una notificación local de alta prioridad para
/// que el conductor reabra la app y reanude el tracking.
///
/// **Lo que NO hace**: no intenta re-arrancar `getPositionStream` desde el
/// isolate de WorkManager (no funciona — el geolocator necesita main
/// isolate con permisos y BuildContext). Solo notifica.
///
/// **Coexistencia con el foreground service**: WorkManager y los foreground
/// services de Geolocator corren en componentes Android distintos sin
/// compartir lifecycle. No hay race conditions ni recursos compartidos
/// excepto SharedPreferences y Hive (ambos seguros para acceso multi-proceso).

/// Nombre del task registrado en WorkManager. La constraint es
/// `existingWorkPolicy: keep` para que no se re-registre cada arranque
/// (perdería su próximo schedule).
const String trackingWatchdogTaskName = 'sfit_tracking_watchdog_v1';

/// Identificador interno del task que recibe el callback dispatcher.
const String _kWatchdogTag = 'trackingWatchdog';

/// Canal de notificaciones para alertas del watchdog. Independiente del
/// canal `sfit_tracking` del foreground service para que el usuario pueda
/// silenciar uno sin silenciar el otro.
const String _kAlertChannelId = 'sfit_tracking_alert';
const String _kAlertChannelName = 'Alertas de tracking GPS';

/// Callback dispatcher de WorkManager. Debe estar a nivel top-level y con
/// la anotación `@pragma('vm:entry-point')` porque corre en un isolate
/// separado sin acceso al tree de widgets.
@pragma('vm:entry-point')
void trackingWatchdogCallbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    if (taskName != _kWatchdogTag) return true;
    try {
      await _runWatchdog();
    } catch (e, st) {
      debugPrint('[TrackingWatchdog] error: $e\n$st');
    }
    return true;
  });
}

/// Lógica principal del watchdog. Lee estado persistido y notifica si
/// hay gap en el tracking.
Future<void> _runWatchdog() async {
  // Hive necesita inicializarse en cada isolate. `initFlutter()` es
  // idempotente — si ya está abierto en el isolate principal no rompe.
  await Hive.initFlutter();

  // 1. ¿Hay un turno activo persistido?
  final prefs = await SharedPreferences.getInstance();
  final activeEntryId = prefs.getString('active_entry_id_v1');
  if (activeEntryId == null) return;

  // 2. Leer último ping persistido para ese entryId.
  Box? trackBox;
  try {
    trackBox = await Hive.openBox('location_track_v2');
  } catch (_) {
    return;
  }
  final raw = trackBox.get(activeEntryId);
  if (raw is! List || raw.isEmpty) return;

  final last = raw.last;
  if (last is! Map) return;
  final tsRaw = last['ts'];
  DateTime? lastTs;
  if (tsRaw is String) {
    lastTs = DateTime.tryParse(tsRaw);
  } else if (tsRaw is int) {
    lastTs = DateTime.fromMillisecondsSinceEpoch(tsRaw);
  }
  if (lastTs == null) return;

  // 3. Si llevamos >5min sin ping, alertar al usuario.
  final gap = DateTime.now().difference(lastTs);
  if (gap < const Duration(minutes: 5)) return;

  await _notifyTrackingStalled(gap);
}

Future<void> _notifyTrackingStalled(Duration gap) async {
  final plugin = FlutterLocalNotificationsPlugin();
  const initSettings = InitializationSettings(
    android: AndroidInitializationSettings('@mipmap/ic_launcher'),
  );
  try {
    await plugin.initialize(initSettings);
  } catch (_) {/* ya inicializado en main isolate, ignorar */}

  const androidDetails = AndroidNotificationDetails(
    _kAlertChannelId,
    _kAlertChannelName,
    channelDescription:
        'Notificaciones cuando el tracking GPS deja de reportar durante un turno activo.',
    importance: Importance.high,
    priority: Priority.high,
    category: AndroidNotificationCategory.alarm,
    ongoing: false,
    autoCancel: true,
  );

  await plugin.show(
    9001,
    'Tracking detenido',
    'No se ha registrado tu posición en ${gap.inMinutes} min. '
        'Abre SFIT para reanudar el tracking.',
    const NotificationDetails(android: androidDetails),
  );
}

/// Registra la tarea periódica al boot de la app. Llamar UNA VEZ desde
/// `main.dart` después de `Hive.initFlutter()`.
///
/// `frequency` mínimo soportado por WorkManager es 15 minutos. Si el
/// usuario quiere algo más fino tendría que usar `AlarmManager` directo
/// (no soportado por este plugin Flutter).
Future<void> registerTrackingWatchdog() async {
  await Workmanager().initialize(trackingWatchdogCallbackDispatcher);
  await Workmanager().registerPeriodicTask(
    trackingWatchdogTaskName,
    _kWatchdogTag,
    frequency: const Duration(minutes: 15),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    constraints: Constraints(networkType: NetworkType.notRequired),
    initialDelay: const Duration(minutes: 5),
  );
}
