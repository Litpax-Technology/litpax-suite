/* ============================================================
   LITPAX — ADVANCE REPLACEMENT  (apni alag GAS + apni alag sheet · CONFIG.API_URL = SUITE.REPLACE_URL)
   Login: Suite ka hi (sessionStorage suite_token) + PIN wala insaan (suite_staff)
   Roles dynamic: sheet ke "Roles" tab se (Admin → Roles & lists)
   Flow: Pending Approval → Open → Battery Sent → Pickup Arranged → Old Received → Closed
   ============================================================ */

/* ---------- chhote helpers ---------- */
const $ = id => document.getElementById(id);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const newReqId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const pad2 = n => ('0' + n).slice(-2);
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : String(s || ''); };
const rupee = v => v === '' || v == null ? '' : '₹' + Number(v).toLocaleString('en-IN');

function toast(msg) {
  const t = $('rpToast'), m = String(msg || '');
  t.className = 'rp-toast ' + (/^\s*(❌|🔒)/.test(m) ? 'bad' : /^\s*⚠/.test(m) ? 'warn' : /^\s*✅/.test(m) ? 'ok' : '');
  t.textContent = m.replace(/^\s*(❌|🔒|⚠️|⚠|✅)\s*/, '');
  void t.offsetWidth; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3600);
}
let _lastFocus = null;
function modalOpen(title, body) {
  _lastFocus = document.activeElement;
  $('rpMdTitle').textContent = title; $('rpMdBody').innerHTML = body; $('rpOv').classList.add('show');
  setTimeout(() => { const f = $('rpMdBody').querySelector('input:not([type=hidden]):not([readonly]), select, textarea, button'); if (f) f.focus(); }, 30);
}
function modalClose() { $('rpOv').classList.remove('show'); if (_lastFocus && _lastFocus.focus) try { _lastFocus.focus(); } catch (e) {} }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('rpOv').classList.contains('show')) modalClose(); });
const fg = (label, id, type, val, extra) => '<div class="fg"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></div>';
function optList(list, sel, ph) {
  list = list || [];
  const all = sel && list.indexOf(sel) === -1 ? list.concat([sel]) : list;
  return '<option value="">' + esc(ph || '-- Select --') + '</option>' + all.map(v => '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
}
function segPick(b) { b.parentElement.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }
const segVal = id => { const b = document.querySelector('#' + id + ' button.on'); return b ? b.dataset.v : ''; };
const sec = (title, inner) => '<section class="dsec"><h3>' + title + '</h3>' + inner + '</section>';
const kvh = rows => rows.filter(r => r[1] !== '' && r[1] != null).map(r => '<div class="kv"><span>' + esc(r[0]) + '</span><span>' + r[1] + '</span></div>').join('') || '<div class="empty sm">—</div>';
// Suite ka Sign out (Service Hub ke andar hai, isliye seedha Suite ko)
function logout() { try { window.top.postMessage({ source: 'litpax-suite', type: 'logout' }, location.origin); } catch (e) {} }

/* ---------- state ---------- */
const AR = { me: null, access: false, set: null, rows: [], tab: '', cur: null, roles: null, perms: [] };
const AR_TONE = { 'Pending Approval': 'amber', 'Open': 'blue', 'Battery Sent': 'violet', 'Pickup Arranged': 'teal', 'Old Received': 'teal',
  'Closed': 'green', 'Rejected': 'red', 'Cancelled': 'gray' };
const AR_ENDED = { 'Closed': 1, 'Rejected': 1, 'Cancelled': 1 };
// [step, perm, statuses, button label, button class]
const AR_STEPS = [
  ['approve', 'Approve', ['Pending Approval'], 'Approve', 'btn-green'],
  ['reject', 'Approve', ['Pending Approval'], 'Reject', 'btn-danger'],
  ['send', 'Send', ['Open'], 'Send new battery', 'btn-primary'],
  ['pickup', 'Pickup', ['Battery Sent'], 'Arrange pickup', ''],
  ['receive', 'Receive', ['Battery Sent', 'Pickup Arranged'], 'Old battery received', 'btn-primary'],
  ['close', 'Close', ['Old Received'], 'Close case', 'btn-green'],
  ['cancel', 'Cancel', ['Pending Approval', 'Open'], 'Cancel', 'btn-danger']
];
const AR_TABS = [
  ['mine', 'My work', r => arSteps(r).some(s => s[0] !== 'cancel' && s[0] !== 'reject')],
  ['active', 'All open', r => !AR_ENDED[r['Status']]],
  ['Pending Approval', 'Needs approval'], ['Open', 'To send'], ['Battery Sent', 'Sent'], ['Pickup Arranged', 'Pickup'],
  ['Old Received', 'Old received'], ['Closed', 'Closed'], ['ended', 'Rejected / cancelled', r => r['Status'] === 'Rejected' || r['Status'] === 'Cancelled'],
  ['all', 'All', () => true]
];
const arPerm = k => !!(AR.me && AR.me.perms && AR.me.perms[k]);
const arSteps = r => AR_STEPS.filter(s => arPerm(s[1]) && s[2].indexOf(r['Status']) !== -1);
const arOn = () => !!(CONFIG.API_URL && !/^PASTE_/.test(CONFIG.API_URL));

/* ---------- API (JSONP GET) ---------- */
function arAuth() {
  const p = {};
  try {
    p.st = sessionStorage.getItem('suite_token') || '';
    const s = JSON.parse(sessionStorage.getItem('suite_staff') || 'null');
    if (s && s.token) { p.sfa = s.app; p.sfi = s.id; p.sft = s.token; }
  } catch (e) {}
  return p;
}
let _seq = 0;
function arApi(params) {
  return new Promise((res, rej) => {
    if (!arOn()) return rej('off');
    const q = Object.assign({}, params, arAuth()), cb = '__ar' + (++_seq) + '_' + Date.now(), s = document.createElement('script');
    let done = false;
    const end = () => { done = true; clearTimeout(t); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); };
    const t = setTimeout(() => { if (!done) { end(); rej('timeout'); } }, CONFIG.TIMEOUT_MS || 25000);
    window[cb] = d => {
      end();
      if (d && d.auth === false) { toast('🔒 ' + (d.msg || 'Please sign in again')); logout(); return rej('auth'); }
      res(d);
    };
    s.onerror = () => { if (!done) { end(); rej('network'); } };
    s.src = CONFIG.API_URL + '?' + Object.keys(q).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(q[k] == null ? '' : q[k])).join('&') + '&callback=' + cb + '&t=' + Date.now();
    document.body.appendChild(s);
  });
}
// save: busy button + ek hi reqId (retry pe dobara save nahi)
async function arRun(params, btn) {
  let old = '';
  if (btn) { old = btn.innerHTML; btn.disabled = true; btn.textContent = 'Saving…'; }
  const p = Object.assign({ reqId: newReqId() }, params);
  try {
    for (let i = 0; ; i++) {
      let r;
      try { r = await arApi(p); }
      catch (e) { if (e === 'auth') return null; if (i < 2) { await sleep(1500 * (i + 1)); continue; } toast('❌ Network error — please try again'); return null; }
      if (r && r.busy && i < 4) { await sleep(2000); continue; }
      if (!r || !r.ok) { toast('❌ ' + ((r && r.msg) || 'Something went wrong')); return null; }
      return r;
    }
  } finally { if (btn) { btn.disabled = false; btn.innerHTML = old; } }
}

