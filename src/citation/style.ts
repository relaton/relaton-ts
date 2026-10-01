// A citation style as an instance of the relaton-models CitationStyle
// model: scheme (name form, localized strings), citation/reference/name
// templates, and per-type template variants selected on the ISO 690
// clause 8 kinds. All rendering knowledge is data; the engine holds no
// styles. (Port of relaton-render's Iso690::Style.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { Template, field, type Field } from "./template.js";

export interface NameForm {
  initials?: boolean;
  givenNameFirst?: boolean;
}

export interface Scheme {
  system?: string;
  nameForm?: NameForm;
  locale?: Record<string, string>;
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
  template: string;
}

export interface StyleInstance {
  name?: string;
  scheme?: Scheme;
  templates: TemplateMap;
  perType?: TypeTemplate[];
}

export class Style {
  readonly name: string;
  readonly scheme: Scheme;
  readonly templates: TemplateMap;
  private perType: TypeTemplate[];

  constructor(instance: StyleInstance) {
    this.name = instance.name ?? "";
    this.scheme = instance.scheme ?? {};
    this.templates = instance.templates;
    this.perType = instance.perType ?? [];
  }

  /** Per-type selection is a data lookup on the clause 8 kind. */
  templateFor(kind: string): string {
    return this.perType.find((t) => t.type === kind)?.template ??
      this.templates.reference;
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

  /**
   * First-creator name form: the style's declared name template with the
   * surname upcased, per the name-and-date convention.
   */
  renderName(surname: string, given: string): string {
    const t = new Template(this.templates.name ?? "{{surname}}, {{givenNames}}");
    const fields: Record<string, Field> = {
      surname: field(surname !== "", surname.toUpperCase()),
      givennames: field(given !== "", given),
    };
    return t.evaluate(fields);
  }

  static load(nameOrPath: string): Style {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "styles");
    const file = join(dir, `${nameOrPath}.yml`);
    let source: string;
    if (typeof nameOrPath === "string" && nameOrPath.includes("/") &&
        nameOrPath.endsWith(".yml")) {
      source = readFileSync(nameOrPath, "utf8");
    } else {
      try {
        source = readFileSync(file, "utf8");
      } catch {
        throw new Error(`unknown style ${nameOrPath}`);
      }
    }
    const parsed = parse(source) as StyleInstance;
    return new Style(parsed);
  }
}
