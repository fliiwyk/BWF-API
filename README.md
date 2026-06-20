# API BWF (non officielle)

Ton API qui expose les donnees BWF en **HTTP simple**, sans navigateur cote client.

## Architecture

```
Ton appli ──HTTP──► Ton API (Express) ──cache──► Worker Playwright (1 Chrome partage)
                                                         │
                                                  passe Cloudflare
                                                         ▼
                                              API BWF (extranet-lv...)
```

Le navigateur est **enferme dans le serveur** : il passe le challenge Cloudflare
(cookie `cf_clearance` + empreinte TLS coherents) une seule fois, puis sert toutes
les requetes. Ton appli ne fait que du `fetch`/`axios` vers ton serveur.

## Demarrage

```bash
npm install
npx playwright install chromium   # (optionnel : on utilise Chrome installe via channel:'chrome')
npm run serve                      # http://localhost:3000
```

> Le serveur lance Chrome (channel `chrome`). Il doit rester ouvert en continu.
> En production : `pm2 start src/server.js` ou service Windows pour redemarrage auto.

## Routes

| Methode | Route | Description |
|---|---|---|
| GET | `/tournaments/:code/matches?date=YYYY-MM-DD` | Matchs + scores (normalises) |
| GET | `/tournaments/:code/courts?date=` | Liste des courts |
| GET | `/tournaments/:code/players?date=` | Joueurs presents |
| GET | `/live` | Tournois actuellement en live |
| GET | `/tournaments?activeTab=4&page=1` | Calendrier / recherche |
| GET | `/rankings/:rankId/data` | Metadata classement |
| GET | `/rankings/:rankId/weeks` | Semaines publiees |
| GET | `/rankings/:rankId/table?catId=&publicationId=` | Table de classement |
| GET | `/h2h?t1p1=&t2p1=` | Head-to-head (stats) |
| GET | `/h2h/match?tmt_id=&match_code=` | Detail d'un match |
| GET | `/countries` / `/organizations` | Reference |
| GET | `/health` | Etat du serveur |

`:code` = UUID du tournoi. Macau Open 2026 = `0FE7A0E9-A04C-47A4-A042-85A48ED966EC`.

En-tete `X-Cache: HIT|MISS` sur chaque reponse.

## Fiabilite

- **Auto-refresh** : si Cloudflare bloque (403/challenge), le client re-resout le
  challenge et rejoue l'appel automatiquement (`bwf-client.js`, jusqu'a 2 retries).
- **Cache TTL** par type de donnee + anti-stampede (1 seul appel BWF concurrent par cle).
- Ne pas descendre le TTL live sous ~15-20s (risque de bannissement IP).

## Limites

- API non officielle, pas de garantie de stabilite.
- Usage perso/proto OK. Public/commercial -> licence BWF (`extranet-api.bwf.sport`).
