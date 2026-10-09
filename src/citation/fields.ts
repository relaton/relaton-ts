// Field resolver: builds the template evaluator's field table from a
// relaton item — the ISO 690 clause 7 data elements (creator, title,
// edition, medium, series, production, date, numeration, componentPart,
// identifier, location), the name-form fields of the principal creator
// (surname, givenNames), and the disambiguator supplied by the caller.
// (Port of relaton-render's Iso690::Fields and Elements.)

import { field, Template, type Field } from "./template.js";
import { kindFor } from "./kinds.js";
import type { Style } from "./style.js";
import type { I18n } from "./i18n.js";

export interface Rec {
  type?: string;
  docidentifier?: { content?: unknown; type?: string; primary?: boolean }[];
  title?: { content?: unknown; type?: string; language?: string }[];
  date?: { type?: string; at?: unknown; from?: unknown; to?: unknown; on?: unknown }[];
  contributor?: {
    role?: { type?: string }[] | string[];
    person?: { name?: { completename?: unknown; given?: unknown; forename?: unknown; surname?: unknown } };
    organization?: { name?: unknown; abbreviation?: unknown };
  }[];
  edition?: unknown;
  series?: { title?: unknown; number?: unknown }[];
  medium?: unknown;
  place?: { city?: unknown }[];
  accesslocation?: unknown;
  docnumber?: unknown;
  relation?: { type?: string; description?: unknown; bibitem?: Rec }[];
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function contentOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(contentOf).find(Boolean) ?? "";
  if (typeof v === "object" && v !== null) {
    const c = (v as Record<string, unknown>).content;
    if (c !== undefined) return contentOf(c);
  }
  return "";
}

const INTERNAL_IDENTIFIER_TYPES = ["metanorma", "metanorma-ordinal", "metanorma-objid"];

const IDENTIFIER_KINDS: Record<string, (content: string) => string> = {
  DOI: (c) => `https://doi.org/${c}`,
  ISBN: (c) => `ISBN ${c}`,
  ISSN: (c) => `ISSN ${c}`,
  URN: (c) => c,
  MRN: (c) => c,
};

class Ctx {
  constructor(
    readonly rec: Rec,
    readonly style: Style,
    readonly i18n: I18n,
  ) {}

  hasRole(c: NonNullable<Rec["contributor"]>[number], role: string): boolean {
    const roles = (Array.isArray(c.role) ? c.role : c.role ? [c.role] : [])
      .map((r) => (typeof r === "string" ? r : r?.type ?? ""));
    return roles.includes(role);
  }

  contributors(role: string) {
    return asArray(this.rec.contributor).filter((c) => this.hasRole(c, role));
  }

  /** Person given names: the forename sequence, or a given string. */
  givenOf(person: NonNullable<NonNullable<Rec["contributor"]>[number]["person"]>): string {
    const name = person.name ?? {};
    const forenames = asArray(name.forename as unknown).map(contentOf)
      .filter(Boolean);
    if (forenames.length > 0) {
      if (this.style.nameForm.initials) {
        return forenames.map((n) => `${n[0]?.toUpperCase()}.`).join(" ");
      }
      return forenames.join(" ");
    }
    const given = contentOf(name.given);
    if (given !== "" && this.style.nameForm.initials) {
      return given.split(/\s+/).filter(Boolean)
        .map((w) => `${w[0]?.toUpperCase()}.`).join(" ");
    }
    return given;
  }

  surnameOf(person: NonNullable<NonNullable<Rec["contributor"]>[number]["person"]>): string {
    return contentOf((person.name ?? {}).surname);
  }

  completenameOf(person: NonNullable<NonNullable<Rec["contributor"]>[number]["person"]>): string {
    return contentOf((person.name ?? {}).completename);
  }

  orgName(c: NonNullable<Rec["contributor"]>[number]): string {
    const org = c.organization ?? {};
    const name = asArray(org.name).map((n) => contentOf(n).toUpperCase())
      .filter(Boolean).join(", ");
    const abbrev = contentOf(org.abbreviation);
    if (name === "" || abbrev === "") return name;
    return `${name} (${abbrev})`;
  }
}

class CreatorElement {
  private ctx: Ctx;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  get present(): boolean {
    return this.creators.length > 0;
  }

  private get creators() {
    let found = this.ctx.contributors("author");
    if (found.length === 0) found = this.ctx.contributors("editor");
    return found;
  }

  render(): string {
    const names = this.creators.map((c, i) => this.format(c, i === 0));
    return this.join(names.filter(Boolean)) + this.roleSuffix();
  }

