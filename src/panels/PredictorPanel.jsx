// src/panels/PredictorPanel.jsx
import React, { useState, useEffect } from 'react';
import { sim } from '../services/poisson.js';
import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import teams from '../data/teams.json';

const TEAM_LIST = Object.keys(teams).sort();
const SCORE_LABELS = ['0', '1', '2', '3', '4', '5+'];

function poissonProb(k, lambda) {
  let r = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) r *= lambda / i;
  return r;
}

function getTopScorelines(lA, lB, n = 6) {
  const scores = [];
  for (let i = 0; i <= 5; i++)
    for (let j = 0; j <= 5; j++)
      scores.push({ h: i, a: j, p: poissonProb(i, lA) * poissonProb(j, lB) });
  return scores.sort((a, b) => b.p - a.p).slice(0, n);
}

function getPOver25(lA, lB) {
  let under = 0;
  for (let i = 0; i <= 2; i++)
    for (let j = 0; j <= 2 - i; j++)
      under += poissonProb(i, lA) * poissonProb(j, lB);
  return 1 - under;
}

function getHeatmapData(lA, lB) {
  const dist = (l) => {
    const p = Array.from({ length: 5 }, (_, k) => poissonProb(k, l));
    p.push(Math.max(0, 1 - p.reduce((s, v) => s + v, 0)));
    return p;
  };
  const pA = dist(lA);
  const pB = dist(lB);
  const cells = [];
  let maxP = 0;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const p = pA[i] * pB[j];
      if (p > maxP) maxP = p;
      cells.push({ i, j, p, result: i > j ? 'h' : i < j ? 'a' : 'd' });
    }
  }
  return { cells, maxP };
}

function getTournamentStats(team, res, resKO) {
  let gf = 0, ga = 0, played = 0;
  const form = [];
  res.forEach(m => {
    if (!m.p || m.hg == null) return;
    const isHome = m.h === team;
    const isAway = m.a === team;
    if (!isHome && !isAway) return;
    const tGF = isHome ? m.hg : m.ag;
    const tGA = isHome ? m.ag : m.hg;
    gf += tGF; ga += tGA; played++;
    form.push(tGF > tGA ? 'W' : tGF === tGA ? 'D' : 'L');
  });
  resKO.forEach(m => {
    if (!m.p || m.hg == null) return;
    if (!teams[m.h] || !teams[m.a]) return;
    const isHome = m.h === team;
    const isAway = m.a === team;
    if (!isHome && !isAway) return;
    const tGF = isHome ? m.hg : m.ag;
    const tGA = isHome ? m.ag : m.hg;
    gf += tGF; ga += tGA; played++;
    form.push(tGF > tGA ? 'W' : tGF === tGA ? 'D' : 'L');
  });
  return { played, gf, ga, gd: gf - ga, form: form.slice(-5) };
}

