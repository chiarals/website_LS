// Writes content/live.json into the HTML pages (Italian texts, courses, photos, FAQ) and
// rebuilds /llms.txt and /llms-full.txt. The reserved area does the same when it publishes;
// run this only after editing content/live.json by hand:  node tools/bake.mjs
import fs from 'fs';
import path from 'path';
import { PAGES, bakePage, buildLlms } from '../render.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content/live.json'), 'utf8'));

for (const page of PAGES) {
  const file = path.join(root, page);
  fs.writeFileSync(file, bakePage(fs.readFileSync(file, 'utf8'), content, page));
  console.log(`${page}: baked`);
}
for (const [name, text] of Object.entries(buildLlms(content))) {
  fs.writeFileSync(path.join(root, name), text);
  console.log(`${name}: ${text.length} chars`);
}
