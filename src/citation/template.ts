// A citation template as declared in a style instance: literal text
// interleaved with {{slot}} placeholders resolved against the ISO 690
// data element inventory. A leading literal attaches to the first slot,
// and a literal between two slots to the preceding one, so an absent
// field never orphans punctuation around it. The last rendered slot
// gives up its trailing literal in favour of the template terminator,
// appended once when any field rendered and the output does not already
// end with it. (Port of relaton-render's Iso690::Template.)

export interface Field {
  present: boolean;
  text: string;
}

export function field(present: boolean, text: string): Field {
  return { present, text };
}

const SLOT = /\{\{\s*([\w-]+)\s*\}\}/;

interface Slot {
  name: string;
  head: string;
  tail: string;
}

function normalise(slot: string): string {
  return slot.replace(/_/g, "").toLowerCase();
}

export class Template {
  private slots: Slot[] = [];
  private terminator = "";

  constructor(source: string) {
    this.scan(source ?? "");
  }

  evaluate(fieldsInput: Record<string, Field>): string {
    const rendered: [string, string, string][] = [];
    for (const slot of this.slots) {
      const f = fieldsInput[normalise(slot.name)];
      if (!f || !f.present) continue;
      rendered.push([slot.head, f.text, slot.tail]);
    }
    if (rendered.length === 0) return "";
    let body = "";
    rendered.forEach(([head, text, tail], i) => {
      body += i === rendered.length - 1 ? head + text : head + text + tail;
    });
    return this.terminate(body).trimEnd();
  }

  private terminate(body: string): string {
    const term = this.terminator.trim();
    if (term === "" || body.trimEnd().endsWith(term)) return body;
    return body + this.terminator;
  }

  private scan(source: string): void {
    let rest = source;
    for (;;) {
      const slot = SLOT.exec(rest);
      if (slot === null) break;
      const head = this.slots.length === 0 ? rest.slice(0, slot.index) : "";
      this.slots.push({ name: slot[1] ?? "", head, tail: "" });
      rest = rest.slice(slot.index + slot[0].length);
      const next = rest.match(/\{\{\s*([\w-]+)\s*\}\}/);
      const boundary = next ? next.index ?? rest.length : rest.length;
      const literal = rest.slice(0, boundary);
      const current = this.slots[this.slots.length - 1];
      if (next && current) {
        current.tail = literal;
      } else {
        this.terminator = literal;
      }
      rest = rest.slice(boundary);
    }
  }
}
