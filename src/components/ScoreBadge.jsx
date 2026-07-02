// src/components/ScoreBadge.jsx
export default function ScoreBadge({ hg, ag, played, pens }) {
  if (!played || hg === null || ag === null) {
    return (
      <span style={{ color: 'var(--text-500)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>vs</span>
    );
  }
  const winner = hg > ag ? 'h' : ag > hg ? 'a' : null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 15 }}>
      <span style={{ color: winner === 'h' ? 'var(--gold)' : 'var(--text-200)' }}>{hg}</span>
      <span style={{ color: 'var(--text-600)', fontSize: 12 }}>–</span>
      <span style={{ color: winner === 'a' ? 'var(--gold)' : 'var(--text-200)' }}>{ag}</span>
      {pens && <span style={{ fontSize: 9, color: 'var(--text-500)', fontWeight: 500 }}>p.p.</span>}
    </span>
  );
}
