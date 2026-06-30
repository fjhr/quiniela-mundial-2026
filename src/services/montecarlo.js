// src/services/montecarlo.js
// Pure Monte Carlo engine — no global state, all inputs passed explicitly.

// Stochastic Poisson sampling via Knuth's algorithm
function mcPoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// Simulate one KO match (no draw — random tiebreak on exact tie)
export function mcMatch(teamA, teamB, teams) {
  const kA = klem(teamA, teams), kB = klem(teamB, teams);
  const rA = teams[teamA]?.r ?? 50, rB = teams[teamB]?.r ?? 50;
  const lA = Math.max(0.3, Math.min(4.5, 1.45 * Math.exp(0.4 * (kA - kB) + 0.3 * (rB - rA) / 50)));
  const lB = Math.max(0.3, Math.min(4.5, 1.45 * Math.exp(0.4 * (kB - kA) + 0.3 * (rA - rB) / 50)));
  const ga = mcPoisson(lA), gb = mcPoisson(lB);
  if (ga > gb) return teamA;
  if (gb > ga) return teamB;
  return Math.random() < 0.5 ? teamA : teamB; // penalty tiebreak
}

// Simulate group stage for one group
// Returns teams sorted by simulated pts/gd/gf
export function mcGroup(grpKey, gr, teams) {
  const teamList = gr[grpKey] || [];
  const pts = {}, gd = {}, gf = {};
  teamList.forEach(t => { pts[t] = 0; gd[t] = 0; gf[t] = 0; });

  for (let i = 0; i < teamList.length; i++) {
    for (let j = i + 1; j < teamList.length; j++) {
      const na = teamList[i], nb = teamList[j];
      const kA = klem(na, teams), kB = klem(nb, teams);
      const rA = teams[na]?.r ?? 50, rB = teams[nb]?.r ?? 50;
      const lA = Math.max(0.3, Math.min(4.5, 1.45 * Math.exp(0.4 * (kA - kB) + 0.3 * (rB - rA) / 50)));
      const lB = Math.max(0.3, Math.min(4.5, 1.45 * Math.exp(0.4 * (kB - kA) + 0.3 * (rA - rB) / 50)));
      const ga = mcPoisson(lA), gb = mcPoisson(lB);
      gf[na] += ga; gf[nb] += gb;
      gd[na] += ga - gb; gd[nb] += gb - ga;
      if (ga > gb) pts[na] += 3;
      else if (gb > ga) pts[nb] += 3;
      else { pts[na]++; pts[nb]++; }
    }
  }

  return teamList.slice()
    .sort((a, b) => (pts[b] - pts[a]) || (gd[b] - gd[a]) || (gf[b] - gf[a]))
    .map((t, pos) => ({ team: t, pts: pts[t], gd: gd[t], gf: gf[t], pos }));
}

// Run N Monte Carlo simulations of the full 2026 FIFA tournament.
// Returns counts: { [teamName]: { group, r16, qf, sf, final, champion } }
export function runSimulation(N, gr, teams, koBracket) {
  const allTeams = Object.keys(teams);
  const counts = {};
  allTeams.forEach(t => {
    counts[t] = { group: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0 };
  });

  for (let n = 0; n < N; n++) {
    const simStd = {};
    const thirds = [];

    // Group stage
    Object.keys(gr).forEach(g => {
      const res = mcGroup(g, gr, teams);
      simStd[g] = res;
      counts[res[0].team].group++;
      counts[res[1].team].group++;
      thirds.push({ team: res[2].team, pts: res[2].pts, gd: res[2].gd, g });
    });

    // Top 8 third-placed teams also advance to R32
    thirds.slice().sort((a, b) => (b.pts - a.pts) || (b.gd - a.gd))
      .slice(0, 8).forEach(x => { counts[x.team].group++; });

    // Resolve group-stage bracket slots
    function resolveSimSlot(slot) {
      if (/^1[A-L]$/.test(slot)) return simStd[slot[1]][0].team;
      if (/^2[A-L]$/.test(slot)) return simStd[slot[1]][1].team;
      if (/^3[A-L]$/.test(slot)) {
        const t = thirds.find(x => x.g === slot[1]);
        return t ? t.team : '';
      }
      return '';
    }

    // Winner map for KO propagation
    const rw = {};

    // R32
    koBracket.filter(k => k.rnd === 'R32').forEach(kb => {
      const t1 = resolveSimSlot(kb.sh), t2 = resolveSimSlot(kb.sa);
      if (!t1 || !t2) return;
      const w = mcMatch(t1, t2, teams);
      rw[kb.id] = w;
      counts[w].r16++;
    });

    function resolveRW(slot) {
      if (slot?.startsWith('W')) return rw[parseInt(slot.slice(1))] || '';
      return '';
    }

    // R16
    koBracket.filter(k => k.rnd === 'R16').forEach(kb => {
      const t1 = resolveRW(kb.sh), t2 = resolveRW(kb.sa);
      if (!t1 || !t2) return;
      const w = mcMatch(t1, t2, teams);
      rw[kb.id] = w;
      counts[w].qf++;
    });

    // QF
    koBracket.filter(k => k.rnd === 'QF').forEach(kb => {
      const t1 = resolveRW(kb.sh), t2 = resolveRW(kb.sa);
      if (!t1 || !t2) return;
      const w = mcMatch(t1, t2, teams);
      rw[kb.id] = w;
      counts[w].sf++;
    });

    // SF
    koBracket.filter(k => k.rnd === 'SF').forEach(kb => {
      const t1 = resolveRW(kb.sh), t2 = resolveRW(kb.sa);
      if (!t1 || !t2) return;
      const w = mcMatch(t1, t2, teams);
      rw[kb.id] = w;
      counts[w].final++;
    });

    // Final
    const fin = koBracket.find(k => k.rnd === 'Final');
    if (fin) {
      const t1 = resolveRW(fin.sh), t2 = resolveRW(fin.sa);
      if (t1 && t2) {
        const champ = mcMatch(t1, t2, teams);
        counts[champ].champion++;
      }
    }
  }

  return counts;
}

// klem() re-implemented here so the worker is self-contained (no import chain)
function klem(team, teams) {
  const d = teams[team];
  if (!d) return 0.5;
  const g = d.gdp < 60000 ? d.gdp / 60000 : Math.max(0.6, 1 - 0.2 * (d.gdp - 60000) / 60000);
  const p = Math.min(Math.log(d.pop * d.dom + 1) / Math.log(300), 1);
  const t = Math.max(0, 1 - Math.pow(d.tmp - 14, 2) / 200);
  return 0.20 * g + 0.15 * p + 0.10 * t + 0.45 * Math.max(0, (101 - d.r) / 100) + 0.10 * (d.host || 0);
}
