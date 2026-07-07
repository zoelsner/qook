import { serviceClient } from "../_shared/supabase.ts";
import { buildImagePrompt } from "../_shared/prompts/image.ts";
import { CANON_IMAGE_DATA_URL } from "../_shared/assets/canon-b64.ts";
import { MODELS, OR_ENDPOINT, orHeaders } from "../_shared/openrouter.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const IMAGE_PRICE_USD = 0.068; // google/gemini-3.1-flash-image, spec §3

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
  // Service-role only (fired on "Cook tonight" or by another edge fn).
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return errorResponse(ERRORS.UNAUTHORIZED, "Service role required.", 401);
  }

  const { recipeId } = (await req.json().catch(() => ({}))) as {
    recipeId?: string;
  };
  if (!recipeId) {
    return errorResponse(ERRORS.BAD_REQUEST, "recipeId required.", 400);
  }

  const admin = serviceClient();
  await admin.from("recipes").update({ image_status: "generating" }).eq(
    "id",
    recipeId,
  );

  const { data: row, error } = await admin
    .from("recipes")
    .select("id, title, ingredient_groups")
    .eq("id", recipeId)
    .single();
  if (error || !row) {
    await admin.from("recipes").update({
      image_status: "failed",
      image_error: "recipe_not_found",
    }).eq("id", recipeId);
    return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);
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

    const path = `${recipeId}.png`;
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
