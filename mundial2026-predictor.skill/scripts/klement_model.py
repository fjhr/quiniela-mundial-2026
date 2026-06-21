"""
mundial2026_klement.py
Implementación del modelo híbrido para el Mundial FIFA 2026:
- Modelo Econométrico de Joachim Klement (5 factores)
- Distribución de Poisson para predicción de goles
- Historial H2H, forma reciente y ranking FIFA
"""

import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional
from collections import defaultdict

# ─────────────────────────────────────────────
# DATOS BASE DE LOS 48 EQUIPOS
# ranking_fifa, pib_percapita, poblacion_M, temp_media_C,
# football_dominance (0-1), is_host
# ─────────────────────────────────────────────
EQUIPOS = {
    # Grupo A
    "México":          {"ranking": 14, "pib": 10600,  "pob": 130,   "temp": 17.5, "dom": 0.85, "host": True},
    "Sudáfrica":       {"ranking": 73, "pib": 6900,   "pob": 60,    "temp": 17.0, "dom": 0.60, "host": False},
    "Corea del Sur":   {"ranking": 22, "pib": 35000,  "pob": 52,    "temp": 12.5, "dom": 0.65, "host": False},
    "Chequia":         {"ranking": 37, "pib": 27000,  "pob": 11,    "temp": 9.5,  "dom": 0.80, "host": False},
    # Grupo B
    "Canadá":          {"ranking": 44, "pib": 52000,  "pob": 38,    "temp": 3.0,  "dom": 0.35, "host": True},
    "Bosnia-Herz.":    {"ranking": 65, "pib": 8200,   "pob": 3.2,   "temp": 11.5, "dom": 0.80, "host": False},
    "Qatar":           {"ranking": 53, "pib": 61000,  "pob": 2.9,   "temp": 28.0, "dom": 0.40, "host": False},
    "Suiza":           {"ranking": 21, "pib": 85000,  "pob": 8.7,   "temp": 9.0,  "dom": 0.65, "host": False},
    # Grupo C
    "Brasil":          {"ranking": 5,  "pib": 10200,  "pob": 215,   "temp": 25.0, "dom": 0.95, "host": False},
    "Marruecos":       {"ranking": 14, "pib": 3900,   "pob": 37,    "temp": 20.5, "dom": 0.70, "host": False},
    "Haiti":           {"ranking": 91, "pib": 1100,   "pob": 12,    "temp": 29.0, "dom": 0.55, "host": False},
    "Escocia":         {"ranking": 39, "pib": 45000,  "pob": 5.5,   "temp": 8.5,  "dom": 0.85, "host": False},
    # Grupo D
    "EE.UU.":          {"ranking": 11, "pib": 75000,  "pob": 335,   "temp": 15.0, "dom": 0.30, "host": True},
    "Paraguay":        {"ranking": 61, "pib": 6200,   "pob": 7.4,   "temp": 23.5, "dom": 0.80, "host": False},
    "Australia":       {"ranking": 24, "pib": 54000,  "pob": 26,    "temp": 21.0, "dom": 0.35, "host": False},
    "Turquía":         {"ranking": 30, "pib": 12800,  "pob": 84,    "temp": 12.5, "dom": 0.80, "host": False},
    # Grupo E
    "Alemania":        {"ranking": 9,  "pib": 51000,  "pob": 84,    "temp": 10.0, "dom": 0.90, "host": False},
    "Curazao":         {"ranking": 82, "pib": 19500,  "pob": 0.19,  "temp": 27.5, "dom": 0.65, "host": False},
    "Costa de Marfil": {"ranking": 45, "pib": 2600,   "pob": 27,    "temp": 27.0, "dom": 0.70, "host": False},
    "Ecuador":         {"ranking": 46, "pib": 6200,   "pob": 18,    "temp": 22.5, "dom": 0.80, "host": False},
    # Grupo F
    "Países Bajos":    {"ranking": 7,  "pib": 57000,  "pob": 17.9,  "temp": 10.5, "dom": 0.90, "host": False},
    "Japón":           {"ranking": 18, "pib": 34000,  "pob": 125,   "temp": 15.5, "dom": 0.75, "host": False},
    "Suecia":          {"ranking": 29, "pib": 55000,  "pob": 10.4,  "temp": 6.5,  "dom": 0.80, "host": False},
    "Túnez":           {"ranking": 33, "pib": 4100,   "pob": 12,    "temp": 19.5, "dom": 0.75, "host": False},
    # Grupo G
    "Bélgica":         {"ranking": 8,  "pib": 49000,  "pob": 11.6,  "temp": 10.5, "dom": 0.85, "host": False},
    "Egipto":          {"ranking": 42, "pib": 3900,   "pob": 105,   "temp": 22.5, "dom": 0.80, "host": False},
    "Irán":            {"ranking": 21, "pib": 7100,   "pob": 87,    "temp": 17.5, "dom": 0.75, "host": False},
    "Nueva Zelanda":   {"ranking": 99, "pib": 46000,  "pob": 5.1,   "temp": 13.0, "dom": 0.30, "host": False},
    # Grupo H
    "España":          {"ranking": 1,  "pib": 33000,  "pob": 47,    "temp": 14.5, "dom": 0.95, "host": False},
    "Cabo Verde":      {"ranking": 83, "pib": 4100,   "pob": 0.57,  "temp": 25.0, "dom": 0.80, "host": False},
    "Arabia Saudita":  {"ranking": 56, "pib": 26000,  "pob": 35,    "temp": 30.0, "dom": 0.50, "host": False},
    "Uruguay":         {"ranking": 16, "pib": 18000,  "pob": 3.5,   "temp": 18.5, "dom": 0.95, "host": False},
    # Grupo I
    "Francia":         {"ranking": 3,  "pib": 44000,  "pob": 68,    "temp": 12.0, "dom": 0.90, "host": False},
    "Senegal":         {"ranking": 19, "pib": 1700,   "pob": 18,    "temp": 29.0, "dom": 0.70, "host": False},
    "Irak":            {"ranking": 57, "pib": 5200,   "pob": 43,    "temp": 30.0, "dom": 0.65, "host": False},
    "Noruega":         {"ranking": 25, "pib": 82000,  "pob": 5.5,   "temp": 6.5,  "dom": 0.75, "host": False},
    # Grupo J
    "Argentina":       {"ranking": 2,  "pib": 12500,  "pob": 45,    "temp": 16.5, "dom": 0.97, "host": False},
    "Argelia":         {"ranking": 52, "pib": 4200,   "pob": 45,    "temp": 23.0, "dom": 0.75, "host": False},
    "Austria":         {"ranking": 34, "pib": 54000,  "pob": 9.1,   "temp": 8.0,  "dom": 0.80, "host": False},
    "Jordania":        {"ranking": 68, "pib": 4500,   "pob": 10,    "temp": 19.0, "dom": 0.60, "host": False},
    # Grupo K
    "Portugal":        {"ranking": 6,  "pib": 24000,  "pob": 10.3,  "temp": 16.5, "dom": 0.95, "host": False},
    "Congo RD":        {"ranking": 56, "pib": 600,    "pob": 100,   "temp": 26.5, "dom": 0.65, "host": False},
    "Uzbekistán":      {"ranking": 50, "pib": 2400,   "pob": 36,    "temp": 14.5, "dom": 0.55, "host": False},
    "Colombia":        {"ranking": 13, "pib": 7100,   "pob": 51,    "temp": 21.0, "dom": 0.90, "host": False},
    # Grupo L
    "Inglaterra":      {"ranking": 4,  "pib": 46000,  "pob": 56,    "temp": 10.5, "dom": 0.95, "host": False},
    "Croacia":         {"ranking": 10, "pib": 21000,  "pob": 4.0,   "temp": 13.5, "dom": 0.90, "host": False},
    "Ghana":           {"ranking": 72, "pib": 2200,   "pob": 33,    "temp": 28.0, "dom": 0.75, "host": False},
    "Panamá":          {"ranking": 30, "pib": 14000,  "pob": 4.4,   "temp": 27.5, "dom": 0.75, "host": False},
}

