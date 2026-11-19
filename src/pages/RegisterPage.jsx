import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { Field } from '../components/Field.jsx';
import { LoadingState } from '../components/States.jsx';
import { registerSchema, zodFieldErrors } from '../../shared/schemas.js';
import { LIMITS } from '../../shared/domain.js';

/** Cadastro público (só aparece quando o servidor tem ALLOW_SIGNUP=true). */
export default function RegisterPage() {
  const { user, register, signupEnabled, isLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (isLoading) return <LoadingState />;
  if (user) return <Navigate to="/" replace />;
  if (!signupEnabled) {
    return (
      <div className="page-enter mx-auto mt-6 max-w-md sm:mt-16">
        <div className="panel">
          <div className="panel-body space-y-4 p-6 sm:p-8">
            <h1 className="text-3xl font-bold">Cadastro fechado</h1>
            <p className="text-sm text-muted">Este site não está aceitando novas contas no momento.</p>
            <Link to="/login" className="btn btn-primary w-full">
              Ir para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event) {
    event.preventDefault();
    const local = {};
    const parsed = registerSchema.safeParse({ email: form.email, password: form.password });
    if (!parsed.success) Object.assign(local, zodFieldErrors(parsed.error));
    if (form.password !== form.confirm) local.confirm = 'As senhas não são iguais';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await register(parsed.data);
      toast.success('Conta criada. Bem-vindo!');
      navigate('/', { replace: true });
    } catch (error) {
      setErrors({ ...error.fields, _: error.fields && Object.keys(error.fields).length ? null : error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-enter mx-auto mt-6 max-w-md sm:mt-16">
      <div className="panel">
        <form onSubmit={submit} noValidate className="panel-body space-y-5 p-6 sm:p-8">
          <div>
            <h1 className="text-3xl font-bold">Criar conta</h1>
            <p className="mt-2 text-sm text-muted">
              Sua biblioteca é só sua: outras pessoas só veem o que você liberar no perfil público.
            </p>
          </div>
          {errors._ && (
            <p role="alert" className="border border-danger/50 bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors._}
            </p>
          )}
          <Field label="E-mail" error={errors.email}>
            {(a11y) => (
              <input {...a11y} type="email" autoComplete="email" className="input" value={form.email} onChange={set('email')} required autoFocus />
            )}
          </Field>
          <Field label="Senha" error={errors.password} hint={`Pelo menos ${LIMITS.passwordMin} caracteres. Uma frase curta é fácil de lembrar e difícil de adivinhar.`}>
            {(a11y) => (
              <input {...a11y} type="password" autoComplete="new-password" className="input" value={form.password} onChange={set('password')} required />
            )}
          </Field>
          <Field label="Confirme a senha" error={errors.confirm}>
            {(a11y) => (
              <input {...a11y} type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} required />
            )}
          </Field>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Criando conta…' : 'Criar conta'}
          </button>
          <p className="text-center text-sm text-muted">
            Já tem conta? <Link to="/login">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
