import { useEffect, useRef, useState } from 'react';
import PaperDocument from './PaperDocument.jsx';
import { resolveDesign, pageDims } from '../constants/templates.js';
import { Select } from '../components/common/Field.jsx';
import { useI18n } from '../i18n/index.jsx';

const PX_PER_MM = 96 / 25.4;

// Screen preview: fits the paper to the panel width (or a fixed zoom) on a flat "desk" background.
export default function PaperViewer({ paper, items, keys, mode = 'paper', className = '' }) {
  const { t } = useI18n();
  const box = useRef(null);
  const [w, setW] = useState(600);
  const [zoom, setZoom] = useState('fit');
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [pw] = pageDims(resolveDesign(paper.design));
  const fit = Math.min(1.5, Math.max(0.25, (w - 32) / (pw * PX_PER_MM)));
  const scale = zoom === 'fit' ? fit : Number(zoom);

  return (
    <div className={`flex min-h-0 flex-col bg-bg ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-1.5 text-sm">
        <span className="text-muted">{t('{n} page(s)', { n: count })}</span>
        <Select className="h-8 w-auto text-xs" value={zoom} onChange={(e) => setZoom(e.target.value)} aria-label={t('Zoom')}>
          <option value="fit">{t('Fit width')}</option>
          {[0.5, 0.75, 1, 1.25].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
        </Select>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-auto p-4">
        <PaperDocument paper={paper} items={items} keys={keys} mode={mode} scale={scale} onLayout={(l) => setCount(l.pageCount)} />
      </div>
    </div>
  );
}
