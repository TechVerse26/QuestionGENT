import { RichField, KeySection, useQ } from '../common.jsx';
import { Input } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';

// Renders the fields of an institution-defined custom question type (definition is snapshotted in body.def)
export default function CustomQuestionEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey } = useQ(update);
  const def = q.body.def || { name: '', fields: [] };
  const values = q.body.values || {};
  const setValue = (id, v) => setBody({ values: { ...values, [id]: v } });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('Custom type')}: <strong>{def.name}</strong></p>
      {def.fields.map((f) => (f.kind === 'text' ? (
        <div key={f.id}><label className="label">{f.label}</label><Input value={typeof values[f.id] === 'string' ? values[f.id] : ''} onChange={(e) => setValue(f.id, e.target.value)} /></div>
      ) : (
        <RichField key={f.id} label={f.label} value={values[f.id]} onChange={(doc) => setValue(f.id, doc)} minHeight={70} />
      )))}
      <KeySection canKey={canKey}>
        <RichField label={t('Model answer')} value={q.key && q.key.answer} onChange={(answer) => setKey({ answer })} minHeight={60} compact />
      </KeySection>
    </div>
  );
}
