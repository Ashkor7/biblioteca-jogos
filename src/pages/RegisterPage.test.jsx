import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ToastProvider from '../components/ToastProvider.jsx';
import { AuthContext } from '../hooks/contexts.js';
import RegisterPage from './RegisterPage.jsx';

function renderWith(auth) {
  return render(
    <ToastProvider>
      <AuthContext.Provider value={{ user: null, isLoading: false, signupEnabled: true, register: vi.fn(), ...auth }}>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );
}

describe('tela de cadastro', () => {
  it('confere senha, confirmação e e-mail antes de enviar', async () => {
    const register = vi.fn();
    renderWith({ register });
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'curta');
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'outra');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByText('Use pelo menos 10 caracteres')).toBeInTheDocument();
    expect(screen.getByText('As senhas não são iguais')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('envia e-mail normalizado e senha', async () => {
    const register = vi.fn(async () => ({ id: 'u1' }));
    renderWith({ register });
    await userEvent.type(screen.getByLabelText('E-mail'), 'Ana@Exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'uma senha longa');
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'uma senha longa');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(register).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: 'uma senha longa' });
  });

  it('cadastro desligado no servidor', () => {
    renderWith({ signupEnabled: false });
    expect(screen.getByRole('heading', { name: 'Cadastro fechado' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
  });
});
