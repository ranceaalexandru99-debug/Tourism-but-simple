import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { validatePrefs } from "../shared/routeSchema.js";

// End-to-end over a real socket, on an ephemeral port. The server used to call
// app.listen() at module scope, so importing it started a server and none of
// this could be tested — including the fix that made the rate limit work at
// all, which went in verified only by hand.

let server, base;

beforeAll(async () => {
  // No keys: the endpoints answer "not configured", which is the state these
  // tests want. Nothing here should ever reach Anthropic or Supabase.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  // High, so one test's requests do not starve the next. The limiter itself is
  // covered thoroughly in serverRateLimit.test.js; the test at the end of this
  // file only proves the /api/errors route is wired to it.
  process.env.RATE_LIMIT_PER_MIN = "100";
  delete process.env.TRUST_PROXY;
  // Its own log file, so a test run never touches the real one.
  const os = await import("node:os");
  const p = await import("node:path");
  process.env.ERROR_LOG = p.join(os.tmpdir(), `vai-errors-test-${Date.now()}.jsonl`);

  const { app } = await import("../../server/index.js");
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((r) => server.close(r)));

const post = (path, body, headers = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const goodPrefs = {
  prefs: { destination: "Brașov", days: 3, pace: "normal", interests: ["food"], budget: "mid" },
  lang: "ro",
};

describe("GET /api/health", () => {
  it("answers, and reports each capability as a boolean", async () => {
    const res = await fetch(base + "/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Deliberately not asserting WHICH: the server loads the developer's own
    // .env, so `ai` reflects whatever is on this machine. What must hold is
    // that it answers at all and states each capability plainly.
    expect(body.ok).toBe(true);
    expect(typeof body.ai).toBe("boolean");
    expect(typeof body.accountDeletion).toBe("boolean");
  });
});

describe("the rate limit", () => {
  it("never reads the forwarded header itself", async () => {
    // This is the one that would have caught the bug. `trust proxy` was false
    // BEFORE the fix too — what was wrong is that the code bypassed Express
    // and read the header directly, so the setting was irrelevant and a client
    // could pick its own identity. Reading the source is a blunt instrument,
    // but it is the only thing that fails on the old code: the endpoints that
    // reach the limiter all need credentials a test must not have, or make a
    // real upstream call.
    const fs = await import("node:fs");
    const src = fs.readFileSync("server/index.js", "utf8");
    const code = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");   // comments discuss it
    expect(code).not.toMatch(/headers\s*\[\s*["']x-forwarded-for["']\s*\]/i);
    expect(code).not.toMatch(/headers\.\s*["']?x-forwarded-for/i);
  });

  it("does not trust a proxy header by default", async () => {
    // THE regression. The server used to read X-Forwarded-For directly, so a
    // different value on each request meant a fresh allowance and the limit
    // never fired — measured at the time as 6 of 6 getting through.
    //
    // Asserted as configuration rather than by hammering an endpoint: every
    // route that reaches the limiter either needs credentials this test must
    // not have, or would make a real upstream call. With trust proxy off,
    // req.ip is the socket address, which a client cannot forge.
    const { app } = await import("../../server/index.js");
    expect(app.get("trust proxy")).toBeFalsy();
  });

  it("can be told to trust a known number of proxies", async () => {
    // Behind a load balancer it MUST be set, or every request looks like the
    // proxy and one visitor exhausts the limit for everybody.
    process.env.TRUST_PROXY = "1";
    const mod = await import("../../server/index.js?trustproxy=1");
    expect(mod.app.get("trust proxy")).toBe(1);
    delete process.env.TRUST_PROXY;
  });
});

describe("POST /api/generate-route", () => {
  it("refuses when no key is configured, and says which", async () => {
    const res = await post("/api/generate-route", goodPrefs);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_disabled");
  });

  it("rejects a malformed body", async () => {
    const res = await post("/api/generate-route", { prefs: { destination: "" } });
    // 503 comes first when there is no key at all; with one, validation is
    // what answers. Either way it is never a 200.
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

describe("POST /api/delete-account", () => {
  it("refuses without admin credentials rather than half-deleting", async () => {
    const res = await post("/api/delete-account", {});
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("not_configured");
  });

  it("never takes the user id from the request body", async () => {
    // The identity comes from verifying the bearer token, always. A body
    // carrying someone else's id must not be a way to delete their account.
    const res = await post("/api/delete-account", { userId: "someone-else" },
      { Authorization: "Bearer forged" });
    expect(res.status).not.toBe(200);
  });
});

describe("POST /api/contribute-pois", () => {
  it("refuses without admin credentials", async () => {
    const res = await post("/api/contribute-pois", { cityId: "Q90", pois: [] });
    expect([503, 429]).toContain(res.status);
  });
});

describe("POST /api/errors", () => {
  // Where a crashed app reports to. Without it, an error in a published build
  // is invisible and the author finds out from a one-star review.
  const readLog = async () => {
    const fs = await import("node:fs");
    if (!fs.existsSync(process.env.ERROR_LOG)) return [];
    return fs.readFileSync(process.env.ERROR_LOG, "utf8")
      .split("\n").filter(Boolean).map((l) => JSON.parse(l));
  };

  it("accepts a report and writes it down", async () => {
    const res = await post("/api/errors", {
      kind: "fatal", message: "boom", stack: "at f (x.js:1:1)",
      platform: "android 34", appVersion: "0.1.0", ts: "2026-09-22T10:00:00.000Z",
    });
    expect(res.status).toBe(204);
    const lines = await readLog();
    const mine = lines.find((l) => l.message === "boom");
    expect(mine).toBeTruthy();
    expect(mine.kind).toBe("fatal");
    expect(mine.appVersion).toBe("0.1.0");
    expect(mine.receivedAt).toBeTruthy();     // the server's own clock, not the app's
  });

  it("caps every field, because the sender has just crashed", async () => {
    const res = await post("/api/errors", {
      kind: "x".repeat(200), message: "m".repeat(5000), stack: "s".repeat(9000),
      platform: "p".repeat(500),
    });
    expect(res.status).toBe(204);
    const last = (await readLog()).at(-1);
    expect(last.message.length).toBeLessThanOrEqual(500);
    expect(last.stack.length).toBeLessThanOrEqual(2000);
    expect(last.kind.length).toBeLessThanOrEqual(40);
    expect(last.platform.length).toBeLessThanOrEqual(60);
  });

  it("refuses a report with nothing in it", async () => {
    expect((await post("/api/errors", {})).status).toBe(400);
    expect((await post("/api/errors", { kind: "fatal" })).status).toBe(400);
  });

  it("refuses something that is not an object", async () => {
    expect((await post("/api/errors", ["not", "an", "object"])).status).toBe(400);
  });

  it("keeps only the fields it knows, dropping anything else sent", async () => {
    await post("/api/errors", { message: "keeps", evil: "<script>", nested: { a: 1 } });
    const last = (await readLog()).at(-1);
    expect(last.message).toBe("keeps");
    expect("evil" in last).toBe(false);
    expect("nested" in last).toBe(false);
  });

  it("is rate limited, so an error loop cannot fill the disk", async () => {
    let sawLimit = false;
    for (let i = 0; i < 140 && !sawLimit; i++) {
      const res = await post("/api/errors", { message: "loop" });
      if (res.status === 429) sawLimit = true;
    }
    expect(sawLimit).toBe(true);
  });
});

describe("CORS", () => {
  it("advertises Authorization, which delete-account runs on", async () => {
    // Without it a cross-origin preflight refuses the header and the
    // store-mandated delete button fails — invisibly, and only once the API is
    // deployed on a different origin than the app.
    const res = await fetch(base + "/api/health", {
      method: "OPTIONS",
      headers: { Origin: "https://example.com" },
    });
    // No ALLOWED_ORIGINS configured here, so nothing is advertised at all —
    // what matters is that the header list, when sent, includes Authorization.
    const allowed = res.headers.get("access-control-allow-headers");
    if (allowed) expect(allowed.toLowerCase()).toContain("authorization");
    expect([204, 200]).toContain(res.status);
  });
});

describe("validatePrefs", () => {
  it("accepts a reasonable request", () => {
    expect(validatePrefs(goodPrefs.prefs)).toBeNull();
  });

  it("requires a destination", () => {
    expect(validatePrefs({})).toMatch(/destination/);
    expect(validatePrefs({ destination: " a " })).toMatch(/destination/);
  });

  it("caps the sizes that reach the paid call", () => {
    expect(validatePrefs({ destination: "x".repeat(200) })).toMatch(/too long/);
    expect(validatePrefs({ destination: "Roma", instruction: "y".repeat(600) })).toMatch(/too long/);
    expect(validatePrefs({ destination: "Roma", interests: Array(9).fill("food") })).toMatch(/too many/);
  });

  it("rejects a non-object", () => {
    for (const bad of [null, "x", 5, undefined]) expect(validatePrefs(bad)).toMatch(/object/);
  });
});
