import { describe, it, expect } from "vitest";
import { buildShortRenderHtml, jsonForScript } from "../../mobile-native/src/lib/shortRenderHtml.js";

// The short renderer on Android is an HTML page built as a string and loaded
// into a WebView, with the payload embedded inside a <script> block. That
// payload carries the user's own photo captions.
//
// JSON.stringify alone did not make them safe: a caption containing
// "</script>" closed the tag, and everything after it ran as markup. The page
// is ours, but what it renders is not — and the WebView holds
// window.ReactNativeWebView.postMessage, so injected code could drive the
// React Native side, which writes files from what it is told.

const payload = (caption) => ({
  scenes: [{ dataUrl: "data:,", day: 1, place: "P", caption, sec: 1.7 }],
  starts: [0],
  photoTime: 1.7,
  labels: { title: caption, subtitle: "s", dayPrefix: "Day", outro: "o" },
});

const scriptTags = (html) => (html.match(/<script>/g) || []).length;

describe("jsonForScript", () => {
  it("round-trips ordinary values unchanged", () => {
    const value = { a: 1, b: "hello", c: [true, null] };
    expect(JSON.parse(jsonForScript(value))).toEqual(value);
  });

  it("keeps text identical, including accents and emoji", () => {
    const value = { caption: "Piața Sfatului 🎉 în Brașov" };
    expect(JSON.parse(jsonForScript(value))).toEqual(value);
  });

  it("leaves no raw angle bracket that could close a tag", () => {
    const out = jsonForScript({ caption: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("escapes the line separators that would end a statement early", () => {
    const out = jsonForScript({ a: "x y z" });
    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");
    expect(JSON.parse(out).a).toBe("x y z");
  });
});

describe("buildShortRenderHtml", () => {
  it("contains exactly one script block for an ordinary caption", () => {
    expect(scriptTags(buildShortRenderHtml(payload("Piața Sfatului")))).toBe(1);
  });

  it("cannot be broken out of by a caption — the whole point", () => {
    const html = buildShortRenderHtml(payload('x</script><script>window.PWNED=1;</script>'));
    // The caption's TEXT is still there, and should be — it is the user's
    // caption and the video prints it. What matters is that it can no longer
    // end the script: one opening tag, one closing tag, nothing in between
    // that the parser reads as markup.
    expect(scriptTags(html)).toBe(1);
    expect((html.match(/<\/script>/g) || []).length).toBe(1);
    const body = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
    expect(body).not.toContain("</script>");
    expect(body).not.toContain("<script>");
  });

  it("resists an HTML comment opener too", () => {
    const html = buildShortRenderHtml(payload("a<!--b"));
    expect(html).not.toContain("<!--b");
  });

  it("still delivers the caption to the page, escaped rather than dropped", () => {
    const html = buildShortRenderHtml(payload("</script>"));
    // \r?\n — the source file's line endings are whatever git checked out.
    const json = html.match(/const PAYLOAD = (.*);\r?\n/)[1];
    const parsed = JSON.parse(json);
    expect(parsed.scenes[0].caption).toBe("</script>");
  });

  it("produces a page that is still valid JavaScript", () => {
    const html = buildShortRenderHtml(payload('</script><script>bad()</script>'));
    const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
    // eslint-disable-next-line no-new-func
    expect(() => new Function(script)).not.toThrow();
  });
});
