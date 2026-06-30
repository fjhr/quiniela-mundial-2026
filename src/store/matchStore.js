// src/store/matchStore.js
import { create } from 'zustand';
import initData from '../data/init.json';
import koBracketData from '../data/ko-bracket.json';

function buildInitialResKO(koBracket) {
  return koBracket.map(m => ({
    id: m.id, rnd: m.rnd,
    h: '', a: '', hg: null, ag: null, p: false, pens: '',
  }));
}

export const useMatchStore = create((set, get) => ({
  res: initData.map(r => ({ ...r })),
  resKO: buildInitialResKO(koBracketData),
  matchTimes: (() => {
    try { return JSON.parse(localStorage.getItem('match-times') || '{}'); } catch { return {}; }
  })(),

  applyESPNResults(events, nameMap = {}) {
    const { res } = get();
    let count = 0;
    const newRes = res.map(r => ({ ...r }));
    events.forEach(ev => {
      const comp = (ev.competitions || [])[0] || {};
      if (!comp.status?.type?.completed) return;
      const comps = comp.competitors || [];
      const hComp = comps.find(c => c.homeAway === 'home') || comps[0];
      const aComp = comps.find(c => c.homeAway === 'away') || comps[1];
      if (!hComp || !aComp) return;
      const hName = nameMap[hComp.team?.name] || hComp.team?.displayName || hComp.team?.name || '';
      const aName = nameMap[aComp.team?.name] || aComp.team?.displayName || aComp.team?.name || '';
      const idx = newRes.findIndex(r =>
        (r.h === hName && r.a === aName) || (r.h === aName && r.a === hName)
      );
      if (idx === -1) return;
      const hg = parseInt(hComp.score || '0');
      const ag = parseInt(aComp.score || '0');
      if (!newRes[idx].p || newRes[idx].hg !== hg || newRes[idx].ag !== ag) {
        const isSwapped = newRes[idx].h === aName;
        newRes[idx] = { ...newRes[idx], hg: isSwapped ? ag : hg, ag: isSwapped ? hg : ag, p: true };
        count++;
      }
    });
    if (count > 0) set({ res: newRes });
    return count;
  },

  applyKOUpdates(updates) {
    if (!updates.length) return;
    set(state => ({
      resKO: state.resKO.map(k => {
        const upd = updates.find(u => u.id === k.id);
        return upd ? { ...k, ...upd } : k;
      }),
    }));
  },

  setKOTeamNames(koBracket, resolver) {
    set(state => ({
      resKO: state.resKO.map(k => {
        if (k.p) return k;
        const slot = koBracket.find(s => s.id === k.id);
        if (!slot) return k;
        const h = resolver(slot.sh);
        const a = resolver(slot.sa);
        return { ...k, h: h || k.h, a: a || k.a };
      }),
    }));
  },

  setMatchTimes(times) {
    set({ matchTimes: times });
    try { localStorage.setItem('match-times', JSON.stringify(times)); } catch {}
  },

  updateKOResult(id, hg, ag, pens = '') {
    set(state => ({
      resKO: state.resKO.map(k => k.id === id ? { ...k, hg, ag, p: true, pens } : k),
    }));
  },
}));
