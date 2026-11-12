/* =============================================================
 * Litpax Suite — shell + native screens
 * Login → sessions set → sidebar → module (iframe) ya native screen
 * ============================================================= */
(function () {
  'use strict';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var S = { token: '', user: null, sessions: {}, hidePages: [], view: '', frames: {}, pending: 0, appNav: {}, open: {}, apr: 0 };
  var SESSION_KEYS = ['erp_user', 'lpx_role', 'lpx_name', 'sms_session', 'plt_sup', 'suite_bridge'];
  var HUB_KEYS = ['hub_token', 'hub_role', 'hub_user', 'hub_last_act', 'suite_svc_only'];   // suite_svc_only: purana, sirf saaf karne ke liye

  /* ---------------- API (4 alag GAS) ----------------
   * ERP / IMS: POST JSON  ·  PLT: GET (JSONP text)  — URLs root config.js (SUITE) se */
  function api(app, action, data) {
    var url = SUITE[app + '_URL'];
    if (!url || /^PASTE_/.test(url)) return Promise.reject(new Error(app + '_URL is not set in config.js'));
    var body = Object.assign({ action: action, token: S.token }, data || {});
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, SUITE.TIMEOUT_MS);
    var req;
    if (app === 'PLT' || app === 'SERVICE' || app === 'REPLACE') {
      var q = Object.keys(body).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(Array.isArray(body[k]) ? body[k].join(',') : body[k]); }).join('&');
      req = fetch(url + '?' + q + '&callback=cb', { redirect: 'follow', signal: ctrl ? ctrl.signal : undefined });
    } else {
      req = fetch(url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow', signal: ctrl ? ctrl.signal : undefined });
    }
    return req.then(function (r) { return r.text(); }).then(function (t) {
      clearTimeout(timer);
      var j;
      try {
        t = t.trim();
        if (t.charAt(0) !== '{' && t.charAt(0) !== '[') t = t.substring(t.indexOf('(') + 1, t.lastIndexOf(')'));
        j = JSON.parse(t);
      } catch (e) { throw new Error(app + ' did not respond correctly. Check ' + app + '_URL in config.js.'); }
      var err = (j && j.ok === false && j.error) || (j && j.success === false && (j.message || 'Request failed')) || (j && j.error) || '';
      if (err) {
        err = String(err).replace(/^Error:\s*/, '');
        if (/^LOGIN:/.test(err)) { signOut(); err = err.replace(/^LOGIN:\s*/, ''); }
        throw new Error(err);
      }
      return j;
    }, function (e) {
      clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Network error. Check your connection.');
    });
  }

  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, kind === 'bad' ? 6000 : 3200);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn._label = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || 'Please wait…'; }
    else { btn.disabled = false; if (btn._label) btn.innerHTML = btn._label; }
  }
  function has(role) { return S.user && (S.user.roles.indexOf('Admin') !== -1 || S.user.roles.indexOf(role) !== -1); }
  function fmtN(n) { n = Number(n) || 0; return n.toLocaleString('en-IN'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function modeChip(m) { var c = m === 'LIVE' ? 'chip-live' : m === 'SHADOW' ? 'chip-shadow' : 'chip-off'; return '<span class="chip ' + c + '">' + esc(m) + '</span>'; }

  /* ---------------- AUTH ---------------- */
  /* Screen pe dikhne wale naam (ERP / IMS / PLT / SOMS jaise short forms nahi) */
  var APPNAMES = { erp: { label: 'Sales & Orders' }, ims: { label: 'Inventory' }, pltScan: { label: 'Line Scan' }, pltAdmin: { label: 'Line Admin' }, soms: { label: 'Purchase' } };
  function showLogin() {
    $('#appShell').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
    var h = new Date().getHours();
    $('#loginHello').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    var saved = ''; try { saved = localStorage.getItem('suite_user') || ''; } catch (e) {}
    if (saved) { $('#userInput').value = saved; $('#rememberUser').checked = true; }
    loginMode('pw');
    TL.teams = null; $('#adminBtn').classList.add('hidden');
    api('ERP', 'suiteLoginTeams').then(function (r) {   // CENTRAL_STAFF = ON → team / naam / PIN
      if (!r.on || !r.teams) return;
      TL.teams = r.teams;
      $('#adminBtn').classList.remove('hidden');
      var last = ''; try { last = localStorage.getItem('suite_team') || ''; } catch (e) {}
      $('#teamSel').innerHTML = '<option value="">Pick your team</option>' + r.teams.map(function (t) {
        return '<option value="' + esc(t.key) + '"' + (t.key === last ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('');
      if ($('#loginScreen').classList.contains('hidden') || TL.mode === 'admin') return;
      loginMode('team'); teamPeople();
    }).catch(function () {});
    setTimeout(function () { (saved ? $('#pinInput') : $('#userInput')).focus(); }, 50);
  }

  /* ---------- Team login: team → naam → 4 digit PIN (taala). 👑 Admin = 4 digit PIN ---------- */
  var TL = { teams: null, emp: '', mode: 'pw' };
  function loginMode(m) {                                  // team | admin | pw (CENTRAL_STAFF OFF → purana)
    TL.mode = m;
    $('#teamLogin').classList.toggle('hidden', m !== 'team');
    $('#adminLogin').classList.toggle('hidden', m !== 'admin');
    $('#pwLogin').classList.toggle('hidden', m !== 'pw');
    $('#adminBtn').classList.toggle('on', m === 'admin');
    $('#pwBack').classList.toggle('hidden', !(m === 'pw' && TL.teams));
    $('#loginTitle').textContent = m === 'admin' ? 'Admin sign in' : 'Sign in to your workspace';
    if (m === 'admin') { $('#adminErr').textContent = ''; LK.admin.clear(); setTimeout(LK.admin.focus, 60); }
  }
  /* 4 digit taala: upar shackle, neeche 4 khaane. 4th digit pe onFull(pin) */
  function makeLock(root, onFull) {
    root.innerHTML = '<svg class="lk-shackle" viewBox="0 0 120 72" aria-hidden="true"><path d="M30 72V42a30 30 0 0 1 60 0v30"/></svg>' +
      '<div class="lk-body"><input class="lk-in" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code" aria-label="4 digit PIN">' +
      '<span class="lk-c"><b></b></span><span class="lk-c"><b></b></span><span class="lk-c"><b></b></span><span class="lk-c"><b></b></span></div>';
    var inp = root.querySelector('.lk-in'), cells = root.querySelectorAll('.lk-c'), shown = -1, tm;
    function state(x) { root.setAttribute('data-state', x || ''); }
    function paint() {
      var v = inp.value, foc = document.activeElement === inp;
      for (var i = 0; i < 4; i++) {
        var c = cells[i], b = c.firstChild;
        c.classList.toggle('fill', i < v.length);
        c.classList.toggle('cur', foc && i === v.length && root.getAttribute('data-state') !== 'busy');
        b.textContent = i < v.length ? (i === shown ? v[i] : '•') : '';
      }
    }
    inp.addEventListener('input', function () {
      var old = Number(root.dataset.len || 0);
      inp.value = inp.value.replace(/\D/g, '').slice(0, 4);
      root.dataset.len = inp.value.length;
      state('');
      if (inp.value.length > old) {                          // naya digit: ghoom ke aaye, phir • ban jaye
        shown = inp.value.length - 1;
        var c = cells[shown]; c.classList.remove('roll'); void c.offsetWidth; c.classList.add('roll');
        clearTimeout(tm); tm = setTimeout(function () { shown = -1; paint(); }, 650);
      }
      paint();
      if (inp.value.length === 4) onFull(inp.value);
    });
    inp.addEventListener('focus', paint); inp.addEventListener('blur', paint);
    root.addEventListener('click', function () { if (!inp.disabled) inp.focus(); });
    return {
      focus: function () { inp.focus(); },
      clear: function () { inp.disabled = false; inp.value = ''; root.dataset.len = 0; shown = -1; state(''); paint(); },
      busy: function () { inp.disabled = true; state('busy'); paint(); },
      ok: function () { state('ok'); paint(); },
      error: function () {
        inp.disabled = false; state(''); void root.offsetWidth; state('error');
        setTimeout(function () { inp.value = ''; root.dataset.len = 0; shown = -1; paint(); inp.focus(); }, 520);
      }
    };
  }
  var LK = {};
  function teamCur() { var k = $('#teamSel').value; return (TL.teams || []).filter(function (t) { return t.key === k; })[0] || null; }
  function teamPeople() {
    var t = teamCur(), box = $('#teamPeople');
    TL.emp = ''; $('#teamErr').textContent = ''; $('#teamPin').value = ''; $('#teamPin').type = 'password'; $('#teamEye').classList.remove('on');
    $('#teamPinBox').classList.add('hidden'); $('#teamLockBox').classList.add('hidden'); $('#teamBtn').classList.add('hidden');
    if (!t) { box.innerHTML = ''; return; }
    try { localStorage.setItem('suite_team', t.key); } catch (e) {}
    if (!t.staff.length) {                                   // is team me abhi koi staff nahi → team ka password
      box.innerHTML = '';
      $('#teamPinLbl').textContent = t.label + ' team password';
      $('#teamPinBox').classList.remove('hidden'); $('#teamBtn').classList.remove('hidden');
      $('#teamPin').focus(); return;
    }
    box.innerHTML = t.staff.map(function (p) {
      return '<button type="button" class="tl-p" role="radio" aria-checked="false" data-id="' + esc(p.id) + '">' +
        '<i class="av av' + avIdx(p.name) + '">' + esc(ini(p.name)) + '</i><span class="tl-who"><b>' + esc(p.name) + '</b><small>Emp ID · ' + esc(p.id) + '</small></span>' +
        '<span class="tl-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span></button>';
    }).join('');
    $$('#teamPeople .tl-p').forEach(function (b) {
      b.onclick = function () {
        TL.emp = b.dataset.id;
        $$('#teamPeople .tl-p').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
        $('#teamLockLbl').innerHTML = 'PIN for <b>' + esc(b.querySelector('b').textContent) + '</b>';
        $('#teamLockBox').classList.remove('hidden'); $('#teamErr').textContent = '';
        LK.team.clear(); LK.team.focus();
      };
    });
    if (t.staff.length === 1) box.querySelector('.tl-p').click();
  }
  function avIdx(n) { var h = 0; String(n).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 997; }); return h % 6; }
  function ini(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
  /* taala khula → thoda ruk ke andar */
  function unlockThen(L, d) { L.ok(); return new Promise(function (res) { setTimeout(res, 750); }).then(function () { return loggedIn(d); }); }
  function teamPinLogin(pin) {
    var t = teamCur();
    if (!t || !TL.emp) return;
    $('#teamErr').textContent = ''; LK.team.busy();
    api('ERP', 'suiteTeamLogin', { key: t.key, empId: TL.emp, pin: pin }).then(function (d) { return unlockThen(LK.team, d); })
      .catch(function (e) { $('#teamErr').textContent = e.message; LK.team.error(); });
  }
  function teamPwLogin() {                                   // staff nahi wali team: team password
    var t = teamCur(), pw = $('#teamPin').value, btn = $('#teamBtn');
    $('#teamErr').textContent = '';
    if (!t) { $('#teamErr').textContent = 'Pick your team'; return; }
    if (!pw) { $('#teamErr').textContent = 'Enter the team password'; return; }
    busy(btn, true, '<span class="spin"></span><span>Signing in…</span>');
    api('ERP', 'suiteTeamLogin', { key: t.key, password: pw }).then(loggedIn)
      .catch(function (e) { $('#teamErr').textContent = e.message; $('#teamPin').value = ''; $('#teamPin').focus(); })
      .then(function () { busy(btn, false); });
  }
  function adminPinLogin(pin) {
    $('#adminErr').textContent = ''; LK.admin.busy();
    api('ERP', 'suiteLogin', { username: 'admin', password: pin }).then(function (d) { return unlockThen(LK.admin, d); })
      .catch(function (e) { $('#adminErr').textContent = /password|wrong|invalid/i.test(e.message) ? 'Wrong PIN' : e.message; LK.admin.error(); });
  }
  var STAFF_KEYS = ['suite_staff', 'erp_staff', 'ims_staff'];   // pichle insaan ka naam agle ko na mile
  function loggedIn(d) {
    S.token = d.token;
    try {
      sessionStorage.setItem('suite_token', d.token);
      STAFF_KEYS.forEach(function (k) { sessionStorage.removeItem(k); });
      if (d.staff) sessionStorage.setItem('suite_staff', JSON.stringify(d.staff));
      if (d.sessions && d.sessions.erp_staff) sessionStorage.setItem('erp_staff', JSON.stringify(d.sessions.erp_staff));
    } catch (e) {}
    return Promise.all([svcSso(), repCheck()]).then(repOnly).then(function () { start(d); });   // Service Hub + Advance Replacement bhi isi login se
  }
  
  function doLogin() {
    var un = $('#userInput').value.trim(), pw = $('#pinInput').value, btn = $('#loginBtn');
    $('#loginError').textContent = '';
    if (!un || !pw) { $('#loginError').textContent = 'Enter username and password'; return; }
    try { if ($('#rememberUser').checked) localStorage.setItem('suite_user', un); else localStorage.removeItem('suite_user'); } catch (e) {}
    busy(btn, true, '<span class="spin"></span><span>Signing in…</span>');
    api('ERP', 'suiteLogin', { username: un, password: pw }).then(loggedIn).catch(function (e) { $('#loginError').textContent = e.message; })
      .then(function () { busy(btn, false); $('#pinInput').value = ''; });
  }

  /* ---------- Service Hub: sirf Suite ke login se (Service GAS → suiteLogin) ---------- */
  function svcSso() {
    svcClear();
    if (!SUITE.SERVICE_URL || !S.token) return Promise.resolve();
    return api('SERVICE', 'suiteLogin', { suiteToken: S.token, dev: 'Litpax Suite' }).then(function (r) {
      if (r && r.ok && r.token && SUITE.SERVICE.ROLES[r.role]) svcSave(r, r.user || '');
    }).catch(function () {});   // Service band ho to bhi baaki Suite chale
  }
    /* ---------- Advance Replacement (alag GAS): Roles tab me role ho to hi sidebar me ---------- */
  function repCheck() {
    S.rep = null;
    try { sessionStorage.removeItem('rep_ok'); } catch (e) {}
    if (!SUITE.REPLACE_URL || /^PASTE_/.test(SUITE.REPLACE_URL) || !S.token) return Promise.resolve();
    var st = null; try { st = JSON.parse(sessionStorage.getItem('suite_staff') || 'null'); } catch (e) {}
    return api('REPLACE', 'repMe', st && st.token ? { sfa: st.app, sfi: st.id, sft: st.token } : {}).then(function (r) {
      if (r && r.ok && r.access) { S.rep = r.me; try { sessionStorage.setItem('rep_ok', r.me.perms.Create ? 'create' : 'view'); } catch (e) {} }
    }).catch(function () {});   // Replacement GAS band ho to bhi baaki Suite chale
  }
  /** Service Hub ka role nahi par Replacement ka role hai (Sales / Production) → Service Hub me sirf Advance Replacement tab */
  function repOnly() {
    if (svcRole() === 'replace' && !S.rep) svcClear();
    if (!svcRole() && S.rep) svcSave({ role: 'replace', token: 'replace-only' }, S.rep.name || '');
  }
  /* ---------- LINKED RECORDS: kisi bhi app se "ye record kholo" → sahi app + record ----------
   * customer / order / lead → ERP · ticket / case (Advance Replacement) → Service Hub */
  var REC_APP = { customer: 'erp', order: 'erp', lead: 'erp', page: 'erp', ticket: 'service', 'case': 'service' };
  function openRecordX(rtype, id) {
    var mod = REC_APP[rtype];
    if (!mod || !id) return;
    if (!navItems().some(function (x) { return x.id === 'm-' + mod; })) return toast('You do not have access to this record', 'bad');
    var had = !!S.frames[mod];
    try { sessionStorage.setItem('suite_open', JSON.stringify({ app: mod, rtype: rtype, id: String(id), t: Date.now() })); } catch (e) {}
    go('m-' + mod);   // frame pehli baar bana to app khud suite_open padh ke record kholega
    if (had) try { S.frames[mod].contentWindow.postMessage({ source: 'litpax-suite', type: 'open-record', rtype: rtype, id: String(id) }, location.origin); } catch (e) {}
  }
  /** ERP "Advance Battery Replacement" → Service Hub → Advance Replacement tab */
  function openReplace() {
    if (!S.rep || !svcRole()) return toast('No access to Advance Replacement — ask the Admin', 'bad');
    var had = !!S.frames.service;
    go('m-service');
    if (!had) { S.frames.service.src = SUITE.MODULES.service.path + '#replace'; return; }
    try { S.frames.service.contentWindow.postMessage({ source: 'litpax-suite', type: 'nav-go', k: 'replace' }, location.origin); } catch (e) {}
  }
  function svcSave(r, un) {
    try {
      localStorage.setItem('hub_role', r.role); localStorage.setItem('hub_token', r.token); localStorage.setItem('hub_user', un.toLowerCase());
      if (r.idleMin != null) localStorage.setItem('hub_idle', String(r.idleMin));
    } catch (e) {}
  }
  function svcClear() { try { HUB_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }
  function svcRole() {
    try { return localStorage.getItem('hub_token') ? (localStorage.getItem('hub_role') || '') : ''; } catch (e) { return ''; }
  }
  function signOut() {
    var htk = ''; try { htk = localStorage.getItem('hub_token') || ''; } catch (e) {}
    if (htk && svcRole() !== 'replace') api('SERVICE', 'logout', { token: htk }).catch(function () {});
    try { SESSION_KEYS.concat(['suite_token'], STAFF_KEYS).forEach(function (k) { sessionStorage.removeItem(k); }); localStorage.removeItem('erp_user'); } catch (e) {}
    svcClear();
    try { sessionStorage.removeItem('rep_ok'); sessionStorage.removeItem('rep_prefill'); } catch (e) {}
    promoStop();
    S.token = ''; S.user = null; S.rep = null;
    Object.keys(S.frames).forEach(function (k) { S.frames[k].remove(); });
    S.frames = {}; S.appNav = {}; S.open = {}; S.apr = 0;
    if ($('#snSearch')) $('#snSearch').value = '';
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    showLogin();
  }

  /** Har module ka apna session key — unke apne login jaisa hi */
  function applySessions(s) {
    try {
      SESSION_KEYS.forEach(function (k) { sessionStorage.removeItem(k); });
      if (s.erp_user) sessionStorage.setItem('erp_user', JSON.stringify(s.erp_user));
      if (s.ims) { sessionStorage.setItem('lpx_role', s.ims.role); sessionStorage.setItem('lpx_name', s.ims.name); }
      if (s.sms_session) sessionStorage.setItem('sms_session', JSON.stringify(s.sms_session));
      if (s.plt_sup) sessionStorage.setItem('plt_sup', s.plt_sup);
      sessionStorage.setItem('suite_bridge', JSON.stringify({ hidePages: S.hidePages }));
    } catch (e) {}
    var w = $('#sessionWarn');
    if (s.errors && s.errors.length) { w.textContent = '⚠ ' + s.errors.length + ' app sign-in issue'; w.title = s.errors.join('\n'); w.classList.remove('hidden'); }
    else w.classList.add('hidden');
  }

  function start(d) {
    S.user = d.user; S.sessions = d.sessions || {}; S.hidePages = d.hidePages || [];
    // Dispatch job → ERP ka sirf Dispatch page (backend ne ERP session na bheja ho tab bhi)
    if (!(S.sessions.erp_user && S.sessions.erp_user.role) && (S.user.roles || []).indexOf('Dispatch') !== -1) {
      S.sessions.erp_user = { name: S.user.name, username: S.user.username, role: 'Dispatch' };
    }
    applySessions(S.sessions);
    $('#loginScreen').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    var me = null; try { me = JSON.parse(sessionStorage.getItem('suite_staff') || 'null'); } catch (e) {}   // PIN se aaya insaan
    var who = me ? me.name : S.user.name;
    $('#userName').innerHTML = '<i class="tu-av av' + avIdx(who) + '">' + esc(ini(who)) + '</i><span class="tu-t"><b>' + esc(who) + '</b>' +
      '<small>' + esc(me ? (me.team === 'System Incharge' ? 'Store' : me.team) + ' · ' + me.id : (S.user.roles || []).slice(0, 2).join(' · ') || S.user.username) + '</small></span>';
    buildNav();
    var want = location.hash.replace('#', '');
    var first = navItems().filter(function (n) { return n.id !== 'accounts'; })[0] || {};   // Accounts upar hai, par login pe apna app khule
    go(navItems().some(function (n) { return n.id === want; }) ? want : first.id);
    refreshBadge();
    promoStart();
  }

  /* ---------------- SYSTEM SHOWCASE — sidebar ke neeche ek button (sirf Admin) → Slide-Show bade player me ---------------- */
  function promoStart() {   // naam purana hi rakha (start/signOut isi ko bulate hain)
    var b = $('#showBtn'), c = SUITE.SHOWCASE;
    if (!b) return;
    var ok = !!(c && c.URL && S.user && (S.user.roles || []).indexOf('Admin') !== -1);
    b.classList.toggle('hidden', !ok);
    b.onclick = ok ? promoOpen : null;
    mascotStart();
  }
  function promoStop() {
    var v = $('#promoView'); if (v) v.remove();
    document.removeEventListener('keydown', promoKey);
    var b = $('#showBtn'); if (b) b.classList.add('hidden');
    mascotStop();
  }
  function promoKey(e) { if (e.key === 'Escape' && $('#promoView') && !document.fullscreenElement) promoClose(); }
  function promoOpen() {
    var c = SUITE.SHOWCASE; if (!c || $('#promoView')) return;
    var v = document.createElement('div');
    v.id = 'promoView'; v.className = 'promo-view'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', 'System Showcase');
    v.innerHTML = '<div class="pv-box"><div class="pv-head"><b>System Showcase</b><span>' +
      '<button type="button" class="pv-btn pv-fs">⛶ Full screen</button>' +
      '<a class="pv-btn" href="' + esc(c.URL) + '" target="_blank" rel="noopener">Open in new tab ↗</a>' +
      '<button type="button" class="pv-btn pv-x" aria-label="Close">×</button></span></div>' +
      '<iframe src="' + esc(c.URL) + '" title="System Showcase" allow="fullscreen; autoplay" allowfullscreen></iframe></div>';
    document.body.appendChild(v);
    requestAnimationFrame(function () { v.classList.add('in'); });
    v.querySelector('.pv-x').onclick = promoClose;
    v.addEventListener('click', function (e) { if (e.target === v) promoClose(); });
    v.querySelector('.pv-fs').onclick = function () { var f = v.querySelector('iframe'); (f.requestFullscreen || f.webkitRequestFullscreen || function () {}).call(f); };
    document.addEventListener('keydown', promoKey);
    v.querySelector('.pv-x').focus();
  }
  function promoClose() {
    var v = $('#promoView'); if (!v) return;
    document.removeEventListener('keydown', promoKey);
    v.classList.remove('in'); setTimeout(function () { v.remove(); }, 250);
  }

  /* ---------------- "LITU" — Ask Litpax ka mascot: screen ke kone se jhaank ke user ko dekhta hai ----------------
   * Aankhen mouse ke peeche ghoomti hain · palak jhapakta hai · kabhi chhup ke wapas jhaankta hai · kabhi kuch bolta hai.
   * Click → Ask Litpax. Sirf jinko Ask Litpax milta hai (Admin). Ask Litpax khula ho to chhup jaata hai. */
  var MS = { el: null, t: null, sayT: null, move: null };
  var LITU_LINES = ['Psst… kuch poochna hai? 👀', 'Main sab dekh raha hoon… data ko 😄', 'Ctrl + K dabao, main aa jaunga!', 'Aaj kitne orders aaye? Pooch ke dekho 😉',
    'Battery ka serial do, poori kahani sunaunga 🔋', 'Low stock? Mujhse poochho!', 'Bore ho rahe ho? Mujhe click karo 😄', 'Main yahin hoon… chupke se 🙈'];
  function lituSvg() {
    return '<svg viewBox="0 0 120 130" aria-hidden="true">' +
      '<g class="lt-body">' +
        '<rect x="47" y="4" width="26" height="12" rx="4" fill="#2b2b30"/>' +
        '<rect x="16" y="14" width="88" height="112" rx="30" fill="#ec4f55"/>' +
        '<rect x="16" y="14" width="88" height="112" rx="30" fill="url(#ltShine)"/>' +
        '<rect x="26" y="28" width="68" height="48" rx="22" fill="#fff"/>' +
        '<g class="lt-eyes"><circle cx="45" cy="50" r="11" fill="#f4f4f6"/><circle cx="75" cy="50" r="11" fill="#f4f4f6"/>' +
          '<g class="lt-pupils"><circle cx="45" cy="50" r="5.5" fill="#17171a"/><circle cx="75" cy="50" r="5.5" fill="#17171a"/>' +
          '<circle cx="47" cy="47.5" r="1.8" fill="#fff"/><circle cx="77" cy="47.5" r="1.8" fill="#fff"/></g></g>' +
        '<circle cx="34" cy="66" r="4.5" fill="#ffb3b6"/><circle cx="86" cy="66" r="4.5" fill="#ffb3b6"/>' +
        '<path class="lt-mouth" d="M53 66 q7 6 14 0" fill="none" stroke="#17171a" stroke-width="3" stroke-linecap="round"/>' +
        '<g fill="#fff" opacity=".85"><rect x="40" y="88" width="40" height="7" rx="3.5"/><rect x="40" y="99" width="28" height="7" rx="3.5" opacity=".7"/></g>' +
      '</g>' +
      '<g class="lt-hands"><g class="lt-hand lt-hl"><rect x="6" y="80" width="26" height="15" rx="7.5" fill="#ff7b80" stroke="#c9363d" stroke-width="2"/><path d="M14 80v6M20 80v6" stroke="#c9363d" stroke-width="2" stroke-linecap="round"/></g>' +
        '<g class="lt-hand lt-hr"><rect x="88" y="80" width="26" height="15" rx="7.5" fill="#ff7b80" stroke="#c9363d" stroke-width="2"/><path d="M100 80v6M106 80v6" stroke="#c9363d" stroke-width="2" stroke-linecap="round"/></g></g>' +
      '<defs><linearGradient id="ltShine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
    '</svg>';
  }
  function mascotStart() {
    mascotStop();
    if (!navItems().some(function (x) { return x.id === 'm-agent'; })) return;
    var el = document.createElement('button');
    el.type = 'button'; el.id = 'litu'; el.className = 'litu';
    el.setAttribute('aria-label', 'Ask Litpax'); el.title = 'Ask Litpax (Ctrl + K)';
    el.innerHTML = '<span class="litu-say" aria-hidden="true"></span><span class="litu-fig">' + lituSvg() + '</span>';
    document.body.appendChild(el);
    MS.el = el;
    el.onclick = function () { lituSay('Haan bolo! ✨', 1200); el.classList.add('jump'); setTimeout(function () { el.classList.remove('jump'); openAgent(); }, 260); };
    el.addEventListener('mouseenter', function () { lituSay('Click karo, Ask Litpax kholta hoon 😄', 2500); });
    MS.move = function (e) { lituLook(e.clientX, e.clientY); };
    document.addEventListener('mousemove', MS.move);
    mascotView();
    setTimeout(function () { el.classList.add('in'); lituSay('Hi ' + ((S.user && S.user.name) || '').split(' ')[0] + '! 👋', 3000); }, 1500);
    lituLoop();
  }
  function mascotStop() {
    clearTimeout(MS.t); clearTimeout(MS.sayT);
    if (MS.move) document.removeEventListener('mousemove', MS.move);
    if (MS.el) MS.el.remove();
    MS.el = null; MS.move = null;
  }
  function mascotView() { if (MS.el) MS.el.classList.toggle('away', S.view === 'm-agent'); }   // Ask Litpax khula → chhup jao
  function lituLook(x, y) {
    if (!MS.el) return;
    var r = MS.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.35;
    var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1, k = Math.min(1, d / 220);
    var p = MS.el.querySelector('.lt-pupils');
    if (p) p.setAttribute('transform', 'translate(' + (dx / d * 4.5 * k).toFixed(2) + ' ' + (dy / d * 4 * k).toFixed(2) + ')');
  }
  function lituSay(txt, ms) {
    if (!MS.el) return;
    var b = MS.el.querySelector('.litu-say');
    b.textContent = txt; MS.el.classList.add('talk');
    clearTimeout(MS.sayT); MS.sayT = setTimeout(function () { if (MS.el) MS.el.classList.remove('talk'); }, ms || 3000);
  }
  function lituLoop() {   // har 15–35 sec me kuch na kuch: chhupna-jhaankna / idhar-udhar dekhna / kuch bolna
    clearTimeout(MS.t);
    MS.t = setTimeout(function () {
      var el = MS.el; if (!el) return;
      if (!document.hidden && !el.classList.contains('away') && !el.matches(':hover')) {
        var r = Math.random();
        if (r < 0.35) { el.classList.add('duck'); setTimeout(function () { el.classList.remove('duck'); }, 2600); }
        else if (r < 0.65) lituSay(LITU_LINES[Math.floor(Math.random() * LITU_LINES.length)], 3500);
        else { el.classList.add('peek'); setTimeout(function () { el.classList.remove('peek'); }, 1800); }
      }
      lituLoop();
    }, 15000 + Math.random() * 20000);
  }

  /* ---------------- NAV ---------------- */
  function navItems() {
    var u = S.user, s = S.sessions, M = APPNAMES, items = [];
    // Accounts (ERP ka customers page) — sabse upar
    var erpRole = s.erp_user && s.erp_user.role;
    if (erpRole === 'Admin' || erpRole === 'Sales') items.push({ id: 'accounts', sec: 'Apps', label: 'Accounts', ic: '◫' });
    // Inward Entry ab IMS ke Inward page me hai (SOMS approval ke saath)
    var isAdmin = S.user.roles.indexOf('Admin') !== -1;
    // Admin ke top bar me Approvals, Dispatch (manual), 2 Wheeler Line nahi dikhte
    if (s.erp_user && s.erp_user.role) items.push({ id: 'm-erp', sec: 'Apps', label: M.erp.label, ic: '▤', mod: 'erp' });
    if (s.ims) items.push({ id: 'm-ims', sec: 'Apps', label: M.ims.label, ic: '▦', mod: 'ims' });
    if ((has('Production') || u.pltSup) && !isAdmin) items.push({ id: 'm-plt2W', sec: 'Apps', label: SUITE.MODULES.plt2W.label, ic: '⚡', mod: 'plt2W' });
    if (u.pltSup) items.push({ id: 'm-pltAdmin', sec: 'Apps', label: M.pltAdmin.label, ic: '⚙', mod: 'pltAdmin' });
    if (s.sms_session) items.push({ id: 'm-soms', sec: 'Apps', label: M.soms.label, ic: '⧉', mod: 'soms' });
    if (S.user.roles.indexOf('Admin') !== -1) items.push({ id: 'm-cash', sec: 'Apps', label: SUITE.MODULES.cash.label, ic: '₹', mod: 'cash' });
    if (isAdmin) items.push({ id: 'm-tasks', sec: 'Apps', label: SUITE.MODULES.tasks.label, ic: '☑', mod: 'tasks' });
    if (svcRole()) items.push({ id: 'm-service', sec: 'Apps', label: SUITE.MODULES.service.label, ic: '🛠', mod: 'service' });
    if (isAdmin && SUITE.AGENT_URL && !/^PASTE_/.test(SUITE.AGENT_URL)) items.push({ id: 'm-agent', sec: 'Admin', label: SUITE.MODULES.agent.label, ic: '✦', mod: 'agent' });
    if (has('Admin')) items.push({ id: 'settings', sec: 'Admin', label: 'Settings', ic: '⚑' });
    if (has('Approver') && !isAdmin) items.push({ id: 'approvals', sec: 'Automation', label: 'Approvals', ic: '✓', badge: true });
    if (has('Production') || has('Viewer')) items.push({ id: 'overview', sec: 'Automation', label: 'Overview', ic: '◎' });   // sabse neeche
    try { sessionStorage.setItem('suite_can', items.map(function (x) { return x.id; }).join(',')); } catch (e) {}   // apps ko pata ho kaunse link khulenge
    return items;
  }
  /* ---------------- SIDEBAR (N2) ----------------
     App ke pages app khud bhejta hai (suite-bridge.js → 'nav' message); click → 'nav-go' wapas app ko */
  var ICO = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4"/><path d="M8 10l-1.5 2.5H9L7.5 15"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    factory: '<path d="M3 21V8l6 4V8l6 4V4h6v17z"/>',
    rupee: '<path d="M7 4h11M7 9h11M7 4c6 0 6 10 0 10h-1l8 6"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    inbox: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l1 8v6H4v-6z"/>',
    'in': '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
    out: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 21h16"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    trend: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>',
    book: '<path d="M4 4h11a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3z"/><path d="M4 18a3 3 0 0 1 3-3h11"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    down: '<path d="M3 7l5 5 4-4 9 9"/><path d="M21 12v5h-5"/>',
    store: '<path d="M4 9h16l-1-5H5z"/><path d="M5 9v11h14V9"/><path d="M10 20v-6h4v6"/>',
    route: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v12"/>',
    spark: '<path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7z"/>',
    tasks: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="m7 10 2 2 3-3M7 16h10M14 11h3"/>',
    bot: '<rect x="4.5" y="6" width="15" height="15" rx="5"/><path d="M10 3.5h4V6h-4z"/><circle cx="9.6" cy="12.3" r="1.4"/><circle cx="14.4" cy="12.3" r="1.4"/><path d="M10.3 16.4c1 .7 2.4.7 3.4 0"/>'
  };
  var APPICO = { accounts: 'users', overview: 'dash', approvals: 'check', 'm-erp': 'doc', 'm-ims': 'box', 'm-plt2W': 'bolt', 'm-pltAdmin': 'factory', 'm-soms': 'store',
                                  'm-cash': 'rupee', 'm-tasks': 'tasks', 'm-service': 'wrench', 'm-agent': 'bot', settings: 'gear' };
  var PAGEICO = [[/switch|staff/i, 'users'], [/replacement/i, 'battery'], [/lead pipe/i, 'target'], [/lead dash/i, 'trend'], [/my dash|report|material vs/i, 'chart'], [/dash/i, 'dash'], [/pending|follow/i, 'clock'], [/complet|approv/i, 'check'], [/crm/i, 'target'], [/wip|production/i, 'factory'],
    [/battery/i, 'battery'], [/challan|order|indent/i, 'doc'], [/dispatch|consign/i, 'truck'], [/bom|repair/i, 'wrench'], [/^users?$/i, 'shield'],
    [/customer|vendor|supplier/i, 'users'], [/product/i, 'bolt'], [/account|freight|cash/i, 'rupee'], [/inward|receiv|from ims/i, 'in'], [/outward/i, 'out'],
    [/item/i, 'box'], [/opening/i, 'flag'], [/summary/i, 'trend'], [/ledger/i, 'book'], [/reorder/i, 'alert'],
    [/closing/i, 'cal'], [/adc/i, 'down'], [/master|setting/i, 'sliders'], [/track/i, 'route'], [/new /i, 'plus'], [/ticket/i, 'ticket'], [/record/i, 'folder']];
  function ico(k) { return '<svg class="sn-ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICO[k] || ICO.list) + '</svg>'; }
  function pageIco(l) { for (var i = 0; i < PAGEICO.length; i++) if (PAGEICO[i][0].test(l)) return PAGEICO[i][1]; return 'list'; }

  function buildNav() {
    var items = navItems();
    if (!items.length) {
      $('#nav').innerHTML = '<div class="nav-empty">No access assigned. Please contact the Admin. (roles: ' + esc((S.user.roles || []).join(', ') || 'none') + ')</div>';
      $$('.view').forEach(function (v) { v.classList.add('hidden'); });   // pichhle user ka page band
      return;
    }
    var q = ($('#snSearch') ? $('#snSearch').value : '').trim().toLowerCase(), html = '', sec = '';
    items.forEach(function (n) {
      var sub = n.mod ? (S.appNav[n.mod] || []) : [], appHit = !q || n.label.toLowerCase().indexOf(q) !== -1;
      var subs = sub.filter(function (p) { return appHit || (p.label + ' ' + p.sec).toLowerCase().indexOf(q) !== -1; });
      if (!appHit && !subs.length) return;
      var cur = S.view === n.id || (n.id === 'accounts' && S.view === 'm-erp' && (S.appNav.erp || []).some(function (p) { return p.k === 'nav-customers' && p.active; })), open = sub.length && (q ? true : !!S.open[n.mod]);
      if (!q && n.sec !== sec) { sec = n.sec; html += '<div class="sn-grp">' + esc(sec) + '</div>'; }
      html += '<div class="nav-item' + (cur ? ' cur' : '') + (cur && !sub.length ? ' active' : '') + (open ? ' open' : '') + '" data-id="' + n.id + '" title="' + esc(n.label) + '">' +
        ico(APPICO[n.id]) + '<span class="sn-lbl">' + esc(n.label) + '</span>' +
        (n.badge ? '<span class="badge' + (S.apr ? '' : ' hidden') + '" id="aprBadge">' + S.apr + '</span>' : '') + (sub.length ? '<i class="sn-chev"></i>' : '') + '</div>';
      if (!sub.length) return;
      html += '<div class="sn-sub' + (open ? ' open' : '') + '">';
      var ps = '';
      subs.forEach(function (p) {
        if (p.sec && p.sec !== ps) { ps = p.sec; html += '<div class="sn-sec">' + esc(ps) + '</div>'; }
        html += '<div class="sn-page' + (cur && p.active ? ' active' : '') + '" data-id="' + n.id + '" data-mod="' + n.mod + '" data-k="' + esc(p.k) + '" title="' + esc(p.label) + '">' +
          ico(pageIco(p.label)) + '<span class="sn-lbl">' + esc(p.label) + '</span>' + (p.badge ? '<b class="sn-badge">' + esc(p.badge) + '</b>' : '') + '</div>';
      });
      html += '</div>';
    });
    $('#nav').innerHTML = html || '<div class="nav-empty">No match</div>';
    $$('#nav .nav-item').forEach(function (el) { el.addEventListener('click', function () { navClick(el.dataset.id); }); });
    $$('#nav .sn-page').forEach(function (el) { el.addEventListener('click', function () { pageClick(el.dataset.id, el.dataset.mod, el.dataset.k); }); });
    // sirf ek app (jaise Purchase → Store Orders)
    $('#appShell').classList.toggle('solo', items.length === 1 && !!items[0].mod);
  }
  function navClick(id) {
    if (id === 'accounts') { openRecordX('page', 'customers'); snClose(); return; }   // ERP ka Accounts page
    var n = navItems().filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    if (n.mod && S.view === id && (S.appNav[n.mod] || []).length && !$('#appShell').classList.contains('sn-mini')) {
      S.open[n.mod] = !S.open[n.mod]; return buildNav();   // khule app pe click → pages band / khol
    }
    if (n.mod) S.open[n.mod] = true;
    go(id); snClose();
  }
  function pageClick(id, mod, k) {
    if (S.view !== id) go(id);
    var f = S.frames[mod];
    if (f) try { f.contentWindow.postMessage({ source: 'litpax-suite', type: 'nav-go', k: k }, location.origin); } catch (e) {}
    snClose();
  }
  function snClose() { $('#appShell').classList.remove('sn-open'); }
  function onAppNav(e) {
    var mod = Object.keys(S.frames).filter(function (k) { return S.frames[k].contentWindow === e.source; })[0];
    if (!mod) return;
    if (!S.appNav[mod] && S.view === 'm-' + mod) S.open[mod] = true;
    S.appNav[mod] = e.data.items || [];
    buildNav();
  }
  function openAgent() {
    if (navItems().some(function (x) { return x.id === 'm-agent'; })) go('m-agent');
  }
  function go(id) {
    if (!id) return;
    if (id === 'accounts') return openRecordX('page', 'customers');
    var n = navItems().filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    S.view = id;
    history.replaceState(null, '', '#' + id);
    if (n.mod) { S.open = {}; S.open[n.mod] = true; }   // ek waqt me ek hi app khula
    buildNav();
    document.title = n.label + ' · Litpax';
    mascotView();
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    Object.keys(S.frames).forEach(function (k) { S.frames[k].classList.add('hidden'); });
    if (n.mod) {
      $('#frames').classList.remove('hidden-all');
      var f = S.frames[n.mod];
      if (!f) {
        f = document.createElement('iframe');
        f.src = SUITE.MODULES[n.mod].path;
        f.title = n.label;
        $('#frames').appendChild(f);
        S.frames[n.mod] = f;
      }
      f.classList.remove('hidden');
    } else {
      $('#frames').classList.add('hidden-all');
      $('#view-' + id).classList.remove('hidden');
      VIEWS[id]();
    }
  }
  function reloadCurrent() {
    var n = navItems().filter(function (x) { return x.id === S.view; })[0];
    if (!n) return;
    if (n.mod && S.frames[n.mod]) S.frames[n.mod].src = SUITE.MODULES[n.mod].path;
    else if (!n.mod) VIEWS[n.id]();
  }

  function refreshBadge() {
    if (!has('Approver')) return;
    api('IMS', 'suiteListApprovals', { status: 'Pending' }).then(function (r) {
      var list = r.list;
      S.apr = list.length;
      var b = $('#aprBadge'); if (!b) return;
      b.textContent = list.length; b.classList.toggle('hidden', !list.length);
    }).catch(function () {});
  }

  /* =============================================================
   * VIEWS
   * ============================================================= */
  var VIEWS = {};

  /* ---------- Overview (automation status) ---------- */
  VIEWS.overview = function () {
    var el = $('#view-overview');
    el.innerHTML = '<div class="wrap"><div class="loading">Loading automation status…</div></div>';
    api('PLT', 'suiteStatus').then(function (d) {
      var M = d.modes, ic = d.issueCounts || {};
      var labels = { MODE_IMS_ISSUE: 'Material issue on first scan', MODE_PLAN_LINK: 'Plan link (FIFO)', MODE_ERP_PRODUCTION: 'ERP production update',
        MODE_CELL_RECON: 'Cell reconciliation', MODE_DISPATCH: 'Serial dispatch', MODE_INWARD: 'Inward approval → IMS', MODE_SOMS_GRN: 'SOMS GRN' };
      var lr = d.lastRun;
      var html = '<div class="wrap">';
      if (!d.cutover) html += '<div class="notice warn">Cutover is not set, so automation is not running. An Admin can set it in Settings.</div>';
      html += '<div class="card"><div class="card-h"><div><div class="card-t">Automation</div><div class="card-s">Cutover: ' + esc(d.cutover || 'not set') +
        ' · Last run: ' + esc(lr ? lr.at : 'never') + (lr && lr.sum && lr.sum.ms ? ' (' + Math.round(lr.sum.ms / 1000) + 's)' : '') + '</div></div>' +
        '<div class="right">' + (has('Admin') ? '<button class="btn btn-sm" id="runNow">▶ Run now</button>' : '') + '</div></div>' +
        '<div class="card-b"><div class="grid g2">' + Object.keys(labels).map(function (k) {
          return '<div class="row" style="justify-content:space-between"><span>' + labels[k] + '</span>' + modeChip(M[k]) + '</div>';
        }).join('') + '</div><div class="hint" style="margin-top:12px">SHADOW calculates and records what would happen, without writing to ERP or IMS. LIVE writes through each app\'s existing actions.</div></div></div>';

      html += '<div class="grid g4">' +
        kpi('Packs issued', (ic.Done || 0) + (ic.Shadow || 0), '') +
        kpi('Waiting for stock', (ic['Waiting Stock'] || 0) + (ic.Partial || 0), (ic['Waiting Stock'] || ic.Partial) ? 'warn' : '') +
        kpi('Blocked (BOM / model)', ic.Blocked || 0, ic.Blocked ? 'bad' : '') +
        kpi('Pending approvals', d.approvalsPending, d.approvalsPending ? 'warn' : '') + '</div>';

      if (d.waiting.length) html += listCard('Waiting for store stock', 'These packs were scanned but their material could not be issued. They retry on every run.', d.waiting, 'warn');
      if (d.blocked.length) html += listCard('Blocked packs', 'Fix the Master Sheet, then press Retry.', d.blocked, 'bad', has('Admin') ? '<button class="btn btn-sm" id="retryBlocked">Retry blocked</button>' : '');

      html += '<div class="grid g2">';
      html += '<div class="card"><div class="card-h"><div class="card-t">Line WIP vs Finished Goods</div><div class="card-s">since cutover, by model</div></div>' +
        (d.wipfg.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Model</th><th class="num">On line</th><th class="num">Finished, not dispatched</th></tr></thead><tbody>' +
          d.wipfg.map(function (r) { return '<tr><td>' + esc(r.model) + '</td><td class="num">' + fmtN(r.line) + '</td><td class="num">' + fmtN(r.fg) + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<div class="empty">No packs since cutover yet</div>') + '</div>';
      html += '<div class="card"><div class="card-h"><div class="card-t">Plan linking</div></div><div class="card-b">' +
        '<div class="grid g2">' + kpi('Completed packs without Item ID', d.unlinked, d.unlinked ? 'warn' : '') + kpi('No matching ERP plan', d.noPlan, d.noPlan ? 'warn' : '') + '</div>' +
        '<div class="hint" style="margin-top:10px">Scanner completions are linked to the oldest pending ERP plan of the same model. Packs with no matching plan wait until a plan is added in ERP.</div></div></div>';
      html += '</div>';

      html += '<div class="card"><div class="card-h"><div class="card-t">ERP production sync</div><div class="card-s">latest 30</div></div>' +
        (d.erpSync.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Model</th><th class="num">ERP qty</th><th class="num">ERP before</th><th class="num">PLT count</th><th>Sent</th><th>Mode</th><th>Result</th><th>Updated</th></tr></thead><tbody>' +
          d.erpSync.map(function (r) {
            var sent = [r['Sent Produced'] ? 'Produced ' + r['Sent Produced'] : '', r['Sent Start'] ? 'Start ' + r['Sent Start'] : '', r['Sent Complete'] ? 'Complete ' + r['Sent Complete'] : ''].filter(String).join(' · ');
            return '<tr><td class="mono">' + esc(r['Item ID']) + '</td><td>' + esc(r.Model) + '</td><td class="num">' + esc(r['ERP Qty']) + '</td><td class="num">' + esc(r['ERP Produced (before)']) +
              '</td><td class="num">' + esc(r['PLT Count']) + '</td><td>' + esc(sent || '—') + '</td><td>' + modeChip(r.Mode) + '</td><td>' + esc(r.Result) + '</td><td class="muted">' + esc(r['Updated At']) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty">Nothing synced yet</div>') + '</div>';

      html += '<div class="card"><div class="card-h"><div class="card-t">Activity log</div></div>' +
        (d.log.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Area</th><th>Level</th><th>Message</th><th>Ref</th></tr></thead><tbody>' +
          d.log.map(function (r) {
            var c = r.Level === 'ERROR' ? 'chip-bad' : r.Level === 'WARN' ? 'chip-warn' : 'chip-off';
            return '<tr><td class="muted">' + esc(r.Time) + '</td><td>' + esc(r.Area) + '</td><td><span class="chip ' + c + '">' + esc(r.Level) + '</span></td><td>' + esc(r.Message) + '</td><td class="mono">' + esc(r.Ref) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty">No activity yet</div>') + '</div>';
      html += '</div>';
      el.innerHTML = html;

      var rb = $('#runNow');
      if (rb) rb.onclick = function () {
        busy(rb, true, 'Running…');
        api('PLT', 'suiteRunNow').then(function () { toast('Automation run finished', 'ok'); VIEWS.overview(); })
          .catch(function (e) { toast(e.message, 'bad'); busy(rb, false); });
      };
      var rt = $('#retryBlocked');
      if (rt) rt.onclick = function () {
        busy(rt, true, 'Checking…');
        api('PLT', 'suiteRetryBlocked').then(function (r) { toast(r.requeued + ' packs re-queued, ' + r.stillBlocked + ' still blocked', 'ok'); VIEWS.overview(); })
          .catch(function (e) { toast(e.message, 'bad'); busy(rt, false); });
      };
    }).catch(function (e) { el.innerHTML = '<div class="wrap"><div class="notice bad">' + esc(e.message) + '</div></div>'; });
  };
  function kpi(l, v, cls) { return '<div class="card kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (cls || '') + '">' + fmtN(v) + '</div></div>'; }
  function listCard(title, sub, rows, cls, btn) {
    return '<div class="card"><div class="card-h"><div><div class="card-t">' + esc(title) + '</div><div class="card-s">' + esc(sub) + '</div></div><div class="right">' + (btn || '') + '</div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reason</th><th class="num">Packs</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + esc(r.msg) + '</td><td class="num">' + fmtN(r.packs) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }

  /* ---------- Inward entry (Store) ---------- */
  var IN = { items: [], photos: [], lines: [] };
  VIEWS.inward = function () {
    var el = $('#view-inward');
    IN.photos = [];
    el.innerHTML = '<div class="wrap">' +
      '<div class="card"><div class="card-h"><div><div class="card-t">New inward</div><div class="card-s">Goes to Purchase (SOMS → Inward Approvals) first. Stock is added in IMS only after approval.</div></div></div>' +
      '<div class="card-b"><div class="grid g2">' +
      '<div class="field span2"><label class="lbl req" for="inItem">Item</label><input id="inItem" list="inItemList" placeholder="Search item…" autocomplete="off"><datalist id="inItemList"></datalist><div class="hint" id="inItemHint"></div></div>' +
      '<div class="field"><label class="lbl" for="inPO">Against SOMS order</label><select id="inPO"><option value="">No order (direct inward)</option></select><div class="hint" id="inPOHint"></div></div>' +
      '<div class="field"><label class="lbl req" for="inQty">Quantity received</label><input id="inQty" type="number" min="0" step="any" inputmode="decimal"></div>' +
      '<div class="field"><label class="lbl" for="inSupplier">Supplier</label><input id="inSupplier"></div>' +
      '<div class="field"><label class="lbl" id="inInvLbl" for="inInvoice">Invoice no.</label><input id="inInvoice"></div>' +
      '<div class="field span2"><label class="lbl" id="inPhotoLbl">Photos (up to 3)</label><div class="row"><label class="btn btn-sm" for="inPhoto">📷 Add photo</label>' +
      '<input id="inPhoto" type="file" accept="image/*" capture="environment" class="hidden"><span class="hint" id="inPhotoHint"></span></div><div class="photos" id="inPhotos"></div></div>' +
      '<div class="field span2"><label class="lbl" for="inRemarks">Remarks</label><textarea id="inRemarks" rows="2"></textarea></div>' +
      '</div><div class="row" style="margin-top:14px"><button class="btn btn-primary" id="inSubmit">Submit for approval</button><span class="err" id="inErr"></span></div></div></div>' +
      '<div class="card"><div class="card-h"><div class="card-t">My recent entries</div></div><div id="inMine"><div class="loading">Loading…</div></div></div></div>';

    var loadItems = IN.items.length ? Promise.resolve(IN.items) : api('IMS', 'suiteItems').then(function (r) { return r.items; });
    loadItems.then(function (list) {
      IN.items = list;
      $('#inItemList').innerHTML = list.map(function (x) { return '<option value="' + esc(x.name) + '">' + esc(x.cat) + '</option>'; }).join('');
    }).catch(function (e) { toast(e.message, 'bad'); });

    $('#inItem').addEventListener('change', onItem);
    $('#inPO').addEventListener('change', syncPoUI);
    $('#inPhoto').addEventListener('change', addPhoto);
    $('#inSubmit').addEventListener('click', submitInward);
    syncPoUI();
    loadMine();
  };
  function onItem() {
    var name = $('#inItem').value.trim(), it = IN.items.filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0];
    $('#inItemHint').textContent = it ? 'Unit: ' + (it.unit || '—') + ' · Category: ' + (it.cat || '—') : (name ? 'Pick an item from the list' : '');
    var sel = $('#inPO');
    sel.innerHTML = '<option value="">No order (direct inward)</option>';
    IN.lines = [];
    if (!it) return syncPoUI();
    api('IMS', 'suitePendingPO', { item: it.name }).then(function (r) {
      var pos = r.lines;
      IN.lines = pos;
      sel.innerHTML = '<option value="">No order (direct inward)</option>' + pos.map(function (p) {
        return '<option value="' + esc(p.poId) + '" data-supplier="' + esc(p.supplier) + '">' + esc(p.poId + ' · ' + p.supplier + ' · pending ' + p.pendingQty + ' ' + p.unit) + '</option>';
      }).join('');
      if (pos.length === 1) { sel.value = pos[0].poId; }
      syncPoUI();
    }).catch(function () {});
  }
  function syncPoUI() {
    var sel = $('#inPO'), po = sel.value, opt = sel.options[sel.selectedIndex];
    $('#inInvLbl').classList.toggle('req', !po);
    $('#inPhotoLbl').classList.toggle('req', !po);
    if (po && opt && opt.dataset.supplier && !$('#inSupplier').value) $('#inSupplier').value = opt.dataset.supplier;
    var L = (IN.lines || []).filter(function (x) { return x.poId === po; })[0];
    $('#inPOHint').textContent = L ? ('Ordered ' + L.orderedQty + ' · already received ' + L.receivedQty + ' · pending ' + L.pendingQty + ' ' + L.unit + (L.imsPo ? ' · IMS ' + L.imsPo : '')) : '';
  }
  function addPhoto(ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (IN.photos.length >= 3) { toast('Maximum 3 photos', 'bad'); return; }
    $('#inPhotoHint').textContent = 'Uploading…';
    compress(f).then(function (b64) { return api('IMS', 'uploadInwardPhoto', { data: b64, mime: 'image/jpeg' }); })
      .then(function (r) { IN.photos.push(r.id); drawPhotos(); $('#inPhotoHint').textContent = ''; })
      .catch(function (e) { $('#inPhotoHint').textContent = ''; toast(e.message, 'bad'); });
  }
  function drawPhotos() {
    $('#inPhotos').innerHTML = IN.photos.map(function (id, i) {
      return '<div class="photo-prev"><img src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w200" alt="Photo ' + (i + 1) + '"><button data-i="' + i + '" title="Remove">×</button></div>';
    }).join('');
    $$('#inPhotos button').forEach(function (b) { b.onclick = function () { IN.photos.splice(Number(b.dataset.i), 1); drawPhotos(); }; });
  }
  /** Photo ko max 1600px JPEG me chhota karo (upload fast) */
  function compress(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.onerror = function () { rej(new Error('Could not read this image')); };
      img.src = url;
    });
  }
  function submitInward() {
    var btn = $('#inSubmit'), err = $('#inErr');
    err.textContent = '';
    var item = $('#inItem').value.trim(), qty = Number($('#inQty').value), po = $('#inPO').value;
    if (!IN.items.some(function (x) { return x.name.toLowerCase() === item.toLowerCase(); })) { err.textContent = 'Pick an item from the list'; return; }
    if (!(qty > 0)) { err.textContent = 'Enter the quantity received'; return; }
    var L = (IN.lines || []).filter(function (x) { return x.poId === po; })[0];
    if (L && qty > L.pendingQty) { err.textContent = 'Only ' + L.pendingQty + ' ' + L.unit + ' is pending on ' + po; return; }
    if (!po && !$('#inInvoice').value.trim()) { err.textContent = 'Invoice number is required without an order'; return; }
    if (!po && !IN.photos.length) { err.textContent = 'Add at least one photo for a direct inward'; return; }
    busy(btn, true, 'Submitting…');
    api('IMS', 'suiteSubmitInward', { item: item, qty: qty, poId: po, supplier: $('#inSupplier').value.trim(), invoice: $('#inInvoice').value.trim(),
      photos: IN.photos.join(','), remarks: $('#inRemarks').value.trim() })
      .then(function (r) { toast('Sent for approval: ' + r.id, 'ok'); VIEWS.inward(); })
      .catch(function (e) { err.textContent = e.message; busy(btn, false); });
  }
  function loadMine() {
    api('IMS', 'suiteMyInwards').then(function (r) {
      var list = r.list;
      $('#inMine').innerHTML = list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Raised</th><th>Item</th><th class="num">Qty</th><th>PO / Invoice</th><th>Status</th><th>Note</th></tr></thead><tbody>' +
        list.map(function (r) {
          return '<tr><td class="mono">' + esc(r['Approval ID']) + '</td><td class="muted">' + esc(r['Raised At']) + '</td><td>' + esc(r.Item) + '</td><td class="num">' + esc(r.Qty) +
            (r['Accepted Qty'] !== '' && r['Accepted Qty'] != r.Qty ? ' <span class="muted">(acc ' + esc(r['Accepted Qty']) + ')</span>' : '') + '</td><td>' + esc(r['PO ID'] || r.Invoice) + '</td><td>' +
            statusChip(r.Status) + '</td><td>' + esc(r['Decision Note'] || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">No entries yet</div>';
    }).catch(function (e) { $('#inMine').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  }
  function statusChip(s) {
    var c = /^Approved/.test(s) ? 'chip-ok' : s === 'Rejected' ? 'chip-bad' : 'chip-warn';
    return '<span class="chip ' + c + '">' + esc(s) + '</span>';
  }

  /* ---------- Approvals ---------- */
  var APR = { tab: 'Pending' };
  VIEWS.approvals = function () {
    var el = $('#view-approvals');
    el.innerHTML = '<div class="wrap"><div class="card"><div class="card-h"><div class="tabs">' +
      ['Pending', 'Done'].map(function (t) { return '<div class="tab' + (APR.tab === t ? ' active' : '') + '" data-t="' + t + '">' + (t === 'Done' ? 'History' : t) + '</div>'; }).join('') +
      '</div></div><div id="aprList"><div class="loading">Loading…</div></div></div></div>';
    $$('#view-approvals .tab').forEach(function (t) { t.onclick = function () { APR.tab = t.dataset.t; VIEWS.approvals(); }; });
    api('IMS', 'suiteListApprovals', { status: APR.tab }).then(function (r) {
      var list = r.list;
      if (APR.tab === 'Pending') { var b = $('#aprBadge'); if (b) { b.textContent = list.length; b.classList.toggle('hidden', !list.length); } }
      $('#aprList').innerHTML = list.length ? list.map(aprCard).join('') : '<div class="empty">' + (APR.tab === 'Pending' ? 'Nothing waiting for approval' : 'No history yet') + '</div>';
      $$('#aprList [data-act]').forEach(function (b) { b.onclick = function () { decide(b.dataset.id, b.dataset.act); }; });
    }).catch(function (e) { $('#aprList').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  };
  function aprCard(r) {
    var photos = String(r.Photos || '').split(',').filter(String);
    var pending = r.Status === 'Pending';
    return '<div class="apr"><div><div class="apr-title">' + esc(r.Item) + ' · ' + esc(r.Qty) + ' ' + esc(r.Unit) + '</div>' +
      '<div class="apr-meta"><span>ID <b class="mono">' + esc(r['Approval ID']) + '</b></span><span>By <b>' + esc(r['Raised By']) + '</b></span><span>' + esc(r['Raised At']) + '</span>' +
      (r['PO ID'] ? '<span>PO <b>' + esc(r['PO ID']) + '</b></span>' : '<span>Direct inward</span>') +
      (r.Supplier ? '<span>Supplier <b>' + esc(r.Supplier) + '</b></span>' : '') + (r.Invoice ? '<span>Invoice <b>' + esc(r.Invoice) + '</b></span>' : '') + '</div>' +
      (r.Remarks ? '<div class="hint" style="margin-top:6px">' + esc(r.Remarks) + '</div>' : '') +
      (photos.length ? '<div class="photos">' + photos.map(function (id) {
        return '<a href="https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view" target="_blank" rel="noopener"><img src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w200" alt="Inward photo"></a>';
      }).join('') + '</div>' : '') +
      (!pending ? '<div class="apr-meta" style="margin-top:10px">' + statusChip(r.Status) + '<span>by <b>' + esc(r['Decided By']) + '</b> ' + esc(r['Decided At']) + '</span>' +
        (r['Accepted Qty'] !== '' ? '<span>Accepted <b>' + esc(r['Accepted Qty']) + '</b></span>' : '') + (r['Decision Note'] ? '<span>' + esc(r['Decision Note']) + '</span>' : '') + '</div>' +
        (r.Result ? '<div class="hint" style="margin-top:4px">' + esc(r.Result) + '</div>' : '') : '') +
      '</div>' +
      (pending ? '<div class="apr-actions"><div class="field"><label class="lbl" for="acc-' + esc(r['Approval ID']) + '">Accepted qty</label><input type="number" min="0" step="any" id="acc-' + esc(r['Approval ID']) + '" value="' + esc(r.Qty) + '"></div>' +
        '<input id="note-' + esc(r['Approval ID']) + '" placeholder="Note (required to reject)">' +
        '<div class="row"><button class="btn btn-primary btn-sm" data-act="approve" data-id="' + esc(r['Approval ID']) + '">Approve</button>' +
        '<button class="btn btn-danger btn-sm" data-act="reject" data-id="' + esc(r['Approval ID']) + '">Reject</button></div></div>' : '<div></div>') + '</div>';
  }
  function decide(id, act) {
    var acc = $('#acc-' + CSS.escape(id)), note = $('#note-' + CSS.escape(id));
    if (act === 'reject' && !note.value.trim()) { toast('Enter a reason to reject', 'bad'); note.focus(); return; }
    var btns = $$('#aprList [data-id="' + id + '"]');
    btns.forEach(function (b) { b.disabled = true; });
    api('IMS', 'suiteDecideApproval', { id: id, decision: act, acceptedQty: acc ? acc.value : '', note: note.value.trim() })
      .then(function (r) { toast(id + ': ' + r.status, 'ok'); VIEWS.approvals(); })
      .catch(function (e) { toast(e.message, 'bad'); btns.forEach(function (b) { b.disabled = false; }); });
  }

  /* ---------- Serial dispatch ---------- */
  var DSP = { items: [], item: null, eligible: {}, picked: [], q: '' };
  VIEWS.dispatch = function () {
    var el = $('#view-dispatch');
    DSP.item = null; DSP.picked = [];
    el.innerHTML = '<div class="wrap"><div class="card"><div class="card-h"><div><div class="card-t">Ready to dispatch</div><div class="card-s">ERP order items with finished packs from the line</div></div>' +
      '<div class="right"><input id="dspSearch" placeholder="Search order, customer, model…" style="width:260px"></div></div><div id="dspItems"><div class="loading">Loading…</div></div></div>' +
      '<div id="dspPanel"></div></div>';
    $('#dspSearch').value = DSP.q;
    $('#dspSearch').oninput = function () { DSP.q = this.value; drawItems(); };
    api('PLT', 'suiteDispatchItems').then(function (r) { DSP.items = r.items; drawItems(); })
      .catch(function (e) { $('#dspItems').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  };
  function drawItems() {
    var q = DSP.q.toLowerCase(), list = DSP.items.filter(function (r) {
      return !q || [r.itemId, r.orderId, r.customer, r.model].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    $('#dspItems').innerHTML = list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Item</th><th>Customer</th><th>Model</th><th class="num">Qty</th><th class="num">Dispatched</th><th class="num">Ready serials</th></tr></thead><tbody>' +
      list.map(function (r) {
        return '<tr class="click' + (DSP.item && DSP.item.itemId === r.itemId ? ' sel' : '') + '" data-id="' + esc(r.itemId) + '"><td class="mono">' + esc(r.orderId) + '</td><td class="mono">' + esc(r.itemId) + '</td><td>' + esc(r.customer) +
          '</td><td>' + esc(r.model) + '</td><td class="num">' + fmtN(r.qty) + '</td><td class="num">' + fmtN(r.dispatched) + '</td><td class="num">' + fmtN(r.readySerials) +
          (r.sameModelUnlinked ? ' <span class="muted">+' + fmtN(r.sameModelUnlinked) + ' unlinked</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">No items ready for dispatch</div>';
    $$('#dspItems tr.click').forEach(function (tr) { tr.onclick = function () { pickItem(tr.dataset.id); }; });
  }
  function pickItem(id) {
    DSP.picked = [];
    $('#dspPanel').innerHTML = '<div class="card"><div class="loading">Loading serials…</div></div>';
    api('PLT', 'suiteDispatchSerials', { itemId: id }).then(function (d) {
      DSP.item = d.item; DSP.eligible = {};
      d.serials.forEach(function (s) { DSP.eligible[s.serial.toUpperCase()] = s; });
      drawItems(); drawPanel(d);
    }).catch(function (e) { $('#dspPanel').innerHTML = '<div class="notice bad">' + esc(e.message) + '</div>'; });
  }
  function drawPanel(d) {
    var it = d.item, n = Object.keys(DSP.eligible).length;
    $('#dspPanel').innerHTML = '<div class="card"><div class="card-h"><div><div class="card-t">' + esc(it.customer) + ' · ' + esc(it.model) + '</div>' +
      '<div class="card-s">Order ' + esc(it.orderId) + ' · Item ' + esc(it.itemId) + ' · Qty ' + fmtN(it.qty) + ' · Already dispatched ' + fmtN(d.dispatched) + ' · ' + fmtN(n) + ' serials ready</div></div></div>' +
      '<div class="card-b"><div class="grid g2">' +
      '<div class="field span2"><label class="lbl" for="dspScan">Scan battery serial</label><input id="dspScan" class="scan-box" autocomplete="off" placeholder="Scan or type serial, then Enter">' +
      '<div class="row" style="justify-content:space-between"><span class="hint" id="dspCount">0 scanned</span><button class="btn btn-ghost btn-sm" id="dspAll">Add all ready serials</button></div><div class="serials" id="dspSerials"></div><div class="hint">* not yet linked to this order item; it gets linked when dispatched</div></div>' +
      '<div class="field"><label class="lbl req" for="dspTransport">Transport name</label><input id="dspTransport"></div>' +
      '<div class="field"><label class="lbl req" for="dspLr">LR / Bilty no.</label><input id="dspLr"></div>' +
      '<div class="field"><label class="lbl" for="dspVehicle">Vehicle no.</label><input id="dspVehicle"></div>' +
      '<div class="field"><label class="lbl" for="dspDriver">Driver no.</label><input id="dspDriver" inputmode="tel"></div>' +
      '<div class="field"><label class="lbl" for="dspDate">Dispatch date</label><input id="dspDate" type="date" value="' + today() + '" max="' + today() + '"></div>' +
      '<div class="field"><label class="lbl" for="dspRemarks">Remarks</label><input id="dspRemarks"></div>' +
      '</div><div class="row" style="margin-top:14px"><button class="btn btn-primary" id="dspSubmit">Dispatch</button><span class="err" id="dspErr"></span></div></div></div>';
    var box = $('#dspScan');
    box.focus();
    box.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); addSerial(box.value); box.value = ''; } };
    $('#dspAll').onclick = function () { Object.keys(DSP.eligible).forEach(function (k) { if (DSP.picked.indexOf(DSP.eligible[k].serial) === -1) DSP.picked.push(DSP.eligible[k].serial); }); drawSerials(); };
    $('#dspSubmit').onclick = submitDispatch;
    drawSerials();
  }
  function addSerial(raw) {
    var box = $('#dspScan'), s = String(raw || '').trim();
    if (!s) return;
    var hit = DSP.eligible[s.toUpperCase()];
    box.classList.remove('flash-ok', 'flash-bad'); void box.offsetWidth;
    if (!hit) { box.classList.add('flash-bad'); toast(s + ' is not ready for this item', 'bad'); return; }
    if (DSP.picked.indexOf(hit.serial) !== -1) { box.classList.add('flash-bad'); toast(s + ' already scanned', 'bad'); return; }
    DSP.picked.push(hit.serial); box.classList.add('flash-ok'); drawSerials();
  }
  function drawSerials() {
    $('#dspCount').textContent = DSP.picked.length + ' scanned';
    $('#dspSerials').innerHTML = DSP.picked.map(function (s, i) {
      var x = DSP.eligible[s.toUpperCase()] || {};
      return '<span class="serial" title="' + esc((x.cellOpt || '') + ' cell · ' + (x.bmsOpt || '') + ' BMS' + (x.linked ? '' : ' · not yet linked to this item')) + '">' + esc(s) + (x.linked ? '' : ' *') + '<button data-i="' + i + '" title="Remove">×</button></span>';
    }).join('');
    $$('#dspSerials button').forEach(function (b) { b.onclick = function () { DSP.picked.splice(Number(b.dataset.i), 1); drawSerials(); }; });
  }
  function submitDispatch() {
    var btn = $('#dspSubmit'), err = $('#dspErr');
    err.textContent = '';
    if (!DSP.picked.length) { err.textContent = 'Scan at least one serial'; return; }
    if (!$('#dspTransport').value.trim()) { err.textContent = 'Transport name is required'; return; }
    if (!$('#dspLr').value.trim()) { err.textContent = 'LR / Bilty number is required'; return; }
    var it = DSP.item, already = (DSP.items.filter(function (x) { return x.itemId === it.itemId; })[0] || {}).dispatched || 0;
    if (it.qty && already + DSP.picked.length > it.qty && !confirm('This will dispatch more than the order quantity (' + it.qty + '). Continue?')) return;
    if (!confirm('Dispatch ' + DSP.picked.length + ' batteries for ' + it.customer + '?')) return;
    busy(btn, true, 'Dispatching…');
    api('PLT', 'suiteSubmitDispatch', { itemId: it.itemId, serials: DSP.picked.join(','), transport: $('#dspTransport').value.trim(), lr: $('#dspLr').value.trim(),
      vehicle: $('#dspVehicle').value.trim(), driver: $('#dspDriver').value.trim(), date: $('#dspDate').value, remarks: $('#dspRemarks').value.trim() })
      .then(function (r) {
        var imsBad = Object.keys(r.ims).some(function (k) { return /^FAIL/.test(r.ims[k]); });
        toast(r.ref + ': ' + r.count + ' dispatched' + (r.mode === 'SHADOW' ? ' (shadow)' : '') + (imsBad ? ', IMS will retry' : ''), imsBad ? 'bad' : 'ok');
        VIEWS.dispatch();
      })
      .catch(function (e) { err.textContent = e.message; busy(btn, false); });
  }

  /* ---------- Settings (Admin) — ERP GAS: Links sheet + ERP Users ---------- */
  VIEWS.settings = function () {
    var el = $('#view-settings');
    el.innerHTML = '<div class="wrap"><div class="loading">Loading settings…</div></div>';
    Promise.all([api('ERP', 'suiteLinks'), api('ERP', 'suiteUsers'),
                 api('ERP', 'suiteStaff').catch(function (e) { return { success: false, err: e.message }; })]).then(function (res) {
      var L = res[0], U = res[1];
      SET.U = U; SET.ST = res[2];
      var modeKeys = L.config.filter(function (c) { return /^MODE_/.test(c.key); });
      var other = L.config.filter(function (c) { return !/^MODE_/.test(c.key); });
      var html = '<div class="wrap">' +
        '<div class="notice">Start with every mode on SHADOW and compare with the manual entries. Switch one area to LIVE at a time, and set CUTOVER to the moment you switch.</div>' +
        '<div class="card"><div class="card-h"><div class="card-t">Automation modes</div></div><div class="tbl-wrap"><table class="tbl"><tbody>' +
        modeKeys.map(function (c) {
          return '<tr><td><b>' + esc(c.key) + '</b><div class="hint">' + esc(c.note) + '</div></td><td style="width:170px"><select data-key="' + esc(c.key) + '">' +
            ['OFF', 'SHADOW', 'LIVE'].map(function (m) { return '<option' + (m === c.value ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-h"><div class="card-t">General</div></div><div class="tbl-wrap"><table class="tbl"><tbody>' +
        other.map(function (c) {
          return '<tr><td><b>' + esc(c.key) + '</b><div class="hint">' + esc(c.note) + '</div></td><td style="width:340px"><div class="row" style="flex-wrap:nowrap"><input data-key="' + esc(c.key) + '" value="' + esc(c.value) + '">' +
            '<button class="btn btn-sm" data-save="' + esc(c.key) + '">Save</button></div></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-h"><div class="card-t">Connected apps</div></div><div class="tbl-wrap"><table class="tbl"><tbody>' +
        ['ERP', 'IMS', 'PLT', 'SOMS', 'SERVICE'].map(function (a) {
          var v = (L.urls || {})[a];
          return '<tr><td><b>' + a + '</b></td><td class="mono">' + (v ? esc(v) : '<span class="chip chip-bad">Not registered</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-h"><div><div class="card-t">Team logins</div><div class="card-s">' +
          (U.central ? 'One login per team (sales, store, purchase…). People inside a team pick their own name + PIN (Staff below).'
                     : 'Users still come from the Sales &amp; Orders sheet. Run <b>suiteCentralSetup</b> once in the ERP script to move them here.') +
          '</div></div>' + (U.central ? '<button class="btn btn-sm btn-primary" id="userAdd">+ Add login</button>' : '') + '</div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>User</th><th>Active</th><th>Job</th><th></th></tr></thead><tbody>' +
        U.users.map(function (u) {
          return '<tr><td><b>' + esc(u.name) + '</b><div class="hint mono">' + esc(u.username) + '</div></td><td>' + (u.active ? '<span class="chip chip-ok">Yes</span>' : '<span class="chip chip-off">No</span>') +
            '</td><td>' + jobsOf(u).map(function (j) { return '<span class="chip">' + esc(JOBS[j].label) + '</span>'; }).join(' ') +
            '</td><td style="white-space:nowrap"><button class="btn btn-sm" data-edit="' + esc(u.username) + '">Edit</button>' +
            (U.central && u.username !== S.user.username ? ' <button class="btn btn-sm" data-udel="' + esc(u.username) + '">Delete</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div><div id="userForm"></div></div>' +
        staffCard(SET.ST) + workLogCard() + '</div>';
      el.innerHTML = html;
      staffWire(); workLogWire();
      if ($('#userAdd')) $('#userAdd').onclick = function () { userForm(null); };
      $$('#view-settings select[data-key]').forEach(function (x) { x.onchange = function () { saveCfg(x.dataset.key, x.value, x); }; });
      $$('#view-settings [data-save]').forEach(function (b) { b.onclick = function () { var i = $('#view-settings input[data-key="' + b.dataset.save + '"]'); saveCfg(b.dataset.save, i.value, b); }; });
      $$('#view-settings [data-edit]').forEach(function (b) { b.onclick = function () { userForm(U.users.filter(function (u) { return u.username === b.dataset.edit; })[0]); }; });
            $$('#view-settings [data-udel]').forEach(function (b) { b.onclick = function () { delRow(b, { kind: 'user', username: b.dataset.udel }, 'login "' + b.dataset.udel + '"'); }; });
    }).catch(function (e) { el.innerHTML = '<div class="wrap"><div class="notice bad">' + esc(e.message) + '</div></div>'; });
  };
  function saveCfg(key, value, el) {
    if (/^MODE_/.test(key) && value === 'LIVE' && !confirm(key + ' → LIVE\n\nThis will start writing into the apps through their existing actions. Continue?')) { VIEWS.settings(); return; }
    el.disabled = true;
    api('ERP', 'suiteSaveLink', { key: key, value: value }).then(function () { toast(key + ' saved', 'ok'); el.disabled = false; })
      .catch(function (e) { toast(e.message, 'bad'); el.disabled = false; });
  }
  /* ---------- "Kaam" — ek user ke liye sirf kaam chuno, baaki access apne aap set ---------- */
  var JOBS = {
    Admin:      { label: 'Admin',              hint: 'Everything + Settings' },
    Store:      { label: 'Store',              hint: 'Inventory: Inward, Outward, Indent / PO' },
    Purchase:   { label: 'Purchase',           hint: 'Purchase: Orders, Receiving, Inward Approvals' },
    Production: { label: 'Production',         hint: 'Line Scan, Line Admin, Overview, Inventory' },
    Dispatch:   { label: 'Dispatch',           hint: 'ERP: Dispatch page (Role column = Dispatch)' },
    ErpOnly:    { label: 'Sales & Orders only', hint: 'Sales / Accounts / CRM (page set by the Role column)' },
    Attendant:  { label: 'Call Attendant',     hint: 'Service Hub: New Ticket, Tracker' },
    Service:    { label: 'Service Team',       hint: 'Service Hub: Tickets, calls, pickup, receiving' },
    Repair:     { label: 'Repair Team',        hint: 'Service Hub: Repair Board, Dispatch' }
  };
  var JOB_ORDER = ['Admin', 'Store', 'Purchase', 'Production', 'Dispatch', 'ErpOnly', 'Attendant', 'Service', 'Repair'];
  var SVC_JOBS = ['Attendant', 'Service', 'Repair'];
  /** Saved access se "Kaam" wapas pehchano (table + form ke liye) */
  function jobsOf(u) {
    var r = u.roles || [];
    if (r.indexOf('Admin') !== -1) return ['Admin'];
    var j = [];
    if (r.indexOf('Store') !== -1) j.push('Store');
    if (u.somsRole === 'Purchase' || u.somsRole === 'Admin') j.push('Purchase');
    if (r.indexOf('Production') !== -1) j.push('Production');
    if (r.indexOf('Dispatch') !== -1) j.push('Dispatch');
        SVC_JOBS.forEach(function (k) { if (r.indexOf(k) !== -1) j.push(k); });
    if (!j.length) j.push('ErpOnly');
    return j;
  }
  /** Chune hue Kaam → Suite roles + IMS role + SOMS role + PLT supervisor */
  function accessFor(jobs) {
    var has = function (k) { return jobs.indexOf(k) !== -1; };
    if (has('Admin')) return { roles: ['Admin', 'Store', 'Approver', 'Dispatch', 'Production', 'Viewer'], imsRole: 'admin', somsRole: 'Admin', pltSup: true };
    var roles = [];
    if (has('Store')) roles.push('Store');
    if (has('Production')) roles.push('Production');
        if (has('Dispatch')) roles.push('Dispatch');
    SVC_JOBS.forEach(function (k) { if (has(k)) roles.push(k); });
    return {
      roles: roles,
      imsRole: has('Store') ? 'ajay' : (has('Production') ? 'sandeep' : ''),
      somsRole: has('Purchase') ? 'Purchase' : '',
      pltSup: has('Production')
    };
  }
  function userForm(u) {
    var isNew = !u, central = SET.U && SET.U.central;
    u = u || { username: '', name: '', roles: [], active: true, erpRole: '', salesName: '' };
    var cur = isNew ? ['ErpOnly'] : jobsOf(u);
    var ERP_ROLES = (SET.U && SET.U.erpRoles) || ['Admin', 'Sales', 'Accounts', 'CRM', 'Production', 'Dispatch', 'Viewer'];
    var acct = !central ? '' : '<div class="grid g3" style="margin-bottom:12px">' +
      (isNew ? '<div class="field"><label class="lbl" for="ufUser">Username</label><input id="ufUser" autocomplete="off" placeholder="e.g. crm"></div>' : '') +
      '<div class="field"><label class="lbl" for="ufName">Name</label><input id="ufName" value="' + esc(u.name) + '" placeholder="e.g. CRM Team"></div>' +
      '<div class="field"><label class="lbl" for="ufErp">Sales &amp; Orders role</label><select id="ufErp"><option value="">—</option>' +
        ERP_ROLES.map(function (r) { return '<option' + (r === u.erpRole ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="lbl" for="ufSales">Sales Name <span class="hint">(only a personal sales login)</span></label><input id="ufSales" value="' + esc(u.salesName) + '"></div>' +
      '<div class="field"><label class="lbl" for="ufPw">' + (u.username === 'admin' ? 'New admin PIN <span class="hint">(4 digits · blank = no change)</span>' : isNew ? 'Password' : 'New password <span class="hint">(blank = no change)</span>') + '</label><input id="ufPw" type="password" autocomplete="new-password"' + (u.username === 'admin' ? ' inputmode="numeric" maxlength="4"' : '') + '></div></div>';
    $('#userForm').innerHTML = '<div class="card-b" style="border-top:1px solid var(--line)"><div class="card-t" style="margin-bottom:12px">' + (isNew ? 'New login' : esc(u.name) + ' <span class="muted mono">' + esc(u.username) + '</span>') + '</div>' + acct +
      '<div class="field"><span class="lbl">Job (pick one or more)</span><div class="grid g3">' + JOB_ORDER.map(function (k) {
        return '<label class="chip" style="display:flex;gap:8px;align-items:flex-start;padding:10px 12px;cursor:pointer"><input type="checkbox" class="ufJob" value="' + k + '"' + (cur.indexOf(k) !== -1 ? ' checked' : '') + ' style="width:auto;margin-top:2px">' +
          '<span><b>' + esc(JOBS[k].label) + '</b><br><span class="hint">' + esc(JOBS[k].hint) + '</span></span></label>';
      }).join('') + '</div></div>' +
      '<div class="field" style="max-width:220px;margin-top:12px"><label class="lbl" for="ufActive">Active</label><select id="ufActive"><option value="true">Yes</option><option value="false"' + (!u.active ? ' selected' : '') + '>No</option></select></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn btn-primary" id="ufSave">Save</button><button class="btn btn-ghost" id="ufCancel">Cancel</button><span class="err" id="ufErr"></span></div></div>';
    var boxes = $$('.ufJob');
    boxes.forEach(function (c) {
      c.onchange = function () {   // Admin = sab kuch; "Sirf ERP" baaki ke saath nahi
        if (!c.checked) return;
        if (c.value === 'Admin' || c.value === 'ErpOnly') boxes.forEach(function (x) { if (x !== c) x.checked = false; });
        else boxes.forEach(function (x) { if (x.value === 'Admin' || x.value === 'ErpOnly') x.checked = false; });
      };
    });
    $('#ufCancel').onclick = function () { $('#userForm').innerHTML = ''; };
    $('#ufSave').onclick = function () {
      var btn = this, jobs = boxes.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (!jobs.length) { $('#ufErr').textContent = 'Pick at least one job'; return; }
      var a = accessFor(jobs);
      var d = { username: isNew ? ($('#ufUser').value || '').trim().toLowerCase() : u.username, active: $('#ufActive').value, imsRole: a.imsRole, somsRole: a.somsRole, pltSup: String(a.pltSup), roles: a.roles.join(',') };
      if (central) {
        d.isNew = String(isNew); d.name = $('#ufName').value.trim(); d.erpRole = $('#ufErp').value; d.salesName = $('#ufSales').value.trim(); d.password = $('#ufPw').value;
        if (jobs.indexOf('Admin') !== -1 && !d.erpRole) d.erpRole = 'Admin';
        if (isNew && !d.username) { $('#ufErr').textContent = 'Enter a username'; return; }
      }
      busy(btn, true, 'Saving…');
      api('ERP', 'suiteSaveUser', d)
        .then(function () { toast('Saved. Changes apply at the user\'s next sign-in.', 'ok'); VIEWS.settings(); })
        .catch(function (e) { $('#ufErr').textContent = e.message; busy(btn, false); });
    };
    $('#userForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- Staff: har insaan ek baar (Emp ID), apps me team, ek PIN — Links → Staff ---------- */
  var SET = { U: null, ST: null };
  var APP_TXT = { ERP: 'Sales & Orders', IMS: 'Inventory', SOMS: 'Purchase', SERVICE: 'Service Hub' };
  var APP_ORDER = ['ERP', 'IMS', 'SOMS', 'SERVICE'];
  function staffCard(ST) {
    if (!ST || !ST.success) return '<div class="card"><div class="card-h"><div class="card-t">Staff</div></div><div class="card-b"><div class="notice">' +
      esc((ST && ST.err) || 'Staff list not available') + ' — deploy the latest ERP script and run <b>suiteCentralSetup</b> once.</div></div></div>';
    var noPin = ST.staff.filter(function (s) { return s.active && !s.hasPin; }).length;
    return '<div class="card"><div class="card-h"><div><div class="card-t">Staff <span class="muted">(' + ST.staff.length + ')</span></div>' +
      '<div class="card-s">Each person once, by Emp ID. Pick their team in each app and give one PIN — it works in every app.</div></div>' +
      '<div class="row"><input id="stQ" placeholder="Search name / Emp ID" style="width:200px"><button class="btn btn-sm btn-primary" id="stAdd">+ Add person</button></div></div>' +
      '<div class="card-b" style="padding-top:0"><div class="notice' + (ST.on ? '' : ' warn') + '" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<span style="flex:1;min-width:220px">' + (ST.on
          ? '<b>Central staff is ON</b> — every app reads names, PINs and writes the Work Log here.'
          : '<b>Central staff is OFF</b> — apps still use their own Staff tabs. Set everyone&#39;s PIN first, then switch ON.') +
        (noPin ? ' <span class="chip chip-warn">' + noPin + ' without PIN</span>' : '') + '</span>' +
        '<button class="btn btn-sm" id="stToggle">' + (ST.on ? 'Switch OFF' : 'Switch ON') + '</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Emp ID</th><th>Name</th>' + APP_ORDER.map(function (a) { return '<th>' + esc(APP_TXT[a]) + '</th>'; }).join('') +
        '<th>PIN</th><th>Active</th><th></th></tr></thead><tbody id="stRows"></tbody></table></div><div id="staffForm"></div></div>';
  }
  function staffRows() {
    var ST = SET.ST, q = (($('#stQ') || {}).value || '').trim().toLowerCase();
    var L = ST.staff.filter(function (s) { return !q || (s.id + ' ' + s.name + ' ' + s.salesName).toLowerCase().indexOf(q) !== -1; });
    $('#stRows').innerHTML = L.length ? L.map(function (s) {
      return '<tr><td class="mono">' + esc(s.id) + '</td><td><b>' + esc(s.name) + '</b>' + (s.salesName ? '<div class="hint">Sales Name: ' + esc(s.salesName) + '</div>' : '') + '</td>' +
        APP_ORDER.map(function (a) { return '<td>' + (s.teams[a] ? '<span class="chip">' + esc(s.teams[a]) + '</span>' : '<span class="muted">—</span>') + '</td>'; }).join('') +
        '<td>' + (s.hasPin ? '<span class="chip chip-ok">Set</span>' : '<span class="chip chip-warn">Not set</span>') + '</td>' +
        '<td>' + (s.active ? '<span class="chip chip-ok">Yes</span>' : '<span class="chip chip-off">No</span>') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn btn-sm" data-st="' + esc(s.id) + '">Edit</button> <button class="btn btn-sm" data-sdel="' + esc(s.id) + '">Delete</button></td></tr>';
    }).join('') : '<tr><td colspan="9" class="muted">No staff yet — click “Add person”.</td></tr>';
    $$('#stRows [data-st]').forEach(function (b) { b.onclick = function () { staffForm(ST.staff.filter(function (s) { return s.id === b.dataset.st; })[0]); }; });
        $$('#stRows [data-sdel]').forEach(function (b) { b.onclick = function () { delRow(b, { kind: 'staff', empId: b.dataset.sdel }, b.closest('tr').querySelector('b').textContent + ' (' + b.dataset.sdel + ')'); }; });
  }
    function delRow(btn, d, what) {
    if (!confirm('Delete ' + what + '?\n\nThis cannot be undone. Old Work Log entries stay.')) return;
    busy(btn, true, '…');
    api('ERP', 'suiteDelete', d).then(function () { toast('Deleted ' + what, 'ok'); VIEWS.settings(); })
      .catch(function (e) { toast(e.message, 'bad'); busy(btn, false); });
  }
  function staffWire() {
    var ST = SET.ST;
    if (!ST || !ST.success) return;
    staffRows();
    $('#stQ').oninput = staffRows;
    $('#stAdd').onclick = function () { staffForm(null); };
    $('#stToggle').onclick = function () {
      var btn = this, on = !ST.on;
      if (on && !confirm('Switch central staff ON?\n\nAll 4 apps will use these names and PINs from now on. People need their NEW PIN.')) return;
      if (!on && !confirm('Switch OFF? Apps go back to their own old Staff tabs.')) return;
      busy(btn, true, 'Saving…');
      api('ERP', 'suiteCentralToggle', { on: String(on) }).then(done, function (e) {
        if (on && /no PIN yet/.test(e.message) && confirm(e.message + '\n\nThey cannot pick their name until a PIN is set. Switch ON anyway?'))
          return api('ERP', 'suiteCentralToggle', { on: 'true', force: 'true' }).then(done);
        throw e;
      }).catch(function (e) { toast(e.message, 'bad'); busy(btn, false); });
      function done() { toast('Central staff ' + (on ? 'ON' : 'OFF') + ' — apps pick it up within about 5 minutes', 'ok'); VIEWS.settings(); }
    };
  }
  function staffForm(s) {
    var ST = SET.ST, isNew = !s;
    s = s || { id: '', name: '', teams: {}, salesName: '', active: true };
    var emp = (ST.employees || []).filter(function (e) { return !ST.staff.some(function (x) { return x.id === e.id; }); });
    var html = '<div class="card-b" style="border-top:1px solid var(--line)"><div class="card-t" style="margin-bottom:12px">' + (isNew ? 'Add person' : esc(s.name) + ' <span class="muted mono">' + esc(s.id) + '</span>') + '</div>' +
      (isNew ? '<div class="field" style="max-width:420px"><label class="lbl" for="sfEmp">Employee <span class="hint">(Common Employees sheet)</span></label>' +
        (ST.empError ? '<div class="err">' + esc(ST.empError) + '</div>' : '') +
        '<input id="sfEmp" list="sfEmpList" placeholder="Type name or Emp ID" autocomplete="off"><datalist id="sfEmpList">' +
        emp.map(function (e) { return '<option value="' + esc(e.id + ' — ' + e.name) + '">' + esc([e.dept, e.desig].filter(Boolean).join(' · ')) + '</option>'; }).join('') + '</datalist></div>' : '') +
      '<div class="grid g2" style="margin-top:8px">' + APP_ORDER.map(function (a) {
        return '<div class="field"><label class="lbl" for="sfT' + a + '">' + esc(APP_TXT[a]) + ' team</label><select id="sfT' + a + '" class="sfTeam" data-app="' + a + '"><option value="">— not in this app —</option>' +
          (ST.teams[a] || []).map(function (t) { return '<option' + (s.teams[a] === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>';
      }).join('') + '</div>' +
      '<div class="grid g3" style="margin-top:8px">' +
        '<div class="field" id="sfSalesBox"><label class="lbl" for="sfSales">Sales Name <span class="hint">(name on orders)</span></label><input id="sfSales" list="sfSalesList" value="' + esc(s.salesName) + '">' +
          '<datalist id="sfSalesList">' + (ST.salesNames || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></div>' +
        '<div class="field"><label class="lbl" for="sfPin">' + (isNew || !s.hasPin ? 'PIN (4 digits)' : 'New PIN <span class="hint">(4 digits · blank = no change)</span>') + '</label><input id="sfPin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>' +
        '<div class="field"><label class="lbl" for="sfActive">Active</label><select id="sfActive"><option value="true">Yes</option><option value="false"' + (s.active ? '' : ' selected') + '>No</option></select></div></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn btn-primary" id="sfSave">Save</button><button class="btn btn-ghost" id="sfCancel">Cancel</button><span class="err" id="sfErr"></span></div></div>';
    $('#staffForm').innerHTML = html;
    var salesToggle = function () {
      var on = $('#sfTERP').value === 'Sales';
      $('#sfSalesBox').style.display = on ? '' : 'none';
    };
    $$('.sfTeam').forEach(function (c) { c.onchange = salesToggle; });
    salesToggle();
    $('#sfCancel').onclick = function () { $('#staffForm').innerHTML = ''; };
    $('#sfSave').onclick = function () {
      var btn = this, d = { isNew: String(isNew), empId: s.id, active: $('#sfActive').value, pin: $('#sfPin').value.trim(), salesName: $('#sfSales').value.trim() };
      if (isNew) {
        var v = ($('#sfEmp').value || '').trim(), m = v.split(' — ')[0].trim().toUpperCase();
        if (!(ST.employees || []).some(function (e) { return e.id === m; })) { $('#sfErr').textContent = 'Pick an employee from the list'; return; }
        d.empId = m;
      }
      APP_ORDER.forEach(function (a) { d[a] = $('#sfT' + a).value; });
      busy(btn, true, 'Saving…');
      api('ERP', 'suiteStaffSave', d).then(function () { toast('Saved' + (d.pin ? ' — tell them the new PIN' : ''), 'ok'); VIEWS.settings(); })
        .catch(function (e) { $('#sfErr').textContent = e.message; busy(btn, false); });
    };
    $('#staffForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- Work Log — charon apps, Emp ID wise ---------- */
  function workLogCard() {
    return '<div class="card"><div class="card-h"><div><div class="card-t">Work Log</div><div class="card-s">Every saved entry from all apps, with the Emp ID of who did it.</div></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:8px"><input type="date" id="wlFrom" style="width:150px"><input type="date" id="wlTo" style="width:150px"><select id="wlApp" style="width:150px"><option value="">All apps</option>' +
      APP_ORDER.map(function (a) { return '<option value="' + a + '">' + esc(APP_TXT[a]) + '</option>'; }).join('') + '</select>' +
      '<input id="wlEmp" placeholder="Emp ID" style="width:110px"><button class="btn btn-sm" id="wlGo">Show</button></div></div><div id="wlOut"></div></div>';
  }
  function workLogWire() {
    if (!$('#wlGo')) return;
    $('#wlFrom').value = today(); $('#wlTo').value = today();
    $('#wlGo').onclick = function () {
      var btn = this; busy(btn, true, 'Loading…');
      api('ERP', 'suiteWorkLog', { from: $('#wlFrom').value, to: $('#wlTo').value, app: $('#wlApp').value, empId: $('#wlEmp').value.trim() }).then(function (r) {
        busy(btn, false);
        var rows = r.data || [], by = {};
        rows.forEach(function (x) { var k = (x['Emp ID'] || '—') + '|' + (x['Name'] || ''); by[k] = (by[k] || 0) + 1; });
        var sum = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) { var p = k.split('|'); return '<span class="chip">' + esc(p[1] || p[0]) + ' <b>' + by[k] + '</b></span>'; }).join(' ');
        $('#wlOut').innerHTML = !rows.length ? '<div class="card-b muted">No entries.</div>' :
          '<div class="card-b" style="padding-top:0">' + sum + '</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Emp ID</th><th>Name</th><th>App</th><th>Team</th><th>Action</th><th>Record</th><th>Party</th><th>Qty</th><th>Handled by</th></tr></thead><tbody>' +
          rows.slice(0, 300).map(function (x) {
            return '<tr><td class="mono">' + esc(String(x['Time']).slice(5, 16)) + '</td><td class="mono">' + esc(x['Emp ID']) + '</td><td>' + esc(x['Name']) + '</td><td>' + esc(APP_TXT[x['App']] || x['App']) +
              '</td><td>' + esc(x['Team']) + '</td><td>' + esc(x['Action']) + '</td><td class="mono">' + esc(x['Record ID']) + '</td><td>' + esc(x['Party']) +
              '</td><td>' + esc(x['Qty']) + (x['Unit'] ? ' ' + esc(x['Unit']) : '') + '</td><td>' + esc(x['Handled By']) + '</td></tr>';
          }).join('') + '</tbody></table></div>' + (rows.length > 300 ? '<div class="card-b hint">Showing 300 of ' + rows.length + '</div>' : '');
      }).catch(function (e) { busy(btn, false); toast(e.message, 'bad'); });
    };
  }

  /* =============================================================
   * BOOT
   * ============================================================= */
  function boot() {
    $('#loginBtn').onclick = doLogin;
    $('#teamSel').onchange = teamPeople;
    $('#teamBtn').onclick = teamPwLogin;
    $('#teamPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') teamPwLogin(); });
    LK.team = makeLock($('#teamLock'), teamPinLogin);
    LK.admin = makeLock($('#adminLock'), adminPinLogin);
    $('#adminBtn').onclick = function () {                       // 👑 Admin: 4 digit PIN
      if (TL.mode === 'admin') { loginMode('team'); teamPeople(); } else loginMode('admin');
    };
    $('#adminBack').onclick = function () { loginMode('team'); teamPeople(); };
    $('#pwBack').onclick = $('#adminBack').onclick;
    $('#adminPw').onclick = function () { loginMode('pw'); $('#userInput').focus(); };   // admin PIN 4 digit nahi hai to bhi andar aa sake
    $('#teamEye').onclick = function () {
      var i = $('#teamPin'), show = i.type === 'password';
      i.type = show ? 'text' : 'password'; this.classList.toggle('on', show); i.focus();
    };
    $('#pwToggle').onclick = function () {
      var i = $('#pinInput'), show = i.type === 'password';
      i.type = show ? 'text' : 'password'; this.classList.toggle('on', show);
      this.title = show ? 'Hide password' : 'Show password'; i.focus();
    };
    $('#pinInput').addEventListener('keyup', function (e) {
      if (e.getModifierState) $('#capsWarn').classList.toggle('hidden', !e.getModifierState('CapsLock'));
    });
    $('#pinInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('#userInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#pinInput').focus(); });
    $('#logoutBtn').onclick = function () { if (confirm('Sign out of all apps?')) signOut(); };
    $('#reloadBtn').onclick = reloadCurrent;
    // ---- sidebar: search, chhota/bada, mobile drawer ----
    $('#snSearch').addEventListener('input', buildNav);
    $('#snSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { this.value = ''; buildNav(); this.blur(); }
      if (e.key === 'Enter') { var f = $('#nav .sn-page, #nav .nav-item'); if (f) { f.click(); this.value = ''; buildNav(); this.blur(); } }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && S.user && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); $('#snSearch').focus(); }
    });
    try { if (localStorage.getItem('sn_mini') === '1') $('#appShell').classList.add('sn-mini'); } catch (e) {}
    $('#snMini').onclick = function () {
      var on = $('#appShell').classList.toggle('sn-mini');
      try { localStorage.setItem('sn_mini', on ? '1' : '0'); } catch (e) {}
    };
    $('#snMenu').onclick = function () { $('#appShell').classList.toggle('sn-open'); };
    $('#snScrim').onclick = snClose;
    // module iframes se logout message
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.source !== 'litpax-suite') return;
      if (e.data.type === 'logout') signOut();
      if (e.data.type === 'agent') openAgent();   // kisi app me Ctrl+K
      if (e.data.type === 'open-replace') openReplace();   // ERP → Service Hub → Advance Replacement
      if (e.data.type === 'open-record') openRecordX(e.data.rtype, e.data.id);   // kisi bhi app ka linked record
      if (e.data.type === 'nav') onAppNav(e);     // app ke pages → common sidebar
      // Service Hub ka session (idle) khatam → Suite ke token se chupchaap naya, warna poora sign out
      if (e.data.type === 'svc-relogin') {
                Promise.all([svcSso(), repCheck()]).then(repOnly).then(function () {
          if (svcRole() && S.frames.service) S.frames.service.src = SUITE.MODULES.service.path;
          else signOut();
        });
      }
    });
    setInterval(function () { if (S.user) refreshBadge(); }, 120000);
    // Ctrl+K → Ask Litpax (sirf Admin)
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k' && S.user) { e.preventDefault(); openAgent(); }
    });

    if (/^PASTE_/.test(SUITE.ERP_URL || 'PASTE_')) {
      showLogin(); $('#loginError').textContent = 'GAS URLs are not set in config.js'; return;
    }
    var tok = '';
    try { tok = sessionStorage.getItem('suite_token') || ''; } catch (e) {}
    if (!tok) { svcClear(); return showLogin(); }
    S.token = tok;
    api('ERP', 'suiteMe').then(function (d) { return Promise.all([svcRole() && svcRole() !== 'replace' ? Promise.resolve() : svcSso(), repCheck()]).then(repOnly).then(function () { start(d); }); })
      .catch(function () { signOut(); });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
