import { useState } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import { resolveKOTeam } from '../services/resolvers.js';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';
import gr from '../data/gr.json';

function loadPredictions() {
  try { return JSON.parse(localStorage.getItem('quiniela-preds') || '{}'); } catch { return {}; }
}
function savePredictions(preds) {
  try { localStorage.setItem('quiniela-preds', JSON.stringify(preds)); } catch {}
}

export default function QuinielaPanel() {
  const { res, resKO } = useMatchStore();
  const [preds, setPreds] = useState(loadPredictions);

  const setPred = (id, winner) => {
    const next = { ...preds, [id]: winner };
    setPreds(next);
    savePredictions(next);
  };

  const r32 = koBracket.filter(k => k.rnd === 'R32');
  const played = r32.filter(kb => resKO.find(r => r.id === kb.id)?.p);
  const correct = played.filter(kb => {
    const koM = resKO.find(r => r.id === kb.id);
    const h = resolveKOTeam(kb.sh, res, resKO, koBracket, gr) || kb.sh;
    const a = resolveKOTeam(kb.sa, res, resKO, koBracket, gr) || kb.sa;
    const actualWinner = koM.hg > koM.ag || koM.pens === 'h' ? h : a;
    return preds[kb.id] === actualWinner;
  }).length;

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>👥 Quiniela</h2>
      <p style={{ color: 'var(--text-400)', fontSize: 13, marginBottom: 12 }}>
        Selecciona el ganador de cada partido de R32.
      </p>
      {played.length > 0 && (
        <div style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 16, display: 'inline-block' }}>
          <span style={{ color: 'var(--text-400)', fontSize: 13 }}>Puntos: </span>
          <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 18 }}>{correct}</span>
          <span style={{ color: 'var(--text-500)', fontSize: 13 }}> / {played.length}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {r32.map(kb => {
          const koM = resKO.find(r => r.id === kb.id) || {};
          const h = resolveKOTeam(kb.sh, res, resKO, koBracket, gr) || kb.sh;
          const a = resolveKOTeam(kb.sa, res, resKO, koBracket, gr) || kb.sa;
          const pred = preds[kb.id];
          const isPlayed = koM.p;
          const actualWinner = isPlayed ? (koM.hg > koM.ag || koM.pens === 'h' ? h : a) : null;
          const isCorrect = pred && actualWinner && pred === actualWinner;

          return (
            <div key={kb.id} style={{
              background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '10px 14px',
              border: `1px solid ${isCorrect ? 'var(--green)' : pred && isPlayed ? 'var(--red)' : 'var(--bg-700)'}`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => !isPlayed && setPred(kb.id, h)} style={{
                  flex: 1, padding: '6px', borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: isPlayed ? 'default' : 'pointer', fontSize: 12,
                  background: pred === h ? 'var(--blue)' : 'var(--bg-700)',
                  color: pred === h ? '#fff' : 'var(--text-400)',
                  fontWeight: pred === h ? 700 : 400,
                }}>
                  {teams[h]?.fl} {h}
                </button>
                <span style={{ color: 'var(--text-500)', fontSize: 11 }}>vs</span>
                <button onClick={() => !isPlayed && setPred(kb.id, a)} style={{
                  flex: 1, padding: '6px', borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: isPlayed ? 'default' : 'pointer', fontSize: 12,
                  background: pred === a ? 'var(--blue)' : 'var(--bg-700)',
                  color: pred === a ? '#fff' : 'var(--text-400)',
                  fontWeight: pred === a ? 700 : 400,
                }}>
                  {teams[a]?.fl} {a}
                </button>
              </div>
              {isPlayed && (
                <div style={{ fontSize: 11, textAlign: 'center', marginTop: 6, color: isCorrect ? 'var(--green-400)' : 'var(--red-400)' }}>
                  {isCorrect ? '✓ Correcto' : `✗ Ganó: ${actualWinner}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
