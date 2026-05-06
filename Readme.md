# SFIT — Sistema de Fiscalización Inteligente de Transporte

Plataforma multi-tenant para la fiscalización y gestión de flota vehicular municipal. Una sola instancia sirve a múltiples municipalidades organizadas bajo una jerarquía regional/provincial: cada municipalidad opera de forma aislada sobre sus propios recursos y los niveles superiores agregan visibilidad sin operar en su lugar.

**Estado:** producción · backend en `https://sfit.ecosdelseo.com` (Dokploy, auto-deploy desde `main`) · app Android en Closed Testing (Play Store)
**Versión:** v1.6 · 2026-05-04
**Cobertura RF:** 112/119 implementados (94%) · 7 parciales (OCR + IA)

> Para auditoría detallada, credenciales de prueba y guía de levantamiento ver [IMPLEMENTATION.md](IMPLEMENTATION.md).

---

## Contenido

1. [Descripción general](#1-descripción-general)
2. [Estructura del monorepo](#2-estructura-del-monorepo)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Jerarquía geográfica y multi-tenancy](#4-jerarquía-geográfica-y-multi-tenancy)
5. [Roles y permisos](#5-roles-y-permisos)
6. [Tipos de vehículo](#6-tipos-de-vehículo)
7. [Módulos del sistema](#7-módulos-del-sistema)
8. [Arquitectura web](#8-arquitectura-web-sfit-web)
9. [Arquitectura móvil](#9-arquitectura-móvil-sfit-app)
10. [Modelos de datos](#10-modelos-de-datos)
11. [Seguridad](#11-seguridad)
12. [Integraciones externas](#12-integraciones-externas)
13. [Variables de entorno](#13-variables-de-entorno)
14. [Cómo levantar el proyecto](#14-cómo-levantar-el-proyecto)
15. [Requerimientos funcionales (RF)](#15-requerimientos-funcionales-rf)
16. [Requerimientos no funcionales (RNF)](#16-requerimientos-no-funcionales-rnf)
17. [Restricciones](#17-restricciones)
18. [Roadmap](#18-roadmap)

---

## 1. Descripción general

SFIT gestiona cualquier vehículo bajo jurisdicción municipal: transporte público de pasajeros, vehículos de limpieza y residuos, vehículos de emergencia y maquinaria municipal. Cada tipo tiene formularios de inspección, checklists y categorías de reporte ciudadano configurables por el Admin Municipal.

El registro de usuarios es abierto: cualquier persona crea cuenta con Google o correo e indica el rol que solicita. El Admin Municipal aprueba o rechaza. Ningún rol operacional opera sin habilitación previa.

### Capacidades principales

- Jerarquía geográfica de cuatro niveles: nacional → región → provincia → municipalidad
- Tipos de vehículo configurables por municipalidad con formularios propios
- Registro abierto + flujo de aprobación
- Gestión completa de flota para el Operador (entradas/salidas, checklist, reportes diarios/semanales/mensuales)
- Control de rutas y viajes con validación pre-salida
- Fiscalización en campo por QR firmado HMAC-SHA256 con validación offline
- Vista pública del estado de un vehículo y su conductor sin necesidad de cuenta
- Reportes ciudadanos con anti-fraude de cinco capas, diferenciados por tipo de vehículo
- FatigueEngine: cálculo automático de horas de conducción y descanso (reglas peruanas: 4h riesgo, 5h no_apto)
- Sistema de sanciones con flujo de apelación
- Notificaciones multi-canal: WebSocket, FCM push, correo (Resend)
- Reputación para conductores, vehículos y empresas (denormalizada y actualizada por hooks)
- SFITCoins: gamificación con niveles, ranking y catálogo de canjes
- IA/OCR: extracción desde fotos de DNI, licencia, SOAT y tarjeta de circulación
- Reportes estadísticos con exportación CSV

---

## 2. Estructura del monorepo

```
Sistema Sfit/
├── sfit-web/         Panel admin + API (Next.js 16, App Router)
├── sfit-app/         App móvil (Flutter 3.29, Android)
├── play-store-assets/  Assets para Google Play
├── privacy-policy/   Política de privacidad publicada en GitHub Pages
├── AGENTS.md         Guía corta para agentes Claude Code
└── Readme.md         Este archivo
```

Ambos proyectos son **independientes** (sin código compartido) pero consumen la misma base MongoDB Atlas y los mismos endpoints REST expuestos por `sfit-web`.

```
sfit-app (Flutter)  ──HTTP/JWT──►  sfit-web/api/  ──►  MongoDB Atlas
sfit-web (Browser)  ──Cookie──►   sfit-web/api/  ──►  MongoDB Atlas
```

### Mapa de `sfit-web/`

```
src/
├── app/                  App Router (rutas + API routes)
│   ├── (auth)/           login, register, reset, pending, rejected
│   ├── (dashboard)/      ~70 páginas protegidas por rol
│   ├── (print)/          vistas imprimibles (acta, manifiesto)
│   ├── consulta-publica/ búsqueda pública de vehículo/conductor
│   ├── api/              ~148 endpoints REST agrupados por dominio
│   └── design-system/    showcase de componentes shadcn
├── components/           ui/, dashboard/, layout/
├── lib/                  auth, db, qr, coins, email, apiperu, factiliza, geo, notifications, reputation, audit, exports
├── models/               28 schemas Mongoose
└── middleware.ts         Auth + rate-limit (Edge runtime)
scripts/                  seeds, migraciones, debug
```

### Mapa de `sfit-app/`

```
lib/
├── core/                 config, network, router, services, theme, widgets
└── features/             módulos por dominio (Clean Architecture: data → domain → presentation)
    ├── auth/             login, register, pending, rejected, role_preview
    ├── home/             dashboards por rol (fiscal, operador, conductor, ciudadano)
    ├── fiscal/           crear sanción, resolver/mis apelaciones
    ├── operator/         flota, conductores, vehículos, viajes, manifiesto
    ├── conductor/        viajes pendientes/disponibles, fatiga, mis rutas
    ├── trips/            check-in / check-out, mapa en vivo
    ├── inspection/       formulario dinámico, acta, apelación
    ├── reports/          reporte ciudadano + revisión admin
    ├── feed/             feed público de reportes
    ├── live_bus/         mapa de buses en tiempo real
    ├── qr_scanner/       escaneo + validación HMAC offline
    ├── ai_ocr/           OCR DNI / licencia / SOAT / tarjeta
    ├── vista_publica/    consulta sin auth
    ├── rewards/          ranking + canje SFITCoins
    ├── notifications/    centro + listeners FCM
    └── admin/            dashboards y gestión
```

---

## 3. Stack tecnológico

### sfit-web

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router, RSC) | **16.2.3** |
| UI | React | **19.2.4** |
| Lenguaje | TypeScript | ^5 (target ES2017) |
| Estilos | Tailwind CSS | **v4** (`@tailwindcss/postcss`) |
| Componentes | shadcn/ui + Radix | shadcn 4.3 |
| Iconos | lucide-react | 1.8 |
| Tablas | @tanstack/react-table | 8.21 |
| Gráficos | Recharts | 3.8 |
| ODM | Mongoose | 9.4.1 |
| Auth | JWT manual (jsonwebtoken) + Google OAuth | jsonwebtoken 9 / google-auth-library 10 |
| Hash | bcryptjs | 12 rounds |
| Tiempo real | Socket.io | 4.8 |
| Email | Resend + Nodemailer | resend 6.11 |
| QR | qrcode + crypto (HMAC-SHA256) | qrcode 1.5 |
| Tests | Vitest + @testing-library/react | vitest 4.1 |
| Runtime | Node | **>=20.19.0** |
| Despliegue | Dokploy (Docker) | auto-deploy `main` |

### sfit-app

| Capa | Tecnología | Versión |
|---|---|---|
| SDK | Flutter | **>=3.29.0** |
| Lenguaje | Dart | ^3.7.0 |
| Estado | Riverpod (+ codegen) | 2.6 |
| Routing | GoRouter | 15.1.2 |
| HTTP | Dio + Retrofit | dio 5.8 |
| Almacenamiento | Hive + flutter_secure_storage + shared_preferences | hive 2.2 |
| QR scan | mobile_scanner | 7.0 |
| QR gen | qr_flutter + crypto | qr_flutter 4.1 |
| Mapas | flutter_map + latlong2 | 7.0 |
| Geolocalización | geolocator | 14.0 |
| Cámara | image_picker + permission_handler | image_picker 1.1 |
| Push | firebase_messaging + flutter_local_notifications | fcm 15.2 |
| Realtime | socket_io_client | 3.0 |
| Codegen | freezed, json_serializable, retrofit_generator, riverpod_generator | — |
| Plataforma | Android (NDK 28.2, Java 17, multiDex) | iOS/Web no soportados |

### Datos

- **MongoDB Atlas** — multi-tenant por `municipalityId` denormalizado en cada documento operacional
- DNS bypass del ISP vía `dns.setServers` en [sfit-web/src/lib/db/mongoose.ts](sfit-web/src/lib/db/mongoose.ts)

---

## 4. Jerarquía geográfica y multi-tenancy

```
Nacional (Super Admin)
└── Región (Admin Regional)
    └── Provincia (Admin Provincial)
        └── Municipalidad (Admin Municipal)  ← tenant operacional
            ├── Empresas / Flotas
            │   ├── Vehículos
            │   └── Conductores
            ├── Fiscales
            └── Ciudadanos
```

**Regla crítica:** toda consulta a MongoDB sobre recursos operacionales (Vehicle, Driver, Trip, Inspection, etc.) DEBE incluir `municipalityId` en el filtro. Los roles superiores (regional, provincial, super) acceden expandiendo el scope, no removiendo el filtro.

**Implementación:** [sfit-web/src/lib/auth/rbac.ts](sfit-web/src/lib/auth/rbac.ts) provee `scopedMunicipalityFilterAsync()` y `canAccessMunicipality()`. El JWT lleva `regionId`, `provinceId` y `municipalityId` denormalizados; los hooks pre-save de `User` mantienen la cadena coherente.

---

## 5. Roles y permisos

Ocho roles. Identificadores exactos del código en [sfit-web/src/lib/constants.ts](sfit-web/src/lib/constants.ts).

| Rol (key) | Scope | Plataforma | Capacidades clave |
|---|---|---|---|
| `super_admin` | Global | Web | Crea regiones/provincias, asigna admins, auditoría global, dashboard nacional |
| `admin_regional` | Región | Web | Dashboard regional, agregaciones, asignar admin_provincial |
| `admin_provincial` | Provincia | Web | Dashboard provincial, escalaciones, asignar admin_municipal |
| `admin_municipal` | Municipalidad | Web | Aprobar usuarios, configurar tipos, gestionar empresas/conductores/vehículos/sanciones |
| `fiscal` | Municipalidad | Web + Móvil | Inspecciones en campo, escaneo QR, emitir sanciones, validar reportes |
| `operador` | Empresa | Web + Móvil | Flota diaria, salidas/retornos, checklist, viajes, apelaciones |
| `conductor` | Asignaciones propias | Móvil | Aceptar viajes, ver fatiga, mis rutas, check-in/out |
| `ciudadano` | Público + propio | Móvil + Web pública | Reportes, vista pública, ranking, canje SFITCoins |

### Flujo de aprobación

```
Registro (Google o correo) → indica rol solicitado
└── Ciudadano → ACTIVO inmediato
└── Otros roles → PENDIENTE
    └── Admin Municipal aprueba/rechaza
        └── Notificación push + correo
```

---

## 6. Tipos de vehículo

Predefinidos en el catálogo `VehicleType`; el Admin Municipal activa los aplicables a su jurisdicción y puede crear tipos personalizados con formularios propios sin tocar código.

| Tipo | Reportes ciudadanos asociados |
|---|---|
| Transporte público | Conducción peligrosa, cobro indebido, sobrecarga, mal estado |
| Limpieza y residuos | Ruta no cubierta, derrame, mal manejo, horario incumplido |
| Emergencia | Demora en atención, vehículo en mal estado |
| Maquinaria municipal | Trabajo no realizado, daño a infraestructura |
| Vehículo municipal general | Uso indebido, conducción irresponsable |

---

## 7. Módulos del sistema

| Módulo | Web | Móvil | RF |
|---|---|---|---|
| Auth y registro | ✅ | ✅ | RF-01 |
| Regiones / Provincias / Municipalidades | ✅ | — | RF-02 |
| Tipos de vehículo y formularios | ✅ Admin Municipal | — | RF-03 |
| Empresas / flotas | ✅ | — | RF-04 |
| Conductores | ✅ | ✅ perfil propio | RF-05 |
| Vehículos + QR | ✅ | ✅ escaneo | RF-06 |
| Flota Operador (entradas/salidas) | ✅ | ✅ | RF-07 |
| Vista pública vehículo/conductor | ✅ | ✅ | RF-08 |
| Rutas y zonas | ✅ | ✅ Conductor | RF-09 |
| Viajes y operaciones | ✅ | ✅ | RF-10 |
| Inspecciones | ✅ | ✅ Fiscal | RF-11 |
| Reportes ciudadanos | Gestión | Envío | RF-12 |
| Sanciones + apelaciones | ✅ | Consulta | RF-13 |
| FatigueEngine | Auto | Alerta | RF-14 |
| Reputación | ✅ | Consulta | RF-15 |
| SFITCoins (gamificación) | Gestión | ✅ Ciudadano | RF-16 |
| IA/OCR | ✅ registro | ✅ formularios | RF-17 |
| Notificaciones | WebSocket | FCM push | RF-18 |
| Estadísticas + export CSV | ✅ | — | RF-19 |

---

## 8. Arquitectura web (`sfit-web`)

### App Router — rutas dashboard

Bajo `(dashboard)`, organizado por dominio (no por rol; el RBAC se aplica por endpoint y por componente):

```
/dashboard                  KPIs por rol
/usuarios            ·      aprobaciones, suspensión, asignar roles
/auditoria                  AuditLog filtrable
/notificaciones             inbox + badge
/provincias · /municipalidades · /admin/regiones
/tipos-vehiculo             predefinidos + personalizados
/empresas
/conductores · /vehiculos   CRUD + QR descarga
/rutas                      rutas fijas + zonas
/flota · /flota/[id]        panel operador
/viajes                     ciclo completo
/inspecciones               formulario dinámico + acta
/reportes                   ciudadano: revisión + export
/sanciones · /apelaciones
/recompensas                catálogo SFITCoins
/estadisticas               recharts + export CSV
/configuracion              Admin Municipal
/perfil
/mi-empresa                 panel del operador
```

### API REST (`/api/*`) — ~148 endpoints

Agrupados por dominio. Todos los endpoints protegidos validan JWT, rol y multi-tenant.

| Grupo | Endpoints destacados |
|---|---|
| `/auth` | login, register, google, refresh, logout, reset-password, perfil, cambiar-password, onboarding/complete |
| `/admin` | stats por rol (global/regional/provincial/municipal/fiscal/operador/conductor), empresas, usuarios, recompensas, webhooks, actividad, migrations |
| `/municipalidades`, `/provincias`, `/regiones` | CRUD + activar |
| `/empresas`, `/conductores`, `/vehiculos` | CRUD + filtros; `/vehiculos/[id]/qr` genera PNG firmado |
| `/rutas`, `/viajes` | CRUD + `/viajes/[id]/{aceptar,rechazar,iniciar,tomar,asignar,manifest-photo,pasajeros}`, `/viajes/auto-close` |
| `/inspecciones`, `/sanciones`, `/apelaciones` | CRUD + sugerencias |
| `/flota/active-locations` | tracking realtime via Socket.io |
| `/conductor/{me,fatiga,preferencias}` | datos del propio conductor |
| `/ciudadano/{recompensas,coins}` | balance y catálogo |
| `/notifications`, `/notificaciones/token` | inbox + FCM token |
| `/validar/{dni,licencia,ruc,placa}` | apiperu + Factiliza |
| `/public/{vehiculo,municipalidades,provincias,validar-dni}` | sin auth |
| `/catalogo/{empresa-mtc,vehiculo-mtc}` | catálogo MTC local (7160 emp + 29516 veh) |
| `/ocr/{documento,placa}` | tesseract.js |
| `/uploads/{reports,files}` | evidencia |
| `/health`, `/health/smtp`, `/version`, `/docs` | observabilidad + OpenAPI |

### Middleware

[sfit-web/src/middleware.ts](sfit-web/src/middleware.ts) en Edge runtime:
- Verifica presencia de `sfit_access_token` cookie o `Authorization: Bearer`
- Rate limiting en producción: 10 req/min para `/api/auth/*`, 5 req/min para `/api/ocr/*`
- Rutas públicas: `/`, `/login`, `/register`, `/reset-password`, `/design-system`, `/api/auth`, `/api/public`, `/api/health`, `/api/uploads/files`
- La verificación criptográfica del JWT ocurre en cada API route (no en middleware Edge), porque `jsonwebtoken` no corre en runtime Edge

---

## 9. Arquitectura móvil (`sfit-app`)

### Pantallas por rol

| Rol | Pantallas |
|---|---|
| Fiscal | dashboard, nueva inspección, acta, escaneo QR, crear sanción, resolver apelación, mis apelaciones |
| Operador | dashboard, conductores tab, vehículos tab, nuevo conductor (con OCR), nuevo vehículo (con OCR), fleet analytics, vehicle QR, rutas, viajes, detalle viaje, lista pasajeros, manifiesto |
| Conductor | dashboard, viajes pendientes, viajes disponibles, mis viajes, mis rutas, detalle ruta, fatiga, check-in, check-out, mapa en vivo, trip summary |
| Ciudadano | dashboard, feed reportes, detalle reporte, enviar reporte, mis reportes, vehículo público, buses en vivo, ranking, recompensas |
| Auth (todos) | splash, onboarding, login, register, pending, rejected, role preview, cambio password |

### Capacidades nativas

| Capacidad | Librería | Uso |
|---|---|---|
| Escáner QR | `mobile_scanner` 7.0 | validación HMAC offline en `qr_hmac_service.dart` |
| Geolocalización | `geolocator` 14.0 | captura GPS para reportes ciudadanos (anti-fraude capa 2), tracking de viajes |
| Mapas | `flutter_map` 7.0 | rutas, buses en vivo |
| Cámara | `image_picker` 1.1 | OCR de documentos, manifiesto, evidencia |
| Push | `firebase_messaging` 15.2 + `flutter_local_notifications` 18 | canal Android `sfit_alerts`, listeners foreground/background/terminated |
| Realtime | `socket_io_client` 3.0 | tracking en vivo de flota |
| Storage | `hive` 2.2 + `flutter_secure_storage` 9 | cache local + tokens |

### Routing

GoRouter con `redirect` global basado en `AuthStatus` (loading → splash, authenticated → /home, pendingApproval → /pending, rejected → /rejected, unauthenticated → /login). Rutas públicas sin auth: `/qr`, `/vehiculo-publico/*`.

### Plataformas

- **Android únicamente** en producción (NDK 28.2, Java 17, minSdk Flutter, multiDex habilitado)
- iOS y Web no compilados

---

## 10. Modelos de datos

28 schemas Mongoose en [sfit-web/src/models/](sfit-web/src/models/). Resumen:

| Modelo | Propósito | Tenant key |
|---|---|---|
| `User` | Cuentas + estado (pendiente/activo/rechazado/suspendido) + denormaliza `regionId`/`provinceId`/`municipalityId` | self |
| `Region`, `Province`, `Municipality` | Jerarquía geográfica con `ubigeoCode` | upward |
| `Company` | Empresas con RUC único, scope de servicio, cobertura por distritos, reputación | `municipalityId` |
| `Driver` | Conductor + licencia, fatiga, reputación, vehículo actual | `municipalityId` + `companyId` |
| `Vehicle` | Vehículo + tipo, estado (disponible/en_ruta/mantenimiento), QR HMAC, reputación | `municipalityId` + `companyId` |
| `VehicleType` | Catálogo predefinido + personalizado por municipalidad | global |
| `Route` | Rutas y zonas con waypoints, scope (urbano/interprovincial/nacional) | `municipalityId` |
| `Trip` | Viajes con ciclo aceptar/iniciar/cerrar, pasajeros (count o lista) | `municipalityId` |
| `Passenger` | Lista de pasajeros del viaje | `tripId` |
| `FleetEntry` | Salidas/retornos diarios con checklist | `companyId` |
| `RouteCapture` | Waypoints GPS de viajes | `driverId` |
| `Inspection` | Inspección con formulario dinámico, score, evidencia | `municipalityId` |
| `Sanction` | Sanción con notificaciones (email/whatsapp/push), estado | `municipalityId` |
| `Apelacion` | Apelación a sanción | denorm en Sanction |
| `CitizenReport` | Reporte ciudadano con `fraudScore`, capas anti-fraude, geolocalización | `municipalityId` |
| `Notification` | Inbox + categorías (sistema, aprobacion, sancion, fatiga, reporte) | `userId` |
| `Recompensa`, `SfitCoin`, `CitTokenBalance`, `CitTokenTransaction` | Catálogo + balance + historial de gamificación | `userId` / global |
| `TransportAuthorization`, `AuthorizedVehicle` | Autorizaciones MTC | `companyId` |
| `Webhook` | Suscripciones a eventos del tenant | `municipalityId` |
| `AuditLog` | Log de acciones críticas (RNF-16) | `municipalityId` |
| `UploadedFile`, `ReportApoyo` | Soporte | varios |

### Multi-tenancy

`municipalityId`, `provinceId` y `regionId` se denormalizan en `User` y en cada documento operacional. Los hooks pre-save de `User` derivan automáticamente la cadena Region←Province←Municipality. El helper `scopedMunicipalityFilterAsync()` construye filtros que respetan el scope del rol.

---

## 11. Seguridad

| Aspecto | Implementación |
|---|---|
| **JWT** | Access **2h** + Refresh **7d**, HS256. `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` en env. [jwt.ts](sfit-web/src/lib/auth/jwt.ts) |
| **Cookies** | `sfit_access_token` httpOnly (web). En móvil: `flutter_secure_storage` + `AuthInterceptor` Dio |
| **Hash** | bcryptjs 12 rounds. Cuentas Google no almacenan password |
| **RBAC** | Verificado en cada endpoint por `requireRole()` y `scopedMunicipalityFilter()`. [rbac.ts](sfit-web/src/lib/auth/rbac.ts) |
| **Multi-tenant** | Filtros obligatorios por `municipalityId`. Filtros expandidos para roles superiores |
| **QR** | HMAC-SHA256 con `QR_HMAC_SECRET` en env. Verificación offline en app móvil. [hmac.ts](sfit-web/src/lib/qr/hmac.ts) |
| **Vista pública** | Nunca expone DNI, teléfono ni datos de contacto |
| **IA / OCR** | Imágenes procesadas en tránsito; no se almacenan |
| **Rate limit** | Edge middleware: 10/min auth, 5/min OCR. Configurable por env en producción |
| **Auditoría** | `AuditLog` con hooks en mutaciones críticas (sanciones, aprobaciones, asignaciones) |

### Anti-fraude reportes ciudadanos (RF-12)

| Capa | Estado | Detalle |
|---|---|---|
| 1 — Identidad | ✅ | sólo usuarios verificados |
| 2 — Contexto geográfico | ✅ | GPS automático en `SubmitReportPage`; coherencia radio/tiempo |
| 3 — Límite diario | ✅ | throttling configurable por Admin Municipal |
| 4 — QR-HMAC | ✅ | `qrVerified` flag en el reporte |
| 5 — Reputación | ✅ | `citizenReputationLevel` (nivel SFITCoin) pondera `fraudScore` |

---

## 12. Integraciones externas

| Servicio | Uso | Cliente |
|---|---|---|
| **apiperu.dev** | RENIEC (DNI), SUNAT (RUC) | [lib/apiperu/](sfit-web/src/lib/apiperu/) |
| **Factiliza** | Licencia MTC + RUC fallback | [lib/factiliza/](sfit-web/src/lib/factiliza/) |
| **Catálogo MTC** | Empresas (7160) y vehículos (29516) autorizados — copia local | [lib/catalogo/](sfit-web/src/lib/) |
| **Google OAuth** | Sign-in web y móvil | google-auth-library |
| **Firebase Cloud Messaging** | Push notifications móvil | Firebase Admin SDK |
| **Resend** | Correo transaccional | [lib/email/](sfit-web/src/lib/email/) |
| **tesseract.js** | OCR documentos (DNI, licencia, SOAT, tarjeta) | endpoint `/api/ocr/documento` |
| **Socket.io** | Realtime tracking flota | servidor + cliente |
| **Upstash Redis** | Rate limiting persistente (opcional) | env-based |

> **Pendiente:** Google Cloud Vision API para OCR de mayor calidad y Claude API para sugerencias en inspección y análisis de patrones en reportes (RF-11-03, RF-12-07, RF-17-08).

---

## 13. Variables de entorno

`sfit-web/.env.local` (no existe `.env.example`; las variables se configuran en Dokploy para producción):

```env
# Base de datos
MONGODB_URI=mongodb+srv://...

# JWT
JWT_ACCESS_SECRET=<HS256 secret>
JWT_REFRESH_SECRET=<HS256 secret>

# QR
QR_HMAC_SECRET=<HMAC key>

# OAuth
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>

# Email
RESEND_API_KEY=<...>
SMTP_HOST=, SMTP_PORT=, SMTP_USER=, SMTP_PASS=

# APIs externas
APIPERU_API_KEY=<...>
FACTILIZA_TOKEN=<...>

# Notificaciones móvil
FCM_PROJECT_ID=<...>
FCM_PRIVATE_KEY=<...>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<...>

# Realtime + uploads
NEXT_PUBLIC_SOCKET_URL=<...>
UPLOADS_PATH=<ruta local>

# Rate limiting (opcional)
UPSTASH_REDIS_REST_URL=<...>
UPSTASH_REDIS_REST_TOKEN=<...>

NODE_ENV=development|production
```

App móvil: variables compiladas con `--dart-define`:

```bash
flutter run --dart-define=SFIT_DEV_HOST=10.0.2.2  # emulador Android
flutter run --dart-define=SFIT_DEV_HOST=192.168.1.x  # dispositivo físico WiFi
# Sin override apunta a https://sfit.ecosdelseo.com/api
```

---

## 14. Cómo levantar el proyecto

Resumen rápido. Pasos detallados, seeds, credenciales de prueba y troubleshooting en [IMPLEMENTATION.md](IMPLEMENTATION.md#cómo-levantar-el-entorno-local).

### Backend + web (sfit-web)

```bash
cd sfit-web
npm install
cp .env.local.example .env.local       # configurar Mongo Atlas, secrets, OAuth
npx tsx scripts/seed-test-users.ts     # 7 usuarios de prueba (password Sfit2026!)
npm run dev                             # http://localhost:3000
```

### App móvil (sfit-app)

Por defecto apunta al backend de producción.

```bash
cd sfit-app
flutter pub get
flutter run                             # backend producción

# Para backend local con emulador:
flutter run --dart-define=SFIT_DEV_HOST=10.0.2.2

# Release:
flutter build apk --release             # → build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle --release       # → bundle/release/app-release.aab
```

### Comprobaciones

```bash
# sfit-web
npx tsc --noEmit                # ✅ 0 errores
npm run lint                    # ⚠ 2 errores preexistentes en (auth)
npx vitest run                  # ✅ 93/93

# sfit-app
flutter analyze                 # ✅ 0 issues
flutter test                    # ✅ 1/1
```

---

## 15. Requerimientos funcionales (RF)

Listado canónico. Ver [IMPLEMENTATION.md](IMPLEMENTATION.md) para el estado por sub-RF.

| Bloque | Cobertura | Notas |
|---|---|---|
| **RF-01** Auth y registro | ✅ 9/9 | JWT 2h/7d, Google OAuth, ciudadano auto-aprobado |
| **RF-02** Regiones / Provincias / Municipalidades | ✅ 7/7 | Incluye `admin_regional` (no presente en versiones previas del README) |
| **RF-03** Tipos de vehículo + checklist + form inspección | ✅ 5/5 | Personalizables sin tocar código |
| **RF-04** Empresas / flotas | ✅ 5/5 | RUC único + cobertura por distritos |
| **RF-05** Conductores | 🟨 7/10 | OCR auto-llenado parcial (DNI, licencia, SOAT) |
| **RF-06** Vehículos + QR HMAC | 🟨 7/9 | OCR tarjeta y SOAT vehicular parcial |
| **RF-07** Flota Operador | ✅ 16/16 | Salidas, retornos, checklist, reportes diarios/semanales/mensuales |
| **RF-08** Vista pública | ✅ 7/7 | QR + búsqueda placa, sin DNI |
| **RF-09** Rutas y zonas | ✅ 5/5 | Rutas fijas + zonas geográficas |
| **RF-10** Viajes y operaciones | ✅ 6/6 | Auto-cierre pasivo + endpoint cron `/api/viajes/auto-close` |
| **RF-11** Inspecciones | 🟨 5/6 | Sugerencias IA aún en mock estático |
| **RF-12** Reportes ciudadanos | 🟨 10/11 | 5 capas anti-fraude implementadas; análisis de patrones IA pendiente |
| **RF-13** Sanciones + apelaciones | ✅ 6/6 | Notificación email; WhatsApp pendiente |
| **RF-14** FatigueEngine | ✅ 5/5 | Reglas peruanas (4h riesgo, 5h no_apto), bloqueo de salida |
| **RF-15** Reputación | ✅ 5/5 | Hooks automáticos en inspecciones/sanciones/reportes; visible en vista pública |
| **RF-16** SFITCoins / gamificación | ✅ 12/12 | Niveles, ranking, canje, penalización automática |
| **RF-17** IA / OCR | 🟨 6/9 | tesseract.js operativo; Vision API + Claude pendientes |
| **RF-18** Notificaciones | 🟨 4/5 | WebSocket + FCM + email Resend ✅; WhatsApp pendiente |
| **RF-19** Estadísticas | ✅ 5/5 | 4 endpoints por rol + export CSV + recharts |

**Total:** 119 sub-RF · 112 implementados · 7 parciales · 0 pendientes (los parciales tienen estructura y se completan con integraciones externas).

---

## 16. Requerimientos no funcionales (RNF)

| RNF | Descripción | Estado |
|---|---|---|
| RNF-01 Auth | JWT en rutas protegidas; 2h access / 7d refresh | ✅ |
| RNF-02 Autorización | RBAC + scope geográfico verificado por endpoint | ✅ |
| RNF-03 Multi-tenancy | Filtro `municipalityId` obligatorio en queries operacionales | ✅ |
| RNF-04 Contraseñas | bcryptjs 12 rounds; Google sin password | ✅ |
| RNF-05 QR | HMAC-SHA256 con secret en env | ✅ |
| RNF-06 Vista pública | Sin DNI, teléfono ni datos de contacto | ✅ |
| RNF-07 IA | Imágenes en tránsito, no almacenadas | ✅ |
| RNF-08 Rendimiento | Lectura <800ms; críticas <1200ms | objetivo |
| RNF-09 Rate limit | 100 req/min/usuario; 10/min auth, 5/min OCR | ✅ |
| RNF-10 Disponibilidad | 99% mensual | objetivo Dokploy |
| RNF-11 Escalabilidad | Onboarding de tenants sin código | ✅ |
| RNF-12 Extensibilidad tipos | Tipos personalizados sin código | ✅ |
| RNF-13 Usabilidad web | Responsivo desde 1024px | ✅ |
| RNF-14 Usabilidad móvil | Android 8.0+; QR con conectividad reducida | ✅ Android |
| RNF-15 Mantenibilidad | Módulos por dominio; cobertura mínima 70% | 93/93 web vitest, 1/1 flutter |
| RNF-16 Auditoría | AuditLog con hooks en mutaciones críticas | ✅ |
| RNF-17 Offline parcial | QR offline + cache Hive en app | ✅ |
| RNF-18 Privacidad IA | Confirmación antes de guardar | ✅ |

---

## 17. Restricciones

- No gestiona pagos ni recaudación. Sanción se registra y notifica; cobro queda fuera de alcance.
- No incluye seguimiento GPS continuo. La posición se infiere de inicio/cierre de operación + waypoints opcionales.
- La app móvil no reemplaza documentos físicos; es complemento digital, no sustituto legal.
- El Super Admin no opera dentro de una municipalidad como Admin Municipal: rol exclusivo de configuración global.
- CSV no incluye datos personales de ciudadanos.
- IA/OCR es asistencia; el usuario siempre revisa y confirma.
- SFITCoins no tienen valor monetario y no son transferibles.
- Tipos de vehículo personalizados son exclusivos del tenant que los crea.
- Sin integración aún con PNP ni MTC oficial; se usa catálogo local copia.
- iOS y Web móvil no soportados en esta versión.

---

## 18. Roadmap

| Pendiente | Bloque | Impacto |
|---|---|---|
| Google Sign In SHA-1 en GCP Console (acción manual, no código) | RF-01-01 | Medio |
| Google Cloud Vision API para OCR de mayor precisión | RF-17 | Medio |
| Claude API para sugerencias en inspección y análisis de patrones | RF-11-03, RF-12-07, RF-17-08 | Medio |
| WhatsApp API para notificación de sanciones críticas | RF-18-03 | Medio |
| Scheduler Dokploy para `POST /api/viajes/auto-close` | RF-10-04 | Bajo |
| `RESEND_API_KEY` en producción (Dokploy) | RF-18-04 | Bajo |
| Push listeners FCM completos en sfit-app | RF-18-02 | Bajo |
| iOS build (cuando se priorice) | — | — |

---

> SFIT © 2026 — Plataforma multi-municipalidad para fiscalización y gestión de flota vehicular municipal · Mantenido por @milith0kun
