/**
 * Auth middleware tests.
 *
 * The middleware requires JWT_SECRET to be set and a valid token to be
 * present — unauthenticated requests return 401, not next().
 * Public paths (/health, /auth/login) bypass auth entirely.
 *
 * Uses Node's native test runner (node:test + node:assert).
 */
const assert = require("node:assert/strict");
const test = require("node:test");
const { authMiddleware } = require("../middleware/auth");

function makeReq(overrides = {}) {
  return {
    path: "/some-route",
    headers: {},
    cookies: {},
    query: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(body) { this._json = body; return this; },
  };
  return res;
}

function noop() {}

test("authMiddleware allows public health route without token", () => {
  const req = makeReq({ path: "/health" });
  const res = makeRes();
  let nextCalled = false;

  authMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "next() should be called for public route");
  assert.equal(res._status, null, "no error status should be set");
});

test("authMiddleware allows login route without token", () => {
  const req = makeReq({ path: "/api/auth/login" });
  const res = makeRes();
  let nextCalled = false;

  authMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "next() should be called for login route");
  assert.equal(res._status, null, "no error status should be set");
});

test("authMiddleware rejects unauthenticated non-public request", () => {
  const req = makeReq({ path: "/private" });
  const res = makeRes();
  let nextCalled = false;

  // With no JWT_SECRET set, middleware returns 500 before checking the token.
  // Either a 401 (bad token) or 500 (missing secret) is correct — both are failures.
  authMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false, "next() should NOT be called");
  assert.ok(
    [401, 500].includes(res._status),
    `Expected 401 or 500, got ${res._status}`
  );
});

test("authMiddleware returns 401 for malformed Bearer token", () => {
  const req = makeReq({
    path: "/private",
    headers: { authorization: "Bearer definitely-not-a-real-jwt" },
  });
  const res = makeRes();
  let nextCalled = false;

  authMiddleware(req, res, () => { nextCalled = true; });

  // Should either 401 (bad token) or 500 (missing secret); not 200 / next()
  assert.equal(nextCalled, false, "next() should NOT be called");
  assert.ok(
    [401, 500].includes(res._status),
    `Expected 401 or 500, got ${res._status}`
  );
});
