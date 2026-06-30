// src/panels/H2HPanel.jsx
import { useState } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend
} from 'chart.js';
import { sim, klem } from '../services/poisson.js';
import teams from '../data/teams.json';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const TEAM_LIST = Object.keys(teams).sort();
const ATTRS = ['Klement', 'FIFA Rank', 'PIB/cap', 'Clima', 'Local'];

function clamp(v, min, max) { return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)); }

function teamRadar(team) {
  const d = teams[team];
  if (!d) return [50,50,50,50,50];
  const klVal = klem(team, teams) * 100;
  const rankVal = clamp(101 - d.r, 0, 100);                        // higher is better
  const gdpVal = clamp(d.gdp, 0, 80000) / 800;                    // 0–100
  const tmpVal = Math.max(0, 100 - Math.pow(d.tmp - 14, 2) / 2);  // optimal ~14°C
  const hostVal = (d.host || 0) * 100;
  return [klVal, rankVal, gdpVal, tmpVal, hostVal];
}

export default function H2HPanel() {
  const [h, setH] = useState('Brasil');
  const [a, setA] = useState('Argentina');

  const th = teams[h], ta = teams[a];
  const pr = th && ta ? sim(h, a, teams) : null;

  const radarData = {
    labels: ATTRS,
    datasets: [
      {
        label: h,
        data: teamRadar(h),
        borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.2)',
        pointBackgroundColor: '#2563eb',
      },
      {
        label: a,
        data: teamRadar(a),
        borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.2)',
        pointBackgroundColor: '#dc2626',
      },
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
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>📊 Head to Head</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {select(h, setH)}
        <span style={{ color: 'var(--text-400)' }}>vs</span>
        {select(a, setA)}
      </div>
      {pr && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[
            { label: `${h} gana`, pct: pr.pW },
            { label: 'Empate', pct: pr.pD },
            { label: `${a} gana`, pct: pr.pL },
          ].map(x => (
            <div key={x.label} style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '10px 14px', textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue-400)' }}>{(x.pct * 100).toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 4 }}>{x.label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <Radar data={radarData} options={{
          scales: {
            r: {
              ticks: { color: '#94a3b8', backdropColor: 'transparent' },
              grid: { color: '#334155' },
              pointLabels: { color: '#94a3b8' },
              min: 0, max: 100,
            },
          },
          plugins: { legend: { labels: { color: '#94a3b8' } } },
        }} />
      </div>
    </div>
  );
}
