import {
  handleDeleteAccount,
  userHasAppleIdentity,
  type DeleteAccountDeps,
} from "./handler.ts";
import type { AppleRevokeConfig } from "../_shared/appleRevoke.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

const dummyConfig: AppleRevokeConfig = {
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  privateKeyPem: "PEM",
  clientId: "com.kata.qook",
};

function makeDeps(overrides: Partial<DeleteAccountDeps> = {}): DeleteAccountDeps {
  return {
    authenticate: async () => ({ id: "user-1", app_metadata: { provider: "email" } }),
    getAppleConfig: () => dummyConfig,
    revokeApple: async () => {},
    deleteUser: async () => ({ error: null }),
    ...overrides,
  };
}

Deno.test("userHasAppleIdentity detects identities, provider, and providers array", () => {
  assert(userHasAppleIdentity({ id: "1", identities: [{ provider: "apple" }] }), "identities");
  assert(userHasAppleIdentity({ id: "2", app_metadata: { provider: "apple" } }), "provider");
  assert(
    userHasAppleIdentity({ id: "3", app_metadata: { providers: ["email", "apple"] } }),
    "providers array",
  );
  assert(
    !userHasAppleIdentity({ id: "4", app_metadata: { provider: "email", providers: ["email"] } }),
    "email only",
  );
});

Deno.test("email user deletes directly without Apple revocation", async () => {
  let revoked = false;
  let deletedId = "";
  const res = await handleDeleteAccount(
    new Request("https://example.com/delete-account", { method: "POST" }),
    makeDeps({
      getAppleConfig: () => null, // email deletion works even without Apple secrets
      revokeApple: async () => {
        revoked = true;
      },
      deleteUser: async (id) => {
        deletedId = id;
        return { error: null };
      },
    }),
  );
  assert(res.status === 200, "returns 200");
  assert(!revoked, "does not call revokeApple for email user");
  assert(deletedId === "user-1", "deletes user");
});

Deno.test("Apple user requires authorizationCode and revokes before deleting", async () => {
  const order: string[] = [];
  const res = await handleDeleteAccount(
    new Request("https://example.com/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appleAuthorizationCode: "fresh-code" }),
    }),
    makeDeps({
      authenticate: async () => ({
        id: "apple-user",
        identities: [{ provider: "apple" }],
      }),
      revokeApple: async (code) => {
        order.push(`revoke:${code}`);
      },
      deleteUser: async (id) => {
        order.push(`delete:${id}`);
        return { error: null };
      },
    }),
  );
  assert(res.status === 200, "returns 200");
  assert(
    order.join(",") === "revoke:fresh-code,delete:apple-user",
    "revokes Apple token before deleting user",
  );
});

Deno.test("Apple user without authorizationCode gets 400 and user is NOT deleted", async () => {
  let deleted = false;
  const res = await handleDeleteAccount(
    new Request("https://example.com/delete-account", { method: "POST" }),
    makeDeps({
      authenticate: async () => ({
        id: "apple-user",
        app_metadata: { provider: "apple" },
      }),
      deleteUser: async () => {
        deleted = true;
        return { error: null };
      },
    }),
  );
  assert(res.status === 400, "returns 400");
  assert(!deleted, "does not delete without Apple confirmation code");
});

Deno.test("Apple revocation failure fails closed and does NOT delete user", async () => {
  let deleted = false;
  const res = await handleDeleteAccount(
    new Request("https://example.com/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appleAuthorizationCode: "bad-code" }),
    }),
    makeDeps({
      authenticate: async () => ({
        id: "apple-user",
        app_metadata: { provider: "apple" },
      }),
      revokeApple: async () => {
        throw new Error("apple_token_revoke_failed:400");
      },
      deleteUser: async () => {
        deleted = true;
        return { error: null };
      },
    }),
  );
  assert(res.status === 500, "returns 500");
  assert(!deleted, "does not delete when Apple revocation fails");
});

Deno.test("Apple user fails closed when Apple secrets are not configured", async () => {
  let deleted = false;
  const res = await handleDeleteAccount(
    new Request("https://example.com/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appleAuthorizationCode: "code" }),
    }),
    makeDeps({
      authenticate: async () => ({
        id: "apple-user",
        app_metadata: { provider: "apple" },
      }),
      getAppleConfig: () => null,
      deleteUser: async () => {
        deleted = true;
        return { error: null };
      },
    }),
  );
  assert(res.status === 500, "returns 500 when secrets missing");
  assert(!deleted, "does not delete when Apple revocation cannot run");
});
