import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../layouts/AuthLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { Field, Input } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { sendReset, friendlyAuthError } from '../../services/authService.js';
import { resetSchema } from '../../validators/auth.js';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema) });
  const onSubmit = async (v) => {
    setErr('');
    try { await sendReset(v.email); setDone(true); } catch (e) { setErr(friendlyAuthError(e)); }
  };
  return (
    <AuthLayout title={t('Reset your password')} subtitle={t('We will email you a link to choose a new password.')} footer={<Link className="font-semibold text-brand underline" to="/login">{t('Back to sign in')}</Link>}>
      {done ? <p className="rounded border border-brand/40 bg-brand-soft p-3 text-sm">{t('If an account exists for that email, a reset link is on its way.')}</p> : (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label={t('Email')} error={errors.email && t(errors.email.message)}><Input type="email" autoComplete="email" {...register('email')} /></Field>
          {err && <p className="err">{t(err)}</p>}
          <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>{t('Send reset link')}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
