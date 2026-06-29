# Spec: Reimplementación Portal Quiniela Mundial 2026 — React + Vite

**Fecha:** 2026-06-29
**Estado:** Aprobado por usuario
**Objetivo:** Reimplementar el portal desde el archivo único `index.html` (4,392 líneas / 248KB) a una arquitectura React + Vite modular, manteniendo toda la funcionalidad existente y mejorando simultáneamente mantenibilidad y rendimiento.

---

## 1. Contexto y Motivación

El portal actual es un único `index.html` con HTML, CSS, JS y datos todos mezclados. Esto hace difícil:
- Modificar una parte sin afectar otras
- Entender el flujo de datos
- Cargar solo lo necesario en móvil
- Agregar features nuevas de forma ordenada

La reimplementación resuelve esto sin cambiar la funcionalidad visible ni el proceso de deploy.

---

## 2. Stack Tecnológico

| Herramienta | Versión | Rol |
|---|---|---|
| React | 18 | Framework UI con reactividad |
| Vite | 5+ | Build tool, HMR en desarrollo |
| Zustand | 4+ | Estado global (liviano, sin boilerplate) |
| react-chartjs-2 | 5+ | Wrapper React para Chart.js 4 |
| Chart.js | 4.4+ | Gráficas (Poisson, radar, barras) |

Sin TypeScript en esta iteración — JS puro para minimizar fricción de migración.

---

## 3. Estructura de Carpetas

```
quiniela-mundial-2026/
├── index.html                  # Shell mínimo (~15 líneas)
├── vite.config.js
├── package.json
├── public/
│   ├── manifest.json
│   ├── icon.svg
│   └── sw.js
├── src/
│   ├── main.jsx                # Entry point
│   ├── App.jsx                 # Layout, navegación, sync al montar
│   ├── data/                   # Datos estáticos (JSON)
│   │   ├── init.json           # 72 partidos fase de grupos con resultados
│   │   ├── ko-bracket.json     # 32 entradas KO con slots reales FIFA 2026
│   │   ├── sched.json          # Mapa id→{dt,v} de fechas y sedes
│   │   ├── teams.json          # Stats, flags y datos Klement por equipo
│   │   └── venues.json         # Sedes con ciudad, país, cc
│   ├── services/               # Lógica pura, sin dependencias React
│   │   ├── poisson.js          # sim(), tbl(), klScore()
│   │   ├── espn.js             # fetchFromESPN(), applyESPNTimes(), syncKnockout()
│   │   ├── montecarlo.js       # runMonteCarlo() — también expuesto como Web Worker
│   │   └── resolvers.js        # resolveKOTeam(), mapName(), fmtMatchDT()
│   ├── store/
│   │   ├── matchStore.js       # res, resKO, matchTimes + acciones ESPN
│   │   └── uiStore.js          # activePanel, calFilter, selectedGroup, koTab
│   ├── components/             # Componentes base reutilizables
│   │   ├── TeamFlag.jsx
│   │   ├── MatchCard.jsx
│   │   ├── ScoreBadge.jsx
│   │   ├── KlementBar.jsx
│   │   ├── FilterBar.jsx
│   │   ├── Sidebar.jsx
│   │   └── Toast.jsx
│   ├── panels/                 # Paneles principales (lazy-loaded excepto Calendar)
│   │   ├── CalendarPanel.jsx   # Carga inmediata (panel por defecto)
│   │   ├── GroupsPanel.jsx
│   │   ├── EliminatoriaPanel.jsx
│   │   ├── BracketPanel.jsx
│   │   ├── PredictorPanel.jsx
│   │   ├── H2HPanel.jsx
│   │   ├── KlementPanel.jsx
│   │   ├── EscenariosPanel.jsx
│   │   └── QuinielaPanel.jsx
│   └── workers/
│       └── montecarlo.worker.js  # Web Worker para Monte Carlo
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-29-reimplementacion-react-vite-design.md
```

---

## 4. Capa de Datos

### 4.1 Archivos JSON estáticos

Todos los datos que hoy son constantes JS (`INIT`, `KO_BRACKET`, `SCHED`, `T`, `VENUES`) se extraen a archivos JSON en `src/data/`. Estos archivos son la fuente de verdad para los datos que no cambian durante el torneo.

