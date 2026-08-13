/**
 * Numeric validation utilities for REST API path and query parameters.
 *
 * Replaces bare parseInt() calls which return NaN on invalid input.
 * NaN propagates silently through comparisons (NaN > N is false),
 * allowing range guards to bypass — see memory:
 * rest-api-target-user-idor-and-nan-bypass.
 */

/**
 * Parse a required integer from a path segment. Returns a 400 Response
 * if the value is missing, empty, or not a finite integer.
 */
export function parseRequiredInt(value: string | undefined, name: string): number | Response {
  if (value === undefined || value === '') {
    return new Response(JSON.stringify({ error: `${name} is required` }), { status: 400 });
  }
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return new Response(JSON.stringify({ error: `${name} must be a valid integer` }), {
      status: 400,
    });
  }
  return parsed;
}

/**
 * Parse an optional integer from a query parameter. Returns null if the
 * value is absent, empty, or not a valid integer within optional bounds.
 */
export function parseOptionalInt(
  value: string | null | undefined,
  name: string,
  opts?: { min?: number; max?: number },
): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
  if (opts?.min !== undefined && parsed < opts.min) return null;
  if (opts?.max !== undefined && parsed > opts.max) return null;
  return parsed;
}

/**
 * Parse a required integer with bounds checking. Returns a 400 Response
 * if the value is missing, non-integer, or outside [min, max].
 */
export function parseBoundedInt(
  value: string | undefined,
  name: string,
  min: number,
  max: number,
): number | Response {
  const result = parseRequiredInt(value, name);
  if (result instanceof Response) return result;
  if (result < min || result > max) {
    return new Response(JSON.stringify({ error: `${name} must be between ${min} and ${max}` }), {
      status: 400,
    });
  }
  return result;
}
