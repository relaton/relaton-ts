import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fromXml } from "../src/xml";
import { toBibtex } from "../src/bibtex";
import { parseItem } from "../src/index";

const fixture = readFileSync(new URL("./fixtures/bibdata-iho-b10.xml", import.meta.url), "utf8");

describe("toBibtex", () => {
  it("renders a standard: misc entry keyed by the identifier", () => {
    const parsed = fromXml(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toBibtex(parsed.item);
    expect(s).toMatch(/^@misc\{B10,/);
    expect(s).toContain("title = {The History of GEBCO");
    expect(s).toContain("year = {2003}");
    expect(s).toContain("howpublished = {B-10}");
  });

  it("renders person authors in Family, Given form", () => {
    const parsed = parseItem({
      type: "book",
      docidentifier: [{ content: "978-0-14-143951-8", type: "ISBN" }],
      title: [{ type: "main", content: "Pride and Prejudice" }],
      contributor: [
        { role: [{ type: "author" }], person: { name: { completename: { content: "Jane Austen" } } } },
        { role: [{ type: "publisher" }], organization: { name: [{ content: "Penguin" }] } },
      ],
      date: [{ type: "published", at: "2002" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toBibtex(parsed.item);
    expect(s).toMatch(/^@book\{9780141439518,/);
    expect(s).toContain("author = {Austen, Jane}");
    expect(s).toContain("publisher = {Penguin}");
  });
});
