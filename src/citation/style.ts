// A citation style as an instance of the relaton-models CitationStyle
// model: scheme (name form, localized strings), citation/reference/name
// templates, per-type template variants selected on the ISO 690 clause 8
// kinds, the pack taxonomy, and named-rule selections. All rendering
// knowledge is data; the engine holds no styles. A pack may `extends` a
// base pack with a delta; the merge is deterministic and mirrors
// relaton-render's Iso690::Style#merge_delta. (Port of relaton-render's
// Iso690::Style.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { Template, field, type Field } from "./template.js";
import { kindFor } from "./kinds.js";

export interface NameForm {
  initials?: boolean;
  givenNameFirst?: boolean;
  surnameUpcase?: boolean;
  invertedAll?: boolean;
  editorsMarked?: boolean;
  etalCount?: number;
  etalDisplay?: number;
  inTextEtalCount?: number;
  inTextEtalDisplay?: number;
  [key: string]: unknown;
}

/** Localized strings: named connectives plus arbitrary label overrides. */
export interface Locale {
  [key: string]: unknown;
  and?: string;
  others?: string;
  noDate?: string;
  noAuthor?: string;
  in?: string;
  at?: string;
  availableAt?: string;
  labels?: Record<string, string>;
  punct?: Record<string, string>;
}

export interface Scheme {
  system?: string;
  shortFromReference?: boolean;
  homeDocidType?: string[];
  defaultKind?: string;
  nameForm?: NameForm;
  locale?: Locale;
}

export interface TemplateMap {
  titleOpen?: string;
  titleClose?: string;
  citation: string;
  reference: string;
  name?: string;
  series?: string;
}

export interface TypeTemplate {
  type: string;
  home?: boolean;
  template?: string;
  short?: string;
  title?: string;
  noPlace?: boolean;
  fallbacks?: Record<string, string>;
}

export interface SortKey {
  attribute: string;
}

/** The named locale attributes' label keys, as in Ruby's LABEL_FOR. */
const LABEL_FOR: Record<keyof Omit<Locale, "labels" | "punct">, string> = {
  and: "and",
  others: "others",
  noDate: "no_date",
  noAuthor: "no_author",
  in: "in",
  at: "at",
  availableAt: "available_from",
};

export interface StyleInstance {
  name?: string;
  family?: string;
  extends?: string;
  requires?: string[];
  scheme?: Scheme;
  templates: TemplateMap;
  perType?: TypeTemplate[];
  types?: Record<string, string>;
  rules?: Record<string, string>;
  sortKey?: SortKey[];
}

const FRESH_NAMEFORM: NameForm = {
  initials: false,
  givenNameFirst: false,
  surnameUpcase: false,
  invertedAll: false,
  editorsMarked: false,
};
const FRESH_TEMPLATES: Partial<TemplateMap> = {
  titleOpen: "_",
  titleClose: "_",
  citation: "",
  reference: "",
  name: "",
  series: "",
};

export class Style {
  readonly name: string;
  readonly family: string;
  scheme: Scheme;
  templates: Partial<TemplateMap>;
  perType: TypeTemplate[];
  types: Record<string, string>;
  rules: Record<string, string>;
  sortKey: SortKey[];
  requires: string[];
  private readonly instance: StyleInstance;

  constructor(instance: StyleInstance) {
    this.instance = instance;
    this.name = instance.name ?? "";
    this.family = instance.family ?? "";
    this.scheme = instance.scheme ?? {};
    this.templates = instance.templates ?? {};
    this.perType = instance.perType ?? [];
    this.types = instance.types ?? {};
    this.rules = instance.rules ?? {};
    this.sortKey = instance.sortKey ?? [];
    this.requires = instance.requires ?? [];
  }

  get extends(): string | undefined {
    return this.instance.extends;
  }

  /** The pack taxonomy first (declared aliases and fallthroughs),
   * then the Kinds table, whose report kind is the fallback. */
  kindFor(type: string | undefined): string {
    const t = this.types[type ?? ""];
    return t ?? kindFor(type);
  }

