// src/services/espn.js

const ESPN_SLUGS = ['fifa.world', 'fifa.worldcup', 'fifa.worldcup.2026'];

// ESPN name → portal Spanish name
export const NAME_MAP = {
  'Mexico': 'México', 'South Africa': 'Sudáfrica', 'Korea Republic': 'Corea del Sur',
  'South Korea': 'Corea del Sur', 'Czech Republic': 'Chequia', 'Czechia': 'Chequia',
  'Canada': 'Canadá', 'Bosnia and Herzegovina': 'Bosnia-Herz.', 'Bosnia-Herzegovina': 'Bosnia-Herz.',
  'Qatar': 'Qatar', 'Switzerland': 'Suiza', 'Brazil': 'Brasil', 'Morocco': 'Marruecos',
  'Haiti': 'Haiti', 'Scotland': 'Escocia', 'United States': 'EE.UU.', 'USA': 'EE.UU.',
  'Paraguay': 'Paraguay', 'Australia': 'Australia', 'Turkey': 'Turquía', 'Türkiye': 'Turquía',
  'Germany': 'Alemania', 'Curaçao': 'Curazao', 'Curacao': 'Curazao',
  "Côte d'Ivoire": 'Costa de Marfil', "Cote d'Ivoire": 'Costa de Marfil', 'Ivory Coast': 'Costa de Marfil',
  'Ecuador': 'Ecuador', 'Netherlands': 'Países Bajos', 'Japan': 'Japón', 'Sweden': 'Suecia',
  'Tunisia': 'Túnez', 'Belgium': 'Bélgica', 'Egypt': 'Egipto', 'Iran': 'Irán',
  'New Zealand': 'Nueva Zelanda', 'Spain': 'España', 'Cape Verde': 'Cabo Verde',
  'Cape Verde Islands': 'Cabo Verde', 'Saudi Arabia': 'Arabia Saudita', 'Uruguay': 'Uruguay',
  'France': 'Francia', 'Senegal': 'Senegal', 'Iraq': 'Irak', 'Norway': 'Noruega',
  'Argentina': 'Argentina', 'Algeria': 'Argelia', 'Austria': 'Austria', 'Jordan': 'Jordania',
  'Portugal': 'Portugal', 'DR Congo': 'Congo RD', 'Congo DR': 'Congo RD',
  'Democratic Republic of Congo': 'Congo RD', 'Uzbekistan': 'Uzbekistán',
  'Colombia': 'Colombia', 'England': 'Inglaterra', 'Croatia': 'Croacia',
  'Ghana': 'Ghana', 'Panama': 'Panamá',
};

function espnName(team) {
  return NAME_MAP[team?.displayName] || NAME_MAP[team?.name] || team?.displayName || team?.name || '';
}

// Fetches all events from ESPN scoreboard for the tournament dates.
// Returns Promise<Array> — array of ESPN event objects.
// Throws if all slugs/bases fail.
export async function fetchFromESPN() {
  const dates = '20260611-20260726';
  for (const slug of ESPN_SLUGS) {
    for (const base of [
      'https://site.api.espn.com/apis/site/v2/sports/soccer',
      'https://site.api.espn.com/apis/v2/sports/soccer',
    ]) {
      try {
        const url = `${base}/${slug}/scoreboard?dates=${dates}&limit=200`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const events = data.events || [];
        if (!events.length) continue;
        return events;
      } catch { continue; }
    }
  }
  throw new Error('ESPN no disponible');
}

