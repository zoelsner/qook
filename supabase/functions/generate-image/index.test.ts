import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { DishContract } from "../_shared/dish-contract.ts";

let handler: (req: Request) => Promise<Response>;
const serve = Deno.serve;
Deno.serve = ((callback: typeof handler) => { handler = callback; return {}; }) as typeof Deno.serve;
try { await import("./index.ts"); } finally { Deno.serve = serve; }

const dish: DishContract = {
  version: 1,
  components: [
    { ingredientNames: ["ground turkey"], form: "round turkey meatballs", appearance: "deep amber browned crust" },
    { ingredientNames: ["black rice"], form: "cooked black rice grains", appearance: "purple-black individual grains" },
    { ingredientNames: ["feta"], form: "crumbled feta", appearance: "small white crumbles" },
  ],
  plating: "Meatballs lean over a loose mound of rice with feta off-centre.",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function scenario(options: { contract?: unknown; legacy?: boolean; claim?: string; publishError?: boolean }, check: (result: {
  response: Response; claims: number; providerBodies: Record<string, unknown>[]; uploads: number; patches: Record<string, unknown>[];
}) => void | Promise<void>) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: "http://qook.test", SUPABASE_ANON_KEY: "synthetic", SUPABASE_SERVICE_ROLE_KEY: "synthetic", OPENROUTER_API_KEY: "synthetic", OR_IMAGE_MODEL: "google/gemini-3.1-flash-lite-image" })) Deno.env.set(key, value);
  const oldFetch = globalThis.fetch;
  let claims = 0, uploads = 0;
  const providerBodies: Record<string, unknown>[] = [], patches: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    if (url.pathname === "/auth/v1/user") return json({ id: "33333333-3333-4333-8333-333333333333" });
    if (url.pathname === "/rest/v1/rpc/claim_image_attempt") {
      claims++; return json(options.claim ?? "claimed");
    }
    if (url.pathname === "/rest/v1/recipes") {
      if (req.method === "PATCH") {
        const patch = await req.json(); patches.push(patch);
        return options.publishError && patch.image_status === "ready" ? json({ message: "synthetic publish failure" }, 500) : new Response(null, { status: 204 });
      }
      assert(url.searchParams.get("select")?.includes("dish_contract"));
      return json({ id: "11111111-1111-4111-8111-111111111111", title: "Turkey Meatball Black Rice", ingredient_groups: [], workflow_sections: [], proposal_ingredients: ["ground turkey", "black rice", "feta"], proposal_steps: ["Roll ground turkey into meatballs", "Brown the meatballs", "Cook black rice and scatter crumbled feta"], image_status: "pending", dish_contract: options.legacy ? null : options.contract ?? dish });
    }
    if (url.hostname === "openrouter.ai") {
      const body = await req.json(); providerBodies.push(body);
      assertEquals(body.modalities, ["image", "text"], "no text-only description call is permitted");
      return json({ choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,aW1hZ2U=" } }] } }] });
    }
    if (url.pathname.startsWith("/storage/v1/object/meal-images/")) { uploads++; return json({ Key: "meal-images/fixture.png" }); }
    throw new Error(`Unexpected fixture request: ${req.method} ${url.pathname}`);
  };
  try {
    const response = await handler(new Request("http://qook.test/generate-image", { method: "POST", headers: { Authorization: "Bearer synthetic", "Content-Type": "application/json" }, body: JSON.stringify({ recipeId: "11111111-1111-4111-8111-111111111111" }) }));
    await check({ response, claims, providerBodies, uploads, patches });
  } finally {
    globalThis.fetch = oldFetch;
    Deno.env.delete("OR_IMAGE_MODEL");
  }
}

Deno.test("HTTP image uses saved components directly with exactly one image call and no text call", () => scenario({}, ({ response, claims, providerBodies, uploads, patches }) => {
  assertEquals(response.status, 200);
  assertEquals(claims, 1); assertEquals(providerBodies.length, 1); assertEquals(uploads, 1);
  const payload = JSON.stringify(providerBodies[0]);
  assert(payload.includes("round turkey meatballs: deep amber browned crust"));
  assert(payload.includes("purple-black individual grains"));
  assertEquals(patches[0].image_status, "ready");
  assertEquals(patches[0].dish_contract, undefined, "painting never rewrites the accepted identity");
}));

Deno.test("HTTP malformed and foreign-ingredient dish contracts fail before any paid claim", async () => {
  for (const contract of [{ ...dish, version: 2 }, { ...dish, components: [] }, { ...dish, components: [{ ...dish.components[0], ingredientNames: ["salmon"] }] }]) {
    await scenario({ contract }, ({ response, claims, providerBodies, uploads }) => {
      assertEquals(response.status, 422); assertEquals(claims, 0); assertEquals(providerBodies.length, 0); assertEquals(uploads, 0);
    });
  }
});

Deno.test("HTTP legacy image fallback uses stored method without a text model", () => scenario({ legacy: true }, ({ response, providerBodies }) => {
  assertEquals(response.status, 200); assertEquals(providerBodies.length, 1);
  assert(JSON.stringify(providerBodies[0]).includes("Roll ground turkey into meatballs"));
}));

Deno.test("HTTP ready image claim skips all provider work", () => scenario({ claim: "skip" }, async ({ response, providerBodies, uploads }) => {
  assertEquals(await response.json(), { ok: true, skipped: true });
  assertEquals(providerBodies.length, 0); assertEquals(uploads, 0);
}));

Deno.test("HTTP image publication failure is reported and releases generating state for retry", () => scenario({ publishError: true }, ({ response, patches }) => {
  assertEquals(response.status, 502);
  assertEquals(patches.map(p => p.image_status), ["ready", "failed"]);
}));
