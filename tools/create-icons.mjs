import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
const require = createRequire(process.argv[2] || import.meta.url);
const sharp = require('sharp');
await mkdir('public/icons', {recursive: true});
const svg = await readFile('favicon.svg');
for (const size of [192, 512]) await sharp(svg).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
