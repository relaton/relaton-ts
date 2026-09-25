/**
 * Generates zod schemas + TS types from the JSON Schema artifacts exported
 * by tools/export_schema.rb (the lutaml-model definitions in relaton/relaton).
 * Hand-editing src/generated/* is pointless — rerun `npm run generate`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const MANIFEST = z.object({
  source: z.string(),
  ref: z.string(),
  lutaml_model_version: z.string(),
  roots: z.array(z.string()),
});
type Manifest = z.infer<typeof MANIFEST>;

type JsonSchemaNode = {
  $ref?: string;
  type?: string | string[];
  enum?: string[];
  properties?: Record<string, JsonSchemaNode>;
  additionalProperties?: boolean | JsonSchemaNode;
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  required?: string[];
  format?: string;
};

function defName(defKey: string): string {
  const body = defKey.replace(/^Relaton_/, "");
  return body
    .split("_")
    .map((seg) => seg[0].toUpperCase() + seg.slice(1))
    .join("");
}

function refName(ref: string): string {
  return defName(ref.replace("#/$defs/", ""));
}

function genNode(
  node: JsonSchemaNode,
  defs: Record<string, JsonSchemaNode>,
  indent: string,
): string {
  if (node.$ref) return `z.lazy(() => ${refName(node.$ref)})`;

  const types = Array.isArray(node.type) ? node.type : [node.type];
  const nullable = types.includes("null");
  const base = types.filter((t) => t !== "null")[0];
  let out: string;

  if (node.enum) {
    if (node.enum.length === 0) throw new Error("empty enum in schema");
    out = `z.enum([${node.enum.map((e) => JSON.stringify(e)).join(", ")}])`;
  } else if (node.anyOf) {
    out = `z.union([${node.anyOf.map((n) => genNode(n, defs, indent)).join(", ")}])`;
  } else if (base === "object") {
    if (node.properties) {
      const required = new Set(node.required ?? []);
      const props = Object.entries(node.properties).map(([key, sub]) => {
        const expr = genNode(sub, defs, indent + "  ");
        return `${indent}  ${JSON.stringify(key)}: ${required.has(key) ? expr : expr + ".optional()"}`;
      });
      out = `z.object({\n${props.join(",\n")}\n${indent}}).strict()`;
    } else if (node.additionalProperties && typeof node.additionalProperties === "object") {
      out = `z.record(${genNode(node.additionalProperties, defs, indent)})`;
    } else {
      out = `z.record(z.unknown())`;
    }
  } else if (base === "array") {
    out = `z.array(${genNode(node.items ?? {}, defs, indent)})`;
  } else if (base === "string") {
    out = `z.string()`;
  } else if (base === "integer") {
    out = `z.number().int()`;
  } else if (base === "number") {
    out = `z.number()`;
  } else if (base === "boolean") {
    out = `z.boolean()`;
  } else {
    out = `z.unknown()`;
  }

  return nullable ? `${out}.nullable()` : out;
}

function genType(node: JsonSchemaNode, defs: Record<string, JsonSchemaNode>): string {
  if (node.$ref) return refName(node.$ref);

  const types = Array.isArray(node.type) ? node.type : [node.type];
  const nullable = types.includes("null");
  const base = types.filter((t) => t !== "null")[0];
  let out: string;

  if (node.enum) {
    out = node.enum.map((e) => JSON.stringify(e)).join(" | ") || "never";
  } else if (node.anyOf) {
    out = node.anyOf.map((n) => genType(n, defs)).join(" | ");
  } else if (base === "object") {
    if (node.properties) {
      const required = new Set(node.required ?? []);
      const lines = Object.entries(node.properties).map(([key, sub]) => {
        const t = genType(sub, defs);
        return `  ${JSON.stringify(key)}${required.has(key) ? "" : "?"}: ${t};`;
      });
      out = `{\n${lines.join("\n")}\n}`;
    } else if (node.additionalProperties && typeof node.additionalProperties === "object") {
      out = `{ [key: string]: ${genType(node.additionalProperties, defs)} }`;
    } else {
      out = "{ [key: string]: unknown }";
    }
  } else if (base === "array") {
    const item = genType(node.items ?? {}, defs);
    out = item.includes(" ") ? `(${item})[]` : `${item}[]`;
  } else if (base === "string") {
    out = "string";
  } else if (base === "integer" || base === "number") {
    out = "number";
  } else if (base === "boolean") {
    out = "boolean";
  } else {
    out = "unknown";
  }

  return nullable ? `${out} | null` : out;
}

function genModule(schemaPath: string): { module: string; rootName: string } {
  const schema = JSON.parse(
    readFileSync(schemaPath, "utf8"),
  ) as JsonSchemaNode;
  const defs = schema.$defs ?? {};
  if (!schema.$ref) throw new Error(`${schemaPath} has no root $ref`);
  const rootName = refName(schema.$ref);

  // The recursive-zod pattern with structural interfaces: interfaces may
  // reference each other (and themselves) freely, while the zod values are
  // lazy and annotated with the interface — so no const/alias circularity.
  const entries = Object.entries(defs).map(([key, def]) => {
    const name = defName(key);
    return [
      `export interface ${name} ${genType(def, defs)}`,
      ``,
      `export const ${name}: z.ZodType<${name}> = z.lazy(() =>`,
      `  ${genNode(def, defs, "  ")});`,
    ].join("\n");
  });

  const header = [
    "/* eslint-disable */",
    `// Generated from ${schemaPath} — do not edit; rerun \`npm run generate\`.`,
    "// Source: relaton/relaton lutaml-model definitions.",
    'import { z } from "zod";',
    "",
  ];

  return { module: [...header, ...entries].join("\n\n") + "\n", rootName };
}

const manifest = MANIFEST.parse(
  JSON.parse(readFileSync(join("schema", "manifest.json"), "utf8")),
);

for (const schemaFile of manifest.roots) {
  const base = schemaFile.replace(/^schema\//, "").replace(/\.schema\.json$/, "");
  const { module, rootName } = genModule(schemaFile);
  const outPath = join("src", "generated", `${base.replace(/[.-]/g, "_")}.ts`);
  writeFileSync(outPath, module);
  console.log(`wrote ${outPath} (root: ${rootName})`);
}