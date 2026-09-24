import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Controls a screen reader would announce as nothing.
//
// A button containing text is announced by that text. One containing only an
// icon is announced as "button" and nothing else — and on these screens that
// included delete, share, and the accent colours.
//
// The scanner matters as much as the result. The first version found the end of
// an opening tag with indexOf(">"), which an arrow function breaks:
// `onPress={() => save()}` contains a ">", so every attribute after it was read
// as the control's label and three unnamed buttons looked named. It reported
// "one unnamed control" when there were two. This walks the tag tracking brace
// depth instead.

const TARGETS = [
  { name: "web", roots: ["src/screens", "src/components"], tag: "button", label: "aria-label" },
  { name: "native", roots: ["mobile-native/src/screens", "mobile-native/src/components"], tag: "Pressable", label: "accessibilityLabel" },
];

function endOfOpenTag(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return { end: i + 1, selfClosing: src[i - 1] === "/" };
  }
  return { end: src.length, selfClosing: false };
}

function closeOf(src, from, tag) {
  const open = new RegExp(`<${tag}[\\s>]`, "g");
  const close = new RegExp(`</${tag}>`, "g");
  let depth = 1;
  let j = from;
  while (depth > 0) {
    open.lastIndex = j; close.lastIndex = j;
    const o = open.exec(src);
    const c = close.exec(src);
    if (!c) return src.length;
    if (o && o.index < c.index) { depth++; j = o.index + 1; }
    else { depth--; j = c.index + tag.length + 3; }
  }
  return j;
}

function unnamed({ roots, tag, label }) {
  const files = roots.flatMap((r) =>
    fs.readdirSync(r).filter((f) => /\.jsx?$/.test(f)).map((f) => path.join(r, f)));
  const found = [];
  let total = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const re = new RegExp(`<${tag}[\\s>]`, "g");
    let m;
    while ((m = re.exec(src))) {
      total++;
      const { end, selfClosing } = endOfOpenTag(src, m.index);
      const openTag = src.slice(m.index, end);
      const body = selfClosing ? "" : src.slice(end, closeOf(src, end, tag) - (tag.length + 3));
      if (openTag.includes(label)) continue;
      if (body.includes("{children}")) continue;
      // Anything left once the self-closing icons and JSX comments are removed
      // is read aloud: a <Text>, a <span>, a bare {label}, literal words.
      const rest = body
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
        .replace(/<[A-Za-z][^>]*\/>/g, " ")
        .replace(/\s+/g, "");
      if (rest.length) continue;
      found.push(`${file}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
  return { found, total };
}

describe.each(TARGETS)("$name controls", (target) => {
  const { found, total } = unnamed(target);

  it("scans a real number of them", () => {
    // Without this the test passes by finding nothing to look at.
    expect(total).toBeGreaterThan(50);
  });

  it("all have a name a screen reader can read", () => {
    expect(found).toEqual([]);
  });
});

describe("the scanner itself", () => {
  it("is not fooled by an arrow function in an attribute", () => {
    // The bug that made the first pass under-report. `() =>` contains a ">".
    const src = '<button onClick={() => del(i)} style={{ a: 1 }}><Trash2 size={14} /></button>';
    const { end } = endOfOpenTag(src, 0);
    expect(src.slice(0, end)).toBe('<button onClick={() => del(i)} style={{ a: 1 }}>');
    expect(src.slice(end)).toBe("<Trash2 size={14} /></button>");
  });
});
