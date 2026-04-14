# SFIT — Sistema de Fiscalización Inteligente de Transporte

## Descripción del sistema

Plataforma multi-tenant para fiscalización y gestión de flota vehicular municipal. Una instancia sirve a múltiples municipalidades bajo una jerarquía provincial. Stack: **Next.js 16 + Flutter 3.29 + MongoDB Atlas**.

## Monorepo

```
Sistema Sfit/
├── sfit-web/   → Panel web admin (Next.js 16, App Router, Tailwind v4, TypeScript)
└── sfit-app/   → App móvil (Flutter 3.29, Dart 3.7, Riverpod 2, GoRouter)
```

## Jerarquía de roles

```
Super Admin → Admin Provincial → Admin Municipal → Fiscal / Operador → Conductor / Ciudadano
```

Plataformas por rol: Super Admin/Admin Provincial/Admin Municipal = Web; Fiscal/Operador = Web+Móvil; Conductor/Ciudadano = Móvil.

## Multi-tenancy

**Regla crítica**: toda consulta a MongoDB DEBE incluir `municipalityId` en el filtro. Nunca retornar datos entre tenants.

## Módulos (RF-01 → RF-19)

RF-01 Auth · RF-02 Provincias/Municipalidades · RF-03 Tipos de vehículo · RF-04 Empresas · RF-05 Conductores · RF-06 Vehículos · RF-07 Flota Operador · RF-08 Vista pública · RF-09 Rutas/Zonas · RF-10 Viajes · RF-11 Inspecciones · RF-12 Reportes ciudadanos · RF-13 Sanciones · RF-14 FatigueEngine · RF-15 Reputación · RF-16 Gamificación · RF-17 IA/OCR · RF-18 Notificaciones · RF-19 Estadísticas

## Seguridad

- JWT: access 15 min, refresh 7 días
- bcrypt: 12 rounds
- RBAC en todos los endpoints
- QR: HMAC-SHA256
- Imágenes de IA: procesar en tránsito, no almacenar

## Responder siempre en español
