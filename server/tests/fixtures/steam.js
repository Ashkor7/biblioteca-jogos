// Cliente Steam falso para os testes: nada de rede. Cada teste ajusta `state`.
import { SteamError } from '../../src/services/steamClient.js';

export const STEAM_ID = '76561198000000001';
export const OTHER_STEAM_ID = '76561198000000002';
export const PRIVATE_STEAM_ID = '76561198000000003';

const player = (steamId64, personaName, visibility = 'public') => ({
  steamId64,
  personaName,
  avatarUrl: `https://avatars.steamstatic.com/${steamId64}_full.jpg`,
  profileUrl: `https://steamcommunity.com/profiles/${steamId64}/`,
  visibility,
});

/** Jogos da conta principal (formato já normalizado pelo steamClient). */
export function ownedGamesFixture() {
  return [
    { appId: 620, name: 'Portal 2', playtimeMinutes: 1200, playtime2WeeksMinutes: 0, lastPlayedAt: new Date('2024-05-01T12:00:00Z'), iconUrl: null, hasStats: true },
    { appId: 1145360, name: 'Hades', playtimeMinutes: 3000, playtime2WeeksMinutes: 120, lastPlayedAt: new Date('2026-11-10T20:00:00Z'), iconUrl: null, hasStats: true },
    { appId: 413150, name: 'Stardew Valley', playtimeMinutes: 600, playtime2WeeksMinutes: 0, lastPlayedAt: null, iconUrl: null, hasStats: true },
    { appId: 292030, name: 'The Witcher 3: Wild Hunt', playtimeMinutes: 90, playtime2WeeksMinutes: 0, lastPlayedAt: null, iconUrl: null, hasStats: false },
    { appId: 323170, name: 'Portal 2 - The Final Hours', playtimeMinutes: 0, playtime2WeeksMinutes: 0, lastPlayedAt: null, iconUrl: null, hasStats: false },
    { appId: 1057090, name: 'Ori and the Will of the Wisps', playtimeMinutes: 0, playtime2WeeksMinutes: 0, lastPlayedAt: null, iconUrl: null, hasStats: false },
    { appId: 440, name: 'Team Fortress 2 Soundtrack', playtimeMinutes: 0, playtime2WeeksMinutes: 0, lastPlayedAt: null, iconUrl: null, hasStats: false },
  ];
}

/** Resposta bruta de appdetails (como a loja devolve, com HTML e entidades). */
export function appDetailsFixture(appId, overrides = {}) {
  const base = {
    620: {
      type: 'game',
      name: 'Portal 2',
      short_description: '<b>Portal 2</b> &amp; o modo cooperativo &mdash; puzzles com &quot;portais&quot;.<script>alert(1)</script>',
      header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
      screenshots: [
        { path_full: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_1.jpg' },
        { path_full: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_2.jpg' },
        { path_full: 'https://evil.example/ss_3.jpg' },
      ],
      genres: [{ description: 'Ação' }, { description: 'Aventura' }],
      developers: ['Valve'],
      publishers: ['Valve', 'Valve'],
      release_date: { coming_soon: false, date: '18 abr. 2011' },
      metacritic: { score: 95 },
      website: 'https://www.thinkwithportals.com/',
    },
    1145360: {
      type: 'game',
      name: 'Hades',
      short_description: 'Desafie o deus dos mortos.',
      header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg',
      genres: [{ description: 'Ação' }, { description: 'RPG' }, { description: 'Indie' }],
      developers: ['Supergiant Games'],
      publishers: ['Supergiant Games'],
      release_date: { coming_soon: false, date: '17 set. 2020' },
      metacritic: { score: 93 },
    },
    413150: {
      type: 'game',
      name: 'Stardew Valley',
      short_description: 'Você herdou a antiga fazenda do seu avô.',
      header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg',
      genres: [{ description: 'RPG' }, { description: 'Simulação' }],
      developers: ['ConcernedApe'],
      publishers: ['ConcernedApe'],
      release_date: { coming_soon: false, date: '26 fev. 2016' },
    },
    292030: {
      type: 'game',
      name: 'The Witcher 3: Wild Hunt',
      short_description: 'Um RPG de mundo aberto.',
      header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg',
      genres: [{ description: 'RPG' }],
      developers: ['CD PROJEKT RED'],
      publishers: ['CD PROJEKT RED'],
      release_date: { coming_soon: false, date: '18 maio 2015' },
    },
    323170: { type: 'dlc', name: 'Portal 2 - The Final Hours' },
    1057090: {
      type: 'game',
      name: 'Ori and the Will of the Wisps',
      release_date: { coming_soon: true, date: 'Em breve' },
      genres: [],
    },
  };
  const data = base[appId];
  return data ? { ...data, ...overrides } : null;
}

export function fakeSteamClient(initial = {}) {
  const state = {
    vanities: { jogador: STEAM_ID, outro: OTHER_STEAM_ID, privado: PRIVATE_STEAM_ID },
    players: {
      [STEAM_ID]: player(STEAM_ID, 'Jogador Teste'),
      [OTHER_STEAM_ID]: player(OTHER_STEAM_ID, 'Outra Conta'),
      [PRIVATE_STEAM_ID]: player(PRIVATE_STEAM_ID, 'Conta Fechada', 'private'),
    },
    owned: {
      [STEAM_ID]: { visible: true, games: ownedGamesFixture() },
      [OTHER_STEAM_ID]: { visible: true, games: [ownedGamesFixture()[0]] },
      [PRIVATE_STEAM_ID]: { visible: false, games: [] },
    },
    achievements: { 620: { unlocked: 30, total: 51 }, 1145360: { unlocked: 12, total: 49 } },
    appDetails: (appId) => appDetailsFixture(appId),
    failAppDetails: new Set(),
    calls: { resolveVanity: 0, getPlayerSummary: 0, getOwnedGames: 0, getPlayerAchievements: 0, getAppDetails: 0 },
    ...initial,
  };
  return {
    state,
    async resolveVanity(vanity) {
      state.calls.resolveVanity += 1;
      return state.vanities[vanity] ?? null;
    },
    async getPlayerSummary(steamId64) {
      state.calls.getPlayerSummary += 1;
      return state.players[steamId64] ?? null;
    },
    async getOwnedGames(steamId64, { includeFreeGames = false } = {}) {
      state.calls.getOwnedGames += 1;
      state.lastIncludeFree = includeFreeGames;
      if (state.ownedError) throw state.ownedError;
      const entry = state.owned[steamId64] ?? { visible: false, games: [] };
      return { visible: entry.visible, games: entry.games.map((g) => ({ ...g })) };
    },
    async getPlayerAchievements(_steamId64, appId) {
      state.calls.getPlayerAchievements += 1;
      return state.achievements[appId] ?? null;
    },
    async getAppDetails(appId) {
      state.calls.getAppDetails += 1;
      if (state.failAppDetails.has(appId)) throw new SteamError('UNAVAILABLE', 'falha simulada', { status: 503 });
      return state.appDetails(appId);
    },
  };
}
