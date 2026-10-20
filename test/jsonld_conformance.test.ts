import { describe, expect, it } from "vitest";
import { toJsonLd } from "../src/jsonld";
import type { RelatonItem } from "../src/index.js";

// The JSON-LD surface: schema.org vocabulary only, so the output is usable by
// any linked-data consumer without a Relaton context.
const SCHEMA_FIELDS = new Set([
  "@context", "@type", "identifier", "name", "author", "editor", "performer",
  "publisher", "datePublished", "url", "version", "inLanguage", "keywords",
]);

function render(doc: Record<string, unknown>): Record<string, any> {
  return JSON.parse(toJsonLd(doc as unknown as RelatonItem));
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    docidentifier: [{ content: "ISO 1234", type: "ISO", primary: true }],
    title: [{ content: "A title", language: "en", script: "Latn", type: "main" }],
    date: [{ type: "published", at: "2024-05-01" }],
    ...overrides,
  };
}

describe("JSON-LD conformance", () => {
  it("is schema.org JSON-LD", () => {
    const rec = render(item());
    expect(rec["@context"]).toBe("https://schema.org");
    expect(rec["@type"]).toBe("CreativeWork");
  });

  it("emits only schema.org fields", () => {
    const rec = render(item({
      type: "standard",
      edition: "3",
      language: ["en"],
      keyword: ["alpha", "beta"],
      source: [{ type: "src", content: "https://example.test/doc" }],
      contributor: [
        { role: [{ type: "author" }], person: { name: { given: "Ada", surname: "Lovelace" } } },
        { role: [{ type: "editor" }], organization: { name: [{ content: "ISO" }] } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "ISO" }] } },
      ],
      docidentifier: [
        { content: "ISO 1234", type: "ISO", primary: true },
        { content: "10.1000/xyz", type: "DOI" },
      ],
    }));

    for (const key of Object.keys(rec)) {
      expect(SCHEMA_FIELDS.has(key), `non-schema field emitted: ${key}`).toBe(true);
    }
    expect(rec.version).toBe("3");
    expect(rec.inLanguage).toBe("en");
    expect(rec.keywords).toEqual(["alpha", "beta"]);
    expect(rec.url).toBe("https://example.test/doc");
  });

  it("identifies the work, with typed DOI values", () => {
    const rec = render(item({
      docidentifier: [
        { content: "ISO 1234", type: "ISO", primary: true },
        { content: "10.1000/xyz", type: "DOI" },
      ],
    }));

    expect(rec.identifier).toEqual([
      "ISO 1234",
      { "@type": "PropertyValue", propertyID: "DOI", value: "10.1000/xyz" },
    ]);
  });

  it("emits people and organizations with their schema.org types", () => {
    const rec = render(item({
      contributor: [
        { role: [{ type: "author" }], person: { name: { given: "Ada", surname: "Lovelace" } } },
        { role: [{ type: "author" }], organization: { name: [{ content: "ISO" }] } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "ISO" }] } },
      ],
    }));

    expect(rec.author).toEqual([
      { "@type": "Person", givenName: "Ada", familyName: "Lovelace" },
      { "@type": "Organization", name: "ISO" },
    ]);
    expect(rec.publisher).toEqual({ "@type": "Organization", name: "ISO" });
  });

  it("dates the work from its issued date", () => {
    expect(render(item())["datePublished"]).toBe("2024-05-01");
    expect(
      render(item({ date: [{ type: "published", at: "2019-11" }] }))["datePublished"],
    ).toBe("2019-11");
  });

  it("omits an identifier when the record has none", () => {
    const rec = render({ title: [{ content: "Untitled" }] });
    expect(rec).not.toHaveProperty("identifier");
    expect(rec.name).toBe("Untitled");
  });
});