**`init.json`** — Array de 72 objetos:
```json
[{ "id": 1, "g": "A", "h": "México", "a": "Sudáfrica", "hg": 2, "ag": 0, "p": true, "r": 1 }, ...]
```

**`ko-bracket.json`** — Array de 32 objetos:
```json
[{ "id": 73, "rnd": "R32", "sh": "2A", "sa": "2B" }, ...]
```

**`sched.json`** — Objeto indexado por id:
```json
{ "1": { "dt": "2026-06-12", "v": "AZT" }, ... }
```

**`teams.json`** — Objeto indexado por nombre de equipo:
```json
{ "México": { "fl": "🇲🇽", "elo": 1850, "att": 1.8, "def": 0.9, "kl": {...} }, ... }
```

**`venues.json`** — Objeto indexado por código de sede:
```json
{ "AZT": { "n": "Estadio Azteca", "city": "Ciudad de México", "flag": "🇲🇽", "cc": "mx" }, ... }
```

### 4.2 Datos en runtime (Zustand)

Los JSON se cargan al iniciar y se copian al store para hacerlos mutables. ESPN sync actualiza el store; el store notifica a los componentes que lo consumen.

---

## 5. Estado Global (Zustand)

### 5.1 `matchStore.js`

```js
{
  // Estado
  res: [],          // Copia mutable de init.json (resultados fase de grupos)
  resKO: [],        // Resultados KO inicializados desde ko-bracket.json
  matchTimes: {},   // Timestamps ESPN — persistido en localStorage

  // Acciones
  initFromJSON: (init, koBracket) => void,
  applyESPNResults: (events) => number,  // retorna count de actualizados
  updateKOResult: (id, hg, ag, pens) => void,
  setMatchTimes: (times) => void,
}
```

### 5.2 `uiStore.js`

```js
{
  activePanel: 'cal',
  calFilter: 'all',
  selectedGroup: 'A',
  koTab: 'R32',
  sidebarCollapsed: false,
  theme: 'dark',

  setPanel: (panel) => void,
  setCalFilter: (filter) => void,
  setGroup: (group) => void,
  setKoTab: (tab) => void,
  toggleSidebar: () => void,
  toggleTheme: () => void,
}
```

---

## 6. Servicios

### 6.1 `poisson.js`
Funciones puras de cálculo estadístico. Sin efectos secundarios, sin estado.
- `sim(t1, t2, teams)` → `{ pW, pD, pL, expH, expA }`
- `tbl(group, res)` → Array ordenado de equipos con pts/gd/gf/ga
- `klScore(team, teams)` → número 0-100

### 6.2 `espn.js`
Maneja la comunicación con la API ESPN. Retorna datos; no modifica el store directamente.
- `fetchFromESPN()` → `{ events: [] }`
- `applyESPNTimes(events, sched)` → `{ matchTimes: {}, changed: boolean }`
- `syncKnockout(resKO)` → `{ updates: [] }`

El store llama a estos servicios y aplica los resultados — separación clara entre fetch y estado.

### 6.3 `montecarlo.js`
- `runMonteCarlo(res, resKO, koBracket, teams, N)` → `{ counts: {}, champion: string }`
- Exportado también como handler de Web Worker para no bloquear UI.

### 6.4 `resolvers.js`
- `resolveKOTeam(slot, res, resKO, koBracket)` → string | null
- `mapName(espnName, nameMap)` → string
- `fmtMatchDT(id, matchTimes, sched)` → string formateado

---

## 7. Componentes Base

Cada componente recibe solo los props que necesita — sin acceso directo al store.

| Componente | Props principales |
|---|---|
| `TeamFlag` | `team`, `teams` |
| `MatchCard` | `match`, `teams`, `matchTimes`, `onPredict?` |
| `ScoreBadge` | `hg`, `ag`, `played`, `pens?` |
| `KlementBar` | `team`, `score`, `max` |
| `FilterBar` | `filters`, `active`, `onChange` |
| `Sidebar` | `panels`, `active`, `collapsed`, `onSelect` |
| `Toast` | `message`, `type`, `duration` |

