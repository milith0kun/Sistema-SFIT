<!-- BEGIN:nextjs-agent-rules -->
# SFIT Web — Next.js 16 (App Router)

> Esta versión de Next.js puede tener breaking changes. Leer `node_modules/next/dist/docs/` ante dudas. Respetar avisos de deprecación.
<!-- END:nextjs-agent-rules -->

## Stack

Next.js 16 · React 19 · TypeScript estricto · Tailwind CSS v4 · Mongoose 9 · MongoDB Atlas

## Arquitectura

```
src/
├── app/
│   ├── (auth)/         → login, register, reset-password
│   ├── (dashboard)/    → rutas protegidas por rol
│   ├── (public)/       → vista pública vehículo/conductor
│   ├── api/            → Route Handlers (GET/POST/PATCH/DELETE)
│   └── layout.tsx      → RootLayout con ThemeProvider
├── components/
│   ├── ui/             → Button, Input, Badge, Card, Dialog, Table…
│   ├── layout/         → Sidebar, Header, Breadcrumb
│   └── [feature]/      → componentes específicos del dominio
├── lib/
│   ├── auth/jwt.ts     → helpers JWT (sign/verify/decode)
│   ├── db/mongoose.ts  → conexión singleton MongoDB
│   ├── api/response.ts → apiResponse, apiError, apiUnauthorized…
│   └── constants.ts    → ROLES, USER_STATUS, VEHICLE_STATUS, etc.
├── models/             → Mongoose schemas (User, Province, Municipality…)
├── hooks/              → custom hooks client-side
└── types/index.ts      → interfaces globales TypeScript
```

## Reglas Next.js

- **Server Components por defecto**; `"use client"` solo para interactividad/hooks.
- **App Router exclusivamente** — nunca Pages Router.
- **Route Handlers** en `src/app/api/[recurso]/route.ts`.
- **Server Actions** para mutaciones formulario con `"use server"`.
- Archivos de ruta: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Fetch en Server Components con `cache` y `revalidate` apropiados.

## Convenciones de código

- TypeScript estricto — sin `any`.
- Nombres: componentes en PascalCase, archivos en kebab-case, constantes en SCREAMING_SNAKE.
- Todo endpoint API verifica JWT y extrae `{ userId, role, municipalityId }` del token.
- Todo query Mongoose filtra por `municipalityId` salvo que sea Super Admin o Admin Provincial.
- Errores HTTP estándar: 400 validación, 401 no auth, 403 sin permisos, 404 no encontrado, 500 server.

## Tailwind v4

- Configuración de tokens en `@theme` dentro de `globals.css`.
- No usar `tailwind.config.ts` — Tailwind v4 no lo requiere.
- Usar variables CSS (`var(--color-primary)`) para colores del sistema.

## Mongoose / MongoDB

- Conexión singleton en `lib/db/mongoose.ts`.
- Siempre `import { connectDB } from "@/lib/db/mongoose"` antes de queries.
- Índices compuestos obligatorios en `{ municipalityId, [campo] }`.
- No retornar campos sensibles: `password`, `refreshToken`.
