import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, ERRORS } from "./errors.ts";

export function serviceClient(fetcher?: typeof fetch) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false }, ...(fetcher ? { global: { fetch: fetcher } } : {}) },
  );
}

export function userClient(authHeader: string, fetcher?: typeof fetch) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader }, ...(fetcher ? { fetch: fetcher } : {}) },
      auth: { persistSession: false },
    },
  );
}

// Paid routes reject anonymous sessions: anonymous accounts are free to mint,
// which would defeat per-user quotas.
export const signInRequiredResponse = () =>
  errorResponse(ERRORS.SIGN_IN_REQUIRED, "Sign in to generate dinners.", 403);

export async function requireUser(req: Request, options: { permanent?: boolean } = {}) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });
  if (options.permanent && data.user.is_anonymous === true) throw signInRequiredResponse();
  return { user: data.user, client };
}
