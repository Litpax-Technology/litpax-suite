/* Scan Station - the only page employees see.
   No dashboard, no setup, no reports. Just scanning. */

state = {
  hall: '',                          // set from ?hall= in the URL; '' = show all
  staff: [], stations: [], stationRows: [], packs: {},
  stationEmp: {}, manualStation: '',   // per-station employee; manual station for prefix-less scans
  lastScan: null, recentScans: [],
  sessionCount: {},                    // "station||empId" -> scans this session (no cap)
  loading: true, connected: true, pending: 0, statusMsg: '',
  mode: 'scan',                         // 'scan' = production line, 'dispatch' = dispatch station
  dsp: { token: '', transport: '', lr: '', vehicle: '', driver: '', list: [], busy: false, checking: 0, last: null }
};
try { state.dsp.token = sessionStorage.getItem('plt_sup') || sessionStorage.getItem('suite_token') || ''; } catch (e) {}
try {
  var _q = new URLSearchParams(window.location.search);
  // ?mode=packing → sirf Battery Packing station (alag laptop). ?station= se koi bhi station.
  state.onlyStation = _q.get('mode') === 'packing' ? 'Battery Packing' : (_q.get('station') || '').trim();
  state.lockMode = !!_q.get('mode') || !!_q.get('hall') || !!state.onlyStation;
} catch (e) {}

(function () {
  try {
    var u = new URLSearchParams(window.location.search);
    state.hall = (u.get('hall') || '').trim();
  } catch (e) {}
})();

/** Keep only items in the active hall. Empty hall on an item = shown everywhere. */
function inHall(itemHall) {
  if (!state.hall) return true;
  if (!itemHall) return true;
  return itemHall.toLowerCase() === state.hall.toLowerCase();
}

/* ---------------- Load ---------------- */

function loadAll() {
  // First pass fetches settings; a second pass pulls logs only if the
  // Settings sheet has out-of-sequence checking switched on.
  return call('init', { limit: 0, counts: 1 }).then(function (res) {
    applySettings(res.settings);
    state.sessionCount = res.todayCounts || {};
    var rows = res.stationRows || [];
    state.stationRows = rows.filter(function (r) { return inHall(r.hall); });
    state.stations = state.stationRows.map(function (r) { return r.name; });
    state.staff = (res.staff || []).filter(function (s) { return inHall(s.hall); });
    state.plan = res.plan || [];
    state.loading = false;
    render();
    startPolling();
    if (CONFIG.ENFORCE_SEQUENCE) {
      return call('init', { limit: CONFIG.LOG_LIMIT }).then(function (r2) {
        state.packs = buildPacks(r2.logs || []);
      }, function () {});
    }
  }, function (err) {
    state.loading = false;
    state.statusMsg = err.message;
    render();
  });
}

function startPolling() {
  if (!CONFIG.POLL_MS) return;
  setInterval(refreshLists, Math.max(CONFIG.POLL_MS, 30000));
}

/** Refreshes staff/stations only, so a newly added employee can sign in. */
function refreshLists() {
  if (state.pending > 0) return;
  call('init', { limit: 0, counts: 1 }).then(function (res) {
    applySettings(res.settings);
    state.sessionCount = res.todayCounts || {};
    var rows = res.stationRows || [];
    state.stationRows = rows.filter(function (r) { return inHall(r.hall); });
    state.stations = state.stationRows.map(function (r) { return r.name; });
    state.staff = (res.staff || []).filter(function (s) { return inHall(s.hall); });
    state.plan = res.plan || [];
    render();
  }, function () { /* the dot already shows the state */ });
}

/* ---------------- Scanning ---------------- */

function flash(cls) {
  var box = document.getElementById('scanBox');
  if (!box) return;
  box.classList.add(cls);
  setTimeout(function () { box.classList.remove(cls); }, 400);
}

