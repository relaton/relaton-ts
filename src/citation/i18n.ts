// Language packs: labels and language-varying punctuation, declarative
// data (the ports of relaton-render's i18n/<lang>.yml). Adding a language
// adds a pack — never code. A style instance's localized strings overlay
// the pack.

export interface LangPack {
  labels: Record<string, string>;
  punct: Record<string, string>;
}

export const PACKS: Record<string, LangPack> = {
  en: {
    labels: {
      edition: "ed",
      series_no: "no.",
      report_no: "Report no.",
      available_from: "Available from:",
      in: "In:",
      and: "and",
      oxford_comma: ",",
      ed: "ed.",
      eds: "eds.",
      date_range: "–",
    },
    punct: {},
  },
  fr: {
    labels: {
      edition: "éd",
      series_no: "n°",
      report_no: "Rapport no.",
      available_from: "Disponible sur :",
      in: "Dans :",
      and: "et",
      oxford_comma: "",
      ed: "éd.",
      eds: "éd.",
      date_range: "–",
    },
    punct: { production_sep: " : " },
  },
  // The port of relaton-render's i18n/ja.yml: the CJK labels, the
  // 第N版 cardinal/ordinal templates the edition cascade consumes, and
  // the CJK punctuation set.
  ja: {
    labels: {
      edition: "版",
      size_volume: "巻",
      size_page: "頁",
      page: "%頁",
      pages: "%頁",
      volume: "巻%",
      issue: "%号",
      version: "版",
      viewed: "閲覧",
      series_no: "番号",
      report_no: "報告番号",
      available_from: "入手先：",
      at_url: "URL：",
      in: "収録：",
      ed: "編",
      eds: "編",
      updated: "更新",
      no_place: "出版地不明",
      edition_cardinal: "第{{ var1 }}版",
      edition_ordinal: "第{{ var1 }}版",
      version_cardinal: "第{{ var1 }}版",
      in_series: "シリーズ",
      list_separator: "、 ",
      and: "",
      oxford_comma: "",
      date_range: "〜",
    },
    punct: {
      "size-join": "",
      "marker-space": "",
      production_sep: "： ",
      "cjk-latin-separator": "、 ",
      period: "。",
      comma: "、",
      colon: "：",
      "open-paren": "（",
      "close-paren": "）",
    },
  },
};

export class I18n {
  private labels: Record<string, string>;
  private punct: Record<string, string>;
  readonly lang: string;

  constructor(lang = "en") {
    const code = !lang ? "en" : lang;
    const pack = PACKS[code];
    if (!pack) throw new Error(`no i18n declarations for language ${code}`);
    this.lang = code;
    this.labels = { ...pack.labels };
    this.punct = { ...pack.punct };
  }

  label(key: string): string {
    return this.labels[key] ?? key;
  }

  punctFetch(key: string, fallback: string): string {
    return this.punct[key] ?? fallback;
  }

  /** Style-instance localized strings win over the language pack: the
   * named connective attributes map to their label keys, then the
   * arbitrary labels and punctuation hashes merge verbatim. */
  overlay(locale: Record<string, unknown>): this {
    const labelFor: Record<string, string> = {
      and: "and",
      others: "others",
      noDate: "no_date",
      noAuthor: "no_author",
      in: "in",
      at: "at",
      availableAt: "available_from",
    };
    for (const [key, label] of Object.entries(labelFor)) {
      const v = locale[key];
      if (typeof v === "string" && v !== "") this.labels[label] = v;
    }
    const labels = locale.labels;
    if (labels && typeof labels === "object") {
      for (const [k, v] of Object.entries(labels as Record<string, unknown>)) {
        if (typeof v === "string") this.labels[k] = v;
      }
    }
    const punct = locale.punct;
    if (punct && typeof punct === "object") {
      for (const [k, v] of Object.entries(punct as Record<string, unknown>)) {
        if (typeof v === "string") this.punct[k] = v;
      }
    }
    return this;
  }
}
