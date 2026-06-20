# Migration BetsAPI -> API BWF (My Little Shuttle)

Analyse de couverture pour remplacer **BetsAPI** (`src/server/betsapi.ts`) par
cette API BWF dans l'app de pronostics.

## Verdict

**Couverture complete.** Tous les champs du contrat `ApiMatch` / `ApiTournament`
sont fournis par BWF, avec une **meilleure qualite** sur 3 points (round, pays
en double, IDs joueurs). Aucun endpoint manquant.

## Correspondance des champs

| Champ app (`types.ts`) | Source BetsAPI | Source BWF (`day-matches`) | Note |
|---|---|---|---|
| `ApiMatch.id` | `b365:<event_id>` | `id` | |
| `discipline` | suffixe nom de ligue | `eventName` | direct, plus de regex |
| `round` | **devine** (`stageLabel` par comptage) | `roundName` | **mieux** : QF/SF/F fournis |
| `home/away.name` | `team.name` | `players[].nameDisplay` | doubles = joindre par " / " |
| `home/away.country` | vide en double -> table manuelle | `team.countryCode` / `players[].countryCode` | **mieux** |
| `home/away.id` | absent | `players[].id` | **nouveau** -> H2H possible |
| `home/away.rank` | absent (bonus outsider off) | join `/rankings/.../table` par player id | voir ci-dessous |
| `startTime` | `time` (epoch) | `matchTimeUtc` | ISO |
| `status` | `time_status` map | `matchStatusValue` | none->open, In Progress->locked, Finished->finished |
| `result.winner` | deduit du `ss` | `winner` (1/2) | 1->home, 2->away |
| `result.sets` | deduit du `ss` | derive de `score[]` (manches gagnees) | 2-0 / 2-1 / null |
| `result.score` | `scores` | `score[]` joint | "21-18, 19-21, 21-15" |
| `ApiTournament.name` | `league.name` nettoye | `tournamentName` | |
| `location` | `tournamentInfo.ts` | `locationName` | |
| `country` | `tournamentInfo` / `league.cc` | `/live` ou venue | derivable |
| `qualifyingActive` | ligues "... Qual" ouvertes | filtrer draws de qualif dans le flux | derivable |

## Mapping des statuts

| App | BetsAPI `time_status` | BWF `matchStatus` |
|---|---|---|
| `open` | 0 | `none` (programme, pas commence) |
| `locked` | 1, 7 | `In Progress` |
| `finished` | 3, 6, 9 | `F` / `Finished` |
| exclu | 2, 4, 5, 8, 99 | (absent du flux) |

## Les 2 points a coder (mapping, pas d'endpoint manquant)

1. **Rang joueur** (`Player.rank`) : non present dans `day-matches`.
   - Recuperer une fois par semaine via `/rankings/2/table` (cf.
     `scripts/update-bwf-rankings.mjs` existant).
   - Avec les **player IDs** BWF, indexer par `id` (fiable) plutot que par nom.
2. **`qualifyingActive` + pays tournoi** : derives de `/live` + des draws de
   qualification presents dans `day-matches` (filtrer sur le draw/round de qualif).

## Changement architectural

| | BetsAPI | BWF |
|---|---|---|
| Granularite | 1 appel mondial / jour | par tournoi x date |
| Flux | `upcoming` + `inplay` + `ended` | `/live` -> puis `day-matches` par tournoi/date |
| Code de devinette | `stageLabel`, `doublesCountry`, regroupement/jour | **supprime** (donnees directes) |
| `fetchEventOutcome` (rattrapage) | `/v1/event/view` | re-fetch `day-matches` du jour, retrouver par `id` |

### Pseudo-flux de remplacement de `buildPayload()`
```
1. GET /live                      -> tournois actifs (code, dates)
2. pour chaque tournoi:
     pour chaque date du tournoi (J-8 .. J+1):
       GET /tournaments/:code/matches?date=...
3. normaliser chaque match -> ApiMatch (mapping ci-dessus)
4. grouper par tournoi -> ApiTournament[]
5. (optionnel) enrichir Player.rank via la table de rankings indexee par id
```

## Plan de migration suggere

1. Creer `src/server/bwf.ts` exposant le **meme** `buildPayload()` et
   `fetchEventOutcome()` (signatures identiques) -> drop-in.
2. Garder `types.ts` inchange (le contrat ne bouge pas).
3. Basculer l'import dans `matchesService.ts` (`./betsapi` -> `./bwf`).
4. Supprimer le code de devinette devenu inutile.
5. Brancher H2H (`/h2h`) sur l'ecran de prono (type `H2HData` deja defini).
6. Verifier : `npm run lint` + `npm run build`.

> Le contrat de domaine ne change pas : la migration est isolee a la couche
> "provider". Scoring, store, UI, i18n restent intacts.
