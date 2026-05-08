# Análisis de Drift en Control de Acceso - SFIT

**Fecha del análisis:** 2026-05-08
**Auditor:** Claude Code

## Resumen Ejecutivo

Se identificaron **12 drifts críticos** entre controles de acceso en interfaz web vs API handlers.

### Drifts CRÍTICOS:

1. **CONDUCTORES - admin_regional rechazado en API (línea 34) pero permitido en UI (línea 21)**
   - Web: VIEW_ROLES = [..., admin_regional, ...] en conductores/[id]/page.tsx:21
   - API: requireRole([..., admin_provincial, ...]) SIN admin_regional en GET /api/conductores/[id]:34
   - Impacto: admin_regional ve botón pero obtiene 403
   - Severidad: CRÍTICO - exposición de UI inconsistente
   - Solución: Remover admin_regional de VIEW_ROLES web

2. **VEHÍCULOS - conductor incluido en API pero no en web (línea 26-29)**
   - Web: ALLOWED = [admin_municipal, fiscal, admin_provincial, super_admin, operador] en vehiculos/page.tsx:71
   - API: requireRole([..., ROLES.CONDUCTOR, ...]) en GET /api/vehiculos:26-29
   - Impacto: conductor accede directo al API sin pasar por UI, ve toda flota
   - Severidad: CRÍTICO - exposición de datos
   - Solución: Remover CONDUCTOR del API GET vehiculos

3. **VEHÍCULOS - admin_regional rechazado en API (línea 26) pero permitido en UI (línea 35)**
   - Web: VIEW_ROLES = [..., admin_regional, ...] en vehiculos/[id]/page.tsx:35
   - API: requireRole([..., admin_provincial, ...]) SIN admin_regional en GET /api/vehiculos/[id]:26
   - Impacto: admin_regional ve botón pero obtiene 403
   - Severidad: CRÍTICO
   - Solución: Remover admin_regional de VIEW_ROLES web

4. **INSPECCIONES - POST sin requireRole (API público)**
   - Web: CREATE_ROLES = [super_admin, admin_municipal] en inspecciones/nueva/page.tsx
   - API: POST /api/inspecciones NO tiene requireRole - público total
   - Impacto: Cualquier usuario autenticado crea inspecciones
   - Severidad: CRÍTICO - violación de seguridad
   - Solución: Agregar requireRole([SUPER_ADMIN, ADMIN_MUNICIPAL, FISCAL])

5. **SANCIONES - POST sin requireRole (API público)**
   - Web: CREATE_ROLES = [super_admin, admin_municipal, fiscal] en sanciones/nueva/page.tsx
   - API: POST /api/sanciones NO tiene requireRole - público total
   - Impacto: Cualquier usuario autenticado crea sanciones
   - Severidad: CRÍTICO - violación de seguridad
   - Solución: Agregar requireRole([SUPER_ADMIN, ADMIN_MUNICIPAL, FISCAL])

6. **APELACIONES - admin_provincial en API pero no en web (línea 34)**
   - Web: VIEW en apelaciones/[id]/page.tsx NO menciona admin_provincial
   - API: requireRole([..., ROLES.ADMIN_PROVINCIAL, ...]) en GET /api/apelaciones/[id]:34
   - Impacto: admin_provincial accede directo al API sin UI
   - Severidad: CRÍTICO - API más permisivo
   - Solución: Remover ADMIN_PROVINCIAL del API GET apelaciones

7. **CONDUCTORES FATIGA - operador puede marcar sin validación (línea 66)**
   - Web: FATIGUE_ROLES = [admin_municipal, fiscal, super_admin] en conductores/[id]/page.tsx:23
   - API: PATCH /api/conductores/[id]:66 requireRole incluye OPERADOR
   - Impacto: Operador puede marcar fatiga a conductores de otras empresas
   - Severidad: CRÍTICO - bypass de autorización
   - Solución: Agregar lógica: si status en payload, solo FATIGUE_ROLES

8. **FLOTA - endpoints sin requireRole (API público)**
   - Web: CREATE_ROLES en flota/nueva/page.tsx
   - API: GET/POST /api/flota NO tienen requireRole visible
   - Impacto: Acceso público a datos de rutas en tiempo real
   - Severidad: CRÍTICO - exposición de datos
   - Solución: Agregar requireRole a todos endpoints de flota

