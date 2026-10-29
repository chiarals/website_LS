// Writes the Italian texts from i18n.js straight into the HTML pages, so search engines
// and AI crawlers read the content without running JavaScript. The IT/EN switch keeps
// working as before. Re-run after editing i18n.js:  node tools/bake-i18n.mjs
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8') + '\nthis.I18N = I18N;', ctx);
const t = ctx.I18N.it;

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

for (const page of ['index.html', 'corsi.html', 'chi-sono.html']) {
  const file = path.join(root, page);
  let html = fs.readFileSync(file, 'utf8');
  let count = 0;

  // <tag ... data-i18n="key" ...>anything</tag>  ->  inner text = Italian string
  html = html.replace(/(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, key, _inner, close) => {
    if (!(key in t)) throw new Error(`${page}: missing Italian text for "${key}"`);
    count++;
    return open + t[key] + close;
  });

  // alt="" and placeholder="" for images and inputs
  html = html.replace(/<(img|input)\b[^>]*>/g, (tag) => {
    const altKey = tag.match(/data-i18n-alt="([^"]+)"/);
    if (altKey) tag = tag.replace(/\salt="[^"]*"/, ` alt="${attr(t[altKey[1]])}"`);
    const phKey = tag.match(/data-i18n-placeholder="([^"]+)"/);
    if (phKey) {
      tag = /\splaceholder="/.test(tag)
        ? tag.replace(/\splaceholder="[^"]*"/, ` placeholder="${attr(t[phKey[1]])}"`)
        : tag.replace(/\sdata-i18n-placeholder=/, ` placeholder="${attr(t[phKey[1]])}" data-i18n-placeholder=`);
    }
    return tag;
  });

  fs.writeFileSync(file, html);
  console.log(`${page}: ${count} texts written`);
}
