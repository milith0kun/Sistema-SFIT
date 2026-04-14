import type { Role, UserStatus } from "@/lib/constants";

/**
 * Tipos globales del sistema SFIT.
 */

// ----- Usuario -----
export interface UserSession {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: Role;
  status: UserStatus;
  municipalityId?: string;
  provinceId?: string;
}

// ----- API -----
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export interface ApiValidationErrorResponse {
  success: false;
  errors: Record<string, string[]>;
}

export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse
  | ApiValidationErrorResponse;

// ----- Paginación -----
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ----- Multi-tenancy -----
export interface TenantContext {
  municipalityId: string;
  provinceId: string;
  role: Role;
}