GRUPOS = {
    "A": ["México", "Sudáfrica", "Corea del Sur", "Chequia"],
    "B": ["Canadá", "Bosnia-Herz.", "Qatar", "Suiza"],
    "C": ["Brasil", "Marruecos", "Haiti", "Escocia"],
    "D": ["EE.UU.", "Paraguay", "Australia", "Turquía"],
    "E": ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"],
    "F": ["Países Bajos", "Japón", "Suecia", "Túnez"],
    "G": ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"],
    "H": ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"],
    "I": ["Francia", "Senegal", "Irak", "Noruega"],
    "J": ["Argentina", "Argelia", "Austria", "Jordania"],
    "K": ["Portugal", "Congo RD", "Uzbekistán", "Colombia"],
    "L": ["Inglaterra", "Croacia", "Ghana", "Panamá"],
}

# Resultados jornada 1 y 2 (al 19 junio 2026)
RESULTADOS = [
    # Jornada 1
    ("A", "México", "Sudáfrica", 2, 0),
    ("A", "Corea del Sur", "Chequia", 2, 1),
    ("B", "Canadá", "Bosnia-Herz.", 1, 1),
    ("B", "Suiza", "Qatar", 1, 1),
    ("C", "Brasil", "Marruecos", 1, 1),
    ("C", "Escocia", "Haiti", 1, 0),
    ("D", "EE.UU.", "Paraguay", 4, 1),
    ("D", "Australia", "Turquía", 2, 0),
    ("E", "Alemania", "Curazao", 7, 1),
    ("E", "Costa de Marfil", "Ecuador", 1, 0),
    ("F", "Países Bajos", "Japón", 2, 2),
    ("F", "Suecia", "Túnez", 5, 1),
    ("G", "Bélgica", "Egipto", 1, 1),
    ("G", "Irán", "Nueva Zelanda", 2, 2),
    ("H", "España", "Cabo Verde", 0, 0),
    ("H", "Arabia Saudita", "Uruguay", 1, 1),
    ("I", "Francia", "Senegal", 3, 1),
    ("I", "Noruega", "Irak", 4, 1),
    ("J", "Argentina", "Argelia", 3, 0),
    ("J", "Austria", "Jordania", 3, 1),
    ("K", "Portugal", "Congo RD", 1, 1),
    ("K", "Colombia", "Uzbekistán", 3, 1),
    ("L", "Inglaterra", "Croacia", 4, 2),
    ("L", "Ghana", "Panamá", 1, 0),
    # Jornada 2
    ("A", "Chequia", "Sudáfrica", 1, 1),
    ("A", "México", "Corea del Sur", 1, 0),
    ("B", "Suiza", "Bosnia-Herz.", 4, 1),
    ("B", "Canadá", "Qatar", 6, 0),
]

