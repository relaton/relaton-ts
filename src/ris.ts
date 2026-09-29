// RIS serialization of a Relaton item — the interchange format for
// EndNote, Zotero, and Reference Manager. Standards map to TY - STD.

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
  standard: "STD",
  book: "BOOK",
  article: "JOUR",
  inbook: "CHAP",
  inproceedings: "CONF",
  report: "RPRT",
  thesis: "THES",
  website: "ELEC",
  webresource: "ELEC",
};

/** Renders the RIS record for a Relaton item (CRLF line ends, per spec). */
export function toRis(item: RelatonItem): string {
  const rec = item as unknown as AnyRec;
  const lines: string[] = [];
  const entryType = TYPE_MAP[rec.type ?? ""] ?? "STD";
  lines.push(`TY  - ${entryType}`);

  for (const c of asArray(rec.contributor as AnyRec[])) {
    const role = asArray(c.role as AnyRec[]).map((r) => contentOf(r) || r?.type);
    const isAuthorish = role.some((r) => ["author", "performer", "editor"].includes(String(r)));
    if (c.person && isAuthorish) {
      const given = contentOf(c.person.name?.given);
      const surname = contentOf(c.person.name?.surname);
      const complete = contentOf(c.person.name?.completename);
      const name = surname
        ? (given ? `${surname}, ${given}` : surname)
        : complete;
      if (name) lines.push(`AU  - ${name}`);
    } else if (c.organization && isAuthorish) {
      const name = contentOf(c.organization.name) || contentOf(c.organization.abbreviation);
      if (name) lines.push(`AU  - ${name}`);
    } else if (c.organization && role.some((r) => String(r) === "publisher")) {
      const name = contentOf(c.organization.name) || contentOf(c.organization.abbreviation);
      if (name) lines.push(`PB  - ${name}`);
    }
  }

  const title = contentOf(rec.title);
  if (title) lines.push(`TI  - ${title}`);

  const docids = asArray(rec.docidentifier as AnyRec[]);
  const primary = docids.find((d) => d.primary === true) ?? docids[0];
  const docid = contentOf(primary);
  if (docid) lines.push(`ID  - ${docid}`);

  let year = "";
  for (const d of asArray(rec.date as AnyRec[])) {
    if (d.type === "published" || d.type === "issued") {
      year = contentOf(d.at ?? d.from).match(/\d{4}/)?.[0] ?? "";
      break;
    }
  }
  if (year) lines.push(`PY  - ${year}`);
  const edition = contentOf(rec.edition);
  if (edition) lines.push(`ET  - ${edition}`);
  const lang = asArray(rec.language).map(String).find(Boolean);
  if (lang) lines.push(`LA  - ${lang}`);
  for (const kw of asArray(rec.keyword)) {
    const text = contentOf(kw);
    if (text) lines.push(`KW  - ${text}`);
  }
  const uri = asArray(rec.source as AnyRec[]).map((s) => contentOf(s)).find((u) => /^https?:/.test(u));
  if (uri) lines.push(`UR  - ${uri}`);

  lines.push("ER  - ");
  return lines.join("\r\n") + "\r\n";
}