/*
 * PREFIX MODEL. Every scanner carries a fixed station prefix, e.g. "IR:".
 * So each scan is self-contained - the station comes with the scan, nothing
 * is remembered globally. Because of that, two people scanning on the same
 * PC can never corrupt each other's battery.
 *
 * Per station we remember ONLY the current employee (set by a badge scan at
 * that station). Employees are held per-station, so IR's operator and Spot's
 * operator never mix.
 *
 * Scan shapes (prefix is whatever each scanner is set to send):
 *   IR:STAFF:96      badge sign-in at IR      (or IR:96 if it matches a badge)
 *   IR:LP0011        battery at IR
 * Without a prefix the app falls back to a single "manual" station chosen
 * from the dropdown - handy when testing with one scanner.
 */

// current employee per station: { "IR": {id,name}, "Spot": {...} }
state.stationEmp = state.stationEmp || {};
// manual station when a scan has no prefix (single-scanner testing)
state.manualStation = state.manualStation || '';

function beep(ok) {
  try {
    var ctx = beep._c || (beep._c = new (window.AudioContext || window.webkitAudioContext)());
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.08;
    o.start();
    setTimeout(function () { o.stop(); }, ok ? 90 : 220);
  } catch (e) {}
}

function matchStaff(idRaw) {
  var id = String(idRaw).trim().toLowerCase();
  var m = null;
  state.staff.forEach(function (s) { if (s.id.toLowerCase() === id) m = s; });
  return m;
}

function matchStation(raw) {
  var key = String(raw).trim().toLowerCase();
  var m = null;
  // Pehle CODE se match (scanner prefix), station ka NAME return karo.
  state.stationRows.forEach(function (r) {
    if (r.code && r.code.toLowerCase() === key) m = r.name;
  });
  // Transition ke liye: purana naam-prefix bhi chale.
  if (!m) state.stationRows.forEach(function (r) {
    if (r.name.toLowerCase() === key) m = r.name;
  });
  return m;
}

/**
 * Splits a raw scan into { station, rest }.
 * The station comes from the scanner's prefix ("IR:LP0011" -> station IR).
 * Any separator char is tolerated (:, >, ? ...) because of keyboard layout.
 * If the first segment is not a known station, there is no prefix: station
 * falls back to the manual dropdown selection.
 */
function splitScan(raw) {
  var code = String(raw || '').trim();
  // Normalise STAFF/STATION keyword separators too.
  code = code.replace(/^(STAFF|STATION)[^A-Za-z0-9]+/i, function (m, kw) { return kw.toUpperCase() + ':'; });

  // Does it start with "<something><sep>..."? Try to read a station prefix.
  var m = code.match(/^([A-Za-z0-9 ]+?)[^A-Za-z0-9]+(.+)$/);
  if (m) {
    var st = matchStation(m[1]);
    if (st) return { station: st, rest: m[2].trim() };
  }
  // No usable prefix - use the manual station (if any).
  return { station: state.manualStation, rest: code };
}

function handleUniversalScan(raw) {
  var parts = splitScan(raw);
  var station = parts.station;
  var rest = parts.rest;

  if (!station) {
    flash('flash-error'); beep(false);
    alert('No station on this scan.\n\nEither the scanner has no station prefix set, ' +
          'or pick a station below for testing.');
    return;
  }

  // A badge sign-in? Either "STAFF:96" or a bare id that matches a badge.
  var badgeId = rest;
  if (/^STAFF:/i.test(rest)) badgeId = rest.replace(/^STAFF:/i, '').trim();
  var emp = matchStaff(badgeId);
  if (emp) {
    state.stationEmp[station] = emp;
    flash('flash-context'); beep(true); render();
    return;
  }

  // Otherwise it is a battery scan for this station.
  var operator = state.stationEmp[station];
  if (!operator) {
    flash('flash-error'); beep(false);
    alert('No employee signed in at ' + station + '.\n\n' +
          'Scan an employee badge on this scanner first.');
    return;
  }

  commitScan(rest, station, operator);
}