# Forma reciente (últimos 5 partidos antes del torneo + en el torneo)
FORMA = {
    "México":          ["W","W","D","W","W"],
    "Sudáfrica":       ["L","D","W","D","L"],
    "Corea del Sur":   ["W","D","W","W","D"],
    "Chequia":         ["D","W","L","D","W"],
    "Canadá":          ["W","W","D","W","W"],
    "Bosnia-Herz.":    ["D","L","D","W","L"],
    "Qatar":           ["D","L","L","D","L"],
    "Suiza":           ["W","W","D","W","D"],
    "Brasil":          ["W","W","D","W","W"],
    "Marruecos":       ["W","D","W","D","W"],
    "Haiti":           ["L","D","L","L","D"],
    "Escocia":         ["W","D","W","W","D"],
    "EE.UU.":          ["W","W","D","W","W"],
    "Paraguay":        ["D","L","W","D","L"],
    "Australia":       ["W","D","W","D","W"],
    "Turquía":         ["D","W","L","D","W"],
    "Alemania":        ["W","W","W","D","W"],
    "Curazao":         ["D","L","D","L","W"],
    "Costa de Marfil": ["W","D","W","D","L"],
    "Ecuador":         ["D","W","D","L","D"],
    "Países Bajos":    ["W","W","D","W","W"],
    "Japón":           ["W","D","W","W","D"],
    "Suecia":          ["W","W","D","W","W"],
    "Túnez":           ["D","W","D","L","D"],
    "Bélgica":         ["W","D","D","W","D"],
    "Egipto":          ["D","W","D","D","L"],
    "Irán":            ["W","D","W","D","W"],
    "Nueva Zelanda":   ["D","L","D","D","W"],
    "España":          ["W","W","W","D","W"],
    "Cabo Verde":      ["W","D","W","D","W"],
    "Arabia Saudita":  ["D","L","W","D","D"],
    "Uruguay":         ["W","D","W","D","W"],
    "Francia":         ["W","W","D","W","W"],
    "Senegal":         ["W","W","D","W","D"],
    "Irak":            ["D","W","L","D","D"],
    "Noruega":         ["W","W","D","W","W"],
    "Argentina":       ["W","W","W","D","W"],
    "Argelia":         ["D","W","D","L","D"],
    "Austria":         ["W","D","W","W","D"],
    "Jordania":        ["L","D","W","L","D"],
    "Portugal":        ["W","W","D","W","D"],
    "Congo RD":        ["D","W","D","D","L"],
    "Uzbekistán":      ["W","D","D","L","D"],
    "Colombia":        ["W","W","W","D","W"],
    "Inglaterra":      ["W","W","D","W","W"],
    "Croacia":         ["W","D","W","D","L"],
    "Ghana":           ["D","W","D","W","D"],
    "Panamá":          ["D","L","W","D","L"],
}

