import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';

export default function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const from = location.state?.from ?? '/';

  if (user) return <Navigate to={from} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await login({ email, password });
      toast.success('Sessão iniciada.');
      navigate(from, { replace: true });
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
            <h1 className="text-3xl font-bold">Entrar</h1>
            <p className="mt-2 text-sm text-muted">Acesso do proprietário da biblioteca. Visitantes não podem alterar dados.</p>
          </div>
          {errors._ && (
            <p role="alert" className="border border-danger/50 bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors._}
            </p>
          )}
          <div>
            <label htmlFor="email" className="field-label">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'email-erro' : undefined}
              required
              autoFocus
            />
            {errors.email && (
              <p id="email-erro" className="field-error">
                {errors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="senha" className="field-label">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby={errors.password ? 'senha-erro' : undefined}
              required
            />
            {errors.password && (
              <p id="senha-erro" className="field-error">
                {errors.password}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-xs text-faint">
            Primeiro acesso? Crie o proprietário no terminal com <code className="num text-muted">npm run admin:create</code>.
          </p>
        </form>
      </div>
    </div>
  );
}
