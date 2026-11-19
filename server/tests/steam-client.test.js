// Cliente HTTP da Steam e download de imagens, com fetch falso (sem rede).
import { describe, it, expect, afterEach } from 'vitest';
import { createSteamClient, SteamError } from '../src/services/steamClient.js';
import { downloadSteamImage, isAllowedSteamImageUrl, setRemoteImageFetch } from '../src/lib/remoteImage.js';
import { PNG, uploadedFileExists } from './helpers.js';

const KEY = 'FEDCBA9876543210FEDCBA9876543210';
const ID = '76561198000000001';

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function client(fetchImpl, extra = {}) {
  return createSteamClient({ apiKey: KEY, fetchImpl, apiIntervalMs: 0, storeIntervalMs: 0, backoffBaseMs: 0, sleep: async () => {}, ...extra });
}

describe('steamClient', () => {
  it('chama só endereços fixos e normaliza os jogos', async () => {
    const urls = [];
    const steam = client(async (url) => {
      urls.push(new URL(url));
      return jsonResponse({
        response: {
          game_count: 2,
          games: [
            { appid: 620, name: 'Portal 2 <b>', playtime_forever: 100, playtime_2weeks: 5, rtime_last_played: 1700000000, img_icon_url: 'a'.repeat(40) },
            { appid: -1, name: 'inválido' },
          ],
        },
      });
    });
    const result = await steam.getOwnedGames(ID, { includeFreeGames: true });
    expect(urls[0].origin).toBe('https://api.steampowered.com');
    expect(urls[0].pathname).toBe('/IPlayerService/GetOwnedGames/v1/');
    expect(urls[0].searchParams.get('include_played_free_games')).toBe('1');
    expect(result.visible).toBe(true);
    expect(result.games).toEqual([
      expect.objectContaining({ appId: 620, name: 'Portal 2', playtimeMinutes: 100, playtime2WeeksMinutes: 5, lastPlayedAt: new Date(1700000000 * 1000) }),
    ]);
  });

  it('lista vazia sem game_count = detalhes de jogos privados', async () => {
    const steam = client(async () => jsonResponse({ response: {} }));
    expect(await steam.getOwnedGames(ID)).toEqual({ visible: false, games: [] });
  });

  it('espera e tenta de novo em 429/5xx e desiste com erro tipado', async () => {
    let calls = 0;
    const waits = [];
    const steam = client(
      async () => {
        calls += 1;
        if (calls === 1) return jsonResponse({}, 429, { 'retry-after': '2' });
        if (calls === 2) return jsonResponse({}, 503);
        return jsonResponse({ response: { success: 1, steamid: ID } });
      },
      { backoffBaseMs: 100, sleep: async (ms) => waits.push(ms) },
    );
    expect(await steam.resolveVanity('x')).toBe(ID);
    expect(waits).toEqual([2000, 200]);

    const failing = client(async () => jsonResponse({}, 500), { retries: 2 });
    await expect(failing.resolveVanity('x')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('nunca coloca a chave na mensagem de erro', async () => {
    const steam = client(async () => {
      throw new TypeError(`fetch failed for https://api.steampowered.com/?key=${KEY}`);
    }, { retries: 0 });
    const error = await steam.getPlayerSummary(ID).catch((e) => e);
    expect(error).toBeInstanceOf(SteamError);
    expect(error.code).toBe('NETWORK');
    expect(`${error.message} ${error.stack}`).not.toContain(KEY);
  });

  it('conquistas: 400 vira null (jogo sem estatísticas)', async () => {
    const steam = client(async () => jsonResponse({ playerstats: { success: false, error: 'Requested app has no stats' } }, 400));
    expect(await steam.getPlayerAchievements(ID, 620)).toBeNull();
    const ok = client(async () => jsonResponse({ playerstats: { success: true, achievements: [{ achieved: 1 }, { achieved: 0 }, { achieved: 1 }] } }));
    expect(await ok.getPlayerAchievements(ID, 620)).toEqual({ unlocked: 2, total: 3 });
  });

  it('appdetails usa a loja em português do Brasil e devolve null sem página', async () => {
    let seen;
    const steam = client(async (url) => {
      seen = new URL(url);
      return jsonResponse({ 620: { success: false } });
    });
    expect(await steam.getAppDetails(620)).toBeNull();
    expect(seen.origin).toBe('https://store.steampowered.com');
    expect(seen.searchParams.get('l')).toBe('brazilian');
    expect(seen.searchParams.get('cc')).toBe('br');
    expect(seen.searchParams.has('key')).toBe(false);
  });

  it('sem chave não chama a Web API', async () => {
    let called = false;
    const steam = createSteamClient({ fetchImpl: async () => { called = true; } });
    await expect(steam.resolveVanity('x')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(called).toBe(false);
  });
});

describe('download de imagens da Steam', () => {
  afterEach(() => setRemoteImageFetch(null));
  const good = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg';

  it('aceita só https em hosts da Steam', () => {
    expect(isAllowedSteamImageUrl(good)).toBe(true);
    expect(isAllowedSteamImageUrl('http://shared.akamai.steamstatic.com/a.jpg')).toBe(false);
    expect(isAllowedSteamImageUrl('https://evil.example/a.jpg')).toBe(false);
    expect(isAllowedSteamImageUrl('https://shared.akamai.steamstatic.com.evil.example/a.jpg')).toBe(false);
    expect(isAllowedSteamImageUrl('https://user@shared.akamai.steamstatic.com/a.jpg')).toBe(false);
    expect(isAllowedSteamImageUrl('https://127.0.0.1/a.jpg')).toBe(false);
  });

  it('rejeita host fora da allowlist sem nem fazer a requisição', async () => {
    let called = false;
    setRemoteImageFetch(async () => {
      called = true;
    });
    await expect(downloadSteamImage('https://evil.example/a.png')).rejects.toMatchObject({ status: 400 });
    expect(called).toBe(false);
  });

  it('não segue redirecionamento para fora da allowlist', async () => {
    setRemoteImageFetch(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/a.png' } }));
    await expect(downloadSteamImage(good)).rejects.toMatchObject({ status: 400 });
  });

  it('recusa arquivo que não é imagem e arquivo grande demais', async () => {
    setRemoteImageFetch(async () => new Response('<html>não é imagem</html>', { status: 200 }));
    await expect(downloadSteamImage(good)).rejects.toMatchObject({ status: 415 });

    setRemoteImageFetch(async () => new Response(Buffer.alloc(2 * 1024 * 1024, 1), { status: 200 }));
    await expect(downloadSteamImage(good)).rejects.toMatchObject({ status: 413 });
  });

  it('segue redirecionamento interno e grava com nome UUID', async () => {
    const seen = [];
    setRemoteImageFetch(async (url) => {
      seen.push(url);
      if (seen.length === 1) return new Response(null, { status: 301, headers: { location: 'https://cdn.akamai.steamstatic.com/x.png' } });
      return new Response(PNG, { status: 200 });
    });
    const saved = await downloadSteamImage(good);
    expect(saved.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(saved.mimeType).toBe('image/png');
    expect(uploadedFileExists(saved.url)).toBe(true);
    expect(seen).toEqual([good, 'https://cdn.akamai.steamstatic.com/x.png']);
  });
});