# H2H simplificado (win_ratio del equipo A vs B históricamente)
H2H = {
    # (equipo_a, equipo_b): win_ratio_a (victorias_a / total_partidos)
    ("Brasil", "Marruecos"): 0.75,
    ("Países Bajos", "Japón"): 0.70,
    ("Argentina", "Francia"): 0.45,
    ("España", "Países Bajos"): 0.40,
    ("Francia", "Países Bajos"): 0.50,
    ("Portugal", "Colombia"): 0.55,
    ("Inglaterra", "Francia"): 0.45,
    ("Alemania", "Argentina"): 0.52,
}

def h2h_ratio(a: str, b: str) -> float:
    """Retorna win ratio histórico de A vs B (default 0.5 si no hay datos)."""
    if (a, b) in H2H:
        return H2H[(a, b)]
    if (b, a) in H2H:
        return 1.0 - H2H[(b, a)]
    return 0.50

def forma_score(equipo: str) -> float:
    """Convierte forma reciente en score 0-1."""
    f = FORMA.get(equipo, ["D","D","D","D","D"])
    valores = {"W": 1.0, "D": 0.4, "L": 0.0}
    return sum(valores[r] * (0.7 ** i) for i, r in enumerate(f)) / sum(0.7 ** i for i in range(len(f)))

def klement_score(equipo: str) -> float:
    """Calcula la puntuación compuesta del modelo Klement (0-1)."""
    d = EQUIPOS[equipo]
    
    # Factor 1: PIB per cápita (rendimientos decrecientes)
    pib = d["pib"]
    if pib < 60000:
        pib_score = min(pib / 60000, 1.0)
    else:
        pib_score = 1.0 - 0.2 * ((pib - 60000) / 60000)
        pib_score = max(pib_score, 0.6)
    
    # Factor 2: Población x dominancia del fútbol
    pob_score = min(math.log(d["pob"] * d["dom"] + 1) / math.log(300), 1.0)
    
    # Factor 3: Temperatura (función cuadrática, pico en 14°C)
    temp = d["temp"]
    temp_score = max(0, 1.0 - ((temp - 14.0) ** 2) / 200.0)
    
    # Factor 4: Ranking FIFA (invertido, normalizado)
    ranking_score = max(0, (101 - d["ranking"]) / 100.0)
    
    # Factor 5: Ventaja de sede (diluida entre 3 co-anfitriones)
    host_score = 0.10 if d["host"] else 0.0
    
    # Ponderaciones del modelo Klement
    score = (0.20 * pib_score 
             + 0.15 * pob_score 
             + 0.10 * temp_score 
             + 0.45 * ranking_score 
             + 0.10 * host_score)
    
    return round(score, 4)

def lambda_goles(kl_a: float, kl_b: float, rank_a: int, rank_b: int, 
                  h2h_a: float, forma_a: float) -> float:
    """Lambda de Poisson para goles del equipo A."""
    mu_base = 1.45
    
    diff_klement = kl_a - kl_b
    diff_ranking = (rank_b - rank_a) / 50.0  # normalizado
    h2h_adj = (h2h_a - 0.5) * 0.3
    forma_adj = (forma_a - 0.5) * 0.2
    
    lam = mu_base * math.exp(0.4 * diff_klement + 0.3 * diff_ranking 
                              + 0.2 * h2h_adj + 0.1 * forma_adj)
    return max(0.3, min(lam, 4.5))

def poisson_prob(lam: float, k: int) -> float:
    """P(X=k) para distribución Poisson con parámetro lambda."""
    return math.exp(-lam) * (lam ** k) / math.factorial(k)

