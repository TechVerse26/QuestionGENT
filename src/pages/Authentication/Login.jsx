import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../layouts/AuthLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { Field, Input } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { loginWithEmail, loginWithGoogle, friendlyAuthError } from '../../services/authService.js';
import { loginSchema } from '../../validators/auth.js';

export default function Login() {
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const user = useAuthStore((s) => s.user);
  const [err, setErr] = useState('');
  const [gBusy, setGBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });

  useEffect(() => { if (user) nav((loc.state && loc.state.from) || '/app/dashboard', { replace: true }); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (v) => {
    setErr('');
    try { await loginWithEmail(v.email, v.password); } catch (e) { setErr(friendlyAuthError(e)); }
  };
  const google = async () => {
    setErr('');
    setGBusy(true);
    try { await loginWithGoogle(); } catch (e) { setErr(friendlyAuthError(e)); } finally { setGBusy(false); }
  };

  return (
    <AuthLayout title={t('Sign in')} subtitle={t('Welcome back. Continue to your institution workspace.')}
      footer={<>{t('New here?')} <Link className="font-semibold text-brand underline" to="/register">{t('Create an account')}</Link></>}>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label={t('Email')} error={errors.email && t(errors.email.message)}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label={t('Password')} error={errors.password && t(errors.password.message)}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
        {err && <p className="err">{t(err)}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>{t('Sign in')}</Button>
        <Button className="w-full" loading={gBusy} onClick={google}>{t('Continue with Google')}</Button>
        <p className="text-sm"><Link className="text-muted underline" to="/forgot-password">{t('Forgot your password?')}</Link></p>
      </form>
    </AuthLayout>
  );
}
