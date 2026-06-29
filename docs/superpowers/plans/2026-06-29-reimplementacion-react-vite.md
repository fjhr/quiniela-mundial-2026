# Reimplementación Portal Quiniela Mundial 2026 — React + Vite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el portal de quiniela desde un único `index.html` de 4392 líneas a una arquitectura React 18 + Vite con separación de datos, servicios, store y componentes lazy-loaded.

**Architecture:** JSON estáticos en `src/data/` como fuente de verdad. Zustand para estado global en runtime. Servicios puros (sin React) para toda la lógica de negocio. Paneles lazy-loaded con `React.lazy()` excepto CalendarPanel (panel inicial). ESPN sync diferido 1200ms para no bloquear primer render.

**Tech Stack:** React 18, Vite 5, Zustand 4, react-chartjs-2 5, Chart.js 4.4, Vitest (tests), CSS Modules.

## Global Constraints

- Sin TypeScript — JS puro en todos los archivos
- React 18 con Concurrent Mode — usar `createRoot` en main.jsx
- Base URL de Vite: `/quiniela-mundial-2026/`
- Deploy target: GitHub Pages desde rama `main` via GitHub Action
- Todos los servicios en `src/services/` son funciones puras — sin imports de React, sin efectos secundarios
- CSS: mantener variables CSS actuales (`--bg-950`, `--blue`, etc.) — no cambiar la paleta
- Tema claro/oscuro via `data-theme="light"` en `<html>` — igual que el original
- ESPN sync usa offset UTC-5 fijo para convertir timestamps (no `new Date().getTimezoneOffset()`)
- `localStorage` solo persiste `match-times` (MATCH_TIMES) y `theme`

---

## Mapa de Archivos

```
index.html                          # Shell mínimo (reemplaza al original)
vite.config.js                      # base, plugins, test config
package.json
.github/workflows/deploy.yml        # GitHub Pages auto-deploy

src/
  main.jsx                          # createRoot, monta <App/>
  App.jsx                           # Layout, Sidebar, panel routing, ESPN sync
  index.css                         # Variables CSS globales + reset

  data/
    init.json                       # Array[72] partidos grupos — extraído de INIT const
    ko-bracket.json                 # Array[32] entradas KO — extraído de KO_BRACKET
    sched.json                      # Object{id→{dt,v}} — extraído de SCHED
    teams.json                      # Object{name→{fl,elo,att,def,kl}} — extraído de T
    venues.json                     # Object{code→{n,city,flag,cc}} — extraído de VENUES

  services/
    poisson.js                      # sim(), tbl(), klScore()
    resolvers.js                    # resolveKOTeam(), mapName(), fmtMatchDT()
    espn.js                         # fetchFromESPN(), applyESPNTimes(), syncKnockout()
    montecarlo.js                   # runMonteCarlo()

  store/
    matchStore.js                   # Zustand: res, resKO, matchTimes + acciones
    uiStore.js                      # Zustand: activePanel, calFilter, theme, etc.

  components/
    Spinner.jsx                     # Fallback de Suspense
    TeamFlag.jsx                    # Bandera + nombre
    ScoreBadge.jsx                  # Marcador con estado
    MatchCard.jsx                   # Tarjeta de partido
    KlementBar.jsx                  # Barra de probabilidad
    FilterBar.jsx                   # Barra de filtros
    Toast.jsx                       # Notificación flotante
    Sidebar.jsx / Sidebar.module.css

  panels/
    CalendarPanel.jsx               # Carga inmediata
    GroupsPanel.jsx                 # lazy
    EliminatoriaPanel.jsx           # lazy
    BracketPanel.jsx                # lazy
    PredictorPanel.jsx              # lazy (Chart.js)
    H2HPanel.jsx                    # lazy (Chart.js)
    KlementPanel.jsx                # lazy (Chart.js)
    EscenariosPanel.jsx             # lazy (Web Worker)
    QuinielaPanel.jsx               # lazy

  workers/
    montecarlo.worker.js            # Web Worker handler

public/
  manifest.json                     # PWA (copiado de raíz)
  icon.svg                          # (copiado de raíz)
  sw.js                             # Service Worker (copiado de raíz)
```

---

## Fase 1: Setup del Proyecto

### Task 1: Inicializar proyecto Vite + React + instalar dependencias

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx` (stub)
- Create: `src/index.css` (variables CSS)

**Interfaces:**
- Produces: servidor de desarrollo en `http://localhost:5173/quiniela-mundial-2026/`

- [ ] **Step 1: Crear package.json**

```json
{
  "name": "quiniela-mundial-2026",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.2",
    "react-chartjs-2": "^5.2.0",
    "chart.js": "^4.4.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "vitest": "^2.0.5",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Crear vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/quiniela-mundial-2026/',
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
});
```

- [ ] **Step 3: Crear src/test-setup.js**

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Crear index.html (shell mínimo)**

```html
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mundial FIFA 2026 — Portal Predictivo</title>
  <link rel="manifest" href="/quiniela-mundial-2026/manifest.json" />
  <link rel="icon" href="/quiniela-mundial-2026/icon.svg" type="image/svg+xml" />
  <meta name="theme-color" content="#0f172a" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 5: Crear src/main.jsx**

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Crear src/App.jsx (stub)**

```jsx
export default function App() {
  return <div style={{ color: 'white', padding: 20 }}>Mundial 2026 — cargando...</div>;
}
```

- [ ] **Step 7: Crear src/index.css con variables CSS del portal original**

```css
:root {
  --bg-950: #020617; --bg-900: #0f172a; --bg-800: #1e293b; --bg-700: #334155; --bg-600: #475569;
  --text-50: #f8fafc; --text-200: #e2e8f0; --text-400: #94a3b8; --text-500: #64748b; --text-600: #475569;
  --blue: #2563eb; --blue-400: #60a5fa; --blue-700: #1d4ed8;
  --gold: #f59e0b; --gold-300: #fcd34d;
  --green: #16a34a; --green-400: #4ade80;
  --red: #dc2626; --red-400: #f87171;
  --gray: #6b7280;
  --sidebar-w: 224px; --sidebar-cw: 58px;
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-xl: 16px;
  --hdr-h: 54px;
}
[data-theme="light"] {
  --bg-950: #f8fafc; --bg-900: #f1f5f9; --bg-800: #e2e8f0; --bg-700: #cbd5e1; --bg-600: #94a3b8;
  --text-50: #0f172a; --text-200: #1e293b; --text-400: #475569; --text-500: #64748b; --text-600: #94a3b8;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg-950);
  color: var(--text-50);
  min-height: 100vh;
}
```

- [ ] **Step 8: Instalar dependencias**

```bash
npm install
```

Expected: `node_modules/` creado, sin errores.

- [ ] **Step 9: Verificar dev server**

```bash
npm run dev
```

Expected: `http://localhost:5173/quiniela-mundial-2026/` muestra "Mundial 2026 — cargando..." en fondo oscuro.

