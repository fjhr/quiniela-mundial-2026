import { useMemo } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import { klem } from '../services/poisson.js';
import teams from '../data/teams.json';
import gr from '../data/gr.json';

const SECTIONS = [
  {
    label: 'TORNEO',
    items: [
      { id: 'cal',     icon: 'ti-calendar',      label: 'Calendario' },
      { id: 'groups',  icon: 'ti-layout-grid',   label: 'Fase de Grupos', hasGrid: true },
      { id: 'elim',    icon: 'ti-sitemap',        label: 'Eliminatorias' },
      { id: 'bracket', icon: 'ti-tournament',     label: 'Bracket R32' },
    ],
  },
  {
    label: 'ANÁLISIS',
    items: [
      { id: 'predictor', icon: 'ti-chart-radar',        label: 'Predictor' },
      { id: 'h2h',       icon: 'ti-switch-horizontal',  label: 'Head-to-Head' },
      { id: 'klement',   icon: 'ti-math-function',      label: 'Klement' },
      { id: 'stats',     icon: 'ti-chart-bar',          label: 'Estadísticas' },
    ],
  },
  {
    label: 'SIMULACIÓN',
    items: [
      { id: 'quiniela',   icon: 'ti-device-gamepad-2', label: 'Quiniela' },
      { id: 'escenarios', icon: 'ti-calculator',       label: 'Escenarios' },
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

  const stats = useMemo(() => calcStats(res), [res]);
  const collapsed = sidebarCollapsed;

  const navBtn = (item) => {
    const isActive = activePanel === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          setPanel(item.id);
          if (typeof window !== 'undefined' && window.innerWidth < 768 && !collapsed) toggleSidebar();
        }}
        title={collapsed ? item.label : undefined}
        className={`nav-item${isActive ? ' active' : ''}`}
        style={collapsed ? { padding: '9px 0', justifyContent: 'center' } : undefined}
      >
        <i className={`ti ${item.icon}`} style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }} />
        {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
      </button>
    );
  };

  return (
    <nav className={`sidebar${collapsed ? '' : ' open'}`} style={{
      width: collapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)',
      background: 'var(--bg-950)', borderRight: '1px solid var(--bg-700)',
      height: '100vh', position: 'fixed', top: 0, left: 0,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
      zIndex: 100, overflow: 'hidden',
    }}>
      {/* Logo header */}
      <div style={{
        padding: collapsed ? '14px 0' : '12px 14px',
        borderBottom: '1px solid var(--bg-700)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        minHeight: 58, justifyContent: collapsed ? 'center' : 'flex-start',
        background: 'var(--bg-900)',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚽</span>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-50)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Mundial FIFA 2026
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-500)', marginTop: 1, whiteSpace: 'nowrap' }}>
              Portal Predictivo
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="btn-ghost"
            style={{ padding: '5px 7px', fontSize: 13, flexShrink: 0 }}
            title="Colapsar sidebar"
          >
            <i className="ti ti-chevrons-left" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={toggleSidebar}
            style={{
              position: 'absolute', top: 16, right: 4,
              background: 'none', border: 'none',
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-500)', fontSize: 14,
            }}
            title="Expandir sidebar"
          >
            <i className="ti ti-chevrons-right" />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 8px' }}>
        {SECTIONS.map((section, si) => (
          <div key={section.label} style={{ marginTop: si > 0 ? 4 : 0 }}>
            {!collapsed && (
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'var(--text-600)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '10px 10px 4px', whiteSpace: 'nowrap',
              }}>
                {section.label}
              </div>
            )}
            {collapsed && si > 0 && (
              <div style={{ height: 1, background: 'var(--bg-800)', margin: '6px 8px' }} />
            )}
            {section.items.map(item => (
              <div key={item.id}>
                {navBtn(item)}
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
                          transition: 'all var(--transition)',
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
          padding: '10px 14px 14px', borderTop: '1px solid var(--bg-700)',
          background: 'var(--bg-900)', flexShrink: 0,
        }}>
          {[
            ['Partidos', stats.partidos],
            ['Goles', stats.goles],
            ['G/P', stats.gpp],
            ['Favorito K.', `${teams[stats.favTeam]?.fl || ''} ${stats.favTeam}`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
              <span style={{ color: 'var(--text-500)' }}>{label}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
