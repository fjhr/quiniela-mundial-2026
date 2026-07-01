// src/panels/QuinielaPanel.jsx
import { useState } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import { resolveKOTeam } from '../services/resolvers.js';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';
import gr from '../data/gr.json';

const GP_URL = 'https://golpredictor.fernando-fjhr.workers.dev';
const GP_PID = '0,b2bfbc17-41b4-43c6-a48a-6c2ad5baa31d';

// ── Helpers localStorage ─────────────────────────────────────
function loadPredictions() {
  try { return JSON.parse(localStorage.getItem('quiniela-preds') || '{}'); } catch { return {}; }
}
function savePredictions(preds) {
  try { localStorage.setItem('quiniela-preds', JSON.stringify(preds)); } catch {}
}
function loadGpCreds() {
  return {
    cookie: localStorage.getItem('gp-cookie') || '',
    user: localStorage.getItem('gp-user') || '',
  };
}
function saveGpCreds(cookie, user) {
  try { localStorage.setItem('gp-cookie', cookie); localStorage.setItem('gp-user', user); } catch {}
}
function clearGpCreds() {
  try { localStorage.removeItem('gp-cookie'); localStorage.removeItem('gp-user'); } catch {}
}

// ── parseGPHtml — port del portal estático ───────────────────
function parseGPHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  if (!tables.length) return null;
  const mainTbl = tables.reduce((a, b) => b.rows.length > a.rows.length ? b : a);
  if (mainTbl.rows.length < 2) return null;
  const colCount = mainTbl.rows[0].cells.length;

  function isPager(cells) {
    const ne = cells.filter(c => c.trim() !== '');
    if (!ne.length) return true;
    return ne.every(c => /^[\d\s.<>«»…\-]+$/.test(c) && c.trim().length <= 4);
  }

  const headers = Array.from(mainTbl.rows[0].cells).map(c => c.textContent.trim());
  const rows = [];
  for (let i = 1; i < mainTbl.rows.length; i++) {
    const cells = Array.from(mainTbl.rows[i].cells).map(c => c.textContent.trim());
    if (cells.some(c => c !== '') && !isPager(cells)) rows.push(cells);
  }
  // Tablas adicionales de paginación
  tables.forEach(tbl => {
    if (tbl === mainTbl || !tbl.rows.length) return;
    if (tbl.rows[0].cells.length !== colCount) return;
    for (let i = 1; i < tbl.rows.length; i++) {
      const cells = Array.from(tbl.rows[i].cells).map(c => c.textContent.trim());
      if (cells.some(c => c !== '') && !isPager(cells)) rows.push(cells);
    }
  });

  return { headers, rows };
}

