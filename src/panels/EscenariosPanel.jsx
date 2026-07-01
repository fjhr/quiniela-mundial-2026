import { useState, useCallback } from 'react';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';
import gr from '../data/gr.json';

const STAGES = [
  { key: 'group', label: 'Grupos' },
  { key: 'r16', label: 'R16' },
  { key: 'qf', label: 'QF' },
  { key: 'sf', label: 'SF' },
  { key: 'final', label: 'Final' },
  { key: 'champion', label: '🏆' },
];

export default function EscenariosPanel() {
  const [counts, setCounts] = useState(null);
  const [running, setRunning] = useState(false);
  const [simN, setSimN] = useState(0);
  const N = 50000;

  const run = useCallback(() => {
    setRunning(true);
    setCounts(null);
    const worker = new Worker(
      new URL('../workers/montecarlo.worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.postMessage({ N, gr, teams, koBracket });
    worker.onmessage = (e) => {
      if (e.data.ok) {
        setCounts(e.data.counts);
        setSimN(e.data.N);
      }
      setRunning(false);
      worker.terminate();
    };
    worker.onerror = () => {
      setRunning(false);
      worker.terminate();
    };
  }, []);

  const sorted = counts
    ? Object.entries(counts).sort((a, b) => b[1].champion - a[1].champion)
    : [];

  const topTeam = sorted.length > 0 ? sorted[0] : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={run} disabled={running} style={{
          background: 'var(--blue)', color: '#fff', border: 'none',
          borderRadius: 'var(--r-sm)', padding: '8px 20px', cursor: 'pointer', fontWeight: 600,
          opacity: running ? 0.7 : 1,
        }}>
          {running ? `Simulando ${N.toLocaleString()} escenarios...` : `▶ Simular ${N.toLocaleString()} escenarios`}
        </button>
        {topTeam && !running && (
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
            Favorito: {teams[topTeam[0]]?.fl} {topTeam[0]} ({((topTeam[1].champion / simN) * 100).toFixed(1)}%)
          </span>
        )}
      </div>
      {counts && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-700)', color: 'var(--text-400)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Equipo</th>
                {STAGES.map(s => (
                  <th key={s.key} style={{ padding: '8px 6px', textAlign: 'center' }}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(([team, c]) => (
                <tr key={team} style={{ borderTop: '1px solid var(--bg-700)' }}>
                  <td style={{ padding: '6px 12px' }}>{teams[team]?.fl} {team}</td>
                  {STAGES.map(s => (
                    <td key={s.key} style={{
                      padding: '6px', textAlign: 'center',
                      color: s.key === 'champion' ? 'var(--gold)' : 'var(--text-400)',
                      fontWeight: s.key === 'champion' ? 700 : 400,
                    }}>
                      {((c[s.key] || 0) / simN * 100).toFixed(1)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
