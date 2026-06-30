# Mejoras Portal React — Paridad Features + UI Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el portal React a paridad con el portal estático original: sidebar con secciones, barras de probabilidad en partidos, panel de estadísticas, y tab GolPredictor en la Quiniela.

**Architecture:** 8 tareas secuenciales que modifican la App Shell (sidebar + header), el MatchCard, CalendarPanel, y agregan StatsPanel y QuinielaPanel con GolPredictor. Ninguna dependencia nueva — Chart.js y poisson.js ya están disponibles.

**Tech Stack:** React 18, Vite 6, Zustand 4, Chart.js 4 / react-chartjs-2 5, CSS variables (index.css)

## Global Constraints

- Sin dependencias NPM nuevas. Chart.js y react-chartjs-2 ya están instalados.
- CSS: solo variables existentes en `src/index.css` (--bg-950 a --bg-600, --text-50 a --text-600, --blue, --gold, --green, --red, --r-sm/md/lg/xl, --hdr-h, --sidebar-w: 224px, --sidebar-cw: 58px).
- Iconos: emoji Unicode únicamente. Sin librerías de iconos.
- Los 32 tests existentes deben pasar en todo momento. Run: `npm test -- --run`
- `sim(t1, t2, teams)` → `{ pW, pD, pL, lA, lB, kA, kB }` (floats 0-1)
- `klem(team, teams)` → float (puntuación del modelo Klement)
- `tbl(group, res, gr)` → `[{ t, j, gf, gc, gd, pts }]`
- `res[i]`: `{ id, h, a, hg, ag, p, date, grp }`
- `resKO[i]`: `{ id, rnd, h, a, hg, ag, p, pens }`
- `teams` shape: `{ [name]: { fl, r, gdp, pop, tmp, dom, host, g } }`
- `gr` shape: `{ [group]: [teamName, ...] }`
- `ko-bracket.json`: `[{ id, rnd, sh, sa }]` donde `rnd` ∈ `'R32'|'R16'|'QF'|'SF'|'Final'`
- GolPredictor proxy: `https://golpredictor.fernando-fjhr.workers.dev`
- GolPredictor Pool ID: `'0,b2bfbc17-41b4-43c6-a48a-6c2ad5baa31d'`
- Proxy rutas: `POST /login` body `{username,password}` → `{cookie,username}` | `GET /pool` headers `X-GP-Cookie`, `X-GP-Pid` → HTML

---

## File Structure

```
src/
  components/
    Sidebar.jsx        ← REESCRIBIR completo (self-contained, imports stores)
    PageHeader.jsx     ← NUEVO
    MatchCard.jsx      ← MODIFICAR (prob bars + badge + botones)
    FilterBar.jsx      ← sin cambios
    ScoreBadge.jsx     ← sin cambios
    TeamFlag.jsx       ← sin cambios
    Spinner.jsx        ← sin cambios
    Toast.jsx          ← sin cambios
  panels/
    CalendarPanel.jsx  ← MODIFICAR (calcular y pasar probabilidades)
    StatsPanel.jsx     ← NUEVO
    QuinielaPanel.jsx  ← REESCRIBIR (2 tabs: mis predicciones + GolPredictor)
    (resto sin cambios)
  store/
    matchStore.js      ← MODIFICAR (agregar restore + lastSync)
  App.jsx              ← MODIFICAR (PageHeader, nuevo layout, StatsPanel)
  index.css            ← MODIFICAR (polish: scrollbar, body overflow)
```

---

### Task 1: PageHeader.jsx + matchStore restore/lastSync

**Files:**
- Create: `src/components/PageHeader.jsx`
- Modify: `src/store/matchStore.js`

**Interfaces:**
- Produces: `PageHeader({ title, subtitle, onSync, syncing, onRestore, lastSync })` — usado por Task 2 (App.jsx)
- Produces: `useMatchStore().restore()`, `useMatchStore().setLastSync(date)`, `useMatchStore().lastSync` — usados por Task 2 (App.jsx)

- [ ] **Step 1: Agregar `restore` y `lastSync` a matchStore.js**

Abrir `src/store/matchStore.js`. El archivo actual tiene `res`, `resKO`, `matchTimes`. Agregar `lastSync: null` al estado inicial y dos acciones:

