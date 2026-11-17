import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Field, Input, Select } from '../../components/common/Field.jsx';
import { Badge } from '../../components/common/Misc.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { getAiKey, setAiKey, clearAiKey, getAiModel, setAiModel, looksLikeKey } from '../../services/aiKey.js';
import { checkKey } from '../../services/gemini.js';

const KEY_PAGE = 'https://aistudio.google.com/apikey';

// Free AI setup: every user pastes their own Google Gemini key once. It stays in this browser only.
export default function KeyPanel({ uid, open, onOpenChange, onKeyChange }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(() => !!getAiKey(uid));
  const [model, setModel] = useState(() => getAiModel(uid));
  const [models, setModels] = useState([]);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setSaved(!!getAiKey(uid));
    setModel(getAiModel(uid));
    setModels([]);
    setStatus(null);
  }, [uid]);

  const check = async (key) => {
    setChecking(true);
    setStatus(null);
    try {
      const r = await checkKey({ key });
      setModels(r.ids);
      setStatus({ ok: true, text: t('The key works. Automatic model: {m}', { m: r.auto[0] || '-' }) });
    } catch (e) {
      setStatus({ ok: false, text: t(e.message, e.params) });
    } finally {
      setChecking(false);
    }
  };

  const save = () => {
    const k = draft.trim();
    if (!looksLikeKey(k)) { setStatus({ ok: false, text: t('That does not look like a Gemini key. Copy the whole key.') }); return; }
    setAiKey(uid, k);
    setDraft('');
    setSaved(true);
    onKeyChange(true);
    check(k);
  };

  const remove = () => {
    clearAiKey(uid);
    setAiModel(uid, '');
    setSaved(false);
    setModel('');
    setModels([]);
    setStatus(null);
    onKeyChange(false);
  };

  const pick = (e) => {
    setModel(e.target.value);
    setAiModel(uid, e.target.value);
  };

  return (
    <div className="panel mb-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted" />
        <strong className="text-sm">{t('Free AI key (Google Gemini)')}</strong>
        {saved ? <Badge tone="brand">{t('Key saved')}</Badge> : <Badge tone="warn">{t('Key needed')}</Badge>}
        <Button size="sm" className="ml-auto" onClick={() => onOpenChange(!open)}>{open ? t('Hide') : saved ? t('Manage key') : t('Set up')}</Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <p>{t('The AI generator uses your own free Google Gemini key. No card or payment is needed. The key stays only in this browser.')}</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>{t('Open Google AI Studio and sign in with a Google account:')} <a className="text-brand underline" href={KEY_PAGE} target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a></li>
            <li>{t('Tap "Create API key" and copy the key.')}</li>
            <li>{t('Paste the key below and tap Save.')}</li>
          </ol>
          <Field label={t('Gemini API key')}>
            <Input type="password" name="gemini-key" autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={saved ? t('Paste a new key to replace the saved one') : 'AIza...'} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={!draft.trim()} onClick={save}>{t('Save key')}</Button>
            {saved && <Button size="sm" loading={checking} onClick={() => check(getAiKey(uid))}>{t('Check key')}</Button>}
            {saved && <Button size="sm" variant="danger" onClick={remove}>{t('Remove key')}</Button>}
          </div>
          {status && <p role="status" className={status.ok ? 'text-sm text-brand' : 'text-sm text-danger'}>{status.text}</p>}
          {(models.length > 0 || model) && (
            <Field label={t('Model')} hint={t('Leave on automatic unless a model stops working.')}>
              <Select value={model} onChange={pick}>
                <option value="">{t('Automatic (recommended)')}</option>
                {(models.length ? models : [model]).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
          )}
          <p className="text-xs text-muted">{t('Free use has daily limits set by Google, and Google may use free-tier content to improve its products. Do not paste private student data.')}</p>
        </div>
      )}
    </div>
  );
}
