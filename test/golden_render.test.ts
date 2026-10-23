import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { toIso690 } from "../src/iso690";
import { toChicago, toApa } from "../src/cite_styles";
import type { RelatonItem } from "../src/index.js";

// Golden render corpus: one representative record per SDO, rendered in the
// three house styles (ISO 690, Chicago, APA). The corpus lives in the
// shared citation-testsuite repository (records/<name>.json + golden
// <name>.json) so relaton-render executes the SAME strings on the Ruby
// side — the renderings are pinned once across both stacks. A golden
// changes only with a deliberate rendering change, never silently.
const FIXTURE_DIR =
  process.env["CITATION_TESTSUITE_DIR"] ??
  path.resolve(import.meta.dirname, "../../../../citation-testsuite");

const STYLES = {
  iso690: toIso690,
  chicago: toChicago,
  apa: toApa,
} as const;

describe("citation render corpus (citation-testsuite)", () => {
  if (!existsSync(path.join(FIXTURE_DIR, "records"))) {
    it("corpus available", () => {
      console.warn(
        `skip: no citation-testsuite at ${FIXTURE_DIR} — set CITATION_TESTSUITE_DIR`,
      );
    });
    return;
  }

  const names = readFileSync(path.join(FIXTURE_DIR, "README.adoc"), "utf8")
    ? ["iec", "ieee", "ietf", "iso", "itu", "nist"]
    : [];

  for (const name of names) {
    const record = JSON.parse(
      readFileSync(path.join(FIXTURE_DIR, "records", `${name}.json`), "utf8"),
    ) as unknown as RelatonItem;
    const golden = JSON.parse(
      readFileSync(path.join(FIXTURE_DIR, "golden", `${name}.json`), "utf8"),
    ) as Record<string, string>;

    for (const [style, render] of Object.entries(STYLES)) {
      it(`${name} renders in ${style}`, () => {
        expect(render(record)).toBe(golden[style]);
      });
    }
  }
});