function sequenceWarning(packId, station) {
  if (!CONFIG.ENFORCE_SEQUENCE) return false;
  var idx = state.stations.indexOf(station);
  if (idx < 0) return false;
  var pack = state.packs[packId];
  var lastIdx = -1;
  if (pack) {
    pack.history.forEach(function (h) {
      var i = state.stations.indexOf(h.station);
      if (i > lastIdx) lastIdx = i;
    });
  }
  if (idx === lastIdx + 1) return false;
  var expected = state.stations[lastIdx + 1] || 'end of line';
  return 'Out of sequence.\n\nBattery: ' + packId + '\nExpected next: ' + expected +
         '\nScanned at: ' + station + '\n\nLog it anyway?';
}

function commitScan(code, station, emp) {
  // Duplicate guard: same battery, same station, already logged this session.
  if (state.packs[code]) {
    var dup = state.packs[code].history.some(function (h) { return h.station === station; });
    if (dup && !confirm('Battery ' + code + ' was already scanned at ' + station +
                        '.\n\nLog it again?')) {
      flash('flash-error'); beep(false); render();
      return;
    }
  }

  var warn = sequenceWarning(code, station);
  if (warn && !confirm(warn)) { flash('flash-error'); beep(false); render(); return; }

  // Log locally first so the operator is never blocked by network latency.
  var ts = Date.now();
  if (!state.packs[code]) state.packs[code] = { id: code, currentStage: station, status: 'pending', history: [] };
  var entry = {
    station: station, operatorId: emp.id, operatorName: emp.name,
    timestamp: ts, result: 'pending', synced: false, failed: false
  };
  state.packs[code].history.push(entry);
  state.packs[code].currentStage = station;

  state.lastScan = { packId: code, entry: entry };
  state.recentScans.unshift({ packId: code, station: station, operator: emp.name, time: ts, entry: entry });
  state.recentScans = state.recentScans.slice(0, 30);

  var ck = station + '||' + emp.id.toLowerCase();
  state.sessionCount[ck] = (state.sessionCount[ck] || 0) + 1;

  flash('flash'); beep(true); render();

  call('scan', {
    packId: code, station: entry.station,
    operatorId: entry.operatorId, operatorName: entry.operatorName,
    hall: state.hall
  }).then(function () {
    entry.synced = true; render();
    kickAutomation();
  }, function (err) {
    entry.failed = true; render();
    alert('Not saved: ' + err.message + '\n\nBattery: ' + code +
          '\nUse Retry held scans once the connection is back.');
  });
}

/* Scan save hone ke baad ERP / IMS update turant chalao (background, worker ko wait nahi).
   Lagatar scans → 4s ruk ke ek hi baar; 20s me max ek kick. Timer (1 min) backup hai. */
var _kickTimer = null, _kickLast = 0;
function kickAutomation() {
  clearTimeout(_kickTimer);
  _kickTimer = setTimeout(function () {
    if (Date.now() - _kickLast < 20000) { _kickTimer = setTimeout(kickAutomation, 20000); return; }
    _kickLast = Date.now();
    jsonp({ action: 'kick' }).then(function () {}, function () {});   // jawab ka wait / error dono ignore
  }, 4000);
}

function failedList() {
  var out = [];
  Object.keys(state.packs).forEach(function (pid) {
    state.packs[pid].history.forEach(function (h) { if (h.failed && !h.synced) out.push({ packId: pid, entry: h }); });
  });
  return out;
}

function retryFailed() {
  var jobs = failedList();
  if (!jobs.length) { alert('Nothing to retry.'); return; }
  var chain = Promise.resolve();
  jobs.forEach(function (j) {
    chain = chain.then(function () {
      return call('scan', {
        packId: j.packId, station: j.entry.station,
        operatorId: j.entry.operatorId, operatorName: j.entry.operatorName,
        hall: state.hall
      }).then(function () { j.entry.synced = true; j.entry.failed = false; }, function () {});
    });
  });
  chain.then(function () {
    render();
    kickAutomation();
    var left = failedList().length;
    alert(left ? (left + ' scan(s) still failing.') : 'All held scans saved.');
  });
}

