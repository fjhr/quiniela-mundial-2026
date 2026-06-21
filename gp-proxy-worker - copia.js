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
  'Access-Control-Allow-Headers': 'Content-Type, X-GP-Cookie, X-GP-Pid'
};
var GP_BASE = 'https://www.golpredictor.com';
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

    // Extraer TODOS los inputs hidden del formulario
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

  return jsonResp({ error: 'not-found' }, 404);
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
