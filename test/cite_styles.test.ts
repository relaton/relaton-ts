import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fromXml } from "../src/xml";
import { toChicago, toApa } from "../src/cite_styles";
import { parseItem } from "../src/index";

const fixture = readFileSync(new URL("./fixtures/bibdata-iho-b10.xml", import.meta.url), "utf8");

describe("toChicago", () => {
  it("renders a standard: author, year, docid, title, publisher", () => {
    const parsed = fromXml(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toChicago(parsed.item);
    // the canonical Chicago pack: organizations verbatim, quoted
    // report titles, production then trailing year
    expect(s).toMatch(/^International Hydrographic Organization \(IHO\)/);
    expect(s).toContain(`"The History of GEBCO"`);
    expect(s).toContain("5th ed.");
    expect(s).toMatch(/International Hydrographic Organization, 2003\.$/);
  });

  it("renders a book with natural-order author names", () => {
    const parsed = parseItem({
      type: "book",
      title: [{ type: "main", content: "Pride and Prejudice" }],
      contributor: [
        { role: [{ type: "author" }], person: { name: { completename: { content: "Jane Austen" } } } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "Penguin" }] } },
      ],
      date: [{ type: "published", at: "2002" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toChicago(parsed.item);
    // monographs italicize; the year trails the production
    expect(s).toBe(
      "Jane Austen. <em>Pride and Prejudice</em>. Penguin, 2002.",
    );
  });
});

describe("toApa", () => {
  it("renders a standard: author, (year), title (docid), publisher", () => {
    const parsed = fromXml(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toApa(parsed.item);
    expect(s).toMatch(/^B-10\. \(2003\)\. The History of GEBCO/);
  });

  it("renders person authors in Family, Initials form", () => {
    const parsed = parseItem({
      type: "book",
      title: [{ type: "main", content: "Pride and Prejudice" }],
      contributor: [
        { role: [{ type: "author" }], person: { name: { completename: { content: "Jane Austen" } } } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "Penguin" }] } },
      ],
      date: [{ type: "published", at: "2002" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toApa(parsed.item);
    expect(s).toBe(
      "Austen, J. (2002). <em>Pride and Prejudice</em>. Penguin.",
    );
  });
});
