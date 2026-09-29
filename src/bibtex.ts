// BibTeX serialization of a Relaton item. Standards map to @misc with the
// identifier as key and howpublished carrying it; books/articles map to
// their natural entry types. Person names render in BibTeX "Family, Given"
// form; organizations render verbatim.

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

function braced(value: string): string {
  return `{${value.replace(/[{}]/g, "")}}`;
}

function bibtexPerson(name: { completename?: unknown; given?: unknown; surname?: unknown }): string {
  const given = contentOf(name.given);
  const surname = contentOf(name.surname);
  if (given && surname) return `${surname}, ${given}`;
  const complete = contentOf(name.completename);
  if (complete) {
    const parts = complete.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
    }
    return complete;
  }
  return surname || complete;
}

function primaryDocid(rec: AnyRec): string {
  const docids = asArray(rec.docidentifier as AnyRec[]);
  const pick = docids.find((d) => d.primary === true) ?? docids[0];
  return contentOf(pick) || "";
}

function yearOf(rec: AnyRec): string {
  for (const d of asArray(rec.date as AnyRec[])) {
    if (d.type === "published" || d.type === "issued") {
      return contentOf(d.at ?? d.from).match(/\d{4}/)?.[0] ?? "";
    }
  }
  const anyDate = asArray(rec.date as AnyRec[])[0];
  return contentOf(anyDate?.at ?? anyDate?.from ?? anyDate?.to).match(/\d{4}/)?.[0] ?? "";
}

const TYPE_MAP: Record<string, string> = {
  book: "book",
  article: "article",
  inbook: "incollection",
  inproceedings: "inproceedings",
  website: "misc",
  webresource: "misc",
  standard: "misc",
  report: "techreport",
  thesis: "phdthesis",
};

/** Renders the BibTeX entry for a Relaton item (trailing newline). */
export function toBibtex(item: RelatonItem): string {
  const rec = item as unknown as AnyRec;
  const type = rec.type ?? "";
  const docid = primaryDocid(rec);
  const key = docid.replace(/[^A-Za-z0-9]+/g, "") || "relaton";

  const entryType = TYPE_MAP[type] ?? "misc";
  const fields: [string, string][] = [];

  const title = contentOf(rec.title);
  if (title) fields.push(["title", braced(title)]);

  const authors: string[] = [];
  const orgAuthors: string[] = [];
  let publisherName = "";
  for (const c of asArray(rec.contributor as AnyRec[])) {
    const role = asArray(c.role as AnyRec[]).map((r) => contentOf(r) || r?.type);
    const isAuthorish = role.some((r) => ["author", "performer", "editor"].includes(String(r)));
    const isPublisher = role.some((r) => String(r) === "publisher");
    const orgName = c.organization
      ? (contentOf(c.organization.name) || contentOf(c.organization.abbreviation))
      : "";
    if (c.person && isAuthorish) {
      const name = bibtexPerson(c.person.name ?? {});
      if (name) authors.push(name);
    } else if (c.organization && isAuthorish && orgName) {
      orgAuthors.push(orgName);
    }
    if (c.organization && isPublisher && orgName && !publisherName) {
      publisherName = orgName;
    }
  }
  if (authors.length || orgAuthors.length) {
    const all = [...authors, ...orgAuthors];
    fields.push(["author", `{${all.join(" and ")}}`]);
  }

  if (docid) fields.push(["howpublished", braced(docid)]);
  const year = yearOf(rec);
  if (year) fields.push(["year", braced(year)]);
  const edition = contentOf(rec.edition);
  if (edition) fields.push(["edition", braced(edition)]);
  if (publisherName) fields.push(["publisher", braced(publisherName)]);
  if (docid.startsWith("10.")) fields.push(["doi", braced(docid)]);

  const body = fields.map(([k, v]) => `  ${k} = ${v},`).join("\n");
  return `@${entryType}{${key},\n${body}\n}\n`;
}
