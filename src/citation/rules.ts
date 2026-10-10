// The named-rule registry: presentation-of-models implementations the
// engine ships once, addressable from pack data as rules: { slot: name }.
// The mirror of relaton-render's Iso690::Rules — a pack's rule selections
// override the default slot builders in fields.ts.

import { field, type Field } from "./template.js";
export function contentOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(contentOf).find(Boolean) ?? "";
  if (typeof v === "object" && v !== null) {
    const c = (v as Record<string, unknown>).content;
    if (typeof c === "string") return c;
  }
  return "";
}

export interface RuleContext {
  rec: RuleRec;
  style: { kindFor(type?: string): string };
  i18n: { label(key: string): string; punctFetch(key: string, fallback: string): string };
  hasRole(c: RuleContributor, role: string): boolean;
  contributors(role: string): RuleContributor[];
}

export type SlotRenderer = (c: RuleContext) => Field | undefined;
// undefined defers to the default slot builder
export type SlotOverrides = Partial<Record<string, SlotRenderer>>;

export interface RuleRec {
  type?: string;
  docidentifier?: { content?: unknown; type?: string; scope?: string }[];
  title?: { content?: unknown; type?: string; language?: string }[];
  date?: { type?: string; at?: unknown; from?: unknown; to?: unknown; on?: unknown }[];
  contributor?: RuleContributor[];
  edition?: unknown;
  docnumber?: unknown;
  series?: {
    title?: unknown;
    number?: unknown;
    partnumber?: unknown;
    abbreviation?: unknown;
    formattedref?: unknown;
  }[];
  medium?: { carrier?: unknown; genre?: unknown; form?: unknown; size?: unknown };
  place?: { city?: unknown; formattedPlace?: unknown }[];
  extent?: { locality?: { type?: string; referenceFrom?: unknown; referenceTo?: unknown }[] }[];
  size?: unknown;
  status?: { stage?: { content?: unknown }; iteration?: unknown };
  relation?: { type?: string; description?: unknown; bibitem?: RuleRec }[];
}

export interface RuleContributor {
  role?: { type?: string }[] | string[];
  person?: {
    name?: { completename?: unknown; given?: unknown; forename?: unknown; surname?: unknown };
    affiliation?: { organization?: { name?: unknown }[] }[];
  };
  organization?: { name?: unknown; abbreviation?: unknown };
}

export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function personSurname(person: NonNullable<RuleContributor["person"]>): string {
  return contentOf(person.name?.surname);
}

function personGiven(person: NonNullable<RuleContributor["person"]>): string {
  const forenames = asArray(person.name?.forename).map(contentOf);
  const given = contentOf(person.name?.given);
  return forenames.filter(Boolean).join(" ") || given;
}

function joinNames(c: RuleContext, names: string[]): string {
  const and = c.i18n.label("and");
  if (and === "" && names.length > 1) {
    const sep = c.i18n.label("list_separator");
    return names.join(sep === "list_separator" ? ", " : sep);
  }
  return names.join(", ");
}

function localized(v: unknown): string {
  return contentOf(v);
}

function hostRelation(c: RuleContext) {
  return asArray(c.rec.relation).find(
    (r) => r.type === "partOf" || r.type === "includedIn",
  );
}

function hostContributors(c: RuleContext, role: string): RuleContributor[] {
  const h = hostRelation(c)?.bibitem;
  if (!h) return [];
  return asArray(h.contributor).filter((x) => c.hasRole(x, role));
}

const NIST_AND_ABBREV = ["NIST", "National Institute of Standards and Technology"];

function nistPublisher(c: RuleContext): boolean {
  if (asArray(c.rec.docidentifier).some((d) => (d.type ?? "").startsWith("NIST"))) {
    return true;
  }
  return c.contributors("publisher").some((x) => {
    const org = x.organization ?? {};
    const names = asArray(org.name).map(contentOf);
    return names.some((n) => NIST_AND_ABBREV.includes(n as string)) ||
      contentOf(org.abbreviation) === "NIST";
  });
}

const STAGE_PRINT: Record<string, string> = {
  "draft-internal": "Internal Draft",
  "draft-wip": "Work-in-Progress Draft",
  "draft-prelim": "Preliminary Draft",
  "draft-public": "Public Draft",
  "draft-approval": "Approval Draft",
  "final": "Final",
  "final-review": "Under Review",
};

