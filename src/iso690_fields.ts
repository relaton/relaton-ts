// Field helpers over the Relaton wire shape, kept as a stable surface for
// callers that compose their own strings (search summaries, record pages).
// Citation rendering itself lives in the instance-driven engine
// (src/citation/); these helpers stay behavior-compatible.

import type { Rec } from "./citation/fields.js";

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

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

function iso690Person(name: { completename?: unknown; given?: unknown; surname?: unknown }): string {
  const complete = contentOf(name.completename);
  const given = contentOf(name.given);
  const surname = contentOf(name.surname);
  if (surname) {
    const initials = given.split(/\s+/).filter(Boolean)
      .map((w) => `${w[0]?.toUpperCase()}.`).join(" ");
    return initials ? `${surname.toUpperCase()}, ${initials}` : surname.toUpperCase();
  }
  if (complete) {
    const parts = complete.trim().split(/\s+/);
    if (parts.length >= 2) {
      const family = parts[parts.length - 1] ?? "";
      const initials = parts.slice(0, -1).map((w) => `${w[0]?.toUpperCase()}.`).join(" ");
      return `${family.toUpperCase()}${initials ? ", " + initials : ""}`;
    }
    return complete.toUpperCase();
  }
  return "";
}

export function primaryDocid(rec: Rec): string {
  const docids = rec.docidentifier ?? [];
  const primary = docids.find((d) => d.primary) ?? docids[0];
  return contentOf(primary) || "";
}

/**
 * Titles come decomposed (title-intro / title-main / title-part per
 * language) and/or as a composite type:"main" string per language. Pick
 * one citation language (English preferred, else first seen) and build
 * the full title from that language only.
 */
export function fullTitleOf(rec: Rec): string {
  const titles = (rec.title ?? []).filter((t) => contentOf(t));
  const langOf = (t: { language?: string | undefined }) => (t.language ?? "").toLowerCase();
  const langs = [...new Set(titles.map(langOf).filter(Boolean))];
  const lang = langs.includes("en") ? "en" : langs[0] ?? "";
  const ours = titles.filter((t) => (lang ? langOf(t) === lang : true));

  const intro = ours.find((t) => t.type === "title-intro");
  const main = ours.find((t) => t.type === "title-main");
  const part = ours.find((t) => t.type === "title-part");
  const composite = ours.find((t) => t.type === "main");
  if (intro || main) {
    return [intro, main, part].filter((x) => x && contentOf(x)).map((x) => contentOf(x)).join(" — ");
  }
  return [composite, part].filter((x) => x && contentOf(x)).map((x) => contentOf(x)).join(" — ");
}

export function yearOf(rec: Rec): string {
  const dates = rec.date ?? [];
  const published = dates.find((d) => d.type === "published" || d.type === "issued") ?? dates[0];
  const raw = contentOf(published?.at) || contentOf(published?.from) || "";
  return raw.match(/\d{4}/)?.[0] ?? "";
}

export function originatorsOf(rec: Rec, roles: string[]): string {
  const names: string[] = [];
  for (const c of rec.contributor ?? []) {
    const roleList = Array.isArray(c.role) ? c.role : c.role ? [c.role] : [];
    const roleTypes = roleList.map((r) => (typeof r === "string" ? r : r?.type ?? ""));
    if (!roles.some((r) => roleTypes.includes(r))) continue;
    if (c.person) {
      const n = iso690Person(c.person.name ?? {});
      if (n) names.push(n);
    } else if (c.organization) {
      const n = contentOf(c.organization.name) || contentOf(c.organization.abbreviation);
      if (n) names.push(n);
    }
  }
  return names.join(" ; ");
}
