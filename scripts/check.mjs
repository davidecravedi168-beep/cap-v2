import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const dir of ['src', 'server', 'scripts', 'tests']) for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', `${dir}/${file}`]);
const html = readFileSync('index.html', 'utf8');
if (!html.includes('Content-Security-Policy') || !html.includes('type="module"')) throw Error('Missing application security headers or module entry.');
if (/src="app\.js"/.test(html)) throw Error('Legacy runtime still loaded.');
console.log('Module syntax and application entry verified.');
