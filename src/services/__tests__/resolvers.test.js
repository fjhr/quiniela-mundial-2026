// src/services/__tests__/resolvers.test.js
import { describe, it, expect } from 'vitest';
import { resolveKOTeam, mapName, fmtMatchDT } from '../resolvers.js';
import gr from '../../data/gr.json';
import koBracketData from '../../data/ko-bracket.json';
import initData from '../../data/init.json';

// Build a mock resKO with one played match
const mockResKO = [
  { id: 73, rnd: 'R32', h: 'Sudáfrica', a: 'Canadá', hg: 0, ag: 1, p: true, pens: '' },
  { id: 74, rnd: 'R32', h: '', a: '', hg: null, ag: null, p: false, pens: '' },
];

describe('resolveKOTeam', () => {
  it('resolves group winner slot using real init data', () => {
    // Group A in real data — Mexico won Group A (check init.json)
    const result = resolveKOTeam('1A', initData, mockResKO, koBracketData, gr);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0); // resolves to some team
  });

  it('resolves W slot to winner of played KO match', () => {
    const result = resolveKOTeam('W73', initData, mockResKO, koBracketData, gr);
    expect(result).toBe('Canadá'); // ag=1 > hg=0
  });

  it('returns empty string for unplayed W slot', () => {
    const result = resolveKOTeam('W74', initData, mockResKO, koBracketData, gr);
    expect(result).toBe('');
  });

  it('resolves L slot to loser of played KO match', () => {
    const result = resolveKOTeam('L73', initData, mockResKO, koBracketData, gr);
    expect(result).toBe('Sudáfrica'); // lost 0-1
  });

  it('returns empty string for empty slot', () => {
    expect(resolveKOTeam('', initData, mockResKO, koBracketData, gr)).toBe('');
  });

  it('handles pens field for W slot', () => {
    const resKOWithPens = [
      { id: 73, rnd: 'R32', h: 'Brasil', a: 'Argentina', hg: 1, ag: 1, p: true, pens: 'a' },
    ];
    expect(resolveKOTeam('W73', initData, resKOWithPens, koBracketData, gr)).toBe('Argentina');
  });
});

describe('mapName', () => {
  const nameMap = { 'Brazil': 'Brasil', 'Japan': 'Japón' };
  it('maps known ESPN name to Spanish', () => {
    expect(mapName('Brazil', nameMap)).toBe('Brasil');
  });
  it('returns original name if not in map', () => {
    expect(mapName('México', nameMap)).toBe('México');
  });
  it('returns name unchanged when nameMap is null', () => {
    expect(mapName('Brasil', null)).toBe('Brasil');
  });
});

describe('fmtMatchDT', () => {
  it('returns date-only string when no matchTime', () => {
    const sched = { '74': { dt: '2026-06-29' } };
    const result = fmtMatchDT(74, {}, sched);
    expect(result).toMatch(/29 Jun/);
  });

  it('returns formatted time when matchTime available', () => {
    // Use a fixed UTC time
    const matchTimes = { 74: '2026-06-29T23:00:00Z' };
    const sched = { '74': { dt: '2026-06-29' } };
    const result = fmtMatchDT(74, matchTimes, sched);
    // Should contain time pattern HH:MM
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns empty string for missing id', () => {
    expect(fmtMatchDT(9999, {}, {})).toBe('');
  });

  it('handles string vs number id lookup', () => {
    const sched = { '1': { dt: '2026-06-12' } };
    expect(fmtMatchDT(1, {}, sched)).toMatch(/12 Jun/);
  });
});
