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
      ><i className="ti ti-menu-2" /></button>
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
        <><i className="ti ti-history" /> Restaurar</>
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
        {syncing ? '⟳ Sync...' : <><i className="ti ti-bolt" /> Sincronizar</>}
      </button>
    </header>
  );
}
