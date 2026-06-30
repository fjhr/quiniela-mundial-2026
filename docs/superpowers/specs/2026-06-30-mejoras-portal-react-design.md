# Mejoras Portal React — Paridad con Portal Estático + UI Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Llevar el nuevo portal React a paridad de features con el portal estático original (BK2/index.html) y mejorar el frontend para que se vea completo y polished.

**Architecture:** Cuatro áreas independientes: (1) App Shell — sidebar con secciones y header mejorado, (2) MatchCard con barras de probabilidad inline, (3) EstadísticasPanel nuevo, (4) QuinielaPanel con integración GolPredictor. Ninguna área requiere dependencias nuevas — Chart.js ya instalado, poisson.js ya calcula probabilidades, proxy GolPredictor ya deployado.

**Tech Stack:** React 18, Vite 6, Zustand 4, Chart.js 4 / react-chartjs-2 5, poisson.js (sim()), proxy Worker en `golpredictor.fernando-fjhr.workers.dev`

---

## Global Constraints

- Stack: React 18 + Vite 6 + Zustand 4. Sin dependencias nuevas.
- CSS: variables CSS existentes (`--bg-950`, `--bg-900`, `--bg-800`, `--bg-700`, `--blue`, `--gold`, `--green`, `--red`, `--text-50`, `--text-200`, `--text-400`, `--text-500`, `--r-sm`, `--r-md`, `--r-lg`). Sin CSS-in-JS ni librerías de estilos.
- Iconos: emoji Unicode. Sin librerías de iconos.
- Tests: mantener los 32 tests existentes en verde. No se requieren tests nuevos para componentes UI puros.
- `poisson.js` exports: `klem(team, teams)`, `sim(h, a, teams)` → `{pW, pD, pL, lA, lB, kA, kB}`, `tbl(grp, res)` → `[{t, j, gf, gc, gd, pts}]`
- `matchStore.js` state: `{res, resKO, lastSync}` donde `res[i]` tiene `{id, h, a, hg, ag, p, date, grp}` y `resKO[i]` tiene `{id, h, a, hg, ag, pens, p}`
- `uiStore.js` state: `{panel, activeGroup, theme}` con actions `setPanel(p)`, `setGroup(g)`, `setTheme(t)`
- GolPredictor Pool ID: `'0,b2bfbc17-41b4-43c6-a48a-6c2ad5baa31d'`
- GolPredictor proxy URL: `https://golpredictor.fernando-fjhr.workers.dev`
- Rutas proxy: `POST /login` body `{username, password}` → `{cookie, username}` | `GET /pool` headers `X-GP-Cookie`, `X-GP-Pid` → HTML
- `teams` data: `import teams from '../data/teams.json'` — shape `{[name]: {fl, r, gdp, ...}}`
- `gr` data: `import gr from '../data/gr.json'` — shape `{[group]: [teamName, ...]}`
- `ko-bracket.json`: array de `{id, rnd, sh, sa}` donde `rnd` ∈ `'R32'|'R16'|'QF'|'SF'|'F'`

---

## Área 1: App Shell

### Sidebar (`src/components/Sidebar.jsx` — reescribir)

**Estructura:**
```
[Logo] 🌍 Mundial FIFA 2026        [< colapsar]
       · Portal Predictivo

TORNEO
  📅 Calendario  [HOY]
  👥 Fase de Grupos  [A-L grid]
  ⚔️ Eliminatorias
  🏆 Bracket R32

ANÁLISIS
  🎯 Predictor
  ↔️ Head-to-Head
  ⭐ Klement
  📊 Estadísticas

SIMULACIÓN
  📋 Quiniela
  🎲 Escenarios Monte Carlo

─────────────────────────────
Partidos    72          [gold]
Goles       215         [gold]
G/P         2.99        [gold]
Favorito K. EE.UU. 🇺🇸  [gold]
```

**Comportamiento:**
- Desktop: sidebar colapsable a 58px (solo iconos), botón `<` / `>` en el header
- Mobile: sidebar oculto por defecto, hamburger en header lo muestra con backdrop
- Panel activo: `.active` en azul
- Grupo activo en A-L grid: `.active` en azul
- Stats footer: calculados de `res` del store en tiempo real
  - Partidos: `res.filter(r => r.p).length`
  - Goles: suma de `hg + ag` de partidos jugados
  - G/P: goles / partidos (2 decimales), `'—'` si 0 partidos
  - Favorito K.: equipo con mayor `klem(team, teams)` entre todos los equipos

