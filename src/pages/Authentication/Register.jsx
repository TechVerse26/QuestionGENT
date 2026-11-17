import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../layouts/AuthLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { Field, Input } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { registerWithEmail, loginWithGoogle, friendlyAuthError } from '../../services/authService.js';
import { registerSchema } from '../../validators/auth.js';

export default function Register() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (v) => {
    setErr('');
    try { await registerWithEmail(v); nav('/verify-email', { replace: true }); } catch (e) { setErr(friendlyAuthError(e)); }
  };
  const google = async () => {
    setErr('');
    try { await loginWithGoogle(); nav('/app/dashboard', { replace: true }); } catch (e) { setErr(friendlyAuthError(e)); }
  };

  return (
    <AuthLayout title={t('Create your account')} subtitle={t('Then create an institution or join one by invitation.')}
      footer={<>{t('Already have an account?')} <Link className="font-semibold text-brand underline" to="/login">{t('Sign in')}</Link></>}>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label={t('Full name')} error={errors.name && t(errors.name.message)}><Input autoComplete="name" {...register('name')} /></Field>
        <Field label={t('Email')} error={errors.email && t(errors.email.message)}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label={t('Password')} error={errors.password && t(errors.password.message)}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label={t('Confirm password')} error={errors.confirm && t(errors.confirm.message)}><Input type="password" autoComplete="new-password" {...register('confirm')} /></Field>
        {err && <p className="err">{t(err)}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>{t('Create account')}</Button>
        <Button className="w-full" onClick={google}>{t('Continue with Google')}</Button>
      </form>
    </AuthLayout>
  );
}
