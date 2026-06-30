// src/components/MatchCard.jsx
import TeamFlag from './TeamFlag.jsx';
import ScoreBadge from './ScoreBadge.jsx';
import { fmtMatchDT } from '../services/resolvers.js';

export default function MatchCard({ match, teams, matchTimes, sched, compact = false }) {
  const time = fmtMatchDT(match.id, matchTimes, sched);
  return (
    <div style={{
      background: 'var(--bg-800)', border: '1px solid var(--bg-700)',
      borderRadius: 'var(--r-md)', padding: compact ? '6px 10px' : '10px 14px',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8,
    }}>
      <TeamFlag team={match.h} teams={teams} style={{ justifyContent: 'flex-end' }} />
      <div style={{ textAlign: 'center' }}>
        <ScoreBadge hg={match.hg} ag={match.ag} played={match.p} pens={match.pens} />
        {time && <div style={{ fontSize: 10, color: 'var(--blue-400)', marginTop: 2 }}>{time}</div>}
      </div>
      <TeamFlag team={match.a} teams={teams} />
    </div>
  );
}
