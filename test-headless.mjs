/**
 * Test : Chrome en mode HEADLESS (non fenêtré) passe-t-il Cloudflare ?
 * Lance son propre navigateur (process séparé) — n'interfère pas avec le serveur.
 *   node test-headless.mjs
 */
import { init, currentLive, dayMatches, close } from "./src/bwf-client.js";

const today = process.argv[2] || new Date().toISOString().slice(0, 10);
console.log("Lancement de Chrome en HEADLESS…");

try {
  await init({ headless: true });

  const live = await currentLive();
  const tournaments = live.results ?? [];
  console.log(`✅ /live → ${tournaments.length} tournois :`,
    tournaments.map((t) => t.name).join(" | "));

  const code = tournaments[0]?.code;
  if (code) {
    const dm = await dayMatches({ tournamentCode: code, date: today });
    const matches = Object.values(dm); // la réponse est un tableau brut de matchs
    console.log(`✅ day-matches (${today}) → ${matches.length} matchs`);
  }

  console.log("\n🎉 HEADLESS PASSE CLOUDFLARE — pas besoin de xvfb sur le serveur.");
} catch (e) {
  console.log("\n❌ ÉCHEC en headless :", e.message);
  console.log("→ Cloudflare bloque probablement le mode non fenêtré.");
} finally {
  await close();
}
