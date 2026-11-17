import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Footer, PageNumber,
  ImageRun, TabStopType, Tab, ShadingType, TableLayoutType, PageOrientation,
} from 'docx';
import { buildPaperModel } from '../preview/paperModel.js';
import { pageDims } from '../constants/templates.js';
import { latexToText } from '../utils/latexText.js';
import { SRC_RE, appendText } from '../utils/richtext.js';

const tw = (mm) => Math.round(mm * 56.6929);
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.slice(1).toUpperCase() : '111111');
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const CELL_NONE = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const LINE = { style: BorderStyle.SINGLE, size: 4, color: '555555' };
const CELL_LINE = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };

const run = (text, o, ctx) => new TextRun({
  text, font: o.font || ctx.font, size: o.size || ctx.size, sizeComplexScript: o.size || ctx.size,
  bold: o.bold, boldComplexScript: o.bold, italics: o.italics, italicsComplexScript: o.italics,
  underline: o.underline ? {} : undefined, strike: o.strike, superScript: o.sup, subScript: o.sub, color: o.color,
});
const tabRun = (ctx, o = {}, extra = []) => new TextRun({ children: [new Tab(), ...extra], font: ctx.font, size: ctx.size, bold: o.bold, color: o.color });

function markOptions(marks) {
  const o = {};
  for (const m of marks || []) {
    if (m.type === 'bold') o.bold = true;
    else if (m.type === 'italic') o.italics = true;
    else if (m.type === 'underline') o.underline = true;
    else if (m.type === 'strike') o.strike = true;
    else if (m.type === 'superscript') o.sup = true;
    else if (m.type === 'subscript') o.sub = true;
    else if (m.type === 'textStyle' && m.attrs) {
      if (/^#[0-9a-f]{6}$/i.test(m.attrs.color || '')) o.color = m.attrs.color.slice(1).toUpperCase();
      const px = /^(\d+(?:\.\d+)?)px$/.exec(m.attrs.fontSize || '');
      const pt = /^(\d+(?:\.\d+)?)pt$/.exec(m.attrs.fontSize || '');
      if (px) o.size = Math.round(Number(px[1]) * 1.5);
      else if (pt) o.size = Math.round(Number(pt[1]) * 2);
    }
  }
  return o;
}

async function imageRun(src, ctx, maxPx) {
  try {
    if (!ctx.loadImage || !SRC_RE.test(src || '')) throw new Error('no image loader');
    const img = await ctx.loadImage(src, maxPx || ctx.imageMaxPx);
    return new ImageRun({ type: img.type, data: img.data, transformation: { width: img.width, height: img.height } });
  } catch (e) {
    return run('[image]', { italics: true }, ctx);
  }
}

async function inlineRuns(nodes, ctx, base = {}) {
  const out = [];
  for (const n of nodes || []) {
    if (n.type === 'text') out.push(run(n.text || '', { ...base, ...markOptions(n.marks) }, ctx));
    else if (n.type === 'hardBreak') out.push(new TextRun({ break: 1 }));
    else if (n.type === 'mathInline' || n.type === 'mathBlock') out.push(run(latexToText(n.attrs && n.attrs.latex), { ...base, italics: true, font: 'Cambria Math' }, ctx));
    else if (n.type === 'image') out.push(await imageRun(n.attrs && n.attrs.src, ctx));
  }
  return out;
}

async function listParas(list, ctx, o, depth) {
  const out = [];
  let idx = (list.attrs && list.attrs.start) || 1;
  for (const li of list.content || []) {
    let firstPara = true;
    for (const c of li.content || []) {
      if (c.type === 'paragraph') {
        const runs = await inlineRuns(c.content, ctx, o.base);
        const bullet = list.type === 'bulletList' ? '•' : `${idx}.`;
        out.push(new Paragraph({
          children: firstPara ? [run(bullet, {}, ctx), new TextRun({ children: [new Tab()] }), ...runs] : runs,
          indent: { left: (o.left || 0) + 360 * (depth + 1), hanging: firstPara ? 360 : 0 }, spacing: { after: 20 },
        }));
        firstPara = false;
      } else if (c.type === 'bulletList' || c.type === 'orderedList') {
        out.push(...(await listParas(c, ctx, o, depth + 1)));
      }
    }
    idx += 1;
  }
  return out;
}

async function tableNode(n, ctx, o) {
  const rows = [];
  for (const r of n.content || []) {
    const cells = [];
    for (const c of r.content || []) {
      const kids = await docParas({ content: c.content }, ctx, { base: c.type === 'tableHeader' ? { bold: true } : {}, after: 20 });
      if (!kids.length || !(kids[kids.length - 1] instanceof Paragraph)) kids.push(new Paragraph(''));
      cells.push(new TableCell({
        children: kids, borders: CELL_LINE,
        columnSpan: Number(c.attrs && c.attrs.colspan) > 1 ? Number(c.attrs.colspan) : undefined,
        rowSpan: Number(c.attrs && c.attrs.rowspan) > 1 ? Number(c.attrs.rowspan) : undefined,
      }));
    }
    if (cells.length) rows.push(new TableRow({ children: cells }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, indent: o.left ? { size: o.left, type: WidthType.DXA } : undefined });
}

// o: { left, hanging, prefix[], suffix[], rightTab, keepNext, after, base }
async function docParas(doc, ctx, o = {}) {
  const out = [];
  let first = true;
  const mk = (children, node, isFirst) => new Paragraph({
    children, alignment: ALIGN[node && node.attrs && node.attrs.textAlign],
    indent: { left: o.left || 0, hanging: isFirst ? o.hanging || 0 : 0 },
    tabStops: o.rightTab ? [{ type: TabStopType.RIGHT, position: o.rightTab }] : undefined,
    spacing: { after: o.after === undefined ? 40 : o.after }, keepNext: o.keepNext,
  });
  for (const n of (doc && doc.content) || []) {
    const para = n.type === 'paragraph' || n.type === 'heading';
    if (first && !para && (o.prefix || o.suffix)) { out.push(mk([...(o.prefix || []), ...(o.suffix || [])], null, true)); first = false; }
    if (para) {
      const runs = await inlineRuns(n.content, ctx, n.type === 'heading' ? { ...o.base, bold: true } : o.base);
      out.push(mk([...(first ? o.prefix || [] : []), ...runs, ...(first ? o.suffix || [] : [])], n, first));
      first = false;
    } else if (n.type === 'bulletList' || n.type === 'orderedList') {
      out.push(...(await listParas(n, ctx, o, 0)));
    } else if (n.type === 'table') {
      out.push(await tableNode(n, ctx, o));
    } else if (n.type === 'image') {
      out.push(mk([await imageRun(n.attrs && n.attrs.src, ctx)], null, false));
    } else if (n.type === 'blockquote' || n.type === 'codeBlock') {
      out.push(...(await docParas({ content: n.content || [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] }, ctx, { ...o, prefix: undefined, suffix: undefined, left: (o.left || 0) + 360 })));
    }
  }
  if (first) out.push(mk([...(o.prefix || []), ...(o.suffix || [])], null, true));
  return out;
}

async function blockToDocx(b, ctx, model) {
  const { design, D } = model;
  const marksRuns = (m) => (m == null ? [] : [tabRun(ctx, { bold: true }, [`[${D(m)}]`])]);
  const inlineMode = design.question.marksAlign === 'inline';
  switch (b.k) {
    case 'stem': {
      const inline = inlineMode && b.marks != null;
      return docParas(inline ? appendText(b.doc, ` [${D(b.marks)}]`) : b.doc, ctx, {
        prefix: [run(b.no, { bold: true }, ctx), new TextRun({ children: [new Tab()] })], suffix: inline ? [] : marksRuns(b.marks),
        left: tw(8), hanging: tw(8), rightTab: ctx.contentTw, keepNext: true,
      });
    }
    case 'keyhead':
      return [new Paragraph({
        children: [run(b.no, { bold: true }, ctx), new TextRun({ children: [new Tab()] }), run(b.text || '', { bold: true }, ctx), ...marksRuns(b.marks)],
        indent: { left: tw(8), hanging: tw(8) }, tabStops: [{ type: TabStopType.RIGHT, position: ctx.contentTw }], spacing: { after: 40 }, keepNext: true,
      })];
    case 'doc': return docParas(b.doc, ctx, { left: tw(8) });
    case 'subs': {
      const out = [];
      for (const it of b.items) {
        const inline = inlineMode && it.marks != null;
        out.push(...(await docParas(inline ? appendText(it.doc, ` [${D(it.marks)}]`) : it.doc, ctx, {
          prefix: [run(it.label, {}, ctx), new TextRun({ children: [new Tab()] })], suffix: inline ? [] : marksRuns(it.marks), left: tw(16), hanging: tw(8), rightTab: ctx.contentTw,
        })));
      }
      return out;
    }
    case 'options': {
      const cols = b.cols;
      const w = Math.floor((ctx.contentTw - tw(8)) / cols);
      const rows = [];
      for (let i = 0; i < b.items.length; i += cols) {
        const cells = [];
        for (let c = 0; c < cols; c++) {
          const it = b.items[i + c];
          const kids = it ? await docParas(it.doc, ctx, { prefix: [run(`${it.label} `, {}, ctx)], after: 20 }) : [new Paragraph('')];
          cells.push(new TableCell({ children: kids, width: { size: w, type: WidthType.DXA }, borders: CELL_NONE }));
        }
        rows.push(new TableRow({ children: cells, cantSplit: true }));
      }
      return [new Table({ rows, columnWidths: Array(cols).fill(w), layout: TableLayoutType.FIXED, borders: NO_BORDERS, indent: { size: tw(8), type: WidthType.DXA }, width: { size: w * cols, type: WidthType.DXA } })];
    }
    case 'columns': {
      const w = Math.floor((ctx.contentTw - tw(8)) / 2);
      const rows = [];
      const n = Math.max(b.left.length, b.right.length);
      for (let i = 0; i < n; i++) {
        const cell = (c) => new TableCell({ children: [new Paragraph({ children: c ? [run(`${c.label} ${c.text}`, {}, ctx)] : [] })], width: { size: w, type: WidthType.DXA }, borders: CELL_NONE });
        rows.push(new TableRow({ children: [cell(b.left[i]), cell(b.right[i])] }));
      }
      return [new Table({ rows, columnWidths: [w, w], layout: TableLayoutType.FIXED, borders: NO_BORDERS, indent: { size: tw(8), type: WidthType.DXA }, width: { size: w * 2, type: WidthType.DXA } })];
    }
    case 'kv': return [new Paragraph({ children: [run(`${b.label} `, { bold: true }, ctx), run(b.text, {}, ctx)], indent: { left: tw(8) }, spacing: { after: 40 } })];
    case 'list': return b.items.map((it) => new Paragraph({ children: [run(it.label, {}, ctx), new TextRun({ children: [new Tab()] }), run(it.text, {}, ctx)], indent: { left: tw(14), hanging: tw(6) }, spacing: { after: 20 } }));
    case 'code': return [
      ...(b.caption ? [new Paragraph({ children: [run(b.caption, { bold: true }, ctx)], indent: { left: tw(8) }, spacing: { after: 20 } })] : []),
      ...String(b.text || '').split('\n').map((line) => new Paragraph({ children: [run(line, { font: 'Courier New', size: ctx.size - 2 }, ctx)], indent: { left: tw(10) }, spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } })),
      new Paragraph({ spacing: { after: 40 } }),
    ];
    case 'rubric': return [new Table({
      width: { size: ctx.contentTw - tw(8), type: WidthType.DXA }, indent: { size: tw(8), type: WidthType.DXA },
      rows: b.items.map((r) => new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ children: [run(r.criterion || '', {}, ctx)] })], borders: CELL_LINE }),
        new TableCell({ children: [new Paragraph({ children: [run(D(r.marks), {}, ctx)], alignment: AlignmentType.RIGHT })], borders: CELL_LINE, width: { size: tw(16), type: WidthType.DXA } }),
      ] })),
    }), new Paragraph({ spacing: { after: 40 } })];
    case 'note': return [new Paragraph({ children: [run(b.text, { italics: true }, ctx)], indent: { left: tw(8) } })];
    default: return [];
  }
}

