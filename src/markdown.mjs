import { esc } from './core.mjs';

// Small, deliberately limited renderer: raw HTML and remote images are never executed.
function inline(value) {
  const tokens = [];
  const token = html => `\u0000${tokens.push(html) - 1}\u0000`;
  let text = String(value).replace(/\u0000/g, '');
  text = text.replace(/`([^`\n]+)`/g, (_, code) => token(`<code>${esc(code)}</code>`));
  text = text.replace(/!?\[([^\]\n]+)\]\(([^\s)]+)\)/g, (whole, label, target) => {
    if (whole.startsWith('!')) return token(esc(`[Immagine: ${label}]`));
    try {
      const url = new URL(target);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return token(esc(label));
      return token(`<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`);
    } catch { return token(esc(label)); }
  });
  return esc(text).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)] || '');
}
const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
export function markdown(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n'), output = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; output.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { const level = Math.min(heading[1].length + 2, 6); output.push(`<h${level}>${inline(heading[2])}</h${level}>`); i++; continue; }
    if (i + 1 < lines.length && line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const header = cells(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      output.push(`<div class="answer-table"><table><thead><tr>${header.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${header.map((_, c) => `<td>${inline(row[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    const item = line.match(/^\s*(?:([-*])|\d+\.)\s+(.+)$/);
    if (item) {
      const tag = item[1] ? 'ul' : 'ol', list = [];
      const pattern = tag === 'ul' ? /^\s*[-*]\s+(.+)$/ : /^\s*\d+\.\s+(.+)$/;
      while (i < lines.length && pattern.test(lines[i])) list.push(lines[i++].match(pattern)[1]);
      output.push(`<${tag}>${list.map(c => `<li>${inline(c)}</li>`).join('')}</${tag}>`); continue;
    }
    if (/^>\s?/.test(line)) { output.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { output.push('<hr>'); i++; continue; }
    output.push(`<p>${inline(line)}</p>`); i++;
  }
  return output.join('\n');
}
