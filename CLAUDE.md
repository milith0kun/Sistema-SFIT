## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Separación de superficies (mayo 2026)

Desde la migración de 2026-05-10:

- **Web** (`sfit-web/`): exclusiva para los 4 admins jerárquicos —
  `super_admin → admin_regional → admin_provincial → admin_municipal`.
  Fuente de verdad: `WEB_ALLOWED_ROLES` en `src/lib/auth/roleMatrix.ts`.
- **App móvil** (`sfit-app/`): para los 4 roles operativos — `fiscal`,
  `operador`, `conductor`, `ciudadano`. Fuente de verdad: `MOBILE_ONLY_ROLES`
  en el mismo archivo. El layout `(dashboard)/layout.tsx:122` redirige estos
  roles a `MobileOnlyScreen` (excepto `/perfil`).
- **`admin_regional` ya NO está deprecado** — volvió a la jerarquía
  geográfica con lógica propia en `canEditCompany` y `scopedCompanyFilter`.
- **RoleGuard del app**: `sfit-app/lib/core/router/app_router.dart` bloquea
  deep-links cross-role (`/operador/*`, `/fiscal/*`, `/conductor/*`).
- Si cambian las matrices: correr
  `npx tsx scripts/invalidate-fiscal-operador-sessions.ts` post-deploy para
  invalidar sesiones web vivas de fiscal/operador.
