// Client BWF base sur Playwright (Chrome reel).
// Cle de voute : l'appel API est fait DEPUIS le contexte du navigateur (fetch dans la page),
// donc cookie cf_clearance + empreinte TLS coherents => Cloudflare laisse passer.
//
// Robustesse : si Cloudflare bloque (403 / page de challenge), on re-resout le challenge
// (re-warmup) et on rejoue l'appel automatiquement.

import { chromium } from 'playwright';

const BASE = 'https://extranet-lv.bwfbadminton.com';
const REFERER = 'https://bwfworldtour.bwfbadminton.com/';
const ORIGIN = 'https://bwfworldtour.bwfbadminton.com';
const WARMUP_URL = 'https://bwfworldtour.bwfbadminton.com/calendar/';

let _browser = null;
let _context = null;
let _warmed = false;
let _warmupPromise = null;

export async function init({ headless = false } = {}) {
  if (_browser) return;
  _browser = await chromium.launch({
    headless,
    channel: 'chrome', // utilise le Google Chrome installe (bundle Playwright KO sur cette machine)
    args: ['--disable-blink-features=AutomationControlled'],
  });
  _context = await _browser.newContext({
    locale: 'fr-FR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });
}

/** Detecte une page de blocage Cloudflare a partir du status / corps. */
function isCloudflareBlock(status, body) {
  if (status === 403 || status === 503 || status === 429) return true;
  const b = (body || '').slice(0, 600);
  return (
    b.includes('Attention Required') ||
    b.includes('Just a moment') ||
    b.includes('cf-challenge') ||
    b.includes('/cdn-cgi/challenge-platform')
  );
}

/**
 * Charge une page BWF pour (re)obtenir cf_clearance. Force=true ignore l'etat warmed.
 * Deduplique les warmups concurrents.
 */
async function warmup(force = false) {
  if (_warmed && !force) return;
  if (_warmupPromise) return _warmupPromise; // un warmup deja en cours
  _warmupPromise = (async () => {
    const page = await _context.newPage();
    try {
      await page.goto(WARMUP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000); // laisse le challenge JS se resoudre
      _warmed = true;
    } finally {
      await page.close();
      _warmupPromise = null;
    }
  })();
  return _warmupPromise;
}

/** Un seul aller-retour fetch depuis le navigateur. */
async function fetchInPage(url) {
  const page = await _context.newPage();
  try {
    await page.goto(REFERER, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return await page.evaluate(
      async ({ url, origin, referer }) => {
        const res = await fetch(url, {
          headers: { accept: 'application/json, text/plain, */*', origin, referer },
        });
        return { status: res.status, body: await res.text() };
      },
      { url, origin: ORIGIN, referer: REFERER }
    );
  } finally {
    await page.close();
  }
}

/**
 * GET un endpoint /api/... avec auto-refresh du cookie + retry sur blocage Cloudflare.
 * @param {string} path  ex: '/api/tournaments/day-matches?...'
 * @param {{retries?: number}} opts
 */
export async function apiGet(path, { retries = 2 } = {}) {
  await init();
  await warmup();
  const url = path.startsWith('http') ? path : BASE + path;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { status, body } = await fetchInPage(url);

    if (status === 200) {
      try {
        return JSON.parse(body);
      } catch {
        throw new Error(`Reponse non-JSON (200) pour ${url} :: ${body.slice(0, 150)}`);
      }
    }

    if (isCloudflareBlock(status, body)) {
      // Cookie probablement perime : on re-resout le challenge et on rejoue.
      lastErr = new Error(`Cloudflare a bloque (HTTP ${status}) sur ${url}`);
      _warmed = false;
      await warmup(true);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // backoff doux
      continue;
    }

    throw new Error(`HTTP ${status} pour ${url} :: ${body.slice(0, 150)}`);
  }
  throw lastErr || new Error(`Echec apres ${retries + 1} tentatives : ${url}`);
}

export async function close() {
  if (_browser) await _browser.close();
  _browser = _context = null;
  _warmed = false;
  _warmupPromise = null;
}

// ----------------------------------------------------------------------------
// Helpers metier (tous les endpoints importants de la doc)
// ----------------------------------------------------------------------------

const qs = (o) =>
  new URLSearchParams(
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null))
  ).toString();

// --- Tournois / resultats ---
export const dayMatches = ({ tournamentCode, date, order = 2, court = 0 }) =>
  apiGet(`/api/tournaments/day-matches?${qs({ tournamentCode, date, order, court })}`);

export const dayMatchesCourts = ({ tournamentCode, date }) =>
  apiGet(`/api/tournaments/day-matches/courts?${qs({ tournamentCode, date })}`);

export const dayMatchesPlayers = ({ tournamentCode, date }) =>
  apiGet(`/api/tournaments/day-matches/players?${qs({ tournamentCode, date })}`);

// --- Live / calendrier ---
export const currentLive = () =>
  apiGet('/api/match-center/vue-current-live?showpara=0');

export const tournamentsSearch = (params = {}) =>
  apiGet(`/api/vue-tournaments-search?${qs({ activeTab: 4, page: 1, perPage: 20, drawCount: 1, ...params })}`);

// --- Rankings ---
export const rankingData = ({ rankId }) => apiGet(`/api/vue-rankingdata?${qs({ rankId })}`);
export const rankingWeek = ({ rankId }) => apiGet(`/api/vue-rankingweek?${qs({ rankId })}`);
export const rankingTable = (params) =>
  apiGet(`/api/vue-rankingtable?${qs({ doubles: false, searchKey: '', pageKey: 10, page: 1, drawCount: 1, ...params })}`);

// --- Head-to-head moderne ---
export const h2hStatistics = ({ t1p1, t1p2 = '', t2p1, t2p2 = '' }) =>
  apiGet(`/api/h2h/statistics?${qs({ t1p1, t1p2, t2p1, t2p2 })}`);

export const h2hMatch = ({ tmt_id, match_code }) =>
  apiGet(`/api/h2h/match?${qs({ tmt_id, match_code })}`);

// --- Reference ---
export const countries = () => apiGet('/api/vue-countries');
export const organizations = () => apiGet('/api/vue-tournament-organizations');
