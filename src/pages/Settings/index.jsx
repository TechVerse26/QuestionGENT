import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Field, Input, Select, Textarea } from '../../components/common/Field.jsx';
import { EmptyState, PageHeader, Tabs } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useAuthStore } from '../../store/authStore.js';
import { useUi } from '../../store/uiStore.js';
import { updateUserProfile, savePrefs } from '../../services/authService.js';
import { updateInstitution } from '../../services/institutionService.js';
import { listCustomTypes, saveCustomType, deleteCustomType } from '../../services/templateService.js';
import { uploadImage, uploadsEnabled } from '../../services/uploadService.js';
import { INSTITUTION_TYPES } from '../../constants/options.js';
import { newId } from '../../utils/id.js';

function ProfileTab() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useCurrent();
  const [name, setName] = useState(user.displayName || '');
  const [photo, setPhoto] = useState(user.photoURL || '');
  const [busy, setBusy] = useState(false);
  const up = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { setPhoto(await uploadImage(f, { maxMB: 2 })); } catch (err) { toast.error(t(err.message)); }
  };
  const save = async () => {
    setBusy(true);
    try { await updateUserProfile(user, { displayName: name.trim(), photoURL: photo.trim() }); await useAuthStore.getState().refresh(); toast.success(t('Profile saved')); } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-lg space-y-3 pt-4">
      <Field label={t('Full name')}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t('Email')}><Input value={user.email || ''} disabled /></Field>
      <Field label={t('Profile picture (image address)')}><Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://" /></Field>
      {uploadsEnabled && <input type="file" accept="image/png,image/jpeg,image/webp" onChange={up} className="text-sm" />}
      <Button variant="primary" loading={busy} onClick={save}>{t('Save')}</Button>
    </div>
  );
}

function InstitutionTab() {
  const { t } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId } = useCurrent();
  const [f, setF] = useState({ name: institution.name || '', type: institution.type || 'school', address: institution.address || '', phone: institution.phone || '', email: institution.email || '', website: institution.website || '', info: institution.info || '', logoUrl: institution.logoUrl || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const up = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { const url = await uploadImage(file); setF((x) => ({ ...x, logoUrl: url })); } catch (err) { toast.error(t(err.message)); }
  };
  const save = async () => {
    if (f.name.trim().length < 2) { toast.error(t('Enter the institution name')); return; }
    setBusy(true);
    try { await updateInstitution(institutionId, { ...f, name: f.name.trim() }); await useAuthStore.getState().hydrate(user); toast.success(t('Institution saved')); } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };
  return (
    <div className="grid max-w-3xl gap-3 pt-4 sm:grid-cols-2">
      <Field label={t('Institution name')}><Input value={f.name} onChange={set('name')} /></Field>
      <Field label={t('Type')}><Select value={f.type} onChange={set('type')}>{INSTITUTION_TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</Select></Field>
      <Field label={t('Address')}><Input value={f.address} onChange={set('address')} /></Field>
      <Field label={t('Phone')}><Input value={f.phone} onChange={set('phone')} /></Field>
      <Field label={t('Email')}><Input value={f.email} onChange={set('email')} /></Field>
      <Field label={t('Website')}><Input value={f.website} onChange={set('website')} placeholder="https://" /></Field>
      <Field label={t('Logo (image address)')} className="sm:col-span-2"><Input value={f.logoUrl} onChange={set('logoUrl')} placeholder="https://" /></Field>
      {uploadsEnabled && <input type="file" accept="image/png,image/jpeg,image/webp" onChange={up} className="text-sm sm:col-span-2" />}
      {f.logoUrl && <img src={f.logoUrl} alt="" className="h-16 w-auto sm:col-span-2" />}
      <Field label={t('About the institution')} className="sm:col-span-2"><Textarea rows={3} value={f.info} onChange={set('info')} /></Field>
      <div><Button variant="primary" loading={busy} onClick={save}>{t('Save')}</Button></div>
    </div>
  );
}

function PreferencesTab() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const { user, profile } = useCurrent();
  const { theme, setTheme } = useUi();
  const notify = (profile && profile.prefs && profile.prefs.notify) || {};
  const toggle = async (k, v) => {
    try {
      await savePrefs(user.uid, { ...((profile && profile.prefs) || {}), lang, theme, notify: { invitations: true, reviews: true, exports: false, ...notify, [k]: v } });
      await useAuthStore.getState().hydrate(user);
    } catch (e) { toast.error(t(e.message)); }
  };
  return (
    <div className="max-w-lg space-y-4 pt-4">
      <Field label={t('Language')}><Select value={lang} onChange={(e) => setLang(e.target.value)}><option value="en">English</option><option value="bn">বাংলা</option></Select></Field>
      <Field label={t('Theme')}><Select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></Select></Field>
      <div>
        <p className="label">{t('Notify me about')}</p>
        {[['reviews', 'Paper reviews and approvals', true], ['invitations', 'Invitations', true], ['exports', 'Exports of my papers', false]].map(([k, l, def]) => (
          <label key={k} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={notify[k] === undefined ? def : !!notify[k]} onChange={(e) => toggle(k, e.target.checked)} />{t(l)}</label>
        ))}
      </div>
    </div>
  );
}

