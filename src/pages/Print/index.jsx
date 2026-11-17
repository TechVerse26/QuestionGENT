import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import PaperDocument from '../../preview/PaperDocument.jsx';
import Button from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/Misc.jsx';
import { readPrintPayload } from '../../export/printExport.js';
import { resolveDesign, pageDims } from '../../constants/templates.js';
import { safeName } from '../../utils/download.js';
import { useI18n } from '../../i18n/index.jsx';

// Opened in a new tab by the builder. The same paged component as the preview is printed,
// with @page set to the paper size and zero margins (margins are part of each page).
export default function PrintPage() {
  const { t } = useI18n();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const data = useMemo(() => readPrintPayload(sp.get('k')), [sp]);
  const [pages, setPages] = useState(0);
  const design = data ? resolveDesign(data.paper.design) : null;
  const dims = design ? pageDims(design) : null;
  const dimKey = dims ? dims.join('x') : '';

  useEffect(() => {
    if (!dims) return undefined;
    const st = document.createElement('style');
    st.textContent = `@page { size: ${dims[0]}mm ${dims[1]}mm; margin: 0; }`;
    document.head.appendChild(st);
    return () => st.remove();
  }, [dimKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (data) document.title = safeName(data.paper.title || (data.paper.info && data.paper.info.examName) || 'question-paper') + (data.mode === 'key' ? '-answer-key' : '');
  }, [data]);

  const onLayout = useCallback((l) => setPages(l.pageCount), []);
  // In a browser this tab was opened by the builder, so window.close() works. An installed phone app may open /print in the
  // same window, where window.close() does nothing: then go back to the app instead of leaving the user stuck here.
  const closeView = () => {
    window.close();
    setTimeout(() => { if (!window.closed) { if (window.history.length > 1) nav(-1); else nav('/app/papers', { replace: true }); } }, 250);
  };
  useEffect(() => {
    if (!pages || sp.get('auto') === '0') return undefined;
    const id = setTimeout(() => window.print(), 700);
    return () => clearTimeout(id);
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <EmptyState title={t('Nothing to print')} text={t('Open the print view again from the paper builder.')} />;
  return (
    <div className="min-h-screen bg-bg">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>{t('Print / Save as PDF')}</Button>
        <Button icon={X} onClick={closeView}>{t('Close')}</Button>
        <span className="text-sm text-muted">{t('{n} page(s)', { n: pages })}. {t('In the print dialog choose "Save as PDF", keep margins on "None" and switch off headers and footers.')}</span>
      </div>
      <div className="print-pad p-4">
        <PaperDocument paper={data.paper} items={data.items} keys={data.keys} mode={data.mode} onLayout={onLayout} />
      </div>
    </div>
  );
}
