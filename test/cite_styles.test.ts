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
    expect(s).toContain("International Hydrographic Organization.");
    expect(s).toContain("2003.");
    expect(s).toMatch(/B-10\./);
    expect(s).toContain("The History of GEBCO");
    expect(s).toMatch(/\.$/);
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
    expect(s).toMatch(/^Jane Austen\. 2002\. Pride and Prejudice\. Penguin\.$/);
  });
});

describe("toApa", () => {
  it("renders a standard: author, (year), title (docid), publisher", () => {
    const parsed = fromXml(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toApa(parsed.item);
    expect(s).toContain("(2003).");
    expect(s).toMatch(/The History of GEBCO.*\(B-10\)\./);
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
    expect(s).toMatch(/^Austen, J\. \(2002\)\. Pride and Prejudice\. Penguin\.$/);
  });
});