  inText(): string {
    const principal = this.creators[0];
    if (!principal) return "";
    const person = principal.person;
    if (!person) return this.ctx.orgName(principal);
    const complete = this.ctx.completenameOf(person);
    if (complete) return complete;
    const surname = this.ctx.surnameOf(person);
    return surname !== "" ? surname.toUpperCase() : "";
  }

  /** The principal creator's given names, as the name form declares. */
  principalGiven(): string {
    const principal = this.creators[0];
    if (!principal?.person) return "";
    const complete = this.ctx.completenameOf(principal.person);
    if (complete) return "";
    return this.ctx.givenOf(principal.person);
  }

  private format(c: NonNullable<Rec["contributor"]>[number], first: boolean): string {
    const person = c.person;
    if (!person) return this.ctx.orgName(c);
    const complete = this.ctx.completenameOf(person);
    if (complete) return complete;
    const surname = this.ctx.surnameOf(person);
    const given = this.ctx.givenOf(person);
    let name: string;
    if (first && !this.ctx.style.nameForm.givenNameFirst) {
      name = this.ctx.style.renderName(surname, given);
    } else {
      name = [given, surname.toUpperCase()].filter(Boolean).join(" ");
    }
    return name === "" ? this.ctx.orgName(c) : name;
  }

  private join(names: string[]): string {
    const and = this.ctx.i18n.label("and");
    if (names.length === 0) return "";
    if (names.length === 1) return names[0] ?? "";
    if (names.length === 2) return names.join(` ${and} `);
    const oxford = this.ctx.i18n.label("oxford_comma");
    const last = names[names.length - 1] ?? "";
    return `${names.slice(0, -1).join(", ")}${oxford} ${and} ${last}`;
  }

  private roleSuffix(): string {
    const creators = this.creators;
    if (creators.length === 0) return "";
    const allEditors = creators.every((c) => this.ctx.hasRole(c, "editor"));
    if (!allEditors) return "";
    const suffix = creators.length === 1
      ? this.ctx.i18n.label("ed")
      : this.ctx.i18n.label("eds");
    return ` (${suffix})`;
  }
}

