// Run separately: bun scripts/verify-auth-completion.mjs
// Actual service functions/callback, transpiled without loading native modules.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(root + "src/services/supabase.ts", "utf8");
const ui = await readFile(
  root + "src/features/auth/EmailAuthScreen.tsx",
  "utf8",
);
const transpiler = new Bun.Transpiler({ loader: "ts" });
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function service(name, end) {
  const part = source.slice(
    source.indexOf("export async function " + name),
    source.indexOf(end),
  );
  return transpiler.transformSync(part.replace("export ", ""));
}
const signup = service(
  "signUpWithEmail",
  "export async function signInWithEmail",
);
const apple = service("signInWithApple", "export type EmailAuthResult");
for (const scenario of [
  "newPending",
  "newReady",
  "guestPending",
  "guestReady",
  "sessionError",
]) {
  const calls = [];
  const guest = scenario.startsWith("guest");
  const supabase = {
    auth: {
      getSession: async () => ({
        data: {
          session: guest
            ? { user: { id: "guest-id", is_anonymous: true } }
            : null,
        },
        error: scenario === "sessionError" ? Error("offline") : null,
      }),
      updateUser: async () => {
        calls.push("updateUser");
        return {
          data: {
            user: { id: "guest-id", is_anonymous: scenario === "guestPending" },
          },
          error: null,
        };
      },
      signUp: async () => {
        calls.push("signUp");
        return {
          data: {
            session:
              scenario === "newReady"
                ? { user: { is_anonymous: false } }
                : null,
          },
          error: null,
        };
      },
    },
  };
  const fn = () =>
    new AsyncFunction(
      "supabase",
      signup +
        ';return signUpWithEmail("fixture@example.invalid","password123");',
    )(supabase);
  if (scenario === "sessionError") {
    await assert.rejects(fn, /offline/);
    assert.deepEqual(calls, []);
  } else {
    assert.equal(
      await fn(),
      scenario.endsWith("Pending") ? "confirmation_required" : "ok",
    );
    assert.deepEqual(calls, [guest ? "updateUser" : "signUp"]);
  }
  console.log("PASS: " + scenario);
}
for (const code of [
  null,
  "identity_already_exists",
  "email_exists",
  "unexpected_failure",
  "over_request_rate_limit",
]) {
  const calls = [];
  const supabase = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "guest-id", is_anonymous: true } } },
        error: null,
      }),
      linkIdentity: async () => {
        calls.push("link");
        return { error: code ? { code } : null };
      },
      signInWithIdToken: async () => {
        calls.push("signIn");
        return { error: null };
      },
    },
  };
  const appleNative = {
    AppleAuthenticationScope: { FULL_NAME: "name", EMAIL: "email" },
    signInAsync: async () => ({ identityToken: "fixture" }),
  };
  const fn = () =>
    new AsyncFunction(
      "supabase",
      "AppleAuthentication",
      "makeNonce",
      "__DEV__",
      apple + ";return signInWithApple();",
    )(
      supabase,
      appleNative,
      async () => ({ raw: "raw", hashed: "hash" }),
      false,
    );
  if (code && !["identity_already_exists", "email_exists"].includes(code)) {
    await assert.rejects(fn, (e) => e.code === code);
    assert.deepEqual(calls, ["link"]);
  } else {
    assert.equal(await fn(), "ok");
    assert.deepEqual(calls, code ? ["link", "signIn"] : ["link"]);
  }
  console.log("PASS: Apple " + (code ?? "linked in place"));
}
const start =
  ui.indexOf("  const submit = async () => {") +
  "  const submit = async () => {".length;
const end = ui.indexOf("\n  };", start);
const body = ui.slice(start, end);
const keys = [
  "busy",
  "email",
  "password",
  "EMAIL_RE",
  "MIN_PASSWORD",
  "press",
  "setError",
  "setBusy",
  "mode",
  "signUpWithEmail",
  "signInWithEmail",
  "writeString",
  "StorageKeys",
  "queryClient",
  "router",
  "__DEV__",
  "authErrorMessage",
  "setMode",
];
for (const result of ["confirmation_required", "ok"]) {
  const state = { busy: false, error: null, mode: "signup", calls: [] };
  const values = [
    false,
    "fixture@example.invalid",
    "password123",
    /^\S+@\S+\.\S+$/,
    8,
    () => {},
    (v) => (state.error = v),
    (v) => (state.busy = v),
    "signup",
    async () => result,
    async () => {
      throw Error("unexpected signin");
    },
    async () => state.calls.push("flag"),
    { authMode: "flag" },
    { clear: () => state.calls.push("clear") },
    { replace: () => state.calls.push("navigate") },
    false,
    () => "",
    (v) => (state.mode = v),
  ];
  await new AsyncFunction(...keys, body)(...values);
  if (result === "confirmation_required") {
    assert.deepEqual(state.calls, []);
    assert.equal(state.busy, false);
    assert.equal(state.mode, "signin");
    assert.match(state.error, /Check your email/);
  } else assert.deepEqual(state.calls, ["flag", "clear", "navigate"]);
  console.log("PASS: email submit " + result);
}
console.log(
  "12 offline cases passed; no real auth/network/storage operations.",
);
