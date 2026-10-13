/* =============================================================
 * Litpax Suite — shell + native screens
 * Login → sessions set → sidebar → module (iframe) ya native screen
 * ============================================================= */
(function () {
  'use strict';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var S = { token: '', user: null, sessions: {}, hidePages: [], view: '', frames: {}, pending: 0 };
  var SESSION_KEYS = ['erp_user', 'lpx_role', 'lpx_name', 'sms_session', 'plt_sup', 'suite_bridge'];

  /* ---------------- API (4 alag GAS) ----------------
   * ERP / IMS: POST JSON  ·  PLT: GET (JSONP text)  — URLs root config.js (SUITE) se */
  function api(app, action, data) {
    var url = SUITE[app + '_URL'];
    if (!url || /^PASTE_/.test(url)) return Promise.reject(new Error(app + '_URL is not set in config.js'));
    var body = Object.assign({ action: action, token: S.token }, data || {});
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, SUITE.TIMEOUT_MS);
    var req;
    if (app === 'PLT') {
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
  function showLogin() {
    $('#appShell').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
    setTimeout(function () { $('#userInput').focus(); }, 50);
  }
  function doLogin() {
    var un = $('#userInput').value.trim(), pw = $('#pinInput').value, btn = $('#loginBtn');
    $('#loginError').textContent = '';
    if (!un || !pw) { $('#loginError').textContent = 'Enter username and password'; return; }
    busy(btn, true, 'Signing in…');
    api('ERP', 'suiteLogin', { username: un, password: pw }).then(function (d) {
      S.token = d.token;
      try { sessionStorage.setItem('suite_token', d.token); } catch (e) {}
      start(d);
    }).catch(function (e) { $('#loginError').textContent = e.message; })
      .then(function () { busy(btn, false); $('#pinInput').value = ''; });
  }
  function signOut() {
    try { SESSION_KEYS.concat(['suite_token']).forEach(function (k) { sessionStorage.removeItem(k); }); localStorage.removeItem('erp_user'); } catch (e) {}
    S.token = ''; S.user = null;
    Object.keys(S.frames).forEach(function (k) { S.frames[k].remove(); });
    S.frames = {};
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
    applySessions(S.sessions);
    $('#loginScreen').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    $('#userName').textContent = S.user.name;
    $('#userRoles').textContent = S.user.roles.join(', ') || 'No suite role';
    $('#userAvatar').textContent = (S.user.name || 'U').charAt(0).toUpperCase();
    buildNav();
    var want = location.hash.replace('#', '');
    go(navItems().some(function (n) { return n.id === want; }) ? want : (navItems()[0] || {}).id);
    refreshBadge();
  }

  /* ---------------- NAV ---------------- */
  function navItems() {
    var u = S.user, s = S.sessions, M = SUITE.MODULES, items = [];
    if (has('Production') || has('Viewer')) items.push({ id: 'overview', sec: 'Automation', label: 'Overview', ic: '◎' });
    if (has('Store')) items.push({ id: 'inward', sec: 'Automation', label: 'Inward Entry', ic: '⇩' });
    if (has('Approver')) items.push({ id: 'approvals', sec: 'Automation', label: 'Approvals', ic: '✓', badge: true });
    if (S.user.roles.indexOf('Admin') !== -1) items.push({ id: 'dispatch', sec: 'Automation', label: 'Dispatch (manual)', ic: '⇨' });
    if (s.erp_user) items.push({ id: 'm-erp', sec: 'Apps', label: M.erp.label, ic: '▤', mod: 'erp' });
    if (s.ims) items.push({ id: 'm-ims', sec: 'Apps', label: M.ims.label, ic: '▦', mod: 'ims' });
    if (has('Production') || has('Dispatch') || u.pltSup) items.push({ id: 'm-pltScan', sec: 'Apps', label: M.pltScan.label, ic: '⌁', mod: 'pltScan' });
    if (u.pltSup) items.push({ id: 'm-pltAdmin', sec: 'Apps', label: M.pltAdmin.label, ic: '⚙', mod: 'pltAdmin' });
    if (s.sms_session) items.push({ id: 'm-soms', sec: 'Apps', label: M.soms.label, ic: '⧉', mod: 'soms' });
    if (has('Admin')) items.push({ id: 'settings', sec: 'Admin', label: 'Settings', ic: '⚑' });
    return items;
  }
  function buildNav() {
    var html = '', sec = '';
    navItems().forEach(function (n) {
      if (n.sec !== sec) { sec = n.sec; html += '<div class="nav-sec">' + esc(sec) + '</div>'; }
      html += '<div class="nav-item" data-id="' + n.id + '"><span class="nav-ic">' + n.ic + '</span><span>' + esc(n.label) + '</span>' +
        (n.badge ? '<span class="badge hidden" id="aprBadge">0</span>' : '') + '</div>';
    });
    if (!html) html = '<div class="nav-sec">No access assigned. Ask the Admin.</div>';
    $('#nav').innerHTML = html;
    $$('.nav-item').forEach(function (el) { el.addEventListener('click', function () { go(el.dataset.id); closeMenu(); }); });
  }
  function go(id) {
    if (!id) return;
    var n = navItems().filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    S.view = id;
    history.replaceState(null, '', '#' + id);
    $$('.nav-item').forEach(function (el) { el.classList.toggle('active', el.dataset.id === id); });
    $('#pageTitle').textContent = n.label;
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
  function closeMenu() { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); }

  function refreshBadge() {
    if (!has('Approver')) return;
    api('IMS', 'suiteListApprovals', { status: 'Pending' }).then(function (r) {
      var list = r.list;
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
    Promise.all([api('ERP', 'suiteLinks'), api('ERP', 'suiteUsers')]).then(function (res) {
      var L = res[0], U = res[1];
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
        ['ERP', 'IMS', 'PLT', 'SOMS'].map(function (a) {
          var v = (L.urls || {})[a];
          return '<tr><td><b>' + a + '</b></td><td class="mono">' + (v ? esc(v) : '<span class="chip chip-bad">Not registered</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-h"><div><div class="card-t">Users</div><div class="card-s">Naya user / password ERP mein banta hai. Yahan bas har user ka Kaam chuno → Save.</div></div></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>User</th><th>Active</th><th>Kaam</th><th></th></tr></thead><tbody>' +
        U.users.map(function (u) {
          return '<tr><td><b>' + esc(u.name) + '</b><div class="hint mono">' + esc(u.username) + '</div></td><td>' + (u.active ? '<span class="chip chip-ok">Yes</span>' : '<span class="chip chip-off">No</span>') +
            '</td><td>' + jobsOf(u).map(function (j) { return '<span class="chip">' + esc(JOBS[j].label) + '</span>'; }).join(' ') +
            '</td><td><button class="btn btn-sm" data-edit="' + esc(u.username) + '">Edit</button></td></tr>';
        }).join('') + '</tbody></table></div><div id="userForm"></div></div></div>';
      el.innerHTML = html;
      $$('#view-settings select[data-key]').forEach(function (x) { x.onchange = function () { saveCfg(x.dataset.key, x.value, x); }; });
      $$('#view-settings [data-save]').forEach(function (b) { b.onclick = function () { var i = $('#view-settings input[data-key="' + b.dataset.save + '"]'); saveCfg(b.dataset.save, i.value, b); }; });
      $$('#view-settings [data-edit]').forEach(function (b) { b.onclick = function () { userForm(U.users.filter(function (u) { return u.username === b.dataset.edit; })[0]); }; });
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
    Admin:      { label: 'Admin',              hint: 'Sab kuch + Settings' },
    Store:      { label: 'Store',              hint: 'Inward Entry + Inventory (IMS)' },
    Purchase:   { label: 'Purchase',           hint: 'Store Orders (SOMS) + Inward Approvals' },
    Production: { label: 'Production',         hint: 'Line Scan + Line Admin + Overview + Inventory' },
    Dispatch:   { label: 'Dispatch',           hint: 'Line Scan → Dispatch' },
    ErpOnly:    { label: 'Sales / Accounts',   hint: 'Sirf ERP' }
  };
  var JOB_ORDER = ['Admin', 'Store', 'Purchase', 'Production', 'Dispatch', 'ErpOnly'];
  /** Saved access se "Kaam" wapas pehchano (table + form ke liye) */
  function jobsOf(u) {
    var r = u.roles || [];
    if (r.indexOf('Admin') !== -1) return ['Admin'];
    var j = [];
    if (r.indexOf('Store') !== -1) j.push('Store');
    if (u.somsRole === 'Purchase' || u.somsRole === 'Admin') j.push('Purchase');
    if (r.indexOf('Production') !== -1) j.push('Production');
    if (r.indexOf('Dispatch') !== -1) j.push('Dispatch');
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
    return {
      roles: roles,
      imsRole: has('Store') ? 'ajay' : (has('Production') ? 'sandeep' : ''),
      somsRole: has('Purchase') ? 'Purchase' : '',
      pltSup: has('Production')
    };
  }
  function userForm(u) {
    var cur = jobsOf(u);
    $('#userForm').innerHTML = '<div class="card-b" style="border-top:1px solid var(--line)"><div class="card-t" style="margin-bottom:12px">' + esc(u.name) + ' <span class="muted mono">' + esc(u.username) + '</span></div>' +
      '<div class="field"><span class="lbl">Kaam (ek ya zyada chuno)</span><div class="grid g3">' + JOB_ORDER.map(function (k) {
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
      if (!jobs.length) { $('#ufErr').textContent = 'Kam se kam ek Kaam chuno'; return; }
      var a = accessFor(jobs);
      busy(btn, true, 'Saving…');
      api('ERP', 'suiteSaveUser', { username: u.username, active: $('#ufActive').value, imsRole: a.imsRole, somsRole: a.somsRole, pltSup: String(a.pltSup), roles: a.roles.join(',') })
        .then(function () { toast('Saved. User dobara login karega tab lagu hoga.', 'ok'); VIEWS.settings(); })
        .catch(function (e) { $('#ufErr').textContent = e.message; busy(btn, false); });
    };
    $('#userForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* =============================================================
   * BOOT
   * ============================================================= */
  function boot() {
    $('#loginBtn').onclick = doLogin;
    $('#pinInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('#userInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#pinInput').focus(); });
    $('#logoutBtn').onclick = function () { if (confirm('Sign out of all apps?')) signOut(); };
    $('#reloadBtn').onclick = reloadCurrent;
    $('#menuBtn').onclick = function () { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); };
    $('#overlay').onclick = closeMenu;
    // module iframes se logout message
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.source !== 'litpax-suite') return;
      if (e.data.type === 'logout') signOut();
    });
    setInterval(function () { if (S.user) refreshBadge(); }, 120000);

    if (/^PASTE_/.test(SUITE.ERP_URL || 'PASTE_')) {
      showLogin(); $('#loginError').textContent = 'GAS URLs are not set in config.js'; return;
    }
    var tok = '';
    try { tok = sessionStorage.getItem('suite_token') || ''; } catch (e) {}
    if (!tok) return showLogin();
    S.token = tok;
    api('ERP', 'suiteMe').then(function (d) { start(d); })
      .catch(function () { signOut(); });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
