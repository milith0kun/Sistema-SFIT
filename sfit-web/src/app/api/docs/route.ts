import { NextResponse } from "next/server";

/**
 * GET /api/docs
 * Devuelve la especificación OpenAPI 3.0 del sistema SFIT en formato JSON.
 * No requiere autenticación — documentación pública.
 */
export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "SFIT API",
      version: "1.5.0",
      description:
        "API REST del Sistema de Fiscalización Inteligente de Transporte (SFIT). " +
        "Multi-tenant: la mayoría de endpoints requieren municipalityId implícito del token JWT.",
      contact: {
        name: "Soporte SFIT",
        email: "soporte@sfit.pe",
      },
    },
    servers: [
      {
        url: "/api",
        description: "Servidor principal",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Access token obtenido de /api/auth/login o /api/auth/google",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string", example: "Mensaje de error" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer", example: 100 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 50 },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      // ── AUTH ────────────────────────────────────────────────────────────────
      "/auth/login": {
        post: {
          tags: ["Autenticación"],
          summary: "Iniciar sesión con credenciales",
          description: "Autentica al usuario con email y contraseña. Devuelve access token y refresh token.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email", example: "fiscal@municipio.pe" },
                    password: { type: "string", minLength: 6, example: "Sfit2026!" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Autenticación exitosa",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    data: {
                      accessToken: "eyJhbGciOiJIUzI1NiJ9...",
                      refreshToken: "eyJhbGciOiJIUzI1NiJ9...",
                      user: { id: "64f...", name: "Fiscal Lima", role: "fiscal" },
                    },
                  },
                },
              },
            },
            "401": { description: "Credenciales incorrectas" },
          },
        },
      },
      "/auth/register": {
        post: {
          tags: ["Autenticación"],
          summary: "Registrar nuevo usuario",
          description: "Crea una cuenta nueva con rol ciudadano por defecto. El estado inicial es 'pendiente'.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "password"],
                  properties: {
                    name: { type: "string", example: "Juan Pérez" },
                    email: { type: "string", format: "email", example: "juan@example.pe" },
                    password: { type: "string", minLength: 8, example: "Sfit2026!" },
                    municipalityId: { type: "string", description: "ObjectId de la municipalidad" },
                    requestedRole: {
                      type: "string",
                      enum: ["fiscal", "operador", "conductor", "ciudadano"],
                      example: "ciudadano",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Usuario creado. Estado pendiente hasta aprobación." },
            "409": { description: "Email ya registrado" },
            "422": { description: "Errores de validación" },
          },
        },
      },
      "/auth/google": {
        post: {
          tags: ["Autenticación"],
          summary: "Iniciar sesión con Google OAuth",
          description: "Valida el ID token de Google y emite tokens SFIT.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["idToken"],
                  properties: {
                    idToken: { type: "string", description: "Google ID Token" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Autenticación exitosa" },
            "401": { description: "Token de Google inválido" },
          },
        },
      },
      // ── INSPECCIONES ────────────────────────────────────────────────────────
      "/inspecciones": {
        get: {
          tags: ["Inspecciones"],
          summary: "Listar inspecciones vehiculares",
          description: "Devuelve las inspecciones del municipio del usuario autenticado (paginado). Super Admin puede filtrar por municipalityId.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
            { name: "result", in: "query", schema: { type: "string", enum: ["aprobada", "observada", "rechazada"] } },
            { name: "vehicleId", in: "query", schema: { type: "string" } },
            { name: "municipalityId", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Lista paginada de inspecciones",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    data: {
                      items: [
                        {
                          id: "64f...",
                          result: "aprobada",
                          score: 95,
                          date: "2026-04-18T10:00:00Z",
                          vehicleTypeKey: "transporte_publico",
                        },
                      ],
                      total: 1,
                      page: 1,
                      limit: 50,
                    },
                  },
                },
              },
            },
            "401": { description: "No autenticado" },
            "403": { description: "Sin permiso" },
          },
        },
        post: {
          tags: ["Inspecciones"],
          summary: "Registrar nueva inspección vehicular",
          description: "Crea una inspección. Roles permitidos: fiscal, admin_municipal, super_admin. Dispara webhook inspection.created.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["vehicleId", "vehicleTypeKey", "checklistResults", "score", "result"],
                  properties: {
                    vehicleId: { type: "string", description: "ObjectId del vehículo" },
                    driverId: { type: "string", description: "ObjectId del conductor (opcional)" },
                    vehicleTypeKey: { type: "string", example: "transporte_publico" },
                    checklistResults: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item: { type: "string" },
                          passed: { type: "boolean" },
                          notes: { type: "string" },
                        },
                      },
                    },
                    score: { type: "number", minimum: 0, maximum: 100 },
                    result: { type: "string", enum: ["aprobada", "observada", "rechazada"] },
                    observations: { type: "string" },
                    evidenceUrls: { type: "array", items: { type: "string", format: "uri" } },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Inspección creada exitosamente" },
            "422": { description: "Errores de validación" },
          },
        },
      },
      // ── REPORTES ────────────────────────────────────────────────────────────
      "/reportes": {
        get: {
          tags: ["Reportes Ciudadanos"],
          summary: "Listar reportes ciudadanos",
          description: "Devuelve los reportes del municipio. Incluye conteo por estado.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["pendiente", "revision", "validado", "rechazado"] } },
          ],
          responses: {
            "200": { description: "Lista paginada de reportes con statusCounts" },
          },
        },
        post: {
          tags: ["Reportes Ciudadanos"],
          summary: "Enviar reporte ciudadano",
          description: "El ciudadano reporta una infracción. Otorga 5 SFITCoins al ciudadano.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["category", "description"],
                  properties: {
                    category: {
                      type: "string",
                      enum: [
                        "Exceso de velocidad", "Conductor agresivo", "Vehículo en mal estado",
                        "Falta de mantenimiento", "Incumplimiento de ruta", "Cobro indebido",
                        "Conducción peligrosa", "Contaminación ambiental", "Falta de señalización", "Otro",
                      ],
                    },
                    description: { type: "string", minLength: 10, maxLength: 2000 },
                    vehicleId: { type: "string" },
                    evidenceUrl: { type: "string", format: "uri" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Reporte creado. Se otorgan 5 SFITCoins al ciudadano." },
          },
        },
      },
      "/reportes/{id}": {
        patch: {
          tags: ["Reportes Ciudadanos"],
          summary: "Actualizar estado de un reporte",
          description: "Cambia el estado del reporte. Si pasa a 'validado' otorga 20 SFITCoins y dispara webhook report.validated.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["pendiente", "revision", "validado", "rechazado"] },
                    assignedFiscalId: { type: "string" },
                    fraudScore: { type: "number", minimum: 0, maximum: 100 },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Reporte actualizado" },
            "404": { description: "Reporte no encontrado" },
          },
        },
      },
      // ── APELACIONES ─────────────────────────────────────────────────────────
      "/apelaciones": {
        get: {
          tags: ["Apelaciones"],
          summary: "Listar apelaciones de sanciones",
          description: "Lista las apelaciones del municipio. Conductores ven solo las propias.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["pendiente", "en_revision", "aprobada", "rechazada"] } },
          ],
          responses: { "200": { description: "Lista paginada de apelaciones" } },
        },
        post: {
          tags: ["Apelaciones"],
          summary: "Presentar apelación",
          description: "El conductor apela una sanción vigente.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sanctionId", "reason"],
                  properties: {
                    sanctionId: { type: "string" },
                    reason: { type: "string", minLength: 20 },
                    evidenceUrls: { type: "array", items: { type: "string", format: "uri" } },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Apelación registrada" } },
        },
      },
      // ── FLOTA ───────────────────────────────────────────────────────────────
      "/flota": {
        get: {
          tags: ["Flota"],
          summary: "Listar entradas del registro de flota",
          description: "Devuelve el historial de asignaciones conductor-vehículo.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "vehicleId", in: "query", schema: { type: "string" } },
            { name: "driverId", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Lista de asignaciones de flota" } },
        },
        post: {
          tags: ["Flota"],
          summary: "Registrar asignación de flota",
          description: "Asigna un conductor a un vehículo para una jornada.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["vehicleId", "driverId"],
                  properties: {
                    vehicleId: { type: "string" },
                    driverId: { type: "string" },
                    routeId: { type: "string" },
                    startTime: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Asignación registrada" } },
        },
      },
      // ── FATIGA ──────────────────────────────────────────────────────────────
      "/conductor/fatiga": {
        get: {
          tags: ["Conductor / Fatiga"],
          summary: "Consultar estado de fatiga del conductor autenticado",
          description: "Devuelve el estado de fatiga calculado por FatigueEngine: apto, riesgo o no_apto.",
          responses: {
            "200": {
              description: "Estado de fatiga actual",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    data: {
                      status: "apto",
                      horasAcumuladas: 3.5,
                      alertaHoras: 4,
                      maxHoras: 8,
                    },
                  },
                },
              },
            },
          },
        },
      },
      // ── CIUDADANO COINS ─────────────────────────────────────────────────────
      "/ciudadano/coins": {
        get: {
          tags: ["Ciudadano / SFITCoins"],
          summary: "Consultar saldo de SFITCoins",
          description: "Devuelve el saldo actual y el historial de transacciones del ciudadano autenticado.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": {
              description: "Saldo e historial de SFITCoins",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    data: {
                      balance: 75,
                      transactions: [
                        { amount: 5, reason: "reporte_enviado", createdAt: "2026-04-18T10:00:00Z" },
                        { amount: 20, reason: "reporte_validado", createdAt: "2026-04-17T14:30:00Z" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      // ── WEBHOOKS ────────────────────────────────────────────────────────────
      "/admin/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "Listar webhooks del municipio",
          description: "Lista los webhooks activos. El secret nunca se expone en el listado.",
          responses: { "200": { description: "Lista de webhooks" } },
        },
        post: {
          tags: ["Webhooks"],
          summary: "Crear webhook de integración",
          description: "Crea un webhook y devuelve el secret UNA SOLA VEZ.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "events"],
                  properties: {
                    url: { type: "string", format: "uri", example: "https://mi-sistema.pe/webhook" },
                    events: {
                      type: "array",
                      items: { type: "string", enum: ["inspection.created", "report.validated", "sanction.issued"] },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Webhook creado. El campo secret solo aparece en esta respuesta.",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    data: {
                      id: "64f...",
                      url: "https://mi-sistema.pe/webhook",
                      events: ["inspection.created"],
                      secret: "a3f7c9...",
                      message: "Guarda este secret de forma segura. No volverá a mostrarse.",
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/admin/webhooks/{id}": {
        delete: {
          tags: ["Webhooks"],
          summary: "Eliminar webhook",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Webhook eliminado" },
            "404": { description: "Webhook no encontrado" },
          },
        },
      },
      // ── HEALTH ──────────────────────────────────────────────────────────────
      "/health": {
        get: {
          tags: ["Sistema"],
          summary: "Health check del sistema",
          description: "Verifica el estado de todos los componentes críticos. Sin autenticación.",
          security: [],
          responses: {
            "200": {
              description: "Estado del sistema (puede ser ok o degraded, siempre HTTP 200)",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    data: {
                      status: "ok",
                      version: "1.5.0",
                      timestamp: "2026-04-18T00:00:00.000Z",
                      checks: {
                        database: "ok",
                        firebase: "ok",
                        ocr: "not_installed",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'inline; filename="sfit-openapi.json"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
