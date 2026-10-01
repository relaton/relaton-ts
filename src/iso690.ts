// ISO 690 citation rendering for a Relaton item, driven by CitationStyle
// YAML instances (the relaton-models citation module; canonical instance
// in src/citation/styles/iso-690.yml, byte-identical to the models'
// citation/styles/iso-690.yml). The engine is a template evaluator over a
// field resolver and holds no styles — a new style is a YAML instance.
// In-text citation form via toIso690Citation. Chicago/APA remain separate
// conventions (inline in cite_styles.ts) until their own style instances
// are authored.

import type { RelatonItem } from "./index.js";
import { renderIso690Reference, renderIso690Citation } from "./citation/render.js";
import type { Rec } from "./citation/fields.js";

export { primaryDocid, fullTitleOf, yearOf, originatorsOf } from "./iso690_fields.js";
export type { Rec } from "./citation/fields.js";

/** Renders the ISO 690 reference for a Relaton item, per the style instance. */
export function toIso690(
  item: RelatonItem,
  opts: { lang?: string; style?: string } = {},
): string {
  return renderIso690Reference(item as unknown as Rec, opts);
}

/** Renders the ISO 690 name-and-date in-text citation for a Relaton item. */
export function toIso690Citation(
  item: RelatonItem,
  opts: { lang?: string; disambiguator?: string } = {},
): string {
  return renderIso690Citation(item as unknown as Rec, opts);
}