```js
// src/store/matchStore.js
import { create } from 'zustand';
import initData from '../data/init.json';
import koBracketData from '../data/ko-bracket.json';

function buildInitialResKO(koBracket) {
  return koBracket.map(m => ({
    id: m.id, rnd: m.rnd,
    h: '', a: '', hg: null, ag: null, p: false, pens: '',
  }));
}

export const useMatchStore = create((set, get) => ({
  res: initData.map(r => ({ ...r })),
  resKO: buildInitialResKO(koBracketData),
  matchTimes: (() => {
    try { return JSON.parse(localStorage.getItem('match-times') || '{}'); } catch { return {}; }
  })(),
  lastSync: null,

  applyESPNResults(events, nameMap = {}) {
    const { res } = get();
    let count = 0;
    const newRes = res.map(r => ({ ...r }));
    events.forEach(ev => {
      const comp = (ev.competitions || [])[0] || {};
      if (!comp.status?.type?.completed) return;
      const comps = comp.competitors || [];
      const hComp = comps.find(c => c.homeAway === 'home') || comps[0];
      const aComp = comps.find(c => c.homeAway === 'away') || comps[1];
      if (!hComp || !aComp) return;
      const hName = nameMap[hComp.team?.name] || hComp.team?.displayName || hComp.team?.name || '';
      const aName = nameMap[aComp.team?.name] || aComp.team?.displayName || aComp.team?.name || '';
      const idx = newRes.findIndex(r =>
        (r.h === hName && r.a === aName) || (r.h === aName && r.a === hName)
      );
      if (idx === -1) return;
      const hg = parseInt(hComp.score || '0');
      const ag = parseInt(aComp.score || '0');
      if (!newRes[idx].p || newRes[idx].hg !== hg || newRes[idx].ag !== ag) {
        const isSwapped = newRes[idx].h === aName;
        newRes[idx] = { ...newRes[idx], hg: isSwapped ? ag : hg, ag: isSwapped ? hg : ag, p: true };
        count++;
      }
    });
    if (count > 0) set({ res: newRes });
    return count;
  },

  applyKOUpdates(updates) {
    if (!updates.length) return;
    set(state => ({
      resKO: state.resKO.map(k => {
        const upd = updates.find(u => u.id === k.id);
        return upd ? { ...k, ...upd } : k;
      }),
    }));
  },

  setKOTeamNames(koBracket, resolver) {
    set(state => ({
      resKO: state.resKO.map(k => {
        if (k.p) return k;
        const slot = koBracket.find(s => s.id === k.id);
        if (!slot) return k;
        const h = resolver(slot.sh);
        const a = resolver(slot.sa);
        return { ...k, h: h || k.h, a: a || k.a };
      }),
    }));
  },

  setMatchTimes(times) {
    set({ matchTimes: times });
    try { localStorage.setItem('match-times', JSON.stringify(times)); } catch {}
  },

  setLastSync(date) {
    set({ lastSync: date });
  },

  restore() {
    set({
      res: initData.map(r => ({ ...r })),
      resKO: buildInitialResKO(koBracketData),
      matchTimes: {},
      lastSync: null,
    });
    try { localStorage.removeItem('match-times'); } catch {}
  },

  updateKOResult(id, hg, ag, pens = '') {
    set(state => ({
      resKO: state.resKO.map(k => k.id === id ? { ...k, hg, ag, p: true, pens } : k),
    }));
  },
}));
```

- [ ] **Step 2: Crear `src/components/PageHeader.jsx`**

```jsx
// src/components/PageHeader.jsx
import { useUiStore } from '../store/uiStore.js';

function fmtLastSync(date) {
  if (!date) return null;
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins}min`;
  return `Hace ${Math.round(mins / 60)}h`;
}

export default function PageHeader({ title, subtitle, onSync, syncing, onRestore, lastSync }) {
  const { toggleSidebar } = useUiStore();

  return (
    <header style={{
      height: 'var(--hdr-h)', flexShrink: 0,
      background: 'var(--pg-hdr-bg)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--bg-700)',
      padding: '0 20px', display: 'flex', alignItems: 'center', gap: 10,
      position: 'sticky', top: 0, zIndex: 90,
    }}>
      <button
        onClick={toggleSidebar}
        className="hdr-hamburger"
        style={{
          display: 'none', background: 'none', border: '1px solid var(--bg-700)',
          borderRadius: 'var(--r-md)', padding: '7px 9px', cursor: 'pointer',
          color: 'var(--text-400)', fontSize: 17, alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Menú"
      >☰</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-50)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        )}
      </div>
      {lastSync && (
        <div style={{ fontSize: 11, color: 'var(--text-500)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {fmtLastSync(lastSync)}
        </div>
      )}
      <button
        onClick={onRestore}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          background: 'none', color: 'var(--text-400)', border: '1px solid var(--bg-700)',
          borderRadius: 'var(--r-md)', padding: '7px 10px', fontSize: 12,
          fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        ↺ Restaurar
      </button>
      <button
        onClick={onSync}
        disabled={syncing}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          background: 'var(--blue)', color: '#fff', border: 'none',
          borderRadius: 'var(--r-md)', padding: '7px 13px', fontSize: 12,
          fontWeight: 600, cursor: syncing ? 'default' : 'pointer',
          opacity: syncing ? 0.7 : 1, whiteSpace: 'nowrap',
        }}
      >
        {syncing ? '⟳ Sync...' : '⚡ Sincronizar'}
      </button>
    </header>
  );
}
```

- [ ] **Step 3: Verificar que los tests siguen en verde**

```bash
npm test -- --run
```

Expected: 32 passed, 0 failed.

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: sin errores. El build puede mostrar warnings de chunk size, pero sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/PageHeader.jsx src/store/matchStore.js
git commit -m "feat: PageHeader componente + matchStore.restore + lastSync"
```

---

### Task 2: App.jsx — nuevo layout con PageHeader y Sidebar self-contained

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 1), `Sidebar` (Task 3 — pero Task 3 aún no existe, usar la versión actual de Sidebar mientras tanto)
- Consumes: `matchStore.restore`, `matchStore.setLastSync`, `matchStore.lastSync` (Task 1)
- Produces: layout correcto para Task 3 (Sidebar auto-contenido), contexto de navegación para Tasks 4-7

**Nota:** Task 3 reescribirá `Sidebar.jsx` para que no necesite props. En esta tarea, reescribimos App.jsx para NO pasar props de navegación al Sidebar (la versión actual de Sidebar los necesita, entonces temporalmente el sidebar dejará de funcionar hasta que Task 3 lo reescriba). Si querés evitar que el sidebar quede roto entre tasks, podés hacer Task 3 primero y Task 2 después. El plan los tiene en este orden por claridad de dependencias.

- [ ] **Step 1: Reescribir `src/App.jsx` completo**