// Computes updated matchTimes object from events + sched.
// Uses fixed UTC-5 offset for KO date bucketing (avoids midnight UTC crossings).
// Returns { matchTimes: Object, changed: boolean }
export function applyESPNTimes(events, sched) {
  const matchTimes = {};
  let changed = false;

  // First pass: match group-stage events by team name
  events.forEach(ev => {
    const comp = (ev.competitions || [])[0];
    if (!comp) return;
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) return;
    const hName = espnName(home.team);
    const aName = espnName(away.team);
    const dt = ev.date || comp.date || '';
    if (!dt || !hName || !aName) return;
    // Tag event with resolved names for second pass
    ev._hName = hName;
    ev._aName = aName;
    ev._dt = dt;
  });

  // Second pass: capture KO match times by date+order (KO teams are TBD so name-matching fails)
  const byDate = {};
  events.forEach(ev => {
    const dt = ev._dt || ev.date || ((ev.competitions || [])[0] || {}).date || '';
    if (!dt) return;
    // UTC-5 offset to avoid midnight crossing (all tournament venues in Americas = CDT)
    const kd = new Date(new Date(dt).getTime() - 5 * 3600000);
    const day = kd.getUTCFullYear() + '-' +
      String(kd.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(kd.getUTCDate()).padStart(2, '0');
    if (!byDate[day]) byDate[day] = [];
    byDate[day].push(dt);
  });
  Object.values(byDate).forEach(arr => arr.sort());

  // Build schedule lookup by date for KO matches (id >= 73)
  const schedByDate = {};
  Object.entries(sched).forEach(([sid, s]) => {
    const id = parseInt(sid);
    if (id < 73 || !s?.dt) return;
    if (!schedByDate[s.dt]) schedByDate[s.dt] = [];
    schedByDate[s.dt].push(id);
  });
  Object.values(schedByDate).forEach(arr => arr.sort((a, b) => a - b));

  // Assign KO match times (always overwrite to clear stale localStorage values)
  Object.entries(schedByDate).forEach(([d, ids]) => {
    const evTimes = byDate[d] || [];
    ids.forEach((id, i) => {
      if (evTimes[i]) { matchTimes[id] = evTimes[i]; changed = true; }
    });
  });

  return { matchTimes, changed };
}

// Applies ESPN group-stage results to res array.
// Returns { updatedRes: Array, count: number }
export function applyESPNEvents(events, res) {
  const updatedRes = res.map(r => ({ ...r }));
  let count = 0;
  events.forEach(ev => {
    const comp = (ev.competitions || [])[0];
    if (!comp) return;
    const done = comp.status?.type?.completed || comp.status?.type?.name === 'STATUS_FINAL';
    if (!done) return;
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) return;
    const hName = espnName(home.team);
    const aName = espnName(away.team);
    const hg = parseInt(home.score ?? '');
    const ag = parseInt(away.score ?? '');
    if (isNaN(hg) || isNaN(ag) || !hName || !aName) return;
    const idx = updatedRes.findIndex(r =>
      (r.h === hName && r.a === aName) || (r.h === aName && r.a === hName)
    );
    if (idx === -1) return;
    const swapped = updatedRes[idx].h !== hName;
    updatedRes[idx] = { ...updatedRes[idx], hg: swapped ? ag : hg, ag: swapped ? hg : ag, p: true };
    count++;
  });
  return { updatedRes, count };
}

// Syncs knockout results from ESPN events.
// Returns array of KO updates: [{ id, h, a, hg, ag, p, pens }]
export function syncKnockout(events, resKO) {
  const updates = [];
  events.forEach(ev => {
    const comp = (ev.competitions || [])[0];
    if (!comp) return;
    const done = comp.status?.type?.completed || comp.status?.type?.name === 'STATUS_FINAL';
    if (!done) return;
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) return;
    const hName = espnName(home.team);
    const aName = espnName(away.team);
    const hg = parseInt(home.score || '');
    const ag = parseInt(away.score || '');
    if (isNaN(hg) || isNaN(ag) || !hName || !aName) return;
    const koMatch = resKO.find(k =>
      (k.h === hName && k.a === aName) || (k.h === aName && k.a === hName)
    );
    if (!koMatch) return;
    const swapped = koMatch.h !== hName;
    updates.push({
      id: koMatch.id,
      h: koMatch.h,
      a: koMatch.a,
      hg: swapped ? ag : hg,
      ag: swapped ? hg : ag,
      p: true,
      pens: '',
    });
  });
  return updates;
}
