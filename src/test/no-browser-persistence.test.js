// Restrição 1 da especificação: nada de localStorage/sessionStorage/IndexedDB como banco.
import { describe, it, expect } from 'vitest';

const sources = import.meta.glob(['../**/*.{js,jsx}', '!../**/*.test.{js,jsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('persistência somente no servidor', () => {
  it('nenhum arquivo do frontend grava no navegador', () => {
    const offenders = Object.entries(sources)
      .filter(([, code]) => /localStorage\.setItem|sessionStorage|indexedDB/.test(code))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it('o único acesso ao localStorage é a leitura da importação legada', () => {
    const readers = Object.entries(sources)
      .filter(([, code]) => /localStorage/.test(code))
      .map(([file]) => file);
    expect(readers).toEqual(['../pages/ImportPage.jsx']);
  });
});
