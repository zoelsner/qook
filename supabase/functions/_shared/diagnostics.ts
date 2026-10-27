// Only stable codes and counters leave the process. Provider text, Zod
// messages, database details, recipe titles and user identifiers can contain
// private dinner context and must never be included here.
const ISSUE_CODES = new Set([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite",
]);
const DATABASE_CODES = new Set([
  "23505",
  "23503",
  "23514",
  "42501",
  "PGRST116",
]);
export type Route = "generate-proposals" | "generate-recipe" | "fill-recipe";
export type FailureStage =
  | "preflight"
  | "session_insert"
  | "invalid_json"
  | "invalid_schema"
  | "hook_backfill"
  | "skeleton_cleanup"
  | "session_failure"
  | "session_completion"
  | "publication_uncertain"
  | "cache_use_count"
  | "cache_lookup"
  | "error_persistence"
  | "generation";

export function logFailure(
  route: Route,
  stage: FailureStage,
  error?: unknown,
  metrics: { attempt?: number; count?: number; issues?: { code: string }[] } =
    {},
): void {
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
  const databaseCode = typeof code === "string" && DATABASE_CODES.has(code)
    ? code
    : null;
  const errorKind = databaseCode
    ? "database"
    : error instanceof DOMException
    ? (error.name === "AbortError"
      ? "cancelled"
      : error.name === "TimeoutError"
      ? "timeout"
      : "unexpected")
    : "unexpected";
  console.error(JSON.stringify({
    tag: "qook_failure",
    route,
    stage,
    errorKind,
    databaseCode,
    ...(metrics.attempt !== undefined ? { attempt: metrics.attempt } : {}),
    ...(metrics.count !== undefined ? { count: metrics.count } : {}),
    ...(metrics.issues
      ? {
        issueCount: metrics.issues.length,
        issueCodes: [
          ...new Set(
            metrics.issues.map((issue) =>
              ISSUE_CODES.has(issue.code) ? issue.code : "unknown"
            ),
          ),
        ],
      }
      : {}),
  }));
}
