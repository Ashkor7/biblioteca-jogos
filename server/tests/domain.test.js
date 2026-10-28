import { describe, it, expect } from 'vitest';
import { moneyToCents, normalizeKey, slugify, hoursToMinutes } from '../../shared/domain.js';
import { detectImageType } from '../src/lib/storage.js';
import { PNG } from './helpers.js';

describe('regras de domínio', () => {
  it('converte valores monetários sem float', () => {
    expect(moneyToCents('199,90')).toBe(19990);
    expect(moneyToCents('1.299,90')).toBe(129990);
    expect(moneyToCents('R$ 0,5')).toBe(50);
    expect(moneyToCents(0.1 + 0.2)).toBe(30);
    expect(moneyToCents('')).toBeNull();
    expect(moneyToCents('-1')).toBeNaN();
    expect(moneyToCents('12,345')).toBeNaN();
  });
  it('normaliza nomes e gera slugs estáveis', () => {
    expect(normalizeKey('  Ação  ')).toBe(normalizeKey('acao'));
    expect(slugify('Xbox 360')).toBe('xbox-360');
    expect(slugify('PlayStation® 5')).toBe('playstation-5');
    expect(slugify('Nintendo Switch 2')).toBe('nintendo-switch-2');
  });
  it('converte horas decimais em minutos', () => {
    expect(hoursToMinutes('12,5')).toBe(750);
    expect(hoursToMinutes('0')).toBe(0);
    expect(hoursToMinutes('abc')).toBeNaN();
  });
  it('detecta imagem pelo conteúdo', () => {
    expect(detectImageType(PNG)).toEqual({ ext: 'png', mime: 'image/png' });
    expect(detectImageType(Buffer.from('GIF89a-----------'))).toEqual({ ext: 'gif', mime: 'image/gif' });
    expect(detectImageType(Buffer.from('não é uma imagem'))).toBeNull();
  });
});
