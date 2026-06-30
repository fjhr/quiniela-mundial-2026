import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import { klem } from '../services/poisson.js';
import teams from '../data/teams.json';
import gr from '../data/gr.json';

const SECTIONS = [
  {
    label: 'TORNEO',
    items: [
      { id: 'cal',     icon: '📅', label: 'Calendario' },
      { id: 'groups',  icon: '👥', label: 'Fase de Grupos', hasGrid: true },
      { id: 'elim',    icon: '⚔️', label: 'Eliminatorias' },
      { id: 'bracket', icon: '🏆', label: 'Bracket R32' },
    ],
  },
  {
    label: 'ANÁLISIS',
    items: [
      { id: 'predictor', icon: '🎯', label: 'Predictor' },
      { id: 'h2h',       icon: '↔️', label: 'Head-to-Head' },
      { id: 'klement',   icon: '⭐', label: 'Klement' },
      { id: 'stats',     icon: '📊', label: 'Estadísticas' },
    ],
  },
  {
    label: 'SIMULACIÓN',
    items: [
      { id: 'quiniela',   icon: '📋', label: 'Quiniela' },
      { id: 'escenarios', icon: '🎲', label: 'Escenarios' },
    ],
  },
];

const GROUPS = Object.keys(gr).sort();

function calcStats(res) {
  const played = res.filter(r => r.p);
  const partidos = played.length;
  const goles = played.reduce((s, r) => s + (r.hg || 0) + (r.ag || 0), 0);
  const gpp = partidos > 0 ? (goles / partidos).toFixed(2) : '—';
  const allTeams = Object.keys(teams);
  let favTeam = allTeams[0];
  let favScore = -1;
  allTeams.forEach(t => {
    const s = klem(t, teams);
    if (s > favScore) { favScore = s; favTeam = t; }
  });
  return { partidos, goles, gpp, favTeam };
}

export default function Sidebar() {
  const { res } = useMatchStore();
  const { activePanel, selectedGroup, sidebarCollapsed, setPanel, setGroup, toggleSidebar } = useUiStore();

  const stats = calcStats(res);
  const collapsed = sidebarCollapsed;

  const navBtn = (item) => {
    const isActive = activePanel === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setPanel(item.id)}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: collapsed ? '9px 0' : '7px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 'var(--r-md)', border: 'none', width: '100%',
          fontSize: 12.5, fontWeight: isActive ? 600 : 500,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          background: isActive ? 'var(--blue)' : 'none',
          color: isActive ? '#fff' : 'var(--text-400)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-800)'; e.currentTarget.style.color = 'var(--text-200)'; }}}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-400)'; }}}
      >
        <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
        {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
      </button>
    );
  };

  return (
    <nav style={{
      width: collapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)',
      background: 'var(--bg-950)', borderRight: '1px solid var(--bg-700)',
      height: '100vh', position: 'fixed', top: 0, left: 0,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
      zIndex: 100, overflow: 'hidden',
    }}>
      {/* Logo header */}
      <div style={{
        padding: collapsed ? '14px 0' : '14px 12px',
        borderBottom: '1px solid var(--bg-700)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        minHeight: 58, justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🌍</span>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-50)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Mundial FIFA 2026
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-400)', marginTop: 1, whiteSpace: 'nowrap' }}>
              Portal Predictivo
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            style={{
              marginLeft: 'auto', flexShrink: 0, background: 'none',
              border: '1px solid var(--bg-700)', borderRadius: 'var(--r-sm)',
              width: 26, height: 26, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'var(--text-400)', fontSize: 13,
            }}
            title="Colapsar sidebar"
          >‹</button>
        )}
        {collapsed && (
          <button
            onClick={toggleSidebar}
            style={{
              position: 'absolute', top: 16, right: 6,
              background: 'none', border: '1px solid var(--bg-700)',
              borderRadius: 'var(--r-sm)', width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-400)', fontSize: 11,
            }}
            title="Expandir sidebar"
          >›</button>
        )}
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px' }}>
        {SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'var(--text-600)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '10px 8px 4px', whiteSpace: 'nowrap',
              }}>
                {section.label}
              </div>
            )}
            {collapsed && <div style={{ height: 8 }} />}
            {section.items.map(item => (
              <div key={item.id}>
                {navBtn(item)}
                {/* Grupo grid: solo bajo "Fase de Grupos" cuando no colapsado */}
                {item.hasGrid && !collapsed && activePanel === 'groups' && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 3, padding: '3px 8px 6px',
                  }}>
                    {GROUPS.map(g => (
                      <button
                        key={g}
                        onClick={() => setGroup(g)}
                        style={{
                          height: 26, borderRadius: 'var(--r-sm)',
                          border: `1px solid ${selectedGroup === g ? 'var(--blue)' : 'var(--bg-700)'}`,
                          background: selectedGroup === g ? 'var(--blue)' : 'none',
                          fontSize: 11, fontWeight: 600,
                          color: selectedGroup === g ? '#fff' : 'var(--text-400)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >{g}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Stats footer */}
      {!collapsed && (
        <div style={{
          padding: '12px 14px', borderTop: '1px solid var(--bg-700)', flexShrink: 0,
        }}>
          {[
            ['Partidos', stats.partidos],
            ['Goles', stats.goles],
            ['G/P', stats.gpp],
            ['Favorito K.', `${teams[stats.favTeam]?.fl || ''} ${stats.favTeam}`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
              <span style={{ color: 'var(--text-400)' }}>{label}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