/* ---------- boot ---------- */
window.addEventListener('load', boot);
async function boot() {
  if (!arOn()) return emptyMsg('REPLACE_URL config.js me set nahi hai.');
  let tk = ''; try { tk = sessionStorage.getItem('suite_token') || ''; } catch (e) {}
  if (!tk) return emptyMsg('Please open this from Litpax Suite.');
  $('rpList').innerHTML = '<div class="sk"></div>'.repeat(3);
  let r = null;
  try { r = await arApi({ action: 'repMe' }); } catch (e) { if (e === 'auth') return; }
  if (!r || !r.ok) return emptyMsg((r && r.msg) || 'Could not connect — refresh and try again.');
  AR.me = r.me; AR.access = !!r.access; AR.set = r.settings;
  if (!AR.access) return emptyMsg('Advance Replacement ka access nahi hai — Admin se role lagwao.');
  $('rpMe').innerHTML = '<b>' + esc(AR.me.name) + '</b><span>' + esc((AR.me.roles || []).join(', ')) + '</span>';
  $('rpNewBtn').hidden = !arPerm('Create');
  $('rpRolesBtn').hidden = !AR.me.admin;
  await arLoad();
  arPrefill();
}
function emptyMsg(m) { $('rpKpis').innerHTML = ''; $('rpChips').innerHTML = ''; $('rpList').innerHTML = '<div class="empty">' + esc(m) + '</div>'; }
// Service ticket se aaya → form bhara hua
function arPrefill() {
  let o = ''; try { o = sessionStorage.getItem('rep_open') || ''; sessionStorage.removeItem('rep_open'); } catch (e) {}
  if (o && AR.access) return arOpen(o);   // ticket / Customer page se aaya → seedha case
  let p = null; try { p = JSON.parse(sessionStorage.getItem('rep_prefill') || 'null'); sessionStorage.removeItem('rep_prefill'); } catch (e) {}
  if (!p || !AR.access) return;
  if (!arPerm('Create')) return toast('⚠️ Aapke role me naya case banana nahi hai');
  arNew({ 'Ticket ID': p.ticketId, 'Customer Name': p.name, 'Phone': p.phone, 'City': p.city, 'State': p.state, 'Dealer': p.dealer,
    'Complaint': p.complaint, 'Battery Model': p.model });
}
window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.source !== 'litpax-suite') return;
  if (e.data.type === 'rep-new') arPrefill();
});