9. **REPORTES - ciudadano ve todos los reportes**
   - Web: Probablemente restringido a municipal
   - API: GET /api/reportes/feed incluye ROLES.CIUDADANO
   - Impacto: ciudadano ve reportes de otros ciudadanos
   - Severidad: CRÍTICO - privacidad
   - Solución: Restricción: ciudadano solo ve sus propios reportes

10. **CONDUCTORES - admin_provincial puede GET pero no CREATE (inconsistencia)**
    - Web: CREATE_ROLES = [admin_municipal, operador, super_admin] - NO admin_provincial en nuevo:11
    - API: GET /api/conductores:28-30 incluye ADMIN_PROVINCIAL
    - Impacto: Inconsistencia: puede ver pero no crear
    - Severidad: CRÍTICO - diseño inconsistente
    - Solución: Alinear - agregar admin_provincial a CREATE o remover de GET

11. **VEHÍCULOS - fiscal puede SUSPEND pero API no existe**
    - Web: SUSPEND_ROLES = [admin_municipal, fiscal, super_admin] en vehiculos/[id]/page.tsx:37
    - API: No existe PATCH /api/vehiculos/[id]/suspender
    - Impacto: Botón en UI no funciona para fiscal
    - Severidad: CRÍTICO - feature incompleta
    - Solución: Crear endpoint API o remover botón para fiscal

12. **admin_regional es FANTASMA en el sistema**
    - Aparece en: conductores/[id], vehiculos/[id] VIEW_ROLES
    - NO aparece en: API requireRole corresponding
    - Impacto: 6+ usuarios ven botones pero obtienen 403
    - Severidad: CRÍTICO - este era el bug original reportado
    - Solución: Eliminar admin_regional del sistema O refactorizar jerarquía completa

---

## Tabla de Recomendaciones

| # | Recurso | Acción | Opción A | Opción B | Status |
|-|-|-|-|-|-|
| 1 | conductores | VIEW | Remover admin_regional de web | Agregar a API | A (web restrictivo) |
| 2 | vehículos | LIST | Remover CONDUCTOR de API | Agregar a web | A (seguridad) |
| 3 | vehículos | VIEW | Remover admin_regional de web | Agregar a API | A (web restrictivo) |
| 4 | inspecciones | CREATE | Agregar requireRole a API | - | INMEDIATO |
| 5 | sanciones | CREATE | Agregar requireRole a API | - | INMEDIATO |
| 6 | apelaciones | VIEW | Remover admin_provincial de API | Agregar a web | A (no tiene UI) |
| 7 | conductores | FATIGUE | Validar rol en API PATCH | - | INMEDIATO |
| 8 | flota | CRUD | Agregar requireRole a todos | - | INMEDIATO |
| 9 | reportes | VIEW | Restricción: ciudadano vee solo suyos | - | INMEDIATO |
| 10 | conductores | CREATE | Alinear admin_provincial | - | MEDIANO PLAZO |
| 11 | vehículos | SUSPEND | Crear endpoint API o remover | - | MEDIANO PLAZO |
| 12 | admin_regional | JERARQUÍA | Eliminar rol O refactorizar | - | CRÍTICO |

---

## Bug Original - admin_regional

**Síntomas:**
- 6+ usuarios ven botones "Ver Detalle" / "Editar"
- Al hacer clic: ERROR 403 Forbidden
- No hay manejo de error en UI

**Causa raíz:**
admin_regional está en BD pero NO en matriz RBAC de API

**Manifestaciones:**
- conductores/[id]/page.tsx:21 - VIEW_ROLES incluye
- vehiculos/[id]/page.tsx:35 - VIEW_ROLES incluye
- GET /api/conductores/[id]:34 - NO incluye
- GET /api/vehiculos/[id]:26 - NO incluye

**Solución elegida:**
Remover admin_regional de todos VIEW_ROLES en web.
Si hay usuarios activos con este rol, migrar a admin_provincial.

---

## Validación

Total de drifts: 37
- CRÍTICOS: 12
- MEDIOS: 18
- BAJOS: 7

Archivos auditados:
- 53 páginas dashboard
- 143 handlers API

Status: REQUIERE ACCIÓN INMEDIATA

Próximos pasos:
1. Revisar hallazgos con team
2. Priorizar fixes críticos
3. Crear issues
4. Implementar en sprint actual
5. Agregar tests de RBAC
