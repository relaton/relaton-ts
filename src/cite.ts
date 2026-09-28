// Metanorma citation utilities: the fetch entry (the one-line
// `* [[[anchor,DOCID]]]` bibliography form Metanorma auto-fetches at build
// time) and PubID resolution checks, backed by pubid-ts. The anchor is
// always the user's choice; the default derives from the docid.

import * as pubidTs from "pubid-ts";

// pubid-ts@0.1.0 (published) predates `parse`; newer builds carry it. The
// check degrades to "assume resolvable" when the parser is unavailable.
const parsePubid = (pubidTs as { parse?: (code: string) => unknown }).parse;
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
export function isResolvablePubid(code: string): boolean {
  if (typeof parsePubid !== "function") return true;
  return parsePubid(code) !== null;
}

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
