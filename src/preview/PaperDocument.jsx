import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './paper.css';
import RichHtml from '../components/editor/RichHtml.jsx';
import { buildPaperModel } from './paperModel.js';
import { paginate } from './paginate.js';
import { FONT_STACKS, pageDims } from '../constants/templates.js';
import { SRC_RE, appendText } from '../utils/richtext.js';

const PX_PER_MM = 96 / 25.4;
const Marks = ({ value, model }) => <span className="q-marks">[{model.D(value)}]</span>;
const inlineMarks = (model, marks) => model.design.question.marksAlign === 'inline' && marks != null;

function StemRow({ block, model }) {
  const inline = inlineMarks(model, block.marks);
  const doc = inline ? appendText(block.doc, ` [${model.D(block.marks)}]`) : block.doc;
  return (
    <div className="q-row">
      <span className="q-no">{block.no}</span>
      <RichHtml doc={doc} />
      {!inline && block.marks != null && <Marks value={block.marks} model={model} />}
    </div>
  );
}

function SubRow({ item, model }) {
  const inline = inlineMarks(model, item.marks);
  const doc = inline ? appendText(item.doc, ` [${model.D(item.marks)}]`) : item.doc;
  return (
    <div className="sub-row">
      <span>{item.label}</span>
      <RichHtml doc={doc} />
      {!inline && item.marks != null && <Marks value={item.marks} model={model} />}
    </div>
  );
}

function BlockView({ block, model }) {
  switch (block.k) {
    case 'stem': return <StemRow block={block} model={model} />;
    case 'keyhead':
      return (
        <div className="q-row">
          <span className="q-no">{block.no}</span>
          <div><strong>{block.text}</strong></div>
          {block.marks != null && <Marks value={block.marks} model={model} />}
        </div>
      );
    case 'doc': return <div className="q-extra"><RichHtml doc={block.doc} /></div>;
    case 'options':
      return (
        <div className="opts" style={{ gridTemplateColumns: `repeat(${block.cols}, minmax(0, 1fr))` }}>
          {block.items.map((o, i) => (
            <div className="opt" key={i}><span className="opt-l">{o.label}</span><div className="opt-b"><RichHtml doc={o.doc} /></div></div>
          ))}
        </div>
      );
    case 'columns': {
      const n = Math.max(block.left.length, block.right.length);
      const cell = (c) => (c ? <div className="opt"><span className="opt-l">{c.label}</span><span>{c.text}</span></div> : <div />);
      return <div className="cols2">{Array.from({ length: n }, (_, i) => [<div key={`l${i}`}>{cell(block.left[i])}</div>, <div key={`r${i}`}>{cell(block.right[i])}</div>])}</div>;
    }
    case 'kv': return <div className="q-extra"><strong>{block.label}</strong> {block.text}</div>;
    case 'list': return <div>{block.items.map((it, i) => <div className="li-row" key={i}><span>{it.label}</span><span>{it.text}</span></div>)}</div>;
    case 'code':
      return (
        <div>
          {block.caption && <div className="q-extra"><strong>{block.caption}</strong></div>}
          <pre className="paper-code">{block.text}</pre>
        </div>
      );
    case 'rubric':
      return (
        <table className="paper-rubric"><tbody>
          {block.items.map((r, i) => <tr key={i}><td>{r.criterion}</td><td style={{ width: '16mm', textAlign: 'right' }}>{model.D(r.marks)}</td></tr>)}
        </tbody></table>
      );
    case 'note': return <div className="q-extra" style={{ fontStyle: 'italic' }}>{block.text}</div>;
    default: return null;
  }
}

