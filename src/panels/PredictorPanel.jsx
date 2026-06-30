// src/panels/PredictorPanel.jsx
import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { sim } from '../services/poisson.js';
import teams from '../data/teams.json';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TEAM_LIST = Object.keys(teams).sort();

function poissonProb(k, lambda) {
  let r = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) r *= lambda / i;
  return r;
}

export default function PredictorPanel() {
  const [h, setH] = useState('Brasil');
  const [a, setA] = useState('Argentina');

  const pr = (teams[h] && teams[a]) ? sim(h, a, teams) : null;

  const labels = ['0','1','2','3','4','5+'];
  const hProbs = pr ? labels.map((_, i) =>
    i < 5 ? poissonProb(i, pr.lA) : 1 - [0,1,2,3,4].reduce((s,j) => s + poissonProb(j, pr.lA), 0)
  ) : [];
  const aProbs = pr ? labels.map((_, i) =>
    i < 5 ? poissonProb(i, pr.lB) : 1 - [0,1,2,3,4].reduce((s,j) => s + poissonProb(j, pr.lB), 0)
  ) : [];

  const chartData = {
    labels,
    datasets: [
      { label: h, data: hProbs.map(p => +(p*100).toFixed(1)), backgroundColor: 'rgba(37,99,235,.7)' },
      { label: a, data: aProbs.map(p => +(p*100).toFixed(1)), backgroundColor: 'rgba(220,38,38,.7)' },
    ],
  };

  const select = (val, setter) => (
    <select value={val} onChange={e => setter(e.target.value)} style={{
      background: 'var(--bg-800)', color: 'var(--text-50)', border: '1px solid var(--bg-700)',
      borderRadius: 'var(--r-sm)', padding: '6px 10px', fontSize: 13,
    }}>
      {TEAM_LIST.map(t => <option key={t} value={t}>{teams[t]?.fl} {t}</option>)}
    </select>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>🔮 Predictor Poisson</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {select(h, setH)}
        <span style={{ color: 'var(--text-400)' }}>vs</span>
        {select(a, setA)}
      </div>
      {pr && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[
              { label: `${h} gana`, pct: pr.pW },
              { label: 'Empate', pct: pr.pD },
              { label: `${a} gana`, pct: pr.pL },
            ].map(x => (
              <div key={x.label} style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '12px 16px', textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-400)' }}>{(x.pct * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 4 }}>{x.label}</div>
              </div>
            ))}
          </div>
          <Bar data={chartData} options={{
            responsive: true,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
              y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
              x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            },
          }} />
        </>
      )}
    </div>
  );
}
