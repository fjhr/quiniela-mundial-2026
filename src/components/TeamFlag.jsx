// src/components/TeamFlag.jsx
export default function TeamFlag({ team, teams, style }) {
  const flag = teams?.[team]?.fl || '🏳️';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <span>{flag}</span>
      <span>{team}</span>
    </span>
  );
}
