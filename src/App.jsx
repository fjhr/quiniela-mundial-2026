// src/App.jsx
import React, { useEffect, Suspense } from 'react';
import { useMatchStore } from './store/matchStore.js';
import { useUiStore } from './store/uiStore.js';
import { fetchFromESPN, applyESPNTimes, syncKnockout, NAME_MAP } from './services/espn.js';
import { resolveKOTeam } from './services/resolvers.js';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import Spinner from './components/Spinner.jsx';
import CalendarPanel from './panels/CalendarPanel.jsx';
import sched from './data/sched.json';
import koBracket from './data/ko-bracket.json';

// Paneles lazy
const GroupsPanel = React.lazy(() => import('./panels/GroupsPanel.jsx'));
const EliminatoriaPanel = React.lazy(() => import('./panels/EliminatoriaPanel.jsx'));
const BracketPanel = React.lazy(() => import('./panels/BracketPanel.jsx'));
const PredictorPanel = React.lazy(() => import('./panels/PredictorPanel.jsx'));
const H2HPanel = React.lazy(() => import('./panels/H2HPanel.jsx'));
const KlementPanel = React.lazy(() => import('./panels/KlementPanel.jsx'));
const EscenariosPanel = React.lazy(() => import('./panels/EscenariosPanel.jsx'));
const QuinielaPanel = React.lazy(() => import('./panels/QuinielaPanel.jsx'));

const PANELS = ['cal','groups','elim','bracket','predictor','h2h','klement','escenarios','quiniela'];

const PANEL_MAP = {
  cal: <CalendarPanel />,
  groups: <GroupsPanel />,
  elim: <EliminatoriaPanel />,
  bracket: <BracketPanel />,
  predictor: <PredictorPanel />,
  h2h: <H2HPanel />,
  klement: <KlementPanel />,
  escenarios: <EscenariosPanel />,
  quiniela: <QuinielaPanel />,
};

export default function App() {
  const { res, resKO, matchTimes, setMatchTimes, applyESPNResults, applyKOUpdates, setKOTeamNames } = useMatchStore();
  const { activePanel, sidebarCollapsed, toastMessage, toastType, setPanel, toggleSidebar, showToast } = useUiStore();

  // Pre-poblar nombres de equipo en resKO al montar
  useEffect(() => {
    setKOTeamNames(koBracket, slot => resolveKOTeam(slot, res, resKO, koBracket));
  }, []);

  // ESPN sync diferido 1200ms
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const events = await fetchFromESPN();
        const { matchTimes: newTimes } = applyESPNTimes(events, sched);
        setMatchTimes({ ...matchTimes, ...newTimes });
        const count = applyESPNResults(events, NAME_MAP);
        const koUpdates = syncKnockout(events, resKO);
        applyKOUpdates(koUpdates);
        if (count + koUpdates.length > 0) {
          showToast(`${count + koUpdates.length} resultado(s) actualizado(s) · ESPN`, 'ok');
        }
      } catch {
        showToast('ESPN no disponible', 'warn');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const marginLeft = sidebarCollapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        panels={PANELS}
        active={activePanel}
        onSelect={setPanel}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />
      <main style={{ marginLeft, flex: 1, padding: '20px', maxWidth: 900, transition: 'margin-left 0.2s' }}>
        <Suspense fallback={<Spinner />}>
          {PANEL_MAP[activePanel]}
        </Suspense>
      </main>
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
