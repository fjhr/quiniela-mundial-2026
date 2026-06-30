// src/services/poisson.js

function poissonProb(lambda, k) {
  let r = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) r *= lambda / i;
  return r;
}

export function klem(team, teams) {
  const d = teams[team];
  if (!d) return 0.5;
  const g = d.gdp < 60000
    ? d.gdp / 60000
    : Math.max(0.6, 1 - 0.2 * (d.gdp - 60000) / 60000);
  const p = Math.min(Math.log(d.pop * d.dom + 1) / Math.log(300), 1);
  const t = Math.max(0, 1 - Math.pow(d.tmp - 14, 2) / 200);
  return 0.20 * g + 0.15 * p + 0.10 * t + 0.45 * Math.max(0, (101 - d.r) / 100) + 0.10 * (d.host || 0);
}

export function fscore(team, fm) {
  const f = (fm && fm[team]) || ['D', 'D', 'D', 'D', 'D'];
  const v = { W: 1, D: 0.4, L: 0 };
  const w = [1, 0.7, 0.49, 0.343, 0.24];
  const total = w.reduce((a, b) => a + b, 0);
  return f.reduce((s, x, i) => s + (v[x] ?? 0) * w[i], 0) / total;
}

export function sim(t1, t2, teams) {
  const kA = klem(t1, teams);
  const kB = klem(t2, teams);
  const rA = teams[t1]?.r ?? 50;
  const rB = teams[t2]?.r ?? 50;
  const lA = Math.max(0.3, Math.min(4.5, 1.45 * Math.exp(0.4 * (kA - kB) + 0.3 * (rB - rA) / 50)));
  const lB = Math.max(0.3, Math.min(4.5, 1.45 * Math.exp(0.4 * (kB - kA) + 0.3 * (rA - rB) / 50)));
  let pW = 0, pD = 0, pL = 0, tot = 0;
  for (let ga = 0; ga <= 8; ga++) {
    for (let gb = 0; gb <= 8; gb++) {
      const p = poissonProb(lA, ga) * poissonProb(lB, gb);
      tot += p;
      if (ga > gb) pW += p;
      else if (ga === gb) pD += p;
      else pL += p;
    }
  }
  return { pW: pW / tot, pD: pD / tot, pL: pL / tot, lA, lB, kA, kB };
}

export function tbl(group, res, gr) {
  const teamList = (gr && gr[group]) || [];
  const t = {};
  teamList.forEach(x => { t[x] = { t: x, pts: 0, j: 0, gf: 0, gc: 0, gd: 0 }; });
  res.filter(r => r.g === group && r.p && r.hg !== null).forEach(r => {
    if (!t[r.h]) t[r.h] = { t: r.h, pts: 0, j: 0, gf: 0, gc: 0, gd: 0 };
    if (!t[r.a]) t[r.a] = { t: r.a, pts: 0, j: 0, gf: 0, gc: 0, gd: 0 };
    t[r.h].j++; t[r.a].j++;
    t[r.h].gf += r.hg; t[r.h].gc += r.ag; t[r.h].gd += r.hg - r.ag;
    t[r.a].gf += r.ag; t[r.a].gc += r.hg; t[r.a].gd += r.ag - r.hg;
    if (r.hg > r.ag) t[r.h].pts += 3;
    else if (r.hg === r.ag) { t[r.h].pts++; t[r.a].pts++; }
    else t[r.a].pts += 3;
  });
  return Object.values(t).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.t.localeCompare(b.t)
  );
}
