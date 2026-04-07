import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export type RequestBodyValidationError =
  | {
      kind: 'zod';
      message: 'Validation failed';
      details: Array<{ path: string; message: string }>;
      rawError: z.ZodError;
    }
  | {
      kind: 'invalid_json';
      message: 'Invalid JSON in request body';
      rawError: unknown;
    }
  | {
      kind: 'unknown';
      message: 'Invalid request body';
      rawError: unknown;
    };

/**
 * Validates request body against a Zod schema and returns parsed data or error response
 * Strips unknown fields to reject unexpected data
 */
export async function validateRequestBody<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<
  | { success: true; data: z.output<S> }
  | { success: false; response: NextResponse; error: RequestBodyValidationError }
> {
  try {
    const body = await request.json();
    // Use strict mode to reject unknown fields (when schema supports it)
    const strictSchema =
      typeof (schema as any)?.strict === 'function'
        ? ((schema as any).strict() as S)
        : schema;
    const parsed = strictSchema.parse(body);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return {
        success: false,
        error: {
          kind: 'zod',
          message: 'Validation failed',
          details,
          rawError: error,
        },
        response: NextResponse.json(
          {
            error: 'Validation failed',
            details,
          },
          { status: 400 }
        ),
      };
    }
    // JSON parse error
    return {
      success: false,
      error: {
        kind: 'invalid_json',
        message: 'Invalid JSON in request body',
        rawError: error,
      },
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
export function validateQueryParams<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): { success: true; data: z.output<S> } | { success: false; response: NextResponse } {
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
    
    const strictSchema =
      typeof (schema as any)?.strict === 'function' ? ((schema as any).strict() as S) : schema;
    const parsed = strictSchema.parse(params);
    return { success: true, data: parsed };
  } catch (error) {
    const anyError = error as unknown as { errors?: unknown; issues?: unknown; message?: unknown };
    const zodStyleErrors =
      Array.isArray(anyError?.issues) ? anyError.issues : Array.isArray(anyError?.errors) ? anyError.errors : null;

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