**Props:** `{ panel, activeGroup, onNav(panel, group?) }`

**Estado collapse:** `useState(false)` local. No va al store.

**Responsivo:** breakpoint 768px. En mobile el sidebar es un drawer sobre el contenido (position fixed, z-index 200) con backdrop oscuro al hacer clic afuera.

### Header (`src/components/PageHeader.jsx` — componente nuevo)

```
[☰ hamburger (mobile)]  [Título panel]        [● Sincronizar] [Restaurar]
                         [subtítulo]
```

**Props:** `{ title, subtitle, onSync, syncing, onRestore, lastSync }`

- Botón `Sincronizar`: llama `onSync()`, muestra spinner animado mientras `syncing=true`
- Botón `Restaurar`: llama `onRestore()`, confirma con `window.confirm`
- `lastSync`: string formateado "hace Xmin" o "hace Xh" calculado de `matchStore.lastSync`
- `subtitle`: prop string calculado en `App.jsx` según el panel activo

### App.jsx (modificar)

- Importar `PageHeader`
- Pasar `onSync` y `onRestore` desde App al Header (lógica ESPN sync ya existe)
- Pasar `title` y `subtitle` según panel activo:

| Panel | Title | Subtitle |
|-------|-------|----------|
| calendar | `📅 Calendario` | `Partidos ordenados por fecha · filtra por fase o país sede` |
| groups | `👥 Fase de Grupos` | `Tabla de posiciones y resultados por grupo` |
| eliminatoria | `⚔️ Eliminatorias` | `Resultados de la fase eliminatoria` |
| bracket | `🏆 Bracket R32` | `Cuadro completo desde 32avos` |
| predictor | `🎯 Predictor` | `Probabilidades Poisson por partido` |
| h2h | `↔️ Head-to-Head` | `Comparación directa entre dos equipos` |
| klement | `⭐ Klement` | `Ranking de forma actual` |
| stats | `📊 Estadísticas` | `Resumen del torneo` |
| quiniela | `📋 Quiniela` | `Tus predicciones y el pool de GolPredictor` |
| escenarios | `🎲 Escenarios Monte Carlo` | `Simulaciones Monte Carlo` |

---

## Área 2: MatchCard con probabilidades

### MatchCard (`src/components/MatchCard.jsx` — modificar)

**Nueva prop signature:** `MatchCard({ match, pW, pD, pL, onPredict, onH2H })`

- `pW`, `pD`, `pL`: floats 0-1. Si undefined → no mostrar barras.
- `onPredict`: callback → `setPanel('predictor')` + preseleccionar partido
- `onH2H`: callback → `setPanel('h2h')` + preseleccionar equipos

**Layout de un partido pendiente:**

```
[R32]  🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra  vs  🇨🇩 Congo RD    🕘 21:00
[████████████████████░░░░░░░░░░░░]
 70%  local       17%  emp.     13%  visita
[🎯 Predecir]              [↔️ H2H]
```

**Layout de un partido jugado:**

```
[Grupos]  🇲🇽 México  2 – 0  🇿🇦 Sudáfrica    ✓ Jugado
          (sin barras, sin botones de acción)
```

**Badge de fase:**
- `grp` definido → `'Grupos'`
- `rnd === 'R32'` → `'32avos'`
- `rnd === 'R16'` → `'16avos'`
- `rnd === 'QF'` → `'Cuartos'`
- `rnd === 'SF'` → `'Semis'`
- `rnd === 'F'` → `'Final'`

**Barras de probabilidad:**
- Barra única dividida en 3 segmentos: verde (local) / gris (empate) / rojo (visita)
- Porcentajes redondeados a 1 decimal
- Ancho de cada segmento: `pW * 100%`, `pD * 100%`, `pL * 100%`

### CalendarPanel (`src/panels/CalendarPanel.jsx` — modificar)

- Importar `sim` de `../services/poisson.js` y `teams` de `../data/teams.json`
- Para cada partido pendiente (`!match.p`), calcular `const {pW, pD, pL} = sim(match.h, match.a, teams)`
- Pasar `pW`, `pD`, `pL` a `MatchCard`
- Para partidos KO, los equipos pueden ser slots (ej. `'1A'`) — si `teams[match.h]` no existe, no pasar probabilidades (los slots no tienen stats Poisson hasta que se conozca el equipo)
- Pasar `onPredict={() => { setPanel('predictor'); /* preselect */ }}` y `onH2H` como callbacks

