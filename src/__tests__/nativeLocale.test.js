import { describe, it, expect } from "vitest";
import { CURRENCIES, convert, phrasesFor, countryFlag, goodToKnow } from "../../mobile-native/src/lib/locale.js";
import { countryName, countryFlagOf, flagOf } from "../../mobile-native/src/lib/countryNames.js";

// Money shown to the user, and country names in sixteen languages.
//
// countryNames exists because Hermes has no Intl.DisplayNames — the web app
// gets these from the platform, the phone gets them from a generated table, and
// a gap in that table prints a bare ISO code where a country name should be.

describe("convert", () => {
  it("leaves euros alone", () => {
    expect(convert(100, "EUR")).toBe("€100");
  });

  it("applies the rate and keeps the symbol where that currency puts it", () => {
    expect(convert(100, "USD")).toBe("$108");
    // Romanian convention: the symbol follows the number.
    expect(convert(100, "RON")).toBe("497 lei");
  });

  it("groups thousands the way each locale does", () => {
    expect(convert(10000, "USD")).toMatch(/^\$10[.,  ]?800$/);
    expect(convert(10000, "RON")).toMatch(/lei$/);
  });

  it("falls back to euros for a currency it does not know", () => {
    expect(convert(50, "XYZ")).toBe(convert(50, "EUR"));
    expect(convert(50, undefined)).toBe(convert(50, "EUR"));
  });

  it("rounds rather than printing a fraction of a cent", () => {
    expect(convert(33.333, "EUR")).toBe("€33");
  });

  it("handles zero without printing something odd", () => {
    expect(convert(0, "EUR")).toBe("€0");
    expect(convert(0, "RON")).toBe("0 lei");
  });

  it("offers a symbol, rate and flag for every currency it lists", () => {
    for (const [code, c] of Object.entries(CURRENCIES)) {
      expect(typeof c.symbol, code).toBe("string");
      expect(c.rate, code).toBeGreaterThan(0);
      expect(c.flag, code).toBeTruthy();
    }
  });
});

describe("phrasesFor", () => {
  it("gives the survival kit for a country it covers", () => {
    const p = phrasesFor("Italia") || phrasesFor("IT") || phrasesFor("Italy");
    expect(p).toBeTruthy();
    expect(Object.keys(p.phrases)).toEqual(
      expect.arrayContaining(["hello", "thanks", "howmuch", "toilet", "help"]),
    );
  });

  it("returns nothing for a country it does not cover, rather than empty strings", () => {
    const p = phrasesFor("Atlantida");
    expect(p == null || !p.phrases).toBe(true);
  });

  it("survives being given nothing", () => {
    expect(() => phrasesFor(undefined)).not.toThrow();
    expect(() => phrasesFor("")).not.toThrow();
  });
});

describe("goodToKnow", () => {
  it("returns practical notes or nothing, never a broken shape", () => {
    for (const c of ["Italia", "Japonia", "Atlantida", "", undefined]) {
      const info = goodToKnow(c);
      expect(info === null || info === undefined || typeof info === "object").toBe(true);
    }
  });
});

describe("flagOf", () => {
  it("turns an ISO code into its flag", () => {
    expect(flagOf("RO")).toBe("🇷🇴");
    expect(flagOf("jp")).toBe("🇯🇵");
  });

  it("returns an empty string for nothing, rather than a stray character", () => {
    expect(flagOf("")).toBe("");
    expect(flagOf(null)).toBe("");
  });
});

describe("countryName", () => {
  it("translates an ISO code into the asked-for language", () => {
    expect(countryName("FR", "en")).toBe("France");
    expect(countryName("FR", "ro")).toMatch(/Fran/);
    expect(countryName("DE", "de")).toBe("Deutschland");
  });

  it("accepts the Romanian name the trip data stores", () => {
    // Trips carry "Franța", not "FR" — both have to work.
    expect(countryName("Franța", "en")).toBe("France");
  });

  it("is case-insensitive about the code", () => {
    expect(countryName("fr", "en")).toBe(countryName("FR", "en"));
  });

  it("falls back to English before giving up", () => {
    expect(countryName("FR", "xx")).toBe("France");
  });

  it("prints SOMETHING for a country it has never heard of", () => {
    // Never an empty label where a country belongs.
    expect(countryName("Atlantida", "ro")).toBe("Atlantida");
    expect(countryName("ZZ", "en")).toBe("ZZ");
  });

  it("returns an empty string only when given nothing", () => {
    expect(countryName("", "en")).toBe("");
    expect(countryName(null, "en")).toBe("");
  });

  it("never returns a bare ISO code for a country it does cover", () => {
    // The failure this table exists to prevent: "FR" printed as the country.
    for (const cc of ["FR", "DE", "IT", "ES", "RO", "JP", "US", "GB"]) {
      for (const lang of ["en", "ro", "ja", "ko", "el"]) {
        const name = countryName(cc, lang);
        expect(name, `${cc}/${lang}`).not.toBe(cc);
        expect(name.length, `${cc}/${lang}`).toBeGreaterThan(1);
      }
    }
  });
});

describe("countryFlagOf", () => {
  it("works from either an ISO code or the stored Romanian name", () => {
    expect(countryFlagOf("RO")).toBe("🇷🇴");
    expect(countryFlagOf("Franța")).toBe("🇫🇷");
  });

  it("returns an empty string rather than a broken glyph", () => {
    expect(countryFlagOf("Atlantida")).toBe("");
    expect(countryFlagOf("")).toBe("");
  });
});

describe("countryFlag from locale.js", () => {
  it("agrees with countryNames for the countries both know", () => {
    // Two modules answering the same question differently is how a flag ends
    // up next to the wrong country name.
    for (const c of ["Franța", "Italia", "Japonia"]) {
      const a = countryFlag(c), b = countryFlagOf(c);
      if (a && b) expect(a, c).toBe(b);
    }
  });
});
