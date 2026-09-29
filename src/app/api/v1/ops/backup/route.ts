import { errorResponse, unexpectedError } from "@/server/http";
import { runBackup } from "@/server/services/backup";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorized(request)) return errorResponse(401, "UNAUTHORIZED", "No autorizado.");
  try {
    return Response.json(await runBackup());
  } catch {
    return unexpectedError();
  }
}

export const maxDuration = 60;

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