def simular_partido(equipo_a: str, equipo_b: str, n_sims: int = 50000) -> Dict:
    """Simula n_sims partidos y devuelve probabilidades y marcador más probable."""
    kl_a = klement_score(equipo_a)
    kl_b = klement_score(equipo_b)
    rank_a = EQUIPOS[equipo_a]["ranking"]
    rank_b = EQUIPOS[equipo_b]["ranking"]
    h2h_a = h2h_ratio(equipo_a, equipo_b)
    forma_a = forma_score(equipo_a)
    forma_b = forma_score(equipo_b)
    
    lam_a = lambda_goles(kl_a, kl_b, rank_a, rank_b, h2h_a, forma_a)
    lam_b = lambda_goles(kl_b, kl_a, rank_b, rank_a, 1-h2h_a, forma_b)
    
    resultados = defaultdict(int)
    wins_a, draws, wins_b = 0, 0, 0
    goles_a_total, goles_b_total = 0, 0
    
    for _ in range(n_sims):
        # Muestrear goles con Poisson
        ga = 0
        r = random.random()
        acum = 0
        for k in range(20):
            acum += poisson_prob(lam_a, k)
            if r < acum:
                ga = k
                break
        
        gb = 0
        r = random.random()
        acum = 0
        for k in range(20):
            acum += poisson_prob(lam_b, k)
            if r < acum:
                gb = k
                break
        
        resultados[(ga, gb)] += 1
        goles_a_total += ga
        goles_b_total += gb
        
        if ga > gb:
            wins_a += 1
        elif ga == gb:
            draws += 1
        else:
            wins_b += 1
    
    marcador_probable = max(resultados, key=resultados.get)
    
    return {
        "equipo_a": equipo_a,
        "equipo_b": equipo_b,
        "klement_a": kl_a,
        "klement_b": kl_b,
        "lambda_a": round(lam_a, 2),
        "lambda_b": round(lam_b, 2),
        "p_victoria_a": round(wins_a / n_sims * 100, 1),
        "p_empate": round(draws / n_sims * 100, 1),
        "p_victoria_b": round(wins_b / n_sims * 100, 1),
        "marcador_probable": f"{marcador_probable[0]}-{marcador_probable[1]}",
        "prob_marcador": round(resultados[marcador_probable] / n_sims * 100, 1),
        "goles_esperados_a": round(goles_a_total / n_sims, 2),
        "goles_esperados_b": round(goles_b_total / n_sims, 2),
        "forma_a": forma_score(equipo_a),
        "forma_b": forma_score(equipo_b),
        "h2h": h2h_a,
    }

def calcular_clasificacion_grupo(grupo_letra: str) -> List[Tuple]:
    """Calcula la tabla de clasificación del grupo basada en resultados reales."""
    equipos = GRUPOS[grupo_letra]
    tabla = {e: {"pts": 0, "gf": 0, "gc": 0, "gd": 0, "j": 0, "g": 0, "e": 0, "p": 0} for e in equipos}
    
    for r in RESULTADOS:
        if r[0] == grupo_letra:
            _, ea, eb, ga, gb = r
            if ea in tabla and eb in tabla:
                tabla[ea]["gf"] += ga; tabla[ea]["gc"] += gb
                tabla[ea]["gd"] += ga - gb; tabla[ea]["j"] += 1
                tabla[eb]["gf"] += gb; tabla[eb]["gc"] += ga
                tabla[eb]["gd"] += gb - ga; tabla[eb]["j"] += 1
                
                if ga > gb:
                    tabla[ea]["pts"] += 3; tabla[ea]["g"] += 1
                    tabla[eb]["p"] += 1
                elif ga == gb:
                    tabla[ea]["pts"] += 1; tabla[ea]["e"] += 1
                    tabla[eb]["pts"] += 1; tabla[eb]["e"] += 1
                else:
                    tabla[eb]["pts"] += 3; tabla[eb]["g"] += 1
                    tabla[ea]["p"] += 1
    
    clasificacion = sorted(tabla.items(), 
                          key=lambda x: (x[1]["pts"], x[1]["gd"], x[1]["gf"]), 
                          reverse=True)
    return clasificacion

