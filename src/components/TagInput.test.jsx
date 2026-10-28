import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagInput from './TagInput.jsx';

function Harness({ initial = [], suggestions = [] }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TagInput id="tags" label="Categorias" value={value} onChange={setValue} suggestions={suggestions} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

describe('TagInput', () => {
  it('adiciona com Enter e vírgula, sem duplicar por caixa/acento', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Categorias');
    await user.type(input, 'Ação{Enter}RPG,rpg{Enter}  acao {Enter}');
    expect(JSON.parse(screen.getByTestId('value').textContent)).toEqual(['Ação', 'RPG']);
  });

  it('aceita uma lista colada separada por vírgulas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText('Categorias'));
    await user.paste('RPG, Ação, rpg, Mundo aberto');
    await user.tab();
    expect(JSON.parse(screen.getByTestId('value').textContent)).toEqual(['RPG', 'Ação', 'Mundo aberto']);
  });

  it('reaproveita a grafia de uma categoria existente', async () => {
    const user = userEvent.setup();
    render(<Harness suggestions={['Mundo Aberto']} />);
    await user.type(screen.getByLabelText('Categorias'), 'mundo aberto{Enter}');
    expect(JSON.parse(screen.getByTestId('value').textContent)).toEqual(['Mundo Aberto']);
  });

  it('remove pelo botão acessível e com Backspace', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['RPG', 'Ação']} />);
    await user.click(screen.getByRole('button', { name: 'Remover categoria RPG' }));
    expect(JSON.parse(screen.getByTestId('value').textContent)).toEqual(['Ação']);
    await user.type(screen.getByLabelText('Categorias'), '{Backspace}');
    expect(JSON.parse(screen.getByTestId('value').textContent)).toEqual([]);
  });
});
