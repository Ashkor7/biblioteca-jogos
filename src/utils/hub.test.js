import { describe, it, expect } from 'vitest';
import { describeActivity, timeAgo } from './activity.js';
import { targetStatus, formatDay, formatMonth } from './format.js';
import { formToPayload, emptyGameForm } from './gameForm.js';
import { formatDuration, startOfWeek, isIsoDate } from '../../shared/domain.js';

describe('textos do Player Hub', () => {
  it('descreve atividades em português', () => {
    expect(describeActivity({ type: 'SESSION_LOGGED', data: { title: 'Hades', minutes: 150 } })).toBe('Jogou Hades por 2h30');
    expect(describeActivity({ type: 'LEVEL_UP', data: { level: 5 } })).toBe('Alcançou o nível 5');
    expect(describeActivity({ type: 'GAME_COMPLETED', data: {} })).toBe('Zerou um jogo removido');
  });

  it('tempo relativo', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    expect(timeAgo('2026-11-09T11:59:30Z', now)).toBe('agora mesmo');
    expect(timeAgo('2026-11-08T12:00:00Z', now)).toBe('ontem');
  });

  it('estado do preço em relação ao alvo usa centavos (sem erro de ponto flutuante)', () => {
    expect(targetStatus('70.10', '70.10').state).toBe('AT');
    expect(targetStatus('0.30', '0.10').state).toBe('ABOVE');
    expect(targetStatus('69.99', '70.00')).toMatchObject({ state: 'BELOW', tone: 'text-ok' });
    expect(targetStatus(null, '70.00')).toBeNull();
  });

  it('datas sem horário não mudam de dia pelo fuso', () => {
    expect(formatDay('2026-11-09')).toContain('09');
    expect(formatMonth('2026-03')).toMatch(/mar/);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('data de conclusão em branco não é enviada (o servidor decide)', () => {
    const payload = formToPayload({ ...emptyGameForm, title: 'A', platform: 'X', condition: 'DIGITAL', playStatus: 'COMPLETED' });
    expect(payload).not.toHaveProperty('completedAt', null);
    expect(payload.completedAt).toBeUndefined();
    const wish = formToPayload({ ...emptyGameForm, condition: 'WISHLIST', targetPrice: '70,00', wishPriority: 'HIGH' });
    expect(wish).toMatchObject({ targetPrice: '70,00', wishPriority: 'HIGH', preferredStore: null });
  });
});
