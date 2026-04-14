# SFIT — Sistema de Fiscalización Inteligente de Transporte
## Captura de Requerimientos del Sistema — v1.2

**Stack:** Next.js 15 + Flutter + MongoDB Atlas  
**Fecha:** Abril 2026  
**Estado:** Levantamiento inicial completo

---

## Contenido

1. [Descripción general](#1-descripción-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Jerarquía geográfica](#3-jerarquía-geográfica)
4. [Tipos de vehículos y reportes](#4-tipos-de-vehículos-y-reportes)
5. [Roles y actores](#5-roles-y-actores)
6. [Módulos del sistema](#6-módulos-del-sistema)
7. [Requerimientos funcionales](#7-requerimientos-funcionales)
8. [Requerimientos no funcionales](#8-requerimientos-no-funcionales)
9. [Restricciones](#9-restricciones)

---

## 1. Descripción general

SFIT es una plataforma multi-tenant para la fiscalización y gestión del transporte y flota vehicular municipal. Una instancia única del sistema sirve a múltiples municipalidades organizadas bajo una jerarquía provincial, de modo que la provincia tiene visibilidad global y cada municipalidad opera de forma aislada sobre sus propios recursos.

El sistema gestiona cualquier tipo de vehículo que opere bajo jurisdicción municipal: transporte público de pasajeros, vehículos de limpieza y residuos, vehículos de emergencia y maquinaria municipal. Cada tipo de vehículo tiene sus propios formularios de inspección, checklists y tipos de reporte asociados, todos configurables por el Admin Municipal.

El registro de usuarios es abierto: cualquier persona crea su cuenta con Google o correo e indica el rol que solicita. El Admin Municipal aprueba, asigna o rechaza ese rol. Ningún usuario opera en el sistema sin habilitación previa del administrador.

La plataforma incorpora inteligencia artificial en los puntos donde reduce fricción real: extracción de datos desde fotos de documentos, sugerencias en inspecciones según historial, análisis de patrones en reportes ciudadanos, y asistencia en la descripción de reportes e incidentes.

El Operador de Empresa tiene un módulo de gestión de flota propio donde registra las entradas y salidas diarias de sus vehículos, controla el estado de aptitud de sus conductores, y accede a reportes operacionales diarios, semanales y mensuales de toda su flota.

### Capacidades principales

- Jerarquía geográfica: Provincia supervisa todas sus municipalidades
- Gestión de cualquier tipo de vehículo municipal con formularios configurables por tipo
- Registro de usuarios con Google o correo, solicitud de rol y aprobación por el Admin Municipal
- Llenado automático con IA desde fotos de documentos (DNI, licencia, tarjeta de circulación, SOAT)
- Gestión completa de flota para el Operador: entradas/salidas, estado de conductores, reportes diarios/semanales/mensuales
- Control de rutas y viajes con validación pre-salida
- Fiscalización en campo mediante QR dinámico firmado con HMAC-SHA256
- Vista pública del estado de un vehículo y su conductor para cualquier ciudadano
- Reportes ciudadanos con sistema anti-fraude de cinco capas, diferenciados por tipo de vehículo
- Motor de evaluación de fatiga del conductor (FatigueEngine)
- Sistema de sanciones con flujo de apelación
- Notificaciones multi-canal: WebSocket, push, WhatsApp y correo
- Sistema de reputación para conductores, vehículos y empresas
- Sistema de recompensas y gamificación para ciudadanos
- Reportes estadísticos con exportación CSV

---

## 2. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend web | Next.js 15 + TypeScript + Tailwind CSS | Renderizado híbrido SSR/SSG, App Router, excelente rendimiento para paneles administrativos |
| App móvil | Flutter 3 + Dart | Una sola base de código para Android e iOS; ideal para uso en campo |
| Backend / API | Next.js 15 API Routes + Server Actions | Frontend y backend en el mismo repositorio con TypeScript compartido |
| Base de datos | MongoDB Atlas | Flexible para esquemas multi-tenant con jerarquía provincial, aggregations para reportes de flota |
| Autenticación | NextAuth.js (web) + JWT personalizado (móvil) | NextAuth con soporte nativo a Google OAuth; JWT con refresh token para Flutter |
| IA — OCR y extracción | Google Cloud Vision API o AWS Textract | Extracción de texto desde fotos de documentos: DNI, licencia, tarjeta de circulación, SOAT |
| IA — Análisis y sugerencias | Claude API (Anthropic) | Estructuración de datos extraídos, sugerencias en inspecciones, análisis de patrones en reportes |
| Tiempo real | Socket.io | Notificaciones en vivo: alertas de fatiga, reportes ciudadanos, cambios de estado de flota |
| Caché / Throttling | Redis (Upstash) | Rate limiting por usuario y caché de consultas frecuentes |
| Notificaciones | WhatsApp API + SMTP (Resend) | Alertas críticas fuera del panel: sanciones, vehículos fuera de servicio |
| QR | HMAC-SHA256 + QR Code | Firma criptográfica para validación de vehículos incluso sin conexión |
| Infraestructura | Vercel + MongoDB Atlas | Despliegue serverless; base de datos gestionada en nube |

---

## 3. Jerarquía geográfica

```
Provincia
  └── Municipalidad A
  │     ├── Empresa de Transporte / Flota Municipal
  │     │     ├── Vehículos (por tipo)
  │     │     └── Conductores
  │     ├── Fiscales / Inspectores
  │     └── Ciudadanos
  └── Municipalidad B
        └── ...
```

### Niveles de acceso por jerarquía

| Nivel | Rol | Visibilidad |
|---|---|---|
| Plataforma | Super Admin | Todas las provincias y municipalidades |
| Provincia | Admin Provincial | Todas las municipalidades de su provincia |
| Municipalidad | Admin Municipal | Solo su municipalidad |
| Empresa | Operador de Empresa | Solo su flota dentro de la municipalidad |
| Campo | Fiscal / Inspector | Vehículos y conductores de su municipalidad |
| Ciudadano | Ciudadano | Vista pública + sus propios reportes |
| Conductor | Conductor | Solo su perfil, rutas asignadas y sus viajes |

---

## 4. Tipos de vehículos y reportes

El Admin Municipal define los tipos de vehículos que opera su municipalidad. Cada tipo tiene sus propios formularios de inspección, checklists de pre-salida y categorías de reporte ciudadano.

### Tipos de vehículos predefinidos

| Tipo | Descripción | Reportes ciudadanos asociados |
|---|---|---|
| Transporte público | Buses, combis, colectivos de rutas concesionadas | Conducción peligrosa, cobro indebido, sobrecarga de pasajeros, mal estado del vehículo |
| Limpieza y residuos | Camiones de basura, barredoras, volquetes de residuos | Ruta no cubierta, derrame de residuos, mal manejo de desechos, horario incumplido |
| Emergencia | Ambulancias, vehículos de bomberos | Demora en atención, vehículo en mal estado |
| Maquinaria municipal | Retroexcavadoras, motoniveladoras, compactadoras | Trabajo no realizado, daño a infraestructura |
| Vehículo municipal general | Camionetas y sedanes de uso administrativo | Uso indebido del vehículo, conducción irresponsable |

### Tipos personalizados

El Admin Municipal puede crear tipos adicionales de vehículo con nombre, descripción, formularios de inspección propios y categorías de reporte ciudadano específicas, sin modificar el código base del sistema.

---

## 5. Roles y actores

| Rol | Descripción | Plataforma |
|---|---|---|
| Super Admin | Administrador de la plataforma completa. Gestiona provincias y municipalidades. | Web |
| Admin Provincial | Administrador de una provincia. Ve estadísticas agregadas de todas sus municipalidades y puede intervenir en casos escalados. | Web |
| Admin Municipal | Administrador de una municipalidad. Aprueba usuarios, asigna roles, configura tipos de vehículos y gestiona todos los recursos de su jurisdicción. | Web |
| Fiscal / Inspector | Realiza inspecciones en campo, escanea QR, emite actas y verifica el estado de vehículos y conductores. | Web + Móvil |
| Operador de Empresa | Gestiona la flota de su empresa: registro de conductores y vehículos, entradas/salidas diarias, control de aptitud de conductores y reportes operacionales. | Web + Móvil |
| Conductor | Conductor registrado. Ve sus rutas asignadas, historial de viajes y estado de fatiga. Confirma viajes asignados. | Móvil |
| Empresa de Transporte | Entidad jurídica registrada. No es un actor autenticado; es gestionada por el Admin Municipal y el Operador. | — |
| Ciudadano | Usuario final que envía reportes según el tipo de vehículo, consulta el estado de vehículos y acumula recompensas. | Móvil + Web (vista pública) |

### Flujo de registro y aprobación de usuarios

```
Usuario se registra (Google o correo)
  └── Indica municipalidad y rol solicitado (conductor, operador, ciudadano)
        └── Queda en estado PENDIENTE
              └── Admin Municipal revisa la solicitud
                    ├── Aprueba → asigna rol → usuario activo
                    └── Rechaza → usuario notificado con motivo
```

---

## 6. Módulos del sistema

| Módulo | Web | Móvil |
|---|---|---|
| Autenticación y registro de usuarios | Sí | Sí |
| Gestión de provincias | Sí (Super Admin + Admin Provincial) | No |
| Gestión de municipalidades | Sí (Admin Provincial + Super Admin) | No |
| Tipos de vehículos y formularios | Sí (Admin Municipal) | No |
| Empresas de transporte / flotas | Sí | No |
| Conductores | Sí | Sí (perfil propio) |
| Vehículos y QR | Sí | Escaneo QR |
| Rutas | Sí | Sí (Conductor ve sus rutas) |
| Gestión de flota del Operador | Sí | Sí |
| Viajes | Sí | Sí (Operador y Conductor) |
| Vista pública de vehículo / conductor | Sí (pública) | Sí (pública) |
| Fiscalización / Inspecciones | Sí | Sí (Fiscal) |
| Reportes ciudadanos (por tipo de vehículo) | Gestión | Envío (Ciudadano) |
| Sanciones | Sí | Consulta |
| FatigueEngine | Automático | Alerta (Conductor) |
| Reputación | Sí | Consulta |
| Recompensas y gamificación | Gestión | Sí (Ciudadano) |
| Llenado automático con IA | Sí (registro) | Sí (registro e inspección) |
| Notificaciones | WebSocket | Push |
| Reportes estadísticos | Sí | No |

---

## 7. Requerimientos funcionales

### RF-01 — Autenticación y registro de usuarios

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-01-01 | Registro con Google | El usuario crea su cuenta usando Google OAuth desde la web o la app. | Alta | Todos |
| RF-01-02 | Registro con correo y contraseña | El usuario registra nombre, correo, contraseña y municipalidad. | Alta | Todos |
| RF-01-03 | Solicitud de rol al registrarse | Al registrarse, el usuario indica el rol que solicita: conductor, operador o ciudadano. Queda en estado PENDIENTE. | Alta | Todos |
| RF-01-04 | Aprobación de usuarios | El Admin Municipal ve solicitudes pendientes, revisa datos y aprueba o rechaza, asignando el rol definitivo. | Alta | Admin Municipal |
| RF-01-05 | Notificación de resultado | El sistema notifica por correo y push cuando la solicitud es aprobada o rechazada. | Alta | Sistema |
| RF-01-06 | Inicio de sesión web | Autenticación con Google o correo desde el panel web. | Alta | Super Admin, Admin Provincial, Admin Municipal, Fiscal, Operador |
| RF-01-07 | Inicio de sesión móvil | Autenticación con Google o correo desde la app Flutter. | Alta | Fiscal, Operador, Conductor, Ciudadano |
| RF-01-08 | Refresh token | Access token: 15 minutos. Refresh token: 7 días. Renovación automática. | Alta | Todos |
| RF-01-09 | Recuperación de contraseña | Enlace de recuperación por correo. No aplica para cuentas de Google. | Media | Todos |
| RF-01-10 | Cierre de sesión | El token queda invalidado de inmediato. | Alta | Todos |
| RF-01-11 | Aislamiento por tenant | Cada sesión está vinculada a una municipalidad. No hay acceso entre tenants. | Alta | Sistema |
| RF-01-12 | Perfil de usuario | El usuario puede editar foto, nombre y datos de contacto. | Media | Todos |

---

### RF-02 — Gestión de provincias y municipalidades

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-02-01 | Crear provincia | El Super Admin registra una provincia con nombre, región y límites geográficos. | Alta | Super Admin |
| RF-02-02 | Asignar Admin Provincial | El Super Admin crea o asigna el usuario con rol Admin Provincial a una provincia. | Alta | Super Admin |
| RF-02-03 | Dashboard provincial | El Admin Provincial ve estadísticas agregadas de todas sus municipalidades: vehículos activos, conductores en estado RIESGO, sanciones del mes, reportes pendientes y flota por tipo. | Alta | Admin Provincial |
| RF-02-04 | Crear municipalidad | El Admin Provincial o Super Admin registra una municipalidad con nombre, logo, límites geográficos y configuración inicial. | Alta | Super Admin, Admin Provincial |
| RF-02-05 | Editar municipalidad | Actualización de datos y configuración de una municipalidad. | Alta | Admin Provincial, Super Admin |
| RF-02-06 | Activar / desactivar municipalidad | Suspende o rehabilita una municipalidad, bloqueando el acceso de todos sus usuarios. | Alta | Super Admin, Admin Provincial |
| RF-02-07 | Dashboard global (Super Admin) | Métricas agregadas de todas las provincias y municipalidades. | Alta | Super Admin |

---

### RF-03 — Tipos de vehículos y formularios

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-03-01 | Seleccionar tipos de vehículo | El Admin Municipal activa los tipos de vehículo que opera su municipalidad desde los tipos predefinidos: transporte público, limpieza, emergencia, maquinaria y vehículo municipal general. | Alta | Admin Municipal |
| RF-03-02 | Crear tipo personalizado | El Admin Municipal puede crear un tipo de vehículo adicional con nombre, descripción e ícono. | Media | Admin Municipal |
| RF-03-03 | Configurar checklist por tipo | El Admin Municipal define los puntos obligatorios del checklist de pre-salida para cada tipo de vehículo. | Alta | Admin Municipal |
| RF-03-04 | Configurar formulario de inspección por tipo | El Admin Municipal define los puntos de revisión del formulario de inspección para cada tipo de vehículo. Los campos pueden ser: booleano (cumple/no cumple), escala (1-5) o texto libre. | Alta | Admin Municipal |
| RF-03-05 | Configurar categorías de reporte ciudadano por tipo | El Admin Municipal define las categorías de reporte que los ciudadanos pueden usar para cada tipo de vehículo. | Alta | Admin Municipal |

---

### RF-04 — Empresas de transporte y flotas

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-04-01 | Registrar empresa / flota | Alta con razón social, RUC, representante legal, tipo de flota que opera y documentos. | Alta | Admin Municipal |
| RF-04-02 | Editar empresa | Actualización de datos y documentos. | Alta | Admin Municipal |
| RF-04-03 | Ver perfil de empresa | Vista con vehículos por tipo, conductores, sanciones activas y puntaje de reputación. | Alta | Admin Municipal, Fiscal |
| RF-04-04 | Listar empresas | Listado paginado con filtros por tipo de flota, estado y nivel de reputación. | Alta | Admin Municipal |
| RF-04-05 | Suspender empresa | Bloquea la empresa impidiendo el registro de nuevos viajes o salidas de flota. | Alta | Admin Municipal |

---

### RF-05 — Conductores

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-05-01 | Registrar conductor manualmente | Alta con DNI, licencia, categoría, fecha de vencimiento, foto y empresa asignada. | Alta | Admin Municipal, Operador |
| RF-05-02 | Autocompletar desde foto del DNI | La IA extrae nombre completo, número de documento y fecha de nacimiento, y pre-rellena el formulario. El usuario revisa y confirma. | Alta | Admin Municipal, Operador |
| RF-05-03 | Autocompletar desde foto de licencia | La IA extrae número de licencia, categoría y fecha de vencimiento. | Alta | Admin Municipal, Operador |
| RF-05-04 | Autocompletar desde foto del SOAT | La IA extrae número de póliza, vigencia y empresa aseguradora. | Alta | Admin Municipal, Operador |
| RF-05-05 | Indicador de confianza en extracción | Cada campo extraído muestra un indicador de confianza (alta, media, baja). Los campos con confianza baja se resaltan para verificación. | Alta | Sistema |
| RF-05-06 | Editar conductor | Actualización de datos. El sistema alerta 30 días antes del vencimiento de la licencia. | Alta | Admin Municipal, Operador |
| RF-05-07 | Perfil del conductor (vista propia) | El conductor ve en la app su estado de fatiga, rutas asignadas del día, historial de viajes y sus sanciones. | Alta | Conductor |
| RF-05-08 | Ver perfil del conductor (vista admin) | Vista completa con historial, sanciones, alertas de fatiga y puntaje de reputación. | Alta | Admin Municipal, Fiscal, Operador |
| RF-05-09 | Estado del conductor | Estado calculado por el FatigueEngine: APTO, RIESGO o NO_APTO. | Alta | Sistema |
| RF-05-10 | Listar conductores por empresa | Listado filtrable por estado (APTO / RIESGO / NO_APTO), empresa y municipalidad. | Alta | Admin Municipal, Fiscal, Operador |

---

### RF-06 — Vehículos

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-06-01 | Registrar vehículo manualmente | Alta con placa, tipo de vehículo, marca, modelo, año, capacidad y empresa asignada. | Alta | Admin Municipal, Operador |
| RF-06-02 | Autocompletar desde tarjeta de circulación | La IA extrae placa, marca, modelo, año y número de serie. El usuario revisa y confirma. | Alta | Admin Municipal, Operador |
| RF-06-03 | Autocompletar desde foto del SOAT vehicular | La IA extrae número de póliza, vigencia y empresa aseguradora del vehículo. | Alta | Admin Municipal, Operador |
| RF-06-04 | Generar QR del vehículo | Al registrar o actualizar un vehículo, el sistema genera un QR firmado con HMAC-SHA256 que incluye el tipo de vehículo. | Alta | Sistema |
| RF-06-05 | Descargar QR en PDF | Descarga del QR en PDF para imprimir y colocar en el vehículo. | Alta | Admin Municipal, Operador |
| RF-06-06 | Verificar QR offline | El Inspector escanea el QR sin conexión y el sistema verifica la firma HMAC localmente. | Alta | Fiscal |
| RF-06-07 | Ver perfil del vehículo | Historial de viajes o salidas, inspecciones, sanciones y puntaje de reputación. | Alta | Admin Municipal, Fiscal, Operador |
| RF-06-08 | Listar vehículos por tipo | Listado con filtros por tipo de vehículo, estado, empresa y ruta o zona asignada. | Alta | Admin Municipal, Fiscal, Operador |
| RF-06-09 | Estado de disponibilidad del vehículo | El vehículo puede estar en estado: DISPONIBLE, EN RUTA, EN MANTENIMIENTO o FUERA DE SERVICIO. El estado se actualiza automáticamente según las operaciones registradas. | Alta | Sistema |

---

### RF-07 — Gestión de flota del Operador

Este módulo es el núcleo operacional del Operador de Empresa. Le permite administrar el día a día de toda su flota: qué vehículos salen, con qué conductor, a qué hora, y en qué estado regresan.

#### Panel de flota diario

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-07-01 | Vista del panel de flota | El Operador ve en una sola pantalla el estado actual de toda su flota: vehículos disponibles, en ruta, en mantenimiento y fuera de servicio, agrupados por tipo. | Alta | Operador |
| RF-07-02 | Registrar salida de vehículo | El Operador registra la salida de un vehículo indicando: conductor asignado, ruta o zona, hora de salida y checklist de pre-salida completado. El sistema valida en tiempo real que el conductor esté en estado APTO antes de permitir el registro. | Alta | Operador |
| RF-07-03 | Checklist de pre-salida por tipo | Al registrar una salida, el Operador completa el checklist configurado para ese tipo de vehículo. No se puede registrar la salida si el checklist tiene puntos críticos sin marcar. | Alta | Operador |
| RF-07-04 | Registrar entrada / retorno | El Operador registra el retorno del vehículo indicando hora de llegada, kilometraje final, estado del vehículo al regreso y observaciones. | Alta | Operador |
| RF-07-05 | Registrar vehículo en mantenimiento | El Operador puede marcar un vehículo como EN MANTENIMIENTO, indicando el motivo, taller asignado y fecha estimada de retorno. | Alta | Operador |
| RF-07-06 | Registrar vehículo fuera de servicio | El Operador puede marcar un vehículo como FUERA DE SERVICIO con motivo y fecha estimada de resolución. El sistema notifica al Admin Municipal. | Alta | Operador |
| RF-07-07 | Asignar conductor a vehículo | El Operador asigna o reasigna el conductor habitual de cada vehículo. Solo puede asignar conductores en estado APTO. | Alta | Operador |
| RF-07-08 | Ver estado de aptitud de conductores | El Operador ve en tiempo real el estado de todos sus conductores: APTO, RIESGO o NO_APTO, con detalle de horas acumuladas y tiempo de descanso restante. | Alta | Operador |
| RF-07-09 | Alerta de conductor NO_APTO al asignar | Si el Operador intenta registrar una salida con un conductor en estado NO_APTO, el sistema bloquea la acción y muestra el tiempo de descanso restante necesario. | Alta | Sistema |

#### Reportes operacionales del Operador

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-07-10 | Reporte diario de flota | Vista y descarga del registro del día: vehículos que salieron, conductores asignados, horas de salida y retorno, kilómetros recorridos e incidencias registradas. | Alta | Operador |
| RF-07-11 | Reporte semanal de flota | Resumen de la semana: total de salidas por tipo de vehículo, conductores con mayor actividad, vehículos con más tiempo fuera de servicio e incidencias. Exportable en CSV. | Alta | Operador |
| RF-07-12 | Reporte mensual de flota | Resumen del mes: estadísticas de uso por vehículo, tasa de disponibilidad de flota, conductores en estado RIESGO o NO_APTO más frecuente, sanciones recibidas y comparativa con el mes anterior. Exportable en CSV. | Alta | Operador |
| RF-07-13 | Reporte de mantenimiento | Lista de vehículos que estuvieron o están en mantenimiento, con fechas, motivos y duración de cada evento. | Alta | Operador |
| RF-07-14 | Reporte de conductores | Estado actual y histórico de aptitud de todos los conductores de la empresa: días en estado APTO, RIESGO y NO_APTO, y número de bloqueos por fatiga. | Alta | Operador |
| RF-07-15 | Envío automático de reporte | El sistema puede enviar el reporte diario, semanal o mensual automáticamente al correo del Operador o Admin Municipal según la configuración. | Media | Sistema |
| RF-07-16 | Dashboard del Operador | Panel principal del Operador con: total de vehículos por estado, conductores APTOS disponibles ahora mismo, salidas del día, alertas activas y último reporte generado. | Alta | Operador |

---

### RF-08 — Vista pública de vehículo y conductor

Cualquier persona puede consultar si un vehículo está habilitado para operar sin necesidad de cuenta. El tipo de vehículo determina qué información se muestra y qué categorías de reporte se ofrecen.

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-08-01 | Escanear QR para vista pública | El ciudadano escanea el QR desde la app o la cámara del celular. | Alta | Público general |
| RF-08-02 | Buscar vehículo por placa | Cualquier persona busca un vehículo por placa desde la app o la web. | Alta | Público general |
| RF-08-03 | Vista pública del vehículo | Muestra: tipo de vehículo, empresa, ruta o zona asignada, estado (habilitado / suspendido), resultado de la última inspección y fecha. | Alta | Público general |
| RF-08-04 | Vista pública del conductor | Muestra: nombre, foto, categoría de licencia, estado de habilitación y puntaje de reputación. No expone DNI ni datos de contacto. | Alta | Público general |
| RF-08-05 | Indicador visual de estado | Verde (habilitado y en regla), amarillo (con observaciones), rojo (suspendido o no apto). | Alta | Público general |
| RF-08-06 | Categorías de reporte según tipo de vehículo | Al iniciar un reporte desde la vista pública, el sistema muestra las categorías de reporte configuradas para ese tipo de vehículo. Por ejemplo, para un camión de basura las categorías son distintas a las de un bus de transporte público. | Alta | Ciudadano |
| RF-08-07 | Reporte rápido desde vista pública | El ciudadano autenticado inicia un reporte directamente desde la vista pública del vehículo. | Alta | Ciudadano |

---

### RF-09 — Rutas y zonas

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-09-01 | Registrar ruta (transporte público) | Creación de ruta con origen, destino, paradas intermedias y vehículos habilitados. | Alta | Admin Municipal |
| RF-09-02 | Registrar zona de operación (otros tipos) | Para vehículos de limpieza, maquinaria y vehículos municipales, el Admin Municipal define zonas de operación en lugar de rutas fijas: nombre de zona, polígono geográfico aproximado y frecuencia esperada. | Alta | Admin Municipal |
| RF-09-03 | Ver rutas o zonas asignadas (conductor) | El conductor ve en la app sus rutas o zonas asignadas del día con detalle de horario y vehículo. | Alta | Conductor |
| RF-09-04 | Validación pre-salida | Al registrar una salida, el sistema verifica documentos vigentes, estado APTO del conductor y ruta o zona activa. | Alta | Sistema |
| RF-09-05 | Listar rutas y zonas | Vista con estado y estadísticas de uso. | Alta | Admin Municipal, Fiscal |

---

### RF-10 — Viajes y operaciones

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-10-01 | Iniciar viaje / operación | El Operador inicia un viaje o salida operacional asignando conductor, vehículo y ruta o zona. Se ejecuta validación pre-salida. | Alta | Operador |
| RF-10-02 | Confirmación del conductor | El conductor recibe una notificación push con los detalles y puede confirmar o reportar una observación antes de iniciar. | Alta | Conductor |
| RF-10-03 | Registrar llegada o retorno | El Operador o conductor registra el cierre con hora de llegada, kilómetros y observaciones. | Alta | Operador, Conductor |
| RF-10-04 | Auto-cierre | Si una operación no se cierra en el tiempo estimado más un margen configurable, el sistema la cierra automáticamente y genera una alerta. | Alta | Sistema |
| RF-10-05 | Ver operaciones en tiempo real | El Admin Municipal, Admin Provincial y Fiscal ven todas las operaciones activas. | Alta | Admin Municipal, Admin Provincial, Fiscal |
| RF-10-06 | Historial de operaciones | Listado con filtros por fecha, tipo de vehículo, ruta o zona, conductor y empresa. | Alta | Admin Municipal, Fiscal, Operador, Conductor |

---

### RF-11 — Fiscalización / Inspecciones

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-11-01 | Registrar inspección | El Fiscal completa el formulario de inspección configurado para el tipo de vehículo inspeccionado. | Alta | Fiscal |
| RF-11-02 | Inspección por QR | El Fiscal escanea el QR del vehículo para cargar automáticamente sus datos y el formulario correspondiente a su tipo. | Alta | Fiscal |
| RF-11-03 | Sugerencias con IA en inspección | El sistema analiza el historial del vehículo y del conductor, y sugiere los puntos de mayor riesgo a revisar. El fiscal acepta, modifica o ignora cada sugerencia. | Alta | Fiscal |
| RF-11-04 | Adjuntar evidencia fotográfica | El Fiscal adjunta hasta cinco fotografías por inspección. | Alta | Fiscal |
| RF-11-05 | Generar acta de inspección | El sistema genera un PDF con resultados, tipo de vehículo inspeccionado, firma digital del fiscal y código de verificación. | Alta | Fiscal |
| RF-11-06 | Historial de inspecciones | Vista del historial por tipo de vehículo, empresa, fecha o fiscal. | Alta | Admin Municipal, Fiscal |

---

### RF-12 — Reportes ciudadanos

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-12-01 | Enviar reporte | El ciudadano reporta una anomalía desde la vista pública del vehículo. Las categorías disponibles se ajustan automáticamente al tipo de vehículo reportado. | Alta | Ciudadano |
| RF-12-02 | Anti-fraude capa 1 — identidad | Solo usuarios registrados y verificados pueden enviar reportes. | Alta | Sistema |
| RF-12-03 | Anti-fraude capa 2 — contexto | El sistema verifica que el ciudadano esté dentro de un radio geográfico y temporal coherente con el vehículo reportado. | Alta | Sistema |
| RF-12-04 | Anti-fraude capa 3 — límite diario | Throttling dinámico: cantidad máxima de reportes por día configurable por el Admin Municipal. | Alta | Sistema |
| RF-12-05 | Anti-fraude capa 4 — QR-HMAC | El sistema valida que el QR escaneado sea auténtico. | Alta | Sistema |
| RF-12-06 | Anti-fraude capa 5 — corroboración | El sistema pondera el reporte según el historial de veracidad del ciudadano. | Alta | Sistema |
| RF-12-07 | Análisis de patrones con IA | El sistema detecta patrones anómalos: múltiples reportes al mismo vehículo, categorías recurrentes por tipo de flota o zona, y problemas estructurales. Genera alertas para el Admin Municipal. | Alta | Sistema |
| RF-12-08 | Autocompletado con IA en descripción | El sistema sugiere categorías y frases según la foto adjunta. | Media | Ciudadano |
| RF-12-09 | Ver estado del reporte | El ciudadano ve el estado de sus reportes: pendiente, en revisión, validado o rechazado. | Alta | Ciudadano |
| RF-12-10 | Notificar al ciudadano | Push cuando el reporte cambia de estado. | Media | Sistema |
| RF-12-11 | Gestionar reportes | El Admin Municipal y el Fiscal revisan, validan o rechazan los reportes. Pueden filtrar por tipo de vehículo. | Alta | Admin Municipal, Fiscal |

---

### RF-13 — Sanciones

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-13-01 | Emitir sanción | El Fiscal o Admin Municipal emite una sanción a empresa, conductor o vehículo, con tipo de vehículo implicado, tipo de falta, monto y justificación. | Alta | Fiscal, Admin Municipal |
| RF-13-02 | Notificar sanción | El sistema notifica a la empresa por correo y WhatsApp. | Alta | Sistema |
| RF-13-03 | Flujo de apelación | El Operador presenta una apelación dentro de un plazo configurable con documentos de descargo. | Alta | Operador |
| RF-13-04 | Resolver apelación | El Admin Municipal emite resolución: confirmar, reducir monto o anular. | Alta | Admin Municipal |
| RF-13-05 | Historial de sanciones | Vista con filtros por tipo de vehículo, empresa, conductor y fecha. | Alta | Admin Municipal, Fiscal |
| RF-13-06 | Exportar sanciones CSV | Exportación del historial en CSV. | Media | Admin Municipal |

---

### RF-14 — Motor de fatiga (FatigueEngine)

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-14-01 | Cálculo de horas de conducción | El sistema registra las horas de conducción continua desde las operaciones completadas. Aplica a todos los tipos de vehículo con conductor asignado. | Alta | Sistema |
| RF-14-02 | Cálculo de periodos de descanso | El sistema evalúa si los periodos entre operaciones cumplen el mínimo requerido. | Alta | Sistema |
| RF-14-03 | Clasificación de riesgo | Conductor clasificado en: APTO (verde), RIESGO (amarillo) o NO_APTO (rojo). | Alta | Sistema |
| RF-14-04 | Alerta de fatiga | Al alcanzar estado RIESGO o NO_APTO, alerta en el dashboard del Admin Municipal, del Admin Provincial y del Operador. El conductor también recibe notificación en la app. | Alta | Sistema |
| RF-14-05 | Bloqueo de salida por fatiga | Si el conductor está en NO_APTO, el sistema no permite registrar una nueva salida o viaje. Muestra el tiempo de descanso restante. | Alta | Sistema |

---

### RF-15 — Reputación

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-15-01 | Puntuación de conductor | Calculada en base a: ausencia de sanciones, cumplimiento de operaciones, alertas de fatiga y reportes ciudadanos válidos. | Alta | Sistema |
| RF-15-02 | Puntuación de vehículo | Basada en inspecciones aprobadas, sanciones recibidas y operaciones sin incidencias. Diferenciada por tipo de vehículo. | Alta | Sistema |
| RF-15-03 | Puntuación de empresa | Puntaje agregado que pondera los puntajes de sus conductores y vehículos. | Alta | Sistema |
| RF-15-04 | Ranking de empresas | El Admin Municipal ve un ranking de empresas por reputación, filtrable por tipo de flota. | Media | Admin Municipal |
| RF-15-05 | Reputación visible en vista pública | El puntaje de reputación del conductor y del vehículo es visible públicamente. | Alta | Público general |

---

### RF-16 — Recompensas y gamificación ciudadana

El ciudadano acumula SFITCoins por acciones válidas. Los puntos se canjean por beneficios definidos por cada municipalidad.

#### Niveles de ciudadano

| Nivel | Nombre | Puntos requeridos | Beneficio adicional |
|---|---|---|---|
| 1 | Observador | 0 – 199 | Acceso básico a reportes |
| 2 | Vigilante | 200 – 599 | Reportes con mayor peso en corroboración |
| 3 | Fiscal Ciudadano | 600 – 1,499 | Acceso a estadísticas de su municipalidad |
| 4 | Defensor del Transporte | 1,500 – 3,999 | Insignia visible en perfil público |
| 5 | Embajador SFIT | 4,000+ | Reconocimiento oficial y beneficios especiales de la municipalidad |

#### Acciones que otorgan puntos

| Acción | Puntos |
|---|---|
| Reporte ciudadano validado por el fiscal | 50 |
| Reporte sobre vehículo de limpieza o emergencia (tipos con menos reportes habituales) | +15 adicionales |
| Reporte con foto de evidencia de alta calidad | +10 adicionales |
| Primer reporte del día | +5 adicionales |
| Reporte que derivó en una sanción | +30 adicionales |
| Completar perfil al 100% | 20 (una sola vez) |
| Siete días consecutivos con actividad en la app | 25 |
| Reporte corroborado por otro ciudadano | +15 |

#### Penalizaciones

| Acción | Puntos |
|---|---|
| Reporte rechazado por datos falsos | -30 |
| Reporte rechazado por ubicación incoherente | -10 |
| Tres rechazos consecutivos | -50 adicionales y suspensión temporal de 48 horas |

#### Requerimientos funcionales

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-16-01 | Acumulación de SFITCoins | El sistema asigna puntos automáticamente según las acciones. El saldo se actualiza en tiempo real. | Alta | Sistema |
| RF-16-02 | Panel de progreso | El ciudadano ve: nivel, puntos, barra de progreso, historial de puntos y logros desbloqueados. | Alta | Ciudadano |
| RF-16-03 | Sistema de niveles | El ciudadano sube de nivel automáticamente con notificación de felicitación. | Alta | Sistema |
| RF-16-04 | Logros desbloqueables | Hitos con insignia: primer reporte, diez reportes validados, reporte de todos los tipos de vehículo, un mes de actividad continua, reporte que derivó en sanción. | Media | Sistema |
| RF-16-05 | Ranking de ciudadanos | Tabla de posiciones filtrable por semana, mes y total histórico. | Media | Ciudadano, Admin Municipal |
| RF-16-06 | Catálogo de beneficios | El Admin Municipal define beneficios para canje con costo en SFITCoins y stock. | Alta | Admin Municipal |
| RF-16-07 | Solicitud de canje | El ciudadano canjea puntos si tiene saldo suficiente. La solicitud queda pendiente. | Alta | Ciudadano |
| RF-16-08 | Gestión de solicitudes de canje | El Admin Municipal confirma o rechaza. Al confirmar, los puntos se descuentan. | Alta | Admin Municipal |
| RF-16-09 | Notificación de canje | El ciudadano recibe push y correo cuando su solicitud es aprobada o rechazada. | Media | Sistema |
| RF-16-10 | Historial de canjes | Vista del historial completo con fecha, beneficio y estado. | Media | Ciudadano |
| RF-16-11 | Penalización automática | El sistema descuenta puntos automáticamente cuando un reporte es rechazado. | Alta | Sistema |
| RF-16-12 | Suspensión temporal por abuso | Tres rechazos consecutivos generan suspensión temporal de 48 horas y notifican al Admin Municipal. | Alta | Sistema |

---

### RF-17 — Llenado automático con IA

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-17-01 | Extracción desde foto de DNI | La IA extrae nombre completo, número de documento y fecha de nacimiento. El usuario revisa y confirma. | Alta | Admin Municipal, Operador |
| RF-17-02 | Extracción desde foto de licencia | La IA extrae número, categoría y fecha de vencimiento. | Alta | Admin Municipal, Operador |
| RF-17-03 | Extracción desde tarjeta de circulación | La IA extrae placa, marca, modelo, año y número de serie. | Alta | Admin Municipal, Operador |
| RF-17-04 | Extracción desde foto del SOAT | La IA extrae número de póliza, vigencia y aseguradora, tanto del SOAT del conductor como del vehículo. | Alta | Admin Municipal, Operador |
| RF-17-05 | Indicador de confianza por campo | Cada campo extraído muestra nivel de confianza (alta, media, baja). Los campos con confianza baja se resaltan visualmente. | Alta | Sistema |
| RF-17-06 | Corrección manual siempre disponible | El usuario puede editar cualquier campo. La IA nunca guarda datos sin confirmación del usuario. | Alta | Todos |
| RF-17-07 | Sugerencias en inspección por tipo de vehículo | El sistema analiza el historial del vehículo y del conductor, y sugiere los puntos de mayor riesgo del formulario configurado para ese tipo. | Alta | Fiscal |
| RF-17-08 | Análisis de patrones en reportes | El sistema detecta reportes anómalos coordinados, categorías recurrentes por tipo de flota y zona, y problemas estructurales. Genera alertas para el Admin Municipal. | Alta | Sistema |
| RF-17-09 | Autocompletado en reporte ciudadano | El sistema sugiere categorías y frases según la foto adjunta y el tipo de vehículo. | Media | Ciudadano |

---

### RF-18 — Notificaciones

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-18-01 | Notificación en tiempo real (web) | WebSocket: alertas de fatiga, nuevos reportes ciudadanos, vehículos fuera de servicio y cambios de estado de operaciones. | Alta | Admin Municipal, Admin Provincial, Fiscal, Operador |
| RF-18-02 | Notificación push (móvil) | Push para: aprobación de cuenta, cambio de estado de reporte, alerta de fatiga, confirmación de operación y subida de nivel. | Alta | Todos |
| RF-18-03 | Notificación por WhatsApp | Mensajes para: emisión de sanciones, alertas críticas de fatiga y vencimiento de documentos. | Alta | Sistema |
| RF-18-04 | Notificación por correo | Correos para: confirmación de registro, recuperación de contraseña, sanciones, apelaciones resueltas y reportes automáticos. | Alta | Sistema |
| RF-18-05 | Reporte semanal automático | El Admin Municipal y el Operador reciben cada lunes un resumen de la semana anterior. | Media | Sistema |

---

### RF-19 — Reportes estadísticos

| ID | Nombre | Descripción | Prioridad | Rol |
|---|---|---|---|---|
| RF-19-01 | Dashboard del Admin Municipal | Métricas del día por tipo de vehículo: operaciones activas, vehículos por estado, conductores en RIESGO, reportes ciudadanos pendientes y sanciones del mes. | Alta | Admin Municipal |
| RF-19-02 | Dashboard del Admin Provincial | Vista agregada de todas sus municipalidades con las mismas métricas. | Alta | Admin Provincial |
| RF-19-03 | Reporte mensual | Estadísticas de la municipalidad: total de operaciones por tipo de vehículo, sanciones emitidas, reportes ciudadanos y ranking de empresas. | Alta | Admin Municipal |
| RF-19-04 | Exportación CSV | Exportación de cualquier listado en CSV. | Media | Admin Municipal, Operador |
| RF-19-05 | Gráficos de tendencias | Gráficos de tendencia para sanciones, operaciones y reportes en el tiempo, filtrables por tipo de vehículo. | Media | Admin Municipal |

---

## 8. Requerimientos no funcionales

| ID | Categoría | Descripción | Nivel |
|---|---|---|---|
| RNF-01 | Seguridad — Autenticación | JWT obligatorio en todas las rutas protegidas. Access token: 15 min. Refresh token: 7 días. | Alto |
| RNF-02 | Seguridad — Autorización | RBAC en todos los endpoints. Cada solicitud verifica rol, tenant y nivel jerárquico. | Alto |
| RNF-03 | Seguridad — Multi-tenancy | Toda consulta a MongoDB incluye el filtro por `municipality_id`. Ningún endpoint retorna datos de otro tenant. | Alto |
| RNF-04 | Seguridad — Contraseñas | bcrypt con mínimo 12 rounds. Las cuentas de Google no almacenan contraseña. | Alto |
| RNF-05 | Seguridad — QR | Firmados con HMAC-SHA256. La clave vive en variables de entorno. | Alto |
| RNF-06 | Seguridad — Vista pública | No expone DNI, datos de contacto ni información personal sensible. | Alto |
| RNF-07 | Seguridad — IA | Las imágenes enviadas para extracción no se almacenan. Se procesan en tránsito y se descartan. | Alto |
| RNF-08 | Rendimiento | Operaciones de lectura: menos de 800ms. Operaciones críticas (registro de salida, sanción): menos de 1200ms. | Alto |
| RNF-09 | Rate Limiting | 100 solicitudes por minuto por usuario por defecto. Configurable por el Admin Municipal. | Alto |
| RNF-10 | Disponibilidad | Disponibilidad mínima del 99% mensual, excluyendo mantenimiento programado. | Alto |
| RNF-11 | Escalabilidad | Onboarding de nuevas provincias o municipalidades sin modificar el código base. | Alto |
| RNF-12 | Extensibilidad de tipos de vehículo | El sistema permite agregar nuevos tipos de vehículo con formularios propios sin modificar el código base. | Alto |
| RNF-13 | Usabilidad — Web | Responsivo desde 1024px. Flujos críticos en no más de tres clics. | Media |
| RNF-14 | Usabilidad — Móvil | Android desde versión 8.0, iOS desde versión 13. Escaneo QR operable con conectividad reducida. | Alto |
| RNF-15 | Mantenibilidad | Código organizado por módulos de dominio. Cobertura mínima de pruebas unitarias del 70%. | Media |
| RNF-16 | Auditoría | Acciones críticas registradas en log con usuario, fecha, municipalidad y tipo de vehículo implicado. | Alto |
| RNF-17 | Offline parcial (móvil) | La app valida QR sin conexión y almacena datos de inspección localmente para sincronizar al recuperar conectividad. | Alto |
| RNF-18 | Privacidad — IA | El sistema informa al usuario cuando usa IA para extraer datos y solicita confirmación antes de guardar. | Alto |

---

## 9. Restricciones

- El sistema no gestiona pagos ni recaudación de multas. La sanción se registra y notifica, pero el cobro queda fuera del alcance de esta versión.
- El sistema no incluye seguimiento GPS continuo de vehículos. El control de posición se basa en el registro de inicio y cierre de operación.
- La app móvil no reemplaza los documentos físicos del conductor. SFIT es un complemento digital, no un sustituto legal de licencia o SOAT.
- El Super Admin no puede operar dentro de una municipalidad como Admin Municipal. Su rol es exclusivamente de configuración y supervisión global.
- Los reportes exportados en CSV no incluyen datos personales de ciudadanos.
- La extracción de datos con IA es una asistencia, no una fuente de verdad. El usuario siempre revisa y confirma antes de guardar.
- Los SFITCoins no tienen valor monetario ni son transferibles entre usuarios.
- Los tipos de vehículo personalizados creados por un Admin Municipal son exclusivos de su municipalidad y no se comparten entre tenants.
- La versión inicial no contempla integración con sistemas externos de la Policía Nacional o el Ministerio de Transportes del Perú.

---

> SFIT © 2026 — Plataforma multi-municipalidad para fiscalización y gestión de flota vehicular municipal