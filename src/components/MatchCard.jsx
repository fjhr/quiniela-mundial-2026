// src/components/MatchCard.jsx
import TeamFlag from './TeamFlag.jsx';
import ScoreBadge from './ScoreBadge.jsx';
import { fmtMatchDT } from '../services/resolvers.js';

const PHASE_LABELS = {
  R32: '32avos', R16: '16avos', QF: 'Cuartos', SF: 'Semis', Final: 'Final', '3rd': '3er Lugar',
};

const PHASE_BADGE = {
  R32: 'badge badge-blue',
  R16: 'badge badge-blue',
  QF: 'badge badge-gold',
  SF: 'badge badge-gold',
  Final: 'badge badge-purple',
  '3rd': 'badge badge-gray',
};

export default function MatchCard({ match, teams, matchTimes, sched, pW, pD, pL, onPredict, onH2H, compact = false }) {
  const time = fmtMatchDT(match.id, matchTimes, sched);
  const showProbs = !match.p && pW !== undefined && pD !== undefined && pL !== undefined;
  const phaseLabel = match.rnd ? PHASE_LABELS[match.rnd] : (match.g || null);
  const badgeCls = match.rnd ? (PHASE_BADGE[match.rnd] || 'badge badge-gray') : 'badge badge-gray';

  return (
    <div className="card" style={{ padding: compact ? '6px 10px' : '10px 14px' }}>
      {/* Phase badge */}
      {phaseLabel && (
        <div style={{ marginBottom: 6 }}>
          <span className={`mc-phase ${badgeCls}`}>{phaseLabel}</span>
        </div>
      )}

      {/* Match teams + score */}
      <div className="mc-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <TeamFlag team={match.h} teams={teams} style={{ justifyContent: 'flex-end' }} />
        <div style={{ textAlign: 'center' }}>
          <ScoreBadge hg={match.hg} ag={match.ag} played={match.p} pens={match.pens} />
          {time && <div className="mc-time" style={{ fontSize: 10, color: 'var(--blue-400)', marginTop: 2 }}>{time}</div>}
        </div>
        <TeamFlag team={match.a} teams={teams} />
      </div>

      {/* Probability bars */}
      {showProbs && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
            <div style={{ width: `${pW * 100}%`, background: 'var(--green)', borderRadius: '99px 0 0 99px', flexShrink: 0 }} />
            <div style={{ width: `${pD * 100}%`, background: 'var(--gray)', flexShrink: 0 }} />
            <div style={{ width: `${pL * 100}%`, background: 'var(--red)', borderRadius: '0 99px 99px 0', flexShrink: 0 }} />
          </div>
          <div className="mc-probs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-500)' }}>
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
            <button onClick={onPredict} className="btn-ghost mc-action-btn" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}>
              <i className="ti ti-chart-radar" style={{ fontSize: 13 }} />
              <span>Predecir</span>
            </button>
          )}
          {onH2H && (
            <button onClick={onH2H} className="btn-ghost mc-action-btn" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}>
              <i className="ti ti-switch-horizontal" style={{ fontSize: 13 }} />
              <span>H2H</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
