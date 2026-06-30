// src/panels/EliminatoriaPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import { resolveKOTeam } from '../services/resolvers.js';
import { sim } from '../services/poisson.js';
import MatchCard from '../components/MatchCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import teams from '../data/teams.json';
import sched from '../data/sched.json';
import koBracket from '../data/ko-bracket.json';
import gr from '../data/gr.json';

const RND_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'R32', label: '32avos' },
  { value: 'R16', label: 'Octavos' },
  { value: 'QF', label: 'Cuartos' },
  { value: 'SF', label: 'Semis' },
  { value: 'Final', label: 'Final' },
];

export default function EliminatoriaPanel() {
  const { res, resKO, matchTimes } = useMatchStore();
  const { koTab, setKoTab } = useUiStore();

  const koMatches = koBracket
    .filter(kb => koTab === 'all' || kb.rnd === koTab)
    .map(kb => {
      const rko = resKO.find(r => r.id === kb.id) || {};
      const h = resolveKOTeam(kb.sh, res, resKO, koBracket, gr);
      const a = resolveKOTeam(kb.sa, res, resKO, koBracket, gr);
      const pr = (!rko.p && h && a && teams[h] && teams[a]) ? sim(h, a, teams) : null;
      return {
        id: kb.id, rnd: kb.rnd,
        h: h || kb.sh, a: a || kb.sa,
        hg: rko.hg ?? null, ag: rko.ag ?? null, p: rko.p || false, pens: rko.pens || '',
        pr,
      };
    });

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>⚔️ Fase Eliminatoria</h2>
      <FilterBar filters={RND_FILTERS} active={koTab} onChange={setKoTab} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {koMatches.map(m => (
          <div key={m.id}>
            <MatchCard match={m} teams={teams} matchTimes={matchTimes} sched={sched} />
            {m.pr && !m.p && (
              <div style={{ fontSize: 11, color: 'var(--text-500)', textAlign: 'center', marginTop: 2 }}>
                {(m.pr.pW * 100).toFixed(0)}% – {(m.pr.pD * 100).toFixed(0)}% – {(m.pr.pL * 100).toFixed(0)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
