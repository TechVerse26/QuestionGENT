import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Copy, Trash2, Pencil, FilePlus } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Badge, PageHeader } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { listTemplates, saveTemplate, deleteTemplate } from '../../services/templateService.js';
import { BUILTIN_TEMPLATES, resolveDesign } from '../../constants/templates.js';
import { ADVANCED_TEMPLATES, limitOf } from '../../constants/plans.js';

// A flat miniature of a template: border, header style and section heading style
export function Swatch({ design }) {
  const d = resolveDesign(design);
  const bar = d.section.style === 'bar';
  const line = (w) => <div className="h-[3px] bg-[#c9d2cc]" style={{ width: w }} />;
  const head = (
    <div className={`mt-1.5 ${bar ? 'px-1 py-[2px]' : d.section.style === 'boxed' ? 'border px-1 py-[2px]' : d.section.style === 'underline' ? 'border-b pb-[2px]' : ''}`}
      style={{ background: bar ? d.accent : undefined, borderColor: d.accent }}>
      <div className="h-[3px]" style={{ width: '45%', background: bar ? '#fff' : d.accent }} />
    </div>
  );
  return (
    <div className="relative mx-auto h-40 w-28 bg-white p-2" style={{ border: d.border.enabled ? `2px ${d.border.style} ${d.border.color}` : '1px solid #c9d2cc' }} aria-hidden="true">
      <div className={`flex gap-1 ${d.header.layout === 'split' ? '' : 'flex-col items-center'}`}>
        {d.header.layout !== 'minimal' && <div className="h-4 w-4 shrink-0" style={{ background: d.accent, opacity: 0.8 }} />}
        <div className="flex-1 space-y-[2px]">{line('80%')}{line('55%')}</div>
      </div>
      {head}
      <div className="mt-1 space-y-[3px]">{line('95%')}{line('70%')}{line('85%')}</div>
      {head}
      <div className="mt-1 space-y-[3px]">{line('90%')}{line('60%')}</div>
      {d.watermark.enabled && <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black opacity-10" style={{ transform: 'rotate(-30deg)' }}>{d.watermark.text}</div>}
    </div>
  );
}

export default function Templates() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, institution, institutionId, can } = useCurrent();
  const [mine, setMine] = useState([]);
  const manage = can('templates.manage');
  const load = () => listTemplates(institutionId).then(setMine).catch(() => setMine([]));
  useEffect(() => { load(); }, [institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = (id) => ADVANCED_TEMPLATES.includes(id) && !limitOf(institution.plan, 'advancedTemplates');
  const name = (x) => (typeof x.name === 'string' ? x.name : x.name[lang] || x.name.en);

  const dup = async (x) => {
    try { await saveTemplate({ institutionId, uid: user.uid, name: `${name(x)} (copy)`, design: resolveDesign(x.design) }); toast.success(t('Template duplicated')); load(); } catch (e) { toast.error(t(e.message)); }
  };
  const del = async (x) => {
    if (!(await confirm({ title: t('Delete template'), message: t('Delete "{name}"? Papers that used it keep their layout.', { name: name(x) }), danger: true, confirmLabel: t('Delete') }))) return;
    try { await deleteTemplate(x.id); toast.success(t('Deleted')); load(); } catch (e) { toast.error(t(e.message)); }
  };

  const Tile = ({ x, builtin }) => (
    <div className="panel flex flex-col p-3">
      <Swatch design={x.design} />
      <div className="mt-3 flex items-center gap-2"><h3 className="text-sm">{name(x)}</h3>{builtin && locked(x.id) && <Badge tone="warn"><Lock className="mr-1 h-3 w-3" />{t('Paid plan')}</Badge>}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {can('papers.create') && !(builtin && locked(x.id)) && <Link className="btn btn-sm btn-primary" to={`/app/papers?template=${x.id}`}><FilePlus className="h-4 w-4" />{t('Use')}</Link>}
        {manage && builtin && <Button size="sm" icon={Pencil} onClick={() => nav(`/app/design-studio/new?from=${x.id}`)}>{t('Customize')}</Button>}
        {manage && !builtin && <Button size="sm" icon={Pencil} onClick={() => nav(`/app/design-studio/${x.id}`)}>{t('Edit')}</Button>}
        {manage && !builtin && <Button size="icon" variant="ghost" onClick={() => dup(x)} aria-label={t('Duplicate')}><Copy className="h-4 w-4" /></Button>}
        {manage && !builtin && (can('institution.manage') || x.createdBy === user.uid) && <Button size="icon" variant="ghost" onClick={() => del(x)} aria-label={t('Delete')}><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title={t('Templates')} subtitle={t('Ready-made layouts and your own saved designs')} actions={manage && <Link className="btn btn-primary" to="/app/design-studio/new">{t('New design')}</Link>} />
      <h2 className="mb-2 text-base">{t('Your templates')}</h2>
      {mine.length ? <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{mine.map((x) => <Tile key={x.id} x={x} />)}</div> : <p className="mb-6 text-sm text-muted">{t('No saved templates yet. Customize a ready-made one or start a new design.')}</p>}
      <h2 className="mb-2 text-base">{t('Ready-made templates')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{BUILTIN_TEMPLATES.map((x) => <Tile key={x.id} x={x} builtin />)}</div>
    </div>
  );
}