function TypesTab() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, institutionId, can } = useCurrent();
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const canEdit = can('questions.edit_all');
  const load = () => listCustomTypes(institutionId).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form.name.trim() || !form.fields.length || form.fields.some((x) => !x.label.trim())) { toast.error(t('Give the type a name and at least one labelled field.')); return; }
    setBusy(true);
    try { await saveCustomType({ id: form.id, institutionId, uid: user.uid, name: form.name.trim(), fields: form.fields }); setForm(null); load(); } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };
  const del = async (c) => {
    if (!(await confirm({ title: t('Delete'), message: t('Delete "{name}"? Questions that already use it keep working.', { name: c.name }), danger: true, confirmLabel: t('Delete') }))) return;
    try { await deleteCustomType(c.id); load(); } catch (e) { toast.error(t(e.message)); }
  };
  const setField = (id, patch) => setForm((f) => ({ ...f, fields: f.fields.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  return (
    <div className="pt-4">
      <p className="mb-3 max-w-2xl text-sm text-muted">{t('Design your own question format: name it and list its fields (for example Word, Meaning, Example sentence). The first field is printed as the question; the others follow below it.')}</p>
      {canEdit && <Button variant="primary" icon={Plus} onClick={() => setForm({ id: null, name: '', fields: [{ id: newId(5), label: t('Question'), kind: 'rich' }] })}>{t('New custom type')}</Button>}
      <div className="panel mt-3">
        {!list.length ? <EmptyState title={t('No custom types yet')} /> : list.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{c.fields.map((x) => x.label).join(' / ')}</p></div>
            {canEdit && <div className="flex"><Button size="icon" variant="ghost" onClick={() => setForm({ id: c.id, name: c.name, fields: c.fields })} aria-label={t('Edit')}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => del(c)} aria-label={t('Delete')}><Trash2 className="h-4 w-4" /></Button></div>}
          </div>
        ))}
      </div>
      <Modal open={!!form} onClose={() => setForm(null)} title={t('Custom question type')} size="md"
        footer={(<><Button onClick={() => setForm(null)}>{t('Cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('Save')}</Button></>)}>
        {form && (
          <div className="space-y-3">
            <Field label={t('Type name')}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <p className="label">{t('Fields')}</p>
            {form.fields.map((x) => (
              <div key={x.id} className="flex gap-2">
                <Input value={x.label} onChange={(e) => setField(x.id, { label: e.target.value })} placeholder={t('Field label')} />
                <Select className="w-40" value={x.kind} onChange={(e) => setField(x.id, { kind: e.target.value })}><option value="rich">{t('Rich text')}</option><option value="text">{t('Short text')}</option></Select>
                <Button size="icon" variant="ghost" disabled={form.fields.length <= 1} onClick={() => setForm({ ...form, fields: form.fields.filter((y) => y.id !== x.id) })} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" icon={Plus} onClick={() => setForm({ ...form, fields: [...form.fields, { id: newId(5), label: '', kind: 'rich' }] })}>{t('Add field')}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const { can } = useCurrent();
  const tabs = [{ id: 'profile', label: t('Profile') }, can('institution.manage') && { id: 'institution', label: t('Institution') }, { id: 'prefs', label: t('Preferences') }, { id: 'types', label: t('Question types') }].filter(Boolean);
  const [tab, setTab] = useState('profile');
  return (
    <div>
      <PageHeader title={t('Settings')} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'institution' && <InstitutionTab />}
      {tab === 'prefs' && <PreferencesTab />}
      {tab === 'types' && <TypesTab />}
    </div>
  );
}
