// src/panels/KlementPanel.jsx
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from 'chart.js';
import { klem } from '../services/poisson.js';
import teams from '../data/teams.json';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const TEAM_LIST = Object.keys(teams);

export default function KlementPanel() {
  const ranked = TEAM_LIST
    .map(t => ({ t, score: klem(t, teams), fl: teams[t]?.fl || '🏳️' }))
    .sort((a, b) => b.score - a.score);

  const top20 = ranked.slice(0, 20);

  const chartData = {
    labels: top20.map(x => `${x.fl} ${x.t}`),
    datasets: [{
      label: 'Klement Score',
      data: top20.map(x => +(x.score * 100).toFixed(1)),
      backgroundColor: top20.map((_, i) => i === 0 ? '#d97706' : 'rgba(37,99,235,.7)'),
    }],
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Bar data={chartData} options={{
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toFixed(1)}%` } },
          },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#334155' } },
          },
        }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {ranked.map((x, i) => (
          <div key={x.t} style={{
            background: 'var(--bg-800)', borderRadius: 'var(--r-sm)', padding: '8px 12px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: i === 0 ? '1px solid var(--gold)' : '1px solid var(--bg-700)',
          }}>
            <span style={{ fontSize: 13 }}>{x.fl} {x.t}</span>
            <span style={{ fontWeight: 700, color: i < 3 ? 'var(--gold)' : 'var(--text-400)', fontSize: 12 }}>
              {(x.score * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