/* ---------- list ---------- */
async function arLoad() {
  if (!AR.access) return;
  if (!AR.rows.length) $('rpList').innerHTML = '<div class="sk"></div>'.repeat(3);
  try {
    const r = await arApi({ action: 'repList' });
    if (!r || !r.ok) { $('rpList').innerHTML = '<div class="empty">' + esc((r && r.msg) || 'Could not load') + '</div>'; return; }
    AR.rows = r.rows || []; if (r.me) AR.me = r.me;
    if (!AR.tab) AR.tab = AR.rows.some(AR_TABS[0][2]) ? 'mine' : 'active';
    arRender();
  } catch (e) { if (e !== 'auth') $('rpList').innerHTML = '<div class="empty">Could not load data — check the connection.</div>'; }
}
const arTabFn = k => { const t = AR_TABS.find(x => x[0] === k) || AR_TABS[1]; return t[2] || (r => r['Status'] === t[0]); };
function arTab(k) { AR.tab = k; arRender(); }
const arAge = r => { const d = new Date(String(r['Created At']).replace(' ', 'T')); return isNaN(d) ? 0 : Math.max(0, Math.floor((Date.now() - d) / 864e5)); };
function arRender() {
  if (!AR.access) return;
  const all = AR.rows, open = all.filter(r => !AR_ENDED[r['Status']]), cnt = s => all.filter(r => r['Status'] === s).length;
  const kpi = (l, v, cls, sub) => '<div class="kpi ' + (cls || '') + '"><span>' + l + '</span><b>' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  const waitOld = all.filter(r => r['Status'] === 'Battery Sent' || r['Status'] === 'Pickup Arranged'), late = waitOld.filter(r => arAge(r) > 15).length;
  $('rpKpis').innerHTML = kpi('Open cases', open.length) + kpi('Needs approval', cnt('Pending Approval'), cnt('Pending Approval') ? 'risk' : 'good') +
    kpi('To send', cnt('Open'), cnt('Open') ? 'risk' : 'good', 'new battery not sent') +
    kpi('Old battery awaited', waitOld.length, late ? 'late' : '', late ? late + ' older than 15 days' : 'sent, old not back');
  $('rpChips').innerHTML = AR_TABS.filter(t => t[0] !== 'mine' || AR_STEPS.some(s => arPerm(s[1])))
    .map(t => '<button type="button" class="chip' + (t[0] === AR.tab ? ' active' : '') + '" data-k="' + esc(t[0]) + '" onclick="arTab(this.dataset.k)">' + esc(t[1]) + ' <b>' + all.filter(arTabFn(t[0])).length + '</b></button>').join('');
  const q = ($('rpSearch').value || '').toLowerCase().trim();
  const rows = all.filter(arTabFn(AR.tab)).filter(r => !q || ['Case ID', 'Customer Name', 'Phone', 'City', 'Dealer', 'Battery Model', 'Old Serial', 'New Serial', 'Ticket ID', 'Complaint']
    .map(k => r[k]).join(' ').toLowerCase().indexOf(q) !== -1);
  $('rpList').innerHTML = rows.length ? rows.map(arCard).join('') : '<div class="empty">' + (all.length ? 'No cases here' : 'No replacement cases yet') + '</div>';
}
function arCard(r) {
  const st = r['Status'], steps = arSteps(r).filter(s => s[0] !== 'cancel' && s[0] !== 'reject'), age = arAge(r);
  const meta = [r['Battery Category'], r['Battery Model'], r['Old Serial'] && 'SN ' + r['Old Serial'], r['Charger'] === 'Yes' && '+ charger'].filter(Boolean).join(' · ');
  return '<article class="card" tabindex="0" data-id="' + esc(r['Case ID']) + '" onclick="arOpen(this.dataset.id)" onkeydown="if(event.key===\'Enter\')arOpen(this.dataset.id)">' +
    '<div class="c-top"><span class="id">' + esc(r['Case ID']) + '</span><span class="pill p-' + (AR_TONE[st] || 'blue') + '">' + esc(st) + '</span>' +
      (r['Ticket ID'] ? '<span class="tk">' + esc(r['Ticket ID']) + '</span>' : '') + '<span class="age">' + (AR_ENDED[st] ? niceDate(r['Updated At']) : age + 'd old') + '</span></div>' +
    '<div class="c-co"><b>' + esc(r['Customer Name']) + '</b><span>' + esc([r['Phone'], r['City'], r['Dealer']].filter(Boolean).join(' · ')) + '</span></div>' +
    '<div class="c-meta">' + esc(meta) + (r['Warranty'] ? ' <span class="war">' + esc(r['Warranty']) + '</span>' : '') + '</div>' +
    (r['Complaint'] ? '<div class="c-cmp">' + esc(r['Complaint']) + '</div>' : '') +
    (steps.length ? '<div class="c-next">' + steps.map(s => '<button type="button" class="btn btn-sm ' + s[4] + '" data-id="' + esc(r['Case ID']) + '" data-s="' + s[0] + '" onclick="event.stopPropagation();arStep(this.dataset.id,this.dataset.s)">' + esc(s[3]) + '</button>').join('') + '</div>' : '') +
    '</article>';
}

