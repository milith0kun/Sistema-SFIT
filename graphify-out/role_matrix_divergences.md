# Divergencias roleMatrix - estado tras refactor completo

Casos donde el archivo (page o handler) NO coincide con la matriz.
Cada uno requiere decisión: ajustar matriz o ajustar archivo.
**Política**: por defecto, NO se modificó el archivo (puede tener restricciones intencionales).


## Resumen

- Handlers API divergentes: 41
- Pages dashboard divergentes: 0


## Handlers — categorización

### CONDUCTOR de más en handler (4)
Estos endpoints son consumidos por el conductor desde el app móvil. La matriz no incluye CONDUCTOR para esa acción genérica, pero el handler sí debe permitirlo. **Sugerencia**: agregar CONDUCTOR a la matriz para esa acción, o documentar como excepción intencional.

| Archivo | Método | Recurso/Acción |
|---|---|---|
| `app/api/conductores/me/route.ts` | GET | conductores/view |
| `app/api/inspecciones/route.ts` | GET | inspecciones/view |
| `app/api/rutas/[id]/captures/route.ts` | POST | rutas/create |
| `app/api/viajes/[id]/manifest-photo/route.ts` | POST | viajes/create |

### Endpoints `/me/*` con auto-acceso (2)
Endpoints que el dueño del recurso opera sobre sí mismo (ej. `/conductores/me`, `/usuarios/me`). Por diseño solo aceptan al rol dueño. **Sugerencia**: NO migrar a la matriz general; son casos especiales. La matriz cubre la acción "editar conductor X" mientras estos cubren "editar mi propio perfil".

| Archivo | Método | Recurso/Acción | Handler | Matriz |
|---|---|---|---|---|
| `app/api/conductores/me/route.ts` | GET | conductores/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/conductores/me/route.ts` | PATCH | conductores/edit | ['CONDUCTOR'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |

### Otros casos (36)
Cada uno requiere decisión manual.

| Archivo | Método | Recurso/Acción | Handler tiene | Matriz dice |
|---|---|---|---|---|
| `app/api/apelaciones/[id]/route.ts` | GET | apelaciones/view | ['OPERADOR'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'SUPER_ADMIN'] |
| `app/api/apelaciones/route.ts` | GET | apelaciones/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'SUPER_ADMIN'] |
| `app/api/apelaciones/route.ts` | POST | apelaciones/create | ['OPERADOR'] | ['CONDUCTOR'] |
| `app/api/empresas/[id]/route.ts` | DELETE | empresas/delete | ['ADMIN_MUNICIPAL', 'SUPER_ADMIN'] | ['SUPER_ADMIN'] |
| `app/api/empresas/[id]/route.ts` | PATCH | empresas/edit | ['ADMIN_MUNICIPAL', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/flota/[id]/location/route.ts` | GET | flota/view | ['ADMIN_MUNICIPAL', 'CONDUCTOR', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/flota/active-locations/route.ts` | GET | flota/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/municipalidades/[id]/route.ts` | DELETE | municipalidades/delete | ['ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'SUPER_ADMIN'] | ['SUPER_ADMIN'] |
| `app/api/municipalidades/route.ts` | POST | municipalidades/create | ['SUPER_ADMIN'] | ['ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'SUPER_ADMIN'] |
| `app/api/regiones/route.ts` | GET | regiones/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_REGIONAL', 'SUPER_ADMIN'] |
| `app/api/reportes/[id]/apoyar/route.ts` | POST | reportes/create | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CIUDADANO', 'FISCAL', 'SUPER_ADMIN'] | ['CIUDADANO'] |
| `app/api/reportes/[id]/route.ts` | GET | reportes/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CIUDADANO', 'FISCAL', 'SUPER_ADMIN'] |
| `app/api/reportes/mis-reportes/route.ts` | GET | reportes/view | ['CIUDADANO'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CIUDADANO', 'FISCAL', 'SUPER_ADMIN'] |
| `app/api/reportes/route.ts` | GET | reportes/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CIUDADANO', 'FISCAL', 'SUPER_ADMIN'] |
| `app/api/reportes/route.ts` | POST | reportes/create | ['ADMIN_MUNICIPAL', 'CIUDADANO', 'FISCAL', 'SUPER_ADMIN'] | ['CIUDADANO'] |
| `app/api/rutas/[id]/captures/[captureId]/preview/route.ts` | GET | rutas/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/rutas/[id]/captures/route.ts` | GET | rutas/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/rutas/candidatas/[id]/route.ts` | GET | rutas/view | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/rutas/candidatas/route.ts` | GET | rutas/view | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/sanciones/[id]/apelar/route.ts` | POST | sanciones/create | ['CONDUCTOR'] | ['ADMIN_MUNICIPAL', 'FISCAL', 'SUPER_ADMIN'] |
| `app/api/sanciones/[id]/route.ts` | GET | sanciones/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/vehiculos/[id]/qr/route.ts` | GET | vehiculos/view | ['ADMIN_MUNICIPAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/vehiculos/[id]/route.ts` | GET | vehiculos/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/vehiculos/[id]/suspender/route.ts` | PATCH | vehiculos/edit | ['ADMIN_MUNICIPAL', 'FISCAL', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/aceptar/route.ts` | POST | viajes/create | ['CONDUCTOR'] | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/iniciar/route.ts` | POST | viajes/create | ['CONDUCTOR'] | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/manifest-photo/route.ts` | DELETE | viajes/delete | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/manifiesto.xlsx/route.ts` | GET | viajes/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/pasajeros/[pid]/route.ts` | DELETE | viajes/delete | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/pasajeros/[pid]/route.ts` | PATCH | viajes/edit | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'CONDUCTOR', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/rechazar/route.ts` | POST | viajes/create | ['CONDUCTOR'] | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/route.ts` | GET | viajes/view | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/route.ts` | PATCH | viajes/edit | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'CONDUCTOR', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/[id]/tomar/route.ts` | POST | viajes/create | ['CONDUCTOR'] | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/auto-close/route.ts` | POST | viajes/create | ['SUPER_ADMIN'] | ['ADMIN_MUNICIPAL', 'OPERADOR', 'SUPER_ADMIN'] |
| `app/api/viajes/disponibles/route.ts` | GET | viajes/view | ['CONDUCTOR'] | ['ADMIN_MUNICIPAL', 'ADMIN_PROVINCIAL', 'ADMIN_REGIONAL', 'CONDUCTOR', 'FISCAL', 'OPERADOR', 'SUPER_ADMIN'] |

## Pages dashboard divergentes (0)

| Archivo | Const | Recurso/Acción | Page tiene | Matriz dice (sin mobile) |
|---|---|---|---|---|