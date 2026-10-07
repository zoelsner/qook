import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { storedRecipe, validRecipe, contract } from "../fill-recipe/fixtures.ts";
let handler: (req: Request) => Promise<Response>;
const serve = Deno.serve;
Deno.serve = ((fn: typeof handler) => { handler = fn; return {}; }) as typeof Deno.serve;
try { await import('./index.ts'); } finally { Deno.serve = serve; }
const user = '33333333-3333-4333-8333-333333333333';
const session = '44444444-4444-4444-8444-444444444444';
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
Deno.test('HTTP proposal stores a private immutable brief and refuses an unsafe cached pantry addition', async () => {
  for (const [key,value] of Object.entries({SUPABASE_URL:'http://qook.test',SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',OPENROUTER_API_KEY:'synthetic'})) Deno.env.set(key,value);
  const oldFetch = globalThis.fetch;
  const inserted: Record<string, unknown>[] = []; let privateItems: Record<string, unknown>[] = [];
  const bad = validRecipe();
  bad.ingredientGroups[0].items.push({item:'peanut oil', quantity:'1 tsp',notes:null,parsed:{canonical_name:'peanut oil',canonical_key:'peanut_oil',amount:1,unit:'tsp',category:'Pantry'}});
  globalThis.fetch = async (input,init) => {
    const req = new Request(input,init); const u = new URL(req.url);
    if (u.pathname === '/auth/v1/user') return json({id:user});
    if (u.pathname === '/rest/v1/generation_sessions') {
      if(req.method==='HEAD') return new Response(null,{headers:{'Content-Range':'0-0/0'}});
      if(req.method==='POST') return json({id:session});
      return new Response(null,{status:204});
    }
    if (u.pathname === '/rest/v1/user_preferences') return json([{household_size:2,avoid_ingredients:['peanut']}]);
    if (u.hostname === 'openrouter.ai') return json({choices:[{message:{content:JSON.stringify({proposals:Array.from({length:5},()=>({title:contract.title,cuisine:'Middle Eastern',timeMinutes:12,proteinG:17,hook:'Eggs and sauce',ingredientNames:contract.ingredients,stepOutline:contract.steps})),refusal:null})}}]});
    if (u.pathname === '/rest/v1/generation_items') { privateItems=await req.json(); return new Response(null,{status:201}); }
    if (u.pathname === '/rest/v1/recipes') {
      if(req.method==='POST') { const row=await req.json(); const id=`11111111-1111-4111-8111-11111111111${inserted.length}`; inserted.push({...row,id});return json({id}); }
      if(u.searchParams.has('title'))return json([{...storedRecipe(bad),id:'unsafe-cache'}]);
      return json(inserted);
    }
    throw new Error('Unexpected local test request '+u.pathname);
  };
  try {
    const response=await handler(new Request('http://qook.test/generate-proposals',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({tier:contract.tier,context:'Peanut allergy. Microwave only, 12 minutes.'})}));
    assertEquals(response.status,200);
    const data=await response.json();assertEquals(data.proposals.length,5);
    assert(data.proposals.every((r:{generationSessionId:string})=>r.generationSessionId===session));
    assertEquals(privateItems.length,5);assertEquals(inserted.length,5);
    assertEquals((privateItems[0].prompt_meta as {brief:{avoidIngredients:string[]}}).brief.avoidIngredients,['peanut']);
    assert(inserted.every(row=>!('brief' in row)&&!('context' in row)&&!('prompt_meta' in row)));
  } finally { globalThis.fetch=oldFetch; }
});

Deno.test('HTTP failed parallel lookup never inserts replacement skeletons', async () => {
  for (const [key,value] of Object.entries({SUPABASE_URL:'http://qook.test',SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',OPENROUTER_API_KEY:'synthetic'})) Deno.env.set(key,value);
  const oldFetch = globalThis.fetch; let inserts = 0, cacheReads = 0;
  globalThis.fetch = (input,init) => Promise.resolve().then(() => {
    const req = new Request(input,init); const u = new URL(req.url);
    if (u.pathname === '/auth/v1/user') return json({id:user});
    if (u.pathname === '/rest/v1/generation_sessions') {
      if(req.method==='HEAD') return new Response(null,{headers:{'Content-Range':'0-0/0'}});
      if(req.method==='POST') return json({id:session});
      return new Response(null,{status:204});
    }
    if (u.pathname === '/rest/v1/user_preferences') return json([{household_size:2}]);
    if (u.hostname === 'openrouter.ai') return json({choices:[{message:{content:JSON.stringify({proposals:Array.from({length:5},()=>({title:contract.title,cuisine:'Middle Eastern',timeMinutes:12,proteinG:17,hook:'Eggs and sauce',ingredientNames:contract.ingredients,stepOutline:contract.steps})),refusal:null})}}]});
    if (u.pathname === '/rest/v1/recipes') {
      if(req.method==='POST') { inserts++; return json({id:'unexpected'}); }
      if(u.searchParams.has('title')) { cacheReads++; return cacheReads===3 ? json({message:'synthetic unavailable'},403) : json([]); }
    }
    throw new Error('Unexpected fixture request');
  });
  try {
    const response=await handler(new Request('http://qook.test/generate-proposals',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({tier:contract.tier})}));
    assertEquals(response.status,500); assertEquals(cacheReads,5); assertEquals(inserts,0);
  } finally { globalThis.fetch=oldFetch; }
});

async function diagnosticScenario(mode: 'invalid-json' | 'invalid-schema' | 'cleanup-fail') {
  for (const [key,value] of Object.entries({SUPABASE_URL:'http://qook.test',SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',OPENROUTER_API_KEY:'synthetic'})) Deno.env.set(key,value);
  const oldFetch=globalThis.fetch, oldError=console.error;
  const logs:string[]=[], inserted:string[]=[], deletions:string[][]=[];
  let failureUpdates=0, modelCalls=0;
  console.error=(...args)=>logs.push(args.join(' '));
  globalThis.fetch=(input,init)=>Promise.resolve().then(()=>{
    const req=new Request(input,init),url=new URL(req.url);
    if(url.pathname==='/auth/v1/user')return json({id:user});
    if(url.pathname==='/rest/v1/generation_sessions') {
      if(req.method==='HEAD')return new Response(null,{headers:{'Content-Range':'0-0/0'}});
      if(req.method==='POST')return json({id:session});
      failureUpdates++;
      return json({code:'42501',message:'PRIVATE identity'},403);
    }
    if(url.pathname==='/rest/v1/user_preferences')return json([{household_size:2}]);
    if(url.hostname==='openrouter.ai') {
      modelCalls++;
      const content=mode==='invalid-json'?'PRIVATE model fragment':mode==='invalid-schema'?JSON.stringify({proposals:[{title:'PRIVATE model title'}]}):JSON.stringify({proposals:Array.from({length:5},()=>({title:contract.title,cuisine:'Middle Eastern',timeMinutes:12,proteinG:17,hook:'Eggs and sauce',ingredientNames:contract.ingredients,stepOutline:contract.steps})),refusal:null});
      return json({choices:[{message:{content}}]});
    }
    if(url.pathname==='/rest/v1/generation_items')return new Response(null,{status:201});
    if(url.pathname==='/rest/v1/recipes') {
      if(req.method==='POST') { const id=`11111111-1111-4111-8111-11111111111${inserted.length}`;inserted.push(id);return json({id}); }
      if(req.method==='DELETE') { deletions.push([...inserted]);return json({code:'23503',message:'PRIVATE recipe reference'},409); }
      if(url.searchParams.has('title'))return json([]);
      return json({code:'42501',message:'PRIVATE recipe query'},403);
    }
    throw new Error('Unexpected fixture request');
  });
  try {
    const response=await handler(new Request('http://qook.test/generate-proposals',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({tier:contract.tier,context:'PRIVATE dinner context'})}));
    assertEquals(response.status,mode==='cleanup-fail'?500:422);
    assert(!logs.join(' ').includes('PRIVATE'));
    assertEquals(failureUpdates,mode==='cleanup-fail'?0:1);
    assertEquals(modelCalls,mode==='cleanup-fail'?1:2);
    const events=logs.map(l=>JSON.parse(l));
    if(mode==='cleanup-fail') {
      assertEquals(inserted.length,5);assertEquals(deletions,[]);
      assert(events.some(e=>e.stage==='publication_uncertain'&&e.count===5));
    } else {
      assert(events.some(e=>e.stage==='session_failure'));
      assertEquals(inserted.length,0);
      assertEquals(events.filter(e=>e.stage===(mode==='invalid-json'?'invalid_json':'invalid_schema')).length,2);
    }
  } finally {globalThis.fetch=oldFetch;console.error=oldError;}
}
Deno.test('HTTP malformed model JSON never leaks raw content or private session-update errors',()=>diagnosticScenario('invalid-json'));
Deno.test('HTTP invalid model schema never leaks raw model fields or Zod messages',()=>diagnosticScenario('invalid-schema'));
Deno.test('HTTP post-association read errors retain cards and log metadata without a destructive failure transition',()=>diagnosticScenario('cleanup-fail'));

async function qualityScenario(mode: 'ingredient-count' | 'tier-time') {
  for (const [key,value] of Object.entries({SUPABASE_URL:'http://qook.test',SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',OPENROUTER_API_KEY:'synthetic'})) Deno.env.set(key,value);
  const oldFetch = globalThis.fetch;
  let modelCalls = 0, cacheReads = 0, inserts = 0, failedSessions = 0;
  globalThis.fetch = (input,init) => Promise.resolve().then(async () => {
    const req = new Request(input,init), url = new URL(req.url);
    if (url.pathname === '/auth/v1/user') return json({id:user});
    if (url.pathname === '/rest/v1/generation_sessions') {
      if (req.method === 'HEAD') return new Response(null,{headers:{'Content-Range':'0-0/0'}});
      if (req.method === 'POST') return json({id:session});
      assertEquals((await req.json()).status,'failed'); failedSessions++;
      return new Response(null,{status:204});
    }
    if (url.pathname === '/rest/v1/user_preferences') return json([{household_size:2,cooking_tools:['microwave']}]);
    if (url.hostname === 'openrouter.ai') {
      modelCalls++;
      const proposal = {title:contract.title,cuisine:'Middle Eastern',timeMinutes:12,proteinG:17,hook:'Eggs and sauce',ingredientNames:contract.ingredients,stepOutline:contract.steps};
      if (mode === 'ingredient-count') proposal.ingredientNames=['tomato','egg','feta','bread','paprika','oil','salt'];
      if (mode === 'tier-time') proposal.timeMinutes=25;
      return json({choices:[{message:{content:JSON.stringify({proposals:Array.from({length:5},()=>proposal),refusal:null})}}]});
    }
    if (url.pathname === '/rest/v1/recipes') { if (req.method==='POST') inserts++; else cacheReads++; }
    throw new Error('Unexpected quality fixture request');
  });
  try {
    const response = await handler(new Request('http://qook.test/generate-proposals',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({tier:'brain-is-fried'})}));
    assertEquals(response.status,422);
    assertEquals({modelCalls,cacheReads,inserts,failedSessions},{modelCalls:2,cacheReads:0,inserts:0,failedSessions:1});
  } finally {globalThis.fetch=oldFetch;}
}
Deno.test('HTTP rejects seven ingredients for the 15-minute tier before cache lookup or persistence',()=>qualityScenario('ingredient-count'));
Deno.test('HTTP rejects original time exceeding tier ceiling even without a voice time limit',()=>qualityScenario('tier-time'));
