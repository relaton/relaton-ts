// Refreshes the vendored style packs from the canonical locations pinned
// in src/citation/styles/styles.pin.json, then regenerates the bundle.
// Two sources, per the SSOT distribution law:
//   - relaton/relaton lib/relaton/render/iso690/styles/ — the eight
//     engine-format packs (the reference engine; carries the approved
//     reconciliation, relaton#575; consumed by name from metanorma-jis#551)
//   - relaton/relaton-models citation/styles/ — the canonical LML
//     instances (iso-690)
// This is a deliberate update command (`npm run update-styles`), not part
// of `npm run build`: builds stay hermetic and read the committed copies.
// The pins move only when a pack actually changes upstream, and each move
// is a reviewed commit. The final state replaces this vendoring with
// generated realizations from the LML declaration (relaton-ts#30 step 2),
// gated on lutaml-model#1033's declaration export.
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(here, "..", "src", "citation", "styles");
const pinPath = join(stylesDir, "styles.pin.json");

const pin = JSON.parse(readFileSync(pinPath, "utf8"));
const sources = pin.sources ?? [pin];
if (sources.length === 0) {
  throw new Error(
    "styles.pin.json carries no sources — expected {sources: [{repo, ref, path}]}",
  );
}

let count = 0;
for (const { repo, ref, path } of sources) {
  if (!repo || !ref || !path) {
    throw new Error(
      `each source must carry {repo, ref, path} — got ${JSON.stringify({ repo, ref, path })}`,
    );
  }
  const api = `https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`;
  const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) {
    throw new Error(`listing ${repo}@${ref} ${path} failed: HTTP ${res.status}`);
  }
  const entries = await res.json();
  const packs = entries.filter((e) => e.name.endsWith(".yml"));
  if (packs.length === 0) {
    throw new Error(`no .yml packs under ${repo}@${ref} ${path}`);
  }
  for (const entry of packs) {
    const res = await fetch(entry.download_url);
    if (!res.ok) {
      throw new Error(`fetching ${entry.download_url} failed: HTTP ${res.status}`);
    }
    const yaml = await res.text();
    if (yaml.trim().length === 0) {
      throw new Error(`${entry.name} at ${ref} is empty`);
    }
    writeFileSync(join(stylesDir, entry.name), yaml);
    console.log(`fetched ${entry.name} <- ${repo}`);
    count += 1;
  }
}

console.log(`${count} pack(s) fetched; now run: npm run build`);