function ordinalWord(c: RuleContext, n: number): string {
  const w = c.i18n.label(`ordinal_word_${n}`);
  if (w !== `ordinal_word_${n}`) return w.charAt(0).toUpperCase() + w.slice(1);
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const IEEE_HOME_PUBLISHERS = [
  "International Organization for Standardization", "ISO",
  "International Electrotechnical Commission", "IEC",
  "Institute of Electrical and Electronics Engineers", "IEEE",
];

function ieeeHomePublisher(c: RuleContext): boolean {
  return asArray(c.rec.contributor).some((x) => {
    if (!c.hasRole(x, "publisher")) return false;
    const names = asArray(x.organization?.name).map(contentOf);
    return names.some((n) => IEEE_HOME_PUBLISHERS.includes(n as string));
  });
}

const IHO_HOME_PUBLISHERS = ["IHO", "International Hydrographic Organization"];

// --- the rules ---

const statusBare: SlotOverrides = {
  status: (c) => {
    const stage = contentOf(c.rec.status?.stage?.content);
    return stage === "" ? field(false, "") : field(true, stage);
  },
};

const ituIdentifier: SlotOverrides = {
  identifier: (c) => {
    const ids = asArray(c.rec.docidentifier).filter(
      (d) => contentOf(d).trim() !== "" && (d.scope ?? "") === "",
    );
    const text = ids
      .map((d) =>
        ["ISBN", "ISSN"].includes(d.type ?? "")
          ? `${d.type}: ${contentOf(d)}`
          : contentOf(d),
      )
      .join(". ");
    return text === "" ? field(false, "") : field(true, text);
  },
};

const ieeeIdentifier: SlotOverrides = {
  identifier: (c) => {
    if (ieeeHomePublisher(c)) return field(false, "");
    const ids = asArray(c.rec.docidentifier).filter(
      (d) => contentOf(d).trim() !== "" && (d.scope ?? "") === "",
    );
    const text = ids
      .slice(0, 1)
      .map((d) =>
        ["DOI", "ISBN"].includes(d.type ?? "")
          ? `${d.type}: ${contentOf(d)}`
          : contentOf(d),
      )
      .join(". ");
    return text === "" ? field(false, "") : field(true, text);
  },
};

const ieeeComponentPart: SlotOverrides = {
  componentpart: (c) => {
    const h = hostRelation(c)?.bibitem;
    if (!h) return field(false, "");
    const eds = hostContributors(c, "editor");
    const names = eds.map((e, i) => {
      const p = e.person;
      if (!p) return "";
      const surname = personSurname(p);
      const given = personGiven(p);
      if (i === 0) return [surname, given].filter(Boolean).join(", ");
      return [given, surname].filter(Boolean).join(" ");
    }).filter(Boolean);
    const hostTitle = asArray(h.title).map(contentOf).filter(Boolean).join(" ").trim();
    if (hostTitle === "" && names.length === 0) return field(false, "");
    let out = `in ${joinNames(c, names)} (${c.i18n.label(eds.length === 1 ? "ed" : "eds")}): `;
    out += `${c.style ? "" : ""}${hostTitle}`;
    return field(true, out.trim());
  },
};

const ieeeAccess: SlotOverrides = {
  location: (c) => {
    const accessed = asArray(c.rec.date).find((d) => d.type === "accessed");
    if (!accessed) return field(false, "");
    return field(true, `${c.i18n.label("viewed")} ${contentOf(accessed.at ?? accessed.from)}`);
  },
};

const ieeeMedium: SlotOverrides = {
  medium: (c) => {
    const m = c.rec.medium;
    if (!m) return field(false, "");
    let text = contentOf(m.carrier) || contentOf(m.genre);
    if (text === "") {
      text = [contentOf(m.form), contentOf(m.size)].filter(Boolean).join(", ");
    }
    return text === "" ? field(false, "")
      : field(true, `${text.charAt(0).toUpperCase()}${text.slice(1)},`);
  },
};

const ihoCreator: SlotOverrides = {
  creator: (c) => {
    const affs = c.contributors("author").map((x) => {
      const p = x.person;
      if (!p) return "";
      return asArray(p.affiliation)
        .map((a) => asArray(a.organization).map((o) => asArray(o.name).map(contentOf).find(Boolean) ?? ""))
        .flat().filter(Boolean)[0] ?? "";
    }).filter(Boolean);
    return affs.length === 0 ? field(false, "") : field(true, affs.join(", "));
  },
};

const ihoEdition: SlotOverrides = {
  edition: (c) => {
    const iho = asArray(c.rec.contributor).some((x) => {
      if (!c.hasRole(x, "publisher")) return false;
      const names = [...asArray(x.organization?.name).map(contentOf), contentOf(x.organization?.abbreviation)];
      return names.some((n) => IHO_HOME_PUBLISHERS.includes(n as string));
    });
    if (!iho) return field(false, "");
    const text = contentOf(c.rec.edition);
    return /^\d/.test(text) ? field(true, ` edition ${text}`) : field(false, "");
  },
};

const jisComponentPart: SlotOverrides = {
  componentpart: (c) => {
    const h = hostRelation(c)?.bibitem;
    if (!h) return field(false, "");
    const hostTitle = asArray(h.title).map(contentOf).filter(Boolean).join(" ").trim();
    if (hostTitle === "") return field(false, "");
    const author = asArray(h.contributor).find((x) => c.hasRole(x, "author"));
    let creators = "";
    if (author) {
      const p = author.person;
      creators = p
        ? [personSurname(p), personGiven(p)].filter(Boolean).join(" ")
        : asArray(author.organization?.name).map(localized).filter(Boolean).join(", ");
    }
    return field(true, `${hostTitle} ${creators}${c.i18n.punctFetch("close-paren", ")")}`.trim());
  },
};

const jisSeries: SlotOverrides = {
  series: (c) => {
    // a part with its own series keeps the default builder
    if (asArray(c.rec.series)[0]) return undefined;
    const hostSeries = asArray(hostRelation(c)?.bibitem?.series)[0];
    if (!hostSeries) return field(false, "");
    const t = asArray(hostSeries.title).map(contentOf).filter(Boolean).join(" ");
    return t === "" ? field(false, "") : field(true, t);
  },
};

const jisExtent: SlotOverrides = {
  extent: (c) => {
    const bookFamily = ["book", "inbook", "incollection", "inproceedings", "proceedings"];
    // outside the book family the default builder stands
    if (!bookFamily.includes(c.rec.type ?? "")) return undefined;
    const locs = asArray(asArray(c.rec.extent)[0]?.locality);
    const pick = (type: string) => [...locs].reverse().find((l) => l.type === type);
    const vol = pick("volume");
    const pg = pick("page");
    const parts: string[] = [];
    if (vol && contentOf(vol.referenceFrom) !== "") parts.push(`vol. ${contentOf(vol.referenceFrom)}`);
    if (pg) {
      const from = contentOf(pg.referenceFrom);
      const to = contentOf(pg.referenceTo);
      parts.push(
        to === "" || to === from ? `p. ${from}` : `pp. ${from}${c.i18n.label("date_range")}${to}`,
      );
    }
    return parts.length === 0 ? field(false, "") : field(true, parts.join(" "));
  },
};

export const REGISTRY: Record<string, SlotOverrides> = {
  status_bare: statusBare,
  itu_identifier: ituIdentifier,
  ieee_identifier: ieeeIdentifier,
  ieee_component_part: ieeeComponentPart,
  ieee_access: ieeeAccess,
  ieee_medium: ieeeMedium,
  iho_creator: ihoCreator,
  iho_edition: ihoEdition,
  jis_component_part: jisComponentPart,
  jis_series: jisSeries,
  jis_extent: jisExtent,
};

export function resolveRules(
  selections: Record<string, string> | undefined,
): SlotOverrides {
  const out: SlotOverrides = {};
  for (const [slot, name] of Object.entries(selections ?? {})) {
    const overrides = REGISTRY[name];
    if (!overrides) {
      throw new Error(`unknown citation style rule ${name}`);
    }
    for (const [s, fn] of Object.entries(overrides)) {
      (out as Record<string, SlotRenderer>)[s === slot ? slot : s] = fn as SlotRenderer;
    }
  }
  return out;
}
