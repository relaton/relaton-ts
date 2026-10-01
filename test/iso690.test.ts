import { describe, expect, it } from "vitest";
import { parseItem } from "../src/index";
import { toIso690, toIso690Citation } from "../src/iso690";
import { Template, field } from "../src/citation/template";

// The ISO 690 conformance corpus cases (github.com/relaton/iso-690-test-suite,
// the same expectations the relaton-render Ruby engine runs) — cross-implementation
// parity: both engines render the same strings from the same style instance.
describe("toIso690 (ISO 690 conformance corpus)", () => {
  it("renders the FARRAR monograph per the standard's worked example", () => {
    const parsed = parseItem({
      type: "book",
      title: [{ content: "Eric, or Little by Little: a tale of Roslyn School" }],
      date: [{ type: "published", at: "1971" }],
      contributor: [
        { role: [{ type: "author" }], person: { name: { surname: { content: "Farrar" }, forename: [{ content: "Frederic" }, { content: "William" }] } } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "Hamilton" }] } },
      ],
      place: [{ city: "London" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIso690(parsed.item)).toBe(
      "FARRAR, Frederic William. _Eric, or Little by Little: a tale of Roslyn School_. London: Hamilton, 1971.",
    );
  });

  it("renders three editors as creators, serial comma, role suffix (en)", () => {
    const parsed = parseItem({
      type: "book",
      title: [{ content: "From martyr to muppy" }],
      date: [{ type: "published", at: "1994" }],
      contributor: [
        { role: [{ type: "editor" }], person: { name: { surname: { content: "Hamilton" }, forename: [{ content: "Alastair" }] } } },
        { role: [{ type: "editor" }], person: { name: { surname: { content: "Voolstra" }, forename: [{ content: "Sjouke" }] } } },
        { role: [{ type: "editor" }], person: { name: { surname: { content: "Visser" }, forename: [{ content: "Piet" }] } } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "Amsterdam University Press" }] } },
      ],
      place: [{ city: "Amsterdam" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIso690(parsed.item)).toBe(
      "HAMILTON, Alastair, Sjouke VOOLSTRA, and Piet VISSER (eds.). _From martyr to muppy_. Amsterdam: Amsterdam University Press, 1994.",
    );
  });

  it("renders the same editors in French", () => {
    const parsed = parseItem({
      type: "book",
      title: [{ content: "From martyr to muppy" }],
      date: [{ type: "published", at: "1994" }],
      contributor: [
        { role: [{ type: "editor" }], person: { name: { surname: { content: "Hamilton" }, forename: [{ content: "Alastair" }] } } },
        { role: [{ type: "editor" }], person: { name: { surname: { content: "Voolstra" }, forename: [{ content: "Sjouke" }] } } },
        { role: [{ type: "editor" }], person: { name: { surname: { content: "Visser" }, forename: [{ content: "Piet" }] } } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "Amsterdam University Press" }] } },
      ],
      place: [{ city: "Amsterdam" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toIso690(parsed.item, { lang: "fr" });
    // the language-varying bits: et, (éd.), and the French " : " production separator
    expect(s).toContain("Sjouke VOOLSTRA et Piet VISSER (éd.)");
    expect(s).toContain("Amsterdam : Amsterdam University Press, 1994.");
  });

  it("renders an entire serial with a closed date range (publisher-only creator omitted)", () => {
    const parsed = parseItem({
      type: "journal",
      title: [{ content: "Bulletin (Sydney)" }],
      date: [{ type: "published", from: "1880", to: "2008" }],
      contributor: [{ role: [{ type: "publisher" }], organization: { name: [{ content: "Australian Consolidated Press" }] } }],
      place: [{ city: "Sydney" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIso690(parsed.item)).toBe(
      "_Bulletin (Sydney)_. Sydney: Australian Consolidated Press, 1880–2008.",
    );
  });

  it("renders a serial with an open date range and an ISSN", () => {
    const parsed = parseItem({
      type: "journal",
      title: [{ content: "Bulletin trimestriel de l’Institut archéologique du Luxembourg Arlon" }],
      date: [{ type: "published", from: "1925" }],
      docidentifier: [{ content: "0020-2177", type: "ISSN" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIso690(parsed.item)).toBe(
      "_Bulletin trimestriel de l’Institut archéologique du Luxembourg Arlon_. 1925–. ISSN 0020-2177.",
    );
  });

  it("renders ISO 690 itself — corporate creator with abbreviation, no date", () => {
    const parsed = parseItem({
      type: "book",
      title: [{ content: "ISO 690:2010 Information and documentation – Guidelines for bibliographic references and citations to information resources" }],
      contributor: [{
        role: [{ type: "author" }],
        organization: { name: [{ content: "International Organization for Standardization" }], abbreviation: { content: "ISO" } },
      }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIso690(parsed.item)).toBe(
      "INTERNATIONAL ORGANIZATION FOR STANDARDIZATION (ISO). _ISO 690:2010 Information and documentation – Guidelines for bibliographic references and citations to information resources_.",
    );
  });

  it("renders a typed DOI identifier as a https link and skips internal docidentifiers", () => {
    const parsed = parseItem({
      type: "techreport",
      title: [{ content: "Dataset paper" }],
      date: [{ type: "published", at: "2020" }],
      docidentifier: [
        { content: "1", type: "metanorma-ordinal" },
        { content: "10.1234/abcd.5678", type: "DOI" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIso690(parsed.item)).toBe("_Dataset paper_. 2020. https://doi.org/10.1234/abcd.5678.");
  });

  it("renders the in-text citation: surname and year", () => {
    const parsed = parseItem({
      type: "book",
      title: [{ content: "X" }],
      date: [{ type: "published", at: "2015" }],
      contributor: [{ role: [{ type: "author" }], person: { name: { surname: { content: "Fowler" }, forename: [{ content: "H. W" }] } } }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIso690Citation(parsed.item)).toBe("FOWLER, 2015");
  });
});

// The evaluator's omission semantics (mirrors the Ruby suite's template spec).
describe("citation template evaluator", () => {
  it("joins present fields through the literals between them", () => {
    const t = new Template("{{creator}}. {{title}}. {{date}}.");
    const out = t.evaluate({
      creator: field(true, "FARRAR, Frederic William"),
      title: field(true, "_Eric_"),
      date: field(true, "1971"),
    });
    expect(out).toBe("FARRAR, Frederic William. _Eric_. 1971.");
  });

  it("gives up the trailing separator when the last field is absent", () => {
    const t = new Template("{{surname}}, {{givenNames}}");
    expect(t.evaluate({ surname: field(true, "HOMER"), givennames: field(false, "") }))
      .toBe("HOMER");
  });

  it("does not double the terminator", () => {
    const t = new Template("{{title}}.");
    expect(t.evaluate({ title: field(true, "_Eric_") })).toBe("_Eric_.");
  });

  it("returns empty when no field renders", () => {
    const t = new Template("{{creator}}. {{date}}.");
    expect(t.evaluate({ creator: field(false, ""), date: field(false, "") })).toBe("");
  });

  it("resolves slot names case- and underscore-insensitively", () => {
    const t = new Template("{{Component_Part}} {{date}}.");
    expect(t.evaluate({
      componentpart: field(true, "In: _A host_"),
      date: field(true, "1971"),
    })).toBe("In: _A host_ 1971.");
  });
});
