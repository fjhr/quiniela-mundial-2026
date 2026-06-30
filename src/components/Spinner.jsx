// src/components/Spinner.jsx
export default function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--bg-700)',
        borderTop: '3px solid var(--blue-400)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