---

## 8. Paneles

### Carga
- `CalendarPanel` — carga inmediata (es el panel por defecto al abrir)
- Todos los demás — `React.lazy()` + `<Suspense fallback={<Spinner/>}>`
- Chart.js se importa solo dentro de los paneles que lo necesitan (Predictor, H2H, Klement)

### Sincronización ESPN
En `App.jsx`, al montar:
```js
useEffect(() => {
  const timer = setTimeout(async () => {
    const events = await fetchFromESPN();
    const { matchTimes } = applyESPNTimes(events, sched);
    matchStore.setMatchTimes(matchTimes);
    const count = matchStore.applyESPNResults(events);
    if (count > 0) showToast(`${count} resultado(s) actualizado(s)`);
  }, 1200);
  return () => clearTimeout(timer);
}, []);
```

### Monte Carlo con Web Worker
```js
// EscenariosPanel.jsx
const worker = new Worker(new URL('../workers/montecarlo.worker.js', import.meta.url));
worker.postMessage({ res, resKO, koBracket, teams, N: 50000 });
worker.onmessage = (e) => setCounts(e.data.counts);
```
La UI no se congela durante la simulación.

---

## 9. CSS

- Mantener las variables CSS actuales (`:root { --bg-950, --blue, ... }`)
- Migrar a CSS Modules por componente (`MatchCard.module.css`)
- El archivo global `src/index.css` contiene solo variables y reset base
- Tema claro/oscuro via `data-theme="light"` en `<html>` — igual que ahora

---

## 10. Build y Deploy

### Desarrollo
```bash
npm install
npm run dev     # http://localhost:5173/quiniela-mundial-2026/
```

### Producción
```bash
npm run build   # genera dist/
npm run preview # preview local
```

### GitHub Action (`.github/workflows/deploy.yml`)
```yaml
on: push: branches: [main]
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4 (node 20)
      - run: npm ci && npm run build
      - uses: actions/deploy-pages@v4 (source: dist/)
```

### `vite.config.js`
```js
export default {
  base: '/quiniela-mundial-2026/',
  build: { outDir: 'dist' }
}
```

---

## 11. Plan de Migración por Fases

Cada fase termina con el portal **deployado y funcional** en producción.

| Fase | Entregable | Criterio de éxito |
|---|---|---|
| 1 | Setup: Vite + React + Zustand + estructura de carpetas + JSON extraídos | `npm run dev` muestra shell vacío; JSON accesibles |
| 2 | Servicios + store: migrar lógica pura con tests unitarios básicos | `poisson.sim()`, `tbl()`, `resolveKOTeam()` retornan resultados correctos |
| 3 | App.jsx + Sidebar + CalendarPanel | Calendario funcional con filtros y ESPN sync |
| 4 | GroupsPanel + EliminatoriaPanel | Tabla de grupos y panel de eliminatorias funcionan |
| 5 | BracketPanel | Bracket R32 con marcadores reales y probabilidades |
| 6 | PredictorPanel + H2HPanel + KlementPanel | Paneles analíticos con gráficas Chart.js |
| 7 | EscenariosPanel con Web Worker | Monte Carlo sin bloquear UI |
| 8 | QuinielaPanel + PWA + polish | Todas las features originales restauradas |

---

## 12. Criterios de Éxito

- [ ] Toda la funcionalidad del `index.html` original está disponible
- [ ] Primera carga en móvil ≤ 3s en 4G (actualmente ~5-7s)
- [ ] Ningún panel bloquea el hilo principal al cargar
- [ ] Monte Carlo no congela la UI
- [ ] Deploy automático funciona en cada push a `main`
- [ ] El código de cualquier panel se puede leer y entender sin contexto de los otros paneles

---

## 13. Lo que NO cambia

- URL de producción: `https://fjhr.github.io/quiniela-mundial-2026/`
- Funcionalidad visible para el usuario
- Modelo de datos (mismos campos, misma lógica Poisson/Klement)
- Proceso de registrar resultados (manual + ESPN sync)
- Soporte PWA (manifest.json + sw.js)
- Diseño visual y paleta de colores
