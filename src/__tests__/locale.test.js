import { describe, it, expect } from "vitest";
import { convert, phrasesFor, goodToKnow, countryFlag } from "../locale.js";

describe("convert (currency formatting)", () => {
  it("puts the symbol before the number for EUR/USD/JPY", () => {
    expect(convert(100, "EUR")).toBe("€100");
    expect(convert(100, "USD")).toBe("$108");
    expect(convert(100, "JPY")).toBe("¥17,000");
  });

  it("puts 'lei' AFTER the number with ro-RO thousands separator", () => {
    const out = convert(1000, "RON"); // 4970 lei
    expect(out.endsWith(" lei")).toBe(true);
    expect(out).toBe(`${(4970).toLocaleString("ro-RO")} lei`);
  });

  it("falls back to EUR for unknown codes", () => {
    expect(convert(50, "XXX")).toBe("€50");
  });
});

describe("country lookups", () => {
  it("finds phrases for Romanian country names used by the engine", () => {
    expect(phrasesFor("Italia").phrases.hello).toBe("Ciao");
    expect(phrasesFor("Nowhereland")).toBeNull();
  });

  it("returns arrival info with a live tz offset field", () => {
    const info = goodToKnow("România");
    expect(info.emergency).toBe("112");
    expect(info).toHaveProperty("hoursFromUser");
  });

  it("gives a flag or empty string", () => {
    expect(countryFlag("Japonia")).toBe("🇯🇵");
    expect(countryFlag("Atlantis")).toBe("");
  });
});
