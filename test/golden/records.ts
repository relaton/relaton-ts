// Representative records for the golden render corpus: one per SDO house
// style, shaped as Relaton items. The expected renders live beside this file
// in <name>.json and are asserted verbatim by test/golden_render.test.ts.
//
// These are fixtures, not schema examples: the renderers read a loose record
// (see csl.ts/jsonld.ts), so the objects are plain data.

const org = (name: string) => ({
  organization: { name: [{ content: name }] },
  role: [{ type: "publisher" }],
});

const title = (content: string) => [
  { content, language: "en", script: "Latn", type: "main" },
];

export const RECORDS: Record<string, Record<string, unknown>> = {
  iso: {
    docidentifier: [{ content: "ISO 9001:2015", type: "ISO", primary: true }],
    title: title("Quality management systems — Requirements"),
    date: [{ type: "published", at: "2015-09-15" }],
    contributor: [org("International Organization for Standardization")],
    edition: "5",
  },

  iec: {
    docidentifier: [{ content: "IEC 61000-4-2:2008", type: "IEC", primary: true }],
    title: title(
      "Electromagnetic compatibility (EMC) — Part 4-2: Testing and measurement techniques — Electrostatic discharge immunity test",
    ),
    date: [{ type: "published", at: "2008-12" }],
    contributor: [org("International Electrotechnical Commission")],
  },

  ieee: {
    docidentifier: [{ content: "IEEE 802.3-2018", type: "IEEE", primary: true }],
    title: title("IEEE Standard for Ethernet"),
    date: [{ type: "published", at: "2018-06-14" }],
    contributor: [org("Institute of Electrical and Electronics Engineers")],
  },

  itu: {
    docidentifier: [{ content: "ITU-T G.9960 (2018-06)", type: "ITU", primary: true }],
    title: title(
      "Unified high-speed wireline-based home networking transceivers — System architecture and physical layer specification",
    ),
    date: [{ type: "published", at: "2018-06" }],
    contributor: [org("International Telecommunication Union")],
  },

  nist: {
    docidentifier: [{ content: "NIST SP 800-53 Rev. 5", type: "NIST", primary: true }],
    title: title(
      "Security and Privacy Controls for Information Systems and Organizations",
    ),
    date: [{ type: "published", at: "2020-09" }],
    contributor: [org("National Institute of Standards and Technology")],
  },

  ietf: {
    docidentifier: [{ content: "RFC 9110", type: "IETF", primary: true }],
    title: title("HTTP Semantics"),
    date: [{ type: "published", at: "2022-06" }],
    contributor: [
      { person: { name: { given: "Roy", surname: "Fielding" } }, role: [{ type: "author" }] },
      { person: { name: { given: "Mark", surname: "Nottingham" } }, role: [{ type: "author" }] },
      { person: { name: { given: "Julian", surname: "Reschke" } }, role: [{ type: "author" }] },
      org("RFC Editor"),
    ],
  },
};
