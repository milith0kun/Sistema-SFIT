# Matriz RBAC de SFIT

> ⚠️ **Auto-generado** desde `src/lib/auth/roleMatrix.ts` el 2026-05-11T00:04:28.348Z.
> No editar a mano. Re-genera con `cd sfit-web && npx tsx scripts/gen-rbac-matrix.ts`.

## Leyenda

- **V** = view (ver / listar)
- **C** = create (crear)
- **E** = edit (editar)
- **D** = delete (eliminar)
- **—** = sin permiso

## Permisos por recurso

| Recurso | Super Admin | Admin Regional | Admin Provincial | Admin Municipal | Fiscal | Operador | Conductor | Ciudadano |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **conductores** | VCED | VCED | VCED | VCED | VE | VCE | — | — |
| **vehiculos** | VCED | VCED | VCED | VCED | V | VCE | V | — |
| **flota** | VCED | VCED | VCED | VCED | V | VCE | VCE | — |
| **viajes** | VCED | VCED | VCED | VCED | V | VCE | VE | — |
| **rutas** | VCED | VCED | VCED | VCED | V | VCE | V | — |
| **empresas** | VCED | VCE | VCE | VCE | V | VE | — | — |
| **inspecciones** | VD | V | V | VD | VCE | V | — | — |
| **sanciones** | VD | V | V | VD | VCE | V | V | — |
| **apelaciones** | VED | VE | VE | VE | VE | C | VC | — |
| **reportes** | VED | V | V | VE | VE | V | — | VC |
| **recompensas** | VCED | V | V | VCE | — | — | — | V |
| **usuarios** | VCED | VCE | VCE | VCE | — | — | — | — |
| **municipalidades** | VCED | VCE | VCE | V | — | — | — | — |
| **provincias** | VCED | VCE | V | — | — | — | — | — |
| **regiones** | VCED | V | — | — | — | — | — | — |
| **aprobaciones** | VCED | VCE | VCE | VCE | — | — | — | — |

## Superficie por rol

| Rol | Web dashboard | App móvil |
| --- | --- | --- |
| Super Admin | ✅ | ✅ |
| Admin Regional | ✅ | ✅ |
| Admin Provincial | ✅ | ✅ |
| Admin Municipal | ✅ | ✅ |
| Fiscal | — | ✅ (exclusivo) |
| Operador | — | ✅ (exclusivo) |
| Conductor | — | ✅ (exclusivo) |
| Ciudadano | — | ✅ (exclusivo) |

> Conductor y Ciudadano son **mobile-only**: el layout web
> (`(dashboard)/layout.tsx`) los redirige a `MobileOnlyScreen` excepto en
> `/perfil`. La matriz de arriba todavía les concede permisos porque la
> app móvil consume los mismos endpoints API.

## Roles especiales

- **FATIGUE_ROLES (cambian estado de fatiga del conductor)**: Super Admin, Admin Municipal, Fiscal
- **SUSPEND_ROLES (suspenden vehículos)**: Super Admin, Admin Municipal, Fiscal
- **FIXED_COMPANY_ROLES (empresa inmutable al crear conductor/vehículo)**: Operador

## Convenciones

- La matriz vive en `sfit-web/src/lib/auth/roleMatrix.ts` y es la **fuente única de verdad**.
- Los handlers API consumen `rolesFor(resource, action)` y `requireRole(...)`.
- Las páginas web usan `hasWebPermission(role, resource, action)` (filtra mobile-only).
- Los scopes territoriales (`regionId`, `provinceId`, `municipalityId`) se aplican **encima** de la matriz: los endpoints filtran por scope tras el check de rol.
- Para operador, el filtro adicional es `companyId` (resuelto vía `getOperatorCompanyId(userId)`).
