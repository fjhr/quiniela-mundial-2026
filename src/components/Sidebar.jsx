// src/components/Sidebar.jsx
const ICONS = {
  cal: '📅', groups: '🏆', elim: '⚔️', bracket: '🎯',
  predictor: '🔮', h2h: '📊', klement: '⭐', escenarios: '🎲', quiniela: '👥',
};
const LABELS = {
  cal: 'Calendario', groups: 'Grupos', elim: 'Eliminatorias', bracket: 'Bracket',
  predictor: 'Predictor', h2h: 'H2H', klement: 'Klement', escenarios: 'Escenarios', quiniela: 'Quiniela',
};

export default function Sidebar({ panels, active, onSelect, collapsed, onToggle }) {
  return (
    <nav style={{
      width: collapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)',
      background: 'var(--bg-900)', borderRight: '1px solid var(--bg-700)',
      height: '100vh', position: 'fixed', top: 0, left: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transition: 'width 0.2s', zIndex: 100,
    }}>
      <button onClick={onToggle} style={{
        background: 'none', border: 'none', color: 'var(--text-400)',
        padding: '16px', cursor: 'pointer', fontSize: 18, textAlign: 'right',
      }}>
        {collapsed ? '›' : '‹'}
      </button>
      {panels.map(p => (
        <button key={p} onClick={() => onSelect(p)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: active === p ? 'var(--bg-800)' : 'none',
          border: 'none', color: active === p ? 'var(--text-50)' : 'var(--text-400)',
          cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 13,
          borderLeft: active === p ? '2px solid var(--blue)' : '2px solid transparent',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{ICONS[p]}</span>
          {!collapsed && <span>{LABELS[p]}</span>}
        </button>
      ))}
    </nav>
  );
}
