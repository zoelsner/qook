export type ApiError = { code: string; message: string };

export const ERRORS = {
  RATE_LIMITED: "rate_limited",
  UNAUTHORIZED: "unauthorized",
  VALIDATION: "validation",
  GENERATION_FAILED: "generation_failed",
  EMPTY_LIST: "empty_list",
  INSTACART_DOWN: "instacart_down",
  IMAGE_FAILED: "image_failed",
  NOT_FOUND: "not_found",
  BAD_REQUEST: "bad_request",
} as const;

export function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ code, message } satisfies ApiError), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
