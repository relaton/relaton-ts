// Metanorma citation utilities: the fetch entry (the one-line
// `* [[[anchor,DOCID]]]` bibliography form Metanorma auto-fetches at build
// time) and PubID resolution checks, backed by pubid-ts. The anchor is
// always the user's choice; the default derives from the docid.

import * as pubid from "@pubid/pubid";

/**
 * PubID parser. The published @pubid/pubid surface is corpus-oriented
 * (loadCorpus / grammarImplementation); the synchronous parse facade is
 * host-specific, so callers inject theirs. The bundled corpus keeps this
 * dependency meaningful for richer checks later.
 */
export type PubidParser = (code: string) => unknown;
import type { RelatonItem } from "./index.js";
import { slugAnchor } from "./asciibib.js";

export interface FetchEntryOptions {
  /** User-chosen citation anchor; defaults to the docid-derived slug. */
  anchor?: string;
  /** Strip the year — Metanorma fetches the latest edition at build time. */
  undated?: boolean;
  /** Cite the all-parts aggregate instead of a single part. */
  allParts?: boolean;
}

function primaryDocid(item: RelatonItem): string {
  const rec = item as unknown as { docidentifier?: { content?: string; primary?: boolean }[] };
  const docids = rec.docidentifier ?? [];
  return docids.find((d) => d.primary)?.content ?? docids[0]?.content ?? "";
}

/**
 * Is this identifier a PubID pubid-ts recognizes? Note: pubid-ts covers a
 * subset of the flavor families; the Relaton API additionally resolves
 * identifiers through its docid index, so a false here is a warning, not
 * a verdict.
 */
export function isResolvablePubid(code: string, parse: PubidParser = pubidParseFallback): boolean {
  return parse(code) !== null;
}

const pubidParseFallback: PubidParser = () => {
  // Without a host parser we cannot judge — a warning, not a verdict.
  return {};
};

/** The docid as the fetch entry should carry it (undated / all-parts applied). */
export function fetchDocid(code: string, opts: FetchEntryOptions = {}): string {
  let docid = code;
  if (opts.undated) docid = docid.replace(/:[-–]?\d{4}$/, "");
  if (opts.allParts && !/all parts/i.test(docid)) {
    docid = docid.replace(/:[-–]?\d{4}$/, "").replace(/-[\d.]+$/, "") + " (all parts)";
  }
  return docid;
}

/** The one-line Metanorma bibliography entry that auto-fetches this record. */
export function fetchEntry(item: RelatonItem, opts: FetchEntryOptions = {}): string {
  const base = primaryDocid(item);
  if (!base) return "";
  const anchor = opts.anchor || slugAnchor(base);
  return `* [[[${anchor},${fetchDocid(base, opts)}]]]`;
}
