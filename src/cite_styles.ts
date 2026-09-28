// Chicago (author-date) and APA (7th) citation renderers. They share the
// component extraction with the ISO 690 renderer: one citation language,
// decomposed title composition, primary identifier, publisher roles.

import type { RelatonItem } from "./index.js";
import { fullTitleOf, primaryDocid, yearOf, type Rec } from "./iso690.js";

function contentOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(contentOf).find(Boolean) ?? "";
  if (typeof v === "object" && v !== null) {
    const c = (v as Record<string, unknown>).content;
    if (typeof c === "string") return c;
  }
  return "";
}

interface Contributor {
  role?: { type?: string }[] | { type?: string };
  person?: { name?: { completename?: unknown; given?: unknown; surname?: unknown } };
  organization?: { name?: unknown; abbreviation?: unknown };
}

function rolesOf(c: Contributor): string[] {
  const role = c.role;
  if (Array.isArray(role)) return role.map((r) => r?.type ?? "");
  return role ? [role.type ?? ""] : [];
}

/** Natural-order name ("Given Family") for Chicago. */
function naturalName(name: { completename?: unknown; given?: unknown; surname?: unknown }): string {
  const given = contentOf(name.given);
  const surname = contentOf(name.surname);
  if (given && surname) return `${given} ${surname}`;
  return contentOf(name.completename) || surname;
}

/** "Family, G. G." form for APA. */
function apaName(name: { completename?: unknown; given?: unknown; surname?: unknown }): string {
  const given = contentOf(name.given);
  const surname = contentOf(name.surname);
  if (given && surname) {
    const initials = given.split(/\s+/).filter(Boolean).map((w) => `${w[0]?.toUpperCase()}.`).join(" ");
    return `${surname}, ${initials}`;
  }
  const complete = contentOf(name.completename);
  if (complete) {
    const parts = complete.trim().split(/\s+/);
    if (parts.length >= 2) {
      const family = parts[parts.length - 1] ?? "";
      const initials = parts.slice(0, -1).map((w) => `${w[0]?.toUpperCase()}.`).join(" ");
      return `${family}, ${initials}`;
    }
    return complete;
  }
  return surname;
}

function namesOf(rec: Rec, roles: string[], form: (n: { completename?: unknown; given?: unknown; surname?: unknown }) => string): string[] {
  const names: string[] = [];
  for (const c of (rec.contributor ?? []) as unknown as Contributor[]) {
    if (!roles.some((r) => rolesOf(c).includes(r))) continue;
    if (c.person) {
      const n = form(c.person.name ?? {});
      if (n) names.push(n);
    } else if (c.organization) {
      const n = contentOf(c.organization.name) || contentOf(c.organization.abbreviation);
      if (n) names.push(n);
    }
  }
  return names;
}

/** Append a period without doubling ("Austen, J." stays as-is). */
function dot(s: string): string {
  return s.endsWith(".") ? s : `${s}.`;
}

function list(names: string[], separator: string, lastSeparator: string, max: number): string {
  if (names.length === 0) return "";
  if (names.length > max) {
    return `${names.slice(0, max).join(", ")}, et al`;
  }
  if (names.length === 1) return names[0] ?? "";
  const head = names.slice(0, -1).join(separator);
  return `${head}${lastSeparator}${names[names.length - 1]}`;
}

/** Chicago author-date. Standards: `ISO. 2026. ISO 9001:2026. Title. ISO.` */
export function toChicago(item: RelatonItem): string {
  const rec = item as unknown as Rec;
  const type = rec.type ?? "";
  const docid = primaryDocid(rec);
  const title = fullTitleOf(rec);
  const year = yearOf(rec);
  const edition = contentOf(rec.edition);
  const authors = list(namesOf(rec, ["author", "performer"], naturalName), ", ", " and ", 10);
  const publishers = namesOf(rec, ["publisher"], naturalName);
  const publisher = publishers.find(Boolean) ?? "";
  const isStandard = type === "standard" || (!type && docid);

  if (isStandard) {
    const who = authors || publisher || docid;
    const parts = [
      who ? `${who}.` : "",
      year ? `${year}.` : "",
      docid ? `${docid}.` : "",
      title ? `${title}.` : "",
      edition ? `${edition} ed.` : "",
      publisher ? `${publisher}.` : "",
    ].filter(Boolean);
    return parts.join(" ");
  }

  const parts = [
    authors ? `${authors}.` : docid ? `${docid}.` : "",
    year ? `${year}.` : "",
    title ? `${title}.` : "",
    edition ? `${edition} ed.` : "",
    publisher ? `${publisher}.` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

/** APA 7th. Standards: `ISO. (2026). Title (ISO 9001:2026). ISO.` */
export function toApa(item: RelatonItem): string {
  const rec = item as unknown as Rec;
  const type = rec.type ?? "";
  const docid = primaryDocid(rec);
  const title = fullTitleOf(rec);
  const year = yearOf(rec);
  const authors = list(namesOf(rec, ["author", "performer"], apaName), ", ", ", & ", 20);
  const publishers = namesOf(rec, ["publisher"], naturalName);
  const publisher = publishers.find(Boolean) ?? "";
  const isStandard = type === "standard" || (!type && docid);

  if (isStandard) {
    const who = authors || publisher || docid;
    const parts = [
      who ? dot(who) : "",
      year ? `(${year}).` : "",
      title ? docid ? `${title} (${docid}).` : `${title}.` : docid ? `(${docid}).` : "",
      publisher ? `${publisher}.` : "",
    ].filter(Boolean);
    return parts.join(" ");
  }

  const parts = [
    authors ? dot(authors) : docid ? `${docid}.` : "",
    year ? `(${year}).` : "",
    title ? `${title}.` : "",
    publisher ? `${publisher}.` : "",
  ].filter(Boolean);
  return parts.join(" ");
}
