// src/components/Toast.jsx
const COLORS = { ok: 'var(--green)', warn: 'var(--gold)', err: 'var(--red)' };

export default function Toast({ message, type = 'ok' }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--bg-800)', border: `1px solid ${COLORS[type]}`,
      borderRadius: 'var(--r-md)', padding: '10px 16px',
      color: 'var(--text-50)', fontSize: 13, maxWidth: 300,
      boxShadow: '0 4px 12px rgba(0,0,0,.4)',
    }}>
      {message}
    </div>
  );
}