```jsx
// src/App.jsx
import React, { useEffect, useState, Suspense } from 'react';
import { useMatchStore } from './store/matchStore.js';
import { useUiStore } from './store/uiStore.js';
import { fetchFromESPN, applyESPNTimes, syncKnockout, NAME_MAP } from './services/espn.js';
import { resolveKOTeam } from './services/resolvers.js';
import Sidebar from './components/Sidebar.jsx';
import PageHeader from './components/PageHeader.jsx';
import Toast from './components/Toast.jsx';
import Spinner from './components/Spinner.jsx';
import CalendarPanel from './panels/CalendarPanel.jsx';
import sched from './data/sched.json';
import koBracket from './data/ko-bracket.json';

const GroupsPanel    = React.lazy(() => import('./panels/GroupsPanel.jsx'));
const EliminatoriaPanel = React.lazy(() => import('./panels/EliminatoriaPanel.jsx'));
const BracketPanel   = React.lazy(() => import('./panels/BracketPanel.jsx'));
const PredictorPanel = React.lazy(() => import('./panels/PredictorPanel.jsx'));
const H2HPanel       = React.lazy(() => import('./panels/H2HPanel.jsx'));
const KlementPanel   = React.lazy(() => import('./panels/KlementPanel.jsx'));
const EscenariosPanel = React.lazy(() => import('./panels/EscenariosPanel.jsx'));
const QuinielaPanel  = React.lazy(() => import('./panels/QuinielaPanel.jsx'));
const StatsPanel     = React.lazy(() => import('./panels/StatsPanel.jsx'));

const PANEL_INFO = {
  cal:       { title: '📅 Calendario',       subtitle: 'Partidos ordenados por fecha · filtra por fase o país sede' },
  groups:    { title: '👥 Fase de Grupos',   subtitle: 'Tabla de posiciones y resultados por grupo' },
  elim:      { title: '⚔️ Eliminatorias',    subtitle: 'Resultados de la fase eliminatoria' },
  bracket:   { title: '🏆 Bracket R32',      subtitle: 'Cuadro completo desde 32avos' },
  predictor: { title: '🎯 Predictor',        subtitle: 'Probabilidades Poisson por partido' },
  h2h:       { title: '↔️ Head-to-Head',     subtitle: 'Comparación directa entre dos equipos' },
  klement:   { title: '⭐ Klement',          subtitle: 'Ranking de forma actual' },
  stats:     { title: '📊 Estadísticas',     subtitle: 'Resumen del torneo en números' },
  quiniela:  { title: '📋 Quiniela',         subtitle: 'Tus predicciones y el pool de GolPredictor' },
  escenarios:{ title: '🎲 Escenarios',       subtitle: 'Simulaciones Monte Carlo' },
};

const PANEL_MAP = {
  cal:        <CalendarPanel />,
  groups:     <GroupsPanel />,
  elim:       <EliminatoriaPanel />,
  bracket:    <BracketPanel />,
  predictor:  <PredictorPanel />,
  h2h:        <H2HPanel />,
  klement:    <KlementPanel />,
  stats:      <StatsPanel />,
  escenarios: <EscenariosPanel />,
  quiniela:   <QuinielaPanel />,
};

export default function App() {
  const {
    res, resKO, matchTimes,
    setMatchTimes, applyESPNResults, applyKOUpdates,
    setKOTeamNames, setLastSync, restore, lastSync,
  } = useMatchStore();
  const { activePanel, sidebarCollapsed, toastMessage, toastType, showToast } = useUiStore();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setKOTeamNames(koBracket, slot => resolveKOTeam(slot, res, resKO, koBracket));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const events = await fetchFromESPN();
      const { matchTimes: newTimes } = applyESPNTimes(events, sched);
      setMatchTimes({ ...matchTimes, ...newTimes });
      const count = applyESPNResults(events, NAME_MAP);
      const koUpdates = syncKnockout(events, resKO);
      applyKOUpdates(koUpdates);
      setLastSync(new Date().toISOString());
      showToast(
        count + koUpdates.length > 0
          ? `${count + koUpdates.length} resultado(s) actualizado(s) · ESPN`
          : 'Sin cambios · ESPN',
        'ok'
      );
    } catch {
      showToast('ESPN no disponible', 'warn');
    } finally {
      setSyncing(false);
    }
  };

  const handleRestore = () => {
    if (window.confirm('¿Restaurar todos los resultados a los datos base?')) {
      restore();
      showToast('Datos restaurados', 'ok');
    }
  };

  useEffect(() => {
    const t = setTimeout(handleSync, 1200);
    return () => clearTimeout(t);
  }, []);

  const { title, subtitle } = PANEL_INFO[activePanel] || {};
  const ml = sidebarCollapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{
        marginLeft: ml, flex: 1,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', transition: 'margin-left 0.2s',
        minWidth: 0,
      }}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          onSync={handleSync}
          syncing={syncing}
          onRestore={handleRestore}
          lastSync={lastSync}
        />
        <main style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '20px', maxWidth: 960,
        }}>
          <Suspense fallback={<Spinner />}>
            {PANEL_MAP[activePanel]}
          </Suspense>
        </main>
      </div>
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: compila sin errores. Si hay error "Cannot find module './panels/StatsPanel.jsx'", creá un stub temporal:

```bash
echo "export default function StatsPanel() { return <div>Stats</div>; }" > src/panels/StatsPanel.jsx
```

- [ ] **Step 3: Tests**

```bash
npm test -- --run
```

Expected: 32 passed.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: App.jsx — nuevo layout con PageHeader, StatsPanel lazy, PANEL_INFO"
```

---

### Task 3: Sidebar — secciones, grupo grid, collapse, stats footer

**Files:**
- Modify: `src/components/Sidebar.jsx` (reescritura completa)

**Interfaces:**
- Consumes: `useMatchStore()` → `{ res }`, `useUiStore()` → `{ activePanel, selectedGroup, sidebarCollapsed, setPanel, setGroup, toggleSidebar }`
- Consumes: `klem` de `../services/poisson.js`, `teams` de `../data/teams.json`, `gr` de `../data/gr.json`
- Produces: sidebar self-contained, sin props. App.jsx ya no le pasa `panels`, `active`, `onSelect`, `collapsed`, `onToggle`.

- [ ] **Step 1: Reescribir `src/components/Sidebar.jsx` completo**

```jsx
// src/components/Sidebar.jsx
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
```

- [ ] **Step 2: Tests + build**

```bash
npm test -- --run && npm run build
```

