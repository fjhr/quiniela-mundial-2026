// src/components/PageHeader.jsx
import { useUiStore } from '../store/uiStore.js';

function fmtLastSync(date) {
  if (!date) return null;
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins}min`;
  return `Hace ${Math.round(mins / 60)}h`;
}

export default function PageHeader({ icon, title, subtitle, onSync, syncing, onRestore, lastSync }) {
  const { toggleSidebar } = useUiStore();

  return (
    <header style={{
      height: 'var(--hdr-h)', flexShrink: 0,
      background: 'var(--pg-hdr-bg)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--bg-700)',
      padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8,
      position: 'sticky', top: 0, zIndex: 90,
    }}>
      <button
        onClick={toggleSidebar}
        className="btn-ghost hdr-hamburger"
        style={{ display: 'none', padding: '7px 9px', fontSize: 17 }}
        aria-label="Menú"
      >
        <i className="ti ti-menu-2" />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: 'var(--text-50)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          {icon && <i className={`ti ${icon}`} style={{ fontSize: 16, flexShrink: 0, color: 'var(--blue-400)' }} />}
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--text-500)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        )}
      </div>

      {lastSync && (
        <div style={{ fontSize: 11, color: 'var(--text-600)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {fmtLastSync(lastSync)}
        </div>
      )}

      <button onClick={onRestore} className="btn-ghost">
        <i className="ti ti-history" />
        <span className="hdr-btn-text">Restaurar</span>
      </button>

      <button
        onClick={onSync}
        disabled={syncing}
        className="btn-primary"
        style={{ opacity: syncing ? 0.75 : 1 }}
      >
        <i className={`ti ${syncing ? 'ti-refresh spin' : 'ti-bolt'}`} />
        <span className="hdr-btn-text">Sincronizar</span>
      </button>
    </header>
  );
}
