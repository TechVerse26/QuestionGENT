import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, MailCheck } from 'lucide-react';
import Logo from '../../components/common/Logo.jsx';
import Button from '../../components/common/Button.jsx';
import { Field, Input, Select, Textarea } from '../../components/common/Field.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { createInstitution, listMyInvitations, acceptInvitation, declineInvitation } from '../../services/institutionService.js';
import { logout } from '../../services/authService.js';
import { uploadImage, uploadsEnabled } from '../../services/uploadService.js';
import { institutionSchema } from '../../validators/auth.js';
import { INSTITUTION_TYPES } from '../../constants/options.js';
import { ROLE_LABELS } from '../../constants/roles.js';

export default function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { user, memberships } = useAuthStore();
  const [invites, setInvites] = useState([]);
  const [logoUrl, setLogoUrl] = useState('');
  const [upBusy, setUpBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(institutionSchema), defaultValues: { type: 'school' } });

  useEffect(() => { if (user) listMyInvitations(user.email).then(setInvites).catch(() => setInvites([])); }, [user]);

  const enter = async (id) => {
    await useAuthStore.getState().hydrate(user);
    useAuthStore.getState().setCurrent(id);
    nav('/app/dashboard', { replace: true });
  };

  const create = async (v) => {
    try { enter(await createInstitution(user, { ...v, logoUrl })); } catch (e) { toast.error(t(e.message)); }
  };
  const accept = async (inv) => {
    try { await acceptInvitation(inv, user); enter(inv.institutionId); } catch (e) { toast.error(t(e.message)); }
  };
  const decline = async (inv) => {
    try { await declineInvitation(inv, user); setInvites((l) => l.filter((x) => x.id !== inv.id)); } catch (e) { toast.error(t(e.message)); }
  };
  const onLogo = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setUpBusy(true);
    try { setLogoUrl(await uploadImage(f)); } catch (err) { toast.error(t(err.message)); } finally { setUpBusy(false); }
  };

  if (memberships.length) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <Logo />
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'English' : 'বাংলা'}</Button>
          <Button size="sm" onClick={async () => { await logout(); nav('/login'); }}>{t('Sign out')}</Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 p-4 py-8 md:grid-cols-[1fr_1.2fr]">
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-lg"><MailCheck className="h-5 w-5 text-brand" />{t('Join with an invitation')}</h2>
          <p className="mb-3 text-sm text-muted">{t('Invitations sent to {email} appear here.', { email: user ? user.email : '' })}</p>
          {!invites.length && <p className="panel p-4 text-sm text-muted">{t('No pending invitations.')}</p>}
          {invites.map((inv) => (
            <div key={inv.id} className="panel mb-2 p-3">
              <p className="font-semibold">{inv.institutionName}</p>
              <p className="text-sm text-muted">{t('Role')}: {ROLE_LABELS[inv.role] ? ROLE_LABELS[inv.role][lang] : inv.role}</p>
              <div className="mt-2 flex gap-2"><Button size="sm" variant="primary" onClick={() => accept(inv)}>{t('Accept')}</Button><Button size="sm" onClick={() => decline(inv)}>{t('Decline')}</Button></div>
            </div>
          ))}
        </section>
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-brand" />{t('Create an institution')}</h2>
          <p className="mb-3 text-sm text-muted">{t('You will be its administrator and can invite teachers later.')}</p>
          <form className="panel space-y-3 p-4" onSubmit={handleSubmit(create)} noValidate>
            <Field label={t('Institution name')} error={errors.name && t(errors.name.message)}><Input {...register('name')} /></Field>
            <Field label={t('Type')}><Select {...register('type')}>{INSTITUTION_TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</Select></Field>
            <Field label={t('Address')}><Input {...register('address')} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('Phone')}><Input type="tel" {...register('phone')} /></Field>
              <Field label={t('Email')} error={errors.email && t(errors.email.message)}><Input type="email" {...register('email')} /></Field>
            </div>
            <Field label={t('Website')} error={errors.website && t(errors.website.message)}><Input placeholder="https://" {...register('website')} /></Field>
            <Field label={t('About the institution')}><Textarea rows={2} {...register('info')} /></Field>
            {uploadsEnabled && (
              <div><label className="label">{t('Logo (optional)')}</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} disabled={upBusy} className="text-sm" />{logoUrl && <img src={logoUrl} alt="" className="mt-2 h-14 w-auto" />}</div>
            )}
            <Button type="submit" variant="primary" loading={isSubmitting}>{t('Create institution')}</Button>
          </form>
        </section>
      </main>
    </div>
  );
}