/* ---------- new / edit ---------- */
function arNew(pre, editId) {
  const S = AR.set || {}, x = pre || {}, ch = x['Charger'] === 'Yes';
  const sel = (id, list, v) => '<select id="' + id + '">' + optList(list, v || '') + '</select>';
  modalOpen(editId ? 'Edit ' + editId : 'New Advance Replacement',
    (x['Ticket ID'] && !editId ? '<div class="note">Ticket <b>' + esc(x['Ticket ID']) + '</b> se — details bhar di hain, check kar lo.</div>' : '') +
    '<div class="form-grid">' +
      fg('Ticket ID <span class="opt">(if any)</span>', 'ar_tk', 'text', x['Ticket ID'], ' maxlength="40"') +
      '<div class="fg"><label for="ar_war">Warranty <b>*</b></label>' + sel('ar_war', S.warranty, x['Warranty']) + '</div>' +
      fg('Customer / company name <b>*</b>', 'ar_name', 'text', x['Customer Name'], ' maxlength="120"') +
      fg('Phone <b>*</b>', 'ar_phone', 'tel', x['Phone'], ' maxlength="14" inputmode="numeric"') +
      fg('City', 'ar_city', 'text', x['City'], ' maxlength="80"') +
      '<div class="fg"><label for="ar_state">State</label>' + sel('ar_state', CONFIG.STATES, x['State']) + '</div>' +
      fg('Dealer', 'ar_dealer', 'text', x['Dealer'], ' maxlength="120"') +
      '<div class="fg"><label for="ar_cat">Battery category <b>*</b></label>' + sel('ar_cat', S.categories, x['Battery Category']) + '</div>' +
      fg('Battery model <b>*</b>', 'ar_model', 'text', x['Battery Model'], ' maxlength="100"') +
      fg('Old serial no', 'ar_serial', 'text', x['Old Serial'], ' maxlength="60"') +
      '<div class="fg full"><label class="chk"><input type="checkbox" id="ar_ch"' + (ch ? ' checked' : '') + ' onchange="$(\'ar_chw\').hidden=!this.checked"> Charger bhi replace hoga</label></div>' +
      '<div id="ar_chw" class="form-grid sub"' + (ch ? '' : ' hidden') + '>' + fg('Charger model <b>*</b>', 'ar_chm', 'text', x['Charger Model'], ' maxlength="100"') +
        fg('Charger serial', 'ar_chs', 'text', x['Charger Serial'], ' maxlength="60"') + '</div>' +
      '<div class="fg full"><label for="ar_cmp">Complaint <b>*</b></label><textarea id="ar_cmp" maxlength="500" placeholder="e.g. No backup, swelling, 8 months old">' + esc(x['Complaint'] || '') + '</textarea></div>' +
      '<div class="fg full"><label for="ar_rem">Remarks</label><input id="ar_rem" maxlength="500" value="' + esc(x['Remarks'] || '') + '"></div>' +
    '</div>' +
    ((S.approvalFor || []).length ? '<p class="muted">' + esc(S.approvalFor.join(' / ')) + ' → pehle Admin approve karega.</p>' : '') +
    '<button type="button" class="btn btn-primary btn-block" data-id="' + esc(editId || '') + '" onclick="arSave(this)">' + (editId ? 'Save changes' : 'Create case') + '</button>');
}
async function arSave(btn, force) {
  const v = id => $(id).value.trim();
  const d = { action: 'repSave', ticketId: v('ar_tk'), warranty: $('ar_war').value, name: v('ar_name'), phone: v('ar_phone'), city: v('ar_city'), state: $('ar_state').value,
    dealer: v('ar_dealer'), category: $('ar_cat').value, model: v('ar_model'), serial: v('ar_serial'), charger: $('ar_ch').checked ? 'Yes' : 'No',
    chargerModel: v('ar_chm'), chargerSerial: v('ar_chs'), complaint: v('ar_cmp'), remarks: v('ar_rem') };
  if (btn.dataset.id) d.id = btn.dataset.id;
  if (!d.name || !d.phone || !d.category || !d.model || !d.warranty || !d.complaint) return toast('⚠️ Fill name, phone, category, model, warranty and complaint');
  if (!/^\d{10}$/.test(d.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''))) return toast('⚠️ Phone should be 10 digits');
  if (d.charger === 'Yes' && !d.chargerModel) return toast('⚠️ Enter the charger model');
  if (force) d.force = '1';
  const r = await arRun(d, btn); if (!r) return;
  if (r.duplicate) { if (confirm(r.msg + '\n\nPhir bhi naya case banana hai?')) return arSave(btn, true); return; }
  modalClose();
  toast('✅ ' + r.id + (d.id ? ' saved' : r.approval ? ' created — waiting for admin approval' : ' created — ready to send'));
  arLoad();
}

