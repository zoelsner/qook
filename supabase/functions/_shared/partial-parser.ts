import { Recipe } from "./schema.ts";

export function stripCodeFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractPartialRecipes(buf: string): unknown[] {
  const start = buf.indexOf('"recipes"');
  if (start < 0) return [];
  const arrStart = buf.indexOf("[", start);
  if (arrStart < 0) return [];
  const out: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inStr = false;
  let escaped = false;
  for (let i = arrStart + 1; i < buf.length; i++) {
    const ch = buf[i];
    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const slice = buf.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(slice);
          const preview = Recipe.partial().safeParse(obj);
          if (preview.success) out.push(preview.data);
        } catch {
          /* incomplete — skip */
        }
        objStart = -1;
      }
    }
  }
  return out;
}
