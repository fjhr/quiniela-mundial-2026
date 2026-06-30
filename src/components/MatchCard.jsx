// src/components/MatchCard.jsx
import TeamFlag from './TeamFlag.jsx';
import ScoreBadge from './ScoreBadge.jsx';
import { fmtMatchDT } from '../services/resolvers.js';

const PHASE_LABELS = {
  R32: '32avos', R16: '16avos', QF: 'Cuartos', SF: 'Semis', Final: 'Final', '3rd': '3er Lugar',
};

export default function MatchCard({ match, teams, matchTimes, sched, pW, pD, pL, onPredict, onH2H, compact = false }) {
  const time = fmtMatchDT(match.id, matchTimes, sched);
  const showProbs = !match.p && pW !== undefined && pD !== undefined && pL !== undefined;
  const phaseLabel = match.rnd ? PHASE_LABELS[match.rnd] : (match.g || null);

  return (
    <div style={{
      background: 'var(--bg-800)', border: '1px solid var(--bg-700)',
      borderRadius: 'var(--r-md)', padding: compact ? '6px 10px' : '10px 14px',
    }}>
      {/* Phase badge */}
      {phaseLabel && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-500)',
            background: 'var(--bg-700)', borderRadius: 4, padding: '1px 6px',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {phaseLabel}
          </span>
        </div>
      )}

      {/* Match teams + score */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <TeamFlag team={match.h} teams={teams} style={{ justifyContent: 'flex-end' }} />
        <div style={{ textAlign: 'center' }}>
          <ScoreBadge hg={match.hg} ag={match.ag} played={match.p} pens={match.pens} />
          {time && <div style={{ fontSize: 10, color: 'var(--blue-400)', marginTop: 2 }}>{time}</div>}
        </div>
        <TeamFlag team={match.a} teams={teams} />
      </div>

      {/* Probability bars */}
      {showProbs && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
            <div style={{ width: `${pW * 100}%`, background: 'var(--green)', borderRadius: '3px 0 0 3px', flexShrink: 0 }} />
            <div style={{ width: `${pD * 100}%`, background: 'var(--gray)', flexShrink: 0 }} />
            <div style={{ width: `${pL * 100}%`, background: 'var(--red)', borderRadius: '0 3px 3px 0', flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-500)' }}>
            <span style={{ color: 'var(--green-400)', fontWeight: 600 }}>{(pW * 100).toFixed(1)}% local</span>
            <span>{(pD * 100).toFixed(1)}% emp.</span>
            <span style={{ color: 'var(--red-400)', fontWeight: 600 }}>{(pL * 100).toFixed(1)}% visita</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {showProbs && (onPredict || onH2H) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {onPredict && (
            <button
              onClick={onPredict}
              style={{
                flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 600,
                background: 'none', border: '1px solid var(--bg-600)',
                borderRadius: 'var(--r-sm)', color: 'var(--text-400)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-700)'; e.currentTarget.style.color = 'var(--text-200)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-400)'; }}
            >
              🎯 Predecir
            </button>
          )}
          {onH2H && (
            <button
              onClick={onH2H}
              style={{
                flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 600,
                background: 'none', border: '1px solid var(--bg-600)',
                borderRadius: 'var(--r-sm)', color: 'var(--text-400)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-700)'; e.currentTarget.style.color = 'var(--text-200)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-400)'; }}
            >
              ↔️ H2H
            </button>
          )}
        </div>
      )}
    </div>
  );
}