  /** Per-type selection on the clause 8 kind; home variants split the
   * type when more than one entry carries the same type. */
  templateFor(kind: string, home?: boolean): string {
    return this.typeTemplateFor(kind, home)?.template ??
      this.templates.reference ?? "";
  }

  /** The home split applies to the short cite as it does to the
   * reference template. */
  shortTemplateFor(kind: string, home?: boolean): string | undefined {
    return this.typeTemplateFor(kind, home)?.short;
  }

  /** The absent-slot replacement text declared for a type, when any. */
  fallbackFor(kind: string, slot: string): string | undefined {
    return this.typeTemplateFor(kind)?.fallbacks?.[slot];
  }

  /** The kind's declared title form, when any entry of the kind
   * carries one (a home variant may shadow: the declaring entry wins) */
  titleFormFor(kind: string): string | undefined {
    const declared = this.perType.find(
      (t) => t.type === kind && (t.title ?? "") !== "",
    );
    return declared?.title;
  }

  private typeTemplateFor(kind: string, home?: boolean): TypeTemplate | undefined {
    const candidates = this.perType.filter((t) => t.type === kind);
    // an external item never takes the home pattern: with home
    // variants present, home === false selects the external entry;
    // an undefined home falls back to the first entry of the kind
    if (candidates.length > 1 && home === true) {
      return candidates.find((t) => t.home ?? false);
    }
    if (candidates.length > 1 && home === false) {
      const external = candidates.find((t) => !(t.home ?? false));
      if (external) return external;
    }
    return candidates[0];
  }

  get titleOpen(): string {
    return this.templates.titleOpen ?? "_";
  }

  get titleClose(): string {
    return this.templates.titleClose ?? "_";
  }

  get nameForm(): NameForm {
    return this.scheme.nameForm ?? {};
  }

  /** The named attributes' label map alone: a delta's named attribute
   * (availableAt) outranks the base pack's labels hash carrying the
   * same label key. */
  namedLabelMap(): Record<string, string> {
    const locale = this.scheme.locale ?? {};
    const out: Record<string, string> = {};
    for (const [attr, label] of Object.entries(LABEL_FOR)) {
      const v = (locale as Record<string, unknown>)[attr];
      if (typeof v === "string" && v !== "") out[label] = v;
    }
    return out;
  }

  /** Named attributes merged under the labels hash. */
  labelMap(): Record<string, string> {
    return { ...this.namedLabelMap(), ...(this.scheme.locale?.labels ?? {}) };
  }

  /**
   * First-creator name form: the style's declared name template with
   * the surname upcased, per the name-and-date convention.
   */
  renderName(surname: string, given: string): string {
    const shown = this.nameForm.surnameUpcase ? surname.toUpperCase() : surname;
    const t = new Template(this.templates.name ?? "{{surname}}, {{givenNames}}");
    const fields: Record<string, Field> = {
      surname: field(shown !== "", shown),
      givennames: field(given !== "", given),
    };
    return t.evaluate(fields);
  }

