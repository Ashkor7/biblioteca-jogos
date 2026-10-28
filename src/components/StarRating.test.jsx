import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StarRating, StarInput } from './StarRating.jsx';

describe('estrelas', () => {
  it('anuncia a nota para leitores de tela', () => {
    render(<StarRating value={4} />);
    expect(screen.getByRole('img', { name: '4 de 5 estrelas' })).toBeInTheDocument();
  });
  it('permite escolher 1–5 ou nenhuma nota', async () => {
    const onChange = vi.fn();
    render(<StarInput value={null} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('3 estrelas'));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.getByLabelText('Ainda sem nota')).toBeChecked();
  });
});
