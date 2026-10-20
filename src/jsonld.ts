// JSON-LD (schema.org) serialization of a Relaton item — the RDF form for
// linked-data consumers. JSON-LD is an RDF syntax, and the context is the
// public schema.org vocabulary, so nothing Relaton-specific leaks into the
// graph.

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

function personNode(c: AnyRec): AnyRec | undefined {
  if (c.person) {
    const given = contentOf(c.person.name?.given);
    const family = contentOf(c.person.name?.surname);
    const complete = contentOf(c.person.name?.completename);
    if (family) {
      return {
        "@type": "Person",
        ...(given ? { givenName: given } : {}),
        familyName: family,
      };
    }
    if (complete) return { "@type": "Person", name: complete };
    return undefined;
  }
  if (c.organization) {
    const name = contentOf(c.organization.name) || contentOf(c.organization.abbreviation);
    if (name) return { "@type": "Organization", name };
  }
  return undefined;
}

/** Renders JSON-LD (schema.org CreativeWork) for a Relaton item. */
export function toJsonLd(item: RelatonItem): string {
  const rec = item as unknown as AnyRec;
  const out: AnyRec = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
  };

  const docids = asArray<AnyRec>(rec.docidentifier);
  const primary = contentOf(docids.find((d) => d.primary) ?? docids[0]);
  const identifiers: unknown[] = [];
  if (primary) identifiers.push(primary);
  for (const [docType, propertyID] of [
    ["DOI", "DOI"], ["ISBN", "ISBN"], ["ISSN", "ISSN"],
  ] as const) {
    const hit = docids.find((d) => String(d.type ?? "").toUpperCase() === docType);
    const value = hit ? contentOf(hit) : "";
    if (value) {
      identifiers.push({ "@type": "PropertyValue", propertyID, value });
    }
  }
  if (identifiers.length === 1) out.identifier = identifiers[0];
  else if (identifiers.length > 1) out.identifier = identifiers;

  const name = contentOf(rec.title);
  if (name) out.name = name;

  const roles: Record<string, AnyRec[]> = {};
  let publisher: AnyRec | undefined;
  for (const c of asArray<AnyRec>(rec.contributor)) {
    const roleNames = asArray<AnyRec>(c.role)
      .map((r) => String(contentOf(r) || r?.type));
    if (roleNames.some((r) => r === "publisher") && c.organization) {
      const orgName = contentOf(c.organization.name) ||
        contentOf(c.organization.abbreviation);
      if (orgName) publisher = { "@type": "Organization", name: orgName };
      continue;
    }
    const node = personNode(c);
    if (!node) continue;
    for (const role of roleNames) {
      if (["author", "editor", "performer"].includes(role)) {
        (roles[role] ||= []).push(node);
      }
    }
  }
  for (const [role, nodes] of Object.entries(roles)) out[role] = nodes;
  if (publisher) out.publisher = publisher;

  for (const d of asArray<AnyRec>(rec.date)) {
    if (d.type === "published" || d.type === "issued") {
      const date = contentOf(d.at ?? d.from);
      if (date) out.datePublished = date;
      break;
    }
  }

  const url = asArray<AnyRec>(rec.source)
    .map((s) => contentOf(s))
    .find((u) => /^https?:/.test(u));
  if (url) out.url = url;

  const edition = contentOf(rec.edition);
  if (edition) out.version = edition;
  const language = asArray(rec.language).map(String).find(Boolean);
  if (language) out.inLanguage = language;
  const keywords = asArray(rec.keyword).map((k) => contentOf(k)).filter(Boolean);
  if (keywords.length) out.keywords = keywords;

  return JSON.stringify(out, null, 2) + "\n";
}
