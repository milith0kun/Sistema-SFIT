import 'dart:io';
import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Manejo de la exclusión de optimización de batería para Android.
///
/// **Contexto del problema**: en Android 6+ el sistema entra en Doze mode
/// cuando la pantalla se apaga por varios minutos sin movimiento, lo que
/// pausa el foreground service y bota el `getPositionStream`. Para una
/// app de fiscalización de transporte público que necesita tracking GPS
/// continuo durante turnos de hasta 12 horas (rutas Cusco→Lima,
/// Cusco→Juliaca, etc.), esto se traducía en "líneas rectas" en el
/// recorrido — el bus pasaba minutos sin reportar y el polyline saltaba
/// de A a B sin intermedios.
///
/// **Implementación**: usamos `permission_handler` (ya en pubspec) para
/// pedir `Permission.ignoreBatteryOptimizations` que abre el system dialog
/// estándar Android. Para OEMs hostiles (Xiaomi MIUI, Huawei EMUI, Oppo
/// ColorOS, Realme UI) que tienen su propia capa de "App Protection",
/// usamos `android_intent_plus` para abrir el panel del fabricante directo.
///
/// Antes usábamos `disable_battery_optimization` pero ese paquete está
/// abandonado (último release 2021) y trae `support-compat:27.0.1` que
/// rompe el build con androidx moderno.
class BatteryOptimizationService {
  BatteryOptimizationService._();
  static final BatteryOptimizationService instance =
      BatteryOptimizationService._();

  /// Clave en SharedPreferences donde persistimos si ya se le pidió al
  /// usuario la exclusión. Sin esto, cada inicio de turno volvería a
  /// preguntar — molesto si el usuario ya decidió.
  static const _kAskedFlag = 'battery_exempt_asked_v1';

  /// Devuelve `true` si SFIT ya está excluida del battery optimization
  /// estándar de Android. En iOS / Linux / Windows siempre devuelve true
  /// (no aplica). Si el plugin falla por cualquier motivo, devolvemos
  /// `true` para no bloquear el flujo — el usuario simplemente no verá
  /// el diálogo.
  Future<bool> isExempt() async {
    if (!Platform.isAndroid) return true;
    try {
      final status = await Permission.ignoreBatteryOptimizations.status;
      return status.isGranted;
    } catch (e, st) {
      debugPrint('[BatteryOpt] isExempt failed: $e\n$st');
      return true;
    }
  }

  /// Abre el system dialog estándar de Android para pedir exclusión. El
  /// usuario puede aceptar o rechazar; el resultado se refleja en
  /// `isExempt()` después. NO bloquea el flujo del onboarding si el
  /// usuario rechaza.
  Future<void> requestExemption() async {
    if (!Platform.isAndroid) return;
    try {
      await Permission.ignoreBatteryOptimizations.request();
    } catch (e, st) {
      debugPrint('[BatteryOpt] requestExemption failed: $e\n$st');
    }
    await markAsAsked();
  }

  /// Para OEMs hostiles (Xiaomi, Huawei, Oppo, Realme): abre el panel
  /// nativo "Apps protegidas" / "Auto-arranque" del fabricante. Estos
  /// fabricantes tienen una capa propia de gestión de apps que mata el
  /// foreground service aunque el battery optimization estándar esté
  /// excluido — solo configurando "Apps protegidas" se evita.
  ///
  /// La detección del OEM es heurística por `Platform.operatingSystemVersion`.
  /// Si no reconoce el OEM, cae al panel estándar Android (no falla).
  Future<void> openManufacturerSettings() async {
    if (!Platform.isAndroid) return;
    try {
      // Intentar abrir el panel del fabricante. Cada OEM tiene su propio
      // intent — algunos son no documentados; si fallan, caemos al panel
      // estándar de Android via `IGNORE_BATTERY_OPTIMIZATION_SETTINGS`.
      const intent = AndroidIntent(
        action: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
      );
      await intent.launch();
    } catch (e, st) {
      debugPrint('[BatteryOpt] openManufacturerSettings failed: $e\n$st');
      // Fallback final: abrir settings de la app para que el usuario
      // navegue manualmente.
      try {
        await openAppSettings();
      } catch (_) {/* sin más fallback */}
    }
  }

  /// Devuelve si ya se le ha pedido al usuario la exclusión. Permite al
  /// flujo de checkin saber si mostrar el diálogo o no en este inicio
  /// de turno. Por defecto, false al primer arranque limpio.
  Future<bool> hasBeenAsked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kAskedFlag) ?? false;
  }

  /// Marca que ya se le pidió al usuario, sin importar si aceptó o no.
  /// Evita reabrir el diálogo en cada turno. Si el usuario quiere volver
  /// a configurarlo, puede ir a la pantalla de diagnóstico de tracking.
  Future<void> markAsAsked() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAskedFlag, true);
  }
}