/* ---------------- Manual controls (single-scanner testing) ---------------- */

// Pick the station a prefix-less scan belongs to.
function setManualStation(v) { state.manualStation = v; render(); }

// Manually sign an employee into the manual station (badge missing).
function manualOperator(v) {
  if (!v) return;
  var st = state.manualStation;
  if (!st) { alert('Pick a station first.'); return; }
  var emp = matchStaff(v);
  if (emp) { state.stationEmp[st] = emp; render(); }
}

/* ---------------- Dispatch station ---------------- */

function setMode(m) { state.mode = m; render(); }

function dspLogin() {
  var el = document.getElementById('dspPin');
  var pin = el ? el.value.trim() : '';
  if (!pin) { alert('Supervisor PIN daalo'); return; }
  call('supLogin', { pin: pin }).then(function (res) {
    state.dsp.token = res.token;
    try { sessionStorage.setItem('plt_sup', res.token); } catch (e) {}
    render();
  }, function (err) { alert(err.message); });
}

function dspField(k, v) { state.dsp[k] = v; }

function dspScan(raw) {
  var serial = splitScan(raw).rest;
  serial = String(serial || '').trim();
  if (!serial) return;
  var d = state.dsp;
  // Employee badge? (STAFF:45 ya sirf 45)
  var badge = /^STAFF:/i.test(serial) ? serial.replace(/^STAFF:/i, '').trim() : serial;
  var emp = matchStaff(badge);
  if (emp) { d.emp = emp; d.last = { ok: 'Employee: ' + emp.name + ' (' + emp.id + ')' }; flash('flash-context'); beep(true); render(); return; }
  if (!d.emp) { flash('flash-error'); beep(false); alert('Pehle apna employee badge scan karo.'); return; }
  if (!d.transport.trim() || !d.lr.trim()) {
    flash('flash-error'); beep(false);
    alert('Pehle Transport aur LR / Bilty No bharo, phir battery scan karo.');
    return;
  }
  if (d.list.some(function (x) { return x.serial.toUpperCase() === serial.toUpperCase(); })) {
    flash('flash-error'); beep(false); d.last = { err: serial + ' pehle hi scan ho chuki' }; render(); return;
  }
  d.checking++; render();
  call('dispatchCheck', { token: d.token, serial: serial }).then(function (r) {
    d.checking--;
    d.list.push(r); d.last = { ok: r.serial + ' · ' + r.customer + ' · ' + r.itemId };
    flash('flash'); beep(true); render();
  }, function (err) {
    d.checking--;
    if (/login|session/i.test(err.message)) { d.token = ''; try { sessionStorage.removeItem('plt_sup'); } catch (e) {} }
    d.last = { err: err.message };
    flash('flash-error'); beep(false); render();
  });
}

function dspRemove(i) { state.dsp.list.splice(i, 1); render(); }

