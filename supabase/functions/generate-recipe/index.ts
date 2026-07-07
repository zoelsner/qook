import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { chatStream } from "../_shared/openrouter-stream.ts";
import {
  buildLiveSystemPrompt,
  buildLiveUserPrompt,
} from "../_shared/prompts/live.ts";
import { Recipe } from "../_shared/schema.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { extractPartialRecipes, stripCodeFences } from "../_shared/partial-parser.ts";
import {
  computeSignature,
  dbRowToClientRecipe,
  toRecipeInsert,
} from "../_shared/recipe-map.ts";
import { ERRORS } from "../_shared/errors.ts";

const RequestBody = z.object({
  tier: z.enum([
    "brain-is-fried",
    "after-work",
    "got-energy",
    "weekend-project",
  ]),
  context: z.string().optional(),
});

const ResponseEnvelope = z.object({ recipes: z.array(Recipe).length(3) });

// deno-lint-ignore no-explicit-any
type Admin = any;

export async function persistRecipes(
  admin: Admin,
  recipes: Recipe[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const r of recipes) {
    const signature = await computeSignature(r);
    const { data: existing } = await admin
      .from("recipes")
      .select("id")
      .eq("signature", signature)
      .is("user_id", null)
      .maybeSingle();
    if (existing) {
      ids.push(existing.id);
      await admin.rpc("increment_use_count", { recipe_id: existing.id });
    } else {
      const { data: inserted, error } = await admin
        .from("recipes")
        .insert(toRecipeInsert(r, signature))
        .select("id")
        .single();
      if (error) throw error;
      ids.push(inserted.id);
    }
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const uc = userClient(authHeader);
  const { data: { user } } = await uc.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ code: ERRORS.UNAUTHORIZED, message: "Sign in required." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const admin = serviceClient();

  // Rate limit BEFORE any AI call.
  const quota = await checkQuota(admin, user.id);
  if (!quota.ok) {
    return new Response(
      JSON.stringify({
        code: ERRORS.RATE_LIMITED,
        message: quota.scope === "day"
          ? "You've hit today's recipe limit — back tomorrow."
          : "You've hit this month's recipe limit.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const parsedBody = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return new Response(
      JSON.stringify({ code: ERRORS.BAD_REQUEST, message: "Bad request body." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const { tier, context } = parsedBody.data;

  // Record a session row so the quota window counts this generation.
  await admin.from("generation_sessions").insert({
    user_id: user.id,
    flavor_mode: "comfort",
    effort_mode: "standard",
    energy_tier: tier,
    recipe_count: 3,
    voice_context: context ?? null,
    status: "generating",
  });

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const liveCtx = buildLiveContext(tier, prefs ?? null, context);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );

      send("ready", { status: "generating" });
      const emittedTitles = new Set<number>();

      try {
        const full = await chatStream(
          [
            { role: "system", content: buildLiveSystemPrompt() },
            { role: "user", content: buildLiveUserPrompt(liveCtx) },
          ],
          {
            onPartial: (buf) => {
              const partials = extractPartialRecipes(buf);
              if (partials.length) {
                send("partial", { recipes: partials });
                partials.forEach((p, i) => {
                  const title = (p as { title?: string }).title;
                  if (title && !emittedTitles.has(i)) {
                    emittedTitles.add(i);
                    send("title", { index: i, title });
                  }
                });
              }
            },
          },
          { temperature: 0.75, timeoutMs: 22_000 },
        );

        const raw = JSON.parse(stripCodeFences(full));
        if (raw && typeof raw === "object" && "refusal" in raw) {
          send("error", { code: ERRORS.VALIDATION, message: String(raw.refusal) });
          controller.close();
          return;
        }
        const result = ResponseEnvelope.safeParse(raw);
        if (!result.success) {
          send("error", {
            code: ERRORS.VALIDATION,
            message: "The kitchen produced something odd — try again.",
          });
          controller.close();
          return;
        }

        const ids = await persistRecipes(admin, result.data.recipes);

        // Re-read persisted rows and map to client shape (real ids + status).
        const { data: rows } = await admin
          .from("recipes")
          .select("*")
          .in("id", ids);
        const byId = new Map(
          (rows ?? []).map((r: Record<string, unknown>) => [r.id, r]),
        );
        const clientRecipes = ids
          .map((id) => byId.get(id))
          .filter((r): r is Record<string, unknown> => Boolean(r))
          .map(dbRowToClientRecipe);

        send("final", { recipes: clientRecipes });
        send("done", {});
      } catch (err) {
        send("error", {
          code: ERRORS.GENERATION_FAILED,
          message: "The kitchen is busy — try again in a minute.",
        });
        console.error("generate-recipe error", String(err));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
