# SFIT — Estado de implementación y guía operativa

> Auditado: 22/04/2026 — Última verificación de tipos/tests al cerrar el ciclo de pruebas.
> Para arquitectura, requerimientos y stack ver [Readme.md](Readme.md).
>
> **Leyenda:** ✅ completo · 🟨 parcial (falta lógica o integración puntual) · ❌ pendiente

## Contenido

1. [Credenciales de prueba](#1-credenciales-de-prueba)
2. [Infraestructura común](#2-infraestructura-común)
3. [Backend web — modelos + API](#3-backend-web--modelos--api)
4. [Frontend web — páginas](#4-frontend-web--páginas)
5. [App Flutter](#5-app-flutter)
6. [Pruebas automatizadas](#6-pruebas-automatizadas)
7. [Distribución y privacidad](#7-distribución-y-privacidad)
8. [Cómo levantar el entorno local](#8-cómo-levantar-el-entorno-local)
9. [Pendientes priorizados](#9-pendientes-priorizados)

---

## 1. Credenciales de prueba

Tras ejecutar `cd sfit-web && npx tsx scripts/seed-test-users.ts` quedan 7 usuarios listos en MongoDB Atlas. Password único: `Sfit2026!`.


| Email                | Rol              | Scope                 |
| -------------------- | ---------------- | --------------------- |
| superadmin@sfit.test | super_admin      | global                |
| provincial@sfit.test | admin_provincial | provincia semilla     |
| municipal@sfit.test  | admin_municipal  | municipalidad semilla |
| fiscal@sfit.test     | fiscal           | municipalidad semilla |
| operador@sfit.test   | operador         | municipalidad semilla |
| conductor@sfit.test  | conductor        | municipalidad semilla |
| ciudadano@sfit.test  | ciudadano        | global                |

> Para `admin_regional` ejecutar el seed adicional o asignarlo desde `superadmin@` vía `/usuarios/[id]/assign-admin-regional`.

Los IDs de la provincia y municipalidad semilla se imprimen al final del script. Datos sembrados según commits recientes: `seed-full-data.ts` carga municipios, provincias, empresas, conductores y viajes; `seed-ubigeo.ts` carga la tabla UBIGEO; `seed-mtc-pasajeros.ts` carga el catálogo MTC de pasajeros.

---

## 2. Infraestructura común


| Área                                                 | Estado | Notas                                                                                                                                                    |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conexión MongoDB Atlas con bypass DNS (ISP)          | ✅     | `dns.setServers` en [sfit-web/src/lib/db/mongoose.ts](sfit-web/src/lib/db/mongoose.ts)                                                                   |
| JWT helpers                                           | ✅     | sign/verify access (2h) y refresh (7d) en[sfit-web/src/lib/auth/jwt.ts](sfit-web/src/lib/auth/jwt.ts)                                                    |
| Middleware Edge                                       | ✅     | presencia de token + rate limit en[sfit-web/src/middleware.ts](sfit-web/src/middleware.ts)                                                               |
| Guard + RBAC                                          | ✅     | `requireRole`, `scopedMunicipalityFilter` en [sfit-web/src/lib/auth/guard.ts](sfit-web/src/lib/auth/guard.ts) y [rbac.ts](sfit-web/src/lib/auth/rbac.ts) |
| Respuestas API estandarizadas`{success, data, error}` | ✅     | [sfit-web/src/lib/api/response.ts](sfit-web/src/lib/api/response.ts)                                                                                     |
| AuditLog helper                                       | ✅     | [sfit-web/src/lib/audit/log.ts](sfit-web/src/lib/audit/log.ts)                                                                                           |
| Notificaciones                                        | ✅     | helper unificado WebSocket + FCM + email en[sfit-web/src/lib/notifications/](sfit-web/src/lib/notifications/)                                            |
| Sistema de diseño web                                | ✅     | Inter + Syne + tabular-nums;`globals.css` + componentes en `components/dashboard/*` y `components/ui/*`                                                  |
| Sistema de diseño Flutter                            | ✅     | `AppTheme` Material 3 + widgets `SfitHeroCard`, `SfitKpiStrip`, `SfitStatusPill`, etc. en `core/theme/*` y `shared/widgets/*`                            |
| Tema light-only                                       | ✅     | `ThemeProvider forcedTheme="light"` evita el bug de `--fg: #fafafa` en dark OS                                                                           |
| Logo institucional                                    | ✅     | square 500×500 + horizontal 500×250 en`public/logo-*.svg`, `assets/logos/*.png`, mipmap Android regenerado                                             |
| Generador de íconos                                  | ✅     | `scripts/generate-icons.mjs` (Android + favicons + Apple)                                                                                                |
| HMAC-SHA256 para QR                                   | ✅     | firma y verificación del payload de vehículo en[sfit-web/src/lib/qr/hmac.ts](sfit-web/src/lib/qr/hmac.ts)                                              |
| Despliegue backend Dokploy                            | ✅     | `https://sfit.ecosdelseo.com` — auto-deploy desde `main` en GitHub                                                                                      |

---

## 3. Backend web — modelos + API

> Desplegado en producción en `https://sfit.ecosdelseo.com` via Dokploy. Auto-deploy desde `main`.


| RF    | Módulo                                                         | Modelo(s)                                                          | API CRUD                                                                                    | RBAC + multi-tenant | Estado                                                                                                         |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| RF-01 | Auth: login, register, Google, refresh, logout, account linking | `User`                                                             | ✅                                                                                          | ✅                  | ✅                                                                                                             |
| RF-01 | Register ciudadano auto-aprobado + tokens inmediatos            | `User`                                                             | ✅                                                                                          | ✅                  | ✅                                                                                                             |
| RF-01 | Catálogo público`/api/public/{provincias,municipalidades}`    | —                                                                 | ✅                                                                                          | —                  | ✅                                                                                                             |
| RF-02 | Regiones / Provincias / Municipalidades                         | `Region`, `Province`, `Municipality`                               | ✅                                                                                          | ✅                  | ✅                                                                                                             |
| RF-03 | Tipos de vehículo + checklist + form inspección               | `VehicleType`                                                      | ✅                                                                                          | ✅                  | ✅                                                                                                             |
| RF-04 | Empresas de transporte                                          | `Company`                                                          | ✅                                                                                          | ✅                  | ✅                                                                                                             |
| RF-05 | Conductores                                                     | `Driver`                                                           | ✅ CRUD + filtros aptitud                                                                   | ✅                  | 🟨 OCR auto-llenado parcial (RF-17)                                                                            |
| RF-06 | Vehículos + QR HMAC                                            | `Vehicle`                                                          | ✅ CRUD +`/[id]/qr` PNG firmado                                                             | ✅                  | ✅                                                                                                             |
| RF-07 | Flota del día (entradas/salidas Operador)                      | `FleetEntry`                                                       | ✅                                                                                          | ✅                  | ✅ checklist + validación pre-salida                                                                          |
| RF-08 | Vista pública vehículo/conductor                              | —                                                                 | ✅`/api/public/vehiculo`                                                                    | —                  | ✅                                                                                                             |
| RF-09 | Rutas y zonas                                                   | `Route`                                                            | ✅                                                                                          | ✅                  | 🟨 filtro por tipo pendiente                                                                                   |
| RF-10 | Viajes y operaciones                                            | `Trip`, `Passenger`, `RouteCapture`                                | ✅ + sub-rutas (aceptar, iniciar, tomar, manifiesto)                                        | ✅                  | 🟨 auto-cierre pasivo + endpoint`/auto-close`; falta scheduler externo                                         |
| RF-11 | Inspecciones                                                    | `Inspection`                                                       | ✅                                                                                          | ✅                  | 🟨 sugerencias IA en mock estático; PDF de acta operativo                                                     |
| RF-12 | Reportes ciudadanos + anti-fraude                               | `CitizenReport`                                                    | ✅                                                                                          | ✅                  | ✅ 5 capas implementadas                                                                                       |
| RF-13 | Sanciones + apelaciones                                         | `Sanction`, `Apelacion`                                            | ✅ CRUD + resolver                                                                          | ✅                  | ✅ flujo completo                                                                                              |
| RF-14 | FatigueEngine                                                   | `Driver` + endpoint `conductor/fatiga`                             | ✅ cálculo real horas/descanso                                                             | ✅                  | ✅ reglas peruanas (4h riesgo, 5h no_apto)                                                                     |
| RF-15 | Reputación                                                     | `reputationScore` denorm en Driver/Vehicle/Company                 | ✅ actualización automática                                                               | ✅                  | ✅ hooks en inspecciones, sanciones y reportes                                                                 |
| RF-16 | Recompensas + SFITCoins                                         | `Recompensa`, `SfitCoin`, `CitTokenBalance`, `CitTokenTransaction` | ✅ coins, balance, niveles, canje                                                           | ✅                  | ✅`lib/coins/awardCoins.ts`                                                                                    |
| RF-17 | IA / OCR (DNI, licencia, SOAT, tarjeta)                         | —                                                                 | 🟨 endpoint con tesseract.js                                                                | —                  | 🟨 requiere tesseract.js instalado; planeado upgrade a Vision API                                              |
| RF-18 | Notificaciones in-app + push FCM                                | `Notification`                                                     | ✅ CRUD +`/unread-count` + `/read-all`                                                      | ✅                  | 🟨 FCM Firebase Admin SDK ✅; Resend integrado en producción si`RESEND_API_KEY` está set; WhatsApp pendiente |
| RF-18 | Auditoría global                                               | `AuditLog`                                                         | ✅ + hooks en mutaciones clave                                                              | ✅                  | ✅                                                                                                             |
| RF-19 | Estadísticas agregadas por rol                                 | —                                                                 | ✅ 4 endpoints (global / municipal / operador / fiscal / regional / provincial / conductor) | ✅                  | ✅                                                                                                             |

### APIs externas integradas


| API                    | Uso                                          | Cliente                                                            | Estado                           |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| apiperu.dev            | RENIEC (DNI) y SUNAT (RUC)                   | [sfit-web/src/lib/apiperu/](sfit-web/src/lib/apiperu/)             | ✅                               |
| Factiliza              | Licencia MTC + RUC fallback                  | [sfit-web/src/lib/factiliza/](sfit-web/src/lib/factiliza/)         | ✅                               |
| Catálogo MTC local    | 7160 empresas + 29516 vehículos             | endpoint`/api/catalogo/{empresa-mtc,vehiculo-mtc}`                 | ✅ — URL requiere`www.`         |
| Firebase Admin SDK     | FCM push                                     | [sfit-web/src/lib/notifications/](sfit-web/src/lib/notifications/) | ✅                               |
| Resend                 | Correo transaccional                         | [sfit-web/src/lib/email/](sfit-web/src/lib/email/)                 | ✅ activable con`RESEND_API_KEY` |
| Google Cloud Vision    | OCR de mayor precisión                      | —                                                                 | ❌ planeado                      |
| Claude API (Anthropic) | Sugerencias inspección + análisis reportes | —                                                                 | ❌ planeado                      |

---

## 4. Frontend web — páginas

> Auditado: todas las páginas listadas llaman a APIs reales. Sin mock data.

### Auth y onboarding


| Ruta                                           | Estado | Notas                                                                            |
| ---------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `/login`                                       | ✅     | Google OAuth + correo con vinculación automática                               |
| `/register`                                    | ✅     | Google Sign In + selector provincia/municipalidad; ciudadano → activo inmediato |
| `/pending` · `/rejected` · `/reset-password` | ✅     |                                                                                  |
| `/onboarding`                                  | ✅     | Completar datos post-registro                                                    |

### Admin global / supervisión


| Ruta                                                     | Rol(es)                                | Estado                                                                                |
| -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `/dashboard`                                             | todos                                  | ✅ KPIs por rol                                                                       |
| `/usuarios` · `/usuarios/[id]`                          | super, regional, provincial, municipal | ✅ aprobación, suspensión, cambio de rol, asignar admin_provincial / admin_regional |
| `/admin/users` aprobaciones pendientes                   | super, regional, provincial, municipal | ✅                                                                                    |
| `/notificaciones`                                        | todos                                  | ✅ tabs + marcar leídas + borrar + badge campana                                     |
| `/auditoria`                                             | super, regional, provincial, municipal | ✅ filtros + paginación                                                              |
| `/admin/regiones` · `/provincias` · `/municipalidades` | super, regional, provincial            | ✅ CRUD + activación                                                                 |

### Configuración municipal


| Ruta                                                 | Rol(es)         | Estado                                                |
| ---------------------------------------------------- | --------------- | ----------------------------------------------------- |
| `/tipos-vehiculo`                                    | admin_municipal | ✅ predefinidos + personalizados                      |
| `/empresas` · `/empresas/[id]` · `/empresas/nueva` | admin_municipal | ✅ filtros + suspensión                              |
| `/configuracion`                                     | admin_municipal | ✅ límites, horas conducción, notificaciones        |
| `/recompensas`                                       | admin_municipal | ✅ catálogo, toggle activo/inactivo, stats SFITCoins |

### Operacional


| Ruta                                                             | Rol(es)                           | Estado                                  |
| ---------------------------------------------------------------- | --------------------------------- | --------------------------------------- |
| `/flota` · `/flota/[id]` · `/flota/nueva`                      | operador                          | ✅ panel + salida + retorno + checklist |
| `/conductores` · `/conductores/[id]` · `/conductores/nuevo`    | admin_municipal, operador, fiscal | ✅ API real + detalle fatiga            |
| `/vehiculos` · `/vehiculos/[id]` · `/vehiculos/nuevo`          | admin_municipal, operador, fiscal | ✅ API real + QR descarga               |
| `/inspecciones` · `/inspecciones/[id]` · `/inspecciones/nueva` | fiscal, admin_municipal           | ✅ formulario dinámico + score + acta  |
| `/reportes` · `/reportes/[id]`                                  | admin_municipal, fiscal           | ✅ filtros por status + export CSV      |
| `/rutas` · `/rutas/[id]` · `/rutas/nueva`                      | admin_municipal, operador         | ✅ rutas fijas + zonas                  |
| `/sanciones` · `/sanciones/[id]` · `/sanciones/nueva`          | fiscal, admin_municipal           | ✅ emisión + notificación             |
| `/apelaciones` · `/apelaciones/[id]`                            | operador, admin_municipal         | ✅ flujo completo                       |
| `/viajes` · `/viajes/[id]` · `/viajes/nueva`                   | operador, admin_municipal         | ✅ inicio + cierre + auto-cierre pasivo |
| `/mi-empresa`                                                    | operador                          | ✅ panel del operador                   |

### Análisis


| Ruta            | Rol(es)                                | Estado                                   |
| --------------- | -------------------------------------- | ---------------------------------------- |
| `/estadisticas` | super, regional, provincial, municipal | ✅ recharts + export CSV; multi-rol      |
| `/perfil`       | todos                                  | ✅ cambio password, foto, datos contacto |

### Públicas (sin auth)


| Ruta                                       | Estado                                       |
| ------------------------------------------ | -------------------------------------------- |
| `/consulta-publica`                        | ✅ búsqueda pública vehículos/conductores |
| `/api-docs`                                | ✅ OpenAPI viewer                            |
| `/design-system`                           | ✅ showcase shadcn                           |
| `/privacy` · `/privacidad` · `/terminos` | ✅                                           |

---

## 5. App Flutter

> Auditado: todas las pantallas listadas llaman APIs reales vía Dio + JWT.
> Backend por defecto: `https://sfit.ecosdelseo.com/api`.
> Dev local: `flutter run --dart-define=SFIT_DEV_HOST=10.0.2.2` (emulador).

### Plataformas

- **Android:** ✅ NDK 28.2.13676358, Java 17, Kotlin, multiDex habilitado, signing config con `key.properties` para release
- **iOS:** ❌ no compilado
- **Web móvil:** ❌ no soportado

### Cross-cutting


| Feature                                                                      | Estado | Notas                                                                                                                      |
| ---------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Splash (logo + tagline + spinner gold)                                       | ✅     |                                                                                                                            |
| Login correo + contraseña                                                   | ✅     | Todos los roles probados contra Dokploy                                                                                    |
| Login con Google (`google_sign_in`)                                          | 🟨     | `strings.xml` listo; falta SHA-1 del keystore en GCP Console                                                               |
| Registro con rol solicitado                                                  | ✅     | Ciudadano → activo inmediato + auto-login; otros → pendiente                                                             |
| Pantallas pending / rejected / role-preview                                  | ✅     | super_admin puede previsualizar otros roles                                                                                |
| Auto-login con refresh token                                                 | ✅     | `AuthInterceptor` Dio                                                                                                      |
| `Firebase.initializeApp` en main.dart                                        | ✅     | try-catch silencioso si falta`google-services.json`                                                                        |
| Home con tabs por rol                                                        | ✅     | dashboards reales: fiscal, operador, conductor, ciudadano                                                                  |
| Roles web-only (super/regional/provincial/municipal) → mensaje "usa la web" | ✅     |                                                                                                                            |
| Connectivity banner                                                          | ✅     | `core/widgets/connectivity_banner.dart`                                                                                    |
| Cambio de contraseña                                                        | ✅     |                                                                                                                            |
| Notificaciones (centro + badge)                                              | ✅     | `NotificationsPage`                                                                                                        |
| Push notifications listeners                                                 | ✅     | `NotificationService` + `FcmBackgroundHandler`; canal `sfit_alerts`; foreground/background/terminated; routing por payload |

### Fiscal


| Pantalla                                          | RF                 | Estado |
| ------------------------------------------------- | ------------------ | ------ |
| Dashboard fiscal                                  | RF-19              | ✅     |
| Escaneo QR + validación HMAC offline             | RF-06-06, RF-11-02 | ✅     |
| Lista de inspecciones + detalle                   | RF-11              | ✅     |
| Nueva inspección (formulario dinámico por tipo) | RF-11-01           | ✅     |
| Acta de inspección                               | RF-11-05           | ✅     |
| Crear sanción                                    | RF-13-01           | ✅     |
| Resolver apelación / mis apelaciones             | RF-13-04           | ✅     |

### Operador


| Pantalla                                 | RF                 | Estado |
| ---------------------------------------- | ------------------ | ------ |
| Dashboard operador                       | RF-07-16           | ✅     |
| Tab conductores (CRUD)                   | RF-05              | ✅     |
| Tab vehículos (CRUD)                    | RF-06              | ✅     |
| Nuevo conductor con OCR (DNI + licencia) | RF-05-02, RF-05-03 | ✅     |
| Nuevo vehículo con OCR (tarjeta + SOAT) | RF-06-02, RF-06-03 | ✅     |
| Fleet analytics                          | RF-07-16           | ✅     |
| QR del vehículo                         | RF-06-04           | ✅     |
| Rutas                                    | RF-09              | ✅     |
| Viajes (lista + detalle)                 | RF-10              | ✅     |
| Lista de pasajeros                       | RF-10              | ✅     |
| Subir manifiesto                         | RF-10              | ✅     |

### Conductor


| Pantalla                        | RF                 | Estado          |
| ------------------------------- | ------------------ | --------------- |
| Dashboard conductor             | RF-19              | ✅              |
| Viajes pendientes / disponibles | RF-10-02           | ✅              |
| Mis viajes / mis rutas          | RF-09-03, RF-10-06 | ✅              |
| Detalle de ruta                 | RF-09              | ✅              |
| Fatiga (horas / descanso)       | RF-14              | ✅ datos reales |
| Check-in / Check-out            | RF-10              | ✅ API real     |
| Mapa en vivo del viaje          | —                 | ✅              |
| Trip summary                    | —                 | ✅              |

### Ciudadano


| Pantalla                                  | RF       | Estado                         |
| ----------------------------------------- | -------- | ------------------------------ |
| Dashboard ciudadano                       | RF-19    | ✅                             |
| Feed público de reportes + detalle       | RF-12    | ✅                             |
| Enviar reporte (SubmitReportPage)         | RF-12-01 | ✅ con GPS automático         |
| Mis reportes                              | RF-12-09 | ✅                             |
| Vehículo público (consulta sin auth)    | RF-08    | ✅ con reputación 5 estrellas |
| Mapa de buses en vivo                     | RF-15    | ✅                             |
| Ranking ciudadanos (semana / mes / total) | RF-16-05 | ✅                             |
| Recompensas (catálogo + canje)           | RF-16    | ✅                             |

---

## 6. Pruebas automatizadas


| Suite               | Comando                                            | Estado                                                                                                                            |
| ------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Web TypeScript      | `cd sfit-web && npx tsc --noEmit`                  | ✅ 0 errores                                                                                                                      |
| Web ESLint          | `cd sfit-web && npm run lint`                      | 🟨 2 errores preexistentes en`(auth)/pending/page.tsx` y `(auth)/rejected/page.tsx` (setState-in-effect); warnings de unused vars |
| Web unit (Vitest)   | `cd sfit-web && npx vitest run`                    | ✅ 93/93                                                                                                                          |
| Flutter analyze     | `cd sfit-app && flutter analyze`                   | ✅ 0 issues                                                                                                                       |
| Flutter test        | `cd sfit-app && flutter test`                      | ✅ 1/1                                                                                                                            |
| Flutter APK release | `cd sfit-app && flutter build apk --release`       | ✅ ≈68 MB en`build/app/outputs/flutter-apk/app-release.apk`                                                                      |
| Flutter AAB release | `cd sfit-app && flutter build appbundle --release` | ✅ v1.0.1+3 en`build/app/outputs/bundle/release/app-release.aab`                                                                  |

---

## 7. Distribución y privacidad


| Artefacto                                              | Estado       | Detalles                                            |
| ------------------------------------------------------ | ------------ | --------------------------------------------------- |
| Google Play Store — Internal Testing                  | ✅ publicado | versionCode 1 (0.1.0)                               |
| Google Play Store — Closed/Alpha Testing              | ✅ publicado | versionCode 3 · v1.0.1                             |
| Política de privacidad (requerida por permiso CAMERA) | ✅ live      | `https://milith0kun.github.io/sfit-privacy/`        |
| Repositorio de privacidad                              | ✅           | `github.com/milith0kun/sfit-privacy` (GitHub Pages) |
| Backend producción                                    | ✅           | `https://sfit.ecosdelseo.com` (Dokploy)             |

---

## 8. Cómo levantar el entorno local

### Opción A — usar el backend de producción (recomendado para pruebas rápidas)

La app ya apunta a `https://sfit.ecosdelseo.com` por defecto.

```bash
cd sfit-app
flutter pub get
flutter run                          # emulador o dispositivo → Dokploy
```

### Opción B — backend local

#### 1. Levantar backend

```bash
cd sfit-web
cp .env.local.example .env.local       # configurar Mongo, secrets, OAuth
npm install
npx tsx scripts/seed-test-users.ts     # 7 usuarios de prueba (password Sfit2026!)
npm run dev                             # http://localhost:3000
```

#### 2a. App en emulador Android

```bash
cd sfit-app
flutter run --dart-define=SFIT_DEV_HOST=10.0.2.2
```

#### 2b. App en dispositivo físico vía USB

```bash
adb reverse tcp:3000 tcp:3000          # tunneliza el puerto al host
flutter run --dart-define=SFIT_DEV_HOST=localhost
```

#### 2c. App en dispositivo físico vía WiFi LAN

```bash
flutter run --dart-define=SFIT_DEV_HOST=192.168.1.x
```

### Release

```bash
cd sfit-app
flutter build apk --release
# → sfit-app/build/app/outputs/flutter-apk/app-release.apk

flutter build appbundle --release
# → sfit-app/build/app/outputs/bundle/release/app-release.aab
```

### Scripts útiles (`sfit-web/scripts/`)


| Script                                              | Propósito                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `setup.ts`                                          | Inicialización DB (índices, colecciones)                           |
| `create-admin.ts`                                   | Crear super-admin seed                                               |
| `seed-test-users.ts`                                | 7 usuarios test por rol                                              |
| `seed-full-data.ts`                                 | Seed completo: municipios, provincias, empresas, conductores, viajes |
| `seed-ubigeo.ts`                                    | Tabla UBIGEO (departamentos, provincias, distritos)                  |
| `seed-mtc-pasajeros.ts`                             | Catálogo MTC pasajeros                                              |
| `seed-apelaciones.ts`                               | Datos test de apelaciones                                            |
| `seed-aprobaciones.ts`                              | Estados de aprobación                                               |
| `seed-conductor-test.ts`                            | Conductor + vehículos + viajes test                                 |
| `seed-flota-hoy.ts` · `seed-viajes-hoy.ts`         | Datos de hoy para QA en vivo                                         |
| `seed-notif-test.ts`                                | Notificaciones de test                                               |
| `seed-recompensas.ts`                               | Catálogo SFITCoins                                                  |
| `migrate-legacy-munis.ts` · `migrate-to-ubigeo.ts` | Migraciones de tenants legacy                                        |
| `migrate-company-scope.ts`                          | Scope empresas (urbano/nacional)                                     |
| `migrate-uniqueness-check.ts`                       | Re-creación de índices únicos                                     |
| `debug-flota-conductor.ts`                          | Debug del many-to-many flota↔conductor                              |
| `generate-icons.mjs`                                | Generar mipmap Android + favicons + Apple                            |

---

## 9. Pendientes priorizados


| #  | Bloque                                                                  | RF                                             | Tipo           | Impacto            |
| -- | ----------------------------------------------------------------------- | ---------------------------------------------- | -------------- | ------------------ |
| 1  | **Google Sign In SHA-1** — registrar SHA-1 del keystore en GCP Console | RF-01-01                                       | acción manual | Medio              |
| 2  | **OCR — upgrade a Google Cloud Vision**                                | RF-05-02 a RF-05-04, RF-06-02, RF-06-03, RF-17 | integración   | Medio              |
| 3  | **Sugerencias IA en inspección** — Claude API                         | RF-11-03                                       | integración   | Medio              |
| 4  | **Análisis de patrones IA en reportes** — Claude API                  | RF-12-07, RF-17-08                             | integración   | Medio              |
| 5  | **Notificación WhatsApp** — sanciones críticas y vencimientos        | RF-18-03                                       | integración   | Medio              |
| 6  | **Scheduler Dokploy** — cron que llame `POST /api/viajes/auto-close`   | RF-10-04                                       | infra          | Bajo               |
| 7  | **`RESEND_API_KEY` en Dokploy** — activar emails en producción        | RF-18-04                                       | env            | Bajo               |
| 8  | **Filtro por tipo en `/rutas`**                                         | RF-09                                          | UI             | Bajo               |
| 9  | **PDF de acta — versión final con firma digital**                     | RF-11-05                                       | UX             | Bajo               |
| 10 | **iOS build**                                                           | —                                             | plataforma     | cuando se priorice |

### Cambios desde la última versión del Readme

- ✅ Rol `admin_regional` propagado en `User`, JWT y dashboards
- ✅ Páginas fiscal en app: `resolve_appeal`, `create_sanction`, `my_appeals` con push routing
- ✅ Operador track A/B/C en app: dashboard, mi empresa, pasajeros, manifiesto, rutas por scope
- ✅ Páginas web `/admin/regiones` y dashboard admin_regional
- ✅ Rol admin_regional propagado en `UserEntity` y labels
- ✅ Anti-fraude capa 2 (GPS), capa 4 (qrVerified) y capa 5 (citizenReputationLevel) cerradas
- ✅ Auto-close de viajes con endpoint protegido `POST /api/viajes/auto-close`
- ✅ FCM listeners completos foreground/background/terminated en sfit-app

---

> Documento mantenido en sincronía con el código. Para arquitectura y stack ver [Readme.md](Readme.md).
