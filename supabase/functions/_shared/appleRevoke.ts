// Apple Sign in with Apple token exchange & revocation (App Store 5.1.1(v)).
// Uses standard Web Crypto ES256 signing so no external JWT library is needed.

export interface AppleRevokeConfig {
  teamId: string;
  keyId: string;
  privateKeyPem: string;
  clientId: string;
}

const DEFAULT_APPLE_CLIENT_ID = "com.kata.qook";
const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

export function readAppleRevokeConfig(
  getEnv: (key: string) => string | undefined = (key) => Deno.env.get(key),
): AppleRevokeConfig | null {
  const teamId = getEnv("APPLE_TEAM_ID")?.trim();
  const keyId = getEnv("APPLE_KEY_ID")?.trim();
  const privateKeyPem = getEnv("APPLE_PRIVATE_KEY")?.trim();
  if (!teamId || !keyId || !privateKeyPem) return null;
  const clientId = getEnv("APPLE_CLIENT_ID")?.trim() || DEFAULT_APPLE_CLIENT_ID;
  return { teamId, keyId, privateKeyPem, clientId };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function createAppleClientSecret(
  config: AppleRevokeConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64UrlEncode(
    encoder.encode(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" })),
  );
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        iss: config.teamId,
        iat: nowSeconds,
        exp: nowSeconds + 300,
        aud: APPLE_AUDIENCE,
        sub: config.clientId,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(config.privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(signingInput),
    ),
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function revokeAppleAuthorizationCode(params: {
  authorizationCode: string;
  config: AppleRevokeConfig;
  fetcher?: typeof fetch;
  nowSeconds?: number;
}): Promise<void> {
  const fetcher = params.fetcher ?? fetch;
  const clientSecret = await createAppleClientSecret(
    params.config,
    params.nowSeconds,
  );

  const tokenBody = new URLSearchParams({
    client_id: params.config.clientId,
    client_secret: clientSecret,
    code: params.authorizationCode,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetcher(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`apple_token_exchange_failed:${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as {
    refresh_token?: unknown;
    access_token?: unknown;
  };
  const refreshToken =
    typeof tokenJson.refresh_token === "string" && tokenJson.refresh_token.trim()
      ? tokenJson.refresh_token.trim()
      : null;
  const accessToken =
    typeof tokenJson.access_token === "string" && tokenJson.access_token.trim()
      ? tokenJson.access_token.trim()
      : null;
  const tokenToRevoke = refreshToken ?? accessToken;
  if (!tokenToRevoke) {
    throw new Error("apple_token_missing");
  }

  const revokeBody = new URLSearchParams({
    client_id: params.config.clientId,
    client_secret: clientSecret,
    token: tokenToRevoke,
    token_type_hint: refreshToken ? "refresh_token" : "access_token",
  });
  const revokeRes = await fetcher(APPLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: revokeBody.toString(),
  });
  if (!revokeRes.ok) {
    throw new Error(`apple_token_revoke_failed:${revokeRes.status}`);
  }
}
