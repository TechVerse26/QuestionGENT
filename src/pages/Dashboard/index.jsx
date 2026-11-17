import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { FilePlus, Plus, Library, Upload, LayoutTemplate, Download } from 'lucide-react';
import { PageHeader, Badge, Skeleton, EmptyState } from '../../components/common/Misc.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useAuthStore } from '../../store/authStore.js';
import { countAll, countBetween, monthStart, listActivity } from '../../services/activityService.js';
import { listPapers } from '../../services/paperService.js';
import { listMembers } from '../../services/institutionService.js';
import { millis } from '../../services/db.js';
import { PAPER_FULL_ACCESS, PUBLISHED_STATUSES } from '../../constants/roles.js';

const STATUS_TONE = { draft: '', review: 'warn', approved: 'info', published: 'brand' };
const ACTION_TEXT = {
  'paper.review': 'submitted a paper for review', 'paper.approved': 'approved a paper', 'paper.published': 'published a paper', 'paper.draft': 'moved a paper back to draft',
};

function ranges(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const from = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
  });
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user, institution, institutionId, role, can } = useCurrent();
  const memberships = useAuthStore((s) => s.memberships);
  const [stats, setStats] = useState(null);
  const [papers, setPapers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [names, setNames] = useState({});
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const full = PAPER_FULL_ACCESS.includes(role);
  const canChart = full || can('analytics.view');

  useEffect(() => {
    if (!institutionId) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      const pc = full ? [] : role === 'teacher' ? [where('createdBy', '==', user.uid)] : [where('status', 'in', PUBLISHED_STATUSES)];
      const now = new Date();
      const r = await Promise.allSettled([
        countAll('questionBank', institutionId),
        countAll('questionBank', institutionId, where('type', '==', 'mcq')),
        countAll('questionBank', institutionId, where('type', '==', 'cq')),
        countAll('questionPapers', institutionId, ...pc),
        countAll('questionPapers', institutionId, ...pc, where('status', '==', 'draft')),
        countAll('paperTemplates', institutionId),
        countAll('memberships', institutionId),
        countBetween('exports', institutionId, monthStart(now), new Date(now.getFullYear(), now.getMonth() + 1, 1)),
      ]);
      if (!alive) return;
      const v = r.map((x) => (x.status === 'fulfilled' ? x.value : null));
      setStats({ questions: v[0], mcq: v[1], cq: v[2], papers: v[3], drafts: v[4], templates: v[5], teachers: v[6], exports: v[7] });
      listPapers(institutionId, { uid: user.uid, role }).then((l) => alive && setPapers(l.slice(0, 6))).catch(() => {});
      if (can('analytics.view')) {
        listActivity(institutionId, 8).then((l) => alive && setActivity(l)).catch(() => {});
        listMembers(institutionId).then((m) => alive && setNames(Object.fromEntries(m.map((x) => [x.uid, x.displayName || x.email])))).catch(() => {});
      }
      if (canChart) {
        const rs = ranges(6);
        Promise.all(rs.map(async ({ from, to }) => ({
          month: from.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short' }),
          papers: await countBetween('questionPapers', institutionId, from, to).catch(() => 0),
          questions: await countBetween('questionBank', institutionId, from, to).catch(() => 0),
        }))).then((d) => alive && setMonthly(d));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [institutionId, role, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = stats ? [
    ['Total questions', stats.questions], ['MCQs', stats.mcq], ['Creative questions', stats.cq], ['Question papers', stats.papers], ['Draft papers', stats.drafts],
    ['Saved templates', stats.templates], ['Teachers and staff', stats.teachers], ['Institutions', memberships.length], ['Exports this month', stats.exports],
  ] : [];

  const shortcuts = [
    can('papers.create') && ['/app/papers?new=1', FilePlus, 'Create new paper'],
    can('questions.create') && ['/app/question-bank?new=1', Plus, 'Add new question'],
    can('questions.view') && ['/app/question-bank', Library, 'Open question bank'],
    can('import.use') && ['/app/import-export', Upload, 'Import questions'],
    ['/app/templates', LayoutTemplate, 'Browse templates'],
    can('papers.export') && ['/app/papers', Download, 'Export documents'],
  ].filter(Boolean);

  return (
    <div>
      <PageHeader title={t('Welcome, {name}', { name: (user.displayName || '').split(' ')[0] || user.email })} subtitle={institution ? institution.name : ''} />
      <div className="mb-5 flex flex-wrap gap-2">
        {shortcuts.map(([to, Icon, label]) => <Link key={label} to={to} className="btn"><Icon className="h-4 w-4" />{t(label)}</Link>)}
      </div>

      <div className="panel mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {loading && !stats ? Array.from({ length: 9 }, (_, i) => <div key={i} className="border-b border-r border-line p-4"><Skeleton className="h-6 w-12" /></div>)
          : tiles.map(([label, value]) => (
            <div key={label} className="border-b border-r border-line p-4">
              <p className="text-2xl font-bold">{value === null || value === undefined ? '—' : value}</p>
              <p className="text-sm text-muted">{t(label)}</p>
            </div>
          ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel">
          <h2 className="border-b border-line px-4 py-3 text-base">{t('Recent question papers')}</h2>
          {!papers.length ? <EmptyState title={t('No papers yet')} text={t('Create your first paper to see it here.')} /> : (
            <ul>
              {papers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                  <Link className="min-w-0 truncate text-sm font-medium hover:text-brand" to={`/app/papers/${p.id}`}>{p.title || (p.info && p.info.examName) || t('Untitled paper')}</Link>
                  <span className="flex shrink-0 items-center gap-2"><Badge tone={STATUS_TONE[p.status]}>{t(p.status)}</Badge><span className="text-xs text-muted">{new Date(millis(p.updatedAt)).toLocaleDateString()}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2 className="border-b border-line px-4 py-3 text-base">{t('Recent activity')}</h2>
          {!activity.length ? <p className="p-4 text-sm text-muted">{can('analytics.view') ? t('No activity yet.') : t('Activity is visible to administrators.')}</p> : (
            <ul>{activity.map((a) => (
              <li key={a.id} className="border-b border-line px-4 py-2 text-sm last:border-b-0">
                <strong>{names[a.userId] || t('Someone')}</strong> {t(ACTION_TEXT[a.action] || a.action)}
                <span className="ml-2 text-xs text-muted">{new Date(millis(a.createdAt)).toLocaleString()}</span>
              </li>
            ))}</ul>
          )}
        </section>
      </div>

      {canChart && monthly.length > 0 && (
        <section className="panel mt-5 p-4">
          <h2 className="mb-3 text-base">{t('Created in the last 6 months')}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid stroke="#9aa9a1" strokeOpacity={0.3} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 5, border: '1px solid #cdd6d0', boxShadow: 'none' }} />
                <Legend />
                <Bar dataKey="papers" name={t('Papers')} fill="#0B6E4F" />
                <Bar dataKey="questions" name={t('Questions')} fill="#8CA096" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
