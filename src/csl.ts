// CSL-JSON serialization of a Relaton item — the Citation Style
// Language interchange format consumed by Zotero, Mendeley, and every
// citeproc implementation.

import type { RelatonItem } from "./index.js";

type AnyRec = Record<string, any>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function contentOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(contentOf).find(Boolean) ?? "";
  if (typeof v === "object" && v !== null) {
    const c = (v as AnyRec).content;
    if (typeof c === "string") return c;
  }
  return "";
}

const TYPE_MAP: Record<string, string> = {
  standard: "standard",
  book: "book",
  article: "article-journal",
  inbook: "chapter",
  inproceedings: "paper-conference",
  report: "report",
  thesis: "thesis",
  website: "webpage",
  webresource: "webpage",
};

/** Renders CSL-JSON (a single-item JSON array) for a Relaton item. */
export function toCslJson(item: RelatonItem): string {
  const rec = item as unknown as AnyRec;
  const out: AnyRec = {};

  const docids = asArray(rec.docidentifier as AnyRec[]);
  const primary = contentOf(docids.find((d) => d.primary === true) ?? docids[0]);
  out.id = primary || "relaton";
  out.type = TYPE_MAP[rec.type ?? ""] ?? "standard";

  const title = contentOf(rec.title);
  if (title) out.title = title;

  const authors: AnyRec[] = [];
  for (const c of asArray(rec.contributor as AnyRec[])) {
    const role = asArray(c.role as AnyRec[]).map((r) => contentOf(r) || r?.type);
    const isAuthorish = role.some((r) => ["author", "performer", "editor"].includes(String(r)));
    if (!isAuthorish) continue;
    if (c.person) {
      const given = contentOf(c.person.name?.given);
      const family = contentOf(c.person.name?.surname);
      const complete = contentOf(c.person.name?.completename);
      if (family || complete) {
        authors.push(family
          ? { family, ...(given ? { given } : {}) }
          : { literal: complete });
      }
    } else if (c.organization) {
      const name = contentOf(c.organization.name) || contentOf(c.organization.abbreviation);
      if (name) authors.push({ literal: name });
    }
  }
  if (authors.length) out.author = authors;

  let year = "";
  for (const d of asArray(rec.date as AnyRec[])) {
    if (d.type === "published" || d.type === "issued") {
      year = contentOf(d.at ?? d.from).match(/\d{4}/)?.[0] ?? "";
      break;
    }
  }
  if (year) out.issued = { "date-parts": [[year]] };

  const publisherOrg = asArray(rec.contributor as AnyRec[]).find((c) =>
    asArray(c.role as AnyRec[]).some((r) => String(contentOf(r) || r?.type) === "publisher") && c.organization);
  const publisherName = publisherOrg
    ? (contentOf(publisherOrg.organization.name) || contentOf(publisherOrg.organization.abbreviation))
    : "";
  if (publisherName) out.publisher = publisherName;

  if (primary) out.number = primary;
  const edition = contentOf(rec.edition);
  if (edition) out.edition = edition;
  const lang = asArray(rec.language).map(String).find(Boolean);
  if (lang) out.language = lang;
  const keywords = asArray(rec.keyword).map((k) => contentOf(k)).filter(Boolean);
  if (keywords.length) out.keyword = keywords;
  const uri = asArray(rec.source as AnyRec[]).map((s) => contentOf(s)).find((u) => /^https?:/.test(u));
  if (uri) out.URL = uri;

  return JSON.stringify([out], null, 2) + "\n";
}