Expected: 32 tests passed, build sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: Sidebar reescritura — secciones TORNEO/ANÁLISIS/SIMULACIÓN, grupo grid, collapse, stats footer"
```

---

### Task 4: MatchCard — barras de probabilidad + badge de fase + botones

**Files:**
- Modify: `src/components/MatchCard.jsx`

**Interfaces:**
- Consumes: props `{ match, teams, matchTimes, sched, pW, pD, pL, onPredict, onH2H, compact }`
  - `pW`, `pD`, `pL`: floats 0-1, opcionales. Si undefined → no mostrar barras ni botones.
  - `onPredict`: callback `() => void`, opcional
  - `onH2H`: callback `() => void`, opcional
- Produces: componente visual con barras y botones — consumido por Task 5 (CalendarPanel)

- [ ] **Step 1: Reescribir `src/components/MatchCard.jsx`**

```jsx
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
```

- [ ] **Step 2: Tests + build**

```bash
npm test -- --run && npm run build
```

Expected: 32 passed, build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchCard.jsx
git commit -m "feat: MatchCard — barras de probabilidad, badge de fase, botones Predecir/H2H"
```

---

### Task 5: CalendarPanel — calcular probabilidades y pasar a MatchCard

**Files:**
- Modify: `src/panels/CalendarPanel.jsx`

**Interfaces:**
- Consumes: `sim` de `../services/poisson.js`, `teams` (ya importado), `useUiStore().setPanel`, `useUiStore().setH2HPair` (si existe — ver nota)
- Nota: `H2HPanel` puede tener un estado de par seleccionado. Si `uiStore` no tiene `setH2HPair`, el botón H2H simplemente navega al panel sin preseleccionar.

- [ ] **Step 1: Leer `src/panels/H2HPanel.jsx` para ver si acepta estado externo**

Abrir `src/panels/H2HPanel.jsx` y buscar si lee algún campo del store para preseleccionar equipos. Si no lo hay, el botón H2H solo llama `setPanel('h2h')`.

- [ ] **Step 2: Modificar `src/panels/CalendarPanel.jsx`**

Agregar import de `sim` y `useUiStore.setPanel`. Calcular probabilidades por partido:

```jsx
// src/panels/CalendarPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import MatchCard from '../components/MatchCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import { sim } from '../services/poisson.js';
import teams from '../data/teams.json';
import sched from '../data/sched.json';
import koBracket from '../data/ko-bracket.json';
import { resolveKOTeam } from '../services/resolvers.js';
import gr from '../data/gr.json';

const KO_LBL = { R32:'32avos', R16:'Octavos', QF:'Cuartos', SF:'Semis', '3rd':'3er Lugar', Final:'Final' };
const DAY_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MON_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const FILTERS = [
  { value: 'all',      label: 'Todos' },
  { value: 'today',    label: 'Hoy' },
  { value: 'ko',       label: 'KO' },
  { value: 'played',   label: 'Jugados' },
  { value: 'upcoming', label: 'Pendientes' },
];

export default function CalendarPanel() {
  const { res, resKO, matchTimes } = useMatchStore();
  const { calFilter, setCalFilter, setPanel } = useUiStore();

  const now = new Date();
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  const getMatchDate = (id) => {
    const mt = matchTimes[id] || matchTimes[String(id)];
    if (mt) {
      const kd = new Date(mt);
      return kd.getFullYear() + '-' + String(kd.getMonth()+1).padStart(2,'0') + '-' + String(kd.getDate()).padStart(2,'0');
    }
    const s = sched[id] || sched[String(id)];
    return s?.dt || '2026-12-31';
  };

  const groupMatches = res.map(m => ({
    ...m, dt: getMatchDate(m.id), isKO: false, pens: '',
  }));

  const koMatches = koBracket.map(kb => {
    const rko = resKO.find(r => r.id === kb.id) || { hg: null, ag: null, p: false, pens: '' };
    const h = resolveKOTeam(kb.sh, res, resKO, koBracket, gr);
    const a = resolveKOTeam(kb.sa, res, resKO, koBracket, gr);
    return {
      id: kb.id, g: KO_LBL[kb.rnd] || kb.rnd,
      h: h || kb.sh, a: a || kb.sa,
      hg: rko.hg, ag: rko.ag, p: rko.p, pens: rko.pens || '',
      dt: getMatchDate(kb.id), isKO: true, rnd: kb.rnd,
    };
  });

  const allMatches = [...groupMatches, ...koMatches];

  const filtered = allMatches.filter(m => {
    if (calFilter === 'today') return m.dt === today;
    if (calFilter === 'ko') return m.isKO;
    if (calFilter === 'played') return m.p;
    if (calFilter === 'upcoming') return !m.p;
    return true;
  });

  const byDay = {};
  filtered.forEach(m => {
    if (!byDay[m.dt]) byDay[m.dt] = [];
    byDay[m.dt].push(m);
  });
  const days = Object.keys(byDay).sort();

  const getProbs = (m) => {
    if (m.p) return {};
    if (!teams[m.h] || !teams[m.a]) return {};
    const { pW, pD, pL } = sim(m.h, m.a, teams);
    return { pW, pD, pL };
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>📅 Calendario</h2>
      <FilterBar filters={FILTERS} active={calFilter} onChange={setCalFilter} />
      {days.map(dt => {
        const d = new Date(dt + 'T12:00:00Z');
        const isToday = dt === today;
        const dm = byDay[dt];
        const playedCnt = dm.filter(m => m.p).length;
        return (
          <div key={dt} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              paddingBottom: 6, borderBottom: '1px solid var(--bg-700)',
            }}>
              <span style={{ color: 'var(--text-400)', fontSize: 13 }}>
                {DAY_ES[d.getUTCDay()]} {d.getUTCDate()} {MON_ES[d.getUTCMonth()]}
              </span>
              {isToday && (
                <span style={{
                  background: 'var(--blue)', color: '#fff', fontSize: 10,
                  padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                }}>HOY</span>
              )}
              <span style={{ marginLeft: 'auto', color: 'var(--text-500)', fontSize: 11 }}>
                {playedCnt}/{dm.length} jugados
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dm.map(m => {
                const probs = getProbs(m);
                return (
                  <MatchCard
                    key={m.id}
                    match={m}
                    teams={teams}
                    matchTimes={matchTimes}
                    sched={sched}
                    pW={probs.pW}
                    pD={probs.pD}
                    pL={probs.pL}
                    onPredict={!m.p ? () => setPanel('predictor') : undefined}
                    onH2H={!m.p ? () => setPanel('h2h') : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {days.length === 0 && (
        <p style={{ color: 'var(--text-400)', textAlign: 'center', marginTop: 40 }}>
          No hay partidos para mostrar.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Tests + build**

```bash
npm test -- --run && npm run build
```

Expected: 32 passed, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/panels/CalendarPanel.jsx
git commit -m "feat: CalendarPanel — probabilidades Poisson inline en partidos pendientes"
```