  /**
   * The documented delta merge: perType entries merge per (type, home)
   * key (a delta re-declaring `article` never drops the base's
   * `monograph`); hash sections merge per key; a knob or template at
   * its model default counts as unset and inherits; scalars inherit
   * when unset; sortKey and requires union.
   */
  mergeDelta(base: Style): this {
    const merged = [...base.perType];
    for (const delta of this.perType) {
      const index = merged.findIndex((b) =>
        b.type === delta.type && (b.home ?? false) === (delta.home ?? false),
      );
      if (index >= 0) merged[index] = delta;
      else merged.push(delta);
    }
    (this.perType as TypeTemplate[]) = merged;
    (this.types as Record<string, string>) = { ...base.types, ...this.types };
    (this.rules as Record<string, string>) = { ...base.rules, ...this.rules };

    const scheme = this.scheme;
    const bs = base.scheme ?? {};
    scheme.system = scheme.system || bs.system;
    scheme.shortFromReference = scheme.shortFromReference ?? bs.shortFromReference;
    if (!scheme.homeDocidType?.length) scheme.homeDocidType = bs.homeDocidType;
    scheme.defaultKind = scheme.defaultKind || bs.defaultKind;

    // nameForm: a knob at the model default counts as unset: it inherits
    const nf = (scheme.nameForm = { ...(bs.nameForm ?? {}), ...(scheme.nameForm ?? {}) });
    for (const key of Object.keys(FRESH_NAMEFORM)) {
      if ((nf[key] ?? false) === (FRESH_NAMEFORM as Record<string, unknown>)[key] &&
        (bs.nameForm?.[key] ?? false) !== (FRESH_NAMEFORM as Record<string, unknown>)[key]) {
        nf[key] = bs.nameForm?.[key];
      }
    }

    // locale: named attributes inherit when unset; the labels hash wins
    // per key over the base's label map, and the delta's named
    // attributes assert over the inherited labels afterwards
    const locale = (scheme.locale = { ...(scheme.locale ?? {}) });
    const bl = bs.locale ?? {};
    for (const attr of Object.keys(LABEL_FOR)) {
      const v = (locale as Record<string, unknown>)[attr];
      if (v === undefined) {
        (locale as Record<string, unknown>)[attr] =
          (bl as Record<string, unknown>)[attr];
      }
    }
    const labels: Record<string, string> = { ...(locale.labels ?? {}) };
    // the base's label map is its named attributes merged under its
    // own labels hash, as in Ruby's Locale#label_map
    const baseMap = { ...baseNamedLabelMap(bl), ...(bl.labels ?? {}) };
    for (const [k, v] of Object.entries(baseMap)) {
      if (!(k in labels)) labels[k] = v;
    }
    for (const k of Object.keys(namedFrom(locale))) {
      delete labels[k];
    }
    locale.labels = labels;
    locale.punct = { ...(bl.punct ?? {}), ...(locale.punct ?? {}) };

    // templates: inherit when the delta's is at the model default
    const templates = this.templates;
    for (const key of Object.keys(FRESH_TEMPLATES) as (keyof TemplateMap)[]) {
      const fresh = FRESH_TEMPLATES[key];
      const baseVal = base.templates[key];
      if ((templates[key] ?? fresh) === fresh &&
        (baseVal ?? fresh) !== fresh && baseVal !== undefined) {
        templates[key] = baseVal;
      }
    }

    this.sortKey =
      [...base.sortKey, ...this.sortKey].filter(
        (k, i, a) => a.findIndex((x) => x.attribute === k.attribute) === i,
      );
    this.requires =
      [...base.requires, ...this.requires].filter(
        (r, i, a) => a.indexOf(r) === i,
      );
    return this;
  }

  static load(nameOrPath: string, seen: string[] = []): Style {
    const source = readStyleSource(nameOrPath);
    const style = new Style(parse(source) as StyleInstance);
    const bases = style.extends?.trim() ? style.extends.split(/\s+/).filter(Boolean) : [];
    for (const baseName of bases) {
      if (seen.includes(baseName)) {
        throw new Error(`circular extends ${baseName}`);
      }
      style.mergeDelta(Style.load(baseName, [...seen, baseName]));
    }
    return style;
  }
}

function baseNamedLabelMap(locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [attr, label] of Object.entries(LABEL_FOR)) {
    const v = (locale as Record<string, unknown>)[attr];
    if (typeof v === "string" && v !== "") out[label] = v;
  }
  return out;
}

/** The label keys the locale's own named attributes declare. */
function namedFrom(locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [attr, label] of Object.entries(LABEL_FOR)) {
    const v = (locale as Record<string, unknown>)[attr];
    if (typeof v === "string") out[label] = v;
  }
  return out;
}

function readStyleSource(nameOrPath: string): string {
  if (nameOrPath.includes("/") && nameOrPath.endsWith(".yml")) {
    return readFileSync(nameOrPath, "utf8");
  }
  const dir = join(dirname(fileURLToPath(import.meta.url)), "styles");
  try {
    return readFileSync(join(dir, `${nameOrPath}.yml`), "utf8");
  } catch {
    throw new Error(`unknown style ${nameOrPath}`);
  }
}
