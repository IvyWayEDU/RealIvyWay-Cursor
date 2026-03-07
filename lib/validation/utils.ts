import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates request body against a Zod schema and returns parsed data or error response
 * Strips unknown fields to reject unexpected data
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    // Use strict mode to reject unknown fields
    const parsed = schema.strict().parse(body);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    // JSON parse error
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: Record<string, string | string[]> = {};
    
    // Convert URLSearchParams to object
    for (const [key, value] of searchParams.entries()) {
      if (params[key]) {
        // Multiple values - convert to array
        const existing = params[key];
        params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        params[key] = value;
      }
    }
    
    const parsed = schema.strict().parse(params);
    return { success: true, data: parsed };
  } catch (error) {
    const anyError = error as unknown as { errors?: unknown; message?: unknown };
    const zodStyleErrors = Array.isArray(anyError?.errors) ? anyError.errors : null;

    if (zodStyleErrors) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: zodStyleErrors.map((err: any) => ({
              path: Array.isArray(err?.path) ? err.path.join('.') : 'unknown',
              message: typeof err?.message === 'string' ? err.message : 'Validation failed',
            })),
          },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: [
            {
              path: 'unknown',
              message:
                typeof anyError?.message === 'string' && anyError.message
                  ? anyError.message
                  : 'Validation failed',
            },
          ],
        },
        { status: 400 }
      ),
    };
  }
}


