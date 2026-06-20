// Dump la structure brute d'un match pour mapper les champs.
import { dayMatches, close } from './bwf-client.js';

const TOURNAMENT_CODE = '0FE7A0E9-A04C-47A4-A042-85A48ED966EC';
const DATE = process.argv[2] || '2026-06-19';

const data = await dayMatches({ tournamentCode: TOURNAMENT_CODE, date: DATE });
const matches = data.matches || data.results || data.data || data;

console.log('Cles racine:', Object.keys(data));
console.log('\n=== Premier match (JSON brut) ===\n');
console.log(JSON.stringify(matches[0], null, 2));
await close();
