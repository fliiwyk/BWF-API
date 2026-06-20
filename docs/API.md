# Reference API BWF (ton serveur)

Base URL (local) : `http://localhost:3000`

Toutes les reponses portent l'en-tete `X-Cache: HIT(<age>s) | MISS`.
Erreur upstream → `502 { error, detail }`.

`:code` = UUID du tournoi BWF. Exemple Macau Open 2026 :
`0FE7A0E9-A04C-47A4-A042-85A48ED966EC`.

---

## Sante

### GET /health
```json
{ "ok": true }
```

---

## Tournois / resultats

### GET /tournaments/:code/matches?date=YYYY-MM-DD
Matchs **normalises** d'un tournoi pour une date. C'est l'endpoint central.

Query optionnels : `order` (1=horaire, 2=court), `court` (0=tous).

```json
{
  "tournamentCode": "0FE7A0E9-...",
  "date": "2026-06-20",
  "count": 10,
  "matches": [
    {
      "id": 1523361,
      "code": "334",
      "event": "XD",
      "round": "QF",
      "court": "Court 1",
      "status": "Finished",
      "statusCode": "F",
      "startTime": "2026-06-20 12:00:00",
      "startTimeUtc": "2026-06-20 04:00:00",
      "durationMin": 52,
      "winner": 2,
      "team1": {
        "country": "KOR",
        "flag": "https://img.bwfbadminton.com/.../KOR.png",
        "players": [
          { "id": "62804", "name": "LEE JONGMIN", "slug": "jongmin-lee", "country": "KOR" }
        ]
      },
      "team2": { "country": "CHN", "players": [ ... ] },
      "team1Seed": null,
      "team2Seed": "4",
      "sets": [
        { "set": 1, "team1": 15, "team2": 21 },
        { "set": 2, "team1": 21, "team2": 7 },
        { "set": 3, "team1": 17, "team2": 21 }
      ],
      "scoreLine": "15-21 21-7 17-21"
    }
  ]
}
```

Valeurs `status` : `none` (pas commence), `In Progress` (live), `Finished`.
`winner` : `1` ou `2` (cote team1 / team2).

### GET /tournaments/:code/courts?date=YYYY-MM-DD
```json
[ { "code": "1", "name": "Court 1" }, { "code": "2", "name": "Court 2" } ]
```

### GET /tournaments/:code/players?date=YYYY-MM-DD
```json
{ "players": [ { "id": "18889", "nameDisplay": "CAO Zi Han", "countryCode": "CHN", ... } ] }
```

---

## Live / calendrier

### GET /live
Tournois actuellement en cours (metadata : id, code, nom, dates, dotation...).
```json
{ "results": [ { "id": 5214, "code": "0FE7A0E9-...", "name": "SANDS CHINA LTD. Macau Open 2026", "start_date": "...", "end_date": "...", "prize_money": "370000.00" } ] }
```

### GET /tournaments?activeTab=4&page=1&perPage=20
Calendrier / recherche. Query libres : `searchText`, `startDate`, `endDate`,
`country`, `level`, `category`, `status`, `activeTab` (3=sem. precedente,
4=actuelle, 5=prochaine, 6=tous).

---

## Rankings

### GET /rankings/:rankId/data
Metadata du classement courant. `rankId=2` = BWF World Rankings.

### GET /rankings/:rankId/weeks
Publications disponibles (`id`, `year`, `week`, `date`, `display`).

### GET /rankings/:rankId/table?catId=&publicationId=&page=
Table paginee (10/page). Categories pour `rankId=2` :

| Discipline | catId | doubles |
|---|---|---|
| MS | 6 | false |
| WS | 7 | false |
| MD | 8 | true |
| WD | 9 | true |
| XD | 10 | true |

Chaque ligne : `rank`, `points`, `tournaments`, `player1_model` (id, slug,
`name_display_bold`), `p1_country_model`, idem player2 pour les doubles.

---

## Head-to-head

### GET /h2h?t1p1=&t1p2=&t2p1=&t2p2=
Stats H2H completes. Simple : ne passer que `t1p1` et `t2p1` (IDs joueurs).
```
/h2h?t1p1=57945&t2p1=72885
```
Retour : `stats`, `matches`, `ranking`, `players`, `careerStats`, `prizeMoney`.

### GET /h2h/match?tmt_id=&match_code=
Detail d'un match (games, points si dispo).

---

## Reference

### GET /countries
`{ "results": [ { "code": "FRA", "name": "France" } ] }`

### GET /organizations
`{ "results": [ { "name": "Badminton World Federation", "id": 1 } ] }`

---

## Identifiants utiles

| Joueur | ID |
|---|---|
| Shi Yu Qi | 57945 |
| Viktor Axelsen | 25831 |
| Christo Popov | 72885 |

`rankId` : 1=Junior, 2=World, 3=Team, 9=World Tour/HSBC Race, 52=World Championships.
