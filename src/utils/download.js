export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const downloadText = (text, filename, mime = 'text/plain;charset=utf-8') => downloadBlob(new Blob([text], { type: mime }), filename);
export const safeName = (s) => String(s || 'file').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80);
export const readAsArrayBuffer = (file) => file.arrayBuffer();
export const readAsText = (file) => file.text();

const csvCell = (v) => { const x = String(v ?? ''); return /[",\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
// rows: array of arrays. A BOM is added so Excel reads Bengali text correctly.
export const toCsv = (rows) => `\ufeff${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}`;
