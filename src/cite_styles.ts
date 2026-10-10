// Chicago (author-date) and APA (7th) citation renderers, on the
// canonical packs (chicago.yml, apa.yml) — the same data the Ruby
// engine renders from. The public surface (toChicago, toApa) is
// unchanged; the hand-written forms are retired.

import type { RelatonItem } from "./index.js";
import { toIso690 } from "./iso690.js";

export function toChicago(item: RelatonItem): string {
  return toIso690(item, { style: "chicago" });
}

export function toApa(item: RelatonItem): string {
  return toIso690(item, { style: "apa" });
}
