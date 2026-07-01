import { useUiStore } from '../store/uiStore.js';

const ITEMS = [
  { id: 'cal',       icon: 'ti-calendar',        label: 'Hoy' },
  { id: 'groups',    icon: 'ti-layout-grid',      label: 'Grupos' },
  { id: 'predictor', icon: 'ti-chart-radar',      label: 'Predictor' },
  { id: 'quiniela',  icon: 'ti-device-gamepad-2', label: 'Quiniela' },
  { id: 'stats',     icon: 'ti-chart-bar',        label: 'Stats' },
];

export default function BottomNav() {
  const { activePanel, setPanel } = useUiStore();

  return (
    <nav className="bottom-nav">
      {ITEMS.map(item => {
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setPanel(item.id)}
            className={`bottom-nav-btn${isActive ? ' active' : ''}`}
          >
            <i className={`ti ${item.icon}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
