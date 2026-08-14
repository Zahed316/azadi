/**
 * Shared API utility helpers for admin REST resource handlers.
 *
 * Extracts the repeated isSuperAdmin guard pattern and JSON response
 * builders used across 10+ API resource files.
 *
 * All response helpers require the caller to pass `corsHeaders` so the
 * CORS origin is never hardcoded — the router resolves the correct
 * origin from an allowlist per request.
 */

/**
 * Guard: ensures the request carries super_admin privileges.
 *
 * Returns a Response to send back to the client if the check fails,
 * or null if the caller should proceed (the user is a super_admin).
 *
 * The router already resolves auth and sets `isSuperAdmin` on
 * `ResourceCtx` before calling resource handlers, so this function
 * simply checks the boolean rather than re-implementing auth.
 */
export function requireSuperAdmin(
  isSuperAdmin: boolean,
  corsHeaders: Record<string, string>,
): Response | null {
  if (!isSuperAdmin) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: super admin only' }),
      { status: 403, headers: corsHeaders },
    );
  }
  return null;
}

/**
 * JSON success response with the caller-provided CORS headers.
 */
export function jsonSuccess<T>(
  data: T,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

/**
 * JSON error response with the caller-provided CORS headers.
 */
export function jsonError(
  message: string,
  corsHeaders: Record<string, string>,
  status = 400,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders,
  });
}

/**
 * Empty 204 No Content response with the caller-provided CORS headers.
 */
export function noContent(corsHeaders: Record<string, string>): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
