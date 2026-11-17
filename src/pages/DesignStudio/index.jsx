import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Field, Input } from '../../components/common/Field.jsx';
import { PageHeader, Spinner } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import DesignControls from '../../components/design/DesignControls.jsx';
import PaperViewer from '../../preview/PaperViewer.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { listTemplates, saveTemplate } from '../../services/templateService.js';
import { BUILTIN_TEMPLATES, builtinById, resolveDesign } from '../../constants/templates.js';
import { buildSamplePaper } from '../../constants/samplePaper.js';

export default function DesignStudio() {
  const { templateId } = useParams();
  const [sp] = useSearchParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { user, institution, institutionId } = useCurrent();
  const existing = templateId && templateId !== 'new' ? templateId : null;
  const [name, setName] = useState('');
  const [design, setDesign] = useState(resolveDesign({}));
  const [loading, setLoading] = useState(!!existing);
  const [saving, setSaving] = useState(false);
  const sample = useMemo(() => buildSamplePaper(), []);

  useEffect(() => {
    if (existing) {
      listTemplates(institutionId).then((l) => {
        const x = l.find((i) => i.id === existing);
        if (x) { setName(x.name); setDesign(resolveDesign(x.design)); }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      const base = builtinById(sp.get('from'));
      if (base) { setDesign({ ...resolveDesign(base.design) }); setName(`${base.name[lang]} (${t('custom')})`); }
    }
  }, [existing, institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const paper = useMemo(() => ({
    ...sample.paper, design,
    info: { ...sample.paper.info, institutionName: institution.name || sample.paper.info.institutionName, logoUrl: institution.logoUrl || '', address: institution.address || sample.paper.info.address },
  }), [sample, design, institution]);

  const applyBuiltin = (id) => { const b = BUILTIN_TEMPLATES.find((x) => x.id === id); if (b) setDesign({ ...resolveDesign(b.design), templateId: id }); };

  const save = async () => {
    if (!name.trim()) { toast.error(t('Give the template a name.')); return; }
    setSaving(true);
    try {
      await saveTemplate({ id: existing, institutionId, uid: user.uid, name: name.trim(), design });
      toast.success(t('Template saved'));
      nav('/app/templates');
    } catch (e) { toast.error(t(e.message)); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>;

  return (
    <div>
      <PageHeader title={t('Design studio')} subtitle={t('Changes appear in the sample paper immediately.')}
        actions={(<><Input className="w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Template name')} aria-label={t('Template name')} /><Button variant="primary" icon={Save} loading={saving} onClick={save}>{t('Save template')}</Button></>)} />
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,430px)_1fr]">
        <div className="panel max-h-[calc(100vh-11rem)] overflow-y-auto p-3"><DesignControls value={design} onChange={setDesign} templates={BUILTIN_TEMPLATES} onTemplate={applyBuiltin} /></div>
        <div className="panel h-[calc(100vh-11rem)] overflow-hidden"><PaperViewer className="h-full" paper={paper} items={sample.items} keys={{}} /></div>
      </div>
    </div>
  );
}
