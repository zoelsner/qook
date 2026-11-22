import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";
import {
  readAppleRevokeConfig,
  revokeAppleAuthorizationCode,
  type AppleRevokeConfig,
} from "../_shared/appleRevoke.ts";

export interface DeleteAccountUser {
  id: string;
  identities?: { provider?: string }[] | null;
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
}

export function userHasAppleIdentity(user: DeleteAccountUser): boolean {
  if (user.identities?.some((i) => i.provider === "apple")) return true;
  if (user.app_metadata?.provider === "apple") return true;
  if (
    Array.isArray(user.app_metadata?.providers) &&
    user.app_metadata.providers.includes("apple")
  ) {
    return true;
  }
  return false;
}

async function readAppleAuthorizationCode(req: Request): Promise<string | null> {
  const text = await req.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    const body = JSON.parse(text) as { appleAuthorizationCode?: unknown };
    return typeof body.appleAuthorizationCode === "string" &&
        body.appleAuthorizationCode.trim().length > 0
      ? body.appleAuthorizationCode.trim()
      : null;
  } catch {
    return null;
  }
}

export interface DeleteAccountDeps {
  authenticate: (req: Request) => Promise<DeleteAccountUser>;
  getAppleConfig: () => AppleRevokeConfig | null;
  revokeApple: (code: string, config: AppleRevokeConfig) => Promise<void>;
  deleteUser: (userId: string) => Promise<{ error: { message: string } | null }>;
}

const defaultDeps: DeleteAccountDeps = {
  authenticate: async (req) => {
    const { user } = await requireUser(req);
    return user as DeleteAccountUser;
  },
  getAppleConfig: () => readAppleRevokeConfig(),
  revokeApple: (authorizationCode, config) =>
    revokeAppleAuthorizationCode({ authorizationCode, config }),
  deleteUser: async (userId) => {
    const admin = serviceClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    return { error: error ? { message: error.message } : null };
  },
};

export async function handleDeleteAccount(
  req: Request,
  deps: DeleteAccountDeps = defaultDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let user: DeleteAccountUser;
  try {
    user = await deps.authenticate(req);
  } catch (resp) {
    return resp as Response;
  }

  if (userHasAppleIdentity(user)) {
    const appleConfig = deps.getAppleConfig();
    if (!appleConfig) {
      console.error("delete-account missing Apple revocation secrets");
      return errorResponse(
        ERRORS.GENERATION_FAILED,
        "Could not delete account right now. Please try again later.",
        500,
      );
    }
    const authCode = await readAppleAuthorizationCode(req);
    if (!authCode) {
      return errorResponse(
        ERRORS.BAD_REQUEST,
        "Confirm with Apple to delete your account.",
        400,
      );
    }
    try {
      await deps.revokeApple(authCode, appleConfig);
    } catch (err) {
      console.error("delete-account apple revoke error", String(err));
      return errorResponse(
        ERRORS.GENERATION_FAILED,
        "Could not revoke your Apple sign-in. Try again.",
        500,
      );
    }
  }

  const { error } = await deps.deleteUser(user.id);
  if (error) {
    console.error("delete-account error", error.message);
    return errorResponse(
      ERRORS.GENERATION_FAILED,
      "Could not delete account. Try again.",
      500,
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