**Nota:** `sim()` es síncrono y rápido. Se puede llamar directamente en el render sin memoización especial para los ~72 partidos del torneo.

---

## Área 3: EstadísticasPanel

### `src/panels/EstadísticasPanel.jsx` → `src/panels/StatsPanel.jsx` (nuevo archivo)

**Importaciones:**
```js
import { useMatchStore } from '../store/matchStore.js';
import { klem } from '../services/poisson.js';
import teams from '../data/teams.json';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend);
```

**Secciones del panel:**

**1. KPIs (4 tarjetas en grid 2×2):**
- Partidos jugados / de total
- Goles totales + G/P
- Victorias local + %
- Empates + %

**2. Donut chart — distribución de resultados:**
- Verde: victorias local, gris: empates, rojo: victorias visitante
- Leyenda abajo

**3. Top 8 equipos goleadores:**
- Barra horizontal proporcional al máximo
- Bandera + nombre + goles

**4. Top 6 partidos más goleadores:**
- Fila: `🏴󠁧󠁢󠁥󠁮󠁧󠁿 Ing  2 – 3  🇨🇩 Congo  5⚽`

---

## Área 4: QuinielaPanel + GolPredictor

### `src/panels/QuinielaPanel.jsx` — reescribir con 2 tabs

**Tab 1: Mis Predicciones** (código actual, sin cambios funcionales)
- Botones de selección por partido R32
- Score propio (aciertos / total)

**Tab 2: GolPredictor Pool**

**Estado:**
```js
const [gpCookie, setGpCookie] = useState(() => localStorage.getItem('gp-cookie') || '');
const [gpUser, setGpUser] = useState(() => localStorage.getItem('gp-user') || '');
const [gpData, setGpData] = useState(null);   // parsed pool data
const [gpStatus, setGpStatus] = useState('idle'); // 'idle'|'logging'|'loading'|'error'
const [showLogin, setShowLogin] = useState(false);
```

**Constantes:**
```js
const GP_URL = 'https://golpredictor.fernando-fjhr.workers.dev';
const GP_PID = '0,b2bfbc17-41b4-43c6-a48a-6c2ad5baa31d';
```

**Flujo login:**
1. Si no hay cookie → mostrar formulario username/password
2. `POST GP_URL/login` con `{username, password}` → `{cookie, username}`
3. Guardar cookie + username en `localStorage` ('gp-cookie', 'gp-user')
4. Disparar fetch del pool automáticamente

**Flujo fetch pool:**
1. `GET GP_URL/pool` con headers `{'X-GP-Cookie': gpCookie, 'X-GP-Pid': GP_PID}`
2. Si 401 → limpiar cookie, mostrar login
3. Parsear HTML con `parseGPHtml(html)` (función local)
4. Guardar en `gpData`

**`parseGPHtml(html)`:** Port directo de la función del portal viejo — usa `DOMParser`, encuentra la tabla más grande, extrae headers y rows, filtra filas de paginador.

**Render del pool:**
- Tabla con scroll horizontal
- Columna fija: nombre participante
- Columnas de partidos con pick
- Columna de puntos (detectada por nombre "punt/pts/score")
- Botón `Actualizar` y `Cerrar sesión`

---

## Orden de implementación (8 tareas)

1. `PageHeader` componente nuevo + integración en `App.jsx`
2. `Sidebar` reescritura completa con secciones + grid + collapse + stats footer
3. `MatchCard` — agregar barras de probabilidad + phase badge + botones Predecir/H2H
4. `CalendarPanel` — calcular y pasar probabilidades a MatchCard
5. `StatsPanel` — nuevo panel con KPIs + donut + goleadores + partidos
6. Registrar `StatsPanel` en `App.jsx` + agregar `'stats'` al uiStore
7. `QuinielaPanel` — agregar Tab 2 GolPredictor (login + fetch + parse + render)
8. CSS polish general — espaciados, tipografía, hover states, mobile responsivo

---

## Criterios de éxito

- Sidebar muestra secciones, colapsa en desktop, es drawer en mobile
- Stats footer calcula valores correctos en tiempo real
- Partidos pendientes en Calendario muestran barras de probabilidad
- Botones Predecir/H2H navegan al panel correcto
- EstadísticasPanel muestra datos correctos del torneo
- QuinielaPanel Tab 2 hace login, fetcha y muestra la tabla del pool
- Los 32 tests existentes siguen en verde