/* ---------- detail ---------- */
async function arOpen(id) {
  modalOpen(id, '<div class="sk"></div>');
  let r = null; try { r = await arApi({ action: 'repGet', id }); } catch (e) {}
  if (!r || !r.ok) { modalClose(); return toast('❌ ' + ((r && r.msg) || 'Could not load ' + id)); }
  AR.cur = r.row;
  const x = r.row, st = x['Status'], kv = rows => kvh(rows.map(a => [a[0], a[1] === '' || a[1] == null ? '' : esc(a[1])]));
  const steps = arSteps(x), canEdit = arPerm('Create') && (st === 'Pending Approval' || st === 'Open');
  let h = '<div class="d-head"><span class="pill p-' + (AR_TONE[st] || 'blue') + '">' + esc(st) + '</span>' +
    (x['Ticket ID'] ? (suiteCan('m-service') && /^LTX-/i.test(x['Ticket ID']) ? '<button type="button" class="lnk tk" data-id="' + esc(x['Ticket ID']) + '" onclick="suiteOpen(\'ticket\', this.dataset.id)">Ticket ' + esc(x['Ticket ID']) + ' ↗</button>' : '<span class="tk">Ticket ' + esc(x['Ticket ID']) + '</span>') : '') + '<span class="muted">' + esc(niceDate(x['Created At']) + ' · ' + x['Created By']) + '</span></div>';
  if (steps.length || canEdit) h += '<div class="d-acts">' + steps.map(s => '<button type="button" class="btn btn-sm ' + s[4] + '" data-id="' + esc(id) + '" data-s="' + s[0] + '" onclick="arStep(this.dataset.id,this.dataset.s)">' + esc(s[3]) + '</button>').join('') +
    (canEdit ? '<button type="button" class="btn btn-sm" onclick="arNew(AR.cur, AR.cur[\'Case ID\'])">Edit details</button>' : '') + '</div>';
  h += sec('Customer', (suiteCan('m-erp') && (x['Phone'] || x['Customer Name']) ? '<div class="d-xl"><button type="button" class="lnk" data-k="' + esc((x['Phone'] || '') + '|' + (x['Customer Name'] || '')) + '" onclick="suiteOpen(\'customer\', this.dataset.k)">ERP 360 ↗ orders, payments, service</button></div>' : '') + kv([['Name', x['Customer Name']], ['Phone', x['Phone']], ['City', [x['City'], x['State']].filter(Boolean).join(', ')], ['Dealer', x['Dealer']]]));
  h += sec('Old battery', kv([['Battery', [x['Battery Category'], x['Battery Model']].filter(Boolean).join(' · ')], ['Serial no', x['Old Serial']],
    ['Charger', x['Charger'] === 'Yes' ? [x['Charger Model'], x['Charger Serial'] && 'SN ' + x['Charger Serial']].filter(Boolean).join(' · ') : 'No'],
    ['Warranty', x['Warranty']], ['Complaint', x['Complaint']], ['Remarks', x['Remarks']],
    ['Approved', x['Approved At'] && st !== 'Rejected' ? niceDate(x['Approved At']) + ' · ' + x['Approved By'] + (x['Charge Amount'] !== '' ? ' · ' + rupee(x['Charge Amount']) : ' · free') : ''],
    ['Rejected', x['Reject Reason']], ['Cancelled', x['Cancel Reason']]]));
  if (x['New Serial']) h += sec('New battery sent', kv([['From', x['Send From']], ['Model', x['New Model']], ['Serial no', x['New Serial']], ['Charger serial', x['New Charger Serial']],
    ['Sent', niceDate(x['Sent Date']) + ' · ' + x['Sent By']], ['Transport', [x['Transport'], x['LR No'] && 'LR ' + x['LR No']].filter(Boolean).join(' · ')], ['Remarks', x['Send Remarks']]]));
  if (x['Pickup Date'] || x['Old Received Date']) h += sec('Old battery return', kv([['Pickup', x['Pickup Date'] ? [niceDate(x['Pickup Date']), x['Pickup Transport'], x['Pickup LR'] && 'LR ' + x['Pickup LR']].filter(Boolean).join(' · ') : ''],
    ['Received', x['Old Received Date'] ? niceDate(x['Old Received Date']) + ' · ' + x['Old Received By'] : ''], ['Condition', x['Old Condition']],
    ['Went to', x['Outcome']], ['Closed', x['Closed At'] ? niceDate(x['Closed At']) + ' · ' + x['Closed By'] : '']]));
  h += sec('History', (r.log || []).length ? '<div class="log">' + r.log.slice().reverse().map(l => '<div class="ev"><i></i><div><b>' + esc(l['Action']) + '</b>' +
    (l['Note'] ? '<span>' + esc(l['Note']) + '</span>' : '') + '<small>' + esc(String(l['Time']).slice(0, 16) + ' · ' + l['By']) + '</small></div></div>').join('') + '</div>' : '<div class="empty sm">—</div>');
  $('rpMdBody').innerHTML = h;
}

