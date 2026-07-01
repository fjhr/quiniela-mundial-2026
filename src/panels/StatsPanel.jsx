import { useMatchStore } from '../store/matchStore.js';
import teams from '../data/teams.json';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function StatsPanel() {
  const { res } = useMatchStore();
  const played = res.filter(r => r.p);
  const partidos = played.length;
  const goles = played.reduce((s, r) => s + (r.hg || 0) + (r.ag || 0), 0);
  const gpp = partidos > 0 ? (goles / partidos).toFixed(2) : '—';
  const wins  = played.filter(r => r.hg > r.ag).length;
  const draws = played.filter(r => r.hg === r.ag).length;
  const away  = partidos - wins - draws;

  // Goles por equipo
  const teamGoals = {};
  played.forEach(r => {
    teamGoals[r.h] = (teamGoals[r.h] || 0) + (r.hg || 0);
    teamGoals[r.a] = (teamGoals[r.a] || 0) + (r.ag || 0);
  });
  const topScorers = Object.entries(teamGoals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxGoals = topScorers[0]?.[1] || 1;

  // Top partidos por goles
  const topMatches = [...played]
    .map(r => ({ ...r, tot: (r.hg || 0) + (r.ag || 0) }))
    .sort((a, b) => b.tot - a.tot)
    .slice(0, 6);

  const rootStyle = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const colorGreen = rootStyle?.getPropertyValue('--green').trim() || '#16a34a';
  const colorGray  = rootStyle?.getPropertyValue('--gray').trim()  || '#6b7280';
  const colorRed   = rootStyle?.getPropertyValue('--red').trim()   || '#dc2626';

  const donutData = {
    labels: ['Victoria local', 'Empate', 'Victoria visitante'],
    datasets: [{
      data: [wins, draws, away],
      backgroundColor: [colorGreen, colorGray, colorRed],
      borderWidth: 0,
      hoverOffset: 5,
    }],
  };
  const donutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { size: 11 }, padding: 12, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: (c) => `${c.label}: ${c.parsed} (${partidos ? Math.round(c.parsed / partidos * 100) : 0}%)`,
        },
      },
    },
  };

  const kpiStyle = {
    background: 'var(--bg-800)', borderRadius: 'var(--r-lg)', padding: '16px 20px',
    border: '1px solid var(--bg-700)',
  };

  if (partidos === 0) {
    return (
      <div>
        <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>📊 Estadísticas</h2>
        <p style={{ color: 'var(--text-400)', textAlign: 'center', marginTop: 40 }}>
          No hay partidos jugados aún.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20, color: 'var(--text-200)' }}>📊 Estadísticas</h2>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Partidos jugados', value: partidos, unit: `de ${res.length} total` },
          { label: 'Goles totales', value: goles, unit: `${gpp} por partido` },
          { label: 'Victorias local', value: wins, unit: `${partidos ? Math.round(wins/partidos*100) : 0}% de partidos` },
          { label: 'Empates', value: draws, unit: `${partidos ? Math.round(draws/partidos*100) : 0}% de partidos` },
        ].map(({ label, value, unit }) => (
          <div key={label} style={kpiStyle}>
            <div style={{ fontSize: 11, color: 'var(--text-400)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-50)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-500)', marginTop: 4 }}>{unit}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Top goleadores */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-200)', marginBottom: 12 }}>
            ⚽ Equipos goleadores
          </h3>
          {topScorers.map(([name, g], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(71,85,105,.2)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-600)', width: 16, textAlign: 'right' }}>{i + 1}</span>
              <span>{teams[name]?.fl || ''}</span>
              <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <div style={{ width: 60, flexShrink: 0 }}>
                <div style={{ height: 4, background: 'var(--bg-700)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${Math.round(g / maxGoals * 100)}%`, background: 'var(--blue-400)', borderRadius: 2 }} />
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-400)', width: 20, textAlign: 'right', flexShrink: 0 }}>{g}</span>
            </div>
          ))}
        </div>

        {/* Donut */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-200)', marginBottom: 12 }}>
            📈 Distribución resultados
          </h3>
          <div style={{ height: 200 }}>
            <Doughnut data={donutData} options={donutOptions} />
          </div>
        </div>
      </div>

      {/* Top partidos */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-200)', marginBottom: 12 }}>
          🔥 Partidos más goleadores
        </h3>
        {topMatches.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(71,85,105,.2)' }}>
            <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {teams[r.h]?.fl || ''} {r.h}
            </span>
            <span style={{
              background: 'var(--bg-700)', borderRadius: 4, padding: '2px 8px',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>{r.hg}–{r.ag}</span>
            <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
              {r.a} {teams[r.a]?.fl || ''}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', flexShrink: 0, width: 32, textAlign: 'right' }}>{r.tot}⚽</span>
          </div>
        ))}
      </div>
    </div>
  );
}