async function headerParas(model, ctx) {
  const { design, info, L, D } = model;
  const h = design.header;
  const out = [];
  const center = h.layout !== 'split';
  const al = center ? AlignmentType.CENTER : AlignmentType.LEFT;
  if (h.showLogo && info.logoUrl && h.layout !== 'minimal' && ctx.loadImage) {
    out.push(new Paragraph({ children: [await imageRun(info.logoUrl, ctx, 90)], alignment: al, spacing: { after: 40 } }));
  }
  const line = (text, o = {}) => out.push(new Paragraph({ children: [run(text, o, ctx)], alignment: al, spacing: { after: 20 } }));
  if (h.showInstitution && info.institutionName) line(info.institutionName, { bold: true, size: Math.round((h.layout === 'minimal' ? 13 : h.titleSize) * 2) });
  if (h.showInstitution && info.address && h.layout !== 'minimal') line(info.address, { size: ctx.size - 2 });
  const title = info.examName || model.title;
  if (h.showExam && title) line(title, { bold: true });
  const tag = [model.mode === 'key' ? L.answerKey : '', model.setLabel ? `${L.set}: ${model.setLabel}` : ''].filter(Boolean).join(' | ');
  if (tag) line(tag, { bold: true });
  const subject = [info.subject, info.subjectCode ? `(${L.subjectCode}: ${D(info.subjectCode)})` : ''].filter(Boolean).join(' ');
  const full = info.fullMarks ? D(info.fullMarks) : model.totalMarks ? D(model.totalMarks) : '';
  const cells = [[L.class, info.className], [L.group, info.group], [L.section, info.section], [L.department, info.department], [L.subject, subject], [L.date, info.date], [L.duration, info.duration], [L.fullMarks, full], [L.passMarks, info.passMarks ? D(info.passMarks) : ''], [L.year, info.year]].filter((c) => c[1]);
  if (cells.length) {
    if (h.infoLayout === 'line') {
      out.push(new Paragraph({ children: [run(cells.map(([k, v]) => `${k}: ${v}`).join('   '), {}, ctx)], alignment: al, spacing: { before: 60, after: 60 } }));
    } else {
      const w = Math.floor(ctx.contentTw / 3);
      const rows = [];
      for (let i = 0; i < cells.length; i += 3) {
        const row = [];
        for (let c = 0; c < 3; c++) {
          const x = cells[i + c];
          row.push(new TableCell({ children: [new Paragraph({ children: x ? [run(`${x[0]}: `, { bold: true }, ctx), run(x[1], {}, ctx)] : [] })], width: { size: w, type: WidthType.DXA }, borders: CELL_LINE }));
        }
        rows.push(new TableRow({ children: row }));
      }
      out.push(new Table({ rows, columnWidths: [w, w, w], layout: TableLayoutType.FIXED, width: { size: w * 3, type: WidthType.DXA } }));
      out.push(new Paragraph({ spacing: { after: 40 } }));
    }
  }
  if (info.instructions) out.push(new Paragraph({ children: [run(`${L.instructions}: `, { bold: true, italics: true }, ctx), run(info.instructions, { italics: true }, ctx)], spacing: { after: 80 } }));
  return out;
}

