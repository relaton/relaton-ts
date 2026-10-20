import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { RECORDS } from "./golden/records";
import { toIso690 } from "../src/iso690";
import { toChicago, toApa } from "../src/cite_styles";
import type { RelatonItem } from "../src/index.js";

// Golden render corpus: one representative record per SDO, rendered in the
// three house styles (ISO 690, Chicago, APA). The expected strings in
// golden/<name>.json are reviewed snapshots: a renderer change that alters a
// citation must be accompanied by a deliberate golden diff, not a silent
// behaviour change.
const STYLES = {
  iso690: toIso690,
  chicago: toChicago,
  apa: toApa,
} as const;

describe("golden render corpus", () => {
  for (const [name, record] of Object.entries(RECORDS)) {
    for (const [style, render] of Object.entries(STYLES)) {
      it(`${name} renders in ${style}`, () => {
        const golden = JSON.parse(
          readFileSync(new URL(`./golden/${name}.json`, import.meta.url), "utf8"),
        ) as Record<string, string>;

        expect(render(record as unknown as RelatonItem)).toBe(golden[style]);
      });
    }
  }
});
