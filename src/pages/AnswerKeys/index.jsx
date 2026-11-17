import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Printer, FileText, Pencil } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Field.jsx';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import PaperViewer from '../../preview/PaperViewer.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { listPapers, loadPaper } from '../../services/paperService.js';
import { runExport } from '../../export/runExport.js';
import { paperSummary } from '../../utils/marks.js';

// Separate answer-key view. Data comes from the protected answerKeys collection (rules decide who can read it).
export default function AnswerKeys() {
  const { t } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId, role, can } = useCurrent();
  const [papers, setPapers] = useState(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { listPapers(institutionId, { uid: user.uid, role }).then(setPapers).catch((e) => { toast.error(t(e.message)); setPapers([]); }); }, [institutionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sel) { setData(null); return; }
    setLoading(true);
    loadPaper(sel, institutionId, true).then(setData).catch((e) => toast.error(t(e.message))).finally(() => setLoading(false));
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (papers || []).filter((p) => !q || `${p.title} ${p.info && p.info.subject}`.toLowerCase().includes(q.toLowerCase())), [papers, q]);
  const missing = useMemo(() => (data ? paperSummary(data.paper, data.items, data.keys).issues.filter((i) => i.code === 'mcq_no_answer' || i.code === 'tf_no_answer').length : 0), [data]);
  const exp = async (kind) => {
    try { await runExport(kind, data, { institution, institutionId, uid: user.uid, canKeys: true }); } catch (e) { toast.error(t(e.message)); }
  };

  return (
    <div>
      <PageHeader title={t('Answer keys')} subtitle={t('Answers and marking guidelines are stored separately and shown only to roles with access.')} />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="panel max-h-[calc(100vh-11rem)] overflow-y-auto">
          <div className="border-b border-line p-2"><Input placeholder={t('Search papers')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {papers === null && <div className="flex justify-center p-6"><Spinner /></div>}
          {papers && !rows.length && <p className="p-4 text-sm text-muted">{t('No papers found')}</p>}
          {rows.map((p) => (
            <button key={p.id} type="button" onClick={() => setSel(p.id)} className={`block w-full border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface2 ${sel === p.id ? 'bg-brand-soft font-semibold' : ''}`}>
              {p.title || (p.info && p.info.examName) || p.id}
              <span className="mt-0.5 block text-xs font-normal text-muted">{t(p.status)}</span>
            </button>
          ))}
        </aside>
        <section className="panel flex min-h-[420px] flex-col overflow-hidden">
          {!sel && <EmptyState icon={KeyRound} title={t('Choose a paper')} text={t('Its answer key will appear here.')} />}
          {sel && loading && <div className="flex flex-1 items-center justify-center"><Spinner className="h-7 w-7" /></div>}
          {sel && data && !loading && (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
                <strong className="mr-2 text-sm">{data.paper.title}</strong>
                {missing > 0 && <Badge tone="warn">{t('{n} question(s) without an answer', { n: missing })}</Badge>}
                <div className="ml-auto flex flex-wrap gap-2">
                  {can('papers.export') && <Button size="sm" icon={Printer} onClick={() => exp('keyprint')}>{t('Print / PDF')}</Button>}
                  {can('papers.export') && <Button size="sm" icon={FileText} onClick={() => exp('keydocx')}>Word</Button>}
                  {can('answerKeys.edit') && <Link className="btn btn-sm" to={`/app/papers/${data.paper.id}`}><Pencil className="h-4 w-4" />{t('Edit in builder')}</Link>}
                </div>
              </div>
              <PaperViewer className="min-h-0 flex-1" paper={data.paper} items={data.items} keys={data.keys} mode="key" />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