// ── Tab 1: Mis Predicciones ───────────────────────────────────
function MisPredictionsTab({ res, resKO }) {
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
      {played.length > 0 && (
        <div style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 16, display: 'inline-block' }}>
          <span style={{ color: 'var(--text-400)', fontSize: 13 }}>Mis puntos: </span>
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
                  color: pred === h ? '#fff' : 'var(--text-400)', fontWeight: pred === h ? 700 : 400,
                }}>
                  {teams[h]?.fl} {h}
                </button>
                <span style={{ color: 'var(--text-500)', fontSize: 11 }}>vs</span>
                <button onClick={() => !isPlayed && setPred(kb.id, a)} style={{
                  flex: 1, padding: '6px', borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: isPlayed ? 'default' : 'pointer', fontSize: 12,
                  background: pred === a ? 'var(--blue)' : 'var(--bg-700)',
                  color: pred === a ? '#fff' : 'var(--text-400)', fontWeight: pred === a ? 700 : 400,
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

// ── Tab 2: GolPredictor ───────────────────────────────────────
function GolPredictorTab() {
  const creds = loadGpCreds();
  const [cookie, setCookie] = useState(creds.cookie);
  const [gpUser, setGpUser] = useState(creds.user);
  const [gpData, setGpData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const fetchPool = async (c) => {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`${GP_URL}/pool`, {
        headers: { 'X-GP-Cookie': c, 'X-GP-Pid': GP_PID },
      });
      if (res.status === 401) {
        clearGpCreds();
        setCookie('');
        setGpUser('');
        setStatus('idle');
        setError('Sesión expirada. Volvé a iniciar sesión.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseGPHtml(html);
      if (!parsed) { setError('No se pudo leer la tabla del pool.'); setStatus('error'); return; }
      setGpData(parsed);
      setStatus('done');
    } catch (e) {
      setError(e.message || 'Error desconocido');
      setStatus('error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('logging');
    setError('');
    try {
      const res = await fetch(`${GP_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(`Login falló (HTTP ${res.status})`);
      const data = await res.json();
      if (!data.cookie) throw new Error('No se recibió cookie de sesión');
      saveGpCreds(data.cookie, data.username || username);
      setCookie(data.cookie);
      setGpUser(data.username || username);
      setPassword('');
      await fetchPool(data.cookie);
    } catch (e) {
      setError(e.message || 'Error de login');
      setStatus('idle');
    }
  };

  const handleLogout = () => {
    clearGpCreds();
    setCookie('');
    setGpUser('');
    setGpData(null);
    setStatus('idle');
    setError('');
  };

  // Sin sesión → formulario de login
  if (!cookie) {
    return (
      <div style={{ maxWidth: 360 }}>
        <p style={{ color: 'var(--text-400)', fontSize: 13, marginBottom: 16 }}>
          Ingresá tus credenciales de golpredictor.com para ver la tabla del pool.
        </p>
        {error && (
          <div style={{ color: 'var(--red-400)', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,.1)', borderRadius: 'var(--r-sm)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text" placeholder="Usuario" value={username}
            onChange={e => setUsername(e.target.value)} required
            style={{ padding: '8px 10px', background: 'var(--bg-700)', border: '1px solid var(--bg-600)', borderRadius: 'var(--r-md)', color: 'var(--text-200)', fontSize: 13 }}
          />
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={{ padding: '8px 10px', background: 'var(--bg-700)', border: '1px solid var(--bg-600)', borderRadius: 'var(--r-md)', color: 'var(--text-200)', fontSize: 13 }}
          />
          <button type="submit" disabled={status === 'logging'} style={{
            padding: '8px', background: 'var(--blue)', color: '#fff', border: 'none',
            borderRadius: 'var(--r-md)', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>
            {status === 'logging' ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    );
  }

  // Con sesión pero sin datos → cargar
  if (!gpData && status !== 'loading' && status !== 'error') {
    fetchPool(cookie);
    return <div style={{ color: 'var(--text-400)', padding: 20 }}>Cargando pool...</div>;
  }

  if (status === 'loading') {
    return <div style={{ color: 'var(--text-400)', padding: 20 }}>Cargando pool...</div>;
  }

  if (status === 'error') {
    return (
      <div>
        <div style={{ color: 'var(--red-400)', marginBottom: 12 }}>{error}</div>
        <button onClick={() => fetchPool(cookie)} style={{ padding: '6px 14px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 13 }}>
          Reintentar
        </button>
      </div>
    );
  }

  // Tabla del pool
  const { headers, rows } = gpData;
  // Detectar columna de puntos por nombre
  let ptsIdx = headers.findIndex(h => /punt|ptos|pts|score|total|obten/i.test(h));
  if (ptsIdx === -1) ptsIdx = headers.length - 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-400)' }}>Sesión: <strong style={{ color: 'var(--text-200)' }}>{gpUser}</strong></span>
        <button onClick={() => fetchPool(cookie)} style={{
          marginLeft: 'auto', padding: '5px 12px', background: 'var(--blue)', color: '#fff',
          border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>↺ Actualizar</button>
        <button onClick={handleLogout} style={{
          padding: '5px 12px', background: 'none', color: 'var(--text-400)',
          border: '1px solid var(--bg-600)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12,
        }}>Cerrar sesión</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-700)', color: 'var(--text-400)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '8px 10px', textAlign: i === ptsIdx ? 'center' : 'left',
                  fontWeight: 700, whiteSpace: 'nowrap',
                  color: i === ptsIdx ? 'var(--gold)' : 'var(--text-400)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderTop: '1px solid var(--bg-700)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '6px 10px', textAlign: ci === ptsIdx ? 'center' : 'left',
                    fontWeight: ci === ptsIdx ? 700 : 400,
                    color: ci === ptsIdx ? 'var(--gold)' : 'var(--text-200)',
                    whiteSpace: 'nowrap',
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Panel principal con tabs ──────────────────────────────────
export default function QuinielaPanel() {
  const { res, resKO } = useMatchStore();
  const [tab, setTab] = useState('mis');

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 16px', fontSize: 13, fontWeight: tab === id ? 700 : 500,
        background: tab === id ? 'var(--blue)' : 'none',
        color: tab === id ? '#fff' : 'var(--text-400)',
        border: tab === id ? 'none' : '1px solid var(--bg-700)',
        borderRadius: 'var(--r-md)', cursor: 'pointer',
      }}
    >{label}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabBtn('mis', '👤 Mis predicciones')}
        {tabBtn('gp', '🌐 GolPredictor Pool')}
      </div>
      {tab === 'mis' ? <MisPredictionsTab res={res} resKO={resKO} /> : <GolPredictorTab />}
    </div>
  );
}
