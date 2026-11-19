// Regras puras da integração Steam (shared/steam.js): sem banco e sem rede.
import { describe, it, expect } from 'vitest';
import {
  parseSteamProfileInput,
  sanitizeExternalText,
  parseSteamReleaseDate,
  joinNames,
  nonGameType,
  steamStoreUrl,
} from '../../shared/steam.js';

const ID = '76561197960287930';

describe('parseSteamProfileInput', () => {
  it.each([
    [ID, { kind: 'id64', value: ID }],
    [`https://steamcommunity.com/profiles/${ID}`, { kind: 'id64', value: ID }],
    [`steamcommunity.com/profiles/${ID}/`, { kind: 'id64', value: ID }],
    ['https://steamcommunity.com/id/gabelogannewell/', { kind: 'vanity', value: 'gabelogannewell' }],
    ['http://www.steamcommunity.com/id/meu_apelido?l=brazilian', { kind: 'vanity', value: 'meu_apelido' }],
    ['meu-apelido', { kind: 'vanity', value: 'meu-apelido' }],
  ])('reconhece %s', (input, expected) => {
    expect(parseSteamProfileInput(input)).toEqual(expected);
  });

  it.each(['', 'a', 'https://evil.example/id/x', 'https://steamcommunity.com/profiles/123', 'apelido com espaço', 'x'.repeat(40)])(
    'recusa %s',
    (input) => {
      expect(parseSteamProfileInput(input)).toBeNull();
    },
  );
});

describe('texto externo', () => {
  it('remove HTML e scripts, decodifica entidades e corta no limite', () => {
    const html = '<p>Um <b>RPG</b> &amp; aventura&nbsp;&#8212; com &lt;script&gt;alert(1)&lt;/script&gt;</p><script>x()</script>';
    expect(sanitizeExternalText(html, 200)).toBe('Um RPG & aventura — com alert(1)');
    expect(sanitizeExternalText('abcdefghij', 5)).toBe('abcd…');
    expect(sanitizeExternalText('<br/>  ', 10)).toBeNull();
    expect(sanitizeExternalText('a\u0000b‮c', 10)).toBe('abc');
  });

  it('junta nomes sem repetir e sem passar do limite', () => {
    expect(joinNames(['Valve', 'Valve', 'Hidden Path'], 120)).toBe('Valve, Hidden Path');
    expect(joinNames(['A'.repeat(10), 'B'.repeat(10)], 15)).toBe('A'.repeat(10));
    expect(joinNames(null, 10)).toBeNull();
  });
});

describe('data de lançamento', () => {
  it.each([
    ['10 dez. 2020', '2020-12-10'],
    ['3 de mar. de 2015', '2015-03-03'],
    ['Dec 10, 2020', '2020-12-10'],
    ['21/08/2012', '2012-08-21'],
  ])('%s → %s', (text, iso) => {
    expect(parseSteamReleaseDate(text)).toEqual({ date: iso, text });
  });

  it('guarda só o texto quando a data não é exata', () => {
    expect(parseSteamReleaseDate('Em breve')).toEqual({ date: null, text: 'Em breve' });
    expect(parseSteamReleaseDate('T1 2027')).toEqual({ date: null, text: 'T1 2027' });
    expect(parseSteamReleaseDate('31 fev. 2020')).toEqual({ date: null, text: '31 fev. 2020' });
    expect(parseSteamReleaseDate('')).toEqual({ date: null, text: null });
  });
});

describe('tipo do app', () => {
  it('usa o tipo da loja quando conhecido e o nome como último recurso', () => {
    expect(nonGameType({ name: 'Portal 2', storeType: 'game' })).toBeNull();
    expect(nonGameType({ name: 'Portal 2', storeType: 'dlc' })).toBe('dlc');
    expect(nonGameType({ name: 'Portal 2 Soundtrack' })).toBe('other');
    expect(nonGameType({ name: 'Counter-Strike Dedicated Server' })).toBe('other');
    expect(nonGameType({ name: 'Hades' })).toBeNull();
  });

  it('monta o link da loja só para appId válido', () => {
    expect(steamStoreUrl(620)).toBe('https://store.steampowered.com/app/620/');
    expect(steamStoreUrl('620/../x')).toBeNull();
    expect(steamStoreUrl(0)).toBeNull();
  });
});