function sectionParas(s, model, ctx) {
  const { design } = model;
  const st = design.section.style;
  const accent = hex(design.accent);
  const bar = st === 'bar';
  const side = { style: BorderStyle.SINGLE, size: 6, color: accent, space: 1 };
  const children = [run(bar ? `\u00A0${s.title}` : s.title, { bold: true, color: bar ? 'FFFFFF' : undefined }, ctx)];
  if (s.marksText) children.push(tabRun(ctx, { bold: true, color: bar ? 'FFFFFF' : undefined }, [bar ? `${s.marksText}\u00A0` : s.marksText]));
  const out = [new Paragraph({
    children, keepNext: true, spacing: { before: 120, after: 40 },
    alignment: design.section.align === 'center' && !s.marksText ? AlignmentType.CENTER : AlignmentType.LEFT,
    tabStops: [{ type: TabStopType.RIGHT, position: ctx.contentTw }],
    shading: bar ? { type: ShadingType.CLEAR, fill: accent, color: 'auto' } : undefined,
    border: st === 'underline' ? { bottom: side } : st === 'boxed' ? { top: side, bottom: side, left: side, right: side } : undefined,
  })];
  const notes = [s.description, s.instructions, s.ruleText].filter(Boolean).join(' ');
  if (notes) out.push(new Paragraph({ children: [run(notes, { italics: true, size: ctx.size - 2 }, ctx)], keepNext: true, spacing: { after: 60 } }));
  return out;
}

