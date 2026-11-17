import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import { PageHeader, Spinner } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { getUsage, startPayment } from '../../services/planService.js';
import { PLANS, PLAN_ORDER, limitOf } from '../../constants/plans.js';

const ROWS = [['users', 'Members'], ['papers', 'Papers'], ['questions', 'Questions in the bank'], ['aiCredits', 'AI generation credits'], ['exportsPerMonth', 'Exports per month'], ['advancedTemplates', 'Advanced templates']];

function Bar({ used, limit }) {
  const { t } = useI18n();
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span>{used} / {limit === -1 ? t('unlimited') : limit}</span></div>
      <div className="h-2 bg-line"><div className={`h-2 ${pct >= 90 ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${limit === -1 ? 4 : pct}%` }} /></div>
    </div>
  );
}

export default function Subscription() {
  const { t } = useI18n();
  const toast = useToast();
  const [sp] = useSearchParams();
  const { institution, institutionId } = useCurrent();
  const [usage, setUsage] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { getUsage(institutionId, true).then(setUsage).catch(() => setUsage({})); }, [institutionId]);

  const pay = async (plan) => {
    setBusy(plan);
    try {
      const res = await startPayment({ institutionId, plan });
      if (res && res.url) window.location.href = res.url;
      else throw new Error('The payment service did not return a payment page.');
    } catch (e) {
      toast.error(e.code === 'functions/not-found' || e.code === 'functions/internal' ? t('Online payment is not set up for this project yet.') : t(e.message));
    } finally { setBusy(''); }
  };

  const status = sp.get('payment');
  return (
    <div>
      <PageHeader title={t('Subscription')} subtitle={t('Current plan: {plan}', { plan: institution.plan })} />
      {status === 'success' && <p className="mb-4 rounded border border-brand/40 bg-brand-soft p-3 text-sm">{t('Payment received. Your plan updates once the payment provider confirms it; refresh in a moment.')}</p>}
      {status && status !== 'success' && <p className="mb-4 rounded border border-warn/40 bg-warn-soft p-3 text-sm">{t('The payment was not completed.')}</p>}

      <section className="panel mb-5 p-4">
        <h2 className="mb-3 text-base">{t('Usage')}</h2>
        {!usage ? <Spinner /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="label">{t('Members')}</p><Bar used={usage.users || 0} limit={limitOf(institution.plan, 'users')} /></div>
            <div><p className="label">{t('Papers')}</p><Bar used={usage.papers || 0} limit={limitOf(institution.plan, 'papers')} /></div>
            <div><p className="label">{t('Questions in the bank')}</p><Bar used={usage.questions || 0} limit={limitOf(institution.plan, 'questions')} /></div>
            <div><p className="label">{t('Exports this month')}</p><Bar used={usage.exportsMonth || 0} limit={limitOf(institution.plan, 'exportsPerMonth')} /></div>
            <div><p className="label">{t('AI generation credits')}</p><Bar used={institution.aiUsed || 0} limit={limitOf(institution.plan, 'aiCredits')} /></div>
          </div>
        )}
      </section>

      <section className="panel overflow-x-auto">
        <table className="tbl min-w-[720px]">
          <thead><tr><th />{PLAN_ORDER.map((id) => <th key={id} className={id === institution.plan ? 'text-brand' : ''}>{id}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(([k, label]) => (
              <tr key={k}><td className="font-medium">{t(label)}</td>{PLAN_ORDER.map((id) => { const v = PLANS[id].limits[k]; return <td key={id}>{typeof v === 'boolean' ? (v ? t('Yes') : t('No')) : v === -1 ? t('unlimited') : v}</td>; })}</tr>
            ))}
            <tr><td className="font-medium">{t('Price (BDT / month)')}</td>{PLAN_ORDER.map((id) => <td key={id}>{PLANS[id].price === null ? t('Contact us') : PLANS[id].price}</td>)}</tr>
            <tr><td />{PLAN_ORDER.map((id) => (
              <td key={id}>{id === institution.plan ? <span className="text-sm text-brand">{t('Current')}</span> : PLANS[id].price ? <Button size="sm" variant="primary" loading={busy === id} onClick={() => pay(id)}>{t('Choose')}</Button> : null}</td>
            ))}</tr>
          </tbody>
        </table>
      </section>
      <p className="hint mt-3">{t('Limits and prices are configured in src/constants/plans.js. Payments run through a server function and are confirmed by the provider before the plan changes.')}</p>
    </div>
  );
}
