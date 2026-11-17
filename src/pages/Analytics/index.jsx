import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PageHeader, Spinner } from '../../components/common/Misc.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useBank } from '../../store/bankStore.js';
import { listPapers } from '../../services/paperService.js';
import { listLogs, listActivity } from '../../services/activityService.js';
import { listMembers } from '../../services/institutionService.js';
import { getUsage } from '../../services/planService.js';
import { millis } from '../../services/db.js';
import { typeLabel } from '../../constants/questionTypes.js';
import { limitOf } from '../../constants/plans.js';

const tip = { contentStyle: { borderRadius: 5, border: '1px solid #cdd6d0', boxShadow: 'none' } };

function Chart({ title, data, horizontal = false, color = '#0B6E4F' }) {
  const { t } = useI18n();
  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-base">{title}</h2>
      {!data.length ? <p className="py-8 text-center text-sm text-muted">{t('No data yet.')}</p> : (
        <div style={{ height: horizontal ? Math.max(180, data.length * 32) : 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: horizontal ? 24 : 0 }}>
              <CartesianGrid stroke="#9aa9a1" strokeOpacity={0.3} horizontal={!horizontal} vertical={horizontal} />
              {horizontal ? <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} /> : <XAxis dataKey="name" tick={{ fontSize: 12 }} />}
              {horizontal ? <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} /> : <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />}
              <Tooltip {...tip} />
              <Bar dataKey="value" fill={color} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

const tally = (list, fn) => { const m = {}; list.forEach((x) => { const k = fn(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); };

export default function Analytics() {
  const { t, lang } = useI18n();
  const { user, institution, institutionId, role } = useCurrent();
  const bank = useBank((s) => s.items);
  const [papers, setPapers] = useState(null);
  const [exportsL, setExportsL] = useState([]);
  const [activity, setActivity] = useState([]);
  const [names, setNames] = useState({});
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    useBank.getState().load(institutionId);
    listPapers(institutionId, { uid: user.uid, role }).then(setPapers).catch(() => setPapers([]));
    listLogs('exports', institutionId, 300).then(setExportsL).catch(() => {});
    listActivity(institutionId, 300).then(setActivity).catch(() => {});
    listMembers(institutionId).then((m) => setNames(Object.fromEntries(m.map((x) => [x.uid, x.displayName || x.email])))).catch(() => {});
    getUsage(institutionId, true).then(setUsage).catch(() => {});
  }, [institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => bank.filter((x) => x.status !== 'archived'), [bank]);
  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const n = (papers || []).filter((p) => { const m = new Date(millis(p.createdAt)); return m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth(); }).length;
      return { name: d.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short' }), value: n };
    });
  }, [papers, lang]);

  if (papers === null) return <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>;
  const aiLimit = limitOf(institution.plan, 'aiCredits');

  return (
    <div>
      <PageHeader title={t('Analytics')} subtitle={t('Based on the latest 1000 questions, 300 papers and 300 log entries.')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title={t('Questions by type')} data={tally(active, (x) => typeLabel(x.type, lang))} horizontal />
        <Chart title={t('Papers created per month')} data={monthly} />
        <Chart title={t('Papers by status')} data={tally(papers, (x) => t(x.status))} color="#1F5EA8" />
        <Chart title={t('Exports by format')} data={tally(exportsL, (x) => x.format)} color="#8CA096" />
        <Chart title={t('Questions by class')} data={tally(active, (x) => x.className).slice(0, 8)} horizontal />
        <Chart title={t('Questions by subject')} data={tally(active, (x) => x.subject).slice(0, 8)} horizontal />
        <Chart title={t('Activity by member')} data={tally(activity, (x) => names[x.userId] || x.userId).slice(0, 8)} horizontal color="#1F5EA8" />
        <section className="panel p-4">
          <h2 className="mb-3 text-base">{t('Plan usage')}</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>{t('Plan')}</span><strong>{institution.plan}</strong></li>
            <li className="flex justify-between"><span>{t('AI credits used')}</span><strong>{institution.aiUsed || 0} / {aiLimit === -1 ? t('unlimited') : aiLimit}</strong></li>
            {usage && <li className="flex justify-between"><span>{t('Exports this month')}</span><strong>{usage.exportsMonth}</strong></li>}
            {usage && <li className="flex justify-between"><span>{t('Members')}</span><strong>{usage.users}</strong></li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