function Header({ model }) {
  const { design, info, L, D } = model;
  const h = design.header;
  const logo = h.showLogo && info.logoUrl && SRC_RE.test(info.logoUrl) && h.layout !== 'minimal'
    ? <img src={info.logoUrl} alt="" style={{ height: '16mm', width: 'auto', objectFit: 'contain' }} /> : null;
  const title = info.examName || model.title;
  const subject = [info.subject, info.subjectCode ? `(${L.subjectCode}: ${D(info.subjectCode)})` : ''].filter(Boolean).join(' ');
  const full = info.fullMarks ? D(info.fullMarks) : model.totalMarks ? D(model.totalMarks) : '';
  const cells = [[L.class, info.className], [L.group, info.group], [L.section, info.section], [L.department, info.department], [L.subject, subject], [L.date, info.date], [L.duration, info.duration], [L.fullMarks, full], [L.passMarks, info.passMarks ? D(info.passMarks) : ''], [L.year, info.year]].filter((c) => c[1]);
  const tag = [model.mode === 'key' ? L.answerKey : '', model.setLabel ? `${L.set}: ${model.setLabel}` : ''].filter(Boolean).join(' | ');
  const align = h.layout === 'split' ? 'left' : 'center';
  const text = (
    <div style={{ textAlign: align, flex: 1 }}>
      {h.showInstitution && info.institutionName && <div style={{ fontSize: `${h.layout === 'minimal' ? 13 : h.titleSize}pt`, fontWeight: 700, lineHeight: 1.2 }}>{info.institutionName}</div>}
      {h.showInstitution && info.address && h.layout !== 'minimal' && <div style={{ fontSize: '0.85em' }}>{info.address}</div>}
      {h.showExam && title && <div style={{ fontWeight: 700, marginTop: '1mm', fontSize: '1.05em' }}>{title}</div>}
      {tag && <div style={{ fontWeight: 600 }}>{tag}</div>}
    </div>
  );
  return (
    <div>
      {h.layout === 'split' ? <div style={{ display: 'flex', alignItems: 'center', gap: '4mm' }}>{logo}{text}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1mm' }}>{logo}{text}</div>
      )}
      {cells.length > 0 && (h.infoLayout === 'line' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 6mm', marginTop: '2mm', borderTop: `0.3mm solid ${design.accent}`, paddingTop: '1mm', justifyContent: align === 'left' ? 'flex-start' : 'center' }}>
          {cells.map(([k, v]) => <span key={k}><strong>{k}:</strong> {v}</span>)}
        </div>
      ) : (
        <div className="paper-info-grid">{cells.map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>)}</div>
      ))}
      {info.instructions && <div style={{ marginTop: '2mm', fontSize: '0.9em', fontStyle: 'italic' }}><strong>{L.instructions}:</strong> {info.instructions}</div>}
    </div>
  );
}

function SectionHeading({ s, model }) {
  const { design } = model;
  const st = design.section.style;
  const center = design.section.align === 'center';
  const box = st === 'bar' ? { background: design.accent, color: '#fff', padding: '1mm 2.5mm' }
    : st === 'underline' ? { borderBottom: `0.4mm solid ${design.accent}`, paddingBottom: '0.6mm' }
      : st === 'boxed' ? { border: `0.35mm solid ${design.accent}`, padding: '0.8mm 2.5mm' } : {};
  const row = center
    ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'baseline', fontWeight: 700, ...box }
    : { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4mm', fontWeight: 700, ...box };
  const notes = [s.description, s.instructions, s.ruleText].filter(Boolean).join(' ');
  return (
    <div style={{ marginTop: '1.5mm' }}>
      <div style={row}>
        {center && <span />}
        <span>{s.title}</span>
        {s.marksText ? <span style={{ whiteSpace: 'nowrap', fontWeight: 600, textAlign: 'right' }}>{s.marksText}</span> : center ? <span /> : null}
      </div>
      {notes && <div style={{ fontSize: '0.88em', fontStyle: 'italic', marginTop: '0.8mm' }}>{notes}</div>}
    </div>
  );
}

function Signature({ labels }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14mm' }}>
      {labels.map((l, i) => <div key={i} style={{ borderTop: '0.3mm solid #111', minWidth: '45mm', textAlign: 'center', paddingTop: '1mm' }}>{l}</div>)}
    </div>
  );
}

