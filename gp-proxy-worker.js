/**
 * GolPredictor Proxy Worker — con autenticación automática
 * ─────────────────────────────────────────────────────────
 * DEPLOY (sin build, directo en el editor del dashboard):
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker
 *   2. Clic "Edit Code" → borra el código de ejemplo → pega este archivo completo
 *   3. Deploy → copia la URL (ej: https://gp-proxy.tunombre.workers.dev)
 *
 * Rutas:
 *   POST /login  { username, password }  →  { cookie, username }
 *   GET  /pool   Header: X-GP-Cookie, X-GP-Pid  →  HTML del pool
 */

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-GP-Cookie, X-GP-Pid, X-GP-Url'
};
var GP_BASE = 'https://www.golpredictor.com';

function extractAllHidden(h) {
  var fields = {};
  var re = /<input[^>]+>/gi;
  var m;
  while ((m = re.exec(h)) !== null) {
    var tag = m[0];
    if (!/type=["']?hidden["']?/i.test(tag)) continue;
    var nm = (tag.match(/name=["']([^"']+)["']/i) || [])[1];
    var vl = (tag.match(/value=["']([^"']*)["']/i) || [])[1] || '';
    if (nm) fields[nm] = vl;
  }
  return fields;
}
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  var url = new URL(request.url);

  // ── POST /login ──────────────────────────────────────────────
  if (url.pathname === '/login' && request.method === 'POST') {
    var body;
    try { body = await request.json(); }
    catch (e) { return jsonResp({ error: 'bad-request' }, 400); }

    var username = body.username || '';
    var password = body.password || '';
    if (!username || !password) return jsonResp({ error: 'missing-credentials' }, 400);

    // Paso 1: obtener tokens ASP.NET del formulario de login
    var loginPage;
    try {
      loginPage = await fetch(GP_BASE + '/login.aspx', {
        headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'es-ES,es;q=0.9' }
      });
    } catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }

    var loginHtml = await loginPage.text();
    var vs  = extractField(loginHtml, '__VIEWSTATE');
    var vsg = extractField(loginHtml, '__VIEWSTATEGENERATOR');
    var ev  = extractField(loginHtml, '__EVENTVALIDATION');
    var tsm = extractField(loginHtml, 'ctl00_ScriptManager_TSM');

    // Paso 2: POST con credenciales
    var params = new URLSearchParams();
    params.append('ctl00_ScriptManager_TSM', tsm);
    params.append('__VIEWSTATE', vs);
    params.append('__VIEWSTATEGENERATOR', vsg);
    params.append('__EVENTVALIDATION', ev);
    params.append('ctl00$ContentPlaceInner$txtUserName', username);
    params.append('ctl00$ContentPlaceInner$txtPassword', password);
    params.append('ctl00$ContentPlaceInner$btnLogin.x', '10');
    params.append('ctl00$ContentPlaceInner$btnLogin.y', '10');

    var authResp;
    try {
      authResp = await fetch(GP_BASE + '/login.aspx', {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Referer': GP_BASE + '/login.aspx'
        },
        body: params.toString()
      });
    } catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }

    // Login exitoso = redirección 302 con Set-Cookie
    if (authResp.status !== 302 && authResp.status !== 301) {
      return jsonResp({ error: 'auth', message: 'Usuario o contrasena incorrectos' }, 401);
    }

    // Capturar TODAS las cookies (ASP.NET_SessionId + .ASPXAUTH + otras)
    var allCookies = [];
    try {
      var cookieHeaders = authResp.headers.getAll('set-cookie');
      cookieHeaders.forEach(function(h) {
        var pair = h.split(';')[0].trim();
        if (pair) allCookies.push(pair);
      });
    } catch(e) {
      // Fallback: parsear header único
      var raw = authResp.headers.get('Set-Cookie') || '';
      raw.split(/,(?=[^ ])/).forEach(function(seg) {
        var pair = seg.split(';')[0].trim();
        if (pair) allCookies.push(pair);
      });
    }
    if (!allCookies.length) {
      return jsonResp({ error: 'auth', message: 'No se pudo obtener la sesion' }, 401);
    }

    return jsonResp({ cookie: allCookies.join('; '), username: username });
  }

  // ── GET /pool ────────────────────────────────────────────────
  if (url.pathname === '/pool' && request.method === 'GET') {
    var cookie = request.headers.get('X-GP-Cookie') || '';
    var pid    = request.headers.get('X-GP-Pid')    || '';
    if (!cookie || !pid) return jsonResp({ error: 'missing-params' }, 400);

    var gpUrl = GP_BASE + '/pooldetail.aspx?pid=' + encodeURIComponent(pid);
    var commonHdrs = {
      'Cookie': cookie,
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Referer': gpUrl
    };

    // Página 1
    var gpResp;
    try {
      gpResp = await fetch(gpUrl, { redirect: 'manual', headers: commonHdrs });
    } catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }

    if (gpResp.status === 301 || gpResp.status === 302) {
      return jsonResp({ error: 'auth', message: 'Sesion expirada' }, 401);
    }

    var html = await gpResp.text();
    if (html.indexOf('login.aspx') >= 0 && html.indexOf('ReturnUrl') >= 0) {
      return jsonResp({ error: 'auth', message: 'Sesion expirada' }, 401);
    }

    // Detectar target del paginador (comillas simples o dobles)
    function detectTarget(h) {
      var m = h.match(/__doPostBack\(['"]([^'"]+)['"],\s*['"]Page\$(?:Next|\d+)['"]\)/);
      return m ? m[1] : null;
    }

    // Siguiente argumento de página — toma el MÍNIMO número mayor al actual
    function nextArg(h, curPg) {
      if (/Page\$Next/.test(h)) return 'Page$Next';
      var re = /Page\$(\d+)/g; var m; var best = Infinity;
      while ((m = re.exec(h)) !== null) {
        var n = parseInt(m[1]);
        if (n > curPg && n < best) best = n;
      }
      return isFinite(best) ? 'Page$' + best : null;
    }

    var combinedHtml = html;
    var currentPage = 1;
    var MAX_PAGES = 50;
    var target = detectTarget(html);
    var debugInfo = 'target=' + (target||'none');

    while (target && currentPage < MAX_PAGES) {
      // Snapshot del final del HTML acumulado para buscar paginación
      var tail = combinedHtml.slice(-80000);
      var arg = nextArg(tail, currentPage);
      if (!arg) break;

      // Extraer todos los campos ocultos de la página actual y sobreescribir el evento
      var hidden = extractAllHidden(html);
      hidden['__EVENTTARGET']  = target;
      hidden['__EVENTARGUMENT'] = arg;
      // Asegurar que no vengan campos de scroll que puedan interferir
      delete hidden['__SCROLLPOSITIONX'];
      delete hidden['__SCROLLPOSITIONY'];
      var params = new URLSearchParams();
      Object.keys(hidden).forEach(function(k) { params.append(k, hidden[k]); });

      var pgResp;
      try {
        pgResp = await fetch(gpUrl, {
          method: 'POST',
          redirect: 'manual',
          headers: Object.assign({}, commonHdrs, {
            'Content-Type': 'application/x-www-form-urlencoded'
          }),
          body: params.toString()
        });
      } catch (e) { debugInfo += ' fetch-err'; break; }

      if (!pgResp || pgResp.status !== 200) { debugInfo += ' status=' + (pgResp ? pgResp.status : 'null'); break; }
      var pgHtml = await pgResp.text();

      // Redirigió a login → sesión expiró
      if (pgHtml.indexOf('login.aspx') >= 0 && pgHtml.indexOf('ReturnUrl') >= 0) break;

      combinedHtml += pgHtml;
      currentPage++;
      debugInfo += '→pg' + currentPage;
      html = pgHtml; // usar hidden fields de esta página para la siguiente
      var newTarget = detectTarget(pgHtml);
      target = newTarget || target;

      if (!nextArg(pgHtml, currentPage)) break;
    }

    return new Response(combinedHtml, {
      headers: Object.assign({}, CORS_HEADERS, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-GP-Pages': String(currentPage),
        'X-GP-Debug': debugInfo
      })
    });
  }

  // ── GET /standings ───────────────────────────────────────────
  if (url.pathname === '/standings' && request.method === 'GET') {
    var cookie = request.headers.get('X-GP-Cookie') || '';
    var pid    = request.headers.get('X-GP-Pid')    || '';
    if (!cookie || !pid) return jsonResp({ error: 'missing-params' }, 400);

    var commonHdrs = {
      'Cookie': cookie, 'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Referer': GP_BASE + '/pooldetail.aspx?pid=' + encodeURIComponent(pid)
    };

    // Try candidate URLs for the standings page
    var candidates = [
      GP_BASE + '/poolclasificacion.aspx?pid=' + encodeURIComponent(pid),
      GP_BASE + '/poolposiciones.aspx?pid=' + encodeURIComponent(pid),
      GP_BASE + '/poolclasif.aspx?pid=' + encodeURIComponent(pid),
      GP_BASE + '/pooldetail.aspx?pid=' + encodeURIComponent(pid)
    ];

    for (var ci = 0; ci < candidates.length; ci++) {
      var resp;
      try { resp = await fetch(candidates[ci], { redirect: 'manual', headers: commonHdrs }); }
      catch(e) { continue; }
      if (resp.status === 301 || resp.status === 302) {
        // If redirected to login on the last (fallback) candidate, return auth error
        if (ci === candidates.length - 1) return jsonResp({ error: 'auth' }, 401);
        continue;
      }
      if (resp.status !== 200) continue;
      var html = await resp.text();
      if (html.indexOf('login.aspx') >= 0 && html.indexOf('ReturnUrl') >= 0) {
        return jsonResp({ error: 'auth' }, 401);
      }
      return new Response(html, {
        headers: Object.assign({}, CORS_HEADERS, {
          'Content-Type': 'text/html; charset=utf-8',
          'X-GP-Standings-Source': candidates[ci]
        })
      });
    }
    return jsonResp({ error: 'not-found' }, 404);
  }

  // ── POST /postback ───────────────────────────────────────────
  if (url.pathname === '/postback' && request.method === 'POST') {
    var cookie = request.headers.get('X-GP-Cookie') || '';
    var pid    = request.headers.get('X-GP-Pid')    || '';
    if (!cookie || !pid) return jsonResp({ error: 'missing-params' }, 400);

    var body;
    try { body = await request.json(); } catch (e) { return jsonResp({ error: 'bad-request' }, 400); }
    var target    = body.target   || '';
    var argument  = body.argument !== undefined ? body.argument : '';
    var matchName = body.matchName || '';

    var gpUrl = GP_BASE + '/pooldetail.aspx?pid=' + encodeURIComponent(pid);
    var commonHdrs = {
      'Cookie': cookie, 'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9', 'Referer': gpUrl
    };

    // Siempre hacer GET fresco para obtener el estado real de gvPartidos en el servidor
    var pageResp;
    try { pageResp = await fetch(gpUrl, { redirect: 'manual', headers: commonHdrs }); }
    catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }
    if (pageResp.status === 301 || pageResp.status === 302) return jsonResp({ error: 'auth' }, 401);
    var pageHtml = await pageResp.text();
    if (pageHtml.indexOf('login.aspx') >= 0 && pageHtml.indexOf('ReturnUrl') >= 0) return jsonResp({ error: 'auth' }, 401);

    var hidden = extractAllHidden(pageHtml);

    // Si viene el nombre del partido, paginar gvPartidos hasta encontrar el match correcto
    if (matchName) {
      var scanHtml = pageHtml;
      var correctTarget = null;
      var MAX_PARTIDO_PAGES = 15;
      for (var pg = 1; pg <= MAX_PARTIDO_PAGES; pg++) {
        correctTarget = findMatchTarget(scanHtml, matchName);
        if (correctTarget) break;
        // Intentar avanzar a la siguiente página de gvPartidos
        var pagerTarget = getPartidosPagerTarget(scanHtml);
        var nextArg = getPartidosNextArg(scanHtml, pg);
        if (!pagerTarget || !nextArg) break;
        var pgHidden = extractAllHidden(scanHtml);
        pgHidden['__EVENTTARGET']   = pagerTarget;
        pgHidden['__EVENTARGUMENT'] = nextArg;
        delete pgHidden['__SCROLLPOSITIONX'];
        delete pgHidden['__SCROLLPOSITIONY'];
        var pgParams = new URLSearchParams();
        Object.keys(pgHidden).forEach(function(k) { pgParams.append(k, pgHidden[k]); });
        var pgResp;
        try {
          pgResp = await fetch(gpUrl, {
            method: 'POST', redirect: 'manual',
            headers: Object.assign({}, commonHdrs, { 'Content-Type': 'application/x-www-form-urlencoded' }),
            body: pgParams.toString()
          });
        } catch(e) { break; }
        if (!pgResp || pgResp.status !== 200) break;
        scanHtml = await pgResp.text();
        if (scanHtml.indexOf('login.aspx') >= 0 && scanHtml.indexOf('ReturnUrl') >= 0) break;
        // Usar hidden fields de la página encontrada para el postback final
        hidden = extractAllHidden(scanHtml);
      }
      if (correctTarget) target = correctTarget;
    }

    // Sobrescribir el evento de postback
    hidden['__EVENTTARGET']   = target;
    hidden['__EVENTARGUMENT'] = argument;
    delete hidden['__SCROLLPOSITIONX'];
    delete hidden['__SCROLLPOSITIONY'];
    var params = new URLSearchParams();
    Object.keys(hidden).forEach(function(k) { params.append(k, hidden[k]); });

    // POST the postback
    var postResp;
    try {
      postResp = await fetch(gpUrl, {
        method: 'POST', redirect: 'manual',
        headers: Object.assign({}, commonHdrs, { 'Content-Type': 'application/x-www-form-urlencoded' }),
        body: params.toString()
      });
    } catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }

    // Follow redirect if the postback redirects to a detail page
    var resultHtml;
    if (postResp.status === 301 || postResp.status === 302) {
      var loc = postResp.headers.get('Location') || '';
      if (!loc) return jsonResp({ error: 'no-redirect' }, 502);
      if (loc.startsWith('/')) loc = GP_BASE + loc;
      try {
        var redirResp = await fetch(loc, { redirect: 'manual', headers: commonHdrs });
        resultHtml = await redirResp.text();
      } catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }
    } else {
      resultHtml = await postResp.text();
    }

    return new Response(resultHtml, {
      headers: Object.assign({}, CORS_HEADERS, { 'Content-Type': 'text/html; charset=utf-8' })
    });
  }

  // ── GET /page ────────────────────────────────────────────────
  if (url.pathname === '/page' && request.method === 'GET') {
    var cookie = request.headers.get('X-GP-Cookie') || '';
    var pageUrl = url.searchParams.get('url') || '';
    if (!cookie || !pageUrl) return jsonResp({ error: 'missing-params' }, 400);
    // Only allow GP URLs
    if (!/^(\/|https:\/\/www\.golpredictor\.com\/)/.test(pageUrl)) {
      return jsonResp({ error: 'invalid-url' }, 400);
    }
    var fullUrl = pageUrl.startsWith('/') ? GP_BASE + pageUrl : pageUrl;
    var resp;
    try {
      resp = await fetch(fullUrl, {
        redirect: 'manual',
        headers: { 'Cookie': cookie, 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'es-ES,es;q=0.9', 'Referer': GP_BASE + '/' }
      });
    } catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }
    if (resp.status === 301 || resp.status === 302) return jsonResp({ error: 'auth', message: 'Sesion expirada' }, 401);
    var html = await resp.text();
    if (html.indexOf('login.aspx') >= 0 && html.indexOf('ReturnUrl') >= 0) return jsonResp({ error: 'auth', message: 'Sesion expirada' }, 401);
    return new Response(html, {
      headers: Object.assign({}, CORS_HEADERS, { 'Content-Type': 'text/html; charset=utf-8' })
    });
  }

  // ── POST /save-picks ─────────────────────────────────────────
  if (url.pathname === '/save-picks' && request.method === 'POST') {
    var cookie = request.headers.get('X-GP-Cookie') || '';
    var pid    = request.headers.get('X-GP-Pid')    || '';
    if (!cookie || !pid) return jsonResp({ error: 'missing-params' }, 400);

    var body;
    try { body = await request.json(); } catch (e) { return jsonResp({ error: 'bad-request' }, 400); }
    var picks = body.picks || {};
    if (!Object.keys(picks).length) return jsonResp({ error: 'empty-picks' }, 400);

    var gpUrl = GP_BASE + '/pooldetail.aspx?pid=' + encodeURIComponent(pid);
    var commonHdrs = {
      'Cookie': cookie, 'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Referer': gpUrl
    };

    // GET fresco para obtener tokens ASP.NET vigentes
    var pageResp;
    try { pageResp = await fetch(gpUrl, { redirect: 'manual', headers: commonHdrs }); }
    catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }
    if (pageResp.status === 301 || pageResp.status === 302) return jsonResp({ error: 'auth' }, 401);
    var pageHtml = await pageResp.text();
    if (pageHtml.indexOf('login.aspx') >= 0 && pageHtml.indexOf('ReturnUrl') >= 0) return jsonResp({ error: 'auth' }, 401);

    // Fusionar picks con campos ocultos del form
    var hidden = extractAllHidden(pageHtml);
    Object.keys(picks).forEach(function(k) { hidden[k] = picks[k]; });
    delete hidden['__SCROLLPOSITIONX'];
    delete hidden['__SCROLLPOSITIONY'];

    // Detectar y agregar botón submit (guardar/save/enviar)
    var btnMatch = pageHtml.match(/name="([^"]*(?:btn|Button|Btn)[^"]*)"/i);
    if (btnMatch) {
      hidden[btnMatch[1]] = '1';
    } else {
      return jsonResp({ error: 'no-submit-button' }, 502);
    }

    var params = new URLSearchParams();
    Object.keys(hidden).forEach(function(k) { params.append(k, hidden[k]); });

    var saveResp;
    try {
      saveResp = await fetch(gpUrl, {
        method: 'POST', redirect: 'manual',
        headers: Object.assign({}, commonHdrs, { 'Content-Type': 'application/x-www-form-urlencoded' }),
        body: params.toString()
      });
    } catch (e) { return jsonResp({ error: 'network', message: e.message }, 502); }

    // Redirección 302 = envío exitoso (patrón ASP.NET POST-redirect-GET)
    if (saveResp.status === 301 || saveResp.status === 302) {
      return jsonResp({ ok: true });
    }

    if (saveResp.status !== 200) {
      return jsonResp({ error: 'server', status: saveResp.status }, 502);
    }

    var resultHtml = await saveResp.text();
    if (resultHtml.indexOf('login.aspx') >= 0 && resultHtml.indexOf('ReturnUrl') >= 0) {
      return jsonResp({ error: 'auth' }, 401);
    }

    // Verificar mensajes de error típicos en la respuesta
    var hasError = /class="[^"]*error[^"]*"|id="[^"]*error[^"]*"|alert-danger/i.test(resultHtml);
    if (hasError) return jsonResp({ error: 'form-error', status: saveResp.status }, 400);
    return jsonResp({ ok: true });
  }

  return jsonResp({ error: 'not-found' }, 404);
}

