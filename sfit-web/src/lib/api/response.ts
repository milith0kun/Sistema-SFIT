import { NextResponse } from "next/server";

/**
 * Respuesta JSON estandarizada para las API routes de SFIT.
 */
export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export function apiValidationError(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, errors },
    { status: 422 }
  );
}

export function apiUnauthorized(message = "No autorizado") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function apiForbidden(message = "Acceso denegado") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

export function apiNotFound(message = "Recurso no encontrado") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 404 }
  );
}
