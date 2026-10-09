// The canonical pack contract, mirrored from relaton-render's
// style_spec: extends resolution, the delta merge semantics, and the
// pack taxonomy selection.

import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Style } from "../src/citation/style.js";

function writePack(name: string, yaml: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "packs-")), `${name}.yml`);
  writeFileSync(path, yaml);
  return path;
}

describe("Style.load", () => {
  it("loads every canonical pack", () => {
    for (const name of [
      "author-date", "lncs", "chicago", "ieee-sa", "apa", "jis-en", "jis-ja",
    ]) {
      expect(Style.load(name).name).not.toBe("");
    }
  });

  it("raises for an unknown style", () => {
    expect(() => Style.load("turbabian")).toThrow(/unknown style turbabian/);
  });

  it("merges perType per (type, home) key, keeps the base's other patterns", () => {
    const base = writePack("delta-base", `
name: delta base
perType:
  - type: monograph
    template: "BASE {{title}}"
  - type: article
    template: "BASE-A {{title}}"
`);
    const delta = writePack("delta-child", `
name: delta child
extends: ${base}
perType:
  - type: article
    template: "DELTA-A {{title}}"
`);
    const style = Style.load(delta);
    expect(style.templateFor("article")).toBe("DELTA-A {{title}}");
    expect(style.templateFor("monograph")).toBe("BASE {{title}}");
  });

  it("merges labels per key and inherits undeclared name-form knobs", () => {
    const base = writePack("label-base", `
name: label base
scheme:
  nameForm:
    invertedAll: true
    initials: true
  locale:
    labels:
      "and": "&"
`);
    const delta = writePack("label-delta", `
name: label delta
extends: ${base}
scheme:
  nameForm:
    surnameUpcase: false
  locale:
    labels:
      series_no: ""
`);
    const style = Style.load(delta);
    expect(style.nameForm.surnameUpcase).toBe(false); // declared wins
    expect(style.nameForm.initials).toBe(true); // inherited
    expect(style.nameForm.invertedAll).toBe(true); // inherited
    expect(style.labelMap().and).toBe("&"); // inherited
    expect(style.labelMap().series_no).toBe(""); // declared
  });

  it("lets a delta label win per key and a named attribute assert over the base's labels", () => {
    const base = writePack("label-base2", `
name: label base 2
scheme:
  locale:
    availableAt: "Available at:"
    labels:
      "and": "&"
`);
    const delta = writePack("label-delta2", `
name: label delta 2
extends: ${base}
scheme:
  locale:
    availableAt: "入手先："
    labels:
      "and": ""
`);
    const style = Style.load(delta);
    expect(style.labelMap().and).toBe(""); // declared wins
    expect(style.labelMap().available_from).toBe("入手先："); // named asserts
  });

  it("unions requires and resolves the pack taxonomy before Kinds", () => {
    const base = writePack("req-base", `
name: req base
requires: [production_order]
`);
    const delta = writePack("req-delta", `
name: req delta
extends: ${base}
requires: [extent_units]
types:
  article-journal: continuing
  dataset: webdoc
`);
    const style = Style.load(delta);
    expect([...style.requires].sort()).toEqual(["extent_units", "production_order"]);
    expect(style.kindFor("article-journal")).toBe("continuing");
    expect(style.kindFor("dataset")).toBe("webdoc");
    expect(style.kindFor("book")).toBe("monograph"); // Kinds fallthrough
  });

  it("splits home variants on the short cite as on the reference", () => {
    const pack = writePack("home-pack", `
name: home pack
perType:
  - type: report
    home: true
    template: "HOME {{title}}"
    short: "HOME-S {{title}}"
  - type: report
    template: "EXT {{title}}"
    short: "EXT-S {{title}}"
`);
    const style = Style.load(pack);
    expect(style.templateFor("report", true)).toBe("HOME {{title}}");
    expect(style.shortTemplateFor("report", false)).toBe("EXT-S {{title}}");
  });

  it("raises on a circular extends", () => {
    const a = writePack("cyc-a", "name: cyc a\n");
    const b = writePack("cyc-b", `name: cyc b\nextends: ${a}`);
    writeFileSync(a, `name: cyc a\nextends: ${b}\n`);
    expect(() => Style.load(b)).toThrow(/circular extends/);
  });
});
