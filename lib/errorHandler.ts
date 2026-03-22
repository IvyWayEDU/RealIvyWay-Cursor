import { NextResponse } from 'next/server';

export const DEFAULT_PUBLIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export type PublicErrorResponse = {
  success: false;
  message: string;
};

export type HandleApiErrorOptions = {
  status?: number;
  publicMessage?: string;
  logPrefix?: string;
  logContext?: Record<string, unknown>;
};

function normalizeUnknownError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : error.cause,
    };
  }

  return { value: error };
}

export function publicErrorResponse(message?: string): PublicErrorResponse {
  return {
    success: false,
    message: message?.trim() ? message : DEFAULT_PUBLIC_ERROR_MESSAGE,
  };
}

/**
 * Use in API route catch blocks to:
 * - log full server error details (including stack)
 * - return a safe, user-friendly message without leaking internals
 */
export function handleApiError(error: unknown, options: HandleApiErrorOptions = {}) {
  const status = options.status ?? 500;
  const publicMessage = options.publicMessage ?? DEFAULT_PUBLIC_ERROR_MESSAGE;

  const prefix = options.logPrefix?.trim() ? options.logPrefix.trim() : '[api]';
  const ctx = options.logContext ?? {};

  // Server-side logging only. Never return these details to the client.
  console.error(prefix, {
    status,
    ...ctx,
    error: normalizeUnknownError(error),
  });

  return NextResponse.json(publicErrorResponse(publicMessage), { status });
}

