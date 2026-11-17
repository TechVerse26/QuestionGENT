import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { renderMath } from './katexRender.js';

const SNIPPETS = [
  ['a/b', '\\frac{a}{b}'], ['√', '\\sqrt{x}'], ['xⁿ', 'x^{n}'], ['xₙ', 'x_{n}'], ['Σ', '\\sum_{i=1}^{n}'], ['∫', '\\int_{a}^{b}'],
  ['[ ]', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'], ['π', '\\pi'], ['θ', '\\theta'], ['α', '\\alpha'], ['β', '\\beta'], ['Δ', '\\Delta'],
  ['×', '\\times'], ['÷', '\\div'], ['±', '\\pm'], ['≤', '\\leq'], ['≥', '\\geq'], ['≠', '\\neq'], ['≈', '\\approx'], ['∞', '\\infty'],
  ['→', '\\rightarrow'], ['°', '^{\\circ}'], ['v⃗', '\\vec{v}'], ['∠', '\\angle'], ['△', '\\triangle'], ['AB̅', '\\overline{AB}'],
];

export default function MathDialog({ open, initial, onClose, onApply }) {
  const { t } = useI18n();
  const [latex, setLatex] = useState('');
  const [display, setDisplay] = useState(false);
  const ta = useRef(null);

  useEffect(() => {
    if (open) { setLatex((initial && initial.latex) || ''); setDisplay(!!(initial && initial.display)); }
  }, [open, initial]);

  const html = useMemo(() => renderMath(latex || '\\square', display), [latex, display]);

  const insert = (snip) => {
    const el = ta.current;
    const start = el ? el.selectionStart : latex.length;
    const end = el ? el.selectionEnd : latex.length;
    setLatex((v) => v.slice(0, start) + snip + v.slice(end));
    if (el) setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + snip.length; }, 0);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('Math formula (LaTeX)')} size="md"
      footer={(<><Button onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={!latex.trim()} onClick={() => onApply({ latex: latex.trim(), display })}>{initial && initial.pos != null ? t('Update') : t('Insert')}</Button></>)}>
      <div className="mb-2 flex flex-wrap gap-1">
        {SNIPPETS.map(([label, snip]) => <button key={snip} type="button" className="btn btn-sm px-2" onClick={() => insert(snip)}>{label}</button>)}
      </div>
      <textarea ref={ta} className="input font-mono" rows={3} value={latex} onChange={(e) => setLatex(e.target.value)} placeholder="\frac{a}{b} + x^{2}" spellCheck={false} />
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={display} onChange={(e) => setDisplay(e.target.checked)} />{t('Show on its own line (centered)')}</label>
      <p className="label mt-3">{t('Preview')}</p>
      <div className="min-h-[3rem] overflow-x-auto rounded border border-line bg-surface2 p-3" dangerouslySetInnerHTML={{ __html: html }} />
    </Modal>
  );
}
