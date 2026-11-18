// File readers for the import wizard. Heavy libraries are loaded on demand.
const tableResult = (rows) => {
  const clean = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!clean.length) throw new Error('The file has no rows.');
  const headers = clean[0].map((h) => String(h ?? '').trim());
  return { kind: 'table', headers, rows: clean.slice(1).map((r) => headers.map((_, i) => (r[i] === undefined || r[i] === null ? '' : r[i]))) };
};

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('Could not load the PDF reader. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

async function pdfText(file) {
  const lib = await loadPdfJs();
  // isEvalSupported:false is the documented mitigation for CVE-2024-4367 (script execution through a crafted PDF font)
  const doc = await lib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    let lastY = null;
    content.items.forEach((it) => {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n';
      text += it.str;
      lastY = y;
    });
    text += '\n';
  }
  return text;
}

// Returns { kind: 'table', headers, rows } for CSV/XLSX/XLS, or { kind: 'text', text } for TXT/DOCX/PDF.
export async function parseFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (file.size > 15 * 1024 * 1024) throw new Error('Files larger than 15 MB are not supported.');
  if (ext === 'csv') {
    const Papa = (await import('papaparse')).default;
    return tableResult(Papa.parse(await file.text(), { skipEmptyLines: 'greedy' }).data);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return tableResult(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: '' }));
  }
  if (ext === 'txt') return { kind: 'text', text: await file.text() };
  if (ext === 'docx') {
    const m = await import('mammoth');
    const mammoth = m.default || m;
    return { kind: 'text', text: (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value };
  }
  if (ext === 'pdf') return { kind: 'text', text: await pdfText(file), pdf: true };
  throw new Error('Unsupported file type. Use CSV, XLSX, XLS, TXT, DOCX or PDF.');
}
