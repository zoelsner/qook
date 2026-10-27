import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildImagePrompt } from "../_shared/prompts/image.ts";
import { DishContractSchema, validateDishContract } from "../_shared/dish-contract.ts";
import { CANON_IMAGE_DATA_URL } from "../_shared/assets/canon-b64.ts";
import { MODELS, OR_ENDPOINT, orHeaders } from "../_shared/openrouter.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";
import { claimImageAttempt, type ImageClaim } from "./attempt.ts";

// Effective model is the OR_IMAGE_MODEL secret (google/gemini-3.1-flash-lite-image
// since the 2026-07-11 bake-off: same artist's hand, half the price, 4-9s vs ~14s).
const IMAGE_PRICE_USD = 0.034;

// Storage path and the DB's image_storage_path must agree with the actual
// bytes' MIME type — hardcoding .png silently wrote mismatched extensions
// for jpeg/webp responses.
function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function extractImageBytes(json: unknown): { bytes: Uint8Array; mime: string } {
  // deno-lint-ignore no-explicit-any
  const msg = (json as any)?.choices?.[0]?.message;
  const first = Array.isArray(msg?.images) ? msg.images[0] : null;
  const url = first?.image_url?.url ?? first?.url ?? null;
  if (!url || typeof url !== "string") throw new Error("no image url in response");
  if (url.startsWith("data:")) {
    const [header, b64] = url.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return { bytes, mime };
  }
  throw new Error("non-data image url; expected inline b64");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Use the verified identity, never a user ID supplied in the request body.
  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const { recipeId } = (await req.json().catch(() => ({}))) as {
    recipeId?: string;
  };
  if (!recipeId) {
    return errorResponse(ERRORS.BAD_REQUEST, "recipeId required.", 400);
  }

  const admin = serviceClient();

  // Fetch prompt inputs first so a genuinely missing recipe is a clean 404
  // (distinct from the "already claimed" no-op below).
  // proposal_ingredients / proposal_steps are the ONLY ingredient data a
  // skeleton row has — art fires at deal time, before fill-recipe writes
  // ingredient_groups/workflow_sections (which default to '[]'). Selecting only
  // the jsonb columns meant every draft-time image prompt was built from the
  // title alone.
  const { data: row, error } = await admin
    .from("recipes")
    .select(
      "id, title, ingredient_groups, workflow_sections, proposal_ingredients, proposal_steps, dish_contract, image_status, image_attempt_count",
    )
    .eq("id", recipeId)
    .single();
  if (error || !row) {
    return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);
  }

  // Reject a malformed saved identity before reserving any paid attempt.
  // Only genuinely legacy rows may use the ingredient/method fallback.
  let dishContract;
  if (row.dish_contract != null) {
    const parsed = DishContractSchema.safeParse(row.dish_contract);
    const ingredients = Array.isArray(row.proposal_ingredients)
      ? row.proposal_ingredients.filter((x: unknown): x is string => typeof x === "string")
      : [];
    const steps = Array.isArray(row.proposal_steps)
      ? row.proposal_steps.filter((x: unknown): x is string => typeof x === "string")
      : [];
    if (!parsed.success || validateDishContract(parsed.data, ingredients, steps).length) {
      return errorResponse(ERRORS.VALIDATION, "This meal has an invalid dish description. Choose a new dinner idea.", 422);
    }
    dishContract = parsed.data;
  }

  // Claim and increment together before the paid image call. A failed
  // request keeps its count; retries stop after three recorded attempts.
  let claim: ImageClaim;
  try {
    claim = await claimImageAttempt(admin, row.id, userId);
  } catch (err) {
    console.error("generate-image claim error", String(err));
    return errorResponse(ERRORS.GENERATION_FAILED, "Could not start image generation.", 500);
  }
  if (claim === "not_found") {
    return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);
  }
  if (claim === "daily_limit") {
    return errorResponse(
      ERRORS.IMAGE_FAILED,
      "You’ve reached 50 image attempts in the last 24 hours. Your recipes are still available. Try again later.",
      429,
    );
  }
  if (claim === "exhausted") {
    return errorResponse(
      ERRORS.IMAGE_FAILED,
      "This image has reached its retry limit. The recipe is still available.",
      429,
    );
  }
  if (claim === "skip") {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Paint the exact same saved dish contract used by fill-recipe. This
    // removes the separate text-model description call for every image.
    const prompt = buildImagePrompt({
      title: row.title as string,
      ingredientGroups: row.ingredient_groups,
      workflowSections: row.workflow_sections,
      proposalIngredients: row.proposal_ingredients,
      proposalSteps: row.proposal_steps,
      dishContract,
    });
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      // 60s hard cap: observed generations run ~19s; a hung fetch must not
      // strand image_status='generating'. On abort the catch below marks 'failed'.
      signal: AbortSignal.timeout(60_000),
      headers: orHeaders(),
      body: JSON.stringify({
        model: MODELS.image(),
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: CANON_IMAGE_DATA_URL } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`image gen ${resp.status}: ${await resp.text()}`);
    const json = await resp.json();
    const { bytes, mime } = extractImageBytes(json);

    const path = `${recipeId}.${extensionForMime(mime)}`;
    const up = await admin.storage.from("meal-images").upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: "31536000",
    });
    if (up.error) throw up.error;

    const { error: publishError } = await admin.from("recipes").update({
      image_status: "ready",
      image_storage_path: path,
      image_updated_at: new Date().toISOString(),
      last_image_prompt: prompt,
    }).eq("id", recipeId);
    if (publishError) throw new Error("Could not publish generated meal image");

    console.log(
      JSON.stringify({
        tag: "or_cost",
        label: "image",
        model: MODELS.image(),
        usd: IMAGE_PRICE_USD,
      }),
    );
    return new Response(JSON.stringify({ ok: true, path }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await admin.from("recipes").update({
      image_status: "failed",
      image_error: String(err).slice(0, 400),
    }).eq("id", recipeId);
    console.error("generate-image error", String(err));
    // Client renders letter-vignette on failed status (restyle plan, spec §6).
    return errorResponse(ERRORS.IMAGE_FAILED, "Image generation failed.", 502);
  }
});
