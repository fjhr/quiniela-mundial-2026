// src/panels/QuinielaPanel.jsx
import { useState, useEffect } from 'react';

const GP_URL = 'https://golpredictor.fernando-fjhr.workers.dev';
const GP_PID = '0,b2bfbc17-41b4-43c6-a48a-6c2ad5baa31d';

// ── Helpers localStorage ─────────────────────────────────────
function loadGpCreds() {
  return { cookie: localStorage.getItem('gp-cookie') || '', user: localStorage.getItem('gp-user') || '' };
}
function saveGpCreds(cookie, user) {
  try { localStorage.setItem('gp-cookie', cookie); localStorage.setItem('gp-user', user); } catch {}
}
function clearGpCreds() {
  try { localStorage.removeItem('gp-cookie'); localStorage.removeItem('gp-user'); } catch {}
}

// ── parseGPHtml ───────────────────────────────────────────────
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

  const titleEl = doc.querySelector('h1,h2,.titulo,.pool-name');
  const poolName = titleEl ? titleEl.textContent.trim() : '';
  const headers = Array.from(mainTbl.rows[0].cells).map(c => c.textContent.trim());
  const rows = [], hrefs = [], inputFields = [];

  const addRow = (cells) => {
    const texts = cells.map(c => c.textContent.trim());
    if (texts.some(c => c !== '') && !isPager(texts)) {
      rows.push(texts);
      hrefs.push(cells.map(cell => {
        const a = cell.querySelector('a');
        return a ? a.getAttribute('href') : null;
      }));
      inputFields.push(cells.map(cell => {
        const inps = Array.from(cell.querySelectorAll(
          'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"])'
        ));
        if (!inps.length) return null;
        return inps.map(inp => ({
          name: inp.getAttribute('name') || inp.getAttribute('id') || '',
          value: inp.value || '',
          type: inp.getAttribute('type') || 'text',
        }));
      }));
    }
  };

  for (let i = 1; i < mainTbl.rows.length; i++)
    addRow(Array.from(mainTbl.rows[i].cells));

  tables.forEach(tbl => {
    if (tbl === mainTbl || !tbl.rows.length) return;
    if (tbl.rows[0].cells.length !== colCount) return;
    for (let i = 1; i < tbl.rows.length; i++) addRow(Array.from(tbl.rows[i].cells));
  });

  return { headers, rows, hrefs, poolName, inputFields };
}

