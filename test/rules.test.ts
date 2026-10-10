// The named-rule registry: pack selections override slot builders —
// the mirror of relaton-render's rules_spec cases.

import { describe, expect, it } from "vitest";
import { resolveRules, REGISTRY } from "../src/citation/rules";
import { renderIso690Reference } from "../src/citation/render";
import { parseItem } from "../src/index";
function parseItem2(v: unknown): unknown { return v; }
const parseOk = (v: unknown): unknown => v;

function render(item: unknown, rules: Record<string, string>, template: string): string {
  return renderIso690Reference(item as never, {
    style: writePack(rules, template),
  });
}

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function writePack(rules: Record<string, string>, template: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "rulepack-")), "pack.yml");
  writeFileSync(path, [
    "name: rule probe",
    "rules:",
    ...Object.entries(rules).map(([s, r]) => `  ${s}: ${r}`),
    "templates:",
    `  reference: "${template.replace(/"/g, '\\"')}"`,
  ].join("\n"));
  return path;
}

describe("the rules registry", () => {
  it("resolves a pack's rule selections and fails loudly on unknowns", () => {
    expect(resolveRules({ identifier: "itu_identifier" })).toHaveProperty("identifier");
    expect(() => resolveRules({ identifier: "nonexistent" }))
      .toThrow(/unknown citation style rule nonexistent/);
  });

  it("registers the engine's rule names", () => {
    for (const name of [
      "status_bare", "itu_identifier", "ieee_identifier",
      "ieee_component_part", "ieee_access", "ieee_medium",
      "iho_creator", "iho_edition", "jis_component_part", "jis_series",
      "jis_extent",
    ]) {
      expect(REGISTRY[name]).toBeDefined();
    }
  });

  it("labels ISBN with a colon (itu_identifier)", () => {
    const out = render({
      type: "book",
      title: [{ content: "A handbook" }],
      docidentifier: [{ type: "ISBN", content: "92-61-12521-9" }],
      date: [{ type: "published", on: "1998" }],
    }, { identifier: "itu_identifier" }, "{{title}}. {{identifier}}.");
    expect(out).toContain("ISBN: 92-61-12521-9");
  });

  it("cites the bare status (status_bare)", () => {
    const out = render({
      type: "standard",
      title: [{ content: "PAS 9017" }],
      docidentifier: [{ type: "BSI", content: "PAS 9017" }],
      status: { stage: { content: "Recommendation" } },
    }, { status: "status_bare" }, "{{identifier}}. {{status}}.");
    expect(out).toContain("PAS 9017. Recommendation.");
  });

  it("cites the host in the IEEE-SA component-part form", () => {
    const out = render({
      type: "inbook",
      title: [{ content: "A chapter" }],
      relation: [{
        type: "partOf",
        bibitem: {
          type: "book",
          title: [{ content: "The Host Book" }],
          contributor: [
            { role: [{ type: "editor" }], person: { name: { surname: { content: "Pellegrini" }, forename: [{ content: "A. D." }] } } },
            { role: [{ type: "editor" }], person: { name: { surname: { content: "Smith" }, forename: [{ content: "P. K." }] } } },
          ],
        },
      }],
    }, { component_part: "ieee_component_part" }, "{{componentpart}}.");
    expect(out).toContain("(eds.):");
    expect(out).toContain("P. K. Smith");
    expect(out).toContain("The Host Book");
  });

  it("capitalizes the carrier with a trailing comma (ieee_medium)", () => {
    const out = render({
      type: "dataset",
      title: [{ content: "A dataset" }],
      medium: { carrier: { content: "dataset" } },
      date: [{ type: "published", on: "2020" }],
    }, { medium: "ieee_medium" }, "{{title}}. {{medium}} {{date}}.");
    expect(out).toContain("Dataset,");
  });

  it("keeps the bare numeric edition for IHO publishers (iho_edition)", () => {
    const out = render({
      type: "standard",
      title: [{ content: "Standards for Hydrographic Surveys" }],
      edition: { content: "3.1.0" },
      contributor: [
        { role: [{ type: "publisher" }], organization: { name: [{ content: "International Hydrographic Organization" }] } },
      ],
      date: [{ type: "published", on: "2020" }],
    }, { edition: "iho_edition" }, "{{title}}. {{edition}}. {{date}}.");
    expect(out).toContain("edition 3.1.0");
  });

  it("cites the jis component part with the orphaned close paren", () => {
    const out = render({
      type: "inbook",
      title: [{ content: "A chapter" }],
      relation: [{
        type: "partOf",
        bibitem: {
          type: "book",
          title: [{ content: "Collected Essays" }],
          contributor: [
            { role: [{ type: "author" }], organization: { name: [{ content: "UNICEF" }] } },
          ],
        },
      }],
    }, { component_part: "jis_component_part" }, "{{componentpart}}");
    expect(out).toContain("Collected Essays UNICEF)");
  });

  it("keeps the last locality per type in the jis extent", () => {
    const out = render({
      type: "book",
      title: [{ content: "A repeated book" }],
      extent: [{
        locality: [
          { type: "page", referenceFrom: { content: "1" } },
          { type: "volume", referenceFrom: { content: "3" } },
          { type: "page", referenceFrom: { content: "19" } },
        ],
      }],
      date: [{ type: "published", on: "2020" }],
    }, { extent: "jis_extent" }, "{{title}}. {{extent}}.");
    expect(out).toContain("vol. 3");
    expect(out).toContain("p. 19");
    expect(out).not.toContain("p. 1.");
  });

  it("cites a from-only publication date bare, an open run only for serials", () => {
    const book = render({
      type: "book",
      title: [{ content: "A monograph" }],
      date: [{ type: "published", from: "2022" }],
    }, {}, "{{title}}. {{date}}.");
    expect(book).toBe("_A monograph_. 2022.");
    const serial = render({
      type: "journal",
      title: [{ content: "A serial" }],
      date: [{ type: "published", from: "1925" }],
    }, {}, "{{title}}. {{date}}.");
    expect(serial).toContain("1925–");
  });
});