function dspSubmit() {
  var d = state.dsp;
  if (!d.list.length) { alert('Koi battery scan nahi hui'); return; }
  if (!d.transport.trim() || !d.lr.trim()) { alert('Transport aur LR / Bilty No zaroori hai'); return; }
  var groups = {};
  d.list.forEach(function (x) { (groups[x.itemId] = groups[x.itemId] || []).push(x); });
  var over = Object.keys(groups).filter(function (k) { var g = groups[k]; return g[0].qty && g[0].dispatched + g.length > g[0].qty; });
  var msg = d.list.length + ' battery dispatch karein?\n\n' + Object.keys(groups).map(function (k) {
    var g = groups[k]; return g[0].customer + ' · ' + k + ' · ' + g.length;
  }).join('\n') + (over.length ? '\n\n⚠ Order qty se zyada: ' + over.join(', ') : '');
  if (!confirm(msg)) return;
  d.busy = true; render();
  call('dispatchBatch', { token: d.token, serials: d.list.map(function (x) { return x.serial; }).join(','),
    transport: d.transport, lr: d.lr, vehicle: d.vehicle, driver: d.driver,
    empId: d.emp ? d.emp.id : '', empName: d.emp ? d.emp.name : '' }).then(function (r) {
    d.busy = false;
    var bad = (r.results || []).filter(function (x) { return !x.ok; });
    var good = (r.results || []).filter(function (x) { return x.ok; });
    var okSet = {}; good.forEach(function (g) { okSet[g.itemId] = true; });
    d.list = d.list.filter(function (x) { return !okSet[x.itemId]; });
    if (!bad.length) { d.lr = ''; d.vehicle = ''; d.driver = ''; }
    alert((good.length ? good.map(function (g) { return '✓ ' + g.itemId + ': ' + g.count + ' dispatched (' + g.erp + ')'; }).join('\n') : '') +
          (bad.length ? '\n\n✗ ' + bad.map(function (b) { return b.itemId + ': ' + b.error; }).join('\n✗ ') : ''));
    render();
  }, function (err) { d.busy = false; alert('Dispatch nahi hua: ' + err.message); render(); });
}

function renderDispatch() {
  var d = state.dsp;
  // PIN band — dispatch page seedha khulta hai
  var inp = function (k, label, req) {
    return '<div class="field"><label>' + label + (req ? ' *' : '') + '</label><input value="' + esc(d[k]) + '" oninput="dspField(\'' + k + '\', this.value)"></div>';
  };
  var groups = {}, order = [];
  d.list.forEach(function (x, i) { if (!groups[x.itemId]) { groups[x.itemId] = []; order.push(x.itemId); } groups[x.itemId].push({ x: x, i: i }); });
  var grpHtml = order.map(function (k) {
    var g = groups[k], f = g[0].x;
    return '<div class="panel" style="margin-bottom:12px;"><div class="panel-title">' + esc(f.customer) + ' · ' + esc(f.model) +
      ' · Order ' + esc(f.orderId) + ' · Item ' + esc(k) + ' · ' + g.length + ' scanned (pehle ' + f.dispatched + ' / ' + f.qty + ')</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + g.map(function (o) {
        return '<span class="mono" style="background:var(--accent-soft);padding:4px 8px;border-radius:6px;font-size:12.5px;">' + esc(o.x.serial) +
          ' <a href="javascript:void 0" onclick="dspRemove(' + o.i + ')" style="text-decoration:none;color:var(--text-muted);">×</a></span>';
      }).join('') + '</div></div>';
  }).join('');
  var last = d.last ? (d.last.err
      ? '<div style="margin-top:10px;color:var(--bad);font-weight:600;">✗ ' + esc(d.last.err) + '</div>'
      : '<div style="margin-top:10px;color:var(--ok);font-weight:600;">✓ ' + esc(d.last.ok) + '</div>') : '';
  return '<div class="panel"><div class="panel-title">Dispatch details · ' +
      (d.emp ? 'Employee: ' + esc(d.emp.name) + ' (' + esc(d.emp.id) + ')' : '<span style="color:var(--bad);">⚠ Pehle employee badge scan karo</span>') + '</div>' +
      '<div class="row">' + inp('transport', 'Transport', true) + inp('lr', 'LR / Bilty No', true) + inp('vehicle', 'Vehicle No') + inp('driver', 'Driver No') + '</div></div>' +
    '<div class="panel scan-panel"><div class="scan-box" id="scanBox">' +
      '<input id="dispatchScan" type="text" placeholder="Dispatch: battery scan karo" autocomplete="off" ' +
      'onkeydown="if(event.key===\'Enter\'){dspScan(this.value); this.value=\'\';}">' +
      '<div class="scan-hint">Har battery scan karo. Sab scan ho jaaye to neeche Dispatch dabao — ERP aur IMS dono update honge.</div>' +
      '<div class="scan-readout">' + d.list.length + ' scanned' + (d.checking ? ' · checking...' : '') + '</div>' +
    '</div>' + last + '</div>' +
    (order.length ? grpHtml : '<div class="panel"><div class="empty">Abhi koi battery scan nahi hui.</div></div>') +
    '<div style="margin:6px 0 30px;"><button class="btn" onclick="dspSubmit()"' + (d.busy || !d.list.length ? ' disabled' : '') + '>' +
      (d.busy ? 'Dispatching...' : 'Dispatch ' + d.list.length + ' batteries') + '</button></div>';
}

