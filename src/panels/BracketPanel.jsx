// src/panels/BracketPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { resolveKOTeam, fmtMatchDT } from '../services/resolvers.js';
import { sim } from '../services/poisson.js';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';
import sched from '../data/sched.json';
import gr from '../data/gr.json';

function BkMatch({ kb, res, resKO, matchTimes }) {
  const t1 = resolveKOTeam(kb.sh, res, resKO, koBracket, gr) || kb.sh;
  const t2 = resolveKOTeam(kb.sa, res, resKO, koBracket, gr) || kb.sa;
  const koM = resKO.find(k => k.id === kb.id);
  const played = !!(koM?.p);
  const pr = (!played && teams[t1] && teams[t2]) ? sim(t1, t2, teams) : null;
  const winH = played && (koM.hg > koM.ag || koM.pens === 'h');
  const winA = played && (koM.ag > koM.hg || koM.pens === 'a');
  const dt = fmtMatchDT(kb.id, matchTimes, sched);

  return (
    <div style={{
      background: 'var(--bg-800)', border: '1px solid var(--bg-700)',
      borderRadius: 'var(--r-md)', padding: '8px 10px', minWidth: 160,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 5, borderBottom: '1px solid var(--bg-700)' }}>
        <span style={{ fontSize: 12, color: winH ? 'var(--gold)' : 'inherit', fontWeight: winH ? 700 : 400 }}>
          {teams[t1]?.fl || '🏳️'} {t1}
        </span>
        {played ? (
          <span style={{ fontSize: 12, fontWeight: 800 }}>{koM.hg}</span>
        ) : pr ? (
          <span style={{ fontSize: 10, color: 'var(--text-400)' }}>{(pr.pW * 100).toFixed(0)}%</span>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 5 }}>
        <span style={{ fontSize: 12, color: winA ? 'var(--gold)' : 'inherit', fontWeight: winA ? 700 : 400 }}>
          {teams[t2]?.fl || '🏳️'} {t2}
        </span>
        {played ? (
          <span style={{ fontSize: 12, fontWeight: 800 }}>{koM.ag}</span>
        ) : pr ? (
          <span style={{ fontSize: 10, color: 'var(--text-400)' }}>{(pr.pL * 100).toFixed(0)}%</span>
        ) : null}
      </div>
      {!played && dt && (
        <div style={{ fontSize: 10, color: 'var(--blue-400)', textAlign: 'center', marginTop: 4 }}>{dt}</div>
      )}
    </div>
  );
}

export default function BracketPanel() {
  const { res, resKO, matchTimes } = useMatchStore();
  const r32 = koBracket.filter(k => k.rnd === 'R32');
  const llave1 = r32.slice(0, 8);
  const llave2 = r32.slice(8);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3 style={{ fontSize: 12, color: 'var(--text-400)', marginBottom: 10 }}>Llave 1</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {llave1.map(kb => (
              <BkMatch key={kb.id} kb={kb} res={res} resKO={resKO} matchTimes={matchTimes} />
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 12, color: 'var(--text-400)', marginBottom: 10 }}>Llave 2</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {llave2.map(kb => (
              <BkMatch key={kb.id} kb={kb} res={res} resKO={resKO} matchTimes={matchTimes} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