function KpiCard({ value, label, color = 'var(--blue-400)' }) {
  return (
    <div className="card" style={{ padding: '12px 16px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function PredictorPanel() {
  const { res, resKO } = useMatchStore();
  const { predH, predA } = useUiStore();

  const [h, setH] = useState(predH || 'Brasil');
  const [a, setA] = useState(predA || 'Argentina');

  useEffect(() => {
    if (predH && teams[predH]) setH(predH);
    if (predA && teams[predA]) setA(predA);
  }, [predH, predA]);

  const pr = (teams[h] && teams[a]) ? sim(h, a, teams) : null;

  const pBTTS = pr ? (1 - poissonProb(0, pr.lA)) * (1 - poissonProb(0, pr.lB)) : 0;
  const pOver25 = pr ? getPOver25(pr.lA, pr.lB) : 0;
  const top6 = pr ? getTopScorelines(pr.lA, pr.lB) : [];
  const heatmap = pr ? getHeatmapData(pr.lA, pr.lB) : null;

  const statsH = getTournamentStats(h, res, resKO);
  const statsA = getTournamentStats(a, res, resKO);

  const select = (val, setter) => (
    <select value={val} onChange={e => setter(e.target.value)} style={{
      background: 'var(--bg-800)', color: 'var(--text-50)', border: '1px solid var(--bg-700)',
      borderRadius: 'var(--r-sm)', padding: '6px 10px', fontSize: 13,
    }}>
      {TEAM_LIST.map(t => <option key={t} value={t}>{teams[t]?.fl} {t}</option>)}
    </select>
  );

  const SectionTitle = ({ children }) => (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-500)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
    }}>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {select(h, setH)}
        <span style={{ color: 'var(--text-400)' }}>vs</span>
        {select(a, setA)}
      </div>

      {pr && (
        <>
          {/* Row 1: Win / Draw / Loss */}
          <div style={{ display: 'flex', gap: 8 }}>
            <KpiCard value={`${(pr.pW * 100).toFixed(1)}%`} label={`${h} gana`} color="var(--blue-400)" />
            <KpiCard value={`${(pr.pD * 100).toFixed(1)}%`} label="Empate" color="var(--text-400)" />
            <KpiCard value={`${(pr.pL * 100).toFixed(1)}%`} label={`${a} gana`} color="var(--red-400)" />
          </div>

          {/* Row 2: xG + BTTS + Over 2.5 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <KpiCard value={pr.lA.toFixed(2)} label={`xG ${h}`} color="var(--blue-400)" />
            <KpiCard value={pr.lB.toFixed(2)} label={`xG ${a}`} color="var(--red-400)" />
            <KpiCard value={`${(pBTTS * 100).toFixed(1)}%`} label="Ambos anotan" color="var(--green-400)" />
            <KpiCard value={`${(pOver25 * 100).toFixed(1)}%`} label="+2.5 goles" color="var(--gold)" />
          </div>

          {/* Top 6 scorelines */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <SectionTitle>Resultados más probables</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {top6.map(({ h: gh, a: ga, p }, idx) => {
                const pct = (p * 100).toFixed(1);
                const barColor = gh > ga ? 'var(--blue)' : gh === ga ? 'var(--gray)' : 'var(--red)';
                const maxP = top6[0].p;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, textAlign: 'center', fontWeight: 700, fontSize: 14, color: 'var(--text-50)', flexShrink: 0 }}>
                      {gh}–{ga}
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-700)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(p / maxP) * 100}%`, height: '100%', background: barColor, borderRadius: 99 }} />
                    </div>
                    <div style={{ width: 42, textAlign: 'right', fontSize: 12, color: 'var(--text-400)', flexShrink: 0 }}>
                      {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heat map 6×6 */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <SectionTitle>Mapa de resultados</SectionTitle>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '28px repeat(6, 1fr)',
              gap: 2,
            }}>
              {/* Header row */}
              <div style={{ fontSize: 9, color: 'var(--text-500)', textAlign: 'right', paddingRight: 4, alignSelf: 'flex-end', paddingBottom: 4 }}>
                L\V
              </div>
              {SCORE_LABELS.map(l => (
                <div key={'ch-' + l} style={{
                  textAlign: 'center', fontSize: 10, fontWeight: 700,
                  color: 'var(--red-400)', paddingBottom: 4,
                }}>
                  {l}
                </div>
              ))}

              {/* Data rows */}
              {SCORE_LABELS.map((rowLabel, i) => (
                <React.Fragment key={i}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    paddingRight: 4, fontSize: 10, fontWeight: 700, color: 'var(--blue-400)',
                  }}>
                    {rowLabel}
                  </div>
                  {Array.from({ length: 6 }, (_, j) => {
                    const cell = heatmap.cells[i * 6 + j];
                    const rel = cell.p / heatmap.maxP;
                    const alpha = 0.12 + rel * 0.78;
                    const bg =
                      cell.result === 'h' ? `rgba(37,99,235,${alpha})`
                      : cell.result === 'a' ? `rgba(220,38,38,${alpha})`
                      : `rgba(202,138,4,${alpha})`;
                    return (
                      <div key={j} style={{
                        background: bg,
                        borderRadius: 3,
                        padding: '6px 1px',
                        textAlign: 'center',
                        fontSize: 9,
                        fontWeight: rel > 0.4 ? 700 : 400,
                        color: rel > 0.4 ? 'var(--text-50)' : 'var(--text-400)',
                        lineHeight: 1.2,
                      }}>
                        {(cell.p * 100).toFixed(1)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10, color: 'var(--text-400)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(37,99,235,0.7)', display: 'inline-block' }} />
                {h} gana
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(202,138,4,0.7)', display: 'inline-block' }} />
                Empate
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(220,38,38,0.7)', display: 'inline-block' }} />
                {a} gana
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-500)' }}>valores en %</span>
            </div>
          </div>

          {/* Team comparison */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <SectionTitle>Comparación de equipos</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: 'var(--text-500)', fontWeight: 600, paddingBottom: 10, paddingRight: 12, width: '40%' }}>
                    Atributo
                  </th>
                  <th style={{ textAlign: 'center', color: 'var(--blue-400)', fontWeight: 700, paddingBottom: 10, paddingRight: 12 }}>
                    {teams[h]?.fl} {h}
                  </th>
                  <th style={{ textAlign: 'center', color: 'var(--red-400)', fontWeight: 700, paddingBottom: 10 }}>
                    {teams[a]?.fl} {a}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Klement', vH: pr.kA.toFixed(3), vA: pr.kB.toFixed(3), betterH: pr.kA >= pr.kB },
                  {
                    label: 'FIFA Ranking',
                    vH: `#${teams[h]?.r ?? '—'}`, vA: `#${teams[a]?.r ?? '—'}`,
                    betterH: (teams[h]?.r ?? 999) <= (teams[a]?.r ?? 999),
                  },
                  { label: 'xG esperados', vH: pr.lA.toFixed(2), vA: pr.lB.toFixed(2), betterH: pr.lA >= pr.lB },
                ].map(({ label, vH, vA, betterH }) => (
                  <tr key={label} style={{ borderTop: '1px solid var(--bg-700)' }}>
                    <td style={{ padding: '8px 12px 8px 0', color: 'var(--text-400)' }}>{label}</td>
                    <td style={{ padding: '8px 12px 8px 0', textAlign: 'center', fontWeight: 700, color: betterH ? 'var(--text-50)' : 'var(--text-500)' }}>{vH}</td>
                    <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: 700, color: !betterH ? 'var(--text-50)' : 'var(--text-500)' }}>{vA}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tournament stats */}
          {(statsH.played > 0 || statsA.played > 0) && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <SectionTitle>Estadísticas del torneo</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { tn: h, stats: statsH, color: 'var(--blue-400)' },
                  { tn: a, stats: statsA, color: 'var(--red-400)' },
                ].map(({ tn, stats, color }) => (
                  <div key={tn}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      {teams[tn]?.fl} {tn}
                    </div>
                    {stats.played === 0 ? (
                      <div style={{ color: 'var(--text-500)', fontSize: 12 }}>Sin partidos</div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                          {[
                            { v: stats.played, l: 'PJ', c: 'var(--text-50)' },
                            { v: stats.gf, l: 'GF', c: 'var(--green-400)' },
                            { v: stats.ga, l: 'GC', c: 'var(--red-400)' },
                            {
                              v: (stats.gd > 0 ? '+' : '') + stats.gd, l: 'DG',
                              c: stats.gd > 0 ? 'var(--gold)' : stats.gd < 0 ? 'var(--red-400)' : 'var(--text-400)',
                            },
                          ].map(({ v, l, c }) => (
                            <div key={l} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-500)' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {stats.form.map((r, i) => (
                            <span key={i} style={{
                              width: 22, height: 22, borderRadius: '50%',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700,
                              background: r === 'W' ? 'var(--green)' : r === 'D' ? 'var(--bg-600)' : 'var(--red)',
                              color: '#fff',
                            }}>{r}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
