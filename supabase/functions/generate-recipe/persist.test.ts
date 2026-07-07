import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { persistRecipes } from "./index.ts";

const R = {
  title: "Sesame Soba",
  cuisine: "Japanese",
  tier: "after-work" as const,
  tags: [],
  timeMinutes: 20,
  servings: 2,
  ingredientGroups: [
    {
      title: "Main",
      role: "main" as const,
      items: [
        {
          item: "soba noodles",
          parsed: {
            canonical_name: "soba noodles",
            canonical_key: "soba_noodles",
            category: "Pantry" as const,
            amount: 8,
            unit: "oz" as const,
          },
        },
      ],
    },
  ],
  workflowSections: [
    {
      title: "Cook",
      objective: "Boil noodles",
      steps: [{ instruction: "Boil until tender", durationMin: 6 }],
    },
  ],
};

// Fake admin: no existing signature → insert returns a new id.
function fakeAdmin() {
  return {
    from(_t: string) {
      return {
        select() {
          return {
            eq() {
              return {
                is() {
                  return {
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: null }),
                  };
                },
              };
            },
          };
        },
        insert(_row: unknown) {
          return {
            select() {
              return {
                single: () =>
                  Promise.resolve({ data: { id: "new-id" }, error: null }),
              };
            },
          };
        },
      };
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test("persistRecipes inserts new recipe and returns id", async () => {
  const ids = await persistRecipes(fakeAdmin(), [R]);
  assertEquals(ids, ["new-id"]);
});