// ── parseGPStandings ─────────────────────────────────────────
function parseGPStandings(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  if (!tables.length) return null;

  let standTbl = null;
  for (const t of tables) {
    if (t.rows.length < 3) continue;
    const hdrs = Array.from(t.rows[0].cells)
      .map(c => (c.textContent || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
      .join(' ');
    const hasName = /partic|jugad|usuari|nombre|apodo|player/.test(hdrs);
    const hasPts  = /punt|ptos|pts|total|acum|score/.test(hdrs);
    const noMatch = !/partido|match|horario/.test(hdrs);
    const noPron  = !/pronostic|pred/.test(hdrs);
    if (hasName && hasPts && noMatch && noPron) { standTbl = t; break; }
  }
  if (!standTbl) return null;

  const headers = Array.from(standTbl.rows[0].cells).map(c => c.textContent.trim());
  const rows = [];
  for (let i = 1; i < standTbl.rows.length; i++) {
    const cells = Array.from(standTbl.rows[i].cells).map(c => c.textContent.trim());
    if (cells.some(c => c !== '')) rows.push(cells);
  }
  return headers.length && rows.length ? { headers, rows } : null;
}

// ── parseMatchPreds — pronósticos de todos para un partido ───
function parseMatchPreds(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  for (const t of tables) {
    if (t.rows.length < 2) continue;
    const hdrs = Array.from(t.rows[0].cells)
      .map(c => c.textContent.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
      .join(' ');
    if (/partic|jugad|usuari|nombre|apodo/.test(hdrs)) {
      const headers = Array.from(t.rows[0].cells).map(c => c.textContent.trim());
      const rows = [];
      for (let i = 1; i < t.rows.length; i++) {
        const cells = Array.from(t.rows[i].cells).map(c => c.textContent.trim());
        if (cells.some(c => c !== '')) rows.push(cells);
      }
      return headers.length && rows.length ? { headers, rows } : null;
    }
  }
  return null;
}

// ── Render tabla genérica ─────────────────────────────────────
function GpTable({ headers, rows, ptsIdx, highlightRow = -1, medals = false, onRowClick }) {
  const MEDALS = ['🥇', '🥈', '🥉'];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg-700)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '8px 10px', textAlign: i === ptsIdx ? 'right' : i === 0 ? 'center' : 'left',
                fontWeight: 700, whiteSpace: 'nowrap',
                color: i === ptsIdx ? 'var(--gold)' : 'var(--text-400)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isMe = ri === highlightRow;
            return (
              <tr key={ri}
                onClick={onRowClick ? () => onRowClick(ri, row) : undefined}
                style={{
                  borderTop: '1px solid var(--bg-700)',
                  background: isMe ? 'rgba(37,99,235,.12)' : 'transparent',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '6px 10px',
                    textAlign: ci === ptsIdx ? 'right' : ci === 0 ? 'center' : 'left',
                    fontWeight: ci === ptsIdx || isMe ? 700 : 400,
                    color: ci === ptsIdx ? 'var(--gold)' : isMe ? 'var(--text-50)' : 'var(--text-200)',
                    whiteSpace: 'nowrap',
                  }}>
                    {medals && ci === 0 && ri < 3 ? MEDALS[ri] : cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── StandingsView ────────────────────────────────────────────
function StandingsView({ standings, nameIdx, ptsIdx, gpUser }) {
  const [search, setSearch] = useState('');
  const { headers, rows } = standings;

  const norm = s => (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');

  const filtered = rows.filter(r =>
    !search || norm(r[nameIdx]).includes(norm(search))
  );

  // Find user's absolute position (1-based) before search filtering
  const userAbsIdx = rows.findIndex(r => norm(r[nameIdx]) === norm(gpUser));
  const userPos = userAbsIdx >= 0 ? userAbsIdx + 1 : null;
  const isMobile = window.innerWidth < 600;

  const top3 = rows.slice(0, Math.min(3, rows.length));
  const tableRows = search ? filtered : filtered.slice(3);

  const MEDAL = ['🥇', '🥈', '🥉'];
  const MEDAL_COLOR = ['var(--gold)', '#94a3b8', '#cd7f32'];
  const MEDAL_BORDER = ['var(--gold)', 'var(--bg-600)', 'var(--bg-600)'];

  return (
    <div>
      {/* Podio top 3 */}
      {!search && top3.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {top3.map((row, i) => (
            <div key={i} style={{
              flex: '1 1 80px', minWidth: 72,
              background: norm(row[nameIdx]) === norm(gpUser)
                ? 'rgba(37,99,235,.12)' : 'var(--bg-800)',
              borderRadius: 'var(--r-md)', padding: '12px 8px', textAlign: 'center',
              border: `1px solid ${norm(row[nameIdx]) === norm(gpUser) ? 'var(--blue)' : MEDAL_BORDER[i]}`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{MEDAL[i]}</div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-200)',
                wordBreak: 'break-word', lineHeight: 1.3, marginBottom: 4,
              }}>{row[nameIdx]}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: MEDAL_COLOR[i] }}>
                {row[ptsIdx]}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-500)' }}>pts</div>
            </div>
          ))}
        </div>
      )}

      {/* Tu posición badge */}
      {userPos && !search && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
          background: 'rgba(37,99,235,.1)', borderRadius: 'var(--r-sm)',
          padding: '5px 12px', border: '1px solid var(--blue)',
          fontSize: 12,
        }}>
          <span style={{ color: 'var(--blue-400)' }}>📍</span>
          <span style={{ color: 'var(--text-400)' }}>Tu posición:</span>
          <span style={{ fontWeight: 800, color: 'var(--blue-400)', fontSize: 14 }}>#{userPos}</span>
          <span style={{ color: 'var(--text-500)' }}>de {rows.length}</span>
        </div>
      )}

      {/* Búsqueda */}
      <input
        type="text"
        placeholder="Buscar participante..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px', marginBottom: 10,
          background: 'var(--bg-700)', border: '1px solid var(--bg-600)',
          borderRadius: 'var(--r-md)', color: 'var(--text-200)',
          fontSize: 13, boxSizing: 'border-box',
        }}
      />

      {tableRows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-500)', fontSize: 13 }}>
          No se encontraron participantes.
        </div>
      )}

      {/* Vista móvil: tarjetas */}
      {isMobile && tableRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tableRows.map((row, ri) => {
            const absPos = search ? rows.indexOf(row) + 1 : ri + (search ? 1 : 4);
            const isMe = norm(row[nameIdx]) === norm(gpUser);
            return (
              <div key={ri} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 'var(--r-sm)',
                background: isMe ? 'rgba(37,99,235,.1)' : 'var(--bg-800)',
                border: `1px solid ${isMe ? 'var(--blue)' : 'var(--bg-700)'}`,
              }}>
                <span style={{
                  minWidth: 28, textAlign: 'center', fontWeight: 700,
                  color: 'var(--text-500)', fontSize: 13,
                }}>#{absPos}</span>
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: isMe ? 700 : 400,
                  color: isMe ? 'var(--text-50)' : 'var(--text-200)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{row[nameIdx]}</span>
                <span style={{
                  fontWeight: 800, fontSize: 15, color: 'var(--gold)', minWidth: 36, textAlign: 'right',
                }}>{row[ptsIdx]}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista desktop: tabla */}
      {!isMobile && tableRows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-700)' }}>
                {headers.map((h, i) => (
                  <th key={i} style={{
                    padding: '8px 10px',
                    textAlign: i === ptsIdx ? 'right' : i === 0 ? 'center' : 'left',
                    fontWeight: 700, whiteSpace: 'nowrap',
                    color: i === ptsIdx ? 'var(--gold)' : 'var(--text-400)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => {
                const isMe = norm(row[nameIdx]) === norm(gpUser);
                return (
                  <tr key={ri} style={{
                    borderTop: '1px solid var(--bg-700)',
                    background: isMe ? 'rgba(37,99,235,.1)' : 'transparent',
                  }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '6px 10px',
                        textAlign: ci === ptsIdx ? 'right' : ci === 0 ? 'center' : 'left',
                        fontWeight: ci === ptsIdx || isMe ? 700 : 400,
                        color: ci === ptsIdx ? 'var(--gold)' : isMe ? 'var(--text-50)' : 'var(--text-200)',
                        whiteSpace: 'nowrap',
                      }}>{cell}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-500)' }}>
        {filtered.length} participante{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ── Tab 2: GolPredictor ───────────────────────────────────────
function GolPredictorTab() {
  const creds = loadGpCreds();
  const [cookie, setCookie]         = useState(creds.cookie);
  const [gpUser, setGpUser]         = useState(creds.user);
  const [poolData, setPoolData]     = useState(null);
  const [standings, setStandings]   = useState(null);
  const [status, setStatus]         = useState('idle');
  const [standStatus, setStandStatus] = useState('idle');
  const [error, setError]           = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [gpSubTab, setGpSubTab]     = useState('pron');
  // expanded match detail
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [matchDetail, setMatchDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [picks, setPicks]         = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastFetched, setLastFetched] = useState(null);

  // Fix 2: Initialize picks from poolData.inputFields on load
  useEffect(() => {
    if (!poolData?.inputFields) return;
    const initial = {};
    poolData.inputFields.forEach(rowInputs => {
      rowInputs.forEach(cellInps => {
        if (cellInps) cellInps.forEach(inp => {
          if (inp.name) initial[inp.name] = inp.value || '';
        });
      });
    });
    setPicks(initial);
  }, [poolData?.inputFields]);

  const handle401 = () => {
    clearGpCreds(); setCookie(''); setGpUser('');
    setPoolData(null); setStandings(null);
    setStatus('idle'); setStandStatus('idle');
    setError('Sesión expirada. Volvé a iniciar sesión.');
  };

  const fetchPool = async (c) => {
    setStatus('loading'); setError('');
    try {
      const res = await fetch(`${GP_URL}/pool`, { headers: { 'X-GP-Cookie': c, 'X-GP-Pid': GP_PID } });
      if (res.status === 401) { handle401(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseGPHtml(html);
      if (!parsed) { setError('No se pudo leer la tabla del pool.'); setStatus('error'); return; }
      setPoolData(parsed);
      setStatus('done');
      setLastFetched(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setError(e.message || 'Error desconocido'); setStatus('error');
    }
  };

  const fetchStandings = async (c) => {
    setStandStatus('loading');
    try {
      const res = await fetch(`${GP_URL}/standings`, { headers: { 'X-GP-Cookie': c || cookie, 'X-GP-Pid': GP_PID } });
      if (res.status === 401) { handle401(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseGPStandings(html);
      if (!parsed) { setStandStatus('empty'); return; }
      setStandings(parsed);
      setStandStatus('done');
    } catch (e) {
      setStandStatus('error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setStatus('logging'); setError('');
    try {
      const res = await fetch(`${GP_URL}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(`Login falló (HTTP ${res.status})`);
      const data = await res.json();
      if (!data.cookie) throw new Error('No se recibió cookie de sesión');
      saveGpCreds(data.cookie, data.username || username);
      setCookie(data.cookie); setGpUser(data.username || username); setPassword('');
      await fetchPool(data.cookie);
    } catch (e) {
      setError(e.message || 'Error de login'); setStatus('idle');
    }
  };

  const handleLogout = () => {
    clearGpCreds(); setCookie(''); setGpUser('');
    setPoolData(null); setStandings(null);
    setStatus('idle'); setStandStatus('idle'); setError('');
    setExpandedIdx(null); setMatchDetail(null);
  };

  // Expand a row to show all predictions for that match via postback
  const handleRowExpand = async (ri, row) => {
    if (expandedIdx === ri) { setExpandedIdx(null); setMatchDetail(null); return; }
    setExpandedIdx(ri); setMatchDetail(null); setDetailStatus('loading');

    // Find match name from this row (look for partido column)
    const { headers } = poolData;
    let partidoIdx = headers.findIndex(h => /partido|match|encuentro/i.test(h));
    if (partidoIdx < 0) partidoIdx = 2; // fallback: third column
    const matchName = row[partidoIdx] || '';
    const href = poolData.hrefs[ri]?.[partidoIdx] || null;

    try {
      let pbTarget = '', pbArg = '';
      if (href) {
        const m = href.match(/__doPostBack\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\)/i);
        if (m) { pbTarget = m[1]; pbArg = m[2]; }
      }
      const res = await fetch(`${GP_URL}/postback`, {
        method: 'POST',
        headers: { 'X-GP-Cookie': cookie, 'X-GP-Pid': GP_PID, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: pbTarget, argument: pbArg, matchName }),
      });
      if (res.status === 401) { handle401(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const detail = parseMatchPreds(html);
      setMatchDetail(detail);
      setDetailStatus('done');
    } catch {
      setDetailStatus('error');
    }
  };

  const handleSavePicks = async () => {
    // Fix 4: Guard saveStatus to prevent multiple saves
    if (!Object.keys(picks).length || saveStatus === 'saving') return;
    setSaveStatus('saving');
    console.log('[GP save] picks enviados:', picks);
    try {
      const res = await fetch(`${GP_URL}/save-picks`, {
        method: 'POST',
        headers: {
          'X-GP-Cookie': cookie,
          'X-GP-Pid': GP_PID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ picks }),
      });
      if (res.status === 401) { setSaveStatus('idle'); handle401(); return; }
      const data = await res.json();
      if (data.error === 'no-editable-inputs') { setSaveStatus('no-editable-inputs'); return; }
      setSaveStatus(data.ok ? 'ok' : 'error');
      if (data.ok) {
        // Fix 3: Clear picks after successful save
        setPicks({});
        setTimeout(() => {
          setSaveStatus('idle');
          fetchPool(cookie);
        }, 3000);
      }
    } catch {
      setSaveStatus('error');
    }
  };

  // Switch to posiciones: auto-load if needed
  const switchToPos = () => {
    setGpSubTab('pos');
    if (standStatus === 'idle') fetchStandings(cookie);
  };

  // ── Sin sesión → login ────────────────────────────────────
  if (!cookie) {
    return (
      <div style={{ maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌐</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-200)', marginBottom: 6 }}>
            GolPredictor Pool
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-400)' }}>
            Ingresá tus credenciales de golpredictor.com para ver el pool.
          </div>
        </div>

        {error && (
          <div style={{
            color: 'var(--red-400)', fontSize: 13, marginBottom: 14,
            padding: '10px 14px', background: 'rgba(220,38,38,.1)',
            borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--red-400)',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text" placeholder="Usuario" value={username}
            onChange={e => setUsername(e.target.value)} required
            style={{
              padding: '12px 14px', background: 'var(--bg-700)',
              border: '1px solid var(--bg-600)', borderRadius: 'var(--r-md)',
              color: 'var(--text-200)', fontSize: 15,
            }}
          />
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={{
              padding: '12px 14px', background: 'var(--bg-700)',
              border: '1px solid var(--bg-600)', borderRadius: 'var(--r-md)',
              color: 'var(--text-200)', fontSize: 15,
            }}
          />
          <button
            type="submit" disabled={status === 'logging'}
            style={{
              padding: '13px', background: 'var(--blue)', color: '#fff',
              border: 'none', borderRadius: 'var(--r-md)',
              fontWeight: 700, cursor: 'pointer', fontSize: 15,
              opacity: status === 'logging' ? 0.7 : 1, marginTop: 4,
            }}
          >
            {status === 'logging' ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    );
  }

  // Auto-load pool
  if (!poolData && status !== 'loading' && status !== 'error') {
    fetchPool(cookie);
    return <div style={{ color: 'var(--text-400)', padding: 20 }}>Cargando...</div>;
  }
  if (status === 'loading') return <div style={{ color: 'var(--text-400)', padding: 20 }}>Cargando pool...</div>;
  if (status === 'error') return (
    <div>
      <div style={{ color: 'var(--red-400)', marginBottom: 12 }}>{error}</div>
      <button onClick={() => fetchPool(cookie)} style={{ padding: '6px 14px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 13 }}>Reintentar</button>
    </div>
  );

  const { headers, rows } = poolData;
  let ptsIdx = headers.findIndex(h => /punt|ptos|pts|score|total|obten/i.test(h));
  if (ptsIdx === -1) ptsIdx = headers.length - 1;
  let partidoIdx = headers.findIndex(h => /partido|match|encuentro/i.test(h));

  // detect standings column indices
  let sNameIdx = 1, sPtsIdx = -1;
  if (standings) {
    standings.headers.forEach((h, i) => {
      const hn = h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (/partic|jugad|usuari|nombre|apodo/.test(hn)) sNameIdx = i;
      if (sPtsIdx < 0 && /punt|ptos|pts|total|acum/i.test(hn)) sPtsIdx = i;
    });
    if (sPtsIdx < 0) sPtsIdx = standings.headers.length > 1 ? standings.headers.length - 1 : 1;
  }

  const subTabBtn = (id, label, onClick) => (
    <button onClick={onClick || (() => setGpSubTab(id))} style={{
      padding: '6px 14px', fontSize: 12, fontWeight: gpSubTab === id ? 700 : 500,
      background: gpSubTab === id ? 'var(--blue)' : 'none',
      color: gpSubTab === id ? '#fff' : 'var(--text-400)',
      border: gpSubTab === id ? 'none' : '1px solid var(--bg-700)',
      borderRadius: 'var(--r-md)', cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 13, color: 'var(--text-400)' }}>
            Sesión: <strong style={{ color: 'var(--text-200)' }}>{gpUser}</strong>
          </span>
          {lastFetched && (
            <span style={{ fontSize: 10, color: 'var(--text-500)' }}>
              Actualizado a las {lastFetched}
            </span>
          )}
        </div>
        <button onClick={() => fetchPool(cookie)} style={{
          marginLeft: 'auto', padding: '6px 12px', background: 'var(--blue)', color: '#fff',
          border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>↺ Refrescar</button>
        <button onClick={handleLogout} style={{
          padding: '6px 12px', background: 'none', color: 'var(--text-400)',
          border: '1px solid var(--bg-600)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12,
        }}>Salir</button>
      </div>

      {/* Pool KPI banner — visible cuando hay standings */}
      {standStatus === 'done' && standings && (() => {
        const norm = s => (s || '').toLowerCase().trim()
          .normalize('NFD').replace(/\p{Diacritic}/gu, '');
        const userIdx = standings.rows.findIndex(r =>
          norm(r[sNameIdx]) === norm(gpUser)
        );
        const leader = standings.rows[0];
        const kpis = [
          {
            icon: '👥',
            value: standings.rows.length,
            label: 'participantes',
          },
          leader ? {
            icon: '🏆',
            value: leader[sNameIdx],
            label: `${leader[sPtsIdx >= 0 ? sPtsIdx : standings.headers.length - 1]} pts`,
          } : null,
          userIdx >= 0 ? {
            icon: '📍',
            value: `#${userIdx + 1}`,
            label: 'tu posición',
            highlight: true,
          } : null,
        ].filter(Boolean);

        return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {kpis.map((kpi, i) => (
              <div key={i} style={{
                flex: '1 1 70px', minWidth: 70,
                background: kpi.highlight ? 'rgba(37,99,235,.1)' : 'var(--bg-800)',
                border: `1px solid ${kpi.highlight ? 'var(--blue)' : 'var(--bg-700)'}`,
                borderRadius: 'var(--r-md)', padding: '10px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{kpi.icon}</div>
                <div style={{
                  fontSize: 14, fontWeight: 800,
                  color: kpi.highlight ? 'var(--blue-400)' : 'var(--text-200)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{kpi.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-500)', marginTop: 1 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {subTabBtn('pron', `Pronósticos${poolData ? ` · ${rows.length} participantes` : ''}`)}
        {subTabBtn('pos', 'Posiciones', switchToPos)}
      </div>

      {/* Pronósticos tab */}
      {gpSubTab === 'pron' && (
        <div>
          {/* Sección "Mis predicciones pendientes" — solo si hay inputs editables */}
          {(() => {
            const { inputFields } = poolData;
            if (!inputFields) return null;
            // Encontrar filas con al menos un input editable
            const editableRows = inputFields
              .map((rowInputs, ri) => ({ ri, rowInputs }))
              .filter(({ rowInputs }) => rowInputs.some(Boolean));
            if (!editableRows.length) return null;

            return (
              <div style={{
                marginBottom: 20, padding: '14px 14px 10px',
                background: 'var(--bg-800)', borderRadius: 'var(--r-md)',
                border: '1px solid var(--blue)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--bg-700)',
                }}>
                  <span style={{ fontSize: 14 }}>🎯</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-200)' }}>
                    Mis predicciones pendientes
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-500)' }}>
                    · {editableRows.length} partido{editableRows.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {editableRows.map(({ ri, rowInputs }) => {
                    const matchCell = partidoIdx >= 0 ? rows[ri][partidoIdx] : null;
                    const editableCells = rowInputs
                      .map((inps, ci) => ({ ci, inps }))
                      .filter(({ inps }) => inps && inps.length > 0);

                    return (
                      <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {matchCell && (
                          <span style={{
                            fontSize: 12, color: 'var(--blue-400)', fontWeight: 600,
                            flex: '1 1 120px', minWidth: 100,
                          }}>{matchCell}</span>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {editableCells.map(({ ci, inps }) => (
                            <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {inps.length === 2 ? (
                                <>
                                  <input
                                    type="text"
                                    value={picks[inps[0].name] !== undefined ? picks[inps[0].name] : (inps[0].value ?? '')}
                                    onChange={e => setPicks(p => ({ ...p, [inps[0].name]: e.target.value }))}
                                    aria-label="Goles local"
                                    style={{ width: 44, padding: '6px 8px', background: 'var(--bg-700)', border: '1px solid var(--bg-600)', borderRadius: 'var(--r-sm)', color: 'var(--text-200)', fontSize: 14, textAlign: 'center' }}
                                  />
                                  <span style={{ color: 'var(--text-400)', fontWeight: 700 }}>-</span>
                                  <input
                                    type="text"
                                    value={picks[inps[1].name] !== undefined ? picks[inps[1].name] : (inps[1].value ?? '')}
                                    onChange={e => setPicks(p => ({ ...p, [inps[1].name]: e.target.value }))}
                                    aria-label="Goles visitante"
                                    style={{ width: 44, padding: '6px 8px', background: 'var(--bg-700)', border: '1px solid var(--bg-600)', borderRadius: 'var(--r-sm)', color: 'var(--text-200)', fontSize: 14, textAlign: 'center' }}
                                  />
                                </>
                              ) : inps.map((inp, ii) => (
                                <input
                                  key={ii}
                                  type="text"
                                  value={picks[inp.name] !== undefined ? picks[inp.name] : (inp.value ?? '')}
                                  onChange={e => setPicks(p => ({ ...p, [inp.name]: e.target.value }))}
                                  aria-label={inp.name}
                                  style={{ width: 52, padding: '6px 8px', background: 'var(--bg-700)', border: '1px solid var(--bg-600)', borderRadius: 'var(--r-sm)', color: 'var(--text-200)', fontSize: 14, textAlign: 'center' }}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botón guardar + feedback */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  {/* Fix 5: Cursor style reflects disabled state */}
                  <button
                    onClick={handleSavePicks}
                    disabled={saveStatus === 'saving' || !Object.keys(picks).length}
                    style={{
                      padding: '8px 18px', background: 'var(--blue)', color: '#fff',
                      border: 'none', borderRadius: 'var(--r-md)',
                      cursor: (saveStatus === 'saving' || !Object.keys(picks).length) ? 'not-allowed' : 'pointer',
                      fontWeight: 700, fontSize: 13,
                      opacity: (saveStatus === 'saving' || !Object.keys(picks).length) ? 0.6 : 1,
                    }}
                  >
                    {saveStatus === 'saving' ? 'Guardando...' : 'Guardar predicciones'}
                  </button>
                  {saveStatus === 'ok' && (
                    <span style={{ fontSize: 12, color: 'var(--green-400)', fontWeight: 600 }}>
                      ✓ Predicciones guardadas
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span style={{ fontSize: 12, color: 'var(--red-400)' }}>
                      ✗ No se pudo guardar — verificá los valores e intentá de nuevo
                    </span>
                  )}
                  {saveStatus === 'no-editable-inputs' && (
                    <span style={{ fontSize: 12, color: 'var(--text-400)' }}>
                      ⏳ Partidos cerrados — no hay predicciones editables en este momento
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {partidoIdx >= 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-500)', marginBottom: 8 }}>
              Tocá una fila para ver los pronósticos de todos los participantes para ese partido.
            </p>
          )}
          {window.innerWidth < 600 && (
            <div style={{
              fontSize: 10, color: 'var(--text-500)', marginBottom: 6, textAlign: 'right',
            }}>
              ← deslizá horizontalmente para ver más →
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-700)' }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{
                      padding: '8px 10px', textAlign: i === ptsIdx ? 'right' : i === 0 ? 'center' : 'left',
                      fontWeight: 700, whiteSpace: 'nowrap',
                      color: i === ptsIdx ? 'var(--gold)' : 'var(--text-400)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <>
                    <tr key={ri}
                      onClick={partidoIdx >= 0 ? () => handleRowExpand(ri, row) : undefined}
                      style={{
                        borderTop: '1px solid var(--bg-700)',
                        background: expandedIdx === ri ? 'rgba(37,99,235,.1)' : 'transparent',
                        cursor: partidoIdx >= 0 ? 'pointer' : 'default',
                      }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{
                          padding: '6px 10px',
                          textAlign: ci === ptsIdx ? 'right' : ci === 0 ? 'center' : 'left',
                          fontWeight: ci === ptsIdx ? 700 : 400,
                          color: ci === ptsIdx ? 'var(--gold)'
                            : ci === partidoIdx ? 'var(--blue-400)'
                            : 'var(--text-200)',
                          whiteSpace: 'nowrap',
                        }}>
                          {ci === partidoIdx
                            ? <span>{cell}&nbsp;<span style={{ color: 'var(--blue-400)', fontWeight: 700 }}>{expandedIdx === ri ? '▼' : '▶'}</span></span>
                            : cell}
                        </td>
                      ))}
                    </tr>
                    {expandedIdx === ri && (
                      <tr key={`det-${ri}`} style={{ background: 'var(--bg-800)' }}>
                        <td colSpan={headers.length} style={{ padding: '10px 12px', borderTop: '2px solid var(--blue)' }}>
                          {detailStatus === 'loading' && (
                            <div style={{ color: 'var(--text-400)', fontSize: 12 }}>Cargando pronósticos...</div>
                          )}
                          {detailStatus === 'error' && (
                            <div style={{ color: 'var(--red-400)', fontSize: 12 }}>No se pudieron cargar los pronósticos.</div>
                          )}
                          {detailStatus === 'done' && matchDetail && (
                            <GpTable headers={matchDetail.headers} rows={matchDetail.rows} ptsIdx={-1} />
                          )}
                          {detailStatus === 'done' && !matchDetail && (
                            <div style={{ color: 'var(--text-500)', fontSize: 12 }}>Sin datos para este partido.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-500)' }}>
            {rows.length} participantes
          </div>
        </div>
      )}

      {/* Posiciones tab */}
      {gpSubTab === 'pos' && (
        <div>
          {standStatus === 'loading' && <div style={{ color: 'var(--text-400)', padding: 20 }}>Cargando posiciones...</div>}
          {standStatus === 'error'   && (
            <div>
              <div style={{ color: 'var(--red-400)', marginBottom: 10 }}>No se pudo cargar la tabla de posiciones.</div>
              <button onClick={() => fetchStandings()} style={{ padding: '6px 14px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 13 }}>Reintentar</button>
            </div>
          )}
          {standStatus === 'empty' && (
            <div style={{ color: 'var(--text-400)', textAlign: 'center', padding: 30 }}>
              No se encontró tabla de posiciones en este pool.
            </div>
          )}
          {standStatus === 'done' && standings && (
            <StandingsView
              standings={standings}
              nameIdx={sNameIdx}
              ptsIdx={sPtsIdx >= 0 ? sPtsIdx : standings.headers.length - 1}
              gpUser={gpUser}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────
export default function QuinielaPanel() {
  return <GolPredictorTab />;
}