function titleOf(ctx: Ctx): string {
  const titles = asArray(ctx.rec.title).filter((t) => contentOf(t) !== "");
  // one citation language: English preferred, else first seen
  const langOf = (t: { language?: string }) => (t.language ?? "").toLowerCase();
  const langs = [...new Set(titles.map(langOf).filter(Boolean))];
  const lang = langs.includes("en") ? "en" : langs[0] ?? "";
  const ours = lang !== "" ? titles.filter((t) => langOf(t) === lang) : titles;

  // decomposed titles (intro/main/part) compose; a lone composite
  // type:"main" stands alone; otherwise the first title
  const intro = ours.find((t) => t.type === "title-intro");
  const main = ours.find((t) => t.type === "title-main");
  const part = ours.find((t) => t.type === "title-part");
  if (intro || main) {
    return [intro, main, part].filter(Boolean).map(contentOf).join(" — ");
  }
  const composite = ours.find((t) => (t.type ?? "main") === "main");
  return contentOf(composite ?? ours[0]);
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function yearOfDate(d: { at?: unknown; from?: unknown; to?: unknown; on?: unknown }): string {
  const raw = contentOf(d.at) || contentOf(d.from) || contentOf(d.on) ||
    contentOf(d.to);
  return raw.match(/\d{4}/)?.[0] ?? "";
}

function buildFields(ctx: Ctx, disambiguator: string): Record<string, Field> {
  const i18n = ctx.i18n;
  const style = ctx.style;
  const rec = ctx.rec;

  const creator = new CreatorElement(ctx);
  const creatorText = creator.render();

  const titles = asArray(rec.title);
  const mainTitle = titleOf(ctx);
  const title = mainTitle === ""
    ? field(false, "")
    : field(true, `${style.titleOpen}${mainTitle}${style.titleClose}`);

  const editionNum = parseInt(contentOf(rec.edition), 10);
  const edition = Number.isNaN(editionNum) || editionNum === 0
    ? field(false, "")
    : field(true, `${ordinal(editionNum)} ${i18n.label("edition")}`);

  const mediumText = contentOf(rec.medium);
  const medium = mediumText === "" ? field(false, "") : field(true, `[${mediumText}]`);

  const seriesRec = asArray(rec.series)[0];
  let series = field(false, "");
  if (seriesRec) {
    const seriesTitle = asArray(seriesRec.title).map(contentOf).filter(Boolean)
      .join(" ").trim();
    if (seriesTitle !== "") {
      const number = contentOf(seriesRec.number);
      const base = `${style.titleOpen}${seriesTitle}${style.titleClose}`;
      series = field(
        true,
        number === "" ? base : `${base}, ${i18n.label("series_no")} ${number}`,
      );
    }
  }

  const places = asArray(rec.place).map((p) => contentOf(p.city))
    .filter((c) => c.trim() !== "");
  const publishers = ctx.contributors("publisher").map((c) => {
    const org = c.organization ?? {};
    return asArray(org.name).map((n) => contentOf(n)).filter(Boolean).join(", ");
  }).filter(Boolean);
  const productionText = [
    places.join("; "),
    publishers.join("; "),
  ].filter(Boolean).join(i18n.punctFetch("production_sep", ": "));
  const production = productionText === "" ? field(false, "") : field(true, productionText);

  const dates = asArray(rec.date);
  const published = dates.find((d) => d.type === "published" || d.type === "issued") ??
    dates.find((d) => d.type === undefined || d.type === "");
  let date = field(false, "");
  if (published) {
    const dash = i18n.label("date_range");
    if (contentOf(published.from) !== "" && contentOf(published.to) !== "") {
      date = field(true, `${yearOfDate(published)}${dash}${yearOfDate({ to: published.to })}`);
    } else if (contentOf(published.from) !== "") {
      date = field(true, `${yearOfDate(published)}${dash}`);
    } else {
      const y = yearOfDate(published);
      date = y === "" ? field(false, "") : field(true, y);
    }
  }

  const numerationText = contentOf(rec.docnumber);
  const numeration = numerationText === ""
    ? field(false, "")
    : field(true, `${i18n.label("report_no")} ${numerationText}`);

  const identifiers = asArray(rec.docidentifier).filter((d) => {
    const type = d.type ?? "";
    if (INTERNAL_IDENTIFIER_TYPES.includes(type)) return false;
    return contentOf(d).trim() !== "";
  });
  const identifierText = identifiers
    .map((d) => {
      const content = contentOf(d);
      const kind = IDENTIFIER_KINDS[d.type ?? ""];
      return kind ? kind(content) : content;
    })
    .join(". ");
  const identifier = identifierText === "" ? field(false, "") : field(true, identifierText);

  const uri = asArray(rec.accesslocation).map(contentOf).find(Boolean) ?? "";
  const location = uri === ""
    ? field(false, "")
    : field(true, `${i18n.label("available_from")} ${uri}`);

  let componentPart = field(false, "");
  const partOf = asArray(rec.relation).find((r) => r.type === "partOf");
  if (partOf) {
    const hostTitle = partOf.bibitem
      ? asArray(partOf.bibitem.title).map(contentOf).filter(Boolean).join(" ").trim()
      : contentOf(partOf.description);
    if (hostTitle !== "") {
      let text = `${i18n.label("in")} ${style.titleOpen}${hostTitle}${style.titleClose}`;
      if (partOf.bibitem) {
        const hostEditionNum = parseInt(contentOf(partOf.bibitem.edition), 10);
        if (!Number.isNaN(hostEditionNum) && hostEditionNum !== 0) {
          text += `. ${ordinal(hostEditionNum)} ${i18n.label("edition")}`;
        }
      }
      componentPart = field(true, text);
    }
  }

  const surname = creator.inText();
  const given = creator.principalGiven();

  return {
    creator: field(creator.present && creatorText !== "", creatorText),
    title,
    edition,
    medium,
    series,
    production,
    date,
    numeration,
    componentpart: componentPart,
    identifier,
    location,
    surname: field(surname !== "", surname),
    givennames: field(given !== "", given),
    disambiguator: field(disambiguator !== "", disambiguator),
  };
}

export interface RenderOptions {
  style?: string;
  lang?: string;
  disambiguator?: string;
}

export function renderReference(
  rec: Rec,
  style: Style,
  i18n: I18n,
): string {
  const fields = buildFields(new Ctx(rec, style, i18n), "");
  const out = new Template(style.templateFor(kindName(rec))).evaluate(fields);
  if (out.trim() === "") {
    throw new Error("no renderable elements");
  }
  return out;
}

export function renderCitation(
  rec: Rec,
  style: Style,
  i18n: I18n,
  disambiguator = "",
): string {
  const fields = buildFields(new Ctx(rec, style, i18n), disambiguator);
  return new Template(style.templates.citation ?? "").evaluate(fields);
}

function kindName(rec: Rec): string {
  return kindFor(rec.type);
}

export { Template, field };
export type { Field };
