import { Prisma } from "@prisma/client";

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return Response.json({ code, message, ...(details ? { details } : {}) }, { status });
}

export function unexpectedError() {
  return errorResponse(500, "INTERNAL_ERROR", "Ocurrió un error inesperado.");
}

export function isDatabaseInitializationError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError;
}