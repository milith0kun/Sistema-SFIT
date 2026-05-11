# SFIT — Documentación para Google Play

## Permissions Declaration Form

Esta sección documenta el uso de los permisos restringidos que SFIT solicita
y por qué cada uno es **estrictamente necesario** para la funcionalidad
principal de la app. Copiar/pegar al subir una nueva versión.

### `ACCESS_BACKGROUND_LOCATION`

- **Functionality**: Registro continuo de la posición del bus durante el
  turno del conductor (incluso con pantalla apagada o app en background).
- **User-facing feature**: "Iniciar turno" → tracking GPS en vivo del bus
  para que los pasajeros vean el bus en tiempo real y las municipalidades
  fiscalicen el cumplimiento de la ruta.
- **Frequency**: Solo durante un turno activo (típicamente 4–12 horas/día).
- **Disclosure to users**: Pantalla de checkin del conductor explica el
  uso antes de pedir el permiso.
- **Justification**: Ley peruana de transporte público (D.S. 017-2009-MTC
  y normativa municipal) requiere tracking GPS continuo de unidades de
  transporte público. SFIT es el sistema de fiscalización adoptado por
  municipalidades del Cusco y otras provincias del país.

### `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

- **Functionality**: Solicitar al usuario excluir SFIT del Doze mode para
  que el GPS no se pause durante turnos largos.
- **User-facing feature**: Diálogo "Mantén el GPS activo" durante el
  checkin del primer turno; CTA "Configurar" abre el ajuste estándar de
  Android. El usuario PUEDE rechazar — la app no bloquea el inicio.
- **Frequency**: Una sola vez (flag persistido en SharedPreferences).
- **Justification**: Sin esta exclusión, Android 6+ entra en Doze mode
  después de pocos minutos sin movimiento y pausa el foreground service
  del GPS. En rutas interdepartamentales largas (Cusco→Lima, Cusco→Juliaca),
  el bus permanece largos tramos sin movimiento aparente (atascos,
  paradas regulatorias) y Android pausaría el tracking — el sistema
  fiscalizador perdería minutos enteros del recorrido, violando el SLA
  regulatorio. La exemption es la única forma robusta de garantizar
  tracking continuo en Android sin esto.
- **Alternativas evaluadas**: WorkManager periodic task — funciona como
  watchdog pero no permite re-iniciar el GPS desde un isolate sin
  intervención del usuario. AlarmManager — no soportado por Flutter
  geolocator. Conclusión: la exemption es necesaria, no opcional.

### `FOREGROUND_SERVICE_LOCATION` (Android 14+)

- Tipo específico requerido para foreground services que acceden a
  ubicación. Ya estándar en cualquier app de tracking.

### `SCHEDULE_EXACT_ALARM`

- Usado por WorkManager para garantizar que el task `trackingWatchdog`
  corra cada 15 minutos. Sin esto, Android puede agrupar/postergar el
  task indefinidamente.
- **Frequency**: Una sola alarma cada 15 minutos.
- **Justification**: El watchdog DETECTA cuando el tracking se cae
  (kill, OEM, doze) y notifica al conductor para que reabra la app.
  Crítico para no perder datos del turno.

### `POST_NOTIFICATIONS` (Android 13+)

- Necesario para mostrar:
  1. Notificación persistente del foreground service "SFIT — Turno en curso".
  2. Notificación de alerta del watchdog "Tracking detenido — toca para reanudar".
  3. Notificaciones FCM de la municipalidad / operador.

---

## Screenshots a adjuntar en el form

1. Pantalla "Mantén el GPS activo" (diálogo durante checkin).
2. Pantalla "Diagnóstico de tracking" mostrando estado de battery exemption.
3. Notificación del foreground service "SFIT — Turno en curso".
4. Pantalla del conductor con el badge "Turno activo" visible.

---

## Versión

Última revisión: 2026-05-11. Bump esta fecha en cada release que toque
permisos restringidos.
