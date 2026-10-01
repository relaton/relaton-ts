// Public renderer: relaton item in, citation string out. The style
// instance supplies every rendering decision (port of relaton-render's
// Iso690::Renderer).

import { Style } from "./style.js";
import { I18n } from "./i18n.js";
import { renderReference, renderCitation, type Rec } from "./fields.js";

export interface Iso690Options {
  style?: string;
  lang?: string;
}

export interface CitationOptions extends Iso690Options {
  disambiguator?: string;
}

export function renderIso690Reference(rec: Rec, opts: Iso690Options = {}): string {
  const style = Style.load(opts.style ?? "iso-690");
  const i18n = new I18n(opts.lang ?? "en").overlay(style.scheme.locale ?? {});
  return renderReference(rec, style, i18n);
}

export function renderIso690Citation(rec: Rec, opts: CitationOptions = {}): string {
  const style = Style.load(opts.style ?? "iso-690");
  const i18n = new I18n(opts.lang ?? "en").overlay(style.scheme.locale ?? {});
  return renderCitation(rec, style, i18n, opts.disambiguator ?? "");
}
