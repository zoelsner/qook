// supabase-js wraps a non-2xx Edge Function reply in an error whose `context`
// is the raw Response. Our functions answer with `{ code, message }` JSON
// (see supabase/functions/_shared/errors.ts); some paths reply in plain text.
export interface FunctionErrorDetails {
  status?: number;
  code?: string;
  message?: string;
}

export async function readFunctionError(error: unknown): Promise<FunctionErrorDetails> {
  const response = (error as { context?: Response } | null | undefined)?.context;
  if (!response || typeof response.clone !== 'function') return {};
  const body = await response.clone().json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  return {
    status: typeof response.status === 'number' ? response.status : undefined,
    code: typeof body?.code === 'string' ? body.code : undefined,
    message: message || undefined,
  };
}

// Auth and rate-limit rejections answer the same way twice; re-asking a 429
// only digs the hole deeper.
export function shouldRetryFunctionError(details: FunctionErrorDetails): boolean {
  return details.status !== 401 && details.status !== 403 && details.status !== 429;
}
