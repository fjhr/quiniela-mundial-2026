---
name: mundial2026-predictor
description: |
  Skill para analizar y predecir partidos del Mundial FIFA 2026 usando el modelo matemático de
  Joachim Klement (que predijo correctamente los últimos 3 campeones: Alemania 2014, Francia 2018,
  Argentina 2022) combinado con ranking FIFA, historial entre selecciones, forma reciente y
  distribución de Poisson para estimar marcadores y probabilidades de clasificación.
  
  USAR SIEMPRE cuando el usuario pida:
  - Predicciones o análisis de partidos del Mundial 2026
  - Quién va a ganar un partido o el torneo
  - Probabilidades de clasificación de selecciones
  - Análisis del rendimiento en el Mundial 2026
  - Generar un documento .tex con resultados del Mundial
  - Comparar selecciones usando el modelo de Klement
  - Forma reciente, ranking FIFA, o estadísticas del Mundial 2026
---

# Skill: Predictor del Mundial FIFA 2026

## Descripción del Sistema

Este skill implementa un modelo híbrido de predicción para el Mundial FIFA 2026 que combina:

1. **Modelo Econométrico de Joachim Klement** — 5 factores socio-estructurales con historial perfecto (3/3)
2. **Distribución de Poisson** — Para simular marcadores esperados partido a partido
3. **Ranking FIFA** — Calidad actual del equipo y forma reciente
4. **Historial H2H** — Resultados históricos entre selecciones
5. **Forma reciente** — Últimos 5–10 partidos antes y durante el torneo

---

## Los 5 Factores de Klement

Basados en la investigación original de Hoffmann, Ging & Ramasamy (2002), explican ~55% de los resultados:

| Factor | Descripción | Notas clave |
|--------|-------------|-------------|
| **PIB per cápita** | Capacidad de inversión en infraestructura deportiva | Rendimientos decrecientes >$60k/cápita |
| **Población** (fútbol dominante) | Tamaño del grupo de talento | Solo para países donde el fútbol es deporte principal |
| **Temperatura media anual** | Clima óptimo para desarrollo futbolístico | Pico en ~14°C; mucho frío o calor reduce desarrollo |
| **Ranking FIFA** | Calidad actual del equipo | Ajuste en tiempo real a factores estructurales |
| **Ventaja de sede** | Apoyo local en torneos en casa | Diluida en 3 co-anfitriones (USA/CAN/MEX) en 2026 |

---

## Fórmula del Modelo Klement

```
Puntuación_Klement(equipo) = 
  w1 * f(PIB_percápita)       [rendimientos decrecientes]
  + w2 * g(Población)          [solo países con fútbol dominante]
  + w3 * h(Temperatura)        [función cuadrática, pico 14°C]
  + w4 * (1 / Ranking_FIFA)    [normalizado 1-200]
  + w5 * ventaja_sede          [0.10 por co-anfitrión, 0 si no es sede]
```

Ponderaciones aproximadas: w1=0.20, w2=0.15, w3=0.10, w4=0.45, w5=0.10

---

## Modelo de Poisson para Partidos Individuales

Para cada partido entre Equipo A y Equipo B:

```
λ_A = μ_base * exp(α * ΔKlement + β * ΔRanking + γ * H2H_advantage)
λ_B = μ_base * exp(α * (-ΔKlement) + β * (-ΔRanking) + γ * (-H2H_advantage))

P(goles_A = k) = e^(-λ_A) * λ_A^k / k!
P(goles_B = m) = e^(-λ_B) * λ_B^m / m!

donde μ_base ≈ 1.45 goles (media histórica en Mundiales)
```

Luego se simulan 50,000 partidos para calcular:
- P(Victoria A), P(Empate), P(Victoria B)
- Marcador más probable
- Probabilidad de clasificación por grupo

---

## Flujo de Trabajo Estándar

### Paso 1: Recopilar datos
- Consultar `references/equipos_data.md` para datos pre-cargados de los 48 equipos
- Para datos en tiempo real: buscar web (ranking FIFA actual, forma reciente, bajas)

### Paso 2: Calcular puntuaciones Klement
Ver script `scripts/klement_model.py` — ejecutar con:
```bash
python scripts/klement_model.py --teams "España,Países Bajos" --mode match
```

### Paso 3: Aplicar Poisson
```bash
python scripts/klement_model.py --mode tournament --output resultados.tex
```

### Paso 4: Interpretar resultados
- **Alto indicador Klement (>0.7)**: Favorito claro
- **Diferencial Ranking FIFA <5**: Partido equilibrado, peso alto al Poisson
- **H2H ratio >0.6**: Equipo con ventaja psicológica/histórica significativa
- **Forma reciente (últimos 5)**: >3W = forma excelente, <1W = en crisis

### Paso 5: Generar documento LaTeX
Usar el template en `scripts/tex_template.py` o ejecutar el script completo:
```bash
python scripts/generate_report.py --output mundial2026_analisis.tex
```

---

## Guía Rápida de Indicadores

```
🟢 Probabilidad Victoria > 65%   → Favorito claro
🟡 Probabilidad Victoria 45-65%  → Ligero favorito
🔴 Probabilidad Victoria < 45%   → Underdog
⚡ Diferencial Klement > 0.15   → Diferencia estructural importante
📊 Forma: W=Ganó D=Empate L=Perdió (últimos 5, más reciente primero)
```

---

## Predicción Global 2026 (Modelo Klement)

| Resultado predicho | Equipo |
|-------------------|--------|
| 🏆 **Campeón** | **Países Bajos** |
| 🥈 Finalista | Portugal |
| 🥉 Semifinalista | Francia |
| 4° lugar | España |
| Mayor sorpresa | Brasil eliminado en R32 por Japón |

Predicción publicada el 9 de abril de 2026 — Panmure Liberum Research Note

---

## Referencias
- Ver `references/equipos_data.md` para datos completos de los 48 equipos
- Ver `references/grupos_resultados.md` para resultados actualizados al 19/06/2026
- Ver `references/metodologia_klement.md` para detalles matemáticos completos
