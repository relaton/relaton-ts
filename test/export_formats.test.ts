import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fromXml } from "../src/xml";
import { toRis } from "../src/ris";
import { toCslJson } from "../src/csl";

const fixture = readFileSync(new URL("./fixtures/bibdata-iho-b10.xml", import.meta.url), "utf8");

describe("toRis", () => {
  it("renders a standard RIS record", () => {
    const parsed = fromXml(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = toRis(parsed.item);
    expect(s.startsWith("TY  - STD\r\n")).toBe(true);
    expect(s).toContain("TI  - The History of GEBCO");
    expect(s).toContain("PY  - 2003");
    expect(s.trimEnd().endsWith("ER  -")).toBe(true);
  });
});

describe("toCslJson", () => {
  it("renders a CSL-JSON array for a standard", () => {
    const parsed = fromXml(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const arr = JSON.parse(toCslJson(parsed.item));
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0].type).toBe("standard");
    expect(arr[0].issued["date-parts"]).toEqual([[String(arr[0].issued["date-parts"][0][0])]]);
    expect(String(arr[0].id)).toContain("B-10");
  });
});
