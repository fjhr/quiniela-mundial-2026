// src/services/resolvers.js
import { tbl } from './poisson.js';

// Returns team name (string) or '' if not resolved
export function resolveKOTeam(slot, res, resKO, koBracket, gr) {
  if (!slot) return '';

  // Group position slots: '1A', '2C', etc.
  if (/^1[A-L]$/.test(slot)) return tbl(slot[1], res, gr)[0]?.t || '';
  if (/^2[A-L]$/.test(slot)) return tbl(slot[1], res, gr)[1]?.t || '';
  if (/^3[A-L]$/.test(slot)) return tbl(slot[1], res, gr)[2]?.t || '';

  // Best third-placed slots: '3B1', '3B2', ..., '3B8' (sorted best thirds)
  if (slot.startsWith('3B')) {
    const thirds = Object.keys(gr)
      .map(g => tbl(g, res, gr)[2])
      .filter(Boolean);
    thirds.sort((a, b) => (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf));
    const idx = parseInt(slot.slice(2)) - 1;
    return (thirds[idx] && thirds[idx].t) || '';
  }

  // Winner slots: 'W73', 'W74', ...
  if (slot.startsWith('W')) {
    const mid = parseInt(slot.slice(1));
    const m = resKO.find(k => k.id === mid);
    if (!m || !m.p) return '';
    if (m.pens) return m.pens === 'h' ? m.h : m.a;
    return m.hg > m.ag ? m.h : m.ag > m.hg ? m.a : '';
  }

  // Loser slots: 'L101', 'L102' (third place match)
  if (slot.startsWith('L')) {
    const mid = parseInt(slot.slice(1));
    const m = resKO.find(k => k.id === mid);
    if (!m || !m.p) return '';
    if (m.pens) return m.pens === 'h' ? m.a : m.h;
    return m.hg < m.ag ? m.h : m.ag < m.hg ? m.a : '';
  }

  return '';
}

export function mapName(name, nameMap) {
  return (nameMap && nameMap[name]) || name;
}

// fmtMatchDT: formats match date/time using local timezone display
// matchTimes values are ISO strings (e.g. "2026-06-29T18:00:00Z")
export function fmtMatchDT(id, matchTimes, sched) {
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const mt = matchTimes && (matchTimes[id] || matchTimes[String(id)]);
  if (mt) {
    const d = new Date(mt);
    return `${d.getDate()} ${MESES[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  const s = sched && (sched[id] || sched[String(id)]);
  if (s && s.dt) {
    const p = s.dt.split('-');
    return `${parseInt(p[2])} ${MESES[parseInt(p[1]) - 1]}`;
  }
  return '';
}
