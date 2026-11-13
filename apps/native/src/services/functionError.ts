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

// A rejected Edge Function call. Keeps the server's code and HTTP status so
// callers can choose copy (generationErrorMessage) and skip retries.
export class FunctionCallError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, details: FunctionErrorDetails = {}) {
    super(message);
    this.code = details.code;
    this.status = details.status;
  }
}

// Codes our functions send (supabase/functions/_shared/errors.ts). Anything
// else with a JSON `message` (a gateway or platform reply) is not our copy.
const OWN_CODES = new Set(['rate_limited', 'unauthorized', 'sign_in_required', 'validation',
  'generation_failed', 'empty_list', 'image_failed', 'not_found', 'bad_request']);

export function ownFunctionMessage(details: FunctionErrorDetails): string | undefined {
  return details.code && OWN_CODES.has(details.code) ? details.message : undefined;
}