- [ ] **Step 10: Copiar archivos PWA a public/**

```bash
cp manifest.json public/
cp icon.svg public/
cp sw.js public/
```

- [ ] **Step 11: Commit**

```bash
git add package.json vite.config.js index.html src/ public/
git commit -m "feat: inicializar proyecto React + Vite (fase 1 setup)"
```

---

### Task 2: Extraer datos a archivos JSON

**Files:**
- Create: `src/data/init.json`
- Create: `src/data/ko-bracket.json`
- Create: `src/data/sched.json`
- Create: `src/data/teams.json`
- Create: `src/data/venues.json`

**Interfaces:**
- Produces: 5 archivos JSON válidos importables via `import data from './data/init.json'`

- [ ] **Step 1: Extraer init.json desde index.html**

Abrir `index.html` y localizar `const INIT=[`. Copiar el array completo, convertir a JSON válido (las claves deben ir entre comillas dobles, sin trailing commas, sin comentarios). Guardar en `src/data/init.json`.

Estructura esperada:
```json
[
  { "id": 1, "g": "A", "h": "México", "a": "Sudáfrica", "hg": 2, "ag": 0, "p": true, "r": 1 },
  { "id": 2, "g": "A", "h": "Corea del Sur", "a": "Chequia", "hg": 2, "ag": 1, "p": true, "r": 1 },
  ...
]
```

Verificar: `node -e "JSON.parse(require('fs').readFileSync('src/data/init.json','utf8')); console.log('OK')"` → imprime "OK".

- [ ] **Step 2: Extraer ko-bracket.json**

Localizar `var KO_BRACKET=[` en index.html. Copiar y convertir a JSON. Guardar en `src/data/ko-bracket.json`.

```json
[
  { "id": 73, "rnd": "R32", "sh": "2A", "sa": "2B" },
  { "id": 74, "rnd": "R32", "sh": "1C", "sa": "2F" },
  ...
  { "id": 104, "rnd": "Final", "sh": "W101", "sa": "W102" }
]
```

Verificar con: `node -e "const d=require('./src/data/ko-bracket.json'); console.log(d.length)"` → imprime `32`.

- [ ] **Step 3: Extraer sched.json**

Localizar `var SCHED={` en index.html. Las claves del objeto (ids numéricos) deben ir entre comillas en JSON. Guardar en `src/data/sched.json`.

```json
{
  "1":  { "dt": "2026-06-12", "v": "AZT" },
  "73": { "dt": "2026-06-28" },
  "74": { "dt": "2026-06-29" },
  ...
}
```

Verificar: `node -e "const d=require('./src/data/sched.json'); console.log(Object.keys(d).length)"` → imprime `104`.

- [ ] **Step 4: Extraer teams.json**

Localizar `var T={` (o `const T={`) en index.html. Es el objeto con datos por equipo (flags, elo, att, def, kl). Guardar en `src/data/teams.json`.

```json
{
  "México": { "fl": "🇲🇽", "elo": 1850, "att": 1.8, "def": 0.9, "kl": { "titles": 0, "finals": 0, "semis": 1, "qf": 3 } },
  "Brasil": { "fl": "🇧🇷", "elo": 2100, "att": 2.1, "def": 0.7, "kl": { "titles": 5, "finals": 7, "semis": 11, "qf": 14 } },
  ...
}
```

Verificar: `node -e "const d=require('./src/data/teams.json'); console.log(Object.keys(d).length)"` → imprime `48`.

- [ ] **Step 5: Extraer venues.json**

Localizar `var VENUES={` en index.html. Guardar en `src/data/venues.json`.

```json
{
  "AZT": { "n": "Estadio Azteca", "city": "Ciudad de México", "flag": "🇲🇽", "cc": "mx" },
  "NRG": { "n": "NRG Stadium", "city": "Houston", "flag": "🇺🇸", "cc": "us" },
  ...
}
```

- [ ] **Step 6: Commit**

```bash
git add src/data/
git commit -m "feat: extraer datos estáticos a archivos JSON (fase 1 datos)"
```

---

### Task 3: GitHub Action para deploy automático

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: deploy automático a GitHub Pages en cada push a `main`

- [ ] **Step 1: Crear .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Habilitar GitHub Pages con GitHub Actions**

En GitHub → Settings → Pages → Source → seleccionar "GitHub Actions".

- [ ] **Step 3: Commit y verificar deploy**

```bash
git add .github/
git commit -m "ci: agregar GitHub Action para deploy a GitHub Pages"
git push origin main
```

Expected: Action corre en GitHub, deploy exitoso a `https://fjhr.github.io/quiniela-mundial-2026/`. La página muestra "Mundial 2026 — cargando...".

---

## Fase 2: Servicios y Store

### Task 4: Implementar poisson.js con tests

**Files:**
- Create: `src/services/poisson.js`
- Create: `src/services/__tests__/poisson.test.js`

**Interfaces:**
- Produces:
  - `sim(t1, t2, teams)` → `{ pW: number, pD: number, pL: number, expH: number, expA: number }`
  - `tbl(group, res)` → `Array<{ t: string, pts: number, gd: number, gf: number, ga: number, pj: number }>`
  - `klScore(team, teams)` → `number` (0–100)

- [ ] **Step 1: Escribir tests que fallan**

```js
// src/services/__tests__/poisson.test.js
import { describe, it, expect } from 'vitest';
import { sim, tbl, klScore } from '../poisson.js';

const teams = {
  'Brasil': { att: 2.1, def: 0.7, kl: { titles: 5, finals: 7, semis: 11, qf: 14 } },
  'Argentina': { att: 1.9, def: 0.75, kl: { titles: 3, finals: 5, semis: 7, qf: 10 } },
  'Chequia': { att: 1.0, def: 1.1, kl: { titles: 0, finals: 0, semis: 0, qf: 1 } },
};

const res = [
  { id: 1, g: 'A', h: 'Brasil', a: 'Chequia', hg: 3, ag: 0, p: true },
  { id: 2, g: 'A', h: 'Argentina', a: 'Chequia', hg: 2, ag: 1, p: true },
  { id: 3, g: 'A', h: 'Brasil', a: 'Argentina', hg: 1, ag: 1, p: true },
];

describe('sim', () => {
  it('returns probabilities that sum to ~1', () => {
    const { pW, pD, pL } = sim('Brasil', 'Chequia', teams);
    expect(pW + pD + pL).toBeCloseTo(1, 3);
  });
  it('stronger team has higher pW', () => {
    const r = sim('Brasil', 'Chequia', teams);
    expect(r.pW).toBeGreaterThan(r.pL);
  });
  it('returns expH and expA as positive numbers', () => {
    const { expH, expA } = sim('Brasil', 'Chequia', teams);
    expect(expH).toBeGreaterThan(0);
    expect(expA).toBeGreaterThan(0);
  });
});

describe('tbl', () => {
  it('returns correct standings for group A', () => {
    const standings = tbl('A', res);
    expect(standings[0].t).toBe('Brasil');   // 7 pts (2W 1D)
    expect(standings[0].pts).toBe(7);
    expect(standings[1].t).toBe('Argentina'); // 4 pts (1W 1D 1L)
    expect(standings[1].pts).toBe(4);
    expect(standings[2].t).toBe('Chequia');  // 0 pts (2L)
    expect(standings[2].pts).toBe(0);
  });
  it('returns empty array for group with no matches', () => {
    expect(tbl('Z', res)).toEqual([]);
  });
});

describe('klScore', () => {
  it('returns a number between 0 and 100', () => {
    const score = klScore('Brasil', teams);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
  it('Brasil scores higher than Chequia', () => {
    expect(klScore('Brasil', teams)).toBeGreaterThan(klScore('Chequia', teams));
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npm test
```

Expected: FAIL — `sim is not a function` (o similar).

- [ ] **Step 3: Implementar poisson.js**

```js
// src/services/poisson.js

function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonProb(k, lambda) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

export function sim(t1, t2, teams) {
  const la = ((teams[t1]?.att ?? 1.2) * (teams[t2]?.def ?? 1.0)) || 1;
  const lb = ((teams[t2]?.att ?? 1.2) * (teams[t1]?.def ?? 1.0)) || 1;
  let pW = 0, pD = 0, pL = 0;
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const p = poissonProb(i, la) * poissonProb(j, lb);
      if (i > j) pW += p;
      else if (i === j) pD += p;
      else pL += p;
    }
  }
  return { pW, pD, pL, expH: la, expA: lb };
}

export function tbl(group, res) {
  const teams = {};
  res.filter(m => m.g === group && m.p).forEach(m => {
    if (!teams[m.h]) teams[m.h] = { t: m.h, pts: 0, gd: 0, gf: 0, ga: 0, pj: 0 };
    if (!teams[m.a]) teams[m.a] = { t: m.a, pts: 0, gd: 0, gf: 0, ga: 0, pj: 0 };
    const th = teams[m.h], ta = teams[m.a];
    th.pj++; ta.pj++;
    th.gf += m.hg; th.ga += m.ag; th.gd += m.hg - m.ag;
    ta.gf += m.ag; ta.ga += m.hg; ta.gd += m.ag - m.hg;
    if (m.hg > m.ag) { th.pts += 3; }
    else if (m.hg === m.ag) { th.pts += 1; ta.pts += 1; }
    else { ta.pts += 3; }
  });
  return Object.values(teams).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.t.localeCompare(b.t)
  );
}

export function klScore(team, teams) {
  const kl = teams[team]?.kl;
  if (!kl) return 0;
  const raw = (kl.titles ?? 0) * 25 + (kl.finals ?? 0) * 10 +
              (kl.semis ?? 0) * 5 + (kl.qf ?? 0) * 2;
  return Math.min(100, raw);
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test
```

Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/poisson.js src/services/__tests__/poisson.test.js
git commit -m "feat: implementar servicio poisson (sim, tbl, klScore) con tests"
```

---

### Task 5: Implementar resolvers.js con tests

**Files:**
- Create: `src/services/resolvers.js`
- Create: `src/services/__tests__/resolvers.test.js`

**Interfaces:**
- Consumes: `tbl(group, res)` de `poisson.js`
- Produces:
  - `resolveKOTeam(slot, res, resKO, koBracket)` → `string | null`
  - `mapName(espnName, nameMap)` → `string`
  - `fmtMatchDT(id, matchTimes, sched)` → `string` (ej. "29 Jun · 13:00")

- [ ] **Step 1: Escribir tests que fallan**

```js
// src/services/__tests__/resolvers.test.js
import { describe, it, expect } from 'vitest';
import { resolveKOTeam, mapName, fmtMatchDT } from '../resolvers.js';

const res = [
  { id: 1, g: 'C', h: 'Brasil', a: 'Chequia', hg: 3, ag: 0, p: true, r: 1 },
  { id: 2, g: 'C', h: 'Japón', a: 'Australia', hg: 1, ag: 0, p: true, r: 1 },
  { id: 3, g: 'C', h: 'Brasil', a: 'Japón', hg: 2, ag: 1, p: true, r: 2 },
  { id: 4, g: 'C', h: 'Chequia', a: 'Australia', hg: 1, ag: 1, p: true, r: 2 },
  { id: 5, g: 'C', h: 'Brasil', a: 'Australia', hg: 2, ag: 0, p: true, r: 3 },
  { id: 6, g: 'C', h: 'Japón', a: 'Chequia', hg: 1, ag: 0, p: true, r: 3 },
];

const resKO = [
  { id: 73, rnd: 'R32', h: 'Sudáfrica', a: 'Canadá', hg: 0, ag: 1, p: true, pens: '' },
  { id: 74, rnd: 'R32', h: '', a: '', hg: null, ag: null, p: false, pens: '' },
];

const koBracket = [
  { id: 73, rnd: 'R32', sh: '2A', sa: '2B' },
  { id: 74, rnd: 'R32', sh: '1C', sa: '2F' },
  { id: 89, rnd: 'R16', sh: 'W74', sa: 'W77' },
];

describe('resolveKOTeam', () => {
  it('resolves 1C to Brasil (group C winner)', () => {
    expect(resolveKOTeam('1C', res, resKO, koBracket)).toBe('Brasil');
  });
  it('resolves 2C to Japón (group C runner-up)', () => {
    expect(resolveKOTeam('2C', res, resKO, koBracket)).toBe('Japón');
  });
  it('resolves W73 to Canadá (winner of match 73)', () => {
    expect(resolveKOTeam('W73', res, resKO, koBracket)).toBe('Canadá');
  });
  it('returns null for unresolved W slot (match not played)', () => {
    expect(resolveKOTeam('W74', res, resKO, koBracket)).toBeNull();
  });
  it('returns null for unknown slot', () => {
    expect(resolveKOTeam('X99', res, resKO, koBracket)).toBeNull();
  });
});

describe('mapName', () => {
  const nameMap = { 'Brazil': 'Brasil', 'Japan': 'Japón' };
  it('maps known ESPN name to Spanish', () => {
    expect(mapName('Brazil', nameMap)).toBe('Brasil');
  });
  it('returns original name if not in map', () => {
    expect(mapName('México', nameMap)).toBe('México');
  });
});

describe('fmtMatchDT', () => {
  const sched = { '74': { dt: '2026-06-29' } };
  it('returns formatted date from SCHED when no matchTime', () => {
    const result = fmtMatchDT(74, {}, sched);
    expect(result).toContain('Jun');
  });
  it('returns time when matchTime is available', () => {
    const matchTimes = { 74: '2026-06-29T18:00:00Z' };
    const result = fmtMatchDT(74, matchTimes, sched);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implementar resolvers.js**

```js
// src/services/resolvers.js
import { tbl } from './poisson.js';

export function resolveKOTeam(slot, res, resKO, koBracket) {
  // Slots de grupo: '1A', '2B', '3C'
  if (/^1[A-L]$/.test(slot)) return tbl(slot[1], res)[0]?.t || null;
  if (/^2[A-L]$/.test(slot)) return tbl(slot[1], res)[1]?.t || null;
  if (/^3[A-L]$/.test(slot)) return tbl(slot[1], res)[2]?.t || null;

  // Winner: 'W73', 'W74', ...
  if (slot.startsWith('W')) {
    const id = parseInt(slot.slice(1));
    const m = resKO.find(k => k.id === id);
    if (!m || !m.p) return null;
    if (m.hg > m.ag || m.pens === 'h') return m.h;
    if (m.ag > m.hg || m.pens === 'a') return m.a;
    return null;
  }

  // Loser: 'L101', 'L102' (3er lugar)
  if (slot.startsWith('L')) {
    const id = parseInt(slot.slice(1));
    const m = resKO.find(k => k.id === id);
    if (!m || !m.p) return null;
    if (m.hg > m.ag || m.pens === 'h') return m.a;
    if (m.ag > m.hg || m.pens === 'a') return m.h;
    return null;
  }

  return null;
}

export function mapName(espnName, nameMap) {
  return nameMap[espnName] || espnName;
}

export function fmtMatchDT(id, matchTimes, sched) {
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  if (matchTimes[id]) {
    const d = new Date(matchTimes[id]);
    return `${d.getDate()} ${MESES[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  const s = sched[id] || sched[String(id)];
  if (!s) return '';
  const d = new Date(s.dt + 'T12:00:00Z');
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test
```

Expected: PASS — 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/resolvers.js src/services/__tests__/resolvers.test.js
git commit -m "feat: implementar resolvers (resolveKOTeam, mapName, fmtMatchDT) con tests"
```

---

### Task 6: Implementar espn.js

**Files:**
- Create: `src/services/espn.js`

**Interfaces:**
- Consumes: `mapName()` de `resolvers.js`
- Produces:
  - `fetchFromESPN()` → `Promise<Array>` (array de eventos ESPN)
  - `applyESPNTimes(events, sched)` → `{ matchTimes: Object, changed: boolean }`
  - `syncKnockout(events, resKO, nameMap)` → `Array<{ id, hg, ag, p, pens }>` (updates a aplicar)

- [ ] **Step 1: Implementar espn.js**

No hay tests unitarios para fetch — se prueba manualmente en el navegador vía sync button.

```js
// src/services/espn.js
import { mapName } from './resolvers.js';

const ESPN_SLUGS = ['fifa.world', 'fifa.worldcup', 'fifa.worldcup.2026'];
const ESPN_BASES = [
  'https://site.api.espn.com/apis/site/v2/sports/soccer',
  'https://site.api.espn.com/apis/v2/sports/soccer',
];

export async function fetchFromESPN() {
  const dates = '20260611-20260726';
  for (const slug of ESPN_SLUGS) {
    for (const base of ESPN_BASES) {
      try {
        const url = `${base}/${slug}/scoreboard?dates=${dates}&limit=200`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const events = data.events || [];
        if (events.length) return events;
      } catch { continue; }
    }
  }
  throw new Error('ESPN no disponible');
}

// Offset fijo UTC-5 (CDT — venues América) para evitar cruces de medianoche UTC
function toUTC5Date(isoString) {
  const kd = new Date(new Date(isoString).getTime() - 5 * 3600000);
  return kd.getUTCFullYear() + '-' +
    String(kd.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(kd.getUTCDate()).padStart(2, '0');
}

export function applyESPNTimes(events, sched) {
  const matchTimes = {};

  // Primera pasada: partidos de grupos por nombre de equipo
  events.forEach(ev => {
    const comp = (ev.competitions || [])[0] || {};
    const comps = comp.competitors || [];
    const hComp = comps.find(c => c.homeAway === 'home') || comps[0];
    const aComp = comps.find(c => c.homeAway === 'away') || comps[1];
    if (!hComp || !aComp) return;
    const dt = ev.date || comp.date || '';
    if (!dt) return;
    // Guardamos el timestamp indexado por evento para la segunda pasada
    ev._dt = dt;
  });

  // Segunda pasada: asignar horarios a partidos KO por fecha local CDT
  const byDate = {};
  events.forEach(ev => {
    const dt = ev._dt || '';
    if (!dt) return;
    const day = toUTC5Date(dt);
    if (!byDate[day]) byDate[day] = [];
    byDate[day].push(dt);
  });
  Object.values(byDate).forEach(arr => arr.sort());

  const schedByDate = {};
  Object.entries(sched).forEach(([sid, s]) => {
    const id = parseInt(sid);
    if (id < 73 || !s?.dt) return;
    if (!schedByDate[s.dt]) schedByDate[s.dt] = [];
    schedByDate[s.dt].push(id);
  });
  Object.values(schedByDate).forEach(arr => arr.sort((a, b) => a - b));

  let changed = false;
  Object.entries(schedByDate).forEach(([d, ids]) => {
    const evTimes = byDate[d] || [];
    ids.forEach((id, i) => {
      if (evTimes[i]) { matchTimes[id] = evTimes[i]; changed = true; }
    });
  });

  return { matchTimes, changed };
}

export function syncKnockout(events, resKO, nameMap) {
  const updates = [];
  events.forEach(ev => {
    const comp = (ev.competitions || [])[0] || {};
    const comps = comp.competitors || [];
    if (!comp.status?.type?.completed) return;
    const hComp = comps.find(c => c.homeAway === 'home') || comps[0];
    const aComp = comps.find(c => c.homeAway === 'away') || comps[1];
    if (!hComp || !aComp) return;
    const hName = mapName(hComp.team?.name || hComp.team?.shortName || '', nameMap);
    const aName = mapName(aComp.team?.name || aComp.team?.shortName || '', nameMap);
    const hg = parseInt(hComp.score || '0');
    const ag = parseInt(aComp.score || '0');
    const koMatch = resKO.find(k => !k.p && (k.h === hName || k.h === aName));
    if (!koMatch) return;
    const isHome = koMatch.h === hName;
    updates.push({
      id: koMatch.id,
      hg: isHome ? hg : ag,
      ag: isHome ? ag : hg,
      p: true,
      pens: '',
    });
  });
  return updates;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/espn.js
git commit -m "feat: implementar servicio ESPN (fetch, applyESPNTimes, syncKnockout)"
```

---

### Task 7: Implementar montecarlo.js + Web Worker

**Files:**
- Create: `src/services/montecarlo.js`
- Create: `src/workers/montecarlo.worker.js`

**Interfaces:**
- Consumes: `sim()` de `poisson.js`, `resolveKOTeam()` de `resolvers.js`
- Produces:
  - `runMonteCarlo(res, resKO, koBracket, teams, N)` → `{ counts: Object<string, {group,r16,qf,sf,final,champ}>, champion: string }`

- [ ] **Step 1: Implementar montecarlo.js**

```js
// src/services/montecarlo.js
import { sim, tbl } from './poisson.js';

function mcMatch(t1, t2, teams) {
  const { pW } = sim(t1, t2, teams);
  return Math.random() < pW ? t1 : t2;
}

function mcGroup(group, res, teams) {
  // Simula jornadas no jugadas, mantiene resultados reales
  const played = res.filter(m => m.g === group && m.p);
  const unplayed = res.filter(m => m.g === group && !m.p);
  const simRes = [...played];
  unplayed.forEach(m => {
    const { pW, pD } = sim(m.h, m.a, teams);
    const r = Math.random();
    if (r < pW) simRes.push({ ...m, hg: 1, ag: 0, p: true });
    else if (r < pW + pD) simRes.push({ ...m, hg: 0, ag: 0, p: true });
    else simRes.push({ ...m, hg: 0, ag: 1, p: true });
  });
  return tbl(group, simRes);
}

function resolveSimSlot(slot, simGroups, thirds) {
  if (/^1[A-L]$/.test(slot)) return simGroups[slot[1]]?.[0]?.t || '';
  if (/^2[A-L]$/.test(slot)) return simGroups[slot[1]]?.[1]?.t || '';
  if (/^3[A-L]$/.test(slot)) {
    const t = thirds.find(x => x.g === slot[1]);
    return t?.team || '';
  }
  return '';
}

export function runMonteCarlo(res, resKO, koBracket, teams, N = 50000) {
  const GR = {};
  res.forEach(m => { if (!GR[m.g]) GR[m.g] = true; });
  const grpKeys = Object.keys(GR).sort();

  const counts = {};
  // Inicializar contadores
  [...new Set(res.flatMap(m => [m.h, m.a]))].forEach(t => {
    counts[t] = { group: 0, r16: 0, qf: 0, sf: 0, final: 0, champ: 0 };
  });

  for (let n = 0; n < N; n++) {
    const simGroups = {};
    const thirds = [];

    grpKeys.forEach(g => {
      const standings = mcGroup(g, res, teams);
      simGroups[g] = standings;
      if (standings[0]) { counts[standings[0].t] = counts[standings[0].t] || { group:0,r16:0,qf:0,sf:0,final:0,champ:0 }; counts[standings[0].t].group++; }
      if (standings[1]) { counts[standings[1].t] = counts[standings[1].t] || { group:0,r16:0,qf:0,sf:0,final:0,champ:0 }; counts[standings[1].t].group++; }
      if (standings[2]) thirds.push({ team: standings[2].t, pts: standings[2].pts, gd: standings[2].gd, g });
    });

    thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd).slice(0, 8)
      .forEach(x => { if (counts[x.team]) counts[x.team].group++; });

    const rw = {}; // match id → winner

    // R32
    koBracket.filter(k => k.rnd === 'R32').forEach(kb => {
      const koM = resKO.find(k => k.id === kb.id);
      let t1, t2;
      if (koM?.p) {
        t1 = koM.hg >= koM.ag ? koM.h : koM.a;
        t2 = koM.hg >= koM.ag ? koM.a : koM.h;
        rw[kb.id] = koM.hg > koM.ag || koM.pens === 'h' ? koM.h : koM.a;
      } else {
        t1 = resolveSimSlot(kb.sh, simGroups, thirds);
        t2 = resolveSimSlot(kb.sa, simGroups, thirds);
        if (!t1 || !t2) return;
        rw[kb.id] = mcMatch(t1, t2, teams);
      }
      const w = rw[kb.id];
      if (w && counts[w]) counts[w].r16++;
    });

    const resolveRW = slot => {
      if (slot.startsWith('W')) return rw[parseInt(slot.slice(1))] || '';
      return '';
    };

    ['R16','QF','SF'].forEach((rnd, ri) => {
      const stages = ['r16','qf','sf','final'];
      koBracket.filter(k => k.rnd === rnd).forEach(kb => {
        const t1 = resolveRW(kb.sh), t2 = resolveRW(kb.sa);
        if (!t1 || !t2) return;
        rw[kb.id] = mcMatch(t1, t2, teams);
        const w = rw[kb.id];
        if (w && counts[w]) counts[w][stages[ri + 1]]++;
      });
    });

    const fin = koBracket.find(k => k.rnd === 'Final');
    if (fin) {
      const t1 = resolveRW(fin.sh), t2 = resolveRW(fin.sa);
      if (t1 && t2) {
        const w = mcMatch(t1, t2, teams);
        if (counts[w]) { counts[w].champ++; }
        // El finalista perdedor también cuenta como final
        const loser = w === t1 ? t2 : t1;
        if (counts[loser]) counts[loser].final++;
      }
    }
  }

  const champion = Object.entries(counts)
    .sort((a, b) => b[1].champ - a[1].champ)[0]?.[0] || '';

  return { counts, champion };
}
```

- [ ] **Step 2: Implementar montecarlo.worker.js**

```js
// src/workers/montecarlo.worker.js
import { runMonteCarlo } from '../services/montecarlo.js';

self.onmessage = function(e) {
  const { res, resKO, koBracket, teams, N } = e.data;
  const result = runMonteCarlo(res, resKO, koBracket, teams, N);
  self.postMessage(result);
};
```

- [ ] **Step 3: Commit**

```bash
git add src/services/montecarlo.js src/workers/montecarlo.worker.js
git commit -m "feat: implementar Monte Carlo + Web Worker"
```

---

### Task 8: Implementar matchStore.js

**Files:**
- Create: `src/store/matchStore.js`

**Interfaces:**
- Consumes: JSON de `src/data/` (init, ko-bracket), `syncKnockout()` de `espn.js`
- Produces: store Zustand con `res`, `resKO`, `matchTimes` y acciones

- [ ] **Step 1: Implementar matchStore.js**

```js
// src/store/matchStore.js
import { create } from 'zustand';
import initData from '../data/init.json';
import koBracketData from '../data/ko-bracket.json';

function buildInitialResKO(koBracket) {
  return koBracket.map(m => ({
    id: m.id, rnd: m.rnd,
    h: '', a: '', hg: null, ag: null, p: false, pens: '',
  }));
}

export const useMatchStore = create((set, get) => ({
  res: initData.map(r => ({ ...r })),
  resKO: buildInitialResKO(koBracketData),
  matchTimes: (() => {
    try { return JSON.parse(localStorage.getItem('match-times') || '{}'); } catch { return {}; }
  })(),

  applyESPNResults(events, nameMap = {}) {
    const { res } = get();
    let count = 0;
    const newRes = res.map(r => ({ ...r }));
    events.forEach(ev => {
      const comp = (ev.competitions || [])[0] || {};
      if (!comp.status?.type?.completed) return;
      const comps = comp.competitors || [];
      const hComp = comps.find(c => c.homeAway === 'home') || comps[0];
      const aComp = comps.find(c => c.homeAway === 'away') || comps[1];
      if (!hComp || !aComp) return;
      const hName = nameMap[hComp.team?.name] || hComp.team?.name || '';
      const aName = nameMap[aComp.team?.name] || aComp.team?.name || '';
      const idx = newRes.findIndex(r =>
        (r.h === hName && r.a === aName) || (r.h === aName && r.a === hName)
      );
      if (idx === -1) return;
      const hg = parseInt(hComp.score || '0');
      const ag = parseInt(aComp.score || '0');
      if (!newRes[idx].p || newRes[idx].hg !== hg || newRes[idx].ag !== ag) {
        const isSwapped = newRes[idx].h === aName;
        newRes[idx] = { ...newRes[idx], hg: isSwapped ? ag : hg, ag: isSwapped ? hg : ag, p: true };
        count++;
      }
    });
    if (count > 0) set({ res: newRes });
    return count;
  },

  applyKOUpdates(updates) {
    if (!updates.length) return;
    set(state => ({
      resKO: state.resKO.map(k => {
        const upd = updates.find(u => u.id === k.id);
        return upd ? { ...k, ...upd } : k;
      }),
    }));
  },

  setKOTeamNames(koBracket, resolver) {
    // Pre-poblar nombres de equipo en resKO usando resolveKOTeam
    set(state => ({
      resKO: state.resKO.map(k => {
        if (k.p) return k;
        const slot = koBracket.find(s => s.id === k.id);
        if (!slot) return k;
        const h = resolver(slot.sh);
        const a = resolver(slot.sa);
        return { ...k, h: h || k.h, a: a || k.a };
      }),
    }));
  },

  setMatchTimes(times) {
    set({ matchTimes: times });
    try { localStorage.setItem('match-times', JSON.stringify(times)); } catch {}
  },

  updateKOResult(id, hg, ag, pens = '') {
    set(state => ({
      resKO: state.resKO.map(k => k.id === id ? { ...k, hg, ag, p: true, pens } : k),
    }));
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/matchStore.js
git commit -m "feat: implementar matchStore Zustand (res, resKO, matchTimes)"
```

---

### Task 9: Implementar uiStore.js

**Files:**
- Create: `src/store/uiStore.js`

**Interfaces:**
- Produces: store Zustand con `activePanel`, `calFilter`, `selectedGroup`, `koTab`, `theme`, `sidebarCollapsed` y acciones

- [ ] **Step 1: Implementar uiStore.js**

```js
// src/store/uiStore.js
import { create } from 'zustand';

const savedTheme = (() => {
  try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; }
})();
document.documentElement.setAttribute('data-theme', savedTheme);

export const useUiStore = create((set) => ({
  activePanel: 'cal',
  calFilter: 'all',
  selectedGroup: 'A',
  koTab: 'R32',
  sidebarCollapsed: window.innerWidth < 768,
  theme: savedTheme,
  toastMessage: null,
  toastType: 'ok',

  setPanel: (panel) => set({ activePanel: panel }),
  setCalFilter: (filter) => set({ calFilter: filter }),
  setGroup: (group) => set({ selectedGroup: group }),
  setKoTab: (tab) => set({ koTab: tab }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTheme: () => set(s => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    return { theme: next };
  }),
  showToast: (message, type = 'ok') => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => set({ toastMessage: null }), 3500);
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/uiStore.js
git commit -m "feat: implementar uiStore Zustand (panel, filtros, tema)"
```

---

## Fase 3: App Shell y CalendarPanel

### Task 10: Componentes base (Spinner, TeamFlag, ScoreBadge)

**Files:**
- Create: `src/components/Spinner.jsx`
- Create: `src/components/TeamFlag.jsx`
- Create: `src/components/ScoreBadge.jsx`

**Interfaces:**
- Produces:
  - `<Spinner />` — fallback para React.lazy Suspense
  - `<TeamFlag team="Brasil" teams={teamsObj} />` → `<span>🇧🇷 Brasil</span>`
  - `<ScoreBadge hg={2} ag={1} played={true} pens="" />` → `<span>2-1</span>`

- [ ] **Step 1: Crear Spinner.jsx**

```jsx
// src/components/Spinner.jsx
export default function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--bg-700)',
        borderTop: '3px solid var(--blue-400)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Crear TeamFlag.jsx**

```jsx
// src/components/TeamFlag.jsx
export default function TeamFlag({ team, teams, style }) {
  const flag = teams?.[team]?.fl || '🏳️';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <span>{flag}</span>
      <span>{team}</span>
    </span>
  );
}
```

- [ ] **Step 3: Crear ScoreBadge.jsx**

```jsx
// src/components/ScoreBadge.jsx
export default function ScoreBadge({ hg, ag, played, pens }) {
  if (!played || hg === null || ag === null) {
    return <span style={{ color: 'var(--text-400)', fontSize: 12 }}>vs</span>;
  }
  const winner = hg > ag ? 'h' : ag > hg ? 'a' : null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
      <span style={{ color: winner === 'h' ? 'var(--gold)' : 'inherit' }}>{hg}</span>
      <span style={{ color: 'var(--text-400)' }}>–</span>
      <span style={{ color: winner === 'a' ? 'var(--gold)' : 'inherit' }}>{ag}</span>
      {pens && <span style={{ fontSize: 10, color: 'var(--text-500)' }}>(pen.)</span>}
    </span>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: agregar Spinner, TeamFlag, ScoreBadge"
```

---

### Task 11: Componentes MatchCard, FilterBar, Toast, Sidebar

**Files:**
- Create: `src/components/MatchCard.jsx`
- Create: `src/components/FilterBar.jsx`
- Create: `src/components/Toast.jsx`
- Create: `src/components/Sidebar.jsx`
- Create: `src/components/Sidebar.module.css`

**Interfaces:**
- Produces:
  - `<MatchCard match={m} teams={T} matchTimes={MT} />` — tarjeta de partido
  - `<FilterBar filters={[]} active="" onChange={fn} />` — botones de filtro
  - `<Toast message="..." type="ok|warn|err" />` — notificación flotante
  - `<Sidebar panels={[]} active="" onSelect={fn} collapsed={bool} />` — nav lateral

- [ ] **Step 1: Crear MatchCard.jsx**

```jsx
// src/components/MatchCard.jsx
import TeamFlag from './TeamFlag.jsx';
import ScoreBadge from './ScoreBadge.jsx';
import { fmtMatchDT } from '../services/resolvers.js';

export default function MatchCard({ match, teams, matchTimes, sched, compact = false }) {
  const time = fmtMatchDT(match.id, matchTimes, sched);
  return (
    <div style={{
      background: 'var(--bg-800)', border: '1px solid var(--bg-700)',
      borderRadius: 'var(--r-md)', padding: compact ? '6px 10px' : '10px 14px',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8,
    }}>
      <TeamFlag team={match.h} teams={teams} style={{ justifyContent: 'flex-end' }} />
      <div style={{ textAlign: 'center' }}>
        <ScoreBadge hg={match.hg} ag={match.ag} played={match.p} pens={match.pens} />
        {time && <div style={{ fontSize: 10, color: 'var(--blue-400)', marginTop: 2 }}>{time}</div>}
      </div>
      <TeamFlag team={match.a} teams={teams} />
    </div>
  );
}
```

- [ ] **Step 2: Crear FilterBar.jsx**

```jsx
// src/components/FilterBar.jsx
export default function FilterBar({ filters, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {filters.map(f => (
        <button key={f.value} onClick={() => onChange(f.value)} style={{
          padding: '4px 10px', borderRadius: 'var(--r-sm)', border: 'none',
          cursor: 'pointer', fontSize: 12, fontWeight: 500,
          background: active === f.value ? 'var(--blue)' : 'var(--bg-800)',
          color: active === f.value ? '#fff' : 'var(--text-400)',
        }}>
          {f.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Crear Toast.jsx**

```jsx
// src/components/Toast.jsx
const COLORS = { ok: 'var(--green)', warn: 'var(--gold)', err: 'var(--red)' };

export default function Toast({ message, type = 'ok' }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--bg-800)', border: `1px solid ${COLORS[type]}`,
      borderRadius: 'var(--r-md)', padding: '10px 16px',
      color: 'var(--text-50)', fontSize: 13, maxWidth: 300,
      boxShadow: '0 4px 12px rgba(0,0,0,.4)',
    }}>
      {message}
    </div>
  );
}
```

- [ ] **Step 4: Crear Sidebar.jsx**

```jsx
// src/components/Sidebar.jsx
const ICONS = {
  cal: '📅', groups: '🏆', elim: '⚔️', bracket: '🎯',
  predictor: '🔮', h2h: '📊', klement: '⭐', escenarios: '🎲', quiniela: '👥',
};
const LABELS = {
  cal: 'Calendario', groups: 'Grupos', elim: 'Eliminatorias', bracket: 'Bracket',
  predictor: 'Predictor', h2h: 'H2H', klement: 'Klement', escenarios: 'Escenarios', quiniela: 'Quiniela',
};

export default function Sidebar({ panels, active, onSelect, collapsed, onToggle }) {
  return (
    <nav style={{
      width: collapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)',
      background: 'var(--bg-900)', borderRight: '1px solid var(--bg-700)',
      height: '100vh', position: 'fixed', top: 0, left: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transition: 'width 0.2s', zIndex: 100,
    }}>
      <button onClick={onToggle} style={{
        background: 'none', border: 'none', color: 'var(--text-400)',
        padding: '16px', cursor: 'pointer', fontSize: 18, textAlign: 'right',
      }}>
        {collapsed ? '›' : '‹'}
      </button>
      {panels.map(p => (
        <button key={p} onClick={() => onSelect(p)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: active === p ? 'var(--bg-800)' : 'none',
          border: 'none', color: active === p ? 'var(--text-50)' : 'var(--text-400)',
          cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 13,
          borderLeft: active === p ? '2px solid var(--blue)' : '2px solid transparent',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{ICONS[p]}</span>
          {!collapsed && <span>{LABELS[p]}</span>}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: agregar MatchCard, FilterBar, Toast, Sidebar"
```

---

### Task 12: App.jsx con navegación y ESPN sync + CalendarPanel

**Files:**
- Modify: `src/App.jsx` (reemplazar stub)
- Create: `src/panels/CalendarPanel.jsx`

**Interfaces:**
- Consumes: `useMatchStore`, `useUiStore`, `fetchFromESPN`, `applyESPNTimes`, `syncKnockout`, todos los componentes base
- Produces: portal funcional con Sidebar, CalendarPanel y ESPN sync automático

- [ ] **Step 1: Implementar App.jsx**

```jsx
// src/App.jsx
import React, { useEffect, Suspense } from 'react';
import { useMatchStore } from './store/matchStore.js';
import { useUiStore } from './store/uiStore.js';
import { fetchFromESPN, applyESPNTimes, syncKnockout } from './services/espn.js';
import { resolveKOTeam } from './services/resolvers.js';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import Spinner from './components/Spinner.jsx';
import CalendarPanel from './panels/CalendarPanel.jsx';
import sched from './data/sched.json';
import koBracket from './data/ko-bracket.json';
import nameMapRaw from './data/teams.json';

const NAME_MAP = {}; // Poblado en espn.js con nombres ESPN→español

// Paneles lazy
const GroupsPanel = React.lazy(() => import('./panels/GroupsPanel.jsx'));
const EliminatoriaPanel = React.lazy(() => import('./panels/EliminatoriaPanel.jsx'));
const BracketPanel = React.lazy(() => import('./panels/BracketPanel.jsx'));
const PredictorPanel = React.lazy(() => import('./panels/PredictorPanel.jsx'));
const H2HPanel = React.lazy(() => import('./panels/H2HPanel.jsx'));
const KlementPanel = React.lazy(() => import('./panels/KlementPanel.jsx'));
const EscenariosPanel = React.lazy(() => import('./panels/EscenariosPanel.jsx'));
const QuinielaPanel = React.lazy(() => import('./panels/QuinielaPanel.jsx'));

const PANELS = ['cal','groups','elim','bracket','predictor','h2h','klement','escenarios','quiniela'];

const PANEL_MAP = {
  cal: <CalendarPanel />,
  groups: <GroupsPanel />,
  elim: <EliminatoriaPanel />,
  bracket: <BracketPanel />,
  predictor: <PredictorPanel />,
  h2h: <H2HPanel />,
  klement: <KlementPanel />,
  escenarios: <EscenariosPanel />,
  quiniela: <QuinielaPanel />,
};

export default function App() {
  const { res, resKO, matchTimes, setMatchTimes, applyESPNResults, applyKOUpdates, setKOTeamNames } = useMatchStore();
  const { activePanel, sidebarCollapsed, toastMessage, toastType, setPanel, toggleSidebar, showToast } = useUiStore();

  // Pre-poblar nombres de equipo en resKO al montar
  useEffect(() => {
    setKOTeamNames(koBracket, slot => resolveKOTeam(slot, res, resKO, koBracket));
  }, []);

  // ESPN sync diferido 1200ms
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const events = await fetchFromESPN();
        const { matchTimes: newTimes } = applyESPNTimes(events, sched);
        setMatchTimes({ ...matchTimes, ...newTimes });
        const count = applyESPNResults(events, NAME_MAP);
        const koUpdates = syncKnockout(events, resKO, NAME_MAP);
        applyKOUpdates(koUpdates);
        if (count + koUpdates.length > 0) {
          showToast(`${count + koUpdates.length} resultado(s) actualizado(s) · ESPN`, 'ok');
        }
      } catch {
        showToast('ESPN no disponible', 'warn');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const marginLeft = sidebarCollapsed ? 'var(--sidebar-cw)' : 'var(--sidebar-w)';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        panels={PANELS}
        active={activePanel}
        onSelect={setPanel}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />
      <main style={{ marginLeft, flex: 1, padding: '20px', maxWidth: 900, transition: 'margin-left 0.2s' }}>
        <Suspense fallback={<Spinner />}>
          {PANEL_MAP[activePanel]}
        </Suspense>
      </main>
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
```

- [ ] **Step 2: Implementar CalendarPanel.jsx**

```jsx
// src/panels/CalendarPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import MatchCard from '../components/MatchCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import teams from '../data/teams.json';
import sched from '../data/sched.json';
import koBracket from '../data/ko-bracket.json';
import { resolveKOTeam } from '../services/resolvers.js';

const KO_LBL = { R32:'32avos', R16:'Octavos', QF:'Cuartos', SF:'Semis', '3rd':'3er Lugar', Final:'Final' };
const DAY_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MON_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoy' },
  { value: 'ko', label: 'KO' },
  { value: 'played', label: 'Jugados' },
  { value: 'upcoming', label: 'Pendientes' },
];

export default function CalendarPanel() {
  const { res, resKO, matchTimes } = useMatchStore();
  const { calFilter, setCalFilter } = useUiStore();

  const now = new Date();
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  // Construir lista de todos los partidos con fecha
  const getMatchDate = (id) => {
    const mt = matchTimes[id] || matchTimes[String(id)];
    if (mt) {
      const kd = new Date(mt);
      return kd.getFullYear() + '-' + String(kd.getMonth()+1).padStart(2,'0') + '-' + String(kd.getDate()).padStart(2,'0');
    }
    const s = sched[id] || sched[String(id)];
    return s?.dt || '2026-12-31';
  };

  const groupMatches = res.map(m => ({
    ...m, dt: getMatchDate(m.id), isKO: false, pens: '',
    hRes: true, aRes: true,
  }));

  const koMatches = koBracket.map(kb => {
    const rko = resKO.find(r => r.id === kb.id) || { hg: null, ag: null, p: false, pens: '' };
    const h = resolveKOTeam(kb.sh, res, resKO, koBracket);
    const a = resolveKOTeam(kb.sa, res, resKO, koBracket);
    return {
      id: kb.id, g: KO_LBL[kb.rnd] || kb.rnd,
      h: h || kb.sh, a: a || kb.sa,
      hg: rko.hg, ag: rko.ag, p: rko.p, pens: rko.pens || '',
      dt: getMatchDate(kb.id), isKO: true, rnd: kb.rnd,
      hRes: !!h, aRes: !!a,
    };
  });

  const allMatches = [...groupMatches, ...koMatches];

  const filtered = allMatches.filter(m => {
    if (calFilter === 'today') return m.dt === today;
    if (calFilter === 'ko') return m.isKO;
    if (calFilter === 'played') return m.p;
    if (calFilter === 'upcoming') return !m.p;
    return true;
  });

  // Agrupar por fecha
  const byDay = {};
  filtered.forEach(m => {
    if (!byDay[m.dt]) byDay[m.dt] = [];
    byDay[m.dt].push(m);
  });
  const days = Object.keys(byDay).sort();

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>📅 Calendario</h2>
      <FilterBar filters={FILTERS} active={calFilter} onChange={setCalFilter} />
      {days.map(dt => {
        const d = new Date(dt + 'T12:00:00Z');
        const isToday = dt === today;
        const dm = byDay[dt];
        const playedCnt = dm.filter(m => m.p).length;
        return (
          <div key={dt} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              paddingBottom: 6, borderBottom: '1px solid var(--bg-700)',
            }}>
              <span style={{ color: 'var(--text-400)', fontSize: 13 }}>
                {DAY_ES[d.getUTCDay()]} {d.getUTCDate()} {MON_ES[d.getUTCMonth()]}
              </span>
              {isToday && (
                <span style={{
                  background: 'var(--blue)', color: '#fff', fontSize: 10,
                  padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                }}>HOY</span>
              )}
              <span style={{ marginLeft: 'auto', color: 'var(--text-500)', fontSize: 11 }}>
                {playedCnt}/{dm.length} jugados
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dm.map(m => (
                <MatchCard key={m.id} match={m} teams={teams} matchTimes={matchTimes} sched={sched} />
              ))}
            </div>
          </div>
        );
      })}
      {days.length === 0 && (
        <p style={{ color: 'var(--text-400)', textAlign: 'center', marginTop: 40 }}>
          No hay partidos para mostrar.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

```bash
npm run dev
```

Abrir `http://localhost:5173/quiniela-mundial-2026/`. Verificar:
- Sidebar muestra todos los paneles
- CalendarPanel muestra partidos agrupados por fecha
- Filtros (Hoy, Jugados, etc.) funcionan
- Después de 1.2s aparece toast "ESPN no disponible" o "X resultados actualizados"

- [ ] **Step 4: Build y push**

```bash
npm run build
git add src/ index.html
git commit -m "feat: App shell + Sidebar + CalendarPanel funcional (fase 3)"
git push origin main
```

Expected: GitHub Action despliega. CalendarPanel funcional en producción.

---

## Fase 4: GroupsPanel y EliminatoriaPanel

### Task 13: GroupsPanel

**Files:**
- Create: `src/panels/GroupsPanel.jsx`

**Interfaces:**
- Consumes: `useMatchStore().res`, `tbl()` de `poisson.js`, `sim()` de `poisson.js`
- Produces: tabla de posiciones por grupo + lista de partidos del grupo seleccionado

- [ ] **Step 1: Implementar GroupsPanel.jsx**

```jsx
// src/panels/GroupsPanel.jsx
import { useState } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import { tbl, sim, klScore } from '../services/poisson.js';
import MatchCard from '../components/MatchCard.jsx';
import teams from '../data/teams.json';
import sched from '../data/sched.json';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

export default function GroupsPanel() {
  const { res, matchTimes } = useMatchStore();
  const [selectedGroup, setSelectedGroup] = useState('A');

  const standings = tbl(selectedGroup, res);
  const groupMatches = res.filter(m => m.g === selectedGroup);

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>🏆 Fase de Grupos</h2>

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
      <div style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', marginBottom: 20, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-400)' }}>{row.pj}</td>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/panels/GroupsPanel.jsx
git commit -m "feat: agregar GroupsPanel con tabla de posiciones"
```

---

### Task 14: EliminatoriaPanel

**Files:**
- Create: `src/panels/EliminatoriaPanel.jsx`

**Interfaces:**
- Consumes: `useMatchStore().resKO`, `resolveKOTeam()`, `sim()`
- Produces: lista de partidos KO filtrable por ronda (R32, R16, QF, SF, Final)

- [ ] **Step 1: Implementar EliminatoriaPanel.jsx**

```jsx
// src/panels/EliminatoriaPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { useUiStore } from '../store/uiStore.js';
import { resolveKOTeam } from '../services/resolvers.js';
import { sim } from '../services/poisson.js';
import MatchCard from '../components/MatchCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import teams from '../data/teams.json';
import sched from '../data/sched.json';
import koBracket from '../data/ko-bracket.json';

const RND_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'R32', label: '32avos' },
  { value: 'R16', label: 'Octavos' },
  { value: 'QF', label: 'Cuartos' },
  { value: 'SF', label: 'Semis' },
  { value: 'Final', label: 'Final' },
];

export default function EliminatoriaPanel() {
  const { res, resKO, matchTimes } = useMatchStore();
  const { koTab, setKoTab } = useUiStore();

  const koMatches = koBracket
    .filter(kb => koTab === 'all' || kb.rnd === koTab)
    .map(kb => {
      const rko = resKO.find(r => r.id === kb.id) || {};
      const h = resolveKOTeam(kb.sh, res, resKO, koBracket);
      const a = resolveKOTeam(kb.sa, res, resKO, koBracket);
      const pr = (!rko.p && h && a && teams[h] && teams[a]) ? sim(h, a, teams) : null;
      return {
        id: kb.id, rnd: kb.rnd,
        h: h || kb.sh, a: a || kb.sa,
        hg: rko.hg ?? null, ag: rko.ag ?? null, p: rko.p || false, pens: rko.pens || '',
        pr,
      };
    });

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>⚔️ Fase Eliminatoria</h2>
      <FilterBar filters={RND_FILTERS} active={koTab} onChange={setKoTab} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {koMatches.map(m => (
          <div key={m.id}>
            <MatchCard match={m} teams={teams} matchTimes={matchTimes} sched={sched} />
            {m.pr && !m.p && (
              <div style={{ fontSize: 11, color: 'var(--text-500)', textAlign: 'center', marginTop: 2 }}>
                {(m.pr.pW * 100).toFixed(0)}% – {(m.pr.pD * 100).toFixed(0)}% – {(m.pr.pL * 100).toFixed(0)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build, commit y push**

```bash
npm run build
git add src/panels/
git commit -m "feat: GroupsPanel + EliminatoriaPanel (fase 4)"
git push origin main
```

---

## Fase 5: BracketPanel

### Task 15: BracketPanel

**Files:**
- Create: `src/panels/BracketPanel.jsx`

**Interfaces:**
- Consumes: `useMatchStore().resKO`, `resolveKOTeam()`, `sim()`
- Produces: bracket visual de R32 con dos llaves de 8 partidos, marcadores reales si jugados, probabilidades si pendientes

- [ ] **Step 1: Implementar BracketPanel.jsx**

```jsx
// src/panels/BracketPanel.jsx
import { useMatchStore } from '../store/matchStore.js';
import { resolveKOTeam } from '../services/resolvers.js';
import { sim } from '../services/poisson.js';
import ScoreBadge from '../components/ScoreBadge.jsx';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';
import sched from '../data/sched.json';
import { fmtMatchDT } from '../services/resolvers.js';

function BkMatch({ kb, res, resKO, matchTimes }) {
  const t1 = resolveKOTeam(kb.sh, res, resKO, koBracket) || kb.sh;
  const t2 = resolveKOTeam(kb.sa, res, resKO, koBracket) || kb.sa;
  const koM = resKO.find(k => k.id === kb.id);
  const played = !!(koM?.p);
  const pr = (!played && teams[t1] && teams[t2]) ? sim(t1, t2, teams) : null;
  const winH = played && (koM.hg > koM.ag || koM.pens === 'h');
  const winA = played && (koM.ag > koM.hg || koM.pens === 'a');
  const dt = fmtMatchDT(kb.id, matchTimes, sched);

  return (
    <div style={{
      background: 'var(--bg-800)', border: '1px solid var(--bg-700)',
      borderRadius: 'var(--r-md)', padding: '8px 10px', minWidth: 160,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 5, borderBottom: '1px solid var(--bg-700)' }}>
        <span style={{ fontSize: 12, color: winH ? 'var(--gold)' : 'inherit', fontWeight: winH ? 700 : 400 }}>
          {teams[t1]?.fl || '🏳️'} {t1}
        </span>
        {played ? (
          <span style={{ fontSize: 12, fontWeight: 800 }}>{koM.hg}</span>
        ) : pr ? (
          <span style={{ fontSize: 10, color: 'var(--text-400)' }}>{(pr.pW * 100).toFixed(0)}%</span>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 5 }}>
        <span style={{ fontSize: 12, color: winA ? 'var(--gold)' : 'inherit', fontWeight: winA ? 700 : 400 }}>
          {teams[t2]?.fl || '🏳️'} {t2}
        </span>
        {played ? (
          <span style={{ fontSize: 12, fontWeight: 800 }}>{koM.ag}</span>
        ) : pr ? (
          <span style={{ fontSize: 10, color: 'var(--text-400)' }}>{(pr.pL * 100).toFixed(0)}%</span>
        ) : null}
      </div>
      {!played && dt && (
        <div style={{ fontSize: 10, color: 'var(--blue-400)', textAlign: 'center', marginTop: 4 }}>{dt}</div>
      )}
    </div>
  );
}

export default function BracketPanel() {
  const { res, resKO, matchTimes } = useMatchStore();
  const r32 = koBracket.filter(k => k.rnd === 'R32');
  const llave1 = r32.slice(0, 8);
  const llave2 = r32.slice(8);

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>🎯 Bracket R32</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3 style={{ fontSize: 12, color: 'var(--text-400)', marginBottom: 10 }}>Llave 1</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {llave1.map(kb => (
              <BkMatch key={kb.id} kb={kb} res={res} resKO={resKO} matchTimes={matchTimes} />
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 12, color: 'var(--text-400)', marginBottom: 10 }}>Llave 2</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {llave2.map(kb => (
              <BkMatch key={kb.id} kb={kb} res={res} resKO={resKO} matchTimes={matchTimes} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build, commit y push**

```bash
npm run build
git add src/panels/BracketPanel.jsx
git commit -m "feat: BracketPanel con marcadores reales y probabilidades (fase 5)"
git push origin main
```

---

## Fase 6: Paneles Analíticos

### Task 16: PredictorPanel + H2HPanel

**Files:**
- Create: `src/panels/PredictorPanel.jsx`
- Create: `src/panels/H2HPanel.jsx`

**Interfaces:**
- Consumes: `sim()`, `tbl()` de `poisson.js`, Chart.js via `react-chartjs-2`
- Produces: predictor Poisson con distribución de goles, H2H histórico con radar

- [ ] **Step 1: Implementar PredictorPanel.jsx**

```jsx
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
  const hProbs = pr ? labels.map((_, i) => i < 5 ? poissonProb(i, pr.expH) : 1 - labels.slice(0,5).reduce((s,_,j) => s + poissonProb(j, pr.expH), 0)) : [];
  const aProbs = pr ? labels.map((_, i) => i < 5 ? poissonProb(i, pr.expA) : 1 - labels.slice(0,5).reduce((s,_,j) => s + poissonProb(j, pr.expA), 0)) : [];

  const chartData = {
    labels,
    datasets: [
      { label: h, data: hProbs.map(p => +(p*100).toFixed(1)), backgroundColor: 'rgba(37,99,235,.7)' },
      { label: a, data: aProbs.map(p => +(p*100).toFixed(1)), backgroundColor: 'rgba(220,38,38,.7)' },
    ],
  };

  const select = (val, setter) => <select value={val} onChange={e => setter(e.target.value)} style={{
    background: 'var(--bg-800)', color: 'var(--text-50)', border: '1px solid var(--bg-700)',
    borderRadius: 'var(--r-sm)', padding: '6px 10px', fontSize: 13,
  }}>
    {TEAM_LIST.map(t => <option key={t} value={t}>{teams[t]?.fl} {t}</option>)}
  </select>;

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
            {[{ label: `${h} gana`, pct: pr.pW }, { label: 'Empate', pct: pr.pD }, { label: `${a} gana`, pct: pr.pL }].map(x => (
              <div key={x.label} style={{ background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '12px 16px', textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-400)' }}>{(x.pct * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 4 }}>{x.label}</div>
              </div>
            ))}
          </div>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }, x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } } } }} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implementar H2HPanel.jsx**

```jsx
// src/panels/H2HPanel.jsx
import { useState } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend
} from 'chart.js';
import { sim, klScore } from '../services/poisson.js';
import teams from '../data/teams.json';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const TEAM_LIST = Object.keys(teams).sort();
const ATTRS = ['Ataque', 'Defensa', 'ELO', 'Klement', 'Forma'];

function normalize(val, min, max) { return max === min ? 50 : ((val - min) / (max - min)) * 100; }

export default function H2HPanel() {
  const [h, setH] = useState('Brasil');
  const [a, setA] = useState('Argentina');

  const th = teams[h], ta = teams[a];
  const pr = th && ta ? sim(h, a, teams) : null;

  const eloMin = Math.min(th?.elo || 1500, ta?.elo || 1500) - 50;
  const eloMax = Math.max(th?.elo || 2000, ta?.elo || 2000) + 50;
  const klH = klScore(h, teams), klA = klScore(a, teams);

  const radarData = pr ? {
    labels: ATTRS,
    datasets: [
      {
        label: h,
        data: [
          normalize(th.att, 0.5, 2.5), normalize(1/th.def, 0.4, 1.5),
          normalize(th.elo, eloMin, eloMax), klH, 50
        ],
        borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.2)',
      },
      {
        label: a,
        data: [
          normalize(ta.att, 0.5, 2.5), normalize(1/ta.def, 0.4, 1.5),
          normalize(ta.elo, eloMin, eloMax), klA, 50
        ],
        borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.2)',
      },
    ],
  } : null;

  const select = (val, setter) => <select value={val} onChange={e => setter(e.target.value)} style={{
    background: 'var(--bg-800)', color: 'var(--text-50)', border: '1px solid var(--bg-700)',
    borderRadius: 'var(--r-sm)', padding: '6px 10px', fontSize: 13,
  }}>
    {TEAM_LIST.map(t => <option key={t} value={t}>{teams[t]?.fl} {t}</option>)}
  </select>;

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>📊 Head to Head</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {select(h, setH)}
        <span style={{ color: 'var(--text-400)' }}>vs</span>
        {select(a, setA)}
      </div>
      {radarData && (
        <div style={{ maxWidth: 400, margin: '0 auto' }}>
          <Radar data={radarData} options={{
            scales: { r: { ticks: { color: '#94a3b8', backdropColor: 'transparent' }, grid: { color: '#334155' }, pointLabels: { color: '#94a3b8' }, min: 0, max: 100 } },
            plugins: { legend: { labels: { color: '#94a3b8' } } },
          }} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/panels/PredictorPanel.jsx src/panels/H2HPanel.jsx
git commit -m "feat: PredictorPanel + H2HPanel con gráficas Chart.js"
```

---

### Task 17: KlementPanel

**Files:**
- Create: `src/panels/KlementPanel.jsx`

**Interfaces:**
- Consumes: `useMatchStore().res`, `tbl()`, `klScore()`, `sim()`, Chart.js
- Produces: ranking Klement de los 48 equipos con scatter plot

- [ ] **Step 1: Implementar KlementPanel.jsx**

```jsx
// src/panels/KlementPanel.jsx
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { klScore, sim } from '../services/poisson.js';
import teams from '../data/teams.json';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TEAM_LIST = Object.keys(teams);

export default function KlementPanel() {
  const ranked = TEAM_LIST
    .map(t => ({ t, score: klScore(t, teams), fl: teams[t]?.fl || '🏳️' }))
    .sort((a, b) => b.score - a.score);

  const top20 = ranked.slice(0, 20);

  const chartData = {
    labels: top20.map(x => x.t),
    datasets: [{
      label: 'Klement Score',
      data: top20.map(x => x.score),
      backgroundColor: top20.map((_, i) => i === 0 ? 'var(--gold)' : 'rgba(37,99,235,.7)'),
    }],
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>⭐ Klement Score</h2>
      <div style={{ marginBottom: 24 }}>
        <Bar data={chartData} options={{
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} pts` } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
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
            <span style={{ fontWeight: 700, color: i < 3 ? 'var(--gold)' : 'var(--text-400)' }}>{x.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build, commit y push**

```bash
npm run build
git add src/panels/KlementPanel.jsx
git commit -m "feat: KlementPanel con ranking y gráfica de barras (fase 6)"
git push origin main
```

---

## Fase 7: EscenariosPanel con Web Worker

### Task 18: EscenariosPanel

**Files:**
- Create: `src/panels/EscenariosPanel.jsx`

**Interfaces:**
- Consumes: `montecarlo.worker.js` via `new Worker(...)`, `useMatchStore`
- Produces: tabla de probabilidades de avance por equipo, no bloquea UI durante simulación

- [ ] **Step 1: Implementar EscenariosPanel.jsx**

```jsx
// src/panels/EscenariosPanel.jsx
import { useState, useCallback } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';

const STAGES = [
  { key: 'group', label: 'Grupos' },
  { key: 'r16', label: 'R16' },
  { key: 'qf', label: 'QF' },
  { key: 'sf', label: 'SF' },
  { key: 'final', label: 'Final' },
  { key: 'champ', label: '🏆' },
];

export default function EscenariosPanel() {
  const { res, resKO } = useMatchStore();
  const [counts, setCounts] = useState(null);
  const [running, setRunning] = useState(false);
  const [champion, setChampion] = useState('');
  const N = 50000;

  const run = useCallback(() => {
    setRunning(true);
    setCounts(null);
    const worker = new Worker(
      new URL('../workers/montecarlo.worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.postMessage({ res, resKO, koBracket, teams, N });
    worker.onmessage = (e) => {
      setCounts(e.data.counts);
      setChampion(e.data.champion);
      setRunning(false);
      worker.terminate();
    };
  }, [res, resKO]);

  const sorted = counts
    ? Object.entries(counts).sort((a, b) => b[1].champ - a[1].champ)
    : [];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>🎲 Escenarios Monte Carlo</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={run} disabled={running} style={{
          background: 'var(--blue)', color: '#fff', border: 'none',
          borderRadius: 'var(--r-sm)', padding: '8px 20px', cursor: 'pointer', fontWeight: 600,
        }}>
          {running ? `Simulando ${N.toLocaleString()} partidos...` : `▶ Simular ${N.toLocaleString()} escenarios`}
        </button>
        {champion && !running && (
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
            Favorito: {teams[champion]?.fl} {champion}
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
                      color: s.key === 'champ' ? 'var(--gold)' : 'var(--text-400)',
                      fontWeight: s.key === 'champ' ? 700 : 400,
                    }}>
                      {((c[s.key] || 0) / N * 100).toFixed(1)}%
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
```

- [ ] **Step 2: Build, commit y push**

```bash
npm run build
git add src/panels/EscenariosPanel.jsx
git commit -m "feat: EscenariosPanel con Monte Carlo en Web Worker (fase 7)"
git push origin main
```

---

## Fase 8: QuinielaPanel + PWA + Polish

### Task 19: QuinielaPanel

**Files:**
- Create: `src/panels/QuinielaPanel.jsx`

**Interfaces:**
- Consumes: `useMatchStore`, `sim()`, localStorage para predicciones de usuarios
- Produces: panel de quiniela con predicciones por partido KO y tabla de puntos

- [ ] **Step 1: Implementar QuinielaPanel.jsx**

```jsx
// src/panels/QuinielaPanel.jsx
import { useState, useEffect } from 'react';
import { useMatchStore } from '../store/matchStore.js';
import { resolveKOTeam } from '../services/resolvers.js';
import teams from '../data/teams.json';
import koBracket from '../data/ko-bracket.json';

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

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: 'var(--text-200)' }}>👥 Quiniela</h2>
      <p style={{ color: 'var(--text-400)', fontSize: 13, marginBottom: 20 }}>
        Selecciona el ganador de cada partido de R32.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {r32.map(kb => {
          const koM = resKO.find(r => r.id === kb.id) || {};
          const h = resolveKOTeam(kb.sh, res, resKO, koBracket) || kb.sh;
          const a = resolveKOTeam(kb.sa, res, resKO, koBracket) || kb.sa;
          const pred = preds[kb.id];
          const isPlayed = koM.p;
          const actualWinner = isPlayed ? (koM.hg > koM.ag || koM.pens === 'h' ? h : a) : null;
          const correct = pred && actualWinner && pred === actualWinner;

          return (
            <div key={kb.id} style={{
              background: 'var(--bg-800)', borderRadius: 'var(--r-md)', padding: '10px 14px',
              border: `1px solid ${correct ? 'var(--green)' : pred && isPlayed ? 'var(--red)' : 'var(--bg-700)'}`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setPred(kb.id, h)} style={{
                  flex: 1, padding: '6px', borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: isPlayed ? 'default' : 'pointer', fontSize: 12,
                  background: pred === h ? 'var(--blue)' : 'var(--bg-700)',
                  color: pred === h ? '#fff' : 'var(--text-400)',
                  fontWeight: pred === h ? 700 : 400,
                }}>
                  {teams[h]?.fl} {h}
                </button>
                <span style={{ color: 'var(--text-500)', fontSize: 11 }}>vs</span>
                <button onClick={() => setPred(kb.id, a)} style={{
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
                <div style={{ fontSize: 11, textAlign: 'center', marginTop: 6, color: correct ? 'var(--green-400)' : 'var(--red-400)' }}>
                  {correct ? '✓ Correcto' : `✗ Ganó: ${actualWinner}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/panels/QuinielaPanel.jsx
git commit -m "feat: QuinielaPanel con predicciones R32 persistidas en localStorage"
```

---

### Task 20: Polish final + audit de rendimiento

**Files:**
- Modify: `src/App.jsx` (agregar font Inter, mejorar layout móvil)
- Modify: `src/index.css` (agregar Google Fonts preconnect via vite-plugin-html si aplica, o en index.html)
- Modify: `index.html` (agregar preconnect para CDNs externos)

**Interfaces:**
- Produces: app completa con todos los paneles funcionando, primera carga ≤ 3s en 4G

- [ ] **Step 1: Agregar Google Fonts al index.html**

```html
<!-- Añadir en <head> del index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verificar build size**

```bash
npm run build
```

Expected output: Vite muestra bundle chunks. Verificar que ningún chunk supera 500KB. Si `index` chunk supera ese límite, investigar imports innecesarios.

- [ ] **Step 3: Verificar todos los paneles en navegador**

```bash
npm run preview
```

Abrir `http://localhost:4173/quiniela-mundial-2026/`. Verificar:
- [ ] CalendarPanel: partidos agrupados por fecha, filtros funcionan, HOY marcado
- [ ] GroupsPanel: tabla de posiciones correcta para todos los grupos
- [ ] EliminatoriaPanel: partidos KO con probabilidades Poisson
- [ ] BracketPanel: R32 con marcadores reales (SA 0-1 CAN, BRA 2-1 JPN)
- [ ] PredictorPanel: selects funcionan, gráfica se renderiza
- [ ] H2HPanel: radar chart se renderiza
- [ ] KlementPanel: ranking correcto, Brasil primero
- [ ] EscenariosPanel: botón "Simular" corre sin congelar UI
- [ ] QuinielaPanel: predicciones se guardan y persisten

- [ ] **Step 4: Build final y push**

```bash
npm run build
git add .
git commit -m "feat: polish final + Google Fonts + verificación completa (fase 8)"
git push origin main
```

Expected: GitHub Action despliega. Verificar en `https://fjhr.github.io/quiniela-mundial-2026/` que todos los paneles funcionan.

---

## Self-Review del Plan

**Cobertura del spec:**
- ✅ React 18 + Vite + Zustand + react-chartjs-2 (Task 1)
- ✅ 5 archivos JSON extraídos de index.html (Task 2)
- ✅ GitHub Action para Pages deploy (Task 3)
- ✅ `sim()`, `tbl()`, `klScore()` con tests (Task 4)
- ✅ `resolveKOTeam()`, `mapName()`, `fmtMatchDT()` con tests (Task 5)
- ✅ `fetchFromESPN()`, `applyESPNTimes()`, `syncKnockout()` (Task 6)
- ✅ `runMonteCarlo()` + `montecarlo.worker.js` (Task 7)
- ✅ `matchStore.js` con Zustand (Task 8)
- ✅ `uiStore.js` con Zustand (Task 9)
- ✅ Todos los componentes base (Tasks 10-11)
- ✅ App.jsx + ESPN sync diferido 1200ms (Task 12)
- ✅ CalendarPanel con filtros y HOY (Task 12)
- ✅ GroupsPanel con tabla (Task 13)
- ✅ EliminatoriaPanel (Task 14)
- ✅ BracketPanel con marcadores reales (Task 15)
- ✅ PredictorPanel + H2HPanel (Task 16)
- ✅ KlementPanel (Task 17)
- ✅ EscenariosPanel + Web Worker (Task 18)
- ✅ QuinielaPanel (Task 19)
- ✅ PWA (manifest/icon/sw en public/) (Task 1 Step 10)
- ✅ CSS variables mantenidas (Task 1 Step 7)
- ✅ Offset UTC-5 fijo en espn.js (Task 6)
- ✅ `localStorage` solo para match-times y theme (Tasks 8, 9)
- ✅ `base: '/quiniela-mundial-2026/'` en vite.config.js (Task 1)

**Tipos consistentes entre tasks:**
- `sim(t1, t2, teams)` — definido en Task 4, consumido en Tasks 13-16, 18 ✅
- `tbl(group, res)` — definido en Task 4, consumido en Tasks 5, 13 ✅
- `resolveKOTeam(slot, res, resKO, koBracket)` — definido en Task 5, consumido en Tasks 12, 14, 15, 18, 19 ✅
- `useMatchStore()` → `{ res, resKO, matchTimes, ... }` — definido en Task 8, consumido en Tasks 12-19 ✅
- `useUiStore()` → `{ activePanel, calFilter, koTab, ... }` — definido en Task 9, consumido en Tasks 12-14 ✅
