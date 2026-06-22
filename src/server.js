// TON API BWF.
// Ton appli appelle ces routes en HTTP simple — aucun navigateur cote client.
// Le seul Chrome tourne ici, dans ce process, partage entre toutes les requetes,
// avec auto-refresh du cookie Cloudflare + retry (voir bwf-client.js).
//
// Demarrage : npm run serve   (puis http://localhost:3000)

import express from 'express';
import * as bwf from './bwf-client.js';
import { normalizeMatch } from './normalize.js';
import { cached } from './cache.js';

const PORT = process.env.PORT || 3000;

// TTL par type de donnee (ms).
const TTL = {
  live: 20_000, // matchs du jour (potentiellement live)
  currentLive: 60_000, // tournois live globaux
  search: 5 * 60_000, // calendrier
  ranking: 6 * 60 * 60_000, // classements (publies chaque semaine)
  h2h: 60 * 60_000, // head-to-head
  ref: 24 * 60 * 60_000, // pays / organisations
};

const app = express();

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Wrapper : sert depuis le cache, gere les erreurs, pose l'en-tete X-Cache.
function route(keyFn, ttl, producer, transform = (x) => x) {
  return async (req, res) => {
    try {
      const key = keyFn(req);
      const { value, fromCache, ageMs } = await cached(key, ttl, () => producer(req));
      res.set('X-Cache', fromCache ? `HIT(${Math.round(ageMs / 1000)}s)` : 'MISS');
      res.json(transform(value, req));
    } catch (e) {
      res.status(502).json({ error: 'echec recuperation BWF', detail: e.message });
    }
  };
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// === Tournois / resultats ===

// GET /tournaments/:code/matches?date=YYYY-MM-DD[&order=&court=]
app.get(
  '/tournaments/:code/matches',
  route(
    (r) => `day:${r.params.code}:${r.query.date}:${r.query.order || 2}:${r.query.court || 0}`,
    TTL.live,
    (r) =>
      bwf
        .dayMatches({
          tournamentCode: r.params.code,
          date: r.query.date,
          order: r.query.order,
          court: r.query.court,
        })
        .then((raw) => Object.values(raw).map(normalizeMatch)),
    (matches, r) => ({ tournamentCode: r.params.code, date: r.query.date, count: matches.length, matches })
  )
);

// GET /tournaments/:code/courts?date=
app.get(
  '/tournaments/:code/courts',
  route((r) => `courts:${r.params.code}:${r.query.date}`, TTL.search,
    (r) => bwf.dayMatchesCourts({ tournamentCode: r.params.code, date: r.query.date }))
);

// GET /tournaments/:code/players?date=
app.get(
  '/tournaments/:code/players',
  route((r) => `players:${r.params.code}:${r.query.date}`, TTL.search,
    (r) => bwf.dayMatchesPlayers({ tournamentCode: r.params.code, date: r.query.date }))
);

// === Live / calendrier ===

// GET /live  -> tournois actuellement en live
app.get('/live', route(() => 'live:current', TTL.currentLive, () => bwf.currentLive()));

// GET /tournaments?activeTab=&page=&perPage=&searchText=... (calendrier)
app.get(
  '/tournaments',
  route((r) => `search:${JSON.stringify(r.query)}`, TTL.search, (r) => bwf.tournamentsSearch(r.query))
);

// GET /year-tournaments?year=2026  -> tous les tournois de l'annee (avec pays)
app.get(
  '/year-tournaments',
  route(
    (r) => `yeartmts:${r.query.year || ''}`,
    TTL.ranking,
    (r) => bwf.groupedYearTournaments({ year: Number(r.query.year) || new Date().getFullYear() })
  )
);

// === Rankings ===

// GET /rankings/:rankId/data
app.get('/rankings/:rankId/data', route((r) => `rkdata:${r.params.rankId}`, TTL.ranking,
  (r) => bwf.rankingData({ rankId: r.params.rankId })));

// GET /rankings/:rankId/weeks
app.get('/rankings/:rankId/weeks', route((r) => `rkweek:${r.params.rankId}`, TTL.ranking,
  (r) => bwf.rankingWeek({ rankId: r.params.rankId })));

// GET /rankings/:rankId/table?catId=&publicationId=&doubles=&page=...
app.get('/rankings/:rankId/table', route(
  (r) => `rktable:${r.params.rankId}:${JSON.stringify(r.query)}`, TTL.ranking,
  (r) => bwf.rankingTable({ rankId: r.params.rankId, ...r.query })));

// === Head-to-head ===

// GET /h2h?t1p1=&t1p2=&t2p1=&t2p2=
app.get('/h2h', route((r) => `h2h:${JSON.stringify(r.query)}`, TTL.h2h,
  (r) => bwf.h2hStatistics(r.query)));

// GET /h2h/match?tmt_id=&match_code=
app.get('/h2h/match', route((r) => `h2hm:${JSON.stringify(r.query)}`, TTL.h2h,
  (r) => bwf.h2hMatch(r.query)));

// === Reference ===

app.get('/countries', route(() => 'ref:countries', TTL.ref, () => bwf.countries()));
app.get('/organizations', route(() => 'ref:orgs', TTL.ref, () => bwf.organizations()));

// === Demarrage ===

async function start() {
  // headless:false par defaut (plus fiable face a Cloudflare en local).
  // Sur un serveur sans ecran : BWF_HEADLESS=true (teste OK, pas besoin de xvfb).
  const headless = process.env.BWF_HEADLESS === 'true';
  console.log(`Demarrage du navigateur partage (Chrome, headless: ${headless})...`);
  await bwf.init({ headless });
  console.log('Navigateur pret.');
  app.listen(PORT, () => {
    console.log(`\nTON API BWF en ecoute sur http://localhost:${PORT}`);
    console.log('Routes :');
    console.log('  GET /tournaments/:code/matches?date=YYYY-MM-DD');
    console.log('  GET /tournaments/:code/courts?date=   |   /players?date=');
    console.log('  GET /live');
    console.log('  GET /tournaments?activeTab=4&page=1   (calendrier)');
    console.log('  GET /rankings/:rankId/data | /weeks | /table?catId=&publicationId=');
    console.log('  GET /h2h?t1p1=&t2p1=   |   /h2h/match?tmt_id=&match_code=');
    console.log('  GET /countries | /organizations');
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log('\nArret...');
    await bwf.close();
    process.exit(0);
  });
}

start().catch((e) => {
  console.error('Echec demarrage :', e);
  process.exit(1);
});
