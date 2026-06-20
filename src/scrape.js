// Recupere et affiche les matchs d'un tournoi/date.
// Usage : node src/scrape.js [date] [tournamentCode]
//   ex : node src/scrape.js 2026-06-19

import { dayMatches, close } from './bwf-client.js';
import { normalizeMatch, matchSummary } from './normalize.js';

const TOURNAMENT_CODE =
  process.argv[3] || '0FE7A0E9-A04C-47A4-A042-85A48ED966EC'; // Macau Open 2026
const DATE = process.argv[2] || '2026-06-19';

async function main() {
  console.log(`\n>> Macau Open (5214) — matchs du ${DATE}\n`);
  const raw = await dayMatches({ tournamentCode: TOURNAMENT_CODE, date: DATE });
  const matches = Object.values(raw).map(normalizeMatch);

  console.log(`${matches.length} match(s) :\n`);
  for (const n of matches) console.log(matchSummary(n));
}

main()
  .catch((e) => {
    console.error('\nERREUR :', e.message);
    process.exitCode = 1;
  })
  .finally(close);