export async function buildDocxDocument({ paper, items, keys, mode = 'paper', loadImage }) {
  const model = buildPaperModel({ paper, items, keys, mode });
  const { design, L } = model;
  const m = design.margins;
  const [w, h] = pageDims({ ...design, page: { ...design.page, orientation: 'portrait' } });
  const landscape = design.page.orientation === 'landscape';
  const [pw] = pageDims(design);
  const size = Math.round(design.fontSize * 2);
  const ctx = { font: design.docxFont || 'Nirmala UI', size, contentTw: tw(pw - m.left - m.right), loadImage, imageMaxPx: Math.floor((pw - m.left - m.right - 20) * 3.78) };

  const children = [...(await headerParas(model, ctx))];
  for (const s of model.sections) {
    children.push(...sectionParas(s, model, ctx));
    for (const q of s.qs) for (const b of q.blocks) children.push(...(await blockToDocx(b, ctx, model)));
  }
  if (design.signature.enabled && design.signature.labels.length) {
    const wcell = Math.floor(ctx.contentTw / design.signature.labels.length);
    children.push(new Paragraph({ spacing: { before: 600 } }));
    children.push(new Table({
      borders: NO_BORDERS, width: { size: wcell * design.signature.labels.length, type: WidthType.DXA }, columnWidths: design.signature.labels.map(() => wcell),
      rows: [new TableRow({ children: design.signature.labels.map((l) => new TableCell({ borders: CELL_NONE, width: { size: wcell, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: '111111', space: 4 } }, children: [run(l, {}, ctx)] })] })) })],
    }));
  }

  const f = design.footer;
  const footerChildren = [run(f.text || '', { size: size - 2 }, ctx)];
  if (f.pageNumbers) {
    footerChildren.push(new TextRun({
      children: f.format === 'n' ? [new Tab(), PageNumber.CURRENT] : [new Tab(), `${L.page} `, PageNumber.CURRENT, ` ${L.of} `, PageNumber.TOTAL_PAGES],
      font: ctx.font, size: size - 2,
    }));
  }

  return new Document({
    creator: 'EXAM MASTER',
    title: paper.title || (paper.info && paper.info.examName) || 'Question paper',
    styles: { default: { document: { run: { font: ctx.font, size, sizeComplexScript: size } } } },
    sections: [{
      properties: {
        page: {
          size: { width: tw(w), height: tw(h), orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: tw(m.top), bottom: tw(m.bottom), left: tw(m.left), right: tw(m.right), footer: tw(Math.max(4, m.bottom / 2)) },
        },
      },
      footers: f.enabled ? { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: ctx.contentTw }], children: footerChildren })] }) } : undefined,
      children,
    }],
  });
}

// Browser-only: downloads an image and returns bytes Word can embed (WebP etc. are converted to PNG).
export async function loadImageForDocx(src, maxPx) {
  const res = await fetch(src);
  if (!res.ok) throw new Error('image fetch failed');
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxPx / bmp.width);
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const direct = ['image/png', 'image/jpeg', 'image/gif'].includes(blob.type);
  let data;
  let type;
  if (direct) {
    data = new Uint8Array(await blob.arrayBuffer());
    type = blob.type === 'image/jpeg' ? 'jpg' : blob.type.slice(6);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    data = new Uint8Array(await png.arrayBuffer());
    type = 'png';
  }
  return { data, type, width, height };
}

export async function docxBlob(args) {
  return Packer.toBlob(await buildDocxDocument({ ...args, loadImage: loadImageForDocx }));
}
