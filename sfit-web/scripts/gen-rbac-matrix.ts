/**
 * Generador de la documentación de la matriz RBAC.
 *
 * Lee `src/lib/auth/roleMatrix.ts` (vía import dinámico) y emite
 * `docs/rbac-matrix.md` con tres tablas:
 *   1. Recursos × roles × acciones (V/C/E/D)
 *   2. Roles especiales (FATIGUE_ROLES, SUSPEND_ROLES, FIXED_COMPANY_ROLES)
 *   3. Roles web vs mobile
 *
 * El archivo generado lleva un header con timestamp y un disclaimer
 * "auto-generado, no editar a mano". CI puede correr este script y
 * fallar si el diff con el archivo en repo no es vacío, asegurando
 * que la documentación siempre refleja la matriz real del código.
 *
 * Uso: cd sfit-web && npx tsx scripts/gen-rbac-matrix.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  ROLE_MATRIX,
  WEB_ALLOWED_ROLES,
  MOBILE_ONLY_ROLES,
  FATIGUE_ROLES,
  SUSPEND_ROLES,
  FIXED_COMPANY_ROLES,
  type Resource,
  type Action,
} from "../src/lib/auth/roleMatrix";
import { ROLES, type Role } from "../src/lib/constants";

const ALL_ROLES: Role[] = Object.values(ROLES);
const ACTIONS: Action[] = ["view", "create", "edit", "delete"];
const ACTION_SHORT: Record<Action, string> = {
  view: "V",
  create: "C",
  edit: "E",
  delete: "D",
};

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin_regional: "Admin Regional",
  admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal",
  fiscal: "Fiscal",
  operador: "Operador",
  conductor: "Conductor",
  ciudadano: "Ciudadano",
};

function buildRolePermissionString(resource: Resource, role: Role): string {
  const granted: string[] = [];
  for (const action of ACTIONS) {
    const allowed = ROLE_MATRIX[resource][action];
    if ((allowed as readonly Role[]).includes(role)) {
      granted.push(ACTION_SHORT[action]);
    }
  }
  return granted.length === 0 ? "—" : granted.join("");
}

function buildResourceTable(): string {
  const headers = ["Recurso", ...ALL_ROLES.map((r) => ROLE_LABEL[r])];
  const sep = headers.map(() => "---").join(" | ");
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${sep} |`,
  ];
  const resources = Object.keys(ROLE_MATRIX) as Resource[];
  for (const res of resources) {
    const row = [
      `**${res}**`,
      ...ALL_ROLES.map((r) => buildRolePermissionString(res, r)),
    ];
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines.join("\n");
}

function buildSpecialRolesSection(): string {
  const fmt = (label: string, roles: readonly Role[]) =>
    `- **${label}**: ${roles.map((r) => ROLE_LABEL[r]).join(", ") || "—"}`;
  return [
    fmt("FATIGUE_ROLES (cambian estado de fatiga del conductor)", FATIGUE_ROLES),
    fmt("SUSPEND_ROLES (suspenden vehículos)", SUSPEND_ROLES),
    fmt("FIXED_COMPANY_ROLES (empresa inmutable al crear conductor/vehículo)", FIXED_COMPANY_ROLES),
  ].join("\n");
}

function buildSurfaceTable(): string {
  const lines = [
    "| Rol | Web dashboard | App móvil |",
    "| --- | --- | --- |",
  ];
  for (const role of ALL_ROLES) {
    const web = (WEB_ALLOWED_ROLES as readonly Role[]).includes(role) ? "✅" : "—";
    const mobile = (MOBILE_ONLY_ROLES as readonly Role[]).includes(role)
      ? "✅ (exclusivo)"
      : "✅";
    lines.push(`| ${ROLE_LABEL[role]} | ${web} | ${mobile} |`);
  }
  return lines.join("\n");
}

async function main() {
  const now = new Date().toISOString();
  const md = `# Matriz RBAC de SFIT

> ⚠️ **Auto-generado** desde \`src/lib/auth/roleMatrix.ts\` el ${now}.
> No editar a mano. Re-genera con \`cd sfit-web && npx tsx scripts/gen-rbac-matrix.ts\`.

## Leyenda

- **V** = view (ver / listar)
- **C** = create (crear)
- **E** = edit (editar)
- **D** = delete (eliminar)
- **—** = sin permiso

## Permisos por recurso

${buildResourceTable()}

## Superficie por rol

${buildSurfaceTable()}

> Conductor y Ciudadano son **mobile-only**: el layout web
> (\`(dashboard)/layout.tsx\`) los redirige a \`MobileOnlyScreen\` excepto en
> \`/perfil\`. La matriz de arriba todavía les concede permisos porque la
> app móvil consume los mismos endpoints API.

## Roles especiales

${buildSpecialRolesSection()}

## Convenciones

- La matriz vive en \`sfit-web/src/lib/auth/roleMatrix.ts\` y es la **fuente única de verdad**.
- Los handlers API consumen \`rolesFor(resource, action)\` y \`requireRole(...)\`.
- Las páginas web usan \`hasWebPermission(role, resource, action)\` (filtra mobile-only).
- Los scopes territoriales (\`regionId\`, \`provinceId\`, \`municipalityId\`) se aplican **encima** de la matriz: los endpoints filtran por scope tras el check de rol.
- Para operador, el filtro adicional es \`companyId\` (resuelto vía \`getOperatorCompanyId(userId)\`).
`;

  const outPath = resolve(__dirname, "..", "..", "docs", "rbac-matrix.md");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, md, "utf8");
  console.log(`✓ Escrito: ${outPath}`);
  console.log(`  ${md.split("\n").length} líneas, ${Buffer.byteLength(md, "utf8")} bytes`);
}

main().catch((err) => {
  console.error("✖ Error generando matriz:", err);
  process.exit(1);
});
