import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { contract, storedRecipe, validRecipe } from "../fill-recipe/fixtures.ts";
import { dinnerBrief } from "../_shared/dinner-brief.ts";
import { buildLiveContext } from "../_shared/context.ts";

// Protocol gap fixtures; these do not verify PostgreSQL transactions or RLS.
Deno.test("KNOWN GAP: two quota checks at nine authorize before either inserts its session", async () => {
  let sessions = 9;
  const query = { select: () => query, eq: () => query, neq: () => query,
    gte: () => Promise.resolve({ count: sessions, error: null }) };
  const grants = await Promise.all([checkQuota({ from: () => query }, "fixture"), checkQuota({ from: () => query }, "fixture")]);
  grants.forEach(result => { if (result.ok) sessions++; });
  assertEquals(grants, [{ ok: true }, { ok: true }]); assertEquals(sessions, 11);
});

let handler: (request: Request) => Promise<Response>;
const serve = Deno.serve;
Deno.serve = ((fn: typeof handler) => { handler = fn; return {}; }) as typeof Deno.serve;
try { await import("../fill-recipe/index.ts"); } finally { Deno.serve = serve; }
const id="11111111-1111-4111-8111-111111111111", user="33333333-3333-4333-8333-333333333333", session="44444444-4444-4444-8444-444444444444";
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
Deno.test("KNOWN GAP: concurrent HTTP fills for one private item both reach the paid-model boundary today", async () => {
  for(const [key,value] of Object.entries({SUPABASE_URL:"http://qook.test",SUPABASE_ANON_KEY:"synthetic",SUPABASE_SERVICE_ROLE_KEY:"synthetic",OPENROUTER_API_KEY:"synthetic"}))Deno.env.set(key,value);
  const brief=dinnerBrief(buildLiveContext(contract.tier,{avoid_ingredients:["peanut"]},"Microwave only, 12 minutes."));
  const item={id:"private-item",recipe_id:id,generation_sessions:{user_id:user},prompt_meta:{version:1,originalRecipeId:id,brief,contract}};
  const proposal={...storedRecipe(),id,content_status:"proposal",ingredient_groups:[],workflow_sections:[]};
  const oldFetch=globalThis.fetch;
  let models=0,fullWrites=0;let release!:()=>void;
  const bothAtModel=new Promise<void>(resolve=>{release=resolve;});
  globalThis.fetch=async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url);
    if(url.hostname==="openrouter.ai") {models++;if(models===2)release();await bothAtModel;return json({choices:[{message:{content:JSON.stringify(validRecipe())}}]});}
    if(url.pathname==="/auth/v1/user")return json({id:user});
    if(url.pathname==="/rest/v1/generation_items")return json([item]);
    if(url.pathname==="/rest/v1/recipes") {
      if(request.method==="PATCH"){fullWrites++;return new Response(null,{status:204});}
      if(url.searchParams.has("signature"))return json([]);
      return json([proposal]);
    }
    throw new Error("Unexpected fixture request");
  };
  const request=()=>new Request("http://qook.test/fill-recipe",{method:"POST",headers:{Authorization:"Bearer synthetic","Content-Type":"application/json"},body:JSON.stringify({recipeId:id,generationSessionId:session})});
  try {
    const results=await Promise.all([handler(request()),handler(request())]);
    assertEquals(results.map(r=>r.status),[200,200]);assertEquals(models,2);assertEquals(fullWrites,2);
  }finally{globalThis.fetch=oldFetch;}
});
