import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createShortCollector, safeExtension, STALL_MS } from "../../mobile-native/src/lib/shortCollector.js";

// This logic used to live inside a React component, where none of it could be
// reached. It decides whether a render succeeded, whether the file is whole,
// and what goes into its name — and it works on messages from a page that
// renders user captions, which is how a caption injected script into it once.

function harness(over = {}) {
  const calls = { progress: [], done: [], error: [] };
  const written = [];
  const c = createShortCollector({
    onProgress: (v) => calls.progress.push(v),
    onDone: (uri, ext) => calls.done.push({ uri, ext }),
    onError: (r) => calls.error.push(r),
    write: async (base64, ext) => {
      written.push({ base64, ext });
      return `file:///cache/shorts/short-1.${ext}`;
    },
    ...over,
  });
  return { c, calls, written };
}

const send = (c, msg) => c.handleMessage(JSON.stringify(msg));

const renderOk = async (c, { parts = ["AA", "BB"], mime = "mp4" } = {}) => {
  send(c, { type: "begin", parts: parts.length, mime });
  parts.forEach((data, i) => send(c, { type: "chunk", i, data }));
  await send(c, { type: "done" });
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("safeExtension", () => {
  it("passes the two that are real", () => {
    expect(safeExtension("mp4")).toBe("mp4");
    expect(safeExtension("webm")).toBe("webm");
  });

  it("refuses anything that could escape the directory", () => {
    // The value lands in a filename. This is the fix for a path traversal.
    for (const bad of ["mp4/../../x", "../evil", "mp4\0.html", "", null, undefined, 42, "MP4"]) {
      expect(safeExtension(bad)).toBe("mp4");
    }
  });
});

describe("a complete render", () => {
  it("writes the joined chunks and reports the file", async () => {
    const { c, calls, written } = harness();
    await renderOk(c, { parts: ["AA", "BB", "CC"] });
    expect(written).toEqual([{ base64: "AABBCC", ext: "mp4" }]);
    expect(calls.done).toEqual([{ uri: "file:///cache/shorts/short-1.mp4", ext: "mp4" }]);
    expect(calls.error).toEqual([]);
  });

  it("keeps the extension the page actually produced", async () => {
    const { c, calls } = harness();
    await renderOk(c, { mime: "webm" });
    expect(calls.done[0].ext).toBe("webm");
  });

  it("reassembles chunks that arrive out of order", async () => {
    const { c, written } = harness();
    send(c, { type: "begin", parts: 3, mime: "mp4" });
    send(c, { type: "chunk", i: 2, data: "CC" });
    send(c, { type: "chunk", i: 0, data: "AA" });
    send(c, { type: "chunk", i: 1, data: "BB" });
    await send(c, { type: "done" });
    expect(written[0].base64).toBe("AABBCC");
  });

  it("passes progress through, clamped", async () => {
    const { c, calls } = harness();
    send(c, { type: "progress", value: 0.5 });
    send(c, { type: "progress", value: 1.4 });
    send(c, { type: "progress", value: -2 });
    expect(calls.progress).toEqual([0.5, 1, 0]);
  });
});

describe("a render that goes wrong", () => {
  it("reports 'incomplete' when a chunk never arrived, rather than writing a corrupt file", async () => {
    const { c, calls, written } = harness();
    send(c, { type: "begin", parts: 3, mime: "mp4" });
    send(c, { type: "chunk", i: 0, data: "AA" });
    send(c, { type: "chunk", i: 2, data: "CC" });
    await send(c, { type: "done" });
    expect(calls.error).toEqual(["incomplete"]);
    expect(written).toEqual([]);
  });

  it("reports 'incomplete' when 'done' arrives with no 'begin' at all", async () => {
    const { c, calls } = harness();
    await send(c, { type: "done" });
    expect(calls.error).toEqual(["incomplete"]);
  });

  it("passes the page's own error through", async () => {
    const { c, calls } = harness();
    send(c, { type: "error", reason: "unsupported" });
    expect(calls.error).toEqual(["unsupported"]);
  });

  it("reports a failed write instead of claiming success", async () => {
    const { c, calls } = harness({ write: async () => { throw new Error("disk full"); } });
    await renderOk(c);
    expect(calls.error).toEqual(["disk full"]);
    expect(calls.done).toEqual([]);
  });
});

describe("messages are input, not instructions", () => {
  it("ignores a message that is not JSON", () => {
    const { c, calls } = harness();
    expect(() => c.handleMessage("not json {")).not.toThrow();
    expect(calls.error).toEqual([]);
  });

  it("refuses a 'begin' that would allocate an absurd array", () => {
    for (const parts of [-1, 0, 1e9, 2.5, "10", null]) {
      const { c, calls } = harness();
      send(c, { type: "begin", parts, mime: "mp4" });
      expect(calls.error).toEqual(["badbegin"]);
    }
  });

  it("drops chunks with an index outside what 'begin' announced", async () => {
    const { c, written } = harness();
    send(c, { type: "begin", parts: 2, mime: "mp4" });
    send(c, { type: "chunk", i: 99, data: "XX" });    // beyond
    send(c, { type: "chunk", i: -1, data: "YY" });    // negative
    send(c, { type: "chunk", i: 0, data: "AA" });
    send(c, { type: "chunk", i: 1, data: "BB" });
    await send(c, { type: "done" });
    expect(written[0].base64).toBe("AABB");   // the out-of-range chunks are gone
  });

  it("drops a chunk whose payload is not a string", async () => {
    const { c, calls } = harness();
    send(c, { type: "begin", parts: 1, mime: "mp4" });
    send(c, { type: "chunk", i: 0, data: { nope: true } });
    await send(c, { type: "done" });
    expect(calls.error).toEqual(["incomplete"]);
  });

  it("ignores a message type it does not know", () => {
    const { c, calls } = harness();
    expect(() => send(c, { type: "whatever" })).not.toThrow();
    expect(calls.error).toEqual([]);
  });
});

describe("the watchdog", () => {
  it("fires on silence, so the progress bar cannot sit forever", () => {
    const { c, calls } = harness();
    c.start();
    vi.advanceTimersByTime(STALL_MS + 1);
    expect(calls.error).toEqual(["stalled"]);
  });

  it("is reset by every message that parsed", () => {
    const { c, calls } = harness();
    c.start();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(STALL_MS - 1000);
      send(c, { type: "progress", value: i / 5 });
    }
    // Four minutes of a legitimately long render, and no false alarm.
    expect(calls.error).toEqual([]);
  });

  it("is NOT reset by a message it could not read", () => {
    // Unreadable tells us nothing, not even that the page is alive.
    const { c, calls } = harness();
    c.start();
    vi.advanceTimersByTime(STALL_MS - 100);
    c.handleMessage("garbage");
    vi.advanceTimersByTime(200);
    expect(calls.error).toEqual(["stalled"]);
  });

  it("stops once the render is done", async () => {
    const { c, calls } = harness();
    c.start();
    await renderOk(c);
    vi.advanceTimersByTime(STALL_MS * 3);
    expect(calls.error).toEqual([]);
    expect(calls.done).toHaveLength(1);
  });
});

describe("settling happens once", () => {
  it("a second 'done' does not write or report twice", async () => {
    const { c, calls, written } = harness();
    await renderOk(c);
    await send(c, { type: "done" });
    expect(written).toHaveLength(1);
    expect(calls.done).toHaveLength(1);
  });

  it("an error after success is ignored", async () => {
    const { c, calls } = harness();
    await renderOk(c);
    send(c, { type: "error", reason: "late" });
    expect(calls.error).toEqual([]);
  });

  it("cancel stops everything and stays quiet when no reason is given", () => {
    const { c, calls } = harness();
    c.start();
    c.cancel();                       // unmount
    vi.advanceTimersByTime(STALL_MS * 2);
    expect(calls.error).toEqual([]);
    expect(c.settled).toBe(true);
  });

  it("cancel with a reason reports it once", () => {
    const { c, calls } = harness();
    c.start();
    c.cancel("webview");
    c.cancel("webview");
    expect(calls.error).toEqual(["webview"]);
  });

  it("messages after cancel are ignored", async () => {
    const { c, calls, written } = harness();
    c.start();
    c.cancel();
    await renderOk(c);
    expect(written).toEqual([]);
    expect(calls.done).toEqual([]);
  });
});
