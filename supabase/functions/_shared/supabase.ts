import { createClient } from "npm:@supabase/supabase-js@2";

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

export async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });
  return { user: data.user, client };
}
