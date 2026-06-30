// src/services/__tests__/montecarlo.test.js
import { describe, it, expect } from 'vitest';
import { mcMatch, mcGroup, runSimulation } from '../montecarlo.js';
import teams from '../../data/teams.json';
import gr from '../../data/gr.json';
import koBracket from '../../data/ko-bracket.json';

describe('mcMatch', () => {
  it('returns one of the two teams', () => {
    const result = mcMatch('México', 'Argentina', teams);
    expect(['México', 'Argentina']).toContain(result);
  });

  it('handles unknown teams gracefully', () => {
    const result = mcMatch('TeamX', 'TeamY', teams);
    expect(['TeamX', 'TeamY']).toContain(result);
  });
});

describe('mcGroup', () => {
  it('returns all 4 teams in group A', () => {
    const result = mcGroup('A', gr, teams);
    expect(result).toHaveLength(4);
    expect(result.every(r => typeof r.team === 'string')).toBe(true);
  });

  it('returns teams sorted by pts desc', () => {
    // Run multiple times to check sorting is always valid
    for (let i = 0; i < 5; i++) {
      const result = mcGroup('B', gr, teams);
      for (let j = 0; j < result.length - 1; j++) {
        expect(result[j].pts).toBeGreaterThanOrEqual(result[j + 1].pts);
      }
    }
  });

  it('every team has pts, gd, gf, pos fields', () => {
    const result = mcGroup('C', gr, teams);
    result.forEach((r, i) => {
      expect(typeof r.pts).toBe('number');
      expect(typeof r.gd).toBe('number');
      expect(typeof r.gf).toBe('number');
      expect(r.pos).toBe(i);
    });
  });
});

describe('runSimulation', () => {
  it('returns counts for all 48 teams', () => {
    const counts = runSimulation(10, gr, teams, koBracket);
    expect(Object.keys(counts)).toHaveLength(48);
  });

  it('each team has all 6 stage counters', () => {
    const counts = runSimulation(10, gr, teams, koBracket);
    Object.values(counts).forEach(c => {
      expect(typeof c.group).toBe('number');
      expect(typeof c.r16).toBe('number');
      expect(typeof c.qf).toBe('number');
      expect(typeof c.sf).toBe('number');
      expect(typeof c.final).toBe('number');
      expect(typeof c.champion).toBe('number');
    });
  });

  it('champion count sums to N', () => {
    const N = 20;
    const counts = runSimulation(N, gr, teams, koBracket);
    const total = Object.values(counts).reduce((s, c) => s + c.champion, 0);
    expect(total).toBe(N);
  });

  it('group qualification is monotonically >= r16', () => {
    const counts = runSimulation(50, gr, teams, koBracket);
    Object.values(counts).forEach(c => {
      expect(c.group).toBeGreaterThanOrEqual(c.r16);
      expect(c.r16).toBeGreaterThanOrEqual(c.qf);
      expect(c.qf).toBeGreaterThanOrEqual(c.sf);
      expect(c.sf).toBeGreaterThanOrEqual(c.final);
      expect(c.final).toBeGreaterThanOrEqual(c.champion);
    });
  });
});
