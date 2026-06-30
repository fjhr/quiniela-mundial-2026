// src/services/__tests__/poisson.test.js
import { describe, it, expect } from 'vitest';
import { klem, sim, tbl, fscore } from '../poisson.js';
import teams from '../../data/teams.json';
import gr from '../../data/gr.json';
import fm from '../../data/fm.json';

describe('klem', () => {
  it('returns a number between 0 and 1', () => {
    const score = klem('Brasil', teams);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
  it('returns 0.5 for unknown team', () => {
    expect(klem('TeamXYZ', teams)).toBe(0.5);
  });
  it('higher-ranked teams score higher than very low-ranked ones', () => {
    const highRank = Object.entries(teams).find(([, d]) => d.r <= 5)?.[0];
    const lowRank = Object.entries(teams).sort((a, b) => b[1].r - a[1].r)[0]?.[0];
    if (highRank && lowRank) {
      expect(klem(highRank, teams)).toBeGreaterThan(klem(lowRank, teams));
    }
  });
});

describe('sim', () => {
  it('probabilities sum to ~1', () => {
    const t1 = Object.keys(teams)[0];
    const t2 = Object.keys(teams)[1];
    const r = sim(t1, t2, teams);
    expect(r.pW + r.pD + r.pL).toBeCloseTo(1, 3);
  });
  it('returns lA and lB as positive numbers', () => {
    const t1 = Object.keys(teams)[0];
    const t2 = Object.keys(teams)[1];
    const { lA, lB } = sim(t1, t2, teams);
    expect(lA).toBeGreaterThan(0);
    expect(lB).toBeGreaterThan(0);
  });
  it('better team has higher pW vs much weaker team', () => {
    const byRank = Object.entries(teams).sort((a, b) => a[1].r - b[1].r);
    const best = byRank[0][0];
    const worst = byRank[byRank.length - 1][0];
    const { pW, pL } = sim(best, worst, teams);
    expect(pW).toBeGreaterThan(pL);
  });
});

describe('tbl', () => {
  it('returns standings for group A using real data', () => {
    const res = [
      { id: 1, g: 'A', h: gr['A'][0], a: gr['A'][1], hg: 2, ag: 0, p: true },
      { id: 2, g: 'A', h: gr['A'][2], a: gr['A'][3], hg: 1, ag: 1, p: true },
    ];
    const standings = tbl('A', res, gr);
    expect(standings.length).toBe(4); // all 4 teams in group
    expect(standings[0].pts).toBe(3);  // winner has 3 pts
  });
  it('returns empty-ish standings for group with no played matches', () => {
    const standings = tbl('A', [], gr);
    expect(standings.length).toBe(4); // teams initialized from gr
    standings.forEach(s => expect(s.pts).toBe(0));
  });
});

describe('fscore', () => {
  it('returns a number between 0 and 1', () => {
    const t = Object.keys(fm)[0];
    const score = fscore(t, fm);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
  it('returns 0.4 for default D,D,D,D,D form (unknown team)', () => {
    const score = fscore('UnknownTeam', fm);
    // All D: v=0.4, weights=[1,.7,.49,.343,.24], total=2.773
    // score = 0.4 * 2.773 / 2.773 = 0.4
    expect(score).toBeCloseTo(0.4, 2);
  });
});
