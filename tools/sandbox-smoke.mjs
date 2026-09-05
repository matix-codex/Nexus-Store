import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(path.join(root, 'catalog.json'), 'utf8'));
let sandboxCount = 0;

for (const entry of catalog.packages) {
  const packagePath = path.join(root, entry.path);
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  if (pkg.content.type !== 'sandbox') continue;
  sandboxCount += 1;
  const matches = [...pkg.content.html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  if (matches.length !== 1) throw new Error(`${pkg.id}: verwacht precies één scriptblok.`);
  new Function(matches[0][1]);
  if (!/^<!doctype html>/i.test(pkg.content.html.trim())) throw new Error(`${pkg.id}: onvolledig HTML-document.`);
}

console.log(`Sandbox smoke test geslaagd voor ${sandboxCount} lokale packages.`);