function renderModeTabs() {
  return '';   // Dispatch ab ERP ke Dispatch popup me hota hai
  return '<div class="tabs">' +
    '<button class="tab' + (state.mode === 'scan' ? ' active' : '') + '" onclick="setMode(\'scan\')">Production scan</button>' +
    '<button class="tab' + (state.mode === 'dispatch' ? ' active' : '') + '" onclick="setMode(\'dispatch\')">Dispatch</button></div>';
}

/* ---------------- Render ---------------- */

function renderContextBar() {
  document.getElementById('contextBar').innerHTML =
    '<div class="context-pill floor">' + esc(state.mode === 'dispatch' ? 'DISPATCH' : (state.hall || CONFIG.FLOOR || 'ALL HALLS')) + '</div>';
}

function renderScan() {
  if (!state.staff.length || !state.stations.length) {
    return '<div class="panel"><div class="empty"><div class="big">Nothing set up yet</div>' +
           'Add employees and stations on the admin page, then set each scanner\'s prefix.</div></div>';
  }

  var hint = 'Scan a battery. The scanner prefix sets the station; the badge scanned there is the employee.';

  var lastScanHtml = '';
  if (state.lastScan) {
    var e = state.lastScan.entry;
    var sync = e.failed ? '<span class="sync error">NOT SAVED</span>'
             : e.synced ? '<span class="sync saved">saved</span>'
             : '<span class="sync saving">saving...</span>';
    lastScanHtml =
      '<div class="last-scan">' +
        '<div><div class="id">' + esc(state.lastScan.packId) + '</div>' +
        '<div class="meta">' + esc(e.station) + ' &middot; ' + esc(e.operatorName) + ' &middot; ' + fmtTime(e.timestamp) + ' &middot; ' + sync + '</div></div>' +
      '</div>';
  }

  var rows = state.recentScans.map(function (r) {
    var mark = r.entry.failed ? '<span class="sync error">!</span>'
             : r.entry.synced ? '' : '<span class="sync saving">...</span>';
    return '<tr><td class="mono">' + esc(r.packId) + ' ' + mark + '</td><td>' + esc(r.station) +
           '</td><td>' + esc(r.operator) + '</td><td class="mono">' + fmtTime(r.time) + '</td></tr>';
  }).join('');

  var failed = failedList().length;
  var retryBar = failed
    ? '<div style="margin-top:12px;"><button class="btn secondary" onclick="retryFailed()">Retry ' + failed + ' held scan(s)</button></div>'
    : '';

  // Live board: one card per station in this hall, showing who is signed in
  // and how many batteries they have scanned this session.
  var sessionCount = state.sessionCount;
  var maxCount = 0;
  state.stations.forEach(function (st) {
    var e = state.stationEmp[st];
    if (!e) return;
    var c = sessionCount[st + '||' + e.id.toLowerCase()] || 0;
    if (c > maxCount) maxCount = c;
  });

  var boardCards = state.stations.map(function (st) {
    var emp = state.stationEmp[st];
    var count = emp ? (sessionCount[st + '||' + emp.id.toLowerCase()] || 0) : 0;
    if (emp) {
      var initials = emp.name.trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      var pct = maxCount ? Math.round(count / maxCount * 100) : 0;
      var lead = (count > 0 && count === maxCount) ? '<span class="board-lead">TOP</span>' : '';
      return '<div class="board-card active">' +
        '<div class="board-station">' + esc(st) + lead + '</div>' +
        '<div class="board-who"><span class="board-avatar">' + esc(initials) + '</span>' +
        '<span class="board-emp">' + esc(emp.name) + '</span></div>' +
        '<div class="board-count">' + count + '<span class="board-count-lbl"> done</span></div>' +
        '<div class="board-bar"><div class="board-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }
    return '<div class="board-card">' +
      '<div class="board-station">' + esc(st) + '</div>' +
      '<div class="board-emp empty">open</div>' +
    '</div>';
  }).join('');
  var board = '<div class="panel"><div class="panel-title">Who is on each station &middot; live</div>' +
    '<div class="board-grid">' + boardCards + '</div></div>';

  // Today's production plan (from the ERP slip). Same on every hall.
  var plan = state.plan || [];
  var planTotal = plan.reduce(function (a, r) { return a + (r.planned || 0); }, 0);
  var planRows = plan.map(function (r) {
    return '<tr><td>' + esc(r.model || r.type || '-') + '</td>' +
           '<td class="mono">' + esc(r.order) + '</td>' +
           '<td class="mono">' + r.planned + '</td></tr>';
  }).join('');
  var planPanel = '<div class="panel"><div class="panel-title">Today\'s production plan &middot; ' + planTotal + ' planned</div>' +
    (plan.length
      ? '<div class="table-wrap"><table><thead><tr><th>Model</th><th>Order</th><th>Planned</th></tr></thead><tbody>' + planRows + '</tbody></table></div>'
      : '<div class="empty">No plan for today yet.</div>') +
    '</div>';

  return '<div class="panel scan-panel">' +
      '<div class="scan-box" id="scanBox">' +
        '<input id="universalScan" type="text" placeholder="Scan badge or battery" autocomplete="off" ' +
        'onkeydown="if(event.key===\'Enter\'){handleUniversalScan(this.value); this.value=\'\';}">' +
        '<div class="scan-hint">' + esc(hint) + '</div>' +
        '<div class="scan-readout">' + (state.lastScan ? 'Last battery: ' + esc(state.lastScan.packId) : 'No scans yet') + '</div>' +
      '</div>' +
      lastScanHtml + retryBar +
    '</div>' +
    planPanel +
    board +
    '<div class="panel"><div class="panel-title">Scanned this session</div>' +
      (state.recentScans.length
        ? '<div class="table-wrap"><table><thead><tr><th>Battery</th><th>Station</th><th>Employee</th><th>Time</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty">No scans yet.</div>') +
    '</div>';
}

function render() {
  renderContextBar();
  updateConn();
  var content = document.getElementById('content');

  if (state.loading) { content.innerHTML = '<div class="empty">Loading...</div>'; return; }
  if (state.statusMsg && !state.stations.length) {
    content.innerHTML = '<div class="panel"><div class="empty"><div class="big">Could not reach the Sheet</div>' +
                        esc(state.statusMsg) + '</div></div>';
    state.statusMsg = '';
    return;
  }

  if (state.mode === 'dispatch') {
    content.innerHTML = renderModeTabs() + renderDispatch();
    var di = document.getElementById('dispatchScan') || document.getElementById('dspPin');
    if (di) di.focus();
    return;
  }
  content.innerHTML = renderModeTabs() + renderScan();
  var input = document.getElementById('universalScan');
  if (input) input.focus();
}

/* ---------------- Boot ---------------- */

render();
loadAll();

// A scanner types wherever the focus is, so keep the scan box focused.
document.addEventListener('click', function () {
  setTimeout(function () {
    var el = document.getElementById(state.mode === 'dispatch' ? 'dispatchScan' : 'universalScan');
    var a = document.activeElement;
    if (el && a && a.tagName !== 'SELECT' && a.tagName !== 'INPUT') el.focus();
  }, 50);
});

// Warn before closing if anything is still unsaved.
window.addEventListener('beforeunload', function (e) {
  if (failedList().length || state.pending > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});
