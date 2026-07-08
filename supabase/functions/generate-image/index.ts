import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildImagePrompt } from "../_shared/prompts/image.ts";
import { CANON_IMAGE_DATA_URL } from "../_shared/assets/canon-b64.ts";
import { MODELS, OR_ENDPOINT, orHeaders } from "../_shared/openrouter.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";
import { lockOutcome } from "./lock.ts";

const IMAGE_PRICE_USD = 0.068; // google/gemini-3.1-flash-image, spec §3

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

  // Save-gated client call: any signed-in user (including the pre-Phase-5
  // anonymous session) may request art for a recipe they saved. "Saved" is a
  // client-local zustand set with no server representation (recipes are global
  // cache rows with user_id null), so it cannot be verified here. The cost
  // control is instead the once-only atomic lock below, bounded by the
  // per-user generation quota (spec §10).
  try {
    await requireUser(req);
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
  const { data: row, error } = await admin
    .from("recipes")
    .select("id, title, ingredient_groups")
    .eq("id", recipeId)
    .single();
  if (error || !row) {
    return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);
  }

  // Atomic double-spend guard: exactly one caller flips pending → generating.
  // Repeat saves / duplicate fires and cross-user saves of the same global
  // recipe find status != 'pending' and no-op without paying again.
  const { data: locked } = await admin
    .from("recipes")
    .update({ image_status: "generating" })
    .eq("id", recipeId)
    .eq("image_status", "pending")
    .select("id");
  if (lockOutcome(locked) === "skip") {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = buildImagePrompt({
    title: row.title as string,
    ingredientGroups: row.ingredient_groups,
  });

  try {
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
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

    await admin.from("recipes").update({
      image_status: "ready",
      image_storage_path: path,
      image_updated_at: new Date().toISOString(),
      last_image_prompt: prompt,
    }).eq("id", recipeId);

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
