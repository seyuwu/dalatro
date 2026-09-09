// Builds dist/index.html — the whole game in ONE file (player-facing deliverable).
// Inlines CSS and all scripts in the exact order from index.html.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, "index.html"), "utf8");

const css = readFileSync(join(root, "src/ui/styles.css"), "utf8");
let out = html.split('<link rel="stylesheet" href="src/ui/styles.css">').join(`<style>\n${css}\n</style>`);

const scriptTags = [...out.matchAll(/<script src="([^"]+)"><\/script>/g)];
for (const [, src] of scriptTags) {
  const code = readFileSync(join(root, src), "utf8");
  out = out.split(`<script src="${src}"></script>`).join(`<script>\n${code}\n</script>`);
}

if (/<script src=/.test(out)) {
  console.error("BUILD FAILED: some scripts were not inlined");
  process.exit(1);
}

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/index.html"), out);
console.log(`OK → dist/index.html (${Math.round(out.length / 1024)} KB, ${scriptTags.length} scripts inlined)`);
