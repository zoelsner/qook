// supabase/functions/delete-account/index.ts
// Cascade verified 2026-07-06 against 20260421000000_init_schema.sql:
// auth.users -> profiles (on delete cascade) -> all user-owned tables
// (user_preferences, user_saved_recipes, weekly_decks, deck_items,
// generation_sessions, generation_items, grocery_items) and user-owned
// recipes. Global-cache recipes (user_id IS NULL) are preserved.
// Apple Sign in with Apple users also revoke their SIWA token before deletion
// (App Store Guideline 5.1.1(v)).
import { handleDeleteAccount } from "./handler.ts";

Deno.serve((req) => handleDeleteAccount(req));