/* ---------- step forms ---------- */
function arStep(id, step) {
  const x = (AR.cur && AR.cur['Case ID'] === id) ? AR.cur : AR.rows.find(r => r['Case ID'] === id) || {}, S = AR.set || {};
  const seg = (sid, list, on) => '<div class="seg" id="' + sid + '" role="group">' + (list || []).map(v => '<button type="button" data-v="' + esc(v) + '"' + (v === on ? ' class="on"' : '') + ' onclick="segPick(this)">' + esc(v) + '</button>').join('') + '</div>';
  const head = '<div class="d-item"><b>' + esc(x['Customer Name'] || '') + '</b> · ' + esc(id) + ' · ' + esc([x['Battery Model'], x['Old Serial'] && 'SN ' + x['Old Serial']].filter(Boolean).join(' · ')) + '</div>';
  const okBtn = lbl => '<button type="button" class="btn btn-primary btn-block" data-id="' + esc(id) + '" data-s="' + step + '" onclick="arStepSave(this)">' + lbl + '</button>';
  const reason = (lbl, ph) => '<div class="fg full"><label for="as_reason">' + lbl + ' <b>*</b></label><textarea id="as_reason" maxlength="300" placeholder="' + esc(ph) + '"></textarea></div>';
  const R = (AR.me && AR.me.roles) || [], isProd = AR.me && !AR.me.admin && R.some(r => /production/i.test(r)) && !R.some(r => /repair/i.test(r));
  const F = {
    approve: ['Approve ' + id, head + '<div class="form-grid">' + fg('Charge to customer (₹) <span class="opt">empty = free</span>', 'as_charge', 'number', '', ' min="0"') + '</div>' + okBtn('Approve')],
    reject: ['Reject ' + id, head + reason('Reason', 'e.g. physical damage, not covered') + okBtn('Reject')],
    send: ['Send new battery — ' + id, head + '<div class="fg full"><label>New battery from <b>*</b></label>' + seg('as_src', S.sendFrom, isProd ? (S.sendFrom || []).find(v => /production/i.test(v)) : (S.sendFrom || [])[0]) + '</div>' +
      '<div class="form-grid">' + fg('Model <b>*</b>', 'as_model', 'text', x['Battery Model'] || '', ' maxlength="100"') + fg('New serial no <b>*</b>', 'as_serial', 'text', '', ' maxlength="60"') +
      (x['Charger'] === 'Yes' ? fg('New charger serial', 'as_chs', 'text', '', ' maxlength="60"') : '') + fg('Dispatch date', 'as_date', 'date', todayStr()) +
      fg('Transport', 'as_tr', 'text', '', ' maxlength="120"') + fg('LR / docket no', 'as_lr', 'text', '', ' maxlength="60"') +
      '<div class="fg full"><label for="as_rem">Remarks</label><input id="as_rem" maxlength="300"></div></div>' + okBtn('Send')],
    pickup: ['Pickup of old battery — ' + id, head + '<div class="form-grid">' + fg('Pickup date', 'as_date', 'date', todayStr()) + fg('Transport', 'as_tr', 'text', '', ' maxlength="120"') +
      fg('LR / docket no', 'as_lr', 'text', '', ' maxlength="60"') + '</div>' + okBtn('Save pickup')],
    receive: ['Old battery received — ' + id, head + '<div class="form-grid">' + fg('Received date', 'as_date', 'date', todayStr()) +
      '<div class="fg full"><label for="as_cond">Condition / remarks</label><input id="as_cond" maxlength="300" placeholder="e.g. 2 cells dead, case ok"></div></div>' + okBtn('Mark received')],
    close: ['Close ' + id, head + '<div class="fg full"><label>Old battery went to <b>*</b></label>' + seg('as_out', S.outcomes, '') + '</div>' +
      '<div class="fg full"><label for="as_rem">Remarks</label><input id="as_rem" maxlength="300"></div>' + okBtn('Close case')],
    cancel: ['Cancel ' + id, head + reason('Why cancel?', 'e.g. customer refused') + okBtn('Cancel case')]
  }[step];
  if (F) modalOpen(F[0], F[1]);
}
async function arStepSave(btn) {
  const s = btn.dataset.s, d = { action: 'repAct', id: btn.dataset.id, step: s }, v = id => ($(id) ? $(id).value.trim() : '');
  if (s === 'approve') d.charge = v('as_charge');
  if (s === 'reject' || s === 'cancel') { d.reason = v('as_reason'); if (!d.reason) return toast('⚠️ Write the reason'); }
  if (s === 'send') {
    Object.assign(d, { source: segVal('as_src'), newModel: v('as_model'), newSerial: v('as_serial'), newChargerSerial: v('as_chs'), date: v('as_date'), transport: v('as_tr'), lr: v('as_lr'), remarks: v('as_rem') });
    if (!d.source) return toast('⚠️ Pick where the battery comes from');
    if (!d.newModel || !d.newSerial) return toast('⚠️ Enter model and new serial no');
  }
  if (s === 'pickup') Object.assign(d, { date: v('as_date'), transport: v('as_tr'), lr: v('as_lr') });
  if (s === 'receive') Object.assign(d, { date: v('as_date'), condition: v('as_cond') });
  if (s === 'close') { Object.assign(d, { outcome: segVal('as_out'), remarks: v('as_rem') }); if (!d.outcome) return toast('⚠️ Pick where the old battery went'); }
  const r = await arRun(d, btn); if (!r) return;
  modalClose(); toast('✅ ' + d.id + ' → ' + r.status); arLoad();
}

