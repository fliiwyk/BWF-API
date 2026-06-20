// Normalise un match brut de l'API BWF en objet propre et stable.

function team(t) {
  if (!t) return null;
  return {
    country: t.countryCode || null,
    flag: t.countryFlagUrl || null,
    players: (t.players || []).map((p) => ({
      id: p.id,
      name: p.nameDisplay,
      slug: p.slug,
      country: p.countryCode,
    })),
  };
}

function teamLabel(t) {
  if (!t || !t.players?.length) return '?';
  return t.players.map((p) => p.name).join(' / ');
}

export function normalizeMatch(m) {
  const sets = (m.score || []).map((s) => ({
    set: s.set,
    team1: s.home,
    team2: s.away,
  }));
  return {
    id: m.id,
    code: m.code,
    event: m.eventName, // MS, WS, MD, WD, XD
    round: m.roundName, // QF, SF, F...
    court: m.courtName,
    status: m.matchStatusValue, // Finished, Playing, etc.
    statusCode: m.matchStatus, // F, ...
    startTime: m.matchTime,
    startTimeUtc: m.matchTimeUtc,
    durationMin: m.duration,
    winner: m.winner, // 1 ou 2
    team1: team(m.team1),
    team2: team(m.team2),
    team1Seed: m.team1seed,
    team2Seed: m.team2seed,
    sets,
    scoreLine: sets.map((s) => `${s.team1}-${s.team2}`).join(' '),
  };
}

export function matchSummary(n) {
  const t1 = teamLabel(n.team1);
  const t2 = teamLabel(n.team2);
  const mark = (side) => (n.winner === side ? ' (V)' : '');
  return `[${n.event} ${n.round}] ${t1}${mark(1)}  vs  ${t2}${mark(2)}` +
    `  | ${n.scoreLine || '-'}  | ${n.status}  | ${n.court}`;
}
