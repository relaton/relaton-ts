import { describe, expect, it } from "vitest";
import { toCslJson } from "../src/csl";
import type { RelatonItem } from "../src/index.js";

// The CSL-JSON contract (CSL 1.0.2 item types). The renderer may map onto a
// subset, but every type it emits must be a real CSL type.
const CSL_TYPES = new Set([
  "article", "article-journal", "article-magazine", "article-newspaper", "bill",
  "book", "broadcast", "chapter", "classic", "collection", "dataset", "document",
  "entry", "entry-dictionary", "entry-encyclopedia", "event", "figure", "graphic",
  "hearing", "interview", "legal_case", "legislation", "manuscript", "map",
  "motion_picture", "musical_score", "pamphlet", "paper-conference", "patent",
  "performance", "periodical", "personal_communication", "post", "post-weblog",
  "regulation", "report", "review", "review-book", "software", "song", "speech",
  "standard", "thesis", "treaty", "webpage",
]);

// Fields this renderer is allowed to emit. Every one is a CSL-JSON field; the
// set is the whole rendered surface, so an accidental Relaton key fails.
const EMITTED_FIELDS = new Set([
  "id", "type", "title", "author", "editor", "performer", "issued", "publisher",
  "number", "DOI", "ISBN", "ISSN", "edition", "language", "keyword", "URL",
]);

function render(doc: Record<string, unknown>): Record<string, any> {
  const arr = JSON.parse(toCslJson(doc as unknown as RelatonItem));
  expect(Array.isArray(arr)).toBe(true);
  expect(arr).toHaveLength(1);
  return arr[0];
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    docidentifier: [{ content: "ISO 1234", type: "ISO", primary: true }],
    title: [{ content: "A title", language: "en", script: "Latn", type: "main" }],
    date: [{ type: "issued", at: "2024-05-01" }],
    ...overrides,
  };
}

describe("CSL-JSON conformance", () => {
  it("emits only CSL item fields", () => {
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
      expect(EMITTED_FIELDS.has(key), `non-CSL field emitted: ${key}`).toBe(true);
    }
    expect(rec.DOI).toBe("10.1000/xyz");
    expect(rec.keyword).toEqual(["alpha", "beta"]);
    expect(rec.URL).toBe("https://example.test/doc");
  });

  it("maps every supported Relaton type onto a CSL type", () => {
    const map: Record<string, string> = {
      standard: "standard",
      book: "book",
      article: "article-journal",
      inbook: "chapter",
      inproceedings: "paper-conference",
      report: "report",
      thesis: "thesis",
      website: "webpage",
      webresource: "webpage",
    };
    for (const [relaton, csl] of Object.entries(map)) {
      const rec = render(item({ type: relaton }));
      expect(rec.type).toBe(csl);
      expect(CSL_TYPES.has(rec.type)).toBe(true);
    }
    const unknown = render(item({ type: "something-else" }));
    expect(CSL_TYPES.has(unknown.type)).toBe(true);
  });

  it("keeps editors in the editor field, not author", () => {
    const rec = render(item({
      contributor: [
        { role: [{ type: "author" }], person: { name: { given: "Ada", surname: "Lovelace" } } },
        { role: [{ type: "editor" }], person: { name: { surname: "Turing" } } },
      ],
    }));

    expect(rec.author).toEqual([{ family: "Lovelace", given: "Ada" }]);
    expect(rec.editor).toEqual([{ family: "Turing" }]);
  });

  it("lists a contributor under every role it holds", () => {
    const rec = render(item({
      contributor: [
        { role: [{ type: "author" }, { type: "editor" }],
          person: { name: { given: "Ada", surname: "Lovelace" } } },
      ],
    }));

    expect(rec.author).toEqual([{ family: "Lovelace", given: "Ada" }]);
    expect(rec.editor).toEqual([{ family: "Lovelace", given: "Ada" }]);
  });

  it("emits issued as CSL date-parts with a four-digit year", () => {
    const rec = render(item({ date: [{ type: "published", at: "2019-11-30" }] }));

    expect(rec.issued["date-parts"]).toEqual([["2019"]]);
  });

  it("always has a non-empty id", () => {
    expect(render(item()).id).toBe("ISO 1234");
    expect(render({ title: [{ content: "Untitled" }] }).id).toBe("relaton");
  });
});
