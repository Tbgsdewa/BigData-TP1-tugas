import assert from "node:assert/strict";
import test from "node:test";

process.env.APP_ACCESS_PASSWORD = "test-team-password-that-is-long-enough-32chars";
process.env.MONGODB_URI = "";
process.env.VERCEL = "1";

const { default: app } = await import("./server.ts");
const server = app.listen(0, "127.0.0.1");

await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;

test("database APIs require team access and use a signed HttpOnly session", async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/db/state?sessionId=default_tp1`);
  assert.equal(unauthenticated.status, 401);

  const crossOriginLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    },
    body: JSON.stringify({ password: process.env.APP_ACCESS_PASSWORD }),
  });
  assert.equal(crossOriginLogin.status, 403);

  const unauthenticatedWrite = await fetch(`${baseUrl}/api/db/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: {} }),
  });
  assert.equal(unauthenticatedWrite.status, 401);

  const unauthorizedEvidence = await fetch(`${baseUrl}/api/db/evidence`);
  assert.equal(unauthorizedEvidence.status, 401);
  assert.equal((await fetch(`${baseUrl}/api/db/reports`)).status, 401);

  const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong" }),
  });
  assert.equal(wrongPassword.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.APP_ACCESS_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.ok(setCookie?.includes("HttpOnly"));
  assert.ok(setCookie?.includes("SameSite=Strict"));
  assert.ok(setCookie?.includes("Secure"));
  const cookie = setCookie?.split(";")[0];
  assert.ok(cookie);

  const authenticatedState = await fetch(`${baseUrl}/api/db/state?sessionId=default_tp1`, {
    headers: { Cookie: cookie },
  });
  assert.equal(authenticatedState.status, 200);
  assert.equal((await authenticatedState.json()).success, true);

  const authenticatedWrite = await fetch(`${baseUrl}/api/db/state`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ state: { steps: {} } }),
  });
  assert.equal(authenticatedWrite.status, 200);
  assert.equal((await authenticatedWrite.json()).success, true);

  const savedState = await fetch(`${baseUrl}/api/db/state?sessionId=default_tp1`, {
    headers: { Cookie: cookie },
  });
  assert.deepEqual((await savedState.json()).data, { steps: {} });

  const crossOriginWrite = await fetch(`${baseUrl}/api/db/state`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    },
    body: JSON.stringify({ state: {} }),
  });
  assert.equal(crossOriginWrite.status, 403);

  const connectWithCallerUri = await fetch(`${baseUrl}/api/db/connect`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ uri: "mongodb://attacker.example:27017", dbName: "attacker" }),
  });
  assert.equal(connectWithCallerUri.status, 410);

  const crossOriginLogout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://attacker.example" },
  });
  assert.equal(crossOriginLogout.status, 403);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: baseUrl },
  });
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get("set-cookie")?.includes("Max-Age=0"));

  const afterLogout = await fetch(`${baseUrl}/api/db/state`);
  assert.equal(afterLogout.status, 401);

  const rateLimitIp = "198.51.100.7";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": rateLimitIp,
      },
      body: JSON.stringify({ password: "wrong" }),
    });
    assert.equal(failedLogin.status, 401);
  }
  const rateLimitedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": rateLimitIp,
    },
    body: JSON.stringify({ password: "wrong" }),
  });
  assert.equal(rateLimitedLogin.status, 429);
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});
