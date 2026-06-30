// src/components/ScoreBadge.jsx
export default function ScoreBadge({ hg, ag, played, pens }) {
  if (!played || hg === null || ag === null) {
    return <span style={{ color: 'var(--text-400)', fontSize: 12 }}>vs</span>;
  }
  const winner = hg > ag ? 'h' : ag > hg ? 'a' : null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
      <span style={{ color: winner === 'h' ? 'var(--gold)' : 'inherit' }}>{hg}</span>
      <span style={{ color: 'var(--text-400)' }}>–</span>
      <span style={{ color: winner === 'a' ? 'var(--gold)' : 'inherit' }}>{ag}</span>
      {pens && <span style={{ fontSize: 10, color: 'var(--text-500)' }}>(pen.)</span>}
    </span>
  );
}
