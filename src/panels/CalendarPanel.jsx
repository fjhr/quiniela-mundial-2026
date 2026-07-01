// src/panels/CalendarPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import MatchCard from '../components/MatchCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import { sim } from '../services/poisson.js';
import teams from '../data/teams.json';
import sched from '../data/sched.json';
import koBracket from '../data/ko-bracket.json';
import { resolveKOTeam } from '../services/resolvers.js';
import gr from '../data/gr.json';

const KO_LBL = { R32:'32avos', R16:'Octavos', QF:'Cuartos', SF:'Semis', '3rd':'3er Lugar', Final:'Final' };
const DAY_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MON_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoy' },
  { value: 'ko', label: 'KO' },
  { value: 'played', label: 'Jugados' },
  { value: 'upcoming', label: 'Pendientes' },
];

export default function CalendarPanel() {
  const { res, resKO, matchTimes } = useMatchStore();
  const { calFilter, setCalFilter, setPanel } = useUiStore();

  const now = new Date();
  // Usar hora local para "hoy" — el usuario ve los partidos del día en su zona horaria
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  const getMatchDate = (id) => {
    const mt = matchTimes[id] || matchTimes[String(id)];
    if (mt) {
      // ESPN devuelve UTC; convertir a hora local para que los partidos
      // nocturnos aparezcan en el día correcto para el usuario
      const kd = new Date(mt);
      return kd.getFullYear() + '-' + String(kd.getMonth()+1).padStart(2,'0') + '-' + String(kd.getDate()).padStart(2,'0');
    }
    const s = sched[id] || sched[String(id)];
    return s?.dt || '2026-12-31';
  };

  const groupMatches = res.map(m => ({
    ...m, dt: getMatchDate(m.id), isKO: false, pens: '',
    hRes: true, aRes: true,
  }));

  const koMatches = koBracket.map(kb => {
    const rko = resKO.find(r => r.id === kb.id) || { hg: null, ag: null, p: false, pens: '' };
    const h = resolveKOTeam(kb.sh, res, resKO, koBracket, gr);
    const a = resolveKOTeam(kb.sa, res, resKO, koBracket, gr);
    return {
      id: kb.id, g: KO_LBL[kb.rnd] || kb.rnd,
      h: h || kb.sh, a: a || kb.sa,
      hg: rko.hg, ag: rko.ag, p: rko.p, pens: rko.pens || '',
      dt: getMatchDate(kb.id), isKO: true, rnd: kb.rnd,
      hRes: !!h, aRes: !!a,
    };
  });

  const allMatches = [...groupMatches, ...koMatches];

  const filtered = allMatches.filter(m => {
    if (calFilter === 'today') return m.dt === today;
    if (calFilter === 'ko') return m.isKO;
    if (calFilter === 'played') return m.p;
    if (calFilter === 'upcoming') return !m.p;
    return true;
  });

  // Agrupar por fecha
  const byDay = {};
  filtered.forEach(m => {
    if (!byDay[m.dt]) byDay[m.dt] = [];
    byDay[m.dt].push(m);
  });
  const days = Object.keys(byDay).sort();

  const getProbs = (m) => {
    if (m.p) return {};
    if (!teams[m.h] || !teams[m.a]) return {};
    const { pW, pD, pL } = sim(m.h, m.a, teams);
    return { pW, pD, pL };
  };

  return (
    <div>
      <FilterBar filters={FILTERS} active={calFilter} onChange={setCalFilter} />
      {days.map(dt => {
        const d = new Date(dt + 'T12:00:00Z');
        const isToday = dt === today;
        const dm = byDay[dt];
        const playedCnt = dm.filter(m => m.p).length;
        return (
          <div key={dt} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              paddingBottom: 6, borderBottom: '1px solid var(--bg-700)',
            }}>
              <span style={{ color: 'var(--text-400)', fontSize: 13 }}>
                {DAY_ES[d.getUTCDay()]} {d.getUTCDate()} {MON_ES[d.getUTCMonth()]}
              </span>
              {isToday && (
                <span style={{
                  background: 'var(--blue)', color: '#fff', fontSize: 10,
                  padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                }}>HOY</span>
              )}
              <span style={{ marginLeft: 'auto', color: 'var(--text-500)', fontSize: 11 }}>
                {playedCnt}/{dm.length} jugados
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dm.map(m => {
                const probs = getProbs(m);
                return (
                  <MatchCard
                    key={m.id}
                    match={m}
                    teams={teams}
                    matchTimes={matchTimes}
                    sched={sched}
                    pW={probs.pW}
                    pD={probs.pD}
                    pL={probs.pL}
                    onPredict={!m.p ? () => setPanel('predictor') : undefined}
                    onH2H={!m.p ? () => setPanel('h2h') : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {days.length === 0 && (
        <p style={{ color: 'var(--text-400)', textAlign: 'center', marginTop: 40 }}>
          No hay partidos para mostrar.
        </p>
      )}
    </div>
  );
}
