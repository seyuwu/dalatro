// Builds dist/index.html — the whole game in ONE file (player-facing deliverable).
// Inlines CSS and all scripts in the exact order from index.html, copies static
// assets (battlefield background) next to it.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, "index.html"), "utf8");

const css = readFileSync(join(root, "src/ui/styles.css"), "utf8")
  + "\n" + readFileSync(join(root, "src/ui/tutorial.css"), "utf8"); // TUTORIAL
let out = html.split('<link rel="stylesheet" href="src/ui/styles.css">').join(`<style>\n${css}\n</style>`);
out = out.split('<link rel="stylesheet" href="src/ui/tutorial.css">').join("");

const scriptTags = [...out.matchAll(/<script src="([^"]+)"><\/script>/g)];
for (const [, src] of scriptTags) {
  const code = readFileSync(join(root, src), "utf8");
  out = out.split(`<script src="${src}"></script>`).join(`<script>\n${code}\n</script>`);
}

if (/<script src=/.test(out)) {
  console.error("BUILD FAILED: some scripts were not inlined");
  process.exit(1);
}

mkdirSync(join(root, "dist", "images"), { recursive: true });
writeFileSync(join(root, "dist", "index.html"), out);
copyFileSync(join(root, "images", "battlefield.jpg"), join(root, "dist", "images", "battlefield.jpg"));
// Локальное зеркало арта (портреты героев, иконки предметов) — в dist,
// чтобы one-file-сборка работала без внешнего CDN.
mkdirSync(join(root, "dist", "images", "cdn", "heroes"), { recursive: true });
mkdirSync(join(root, "dist", "images", "cdn", "items"), { recursive: true });
for (const kind of ["heroes", "items"]) {
  for (const f of readdirSync(join(root, "images", "cdn", kind))) {
    copyFileSync(join(root, "images", "cdn", kind, f), join(root, "dist", "images", "cdn", kind, f));
  }
}
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
console.log(`OK → dist/index.html (${Math.round(Buffer.byteLength(out) / 1024)} KB, ${scriptTags.length} scripts inlined, v${pkg.version})`);
