/* My Space — employee dashboard, advance requests, HR/Owner inbox (JSON POST to Employee GAS) */
(function () {
  'use strict';
  var CFG = window.CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var inSuite = window.parent !== window;
  var SKEL = '<div class="skel"><i></i><i></i><i></i></div>';
  var S = { token: '', mode: '', user: null, tab: '', dash: null, inbox: null, canInbox: false };

  /* ---------- helpers ---------- */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pick(o, keys) { for (var i = 0; i < keys.length; i++) { if (o && o[keys[i]] != null && o[keys[i]] !== '') return o[keys[i]]; } return ''; }
  function money(n) { n = Number(n); return isNaN(n) ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
  function dt(v) {
    if (!v) return '—'; var d = new Date(v);
    return isNaN(d) ? esc(v) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function toast(msg, bad) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 3200);
  }
  function busy(btn, on, txt) { if (!btn) return; if (on) { btn._t = btn.textContent; btn.textContent = txt || 'Please wait…'; } else if (btn._t) btn.textContent = btn._t; btn.disabled = !!on; }
  function chipFor(st) {
    var c = /given|recovered|approved/i.test(st) ? 'ok' : /reject|cancel/i.test(st) ? 'bad' : /pending/i.test(st) ? 'warn' : '';
    return '<span class="chip ' + c + '">' + esc(st || '—') + '</span>';
  }

  /* ---------- API ---------- */
  function api(action, data, useSuiteToken) {
    var body = Object.assign({ action: action }, data || {});
    var tok = useSuiteToken ? sessionStorage.getItem('suite_token') : S.token;
    if (tok) body.token = tok;
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, CFG.TIMEOUT_MS || 25000);
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        if (!d || !d.ok) {
          var e = new Error((d && (d.message || d.error)) || 'Request failed'); e.code = d && d.error;
          if (/token|session|expired|unauth|login|sign in/i.test((d && (d.error + ' ' + d.message)) || '') && !useSuiteToken) { e.auth = true; }
          throw e;
        }
        return d;
      }, function (e) { clearTimeout(timer); throw new Error(e && e.name === 'AbortError' ? 'Server slow hai, dobara try karo' : 'Network error — internet check karo'); });
  }
  function call(action, data) {   // staff mode me Suite token, employee mode me employee token
    return api(action, data, S.mode === 'staff').catch(function (e) { if (e.auth) { toast('Session expire ho gaya', true); signOut(true); } throw e; });
  }

  /* ---------- boot ---------- */
  function boot() {
    if (!CFG.API_URL) { $('#loginView').classList.remove('hidden'); $('#loginErr').textContent = 'EMP_URL config.js me set nahi hai'; return; }
    if (inSuite) document.body.classList.add('in-suite');
    var et = sessionStorage.getItem('emp_token'), eu = null;
    try { eu = JSON.parse(sessionStorage.getItem('emp_user') || 'null'); } catch (e) {}
    if (et && eu) { S.token = et; S.user = eu; S.mode = 'emp'; return enter(); }
    if (inSuite && sessionStorage.getItem('suite_token')) { S.mode = 'staff'; return enter(); }
    showLogin();
  }
  function showLogin() {
    $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden');
    $('#loginForm').classList.remove('hidden'); $('#setupForm').classList.add('hidden');
    $('#lgTitle').textContent = 'Sign in'; $('#lgSub').textContent = 'Apna Employee ID aur 4-digit PIN daalo.';
    setTimeout(function () { $('#emp').focus(); }, 50);
  }
  function signOut(silent) {
    ['emp_token', 'emp_user'].forEach(function (k) { sessionStorage.removeItem(k); });
    S.token = ''; S.user = null; S.dash = null; S.inbox = null; S.canInbox = false;
    if (S.mode === 'staff') { try { window.parent.postMessage({ source: 'litpax-suite', type: 'logout' }, location.origin); } catch (e) {} return; }
    showLogin();
  }

  /* ---------- login / PIN setup ---------- */
  $('#loginForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var emp = $('#emp').value.trim(), pin = $('#pin').value.trim(), err = $('#loginErr'), btn = $('#loginBtn');
    err.textContent = '';
    if (!emp) { err.textContent = 'Employee ID daalo'; return; }
    busy(btn, true, 'Signing in…');
    api('empLogin', { emp: emp, pin: pin }).then(function (d) {
      busy(btn, false);
      if (d.needSetup) { return startSetup(emp, d); }
      done(d);
    }).catch(function (e) {
      busy(btn, false);
      if (/need.?setup|first time|set your pin/i.test((e.code || '') + ' ' + e.message)) return startSetup(emp);   // PIN abhi set nahi → setup screen
      err.textContent = e.message;
    });
  });
  function startSetup(emp) {
    S._setupEmp = emp;
    $('#loginForm').classList.add('hidden'); $('#setupForm').classList.remove('hidden');
    $('#lgTitle').textContent = 'Set your PIN'; $('#lgSub').textContent = 'Employee ID ' + emp;
    $('#verify').focus();
  }
  $('#setupBack').addEventListener('click', showLogin);
  $('#setupForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = $('#verify').value.trim(), p1 = $('#pin1').value.trim(), p2 = $('#pin2').value.trim(), err = $('#setupErr'), btn = $('#setupBtn');
    err.textContent = '';
    if (!/^\d{4}$/.test(p1)) { err.textContent = 'PIN 4 digit ka hona chahiye'; return; }
    if (p1 !== p2) { err.textContent = 'Dono PIN match nahi kar rahe'; return; }
    if (!v) { err.textContent = 'One-time code ya mobile last 4 daalo'; return; }
    var data = { emp: S._setupEmp, pin: p1 };
    if (/^\d{6}$/.test(v)) data.code = v; else data.mobile4 = v;
    busy(btn, true, 'Saving…');
    api('setPin', data).then(function (d) { busy(btn, false); done(d); })
      .catch(function (e) { busy(btn, false); err.textContent = e.message; });
  });
  function done(d) {
    S.token = d.token; S.user = d.user; S.mode = 'emp';
    try { sessionStorage.setItem('emp_token', d.token); sessionStorage.setItem('emp_user', JSON.stringify(d.user)); } catch (e) {}
    ['pin', 'pin1', 'pin2', 'verify'].forEach(function (i) { $('#' + i).value = ''; });
    enter();
  }

  /* ---------- shell ---------- */
  function enter() {
    $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
    if (S.mode === 'staff') {
      $('#hello').textContent = 'Employee Requests'; $('#whoSub').textContent = 'Advance request inbox & employee access';
      S.canInbox = true; $('#outBtn').classList.add('hidden');
      return tabs(['inbox', 'team', 'access'], 'inbox');
    }
    var u = S.user || {};
    $('#hello').textContent = 'Hi, ' + (u.name || 'Employee');
    $('#whoSub').textContent = ['Emp ' + u.empId, u.designation, u.department].filter(Boolean).join(' · ');
    $('#outBtn').classList.remove('hidden');
    tabs(['home', 'tasks', 'request', 'mine'], 'home');
    api_probe();
  }
  function api_probe() {   // agar ye employee approver bhi hai to Inbox tab jodo
    call('listRequests', { status: 'Pending' }).then(function (d) {
      S.canInbox = true; S.inbox = d; tabs(['home', 'tasks', 'request', 'mine', 'inbox'], S.tab || 'home', true);
    }).catch(function () {});
  }
  var TAB_L = { home: 'Dashboard', request: 'Request Advance', mine: 'My Requests', inbox: 'Inbox', access: 'Employee Access', team: 'Team', tasks: 'Tasks' };
  function tabs(list, cur, keep) {
    S.tabList = list;
    $('#tabs').innerHTML = list.map(function (t) {
      var dot = t === 'inbox' && S.inbox && S.inbox.rows && S.inbox.rows.length ? '<span class="count">' + S.inbox.rows.length + '</span>' : '';
      return '<button class="tab" data-t="' + t + '" data-nav="' + t + '">' + TAB_L[t] + dot + '</button>';
    }).join('');
    if (!keep) go(cur); else mark();
  }
  function mark() { [].forEach.call(document.querySelectorAll('.tab'), function (b) { b.classList.toggle('on', b.dataset.t === S.tab); b.classList.toggle('active', b.dataset.t === S.tab); }); }
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) go(b.dataset.t); });
  $('#outBtn').addEventListener('click', function () { signOut(); });
  function go(t) {
    S.tab = t; mark();
    var m = $('#main'); m.onclick = function (e) { var b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); }; m.classList.toggle('wide', t === 'tasks'); m.innerHTML = SKEL;
    ({ home: viewHome, tasks: viewTasks, request: viewRequest, mine: viewMine, inbox: viewInbox, access: viewAccess, team: viewTeam })[t](m);
  }
  function fail(m, e) { m.innerHTML = '<div class="card empty">' + esc(e.message) + '</div>'; }

  /* ---------- dashboard ---------- */
  function loadDash() { return call('myDashboard').then(function (d) { S.dash = d; return d; }); }
  function section(title, body, act) { return '<div class="sec-h"><div class="sec-t">' + esc(title) + '</div>' + (act || '') + '</div>' + body; }
  function unavail(x) { return x && x.unavailable ? '<div class="card unavail">' + esc(x.message || 'Abhi available nahi') + '</div>' : ''; }
  function kpi(k, v, cls) { return '<div class="kpi ' + (cls || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>'; }

  function dashHtml(d, own) {
      var p = d.profile || {}, h = '';
      var nm = p.name || (S.user && S.user.name) || 'Employee', ini = nm.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
      var meta = ['Emp ' + (p.empId || (S.user && S.user.empId)), p.designation, p.department, p.manager ? 'Reports to ' + p.manager : '', p.phone].filter(Boolean).map(esc).join(' · ');
      h += '<div class="hero"><div class="av">' + esc(ini) + '</div><div class="hero-t"><div class="hn">' + esc(nm) + '</div><div class="hs">' + meta + '</div></div>' +
        (own ? '<button class="btn sm" data-go="request" type="button">Request advance</button>' : '') + '</div>';
      var op = own && (d.requests || []).filter(function (r) { return /^(Pending|Approved)/.test(r.status); })[0];
      if (op) h += '<button class="strip" data-go="mine" type="button"><b>' + money(op.amount) + '</b> advance request · ' + chipFor(op.status) + '<span class="go">Dekho →</span></button>';

      var t = d.tasks;
      if (t && !t.unavailable) {
        h += section('Company Tasks', '<div class="grid">' + kpi('Open', t.open || 0) + kpi('Overdue', t.overdue || 0, t.overdue ? 'bad' : '') +
          kpi('Due today', t.dueToday || 0, t.dueToday ? 'warn' : '') + kpi('Done this week', t.doneThisWeek || 0, 'ok') + '</div>', own ? '<button class="btn ghost sm" data-go="tasks" type="button">Open Tasks →</button>' : '');
        var tl = (t.list || []).map(function (x) {
          return '<tr' + (x.overdue ? ' class="od"' : '') + '><td>' + esc(pick(x, ['title', 'task', 'name'])) + '</td><td>' + esc(x.priority || '') + '</td><td>' + dt(pick(x, ['due', 'dueDate', 'deadline'])) + '</td><td>' + (x.overdue ? '<span class="chip bad">Overdue</span>' : chipFor(x.status)) + '</td></tr>';
        }).join('');
        var sc = (t.scores || []).map(function (x) {
          return '<tr><td>' + dt(x.week) + '</td><td>' + esc(x.done) + ' / ' + esc(x.planned) + ' done</td><td class="r">' + esc(x.weightedPct) + '%</td></tr>';
        }).join('');
        h += '<div class="two" style="margin-top:14px"><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Open tasks</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody>' +
          (tl || '<tr><td colspan="4" class="empty">Koi open task nahi</td></tr>') + '</tbody></table></div></div>' +
          '<div class="card"><table><thead><tr><th>Week</th><th>Tasks</th><th class="r">Score</th></tr></thead><tbody>' + (sc || '<tr><td colspan="3" class="empty">Abhi koi score nahi</td></tr>') + '</tbody></table></div></div>';
      } else h += section('Company Tasks', unavail(t) || '');

      var a = d.advance;
      if (a && !a.unavailable) {
        var tt = a.totals || {};
        h += section('Advance', '<div class="grid">' + kpi('Taken', money(tt.taken)) + kpi('Recovered', money(tt.recovered), 'ok') + kpi('Outstanding', money(tt.outstanding), tt.outstanding ? 'warn' : '') + '</div>');
        var ar = (a.advances || []).map(function (x) {
          return '<tr><td>' + dt(x.date) + '</td><td>' + chipFor(x.status) + '<div class="req-m">Recovered ' + money(x.recovered) + '</div></td><td class="r">' + money(x.amount) + '<div class="req-m">Due ' + money(x.outstanding) + '</div></td></tr>';
        }).join('');
        var rr = (a.recoveries || []).map(function (x) {
          return '<tr><td>' + dt(pick(x, ['date'])) + '</td><td>' + esc([x.mode, x.month, x.remarks].filter(Boolean).join(' · ')) + '</td><td class="r">' + money(pick(x, ['amount'])) + '</td></tr>';
        }).join('');
        h += '<div class="two" style="margin-top:14px"><div class="card"><table><thead><tr><th>Advances</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>' + (ar || '<tr><td colspan="3" class="empty">Koi advance nahi</td></tr>') + '</tbody></table></div>' +
          '<div class="card"><table><thead><tr><th>Recoveries</th><th>Details</th><th class="r">Amount</th></tr></thead><tbody>' + (rr || '<tr><td colspan="3" class="empty">Koi recovery nahi</td></tr>') + '</tbody></table></div></div>';
      } else h += section('Advance', unavail(a) || '');
      return h;
  }
  function viewHome(m) { loadDash().then(function (d) { m.innerHTML = dashHtml(d, true); }).catch(function (e) { fail(m, e); }); }

  /* ---------- Tasks (Company Tasks app, same login) ---------- */
  function viewTasks(m) {
    m.innerHTML = '<iframe class="tasks-frame" src="../tasks/index.html" title="Company Tasks"></iframe>';
  }
  window.addEventListener('message', function (e) {   // Tasks ke andar Sign out → My Space se bhi sign out
    if (e.origin !== location.origin || !e.data || e.data.source !== 'litpax-suite') return;
    if (e.data.type === 'logout' && S.mode === 'emp') signOut();
  });

  /* ---------- request advance ---------- */
  function viewRequest(m) {
    (S.dash ? Promise.resolve(S.dash) : loadDash()).then(function (d) {
      var el = d.eligibility || {}, max = Number(el.maxAdvance) || 0, mm = Number(el.maxMonths) || 6;
      var h = '<div class="form"><h2 style="margin-bottom:6px">Request an advance</h2>';
      if (!el.ok) { m.innerHTML = h + '<div class="note" style="margin-top:14px">' + esc(el.reason || 'Abhi request nahi kar sakte.') + '</div></div>'; return; }
      h += '<p class="hint" style="margin:0 0 18px">Max ' + money(max) + ' · max ' + mm + ' months me recovery' + (el.outstanding ? ' · abhi outstanding ' + money(el.outstanding) : '') + '</p>' +
        '<label class="lbl" for="rqAmt">Amount (₹)</label><input id="rqAmt" inputmode="numeric" placeholder="e.g. 5000" />' +
        '<div class="lbl">Recovery months</div><div class="seg" id="rqMonths">' + Array.apply(null, Array(mm)).map(function (_, i) { return '<button type="button" class="pill' + (i === 0 ? ' on' : '') + '" data-m="' + (i + 1) + '">' + (i + 1) + '</button>'; }).join('') + '</div>' +
        '<div class="hint" id="rqEmi" style="margin-top:8px"></div>' +
        '<label class="lbl" for="rqWhy">Reason</label><textarea id="rqWhy" placeholder="Kis kaam ke liye chahiye?"></textarea>' +
        '<div class="err" id="rqErr"></div><button class="btn" id="rqBtn" type="button">Submit request</button></div>';
      m.innerHTML = h;
      var months = 1;
      function emi() { var a = Number($('#rqAmt').value); $('#rqEmi').textContent = a > 0 ? 'Monthly recovery ≈ ' + money(Math.ceil(a / months)) : ''; }
      $('#rqAmt').addEventListener('input', emi);
      $('#rqMonths').addEventListener('click', function (e) {
        var b = e.target.closest('.pill'); if (!b) return; months = +b.dataset.m;
        [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); emi();
      });
      var ref = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);   // double-click se duplicate na bane
      $('#rqBtn').addEventListener('click', function () {
        var amt = Number($('#rqAmt').value), why = $('#rqWhy').value.trim(), err = $('#rqErr'); err.textContent = '';
        if (!(amt > 0)) { err.textContent = 'Amount daalo'; return; }
        if (max && amt > max) { err.textContent = 'Max limit ' + money(max) + ' hai'; return; }
        if (why.length < 5) { err.textContent = 'Reason likho'; return; }
        var b = this; busy(b, true, 'Submitting…');
        call('requestAdvance', { amount: amt, months: months, reason: why, clientRef: ref }).then(function () {
          busy(b, false); S.dash = null; toast('Request submit ho gayi'); go('mine');
        }).catch(function (e) { busy(b, false); err.textContent = e.message; });
      });
    }).catch(function (e) { fail(m, e); });
  }

  /* ---------- my requests ---------- */
  var FLOW = ['Pending HR', 'Pending Owner', 'Approved', 'Given'];
  function stepper(st) {
    var i = FLOW.indexOf(st), bad = /reject|cancel/i.test(st), rec = /recover/i.test(st);
    if (rec) i = FLOW.length;
    var h = FLOW.map(function (s, k) {
      var c = bad ? '' : (k < i ? 'done' : (k === i ? 'cur' : ''));
      return '<span class="step ' + c + '"><i></i>' + s.replace('Pending ', '') + (k < 2 ? ' review' : '') + '</span>';
    });
    if (bad) h.push('<span class="step bad"><i></i>' + esc(st) + '</span>');
    return '<div class="steps">' + h.join('') + '</div>';
  }
  function hist(r) {
    var l = [];
    if (r.createdAt) l.push([r.createdAt, 'Requested']);
    if (r.hrBy) l.push([r.hrAt, 'HR: ' + r.hrBy, r.hrNote]);
    if (r.ownerBy) l.push([r.ownerAt, 'Owner: ' + r.ownerBy, r.ownerNote]);
    if (r.givenAt) l.push([r.givenAt, 'Given' + (r.cashRef ? ' (' + r.cashRef + ')' : '')]);
    if (l.length < 2) return '';
    return '<div class="hist">' + l.map(function (x) { return '<div>' + dt(x[0]) + ' · ' + esc(x[1]) + (x[2] ? ' — ' + esc(x[2]) : '') + '</div>'; }).join('') + '</div>';
  }
  function reqCard(r, inbox) {
    var id = pick(r, ['id', 'requestId']), st = r.status, amt = pick(r, ['approvedAmount']) || r.amount;
    var h = '<div class="req"><div class="req-h"><div><div class="req-amt">' + money(r.amount) +
      (r.approvedAmount && Number(r.approvedAmount) !== Number(r.amount) ? ' <small style="font-size:13px;color:var(--ok)">→ ' + money(r.approvedAmount) + '</small>' : '') + '</div>' +
      '<div class="req-m">#' + esc(id) + ' · ' + dt(pick(r, ['createdAt', 'date'])) + ' · ' + esc(r.months || '') + ' months' +
      (inbox ? ' · <b>' + esc(pick(r, ['empName', 'name'])) + '</b> (Emp ' + esc(pick(r, ['empId', 'emp'])) + ')' : '') + '</div></div>' + chipFor(st) + '</div>' +
      '<div class="req-note">' + esc(r.reason || '') + '</div>';
    if (inbox && r.empOutstanding != null) h += '<div class="req-m">Abhi outstanding: ' + money(r.empOutstanding) + '</div>';
    if (!inbox) h += stepper(st);
    h += hist(r);
    h += '<div class="req-act">';
    if (!inbox && /^Pending/.test(st)) h += '<button class="btn ghost sm" data-a="cancel" data-id="' + esc(id) + '">Cancel request</button>';
    if (inbox && r.canAct) h += '<button class="btn ok sm" data-a="approve" data-id="' + esc(id) + '">Approve</button><button class="btn ghost sm" data-a="partial" data-id="' + esc(id) + '">Approve less…</button><button class="btn bad sm" data-a="reject" data-id="' + esc(id) + '">Reject</button>';
    if (inbox && st === 'Approved' && !(S.access && S.access.hr === false)) h += '<button class="btn sm" data-a="given" data-id="' + esc(id) + '">Mark given</button>';
    return h + '</div></div>';
  }
  function viewMine(m) {
    call('myRequests').then(function (d) {
      var l = d.rows || [];
      m.innerHTML = '<h2 style="margin-bottom:14px">My requests</h2>' + (l.length ? l.map(function (r) { return reqCard(r, false); }).join('') : '<div class="card empty">Abhi tak koi request nahi ki.</div>');
      m.onclick = function (e) {
        var b = e.target.closest('[data-a="cancel"]'); if (!b) return;
        ask('Cancel request?', 'Ye request cancel ho jayegi.', null, function (_, close) {
          call('cancelRequest', { id: b.dataset.id }).then(function () { close(); S.dash = null; toast('Cancelled'); viewMine(m); }).catch(function (e) { toast(e.message, true); });
        }, 'Cancel request');
      };
    }).catch(function (e) { fail(m, e); });
  }

  /* ---------- inbox (HR / Owner / Admin) ---------- */
  var INB = 'Pending';
  function viewInbox(m) {
    call('listRequests', INB === 'All' ? {} : { status: INB }).then(function (d) {
      S.inbox = d; S.access = d.access; var l = d.rows || [];
      m.innerHTML = '<div class="filters">' + ['Pending', 'Approved', 'Given', 'All'].map(function (f) { return '<button class="pill' + (f === INB ? ' on' : '') + '" data-f="' + f + '">' + f + '</button>'; }).join('') + '</div>' +
        (l.length ? l.map(function (r) { return reqCard(r, true); }).join('') : '<div class="card empty">Koi request nahi.</div>');
      m.onclick = function (e) {
        var f = e.target.closest('[data-f]'); if (f) { INB = f.dataset.f; return viewInbox(m); }
        var b = e.target.closest('[data-a]'); if (!b) return;
        var r = l.filter(function (x) { return String(pick(x, ['id', 'requestId'])) === b.dataset.id; })[0]; act(b.dataset.a, r, m);
      };
    }).catch(function (e) { fail(m, e); });
  }
  function act(a, r, m) {
    var id = pick(r, ['id', 'requestId']);
    function run(action, data) { return call(action, data).then(function () { toast('Done'); S.inbox = null; viewInbox(m); }); }
    function wrap(action, data) { return function (v, close) { run(action, Object.assign({ id: id }, data(v))).then(close).catch(function (e) { toast(e.message, true); }); }; }
    if (a === 'approve') return ask('Approve ' + money(r.amount) + '?', pick(r, ['empName', 'name']) + ' · ' + r.months + ' months', { note: 'Note (optional)' }, wrap('decideRequest', function (v) { return { decision: 'Approve', note: v.note }; }), 'Approve');
    if (a === 'partial') return ask('Approve less', 'Requested ' + money(r.amount), { amount: 'Approved amount (₹)', note: 'Note' }, wrap('decideRequest', function (v) { return { decision: 'Approve', amount: Number(v.amount), note: v.note }; }), 'Approve', function (v) { return Number(v.amount) > 0 && Number(v.amount) < Number(r.amount) ? '' : 'Amount request se kam aur 0 se zyada ho'; });
    if (a === 'reject') return ask('Reject request', 'Reason employee ko dikhega.', { note: 'Reason' }, wrap('decideRequest', function (v) { return { decision: 'Reject', note: v.note }; }), 'Reject', function (v) { return v.note ? '' : 'Reason likho'; });
    if (a === 'given') return ask('Mark as given', 'Cash Ledger me jo entry hai uska reference daalo.', { cashRef: 'Cash Ledger ref / ID' }, wrap('markGiven', function (v) { return { cashRef: v.cashRef }; }), 'Mark given', function (v) { return v.cashRef ? '' : 'Reference daalo'; });
  }

  /* ---------- Admin/HR: employee access ---------- */
  function viewAccess(m) {
    m.innerHTML = '<div class="form"><h2 style="margin-bottom:6px">Employee access</h2><p class="hint" style="margin:0 0 18px">Naye employee ke liye one-time code banao, ya bhule hue PIN ko reset karo.</p>' +
      '<label class="lbl" for="acEmp">Employee ID</label><input id="acEmp" inputmode="numeric" placeholder="e.g. 12" />' +
      '<div class="err" id="acErr"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="acCode" type="button">Issue one-time code</button><button class="btn ghost" id="acReset" type="button">Reset PIN</button></div></div>';
    function emp() { var v = $('#acEmp').value.trim(); $('#acErr').textContent = v ? '' : 'Employee ID daalo'; return v; }
    $('#acCode').onclick = function () {
      var e = emp(); if (!e) return; var b = this; busy(b, true);
      call('issueCode', { emp: e }).then(function (d) {
        busy(b, false);
        ask('Code for Emp ' + e, '7 din valid, sirf ek baar chalega. Employee ko My Space me PIN set karte waqt dena hai.', null, null, 'Done', null, '<div class="code-big">' + esc(d.code) + '</div>');
      }).catch(function (x) { busy(b, false); $('#acErr').textContent = x.message; });
    };
    $('#acReset').onclick = function () {
      var e = emp(); if (!e) return;
      ask('Reset PIN?', 'Emp ' + e + ' ka PIN hat jayega; use naya code se set karna hoga.', null, function (_, close) {
        call('resetPin', { emp: e }).then(function () { close(); toast('PIN reset ho gaya'); }).catch(function (x) { toast(x.message, true); });
      }, 'Reset PIN');
    };
  }


  /* ---------- Team (Admin/HR/Owner): har employee ki performance ---------- */
  var T = { rows: [], q: '', sort: 'overdue', dir: -1 };
  var TCOLS = [['name', 'Employee'], ['department', 'Dept'], ['open', 'Open'], ['overdue', 'Overdue'], ['doneThisWeek', 'Done (wk)'], ['lastScore', 'Last score'], ['outstanding', 'Advance due']];
  function viewTeam(m) {
    call('listEmployees').then(function (d) { T.rows = d.employees || []; drawTeam(m); }).catch(function (e) { fail(m, e); });
  }
  function drawTeam(m) {
    var q = T.q.toLowerCase(), k = T.sort;
    var rows = T.rows.filter(function (r) { return !q || (String(r.name) + ' ' + r.empId + ' ' + (r.department || '')).toLowerCase().indexOf(q) !== -1; });
    rows.sort(function (a, b) {
      var x = a[k], y = b[k]; if (x == null || x === '') x = -1e9; if (y == null || y === '') y = -1e9;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * T.dir;
    });
    var th = TCOLS.map(function (c) { return '<th class="srt' + (c[0] === k ? ' on' : '') + (c[0] !== 'name' && c[0] !== 'department' ? ' r' : '') + '" data-s="' + c[0] + '">' + c[1] + (c[0] === k ? (T.dir < 0 ? ' ↓' : ' ↑') : '') + '</th>'; }).join('');
    var tr = rows.map(function (r) {
      return '<tr class="clk" data-emp="' + esc(r.empId) + '"><td><b>' + esc(r.name) + '</b><div class="req-m">Emp ' + esc(r.empId) + (r.designation ? ' · ' + esc(r.designation) : '') + (r.hasPin === false ? ' · PIN set nahi' : '') + (r.active === false ? ' · inactive' : '') + '</div></td><td>' + esc(r.department || '—') + '</td>' +
        '<td class="r">' + (r.open == null ? '—' : r.open) + '</td><td class="r">' + (r.overdue ? '<span class="chip bad">' + r.overdue + '</span>' : (r.overdue == null ? '—' : 0)) + '</td>' +
        '<td class="r">' + (r.doneThisWeek == null ? '—' : r.doneThisWeek) + '</td><td class="r">' + (r.lastScore == null || r.lastScore === '' ? '—' : esc(r.lastScore) + '%') + '</td>' +
        '<td class="r">' + (r.outstanding ? '<span class="chip warn">' + money(r.outstanding) + '</span>' : (r.outstanding == null ? '—' : '₹0')) + '</td></tr>';
    }).join('');
    var tot = T.rows.reduce(function (a, r) { a.o += Number(r.overdue) || 0; a.a += Number(r.outstanding) || 0; return a; }, { o: 0, a: 0 });
    m.innerHTML = '<div class="grid" style="margin-bottom:16px">' + kpi('Employees', T.rows.length) + kpi('Overdue tasks', tot.o, tot.o ? 'bad' : '') + kpi('Advance outstanding', money(tot.a), tot.a ? 'warn' : '') + '</div>' +
      '<input id="tmQ" placeholder="Search name / Emp ID / department" value="' + esc(T.q) + '" /><div class="card"><div class="tbl-wrap"><table><thead><tr>' + th + '</tr></thead><tbody>' +
      (tr || '<tr><td colspan="7" class="empty">Koi employee nahi mila</td></tr>') + '</tbody></table></div></div>';
    var qi = $('#tmQ'); qi.addEventListener('input', function () { T.q = qi.value; var p = qi.selectionStart; drawTeam(m); var n = $('#tmQ'); n.focus(); n.setSelectionRange(p, p); });
    m.onclick = function (e) {
      var h = e.target.closest('th[data-s]');
      if (h) { if (T.sort === h.dataset.s) T.dir = -T.dir; else { T.sort = h.dataset.s; T.dir = (T.sort === 'name' || T.sort === 'department') ? 1 : -1; } return drawTeam(m); }
      var r = e.target.closest('tr[data-emp]'); if (r) viewEmpDash(m, r.dataset.emp);
    };
  }
  function viewEmpDash(m, emp) {
    m.onclick = null; m.innerHTML = SKEL;
    call('empDashboard', { emp: emp }).then(function (d) {
      m.innerHTML = '<button class="btn ghost sm" id="tmBack" type="button" style="margin-bottom:14px">← Team</button>' + dashHtml(d);
      $('#tmBack').onclick = function () { viewTeam(m); };
    }).catch(function (e) { fail(m, e); });
  }

  /* ---------- modal ---------- */
  function ask(title, sub, fields, onOk, okLabel, validate, extraHtml) {
    var root = $('#modalRoot'), h = '<div class="modal-bg"><div class="modal"><h3>' + esc(title) + '</h3><p class="hint" style="margin:0 0 14px">' + esc(sub || '') + '</p>' + (extraHtml || '');
    Object.keys(fields || {}).forEach(function (k) { h += '<label class="lbl">' + esc(fields[k]) + '</label><input data-k="' + k + '" />'; });
    h += '<div class="err" id="mErr"></div><div class="row">' + (onOk ? '<button class="btn ghost sm" id="mNo" type="button">Back</button>' : '') + '<button class="btn sm" id="mOk" type="button">' + esc(okLabel || 'OK') + '</button></div></div></div>';
    root.innerHTML = h;
    function close() { root.innerHTML = ''; }
    var first = root.querySelector('input'); if (first) first.focus();
    if ($('#mNo')) $('#mNo').onclick = close;
    $('#mOk').onclick = function () {
      if (!onOk) return close();
      var v = {}; [].forEach.call(root.querySelectorAll('input[data-k]'), function (i) { v[i.dataset.k] = i.value.trim(); });
      var msg = validate ? validate(v) : ''; if (msg) { $('#mErr').textContent = msg; return; }
      onOk(v, close);
    };
    root.querySelector('.modal-bg').addEventListener('mousedown', function (e) { if (e.target === this) close(); });
  }

  boot();
})();
