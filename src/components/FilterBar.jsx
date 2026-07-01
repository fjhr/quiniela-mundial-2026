// src/components/FilterBar.jsx
export default function FilterBar({ filters, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {filters.map(f => (
        <button key={f.value} onClick={() => onChange(f.value)} className="filter-btn" style={{
          padding: '4px 10px', borderRadius: 'var(--r-sm)', border: 'none',
          cursor: 'pointer', fontSize: 12, fontWeight: 500,
          background: active === f.value ? 'var(--blue)' : 'var(--bg-800)',
          color: active === f.value ? '#fff' : 'var(--text-400)',
        }}>
          {f.label}
        </button>
      ))}
    </div>
  );
}