// Busca el target de postback en gvPartidos cuyo texto de enlace coincida con matchName
function findMatchTarget(html, matchName) {
  if (!matchName) return null;
  var norm = matchName.trim().toLowerCase().replace(/\s+/g, ' ');
  var re = /javascript:__doPostBack\('([^']*gvPartidos[^']*lnkUrlPartido[^']*)'\s*,\s*'[^']*'\)[^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var txt = (m[2] || '').replace(/<[^>]+>/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (txt === norm) return m[1];
  }
  return null;
}

// Devuelve el target del paginador de gvPartidos (no el de gvQuiniela)
function getPartidosPagerTarget(html) {
  var re = /__doPostBack\('([^']*gvPartidos[^']*)'\s*,\s*'Page\$/gi;
  var m = re.exec(html);
  return m ? m[1] : null;
}

// Devuelve el argumento de la siguiente página de gvPartidos
function getPartidosNextArg(html, currentPage) {
  if (/gvPartidos[^<]*Page\$Next/i.test(html)) return 'Page$Next';
  var re = /gvPartidos[^<]*Page\$(\d+)/gi;
  var m; var best = Infinity;
  while ((m = re.exec(html)) !== null) {
    var n = parseInt(m[1]);
    if (n > currentPage && n < best) best = n;
  }
  return isFinite(best) ? 'Page$' + best : null;
}

function extractField(html, field) {
  var re = new RegExp('name="' + field + '"[^>]*value="([^"]*)"', 'i');
  var m = html.match(re);
  if (m) return m[1];
  var re2 = new RegExp('id="' + field + '"[^>]*value="([^"]*)"', 'i');
  var m2 = html.match(re2);
  return m2 ? m2[1] : '';
}

function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({}, CORS_HEADERS, { 'Content-Type': 'application/json' })
  });
}
