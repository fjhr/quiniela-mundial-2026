// src/panels/GroupsPanel.jsx
import { useState } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import { tbl } from '../services/poisson.js';
import MatchCard from '../components/MatchCard.jsx';
import teams from '../data/teams.json';
import sched from '../data/sched.json';
import gr from '../data/gr.json';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

export default function GroupsPanel() {
  const { res, matchTimes } = useMatchStore();
  const [selectedGroup, setSelectedGroup] = useState('A');

  const standings = tbl(selectedGroup, res, gr);
  const groupMatches = res.filter(m => m.g === selectedGroup);

  return (
    <div>

      {/* Selector de grupo */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {GROUPS.map(g => (
          <button key={g} onClick={() => setSelectedGroup(g)} style={{
            padding: '4px 12px', borderRadius: 'var(--r-sm)', border: 'none',
            cursor: 'pointer', fontWeight: 600,
            background: selectedGroup === g ? 'var(--blue)' : 'var(--bg-800)',
            color: selectedGroup === g ? '#fff' : 'var(--text-400)',
          }}>
            {g}
          </button>
        ))}
      </div>

      {/* Tabla de posiciones */}
      <div style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', marginBottom: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 320 }}>
          <thead>
            <tr style={{ background: 'var(--bg-700)', color: 'var(--text-400)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Equipo</th>
              <th style={{ padding: '8px 4px', textAlign: 'center' }}>PJ</th>
              <th style={{ padding: '8px 4px', textAlign: 'center' }}>Pts</th>
              <th style={{ padding: '8px 4px', textAlign: 'center' }}>GD</th>
              <th style={{ padding: '8px 4px', textAlign: 'center' }}>GF</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr key={row.t} style={{
                borderTop: '1px solid var(--bg-700)',
                background: i < 2 ? 'rgba(37,99,235,.08)' : 'transparent',
              }}>
                <td style={{ padding: '8px 12px', color: 'var(--text-400)' }}>
                  {i < 2 ? <span style={{ color: 'var(--green-400)' }}>●</span> : i === 2 ? <span style={{ color: 'var(--gold)' }}>●</span> : ''}
                  {' '}{i + 1}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ marginRight: 6 }}>{teams[row.t]?.fl}</span>{row.t}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-400)' }}>{row.j}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700 }}>{row.pts}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center', color: row.gd >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>{row.gd > 0 ? '+' : ''}{row.gd}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-400)' }}>{row.gf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Partidos del grupo */}
      <h3 style={{ fontSize: 13, color: 'var(--text-400)', marginBottom: 10 }}>Partidos · Grupo {selectedGroup}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groupMatches.map(m => (
          <MatchCard key={m.id} match={m} teams={teams} matchTimes={matchTimes} sched={sched} />
        ))}
      </div>
    </div>
  );
}
