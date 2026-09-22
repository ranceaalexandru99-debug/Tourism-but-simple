import { describe, it, expect } from "vitest";
import { scrubText, scrubReport, LIMITS } from "../errorScrub.js";

// What leaves the device when an app crashes.
//
// An error message is not neutral text: it is built by whatever threw, and
// what threw was often handed a photo caption, a destination someone typed, or
// a path with their name in it. The privacy policy promises photos never leave
// the device, and an inline data URL in a stack trace would break that promise
// in the one place nobody thinks to look.

describe("scrubText", () => {
  it("removes an inline photo, which is the worst thing that could be there", () => {
    const s = scrubText("Failed to decode data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ== at line 4");
    expect(s).not.toContain("/9j/4AAQ");
    expect(s).toContain("data:[redactat]");
    expect(s).toContain("at line 4");          // the useful part survives
  });

  it("removes email addresses", () => {
    expect(scrubText("signIn failed for alex.r@example.com")).toBe("signIn failed for [email]");
  });

  it("removes device paths, which carry the account name", () => {
    const s = scrubText("ENOENT: file:///data/user/0/com.app/files/alex/photo.jpg");
    expect(s).not.toContain("alex");
    expect(s).toContain("[cale]");
  });

  it("removes bearer tokens and long hex runs", () => {
    expect(scrubText("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc")).toContain("Bearer [redactat]");
    expect(scrubText("id 9f8e7d6c5b4a39281706f5e4d3c2b1a0")).toContain("[hex]");
  });

  it("leaves an ordinary error untouched", () => {
    const msg = "Cannot read properties of undefined (reading 'photos')";
    expect(scrubText(msg)).toBe(msg);
  });

  it("copes with nothing at all", () => {
    expect(scrubText(null)).toBe("");
    expect(scrubText(undefined)).toBe("");
    expect(scrubText(123)).toBe("123");
  });
});

describe("scrubReport", () => {
  const entry = () => ({
    kind: "fatal",
    message: "boom data:image/png;base64,iVBORw0KGgo=",
    stack: "at f (file:///data/user/0/com.app/x.js:1:1)",
    platform: "android 34",
    ts: "2026-09-22T10:00:00.000Z",
  });

  it("scrubs the free-text fields and leaves the rest alone", () => {
    const out = scrubReport(entry());
    expect(out.message).toContain("data:[redactat]");
    expect(out.stack).toContain("[cale]");
    expect(out.kind).toBe("fatal");
    expect(out.platform).toBe("android 34");
    expect(out.ts).toBe("2026-09-22T10:00:00.000Z");
  });

  it("does not mutate the entry it was given", () => {
    // The caller keeps the original for the on-device buffer, which is not
    // scrubbed — it never leaves the phone.
    const e = entry();
    scrubReport(e);
    expect(e.message).toContain("iVBORw0KGgo=");
  });

  it("caps the sizes, because nothing past the first frames helps", () => {
    const out = scrubReport({ message: "x".repeat(5000), stack: "y".repeat(9000) });
    expect(out.message.length).toBe(LIMITS.MAX_MESSAGE);
    expect(out.stack.length).toBe(LIMITS.MAX_STACK);
  });

  it("returns null for something that is not a report", () => {
    expect(scrubReport(null)).toBeNull();
    expect(scrubReport("oops")).toBeNull();
  });

  it("does not invent fields that were not there", () => {
    const out = scrubReport({ kind: "error" });
    expect("message" in out).toBe(false);
    expect("stack" in out).toBe(false);
  });
});
