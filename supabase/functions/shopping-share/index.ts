import { toInstacartItem, type ClientGroceryItem } from "./map.ts";
import { requireUser } from "../_shared/supabase.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const INSTACART_ENDPOINT =
  "https://connect.instacart.com/idp/v1/products/products_link";

function searchFallbackUrl(items: ClientGroceryItem[]): string {
  const q = items.map((i) => i.name.trim()).filter(Boolean).join(", ");
  return `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    await requireUser(req);
  } catch (resp) {
    return resp as Response;
  }

  const body = (await req.json().catch(() => null)) as
    | { items?: ClientGroceryItem[] }
    | null;
  const items = body?.items ?? [];

  if (items.length === 0) {
    return errorResponse(ERRORS.EMPTY_LIST, "Nothing to shop yet.", 422);
  }

  const key = Deno.env.get("INSTACART_IDP_KEY");
  const j = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // No key configured → honest search fallback, never dead-end.
  if (!key) {
    return j({ url: searchFallbackUrl(items), source: "search_fallback" });
  }

  try {
    const resp = await fetch(INSTACART_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Tonight's list — Qook",
        line_items: items.slice(0, 50).map(toInstacartItem),
      }),
    });
    if (!resp.ok) throw new Error(`instacart ${resp.status}`);
    const data = await resp.json();
    const url = data?.products_link_url ?? data?.url;
    if (!url) throw new Error("missing url");
    return j({ url, source: "instacart" });
  } catch (err) {
    console.error("shopping-share instacart error", String(err));
    // Instacart down → search fallback (spec §6, audit §3 edge case 3).
    return j({ url: searchFallbackUrl(items), source: "search_fallback" });
  }
});
