import { chat, type ChatOpts, MODELS } from "../_shared/openrouter.ts";
import { Recipe, RecipeJsonSchema } from "../_shared/schema.ts";
import { stripCodeFences } from "../_shared/partial-parser.ts";
import {
  buildFillSystemPrompt,
  buildFillUserPrompt,
} from "../_shared/prompts/fill.ts";
import type { LiveContext } from "../_shared/prompts/live.ts";
import {
  type FillContract,
  validateFillContract,
} from "../_shared/fill-contract.ts";

export async function generateConsistentFill(
  contract: FillContract,
  context: LiveContext,
  hook: string | null,
  request: (opts: ChatOpts) => Promise<string> = chat,
): Promise<Recipe> {
  let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildFillUserPrompt(
      { ...context, tier: contract.tier, householdSize: contract.servings },
      contract.title,
      hook,
      contract.ingredients,
      contract.steps,
      contract,
    );
    // Transport failures escape to the caller. Only a structurally
    // valid but inconsistent answer (or malformed JSON) gets one correction.
    const content = await request({
      model: MODELS.textDraft(),
      messages: [
        { role: "system", content: buildFillSystemPrompt() },
        {
          role: "user",
          content: prompt +
            (issues.length
              ? `\nCorrect the previous attempt's errors without changing the accepted card:\n${
                issues.join("\n")
              }`
              : ""),
        },
      ],
      jsonSchema: RecipeJsonSchema,
      temperature: 0.7,
      timeoutMs: 60_000,
      maxRetries: 0,
      costLabel: attempt ? "fill-correction" : "fill",
      reasoning: { effort: "low" },
    });
    let raw: unknown;
    try {
      raw = JSON.parse(stripCodeFences(content));
    } catch {
      issues = ["Return valid JSON matching the complete Recipe schema."];
      continue;
    }
    const result = Recipe.safeParse(raw);
    if (!result.success) {
      issues = result.error.issues.slice(0, 5).map(issue => `${issue.path.join(".") || "Recipe"}: ${issue.message}`);
      continue;
    }
    issues = validateFillContract(result.data, contract);
    if (!issues.length) return result.data;
  }
  throw new Error(`Recipe did not match its proposal: ${issues.join(" ")}`);
}
