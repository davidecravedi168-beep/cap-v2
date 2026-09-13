import { rmSync, mkdirSync, cpSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { VERSION } from '../src/core.mjs';
// An explicit allowlist keeps server sources, dependencies and secrets out of Pages.
rmSync('dist', { recursive: true, force: true }); mkdirSync('dist');
const hash = createHash('sha256');
for (const file of readdirSync('src').sort()) hash.update(file).update(readFileSync(`src/${file}`));
const assets = `assets-${VERSION}-${hash.digest('hex').slice(0, 10)}`;
const html = readFileSync('index.html', 'utf8').replaceAll('./src/', `./${assets}/`).replaceAll('?v=3.0.0', '');
// Both historical entry points serve exactly the same release.
for (const file of ['index.html', 'office.html']) writeFileSync(`dist/${file}`, html);
cpSync('src', `dist/${assets}`, { recursive: true });
cpSync('qa', 'dist/qa', { recursive: true });
writeFileSync('dist/.nojekyll', '');
writeFileSync('dist/version.json', JSON.stringify({ version: VERSION, assets, commit: process.env.GITHUB_SHA || 'local' }));
console.log(`Pages package: ${readdirSync('dist').join(', ')}`);
