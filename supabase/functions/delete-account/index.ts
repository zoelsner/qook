// supabase/functions/delete-account/index.ts
// Cascade verified 2026-07-06 against 20260421000000_init_schema.sql:
// auth.users -> profiles (on delete cascade) -> all user-owned tables
// (user_preferences, user_saved_recipes, weekly_decks, deck_items,
// generation_sessions, generation_items, grocery_items) and user-owned
// recipes. Global-cache recipes (user_id IS NULL) are preserved.
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const admin = serviceClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("delete-account error", error.message);
    return errorResponse(
      ERRORS.GENERATION_FAILED,
      "Could not delete account. Try again.",
      500,
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
