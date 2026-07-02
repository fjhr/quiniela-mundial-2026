// src/components/FilterBar.jsx
export default function FilterBar({ filters, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {filters.map(f => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`filter-pill filter-btn${active === f.value ? ' active' : ''}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
