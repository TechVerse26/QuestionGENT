// Pure helpers for the Tiptap/ProseMirror JSON document format used for all rich text.
export const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });

export function docFromText(text) {
  const lines = String(text ?? '').split('\n');
  return { type: 'doc', content: lines.map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) };
}

const EMBED = new Set(['image', 'mathInline', 'mathBlock', 'table', 'horizontalRule']);
const hasEmbeds = (n) => !!n && (EMBED.has(n.type) || (n.content || []).some(hasEmbeds));
const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'tableRow', 'blockquote', 'codeBlock']);

export function docToText(doc) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (n.type === 'text') { out.push(n.text || ''); return; }
    if (n.type === 'hardBreak') { out.push('\n'); return; }
    if (n.type === 'mathInline' || n.type === 'mathBlock') { out.push(n.attrs?.latex || ''); return; }
    if (n.type === 'image') { out.push('[image]'); return; }
    (n.content || []).forEach(walk);
    if (BLOCKS.has(n.type)) out.push('\n');
    else if (n.type === 'tableCell' || n.type === 'tableHeader') out.push('\t');
  };
  walk(doc);
  return out.join('').replace(/\n{2,}/g, '\n').trim();
}

export function isEmptyDoc(doc) {
  if (!doc || typeof doc !== 'object') return true;
  return docToText(doc) === '' && !hasEmbeds(doc);
}

// ---- HTML rendering (escapes everything, whitelists styles) ----
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/;
const SIZE_RE = /^\d{1,3}(\.\d+)?(px|pt|em|rem|%)$/;
const FONT_RE = /^[\w\s,'"-]{1,120}$/;
export const SRC_RE = /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp);base64,)/i;
const ALIGN = ['left', 'center', 'right', 'justify'];

function markStyle(a = {}) {
  const st = [];
  if (a.color && COLOR_RE.test(a.color)) st.push(`color:${a.color}`);
  if (a.fontSize && SIZE_RE.test(a.fontSize)) st.push(`font-size:${a.fontSize}`);
  if (a.fontFamily && FONT_RE.test(a.fontFamily)) st.push(`font-family:${a.fontFamily}`);
  return st.join(';');
}

function renderText(node) {
  let out = esc(node.text);
  for (const m of node.marks || []) {
    switch (m.type) {
      case 'bold': out = `<strong>${out}</strong>`; break;
      case 'italic': out = `<em>${out}</em>`; break;
      case 'underline': out = `<u>${out}</u>`; break;
      case 'strike': out = `<s>${out}</s>`; break;
      case 'code': out = `<code>${out}</code>`; break;
      case 'superscript': out = `<sup>${out}</sup>`; break;
      case 'subscript': out = `<sub>${out}</sub>`; break;
      case 'textStyle': { const s = markStyle(m.attrs); if (s) out = `<span style="${esc(s)}">${out}</span>`; break; }
      default: break;
    }
  }
  return out;
}

export function docToHtml(doc, opts = {}) {
  const kids = (n) => (n.content || []).map(node).join('');
  const align = (n) => (ALIGN.includes(n.attrs?.textAlign) ? ` style="text-align:${n.attrs.textAlign}"` : '');
  function node(n) {
    switch (n.type) {
      case 'doc': return kids(n);
      case 'text': return renderText(n);
      case 'paragraph': return `<p${align(n)}>${kids(n) || '<br/>'}</p>`;
      case 'heading': { const l = Math.min(4, Math.max(1, Number(n.attrs?.level) || 2)); return `<h${l}${align(n)}>${kids(n)}</h${l}>`; }
      case 'bulletList': return `<ul>${kids(n)}</ul>`;
      case 'orderedList': return `<ol>${kids(n)}</ol>`;
      case 'listItem': return `<li>${kids(n)}</li>`;
      case 'blockquote': return `<blockquote>${kids(n)}</blockquote>`;
      case 'codeBlock': return `<pre><code>${esc(docToText(n))}</code></pre>`;
      case 'hardBreak': return '<br/>';
      case 'horizontalRule': return '<hr/>';
      case 'image': return SRC_RE.test(n.attrs?.src || '') ? `<img src="${esc(n.attrs.src)}" alt="${esc(n.attrs.alt || '')}"/>` : '';
      case 'mathInline':
      case 'mathBlock': {
        const latex = n.attrs?.latex || '';
        const display = n.type === 'mathBlock' || !!n.attrs?.display;
        const html = opts.renderMath ? opts.renderMath(latex, display) : `<span class="math-fallback">${esc(latex)}</span>`;
        return `<span class="math-inline"${display ? ' style="display:block;text-align:center"' : ''}>${html}</span>`;
      }
      case 'table': return `<table><tbody>${kids(n)}</tbody></table>`;
      case 'tableRow': return `<tr>${kids(n)}</tr>`;
      case 'tableCell':
      case 'tableHeader': {
        const tag = n.type === 'tableHeader' ? 'th' : 'td';
        const cs = Number(n.attrs?.colspan) > 1 ? ` colspan="${Number(n.attrs.colspan)}"` : '';
        const rs = Number(n.attrs?.rowspan) > 1 ? ` rowspan="${Number(n.attrs.rowspan)}"` : '';
        return `<${tag}${cs}${rs}>${kids(n)}</${tag}>`;
      }
      default: return kids(n);
    }
  }
  return doc && typeof doc === 'object' ? node(doc) : '';
}

// Prepends bold text (e.g. "Assertion (A):") to the first paragraph of a document.
export function prefixDoc(prefix, doc) {
  const d = doc && doc.content ? JSON.parse(JSON.stringify(doc)) : emptyDoc();
  const lead = { type: 'text', text: `${prefix} `, marks: [{ type: 'bold' }] };
  const first = d.content[0];
  if (first && first.type === 'paragraph') first.content = [lead, ...(first.content || [])];
  else d.content.unshift({ type: 'paragraph', content: [lead] });
  return d;
}

// Appends plain text to the end of the last paragraph (used for inline "[2]" marks).
export function appendText(doc, text) {
  const d = doc && doc.content ? JSON.parse(JSON.stringify(doc)) : emptyDoc();
  let i = d.content.length - 1;
  while (i >= 0 && d.content[i].type !== 'paragraph') i -= 1;
  if (i < 0) d.content.push({ type: 'paragraph', content: [{ type: 'text', text }] });
  else d.content[i].content = [...(d.content[i].content || []), { type: 'text', text }];
  return d;
}
