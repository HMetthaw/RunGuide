import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(process.argv[2] || 'dist');
const configuredBase = process.argv[3] || process.env.BASE_PATH || '/';
const base = configuredBase === './' ? '/' : configuredBase;
const failures = [];
async function exists(ref, page) {
  if (/^(https?:|data:|mailto:|#)/.test(ref)) return;
  const url = new URL(ref, `https://build.test${base}${page}`);
  if (!url.pathname.startsWith(base)) {failures.push(`${page}: asset outside deployment base: ${ref}`); return;}
  const relative = decodeURIComponent(url.pathname.slice(base.length));
  try {await access(resolve(directory, relative));}
  catch {failures.push(`${page}: missing asset ${ref}`);}
}
for (const page of ['index.html', 'runner.html']) {
  const html = await readFile(resolve(directory, page), 'utf8');
  for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) await exists(match[1], page);
}
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.webmanifest'), 'utf8'));
await exists(manifest.start_url, 'manifest.webmanifest');
for (const icon of manifest.icons) await exists(icon.src, 'manifest.webmanifest');
await access(resolve(directory, 'sw.js'));
if (failures.length) {console.error(failures.join('\n')); process.exitCode = 1;}
else console.log('Build assets, both pages, manifest, icons and service worker verified.');
