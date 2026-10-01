// The vocabulary mapping from a bibliographic item's wire type value to
// its ISO 690 clause 8 resource kind (TemplateType). This table is the
// engine's charter — style instances select perType templates on kinds
// and never enumerate type synonyms. Unmapped values fall to the report
// kind (clause 8.11), the fallback. (Port of relaton-render's Iso690::Kinds.)

const TO_KIND: Record<string, string> = {
  book: "monograph",
  booklet: "monograph",
  manual: "monograph",
  proceedings: "monograph",
  thesis: "monograph",
  standard: "report",
  techreport: "report",
  report: "report",
  patent: "patent",
  journal: "continuing",
  serial: "continuing",
  "article-journal": "continuing",
  "article-magazine": "continuing",
  inbook: "component_part",
  incollection: "component_part",
  inproceedings: "component_part",
  website: "online",
  webresource: "online",
  webpage: "online",
  online: "online",
};

export const DEFAULT_KIND = "report";

export function kindFor(type: string | undefined): string {
  return TO_KIND[type ?? ""] ?? DEFAULT_KIND;
}
