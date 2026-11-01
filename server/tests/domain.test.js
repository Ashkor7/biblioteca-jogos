import { describe, it, expect } from 'vitest';
import { moneyToCents, normalizeKey, slugify, hoursToMinutes } from '../../shared/domain.js';
import { detectImageType } from '../src/lib/storage.js';
import { PNG, prisma } from './helpers.js';
import { upsertOwner } from '../src/services/authService.js';
import { PLACEHOLDER_RE } from '../src/config.js';

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
  it('recusa os textos de exemplo do .env.example como segredo ou senha', async () => {
    expect(PLACEHOLDER_RE.test('troque-por-um-segredo-aleatorio-com-pelo-menos-32-caracteres')).toBe(true);
    expect(PLACEHOLDER_RE.test('a3f9c1d27e6b')).toBe(false);
    await expect(upsertOwner('dono@biblioteca.test', 'troque-esta-senha-forte')).rejects.toThrow(/senha de exemplo/);
    await prisma.$disconnect();
  });
});
