import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { contract, storedRecipe, validRecipe } from "../fill-recipe/fixtures.ts";
import { dinnerBrief } from "../_shared/dinner-brief.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { deferred } from "../_shared/read-phase.fixtures.ts";
import { mismatch } from "../fill-recipe/fixtures.ts";

// Protocol gap fixtures; these do not verify PostgreSQL transactions or RLS.
Deno.test("KNOWN GAP: two quota checks at nine authorize before either inserts its session", async () => {
  let sessions = 9;
  const query = { select: () => query, eq: () => query, neq: () => query,
    gte: () => Promise.resolve({ count: sessions, error: null }) };
  const grants = await Promise.all([checkQuota({ from: () => query }, "fixture"), checkQuota({ from: () => query }, "fixture")]);
  grants.forEach(result => { if (result.ok) sessions++; });
  assertEquals(grants, [{ ok: true }, { ok: true }]); assertEquals(sessions, 11);
});

Deno.test("HTTP late failing fill cannot persist a retry error over a concurrent full winner", async () => {
  for(const [key,value] of Object.entries({SUPABASE_URL:"http://qook.test",SUPABASE_ANON_KEY:"synthetic",SUPABASE_SERVICE_ROLE_KEY:"synthetic",OPENROUTER_API_KEY:"synthetic"}))Deno.env.set(key,value);
  const brief=dinnerBrief(buildLiveContext(contract.tier,{avoid_ingredients:["peanut"]},"Microwave only, 12 minutes."));
  const item={id:"private-item",recipe_id:id,generation_sessions:{user_id:user},prompt_meta:{version:1,originalRecipeId:id,brief,contract}};
  let row:Record<string,unknown>={...storedRecipe(),id,content_status:"proposal",ingredient_groups:[],workflow_sections:[]};
  const firstAtModel=deferred<void>(),winnerSaved=deferred<void>();
  let models=0,errorAttempts=0,errorWrites=0,fullWrites=0;
  const oldFetch=globalThis.fetch,oldError=console.error;console.error=()=>{};
  globalThis.fetch=async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url);
    if(url.hostname==="openrouter.ai") {
      const call=++models;
      if(call===1){firstAtModel.resolve();await winnerSaved.promise;}
      return json({choices:[{message:{content:JSON.stringify(call===2?validRecipe():mismatch)}}]});
    }
    if(url.pathname==="/auth/v1/user")return json({id:user});
    if(url.pathname==="/rest/v1/generation_items")return json([item]);
    if(url.pathname==="/rest/v1/recipes") {
      if(request.method==="PATCH") {
        const patch=await request.json();
        if(patch.generation_error){
          errorAttempts++;assertEquals(url.searchParams.get("id"),"eq."+id);
          assertEquals(url.searchParams.get("content_status"),"eq.proposal");
          if(row.content_status!=="proposal")return new Response(null,{status:204});
          errorWrites++;
        }else{fullWrites++;}
        row={...row,...patch};if(patch.content_status==="full")winnerSaved.resolve();
        return new Response(null,{status:204});
      }
      if(url.searchParams.has("signature"))return json([]);
      return json([row]);
    }
    throw new Error("Unexpected concurrent fixture request");
  };
  const request=()=>new Request("http://qook.test/fill-recipe",{method:"POST",headers:{Authorization:"Bearer synthetic","Content-Type":"application/json"},body:JSON.stringify({recipeId:id,generationSessionId:session})});
  try{
    const failing=handler(request());await firstAtModel.promise;
    const winner=await handler(request());winnerSaved.resolve();
    assertEquals(winner.status,200);assertEquals((await failing).status,502);
    assertEquals({models,errorAttempts,errorWrites,fullWrites},{models:3,errorAttempts:1,errorWrites:0,fullWrites:1});
    assertEquals(row.content_status,"full");assertEquals(row.generation_error,null);
    assertEquals((await handler(request())).status,200);assertEquals(models,3);
  }finally{winnerSaved.resolve();globalThis.fetch=oldFetch;console.error=oldError;}
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