---

### Task 6: StatsPanel — KPIs, donut, goleadores, top partidos

**Files:**
- Create: `src/panels/StatsPanel.jsx`

**Interfaces:**
- Consumes: `useMatchStore()` → `{ res }`, `klem` de `../services/poisson.js`, `teams` data
- Consumes: `Doughnut` de `react-chartjs-2`, `Chart, ArcElement, Tooltip, Legend` de `chart.js`
- Nota: si ya existe un stub `src/panels/StatsPanel.jsx` de Task 2, reemplazarlo completo.

- [ ] **Step 1: Crear `src/panels/StatsPanel.jsx`**

```jsx
// src/panels/StatsPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { klem } from '../services/poisson.js';
import teams from '../data/teams.json';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function StatsPanel() {
  const { res } = useMatchStore();
  const played = res.filter(r => r.p);
  const partidos = played.length;
  const goles = played.reduce((s, r) => s + (r.hg || 0) + (r.ag || 0), 0);
  const gpp = partidos > 0 ? (goles / partidos).toFixed(2) : '—';
  const wins  = played.filter(r => r.hg > r.ag).length;
  const draws = played.filter(r => r.hg === r.ag).length;
  const away  = partidos - wins - draws;

  // Goles por equipo
  const teamGoals = {};
  played.forEach(r => {
    teamGoals[r.h] = (teamGoals[r.h] || 0) + (r.hg || 0);
    teamGoals[r.a] = (teamGoals[r.a] || 0) + (r.ag || 0);
  });
  const topScorers = Object.entries(teamGoals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxGoals = topScorers[0]?.[1] || 1;

  // Top partidos por goles
  const topMatches = [...played]
    .map(r => ({ ...r, tot: (r.hg || 0) + (r.ag || 0) }))
    .sort((a, b) => b.tot - a.tot)
    .slice(0, 6);

  const donutData = {
    labels: ['Victoria local', 'Empate', 'Victoria visitante'],
    datasets: [{
      data: [wins, draws, away],
      backgroundColor: ['#16a34a', '#6b7280', '#dc2626'],
      borderWidth: 0,
      hoverOffset: 5,
    }],
  };
  const donutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { size: 11 }, padding: 12, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: (c) => `${c.label}: ${c.parsed} (${partidos ? Math.round(c.parsed / partidos * 100) : 0}%)`,
        },
      },
    },
  };

  const kpiStyle = {
    background: 'var(--bg-800)', borderRadius: 'var(--r-lg)', padding: '16px 20px',
    border: '1px solid var(--bg-700)',
  };

  if (partidos === 0) {
    return (
      <div>
        <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>📊 Estadísticas</h2>
        <p style={{ color: 'var(--text-400)', textAlign: 'center', marginTop: 40 }}>
          No hay partidos jugados aún.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20, color: 'var(--text-200)' }}>📊 Estadísticas</h2>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Partidos jugados', value: partidos, unit: `de ${res.length} total` },
          { label: 'Goles totales', value: goles, unit: `${gpp} por partido` },
          { label: 'Victorias local', value: wins, unit: `${partidos ? Math.round(wins/partidos*100) : 0}% de partidos` },
          { label: 'Empates', value: draws, unit: `${partidos ? Math.round(draws/partidos*100) : 0}% de partidos` },
        ].map(({ label, value, unit }) => (
          <div key={label} style={kpiStyle}>
            <div style={{ fontSize: 11, color: 'var(--text-400)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-50)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-500)', marginTop: 4 }}>{unit}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Top goleadores */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-200)', marginBottom: 12 }}>
            ⚽ Equipos goleadores
          </h3>
          {topScorers.map(([name, g], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(71,85,105,.2)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-600)', width: 16, textAlign: 'right' }}>{i + 1}</span>
              <span>{teams[name]?.fl || ''}</span>
              <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <div style={{ width: 60, flexShrink: 0 }}>
                <div style={{ height: 4, background: 'var(--bg-700)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${Math.round(g / maxGoals * 100)}%`, background: 'var(--blue-400)', borderRadius: 2 }} />
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-400)', width: 20, textAlign: 'right', flexShrink: 0 }}>{g}</span>
            </div>
          ))}
        </div>

        {/* Donut */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-200)', marginBottom: 12 }}>
            📈 Distribución resultados
          </h3>
          <div style={{ height: 200 }}>
            <Doughnut data={donutData} options={donutOptions} />
          </div>
        </div>
      </div>

      {/* Top partidos */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-200)', marginBottom: 12 }}>
          🔥 Partidos más goleadores
        </h3>
        {topMatches.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(71,85,105,.2)' }}>
            <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {teams[r.h]?.fl || ''} {r.h}
            </span>
            <span style={{
              background: 'var(--bg-700)', borderRadius: 4, padding: '2px 8px',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>{r.hg}–{r.ag}</span>
            <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
              {r.a} {teams[r.a]?.fl || ''}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', flexShrink: 0, width: 32, textAlign: 'right' }}>{r.tot}⚽</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tests + build**

```bash
npm test -- --run && npm run build
```

Expected: 32 passed, build OK.

- [ ] **Step 3: Commit**

```bash
git add src/panels/StatsPanel.jsx
git commit -m "feat: StatsPanel — KPIs, donut resultados, top goleadores, top partidos"
```

---

### Task 7: QuinielaPanel — Tab 2 GolPredictor (login + fetch + parse + render)

**Files:**
- Modify: `src/panels/QuinielaPanel.jsx` (reescritura completa, mantiene Tab 1 igual)

**Interfaces:**
- Consumes: mismas imports de Tab 1 + `GP_URL`, `GP_PID` constantes
- Produce: panel con 2 tabs, Tab 2 con tabla del pool de GolPredictor

- [ ] **Step 1: Reescribir `src/panels/QuinielaPanel.jsx`**

```jsx
// src/panels/QuinielaPanel.jsx
import { useState } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import { resolveKOTeam } from '../services/resolvers.js';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';
import gr from '../data/gr.json';

const GP_URL = 'https://golpredictor.fernando-fjhr.workers.dev';
const GP_PID = '0,b2bfbc17-41b4-43c6-a48a-6c2ad5baa31d';

// ── Helpers localStorage ─────────────────────────────────────
function loadPredictions() {
  try { return JSON.parse(localStorage.getItem('quiniela-preds') || '{}'); } catch { return {}; }
}
function savePredictions(preds) {
  try { localStorage.setItem('quiniela-preds', JSON.stringify(preds)); } catch {}
}
function loadGpCreds() {
  return {
    cookie: localStorage.getItem('gp-cookie') || '',
    user: localStorage.getItem('gp-user') || '',
  };
}
function saveGpCreds(cookie, user) {
  try { localStorage.setItem('gp-cookie', cookie); localStorage.setItem('gp-user', user); } catch {}
}
function clearGpCreds() {
  try { localStorage.removeItem('gp-cookie'); localStorage.removeItem('gp-user'); } catch {}
}

// ── parseGPHtml — port del portal estático ───────────────────
function parseGPHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  if (!tables.length) return null;
  const mainTbl = tables.reduce((a, b) => b.rows.length > a.rows.length ? b : a);
  if (mainTbl.rows.length < 2) return null;
  const colCount = mainTbl.rows[0].cells.length;

  function isPager(cells) {
    const ne = cells.filter(c => c.trim() !== '');
    if (!ne.length) return true;
    return ne.every(c => /^[\d\s.<>«»…\-]+$/.test(c) && c.trim().length <= 4);
  }

  const headers = Array.from(mainTbl.rows[0].cells).map(c => c.textContent.trim());
  const rows = [];
  for (let i = 1; i < mainTbl.rows.length; i++) {
    const cells = Array.from(mainTbl.rows[i].cells).map(c => c.textContent.trim());
    if (cells.some(c => c !== '') && !isPager(cells)) rows.push(cells);
  }
  // Tablas adicionales de paginación
  tables.forEach(tbl => {
    if (tbl === mainTbl || !tbl.rows.length) return;
    if (tbl.rows[0].cells.length !== colCount) return;
    for (let i = 1; i < tbl.rows.length; i++) {
      const cells = Array.from(tbl.rows[i].cells).map(c => c.textContent.trim());
      if (cells.some(c => c !== '') && !isPager(cells)) rows.push(cells);
    }
  });

  return { headers, rows };
}

// ── Tab 1: Mis Predicciones ───────────────────────────────────
function MisPredictionsTab({ res, resKO }) {
  const [preds, setPreds] = useState(loadPredictions);

  const setPred = (id, winner) => {
    const next = { ...preds, [id]: winner };
    setPreds(next);
    savePredictions(next);
  };

  const r32 = koBracket.filter(k => k.rnd === 'R32');
  const played = r32.filter(kb => resKO.find(r => r.id === kb.id)?.p);
  const correct = played.filter(kb => {
    const koM = resKO.find(r => r.id === kb.id);
    const h = resolveKOTeam(kb.sh, res, resKO, koBracket, gr) || kb.sh;
    const a = resolveKOTeam(kb.sa, res, resKO, koBracket, gr) || kb.sa;
    const actualWinner = koM.hg > koM.ag || koM.pens === 'h' ? h : a;
    return preds[kb.id] === actualWinner;
  }).length;

  return (
    <div>
      {played.length > 0 && (
        <div style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 16, display: 'inline-block' }}>
          <span style={{ color: 'var(--text-400)', fontSize: 13 }}>Mis puntos: </span>
          <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 18 }}>{correct}</span>
          <span style={{ color: 'var(--text-500)', fontSize: 13 }}> / {played.length}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {r32.map(kb => {
          const koM = resKO.find(r => r.id === kb.id) || {};
          const h = resolveKOTeam(kb.sh, res, resKO, koBracket, gr) || kb.sh;
          const a = resolveKOTeam(kb.sa, res, resKO, koBracket, gr) || kb.sa;
          const pred = preds[kb.id];
          const isPlayed = koM.p;
          const actualWinner = isPlayed ? (koM.hg > koM.ag || koM.pens === 'h' ? h : a) : null;
          const isCorrect = pred && actualWinner && pred === actualWinner;
          return (
            <div key={kb.id} style={{
              background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '10px 14px',
              border: `1px solid ${isCorrect ? 'var(--green)' : pred && isPlayed ? 'var(--red)' : 'var(--bg-700)'}`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => !isPlayed && setPred(kb.id, h)} style={{
                  flex: 1, padding: '6px', borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: isPlayed ? 'default' : 'pointer', fontSize: 12,
                  background: pred === h ? 'var(--blue)' : 'var(--bg-700)',
                  color: pred === h ? '#fff' : 'var(--text-400)', fontWeight: pred === h ? 700 : 400,
                }}>
                  {teams[h]?.fl} {h}
                </button>
                <span style={{ color: 'var(--text-500)', fontSize: 11 }}>vs</span>
                <button onClick={() => !isPlayed && setPred(kb.id, a)} style={{
                  flex: 1, padding: '6px', borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: isPlayed ? 'default' : 'pointer', fontSize: 12,
                  background: pred === a ? 'var(--blue)' : 'var(--bg-700)',
                  color: pred === a ? '#fff' : 'var(--text-400)', fontWeight: pred === a ? 700 : 400,
                }}>
                  {teams[a]?.fl} {a}
                </button>
              </div>
              {isPlayed && (
                <div style={{ fontSize: 11, textAlign: 'center', marginTop: 6, color: isCorrect ? 'var(--green-400)' : 'var(--red-400)' }}>
                  {isCorrect ? '✓ Correcto' : `✗ Ganó: ${actualWinner}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 2: GolPredictor ───────────────────────────────────────
function GolPredictorTab() {
  const creds = loadGpCreds();
  const [cookie, setCookie] = useState(creds.cookie);
  const [gpUser, setGpUser] = useState(creds.user);
  const [gpData, setGpData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const fetchPool = async (c) => {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`${GP_URL}/pool`, {
        headers: { 'X-GP-Cookie': c, 'X-GP-Pid': GP_PID },
      });
      if (res.status === 401) {
        clearGpCreds();
        setCookie('');
        setGpUser('');
        setStatus('idle');
        setError('Sesión expirada. Volvé a iniciar sesión.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseGPHtml(html);
      if (!parsed) { setError('No se pudo leer la tabla del pool.'); setStatus('error'); return; }
      setGpData(parsed);
      setStatus('done');
    } catch (e) {
      setError(e.message || 'Error desconocido');
      setStatus('error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('logging');
    setError('');
    try {
      const res = await fetch(`${GP_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(`Login falló (HTTP ${res.status})`);
      const data = await res.json();
      if (!data.cookie) throw new Error('No se recibió cookie de sesión');
      saveGpCreds(data.cookie, data.username || username);
      setCookie(data.cookie);
      setGpUser(data.username || username);
      setPassword('');
      await fetchPool(data.cookie);
    } catch (e) {
      setError(e.message || 'Error de login');
      setStatus('idle');
    }
  };

  const handleLogout = () => {
    clearGpCreds();
    setCookie('');
    setGpUser('');
    setGpData(null);
    setStatus('idle');
    setError('');
  };

  // Sin sesión → formulario de login
  if (!cookie) {
    return (
      <div style={{ maxWidth: 360 }}>
        <p style={{ color: 'var(--text-400)', fontSize: 13, marginBottom: 16 }}>
          Ingresá tus credenciales de golpredictor.com para ver la tabla del pool.
        </p>
        {error && (
          <div style={{ color: 'var(--red-400)', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,.1)', borderRadius: 'var(--r-sm)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text" placeholder="Usuario" value={username}
            onChange={e => setUsername(e.target.value)} required
            style={{ padding: '8px 10px', background: 'var(--bg-700)', border: '1px solid var(--bg-600)', borderRadius: 'var(--r-md)', color: 'var(--text-200)', fontSize: 13 }}
          />
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={{ padding: '8px 10px', background: 'var(--bg-700)', border: '1px solid var(--bg-600)', borderRadius: 'var(--r-md)', color: 'var(--text-200)', fontSize: 13 }}
          />
          <button type="submit" disabled={status === 'logging'} style={{
            padding: '8px', background: 'var(--blue)', color: '#fff', border: 'none',
            borderRadius: 'var(--r-md)', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>
            {status === 'logging' ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    );
  }

  // Con sesión pero sin datos → cargar
  if (!gpData && status !== 'loading' && status !== 'error') {
    fetchPool(cookie);
    return <div style={{ color: 'var(--text-400)', padding: 20 }}>Cargando pool...</div>;
  }

  if (status === 'loading') {
    return <div style={{ color: 'var(--text-400)', padding: 20 }}>Cargando pool...</div>;
  }

  if (status === 'error') {
    return (
      <div>
        <div style={{ color: 'var(--red-400)', marginBottom: 12 }}>{error}</div>
        <button onClick={() => fetchPool(cookie)} style={{ padding: '6px 14px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 13 }}>
          Reintentar
        </button>
      </div>
    );
  }

  // Tabla del pool
  const { headers, rows } = gpData;
  // Detectar columna de puntos por nombre
  let ptsIdx = headers.findIndex(h => /punt|ptos|pts|score|total|obten/i.test(h));
  if (ptsIdx === -1) ptsIdx = headers.length - 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-400)' }}>Sesión: <strong style={{ color: 'var(--text-200)' }}>{gpUser}</strong></span>
        <button onClick={() => fetchPool(cookie)} style={{
          marginLeft: 'auto', padding: '5px 12px', background: 'var(--blue)', color: '#fff',
          border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>↺ Actualizar</button>
        <button onClick={handleLogout} style={{
          padding: '5px 12px', background: 'none', color: 'var(--text-400)',
          border: '1px solid var(--bg-600)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12,
        }}>Cerrar sesión</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-700)', color: 'var(--text-400)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '8px 10px', textAlign: i === ptsIdx ? 'center' : 'left',
                  fontWeight: 700, whiteSpace: 'nowrap',
                  color: i === ptsIdx ? 'var(--gold)' : 'var(--text-400)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderTop: '1px solid var(--bg-700)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '6px 10px', textAlign: ci === ptsIdx ? 'center' : 'left',
                    fontWeight: ci === ptsIdx ? 700 : 400,
                    color: ci === ptsIdx ? 'var(--gold)' : 'var(--text-200)',
                    whiteSpace: 'nowrap',
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Panel principal con tabs ──────────────────────────────────
export default function QuinielaPanel() {
  const { res, resKO } = useMatchStore();
  const [tab, setTab] = useState('mis');

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 16px', fontSize: 13, fontWeight: tab === id ? 700 : 500,
        background: tab === id ? 'var(--blue)' : 'none',
        color: tab === id ? '#fff' : 'var(--text-400)',
        border: tab === id ? 'none' : '1px solid var(--bg-700)',
        borderRadius: 'var(--r-md)', cursor: 'pointer',
      }}
    >{label}</button>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>📋 Quiniela</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabBtn('mis', '👤 Mis predicciones')}
        {tabBtn('gp', '🌐 GolPredictor Pool')}
      </div>
      {tab === 'mis' ? <MisPredictionsTab res={res} resKO={resKO} /> : <GolPredictorTab />}
    </div>
  );
}
```

- [ ] **Step 2: Tests + build**

```bash
npm test -- --run && npm run build
```

Expected: 32 passed, build OK.

- [ ] **Step 3: Commit**

```bash
git add src/panels/QuinielaPanel.jsx
git commit -m "feat: QuinielaPanel — Tab 2 GolPredictor con login, fetch, parse y tabla del pool"
```

---

### Task 8: CSS polish — layout, scrollbar, body overflow, mobile hamburger

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.jsx` (mobile media query para hamburger)

**Interfaces:**
- Ajustes finales de layout y visual. No cambia interfaces de componentes.

- [ ] **Step 1: Actualizar `src/index.css`**

Reemplazar el contenido actual con:

```css
:root {
  --bg-950: #020617; --bg-900: #0f172a; --bg-800: #1e293b; --bg-700: #334155; --bg-600: #475569;
  --text-50: #f8fafc; --text-200: #e2e8f0; --text-400: #94a3b8; --text-500: #64748b; --text-600: #475569;
  --blue: #2563eb; --blue-400: #60a5fa; --blue-700: #1d4ed8;
  --gold: #f59e0b; --gold-300: #fcd34d;
  --green: #16a34a; --green-400: #4ade80;
  --red: #dc2626; --red-400: #f87171;
  --gray: #6b7280;
  --sidebar-w: 224px; --sidebar-cw: 58px;
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-xl: 16px;
  --hdr-h: 54px;
  --pg-hdr-bg: rgba(15, 23, 42, .95);
}
[data-theme="light"] {
  --bg-950: #ffffff; --bg-900: #f8fafc; --bg-800: #f1f5f9; --bg-700: #e2e8f0; --bg-600: #cbd5e1;
  --text-50: #0f172a; --text-200: #1e293b; --text-400: #475569; --text-500: #64748b; --text-600: #94a3b8;
  --blue-400: #2563eb; --gold: #d97706; --gold-300: #f59e0b;
  --green-400: #16a34a; --red-400: #dc2626;
  --pg-hdr-bg: rgba(248, 250, 252, .95);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  height: 100%;
  overflow: hidden;
}
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg-950);
  color: var(--text-50);
  font-size: 14px;
  line-height: 1.5;
}
#root {
  height: 100%;
}

/* Scrollbar sutil */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--bg-700) transparent;
}
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: var(--bg-700); border-radius: 3px; }

/* Mobile: sidebar como drawer */
@media (max-width: 768px) {
  .hdr-hamburger {
    display: flex !important;
  }
  nav[class="sidebar"] {
    position: fixed;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(.4,0,.2,1);
  }
  nav[class="sidebar"].open {
    transform: translateX(0);
  }
}
```

- [ ] **Step 2: Ajustar el App.jsx para mobile — marginLeft 0 en mobile**

En `App.jsx`, la regla del `marginLeft` no funciona en mobile porque el sidebar está fuera del flujo. Agregar un `useEffect` que detecte el ancho de pantalla:

```jsx
// En App.jsx, antes del return:
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const ml = isMobile ? '0' : (sidebarCollapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)');
```

Reemplazar la línea:
```jsx
const ml = sidebarCollapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)';
```
con:
```jsx
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const ml = isMobile ? '0' : (sidebarCollapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)');
```

- [ ] **Step 3: Tests + build**

```bash
npm test -- --run && npm run build
```

Expected: 32 passed, build OK.

- [ ] **Step 4: Commit y push**

```bash
git add src/index.css src/App.jsx
git commit -m "feat: CSS polish — scrollbar, body overflow, mobile layout"
git push origin main
```

---

## Self-Review del Plan

**Spec coverage:**
- ✅ Sidebar con secciones TORNEO/ANÁLISIS/SIMULACIÓN → Task 3
- ✅ Sidebar logo, collapse, stats footer → Task 3
- ✅ Grupo grid en "Fase de Grupos" → Task 3
- ✅ PageHeader con sync/restaurar/lastSync → Tasks 1 + 2
- ✅ MatchCard con barras de probabilidad → Task 4
- ✅ MatchCard con phase badge → Task 4
- ✅ MatchCard con botones Predecir/H2H → Task 4
- ✅ CalendarPanel pasa probabilidades a MatchCard → Task 5
- ✅ StatsPanel KPIs + donut + goleadores + top partidos → Task 6
- ✅ StatsPanel registrado en App.jsx → Task 2 (lazy) + Task 3 (sidebar nav)
- ✅ QuinielaPanel Tab 1 (predicciones personales, sin cambios funcionales) → Task 7
- ✅ QuinielaPanel Tab 2 GolPredictor (login + fetch + parse + tabla) → Task 7
- ✅ CSS polish → Task 8

**Consistencia de tipos:**
- `pW`, `pD`, `pL` son siempre floats 0-1 de `sim()`. MatchCard los recibe opcionales. CalendarPanel los pasa directamente de `sim()`. ✅
- `restore()` limpia res, resKO, matchTimes, lastSync. `setLastSync(isoString)` guarda ISO string. `fmtLastSync` en PageHeader parsea con `new Date()`. ✅
- `parseGPHtml` retorna `{ headers, rows }` o `null`. GolPredictorTab lo consume con guarda. ✅