def predecir_jornada3() -> List[Dict]:
    """Predice los resultados de la jornada 3 para todos los grupos."""
    predicciones = []
    
    # Partidos pendientes jornada 3 (y jornada 2 parcial para grupos tarde)
    partidos_j3 = [
        # Jornada 2 pendiente (hoy 19 junio)
        ("C", "Escocia", "Marruecos"),
        ("C", "Brasil", "Haiti"),
        ("D", "EE.UU.", "Australia"),
        ("D", "Turquía", "Paraguay"),
        # Jornada 2 (20-22 junio)
        ("E", "Alemania", "Costa de Marfil"),
        ("E", "Ecuador", "Curazao"),
        ("F", "Países Bajos", "Suecia"),
        ("F", "Túnez", "Japón"),
        ("G", "Bélgica", "Irán"),
        ("G", "Nueva Zelanda", "Egipto"),
        ("H", "España", "Arabia Saudita"),
        ("H", "Uruguay", "Cabo Verde"),
        ("I", "Francia", "Irak"),
        ("I", "Noruega", "Senegal"),
        ("J", "Argentina", "Austria"),
        ("J", "Jordania", "Argelia"),
        ("K", "Portugal", "Uzbekistán"),
        ("K", "Colombia", "Congo RD"),
        ("L", "Inglaterra", "Ghana"),
        ("L", "Panamá", "Croacia"),
        # Jornada 3 (24-27 junio)
        ("A", "Chequia", "México"),
        ("A", "Sudáfrica", "Corea del Sur"),
        ("B", "Suiza", "Canadá"),
        ("B", "Bosnia-Herz.", "Qatar"),
        ("C", "Escocia", "Brasil"),
        ("C", "Marruecos", "Haiti"),
        ("D", "Turquía", "EE.UU."),
        ("D", "Paraguay", "Australia"),
        ("E", "Ecuador", "Alemania"),
        ("E", "Curazao", "Costa de Marfil"),
        ("F", "Japón", "Suecia"),
        ("F", "Túnez", "Países Bajos"),
        ("G", "Egipto", "Irán"),
        ("G", "Nueva Zelanda", "Bélgica"),
        ("H", "Cabo Verde", "Arabia Saudita"),
        ("H", "Uruguay", "España"),
        ("I", "Noruega", "Francia"),
        ("I", "Senegal", "Irak"),
        ("J", "Argelia", "Austria"),
        ("J", "Jordania", "Argentina"),
        ("K", "Colombia", "Portugal"),
        ("K", "Congo RD", "Uzbekistán"),
        ("L", "Panamá", "Inglaterra"),
        ("L", "Croacia", "Ghana"),
    ]
    
    for grupo, ea, eb in partidos_j3:
        pred = simular_partido(ea, eb)
        pred["grupo"] = grupo
        predicciones.append(pred)
    
    return predicciones

def generar_resumen_grupos() -> Dict:
    """Genera resumen completo de todos los grupos."""
    resumen = {}
    for letra in GRUPOS:
        tabla = calcular_clasificacion_grupo(letra)
        resumen[letra] = tabla
    return resumen

if __name__ == "__main__":
    random.seed(2026)
    
    print("=" * 60)
    print("MODELO KLEMENT — MUNDIAL FIFA 2026")
    print("=" * 60)
    
    print("\n📊 PUNTUACIONES KLEMENT POR EQUIPO (Top 15):")
    scores = [(e, klement_score(e)) for e in EQUIPOS]
    scores.sort(key=lambda x: x[1], reverse=True)
    for i, (e, s) in enumerate(scores[:15], 1):
        print(f"  {i:2d}. {e:<20} {s:.4f}")
    
    print("\n📅 CLASIFICACIÓN ACTUAL (Jornada 2 completada):")
    for letra in GRUPOS:
        tabla = calcular_clasificacion_grupo(letra)
        print(f"\n  Grupo {letra}:")
        for pos, (eq, d) in enumerate(tabla, 1):
            print(f"    {pos}. {eq:<22} {d['j']}J {d['g']}V {d['e']}E {d['p']}D "
                  f"GF:{d['gf']} GC:{d['gc']} GD:{d['gd']:+d} Pts:{d['pts']}")
    
    print("\n⚽ PREDICCIONES PARTIDOS PENDIENTES:")
    predicciones = predecir_jornada3()
    for p in predicciones[:12]:
        indicador = "🟢" if p["p_victoria_a"] > 65 else ("🔴" if p["p_victoria_a"] < 35 else "🟡")
        print(f"\n  Grupo {p['grupo']}: {p['equipo_a']} vs {p['equipo_b']}")
        print(f"    {indicador} Victoria A: {p['p_victoria_a']}% | "
              f"Empate: {p['p_empate']}% | Victoria B: {p['p_victoria_b']}%")
        print(f"    📐 Marcador más probable: {p['marcador_probable']} "
              f"({p['prob_marcador']}%) | λ={p['lambda_a']:.2f} vs {p['lambda_b']:.2f}")
        print(f"    🔬 Klement: {p['klement_a']:.3f} vs {p['klement_b']:.3f} | "
              f"H2H: {p['h2h']:.2f}")
