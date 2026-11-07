/**
 * Escape-first renderer for intervention text (D7). Everything is HTML-escaped first, then
 * only `**bold**`, `*italic*` and lines starting with "- " (or "• ") become markup, as in the
 * mockup's parse(). No other HTML can come out of this function.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

const LIST_ITEM = /^[-•]\s+/;

export function renderIntervention(text: string): string {
  const out: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (list) out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (LIST_ITEM.test(line)) {
      (list ??= []).push(inline(escapeHtml(line.replace(LIST_ITEM, ''))));
    } else {
      flush();
      out.push(`<p>${inline(escapeHtml(line))}</p>`);
    }
  }
  flush();
  return out.join('');
}

/** The text without formatting markers, for excerpts and word counts. */
export function plainText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (LIST_ITEM.test(l) ? `• ${l.replace(LIST_ITEM, '')}` : l))
    .join(' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

export function wordCount(text: string): number {
  return plainText(text)
    .split(/\s+/)
    .filter((w) => w && w !== '•').length;
}

/** About 230 characters cut on a word boundary, as in the mockup. */
export function excerpt(text: string, max = 230): string {
  const plain = plainText(text);
  if (plain.length <= max) return plain;
  return plain.slice(0, max).replace(/\s+\S*$/, '') + ' …';
}
