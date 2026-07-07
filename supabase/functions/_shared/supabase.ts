import { createClient } from "npm:@supabase/supabase-js@2";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function userClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
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
