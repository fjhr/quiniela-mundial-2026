// src/App.jsx
import React, { useEffect, useState, Suspense } from 'react';
import { useMatchStore } from './store/matchStore.js';
import { useUiStore } from './store/uiStore.js';
import { fetchFromESPN, applyESPNTimes, syncKnockout, NAME_MAP } from './services/espn.js';
import { resolveKOTeam } from './services/resolvers.js';
import Sidebar from './components/Sidebar.jsx';
import BottomNav from './components/BottomNav.jsx';
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
  cal:       { icon: 'ti-calendar',         title: 'Calendario',       subtitle: 'Partidos ordenados por fecha · filtra por fase o país sede' },
  groups:    { icon: 'ti-layout-grid',      title: 'Fase de Grupos',   subtitle: 'Tabla de posiciones y resultados por grupo' },
  elim:      { icon: 'ti-sitemap',          title: 'Eliminatorias',    subtitle: 'Resultados de la fase eliminatoria' },
  bracket:   { icon: 'ti-tournament',       title: 'Bracket R32',      subtitle: 'Cuadro completo desde 32avos' },
  predictor: { icon: 'ti-chart-radar',      title: 'Predictor',        subtitle: 'Probabilidades Poisson por partido' },
  h2h:       { icon: 'ti-switch-horizontal',title: 'Head-to-Head',     subtitle: 'Comparación directa entre dos equipos' },
  klement:   { icon: 'ti-math-function',    title: 'Klement',          subtitle: 'Ranking de forma actual' },
  stats:     { icon: 'ti-chart-bar',        title: 'Estadísticas',     subtitle: 'Resumen del torneo en números' },
  quiniela:  { icon: 'ti-device-gamepad-2', title: 'Quiniela',         subtitle: 'Tus predicciones y el pool de GolPredictor' },
  escenarios:{ icon: 'ti-calculator',       title: 'Escenarios',       subtitle: 'Simulaciones Monte Carlo' },
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
  const { activePanel, sidebarCollapsed, toastMessage, toastType, showToast, toggleSidebar } = useUiStore();
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

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { icon, title, subtitle } = PANEL_INFO[activePanel] || {};
  const ml = isMobile ? '0' : (sidebarCollapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)');

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Sidebar />
      {isMobile && !sidebarCollapsed && (
        <div className="sidebar-backdrop" onClick={toggleSidebar} />
      )}
      <div style={{
        marginLeft: ml, flex: 1,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', transition: 'margin-left 0.2s',
        minWidth: 0,
      }}>
        <PageHeader
          icon={icon}
          title={title}
          subtitle={subtitle}
          onSync={handleSync}
          syncing={syncing}
          onRestore={handleRestore}
          lastSync={lastSync}
        />
        <main className="main-content" style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '20px', maxWidth: 960, width: '100%',
        }}>
          <Suspense fallback={<Spinner />}>
            {PANEL_MAP[activePanel]}
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
