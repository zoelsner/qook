import {
  createAppleClientSecret,
  readAppleRevokeConfig,
  revokeAppleAuthorizationCode,
  type AppleRevokeConfig,
} from "./appleRevoke.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (input.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function generateTestKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKeyPem: string;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let bin = "";
  for (let i = 0; i < pkcs8.length; i++) bin += String.fromCharCode(pkcs8[i]);
  const b64 = btoa(bin);
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return {
    publicKey: pair.publicKey,
    privateKeyPem: `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`,
  };
}

Deno.test("createAppleClientSecret signs a verifiable ES256 JWT (including single-line \\n PEM)", async () => {
  const { publicKey, privateKeyPem } = await generateTestKeyPair();
  const config: AppleRevokeConfig = {
    teamId: "TEAM123456",
    keyId: "KEY1234567",
    privateKeyPem: privateKeyPem.replace(/\n/g, "\\n"),
    clientId: "com.kata.qook",
  };
  const jwt = await createAppleClientSecret(config, 1_700_000_000);
  const parts = jwt.split(".");
  assert(parts.length === 3, "JWT should have 3 parts");

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  assert(header.alg === "ES256" && header.kid === "KEY1234567", "header matches");
  assert(payload.iss === "TEAM123456", "iss matches teamId");
  assert(payload.sub === "com.kata.qook", "sub matches clientId");
  assert(payload.aud === "https://appleid.apple.com", "aud matches Apple");
  assert(payload.iat === 1_700_000_000 && payload.exp === 1_700_000_300, "exp is iat + 300");

  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64UrlDecode(parts[2]).buffer as ArrayBuffer,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  assert(valid, "ES256 signature must verify against public key");
});

Deno.test("revokeAppleAuthorizationCode exchanges code and revokes refresh_token", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  const calls: { url: string; body: URLSearchParams }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ url, body });
    if (url.endsWith("/auth/token")) {
      return new Response(
        JSON.stringify({ refresh_token: "rt_apple_123", access_token: "at_apple_456" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/auth/revoke")) {
      return new Response("", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  await revokeAppleAuthorizationCode({
    authorizationCode: "auth_code_xyz",
    config: {
      teamId: "TEAM123456",
      keyId: "KEY1234567",
      privateKeyPem,
      clientId: "com.kata.qook",
    },
    fetcher,
    nowSeconds: 1_700_000_000,
  });

  assert(calls.length === 2, "makes token then revoke call");
  assert(calls[0].url === "https://appleid.apple.com/auth/token", "first call is token exchange");
  assert(calls[0].body.get("code") === "auth_code_xyz", "passes authorization code");
  assert(calls[0].body.get("grant_type") === "authorization_code", "uses authorization_code grant");
  assert(calls[1].url === "https://appleid.apple.com/auth/revoke", "second call is revoke");
  assert(calls[1].body.get("token") === "rt_apple_123", "prefers refresh_token");
  assert(calls[1].body.get("token_type_hint") === "refresh_token", "sets refresh_token hint");
});

Deno.test("revokeAppleAuthorizationCode falls back to access_token and fails closed on HTTP error", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  const config: AppleRevokeConfig = {
    teamId: "TEAM123456",
    keyId: "KEY1234567",
    privateKeyPem,
    clientId: "com.kata.qook",
  };

  let revokeHint = "";
  await revokeAppleAuthorizationCode({
    authorizationCode: "code_1",
    config,
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/token")) {
        return new Response(JSON.stringify({ access_token: "at_only" }), { status: 200 });
      }
      revokeHint = new URLSearchParams(String(init?.body ?? "")).get("token_type_hint") ?? "";
      return new Response("", { status: 200 });
    },
  });
  assert(revokeHint === "access_token", "falls back to access_token hint");

  let threw = false;
  try {
    await revokeAppleAuthorizationCode({
      authorizationCode: "bad_code",
      config,
      fetcher: async () => new Response("invalid_grant", { status: 400 }),
    });
  } catch (e) {
    threw = String(e).includes("apple_token_exchange_failed:400");
  }
  assert(threw, "throws on failed token exchange");
});

Deno.test("readAppleRevokeConfig returns null when incomplete and defaults clientId", () => {
  assert(readAppleRevokeConfig(() => undefined) === null, "null when missing");
  const env: Record<string, string> = {
    APPLE_TEAM_ID: "TEAM1",
    APPLE_KEY_ID: "KEY1",
    APPLE_PRIVATE_KEY: "PEM",
  };
  const cfg = readAppleRevokeConfig((k) => env[k]);
  assert(cfg !== null && cfg.clientId === "com.kata.qook", "defaults to com.kata.qook");
});