function buildAtoms(model) {
  const { design } = model;
  const atoms = [{ key: 'header', keepNext: false, gap: 3, node: <Header model={model} /> }];
  model.sections.forEach((s) => {
    atoms.push({ key: `s-${s.id}`, keepNext: true, gap: 1.2, node: <SectionHeading s={s} model={model} /> });
    s.qs.forEach((q) => {
      const parts = [];
      q.blocks.forEach((b, bi) => {
        if (b.k === 'subs') b.items.forEach((it, ii) => parts.push({ id: `${bi}-${ii}`, keep: false, node: <SubRow item={it} model={model} /> }));
        else parts.push({ id: `${bi}`, keep: b.k === 'stem' || b.k === 'keyhead', node: <BlockView block={b} model={model} /> });
      });
      parts.forEach((p, i) => atoms.push({ key: `q-${q.id}-${p.id}`, keepNext: p.keep && i < parts.length - 1, gap: i === parts.length - 1 ? design.question.spacing : 0.8, node: p.node }));
    });
  });
  if (design.signature.enabled && design.signature.labels.length) atoms.push({ key: 'sig', keepNext: false, gap: 0, node: <Signature labels={design.signature.labels} /> });
  return atoms;
}

function PageFooter({ n, total, model, footerH }) {
  const { design, L, D } = model;
  const f = design.footer;
  const m = design.margins;
  const num = f.pageNumbers ? (f.format === 'n' ? D(n) : `${L.page} ${D(n)} ${L.of} ${D(total)}`) : '';
  return (
    <footer className="paper-footer" style={{ left: `${m.left}mm`, right: `${m.right}mm`, bottom: `${m.bottom}mm`, height: `${footerH}mm` }}>
      <span>{f.text}</span><span>{num}</span>
    </footer>
  );
}

// WYSIWYG paged paper. The same component is used by the live preview and the print route,
// so what you see is what the browser prints (pages are real fixed-size boxes).
export default function PaperDocument({ paper, items, keys, mode = 'paper', scale = 1, onLayout }) {
  const model = useMemo(() => buildPaperModel({ paper, items, keys, mode }), [paper, items, keys, mode]);
  const atoms = useMemo(() => buildAtoms(model), [model]);
  const { design } = model;
  const [pw, ph] = pageDims(design);
  const m = design.margins;
  const footerH = design.footer.enabled ? 9 : 0;
  const contentW = pw - m.left - m.right;
  const contentH = ph - m.top - m.bottom - footerH;
  const measureRef = useRef(null);
  const layoutRef = useRef(onLayout);
  layoutRef.current = onLayout;
  const [pages, setPages] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTick((v) => v + 1));
  }, []);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setTick((v) => v + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const heights = Array.from(el.children).map((c) => c.getBoundingClientRect().height);
    setPages(paginate(heights, atoms.map((a) => a.keepNext), contentH * PX_PER_MM));
  }, [atoms, contentH, contentW, tick]);

  useEffect(() => { if (pages && layoutRef.current) layoutRef.current({ pageCount: pages.length }); }, [pages]);

  const typo = { fontFamily: (FONT_STACKS[design.fontFamily] || FONT_STACKS.serifBn).css, fontSize: `${design.fontSize}pt`, lineHeight: design.lineHeight };
  const b = design.border;
  const atomEl = (a) => <div className="atom" key={a.key} style={{ paddingBottom: `${a.gap}mm` }}>{a.node}</div>;

  return (
    <>
      <div className="paper-stack" style={scale !== 1 ? { zoom: scale } : undefined}>
        {(pages || []).map((idxs, pi) => (
          <section key={pi} className="paper-page" style={{ width: `${pw}mm`, height: `${ph - 0.5}mm`, padding: `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`, ...typo }}>
            {b.enabled && <div className="paper-border" style={{ inset: `${b.inset}mm`, border: `${b.width}mm ${b.style} ${b.color}` }} />}
            {design.watermark.enabled && design.watermark.text && <div className="paper-wm" style={{ opacity: design.watermark.opacity }}>{design.watermark.text}</div>}
            <div className="paper-content" style={{ height: `${contentH}mm` }}>{idxs.map((i) => atomEl(atoms[i]))}</div>
            {design.footer.enabled && <PageFooter n={pi + 1} total={pages.length} model={model} footerH={footerH} />}
          </section>
        ))}
      </div>
      <div ref={measureRef} className="paper-measure paper-content" style={{ width: `${contentW}mm`, ...typo }} aria-hidden="true">{atoms.map(atomEl)}</div>
    </>
  );
}