/* ---------- Admin: roles + lists (sheet ke Roles / Settings tab) ---------- */
async function arRolesOpen() {
  modalOpen('Roles & lists', '<div class="sk"></div>');
  let r = null; try { r = await arApi({ action: 'repRoles' }); } catch (e) {}
  if (!r || !r.ok) { modalClose(); return toast('❌ ' + ((r && r.msg) || 'Could not load roles')); }
  AR.perms = r.perms; AR.roles = r.roles; AR.set = r.settings;
  const P = AR.perms, S = AR.set || {};
  const cb = (k, on, lbl) => '<td class="c"><input type="checkbox" data-k="' + k + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(lbl) + '"></td>';
  const row = x => '<tr><td><input class="rn" value="' + esc(x.role) + '" maxlength="40" placeholder="Role" aria-label="Role name"></td>' +
    '<td><input class="rm" value="' + esc((x.match || []).join(', ')) + '" maxlength="200" placeholder="Login match" aria-label="Login match"></td>' +
    P.map(k => cb(k, x[k], k)).join('') + cb('active', x.active !== false, 'Active') +
    '<td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest(\'tr\').remove()" aria-label="Remove role">✕</button></td></tr>';
  const lst = (id, lbl, v, hint) => '<div class="fg full"><label for="' + id + '">' + lbl + '</label><input id="' + id + '" value="' + esc((v || []).join(', ')) + '" maxlength="400">' + (hint ? '<small class="muted">' + hint + '</small>' : '') + '</div>';
  AR.rowHtml = row;
  $('rpMdBody').innerHTML =
    '<div class="note">Login match = kis login ko ye role mile: Suite role (Service, Repair…), ERP role (Sales, Production…) ya Staff team — comma se. Admin ko hamesha sab milta hai.</div>' +
    '<div class="roles-wrap"><table class="roles"><thead><tr><th>Role</th><th>Login match</th>' + P.map(k => '<th>' + esc(k) + '</th>').join('') + '<th>Active</th><th></th></tr></thead>' +
    '<tbody id="arRoleRows">' + AR.roles.map(row).join('') + '</tbody></table></div>' +
    '<button type="button" class="btn btn-sm" style="margin:8px 0 18px" onclick="arRoleAdd()">+ Add role</button>' +
    '<div class="form-grid">' + lst('al_cat', 'Battery categories', S.categories) + lst('al_war', 'Warranty options', S.warranty) +
      lst('al_app', 'Needs admin approval for', S.approvalFor, 'Empty = never') + lst('al_src', 'New battery from', S.sendFrom) + lst('al_out', 'Old battery goes to (on close)', S.outcomes) + '</div>' +
    '<button type="button" class="btn btn-primary btn-block" onclick="arRolesSave(this)">Save</button>';
}
function arRoleAdd() {
  const tb = $('arRoleRows'), tmp = document.createElement('tbody');
  const blank = { role: '', match: [], active: true }; AR.perms.forEach(k => { blank[k] = k === 'View'; });
  tmp.innerHTML = AR.rowHtml(blank);
  tb.appendChild(tmp.firstChild);
  tb.lastChild.querySelector('.rn').focus();
}
async function arRolesSave(btn) {
  const roles = Array.from(document.querySelectorAll('#arRoleRows tr')).map(tr => {
    const o = { role: tr.querySelector('.rn').value.trim(), match: tr.querySelector('.rm').value.trim() };
    tr.querySelectorAll('input[type=checkbox]').forEach(c => { o[c.dataset.k] = c.checked; });
    return o;
  }).filter(o => o.role || o.match);
  if (roles.some(o => !o.role || !o.match)) return toast('⚠️ Every role needs a name and a login match');
  const r1 = await arRun({ action: 'repRolesSave', roles: JSON.stringify(roles) }, btn); if (!r1) return;
  const v = id => $(id).value;
  const r2 = await arRun({ action: 'repSettingsSave', categories: v('al_cat'), warranty: v('al_war'), approvalFor: v('al_app'), sendFrom: v('al_src'), outcomes: v('al_out') }, btn); if (!r2) return;
  AR.set = r2.settings; modalClose(); toast('✅ Roles & lists saved');
  const me2 = await arApi({ action: 'repMe' }).catch(() => null);
  if (me2 && me2.ok) AR.me = me2.me;
  arRender();
}

/* ---------- LINKED RECORDS — Suite ke dusre records (ticket, ERP customer) ---------- */
function suiteCan(mod) { try { return (sessionStorage.getItem('suite_can') || '').split(',').indexOf(mod) !== -1; } catch (e) { return false; } }
function suiteOpen(type, id) { try { window.top.postMessage({ source: 'litpax-suite', type: 'open-record', rtype: type, id: String(id) }, location.origin); } catch (e) {} }
