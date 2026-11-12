const API = window.GAS_URL;

// AUTH — sessionStorage se, warna localStorage se restore (Lead Tracker se wapas aane pe)
let uStr = sessionStorage.getItem('erp_user');
if (!uStr) {
  const backup = localStorage.getItem('erp_user');
  if (backup) {
    uStr = backup;
    sessionStorage.setItem('erp_user', backup);   // session me wapas daal do
  }
}
if (!uStr) window.location.href = 'index.html';
const user = JSON.parse(uStr || '{}');
// Staff (ErpStaff.gs): team login + naam/PIN → us person ka naam / Sales Name
const ERP_STAFF = (() => { try { const s = JSON.parse(sessionStorage.getItem('erp_staff') || 'null'); return s && s.login === user.username ? s : null; } catch (e) { return null; } })();
if (ERP_STAFF) { user.name = ERP_STAFF.name; user.empId = ERP_STAFF.id; if (ERP_STAFF.salesName) user.salesName = ERP_STAFF.salesName; }
document.getElementById('userNm').textContent = user.name || 'User';
document.getElementById('userRl').textContent = user.role || '';
document.getElementById('userAv').textContent = (user.name || 'U')[0].toUpperCase();

// Role access
const roleAccess = {
    Admin:      ['admindashboard','leads','leaddash','ordertracking','orders','pendingorders','completedorders','crm','production','batteryexchange','dispatch','accounts','customers','products','suppliers','users','materialprod'],
  Sales:      ['orders','pendingorders','completedorders','customers','mydashboard','batteryexchange','leads','leaddash'],
  Accounts:   ['accounts'],
  Production: ['production','batteryexchange','deliverychallan'],
  CRM:        ['crm','orders','pendingorders','completedorders'],
  Dispatch:   ['dispatch']
};
(function applyRole(){
  const allowed = roleAccess[user.role] || roleAccess['Admin'];

  document.querySelectorAll('.nav-item[id^="nav-"]').forEach(el => {
    const mod = el.id.replace('nav-','');
    el.style.display = allowed.includes(mod) ? 'flex' : 'none';
  });

  // Create Lead, Dealer Check, Apps menu — Sales aur Admin dono ko
  const salesOrAdmin = user.role === 'Sales' || user.role === 'Admin';
  const leadBtn = document.getElementById('btnCreateLead');
  if (leadBtn && salesOrAdmin) leadBtn.style.display = 'inline-flex';

  const dealerBtn = document.getElementById('btnDealerCheck');
  if (dealerBtn && salesOrAdmin) dealerBtn.style.display = 'inline-flex';

  const appsMenu = document.getElementById('appsMenu');
  if (appsMenu && salesOrAdmin) appsMenu.style.display = 'block';

  if (user.role === 'Sales' || user.role === 'Admin') {
    const pipeline = document.getElementById('ordersPipeline');
    if (pipeline) pipeline.style.display = 'none';
  }

  if (user.role === 'Accounts') {
    document.querySelector('.sidebar').style.display = 'flex';
    ['sec-tracking','sec-master','sec-admin','sec-sales','sec-finance','sec-leads'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
  } else if (user.role === 'Sales') {
    document.querySelector('.sidebar').style.display = 'flex';
    ['sec-tracking', 'sec-admin'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  } else if (user.role === 'Production') {
    document.querySelector('.sidebar').style.display = 'flex';
    // Production sirf Production tracker — Sales tabs hata diye, filter Production page ke andar hi hai
    ['sec-sales','sec-master','sec-admin','sec-finance','sec-leads'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
  } else if (user.role === 'CRM' || user.role === 'Dispatch') {
    document.querySelector('.sidebar').style.display = 'flex';
    ['sec-sales','sec-master','sec-admin','sec-finance','sec-leads'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
  } else if (user.role !== 'Admin') {
    document.querySelector('.sidebar').style.display = 'none';
  }

      if (user.role === 'Production') {
    setTimeout(() => nav('production', document.getElementById('nav-production')), 100);
  } else if (user.role === 'CRM') {
    setTimeout(() => nav('crm', document.getElementById('nav-crm')), 100);
  } else if (user.role === 'Accounts') {
    setTimeout(() => nav('accounts', document.getElementById('nav-accounts')), 100);
  } else if (user.role === 'Dispatch') {
    setTimeout(() => nav('dispatch', document.getElementById('nav-dispatch')), 100);
  }
})();

// PAGE META
const pageMeta = {
  admindashboard:{title:'Dashboard',sub:'Admin overview & analytics'},
  leads:{title:'Lead Pipeline',sub:'New customers — from first contact to order'},
  leaddash:{title:'Lead Dashboard',sub:'Leads by stage, source and salesperson'},
  ordertracking:{title:'Track Order',sub:'Full history by Order ID'},
  orders:{title:'Sales Orders',sub:'Manage all customer orders'},
  crm:{title:'CRM Tracker',sub:'Order lifecycle tracking'},
    production:{title:'Production',sub:'Production status & updates'},
  batteryexchange:{title:'Advance Battery Replacement',sub:'Warranty battery exchange tracking'},
  dispatch:{title:'Dispatch',sub:'Dispatch queue & delivery tracking'},
  deliverychallan:{title:'Delivery Challan',sub:'Generate & track delivery challans'},
  mydashboard:{title:'My Dashboard',sub:'Your orders & production updates'},
  customers:{title:'Customers',sub:'Customer master data'},
  products:{title:'Products',sub:'Product master data'},
  suppliers:{title:'Suppliers',sub:'Supplier master data'},
  users:{title:'Users & Access',sub:'Manage users and roles'},
  accounts:{title:'Accounts',sub:'Order accounts & finance tracking'},
  customer:{title:'Customer',sub:'All orders, payments, leads, service and replacements for this customer'}
};

function nav(id, el) {
    // Advance Replacement ab Service Hub me (apni GAS). Suite ke andar wahi tab khulta hai
  if (id === 'batteryexchange' && window.parent !== window) {
    try { window.parent.postMessage({ source: 'litpax-suite', type: 'open-replace' }, location.origin); } catch (e) {}
    return;
  }
  if (id === 'batteryexchange') { const f = document.querySelector('#page-batteryexchange iframe'); if (f && !f.getAttribute('src')) f.src = f.dataset.src; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  const m = pageMeta[id] || {};
  document.getElementById('pageTitle').textContent = m.title || id;
  document.getElementById('pageSub').textContent = m.sub || '';
  loadPage(id);
}

function navOrdersFiltered(filter, el) {
  // Orders page hi kholo, par filter set karke
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-orders').classList.add('active');
  if (el) el.classList.add('active');

  const titles = {
    pending:   { title: 'Pending Orders',   sub: 'Production still pending' },
    completed: { title: 'Completed Orders',  sub: 'Production completed' }
  };
  const m = titles[filter] || {};
  document.getElementById('pageTitle').textContent = m.title || 'Orders';
  document.getElementById('pageSub').textContent = m.sub || '';

  orderFilter = filter;
  loadOrders();   // load hone ke baad renderOrders() filter apply karega

  // pipeline node highlight bhi karo (agar dikh raha hai)
  document.querySelectorAll('#ordersPipeline .pipe-node').forEach(n => n.classList.remove('active'));
  const pipeBtn = document.querySelector(`#ordersPipeline .pipe-node[onclick*="'${filter}'"]`);
  if (pipeBtn) pipeBtn.classList.add('active');
}

function loadPage(id) {
  if (id === 'admindashboard') loadAdminDashboard();
  else if (id === 'leads' || id === 'leaddash') loadLeads(id);
  else if (id === 'ordertracking') loadOrderTracking();
  else if (id === 'orders') loadOrders();
  else if (id === 'crm') loadCRM();
  else if (id === 'production') loadProduction();
  else if (id === 'dispatch') loadDispatch();
  else if (id === 'deliverychallan') loadDeliveryChallan();
  else if (id === 'mydashboard') loadMyDashboard();
  else if (id === 'customers') loadCustomers();
  else if (id === 'products') loadProducts();
  else if (id === 'suppliers') loadSuppliers();
  else if (id === 'users') loadUsers();
  else if (id === 'accounts') loadAccounts();
}

// ========== ADMIN DASHBOARD ==========
let adAllOrders = [], adAllProd = [], adAllAcc = [];

function parseDMY(s) {
  if (!s) return 0;

  // Date object (sheet se direct aata hai kabhi kabhi)
  if (s instanceof Date) return isNaN(s.getTime()) ? 0 : s.getTime();

  const str = String(s).trim();

  // dd/mm/yyyy  ya  dd-mm-yyyy
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const d = new Date(parseInt(m[3],10), parseInt(m[2],10) - 1, parseInt(m[1],10));
    return d.getTime() || 0;
  }

  // ISO with time (2026-08-21T18:30:00.000Z) — IST me convert karke date nikalo
  if (str.indexOf('T') > -1) {
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      const ist = new Date(dt.getTime() + (5.5 * 60 * 60 * 1000));  // UTC → IST
      return new Date(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()).getTime();
    }
  }

  // yyyy-mm-dd (bina time)
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(parseInt(m[1],10), parseInt(m[2],10) - 1, parseInt(m[3],10));
    return d.getTime() || 0;
  }

  // aakhri koshish — jo bhi Date samajh sake
  const d = new Date(str);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function loadAdminDashboard() {
  const fromEl = document.getElementById('ad-from-date');
  const toEl   = document.getElementById('ad-to-date');
  if (fromEl) fromEl.value = '';
  if (toEl)   toEl.value   = '';
  setAdRangeActiveBtn('all');
  api({ action: 'getOrders' }, or => {
    adAllOrders = (or.success && or.data) ? or.data : [];
    api({ action: 'getProduction' }, pr => {
      adAllProd = (pr.success && pr.data) ? pr.data : [];
      api({ action: 'getAccounts' }, ar => {
        adAllAcc = (ar.success && ar.data) ? ar.data : [];
        renderAdminDashboard();
      });
    });
  });
}

function toInputDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function setAdDateRange(preset) {
  const today = new Date();
  let from = null, to = null;
  if (preset === 'today') { from = today; to = today; }
  else if (preset === 'thismonth') { from = new Date(today.getFullYear(), today.getMonth(), 1); to = today; }
  else if (preset === 'lastmonth') {
    from = new Date(today.getFullYear(), today.getMonth()-1, 1);
    to   = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (preset === 'thisyear') { from = new Date(today.getFullYear(), 0, 1); to = today; }
  // 'all' → from/to stay null

  document.getElementById('ad-from-date').value = from ? toInputDateStr(from) : '';
  document.getElementById('ad-to-date').value   = to   ? toInputDateStr(to)   : '';
  setAdRangeActiveBtn(preset);
  renderAdminDashboard();
}

function setAdRangeActiveBtn(preset) {
  document.querySelectorAll('.ad-range-btn').forEach(b => b.classList.remove('btn-primary'));
  const btn = document.getElementById('ad-range-' + preset + '-btn');
  if (btn) btn.classList.add('btn-primary');
}

function applyAdDateFilter() {
  setAdRangeActiveBtn('custom'); // no matching button → just clears preset highlight
  renderAdminDashboard();
}

function renderAdminDashboard() {
  const fromVal = document.getElementById('ad-from-date')?.value;
  const toVal   = document.getElementById('ad-to-date')?.value;
  const fromTs  = fromVal ? new Date(fromVal).getTime() : null;
  const toTs    = toVal ? (new Date(toVal).getTime() + 24*60*60*1000 - 1) : null;

  const orders = adAllOrders.filter(o => {
    const t = parseDMY(o['Date']);
    if (fromTs !== null && t < fromTs) return false;
    if (toTs !== null && t > toTs) return false;
    return true;
  });
  const orderIDs = new Set(orders.map(o => o['Order ID']));

  const totalOrders = orders.length;
  const totalValue  = orders.reduce((s,o) => s + (parseFloat(o['Total Order Value']) || 0), 0);
  const totalQty    = orders.reduce((s,o) => s + (parseFloat(o['Total Qty']) || 0), 0);
  const avgValue    = totalOrders ? totalValue / totalOrders : 0;
  const pendingStatuses = ['Advance Pending','Pending','Request Full Payment','Credit'];
  const paymentPendingCount = orders.filter(o => pendingStatuses.includes(o['Payment Status']||'')).length;

  setText('ad-orders', totalOrders);
  setText('ad-value', '₹' + fmt(Math.round(totalValue)));
  setText('ad-qty', totalQty);
  setText('ad-avg', '₹' + fmt(Math.round(avgValue)));
  setText('ad-paypending', paymentPendingCount);

  const spMap = {};
  orders.forEach(o => {
    const sp = o['Sales Person Name'] || 'Unknown';
    if (!spMap[sp]) spMap[sp] = { name: sp, orders: 0, qty: 0, value: 0 };
    spMap[sp].orders++;
    spMap[sp].qty   += parseFloat(o['Total Qty']) || 0;
    spMap[sp].value += parseFloat(o['Total Order Value']) || 0;
  });
  renderSalesPersonPerf(Object.values(spMap).sort((a,b) => b.value - a.value));

  const sorted = [...orders].sort((a,b) => parseDMY(b['Date']) - parseDMY(a['Date']));
  renderRecentOrders(sorted.slice(0, 10));

  // Production/Accounts are linked via Order ID — scope them to the filtered order set
  const prod = adAllProd.filter(p => orderIDs.has(p['Order ID']));
  setText('ad-prod-pending',  prod.filter(p => (p['Status']||'Pending') === 'Pending').length);
  setText('ad-prod-inprog',   prod.filter(p => p['Status'] === 'In Progress').length);
  setText('ad-prod-done',     prod.filter(p => p['Status'] === 'Completed').length);
  setText('ad-prod-delayed',  prod.filter(p => p['Status'] === 'Delayed').length);

  const seen = {};
  let totalReceived = 0, totalBalance = 0;
  adAllAcc.forEach(a => {
    const oid = a['Order ID'];
    if (oid && orderIDs.has(oid) && !seen[oid]) {
      seen[oid] = true;
      totalReceived += parseFloat(a['Total Received']) || parseFloat(a['Received']) || 0;
      totalBalance  += parseFloat(a['Balance']) || 0;
    }
  });
  setText('ad-received', '₹' + fmt(Math.round(totalReceived)));
  setText('ad-balance', '₹' + fmt(Math.round(totalBalance)));
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function renderSalesPersonPerf(list) {
  const el = document.getElementById('ad-salesperson-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="empty-txt">No data</div></div>'; return; }
  el.innerHTML = list.map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);">
      <div style="font-size:13px;font-weight:600;color:var(--text);">${s.name}</div>
      <div style="display:flex;gap:18px;align-items:center;">
        <span style="font-size:12px;color:var(--text3);">${s.orders} orders</span>
        <span style="font-size:12px;color:var(--text3);">Qty: ${s.qty}</span>
        <span style="font-size:13px;font-weight:600;color:var(--accent);">₹${fmt(Math.round(s.value))}</span>
      </div>
    </div>`).join('');
}

function renderRecentOrders(list) {
  const el = document.getElementById('ad-recent-orders');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-txt">No orders</div></div></td></tr>'; return; }
  el.innerHTML = list.map(o => `
    <tr>
      <td class="td-id">${ordLink(o['Order ID'])}</td>
      <td>${o['Date']||''}</td>
      <td class="td-bold">${custLink(o['Customer Name'], o['Customer Phone'], o['Customer ID'])}</td>
      <td>${o['Sales Person Name']||''}</td>
      <td style="font-weight:600;color:var(--accent);">₹${fmt(o['Total Order Value']||0)}</td>
      <td>${orderStatusBadge(o['Order Status'])}</td>
      <td>${payStatusBadge(o['Payment Status'])}</td>
    </tr>`).join('');
}

// API
function erpTok() {
  try { return sessionStorage.getItem('erp_token') || sessionStorage.getItem('suite_token') || localStorage.getItem('erp_token') || ''; } catch (e) { return ''; }
}
function api(params, cb) {
  const key = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2,5);
  window[key] = function(res) {
    delete window[key];
    if (res && res.success === false && /^LOGIN:/.test(String(res.message || ''))) { toast('Session expired — please log in again', 'e'); setTimeout(logout, 1500); return; }
    if (res && res.needStaff) { erpStaffNeed(res.message); return; }   // naam + PIN chahiye
    cb(res);
  };
  const tok = erpTok();
  if (tok && !params.token) params = Object.assign({}, params, { token: tok });
  if (ERP_STAFF && !params.staffToken) params = Object.assign({}, params, { staffToken: ERP_STAFF.token });
  const qs = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const s = document.createElement('script');
  s.src = `${API}?${qs}&callback=${key}`;
  s.onerror = () => cb({ success: false, message: 'Network error' });
  document.body.appendChild(s);
}

// TOAST
function toast(msg, type='s') {
  const w = document.getElementById('toastWrap');
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  const ico = type==='s'?'✅':type==='e'?'❌':'⚠️';
  d.innerHTML = `<span>${ico}</span><span>${msg}</span>`;
  w.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// MODAL
function openModal(id) {
  document.getElementById(id).classList.add('show');
  if (id === 'orderModal') {
    if (!custCache.length) loadCustCache();
    loadMasterModels(() => {
      const body = document.getElementById('itemsBody');
      if (body && body.children.length === 0) { itemRowCount = 0; addItemRow(); }
      else refreshModelPickers();
    });
  }
}
function closeModal(id) {
  if (id === 'orderModal' && currentOrderID) {
    const ok = confirm(`Order ${currentOrderID} has already been created (items are saved). Closing keeps the order — you just won't be able to add more items. Close?`);
    if (!ok) return;
  }
  document.getElementById(id).classList.remove('show');
  if (id === 'orderModal') resetOrderForm();
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if (m.id === 'orderModal') return;   // sirf ✕ ya Create Order se band hoga
    if (e.target === m) m.classList.remove('show');
  });
});

// BADGE HELPERS
function orderStatusBadge(s) {
  if (!s) return '';
  const cl = s.startsWith('Advance') ? 'b-advance' : s.startsWith('PDC') ? 'b-pdc' : s.startsWith('Credit') ? 'b-credit' : 'b-pending';
  return `<span class="badge ${cl}">${s}</span>`;
}
function payStatusBadge(s) {
  if (!s) return '';
  const cl = s==='Paid'?'b-paid':s==='Advance Received'?'b-ready':s.includes('Delay')?'b-delay':'b-pending';
  return `<span class="badge ${cl}">${s}</span>`;
}
function corridorBadge(s) {
  if (!s) return '';
  const cl = s==='VIP' ? 'b-high' : 'b-low';
  return `<span class="badge ${cl}">${s}</span>`;
}
function fmt(n) { return Number(n||0).toLocaleString('en-IN'); }

function fmtDisplayDate(val) {
  if (!val) return '';
  if (typeof val === 'object' && val instanceof Date) {
    return val.getDate().toString().padStart(2,'0') + '/' +
           (val.getMonth()+1).toString().padStart(2,'0') + '/' +
           val.getFullYear();
  }
  var s = String(val);
  if (s.indexOf('T') > -1 || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
      return ist.getUTCDate().toString().padStart(2,'0') + '/' +
             (ist.getUTCMonth()+1).toString().padStart(2,'0') + '/' +
             ist.getUTCFullYear();
    }
  }
  return s;
}

function toInputDate(val) {
  if (!val) return '';
  var s = String(val);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    var parts = s.split('/');
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }
  if (s.indexOf('T') > -1) {
    var d = new Date(s);
    var ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
    return ist.getUTCFullYear() + '-' +
           (ist.getUTCMonth()+1).toString().padStart(2,'0') + '-' +
           ist.getUTCDate().toString().padStart(2,'0');
  }
  return s;
}

// ========== CUSTOMER AUTOFILL (New Order) ==========
let custCache = [];

function loadCustCache() {
  api({ action: 'getCustomers' }, r => {
    custCache = (r.success && r.data) ? r.data : [];
    accFromCustomers(r); accFillDatalist();   // Accounts mode + types (neeche ACCOUNTS)
  });
}

function onCustNameInput() {
  const val = (document.getElementById('o-cust')?.value || '').trim().toLowerCase();
  const match = val ? custCache.find(c => (c.CompanyName||'').trim().toLowerCase() === val) : null;
  accOrderPick(match);   // Account ID + contacts (ACCOUNTS)
  if (!match) return;
  const phoneEl = document.getElementById('o-phone');
  const cityEl  = document.getElementById('o-city');
  if (phoneEl && match.Phone) { phoneEl.value = match.Phone; clearErr(phoneEl); }
  if (cityEl && match.City)   { cityEl.value  = match.City;  clearErr(cityEl); }
  toast('Customer details filled in ✓');
}

// ========== ORDERS ==========
let allOrders = [], orderFilter = 'all';

function loadOrders() {
  api({ action: 'getOrders' }, r => {
    if (!r.success) { document.getElementById('ordersTable').innerHTML = `<tr><td colspan="13"><div class="empty"><div class="empty-ico">📋</div><div class="empty-txt">No orders found</div></div></td></tr>`; return; }
    let data = r.data || [];
    if (user.role === 'Sales' && user.salesName) {
      data = data.filter(o => (o['Sales Person Name']||'') === user.salesName);
    }
    allOrders = data;
    renderOrders();
  });
}

function isOrderCompleted(o) {
  const s = String(o['Final Status'] || '').toLowerCase();
  return s.includes('production complete') || s.includes('dispatched');
}

function renderOrders() {
  let data = allOrders;
  if (orderFilter === 'advance') data = allOrders.filter(o => (o['Order Status']||'').startsWith('Advance'));
  else if (orderFilter === 'pdc') data = allOrders.filter(o => (o['Order Status']||'').startsWith('PDC'));
  else if (orderFilter === 'credit') data = allOrders.filter(o => (o['Order Status']||'').startsWith('Credit'));
  else if (orderFilter === 'dispatched') data = allOrders.filter(o => (o['Order Status']||'').includes('Dispatched'));
  else if (orderFilter === 'completed') data = allOrders.filter(o => isOrderCompleted(o));
  else if (orderFilter === 'pending') data = allOrders.filter(o => !isOrderCompleted(o));

  const adv = allOrders.filter(o => (o['Order Status']||'').startsWith('Advance')).length;
  const dis = allOrders.filter(o => (o['Order Status']||'').includes('Dispatched')).length;
  const completed = allOrders.filter(o => isOrderCompleted(o)).length;
  document.getElementById('pc-all').textContent = allOrders.length;
  document.getElementById('pc-pending').textContent = allOrders.length - completed;
  document.getElementById('pc-completed').textContent = completed;
  document.getElementById('pc-adv').textContent = adv;
  document.getElementById('pc-dis').textContent = dis;

  const srch = (document.getElementById('orderSearch').value||'').toLowerCase();
  if (srch) data = data.filter(o => (o['Order ID']||'').toLowerCase().includes(srch) || (o['Customer Name']||'').toLowerCase().includes(srch) || (o['Sales Person Name']||'').toLowerCase().includes(srch));

  if (!data.length) { document.getElementById('ordersTable').innerHTML = `<tr><td colspan="13"><div class="empty"><div class="empty-ico">📋</div><div class="empty-txt">No orders found</div></div></td></tr>`; return; }

  document.getElementById('ordersTable').innerHTML = data.map(o => `
    <tr>
      <td class="td-id">${ordLink(o['Order ID'])}</td>
      <td>${fmtDisplayDate(o['Date']||'')}</td>
      <td class="td-bold">${o['Sales Person Name']||''}</td>
      <td class="td-bold">${custLink(o['Customer Name'], o['Customer Phone'], o['Customer ID'])}</td>
      <td>${o['City']||''}</td>
      <td style="text-align:right;">${fmt(o['Total Qty'])}</td>
      <td style="font-weight:600;color:var(--accent);">₹${fmt(o['Total Order Value']||0)}</td>
      <td>${o['Payment Mode']||''}</td>
      <td>${orderStatusBadge(o['Order Status'])}</td>
      <td>${payStatusBadge(o['Payment Status'])}</td>
      <td>${corridorBadge(o['Corridor']||o['Priority'])}</td>
      <td>${o['Assigned CRM']||''}</td>
      <td>${o['Final Status'] ? `<span class="badge b-processing">${o['Final Status']}</span>` : '—'}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn btn-sm btn-info" onclick='viewOrder(${JSON.stringify(o)})'>View</button>
        <button class="btn btn-sm" style="background:var(--accent-dim);color:var(--accent);border-color:var(--accent-b);" onclick='openTrackModal("${o['Order ID']||''}")'>🔍 Track</button>
        <button class="btn btn-sm btn-success" onclick='openPaymentModal("${o['Order ID']||''}","${(o['Customer Name']||'').replace(/"/g,'&quot;')}")' title="Payment Entry">💰</button>
        <button class="btn btn-sm" onclick='openPayDrawer(${JSON.stringify(o)})' title="Payment Slips">💳</button>
        <button class="btn btn-sm" onclick='printOrderRow(${JSON.stringify(o)})' title="Print / PDF">🖨️</button>
        ${(user.role === 'Admin' || user.role === 'Sales') ? `<button class="btn btn-sm btn-danger" onclick='confirmDeleteOrder("${o['Order ID']||''}")' title="Delete Order">🗑️</button>` : ''}
      </td>
    </tr>`).join('');
}

function filterOrders(f, el) {
  orderFilter = f;
  document.querySelectorAll('.pipe-node').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  renderOrders();
}

function searchOrders() { renderOrders(); }

// ========== DELETE ORDER (permanent) ==========
let pendingDeleteOrderID = '';

function confirmDeleteOrder(orderID) {
  pendingDeleteOrderID = orderID;
  document.getElementById('del-order-id-display').textContent = orderID;
  document.getElementById('del-order-id-input').value = '';
  document.getElementById('del-order-btn').disabled = true;
  openModal('deleteOrderModal');
}

function onDeleteOrderIdInput() {
  const val = document.getElementById('del-order-id-input').value.trim();
  document.getElementById('del-order-btn').disabled = (val !== pendingDeleteOrderID);
}

function submitDeleteOrder() {
  const typed = document.getElementById('del-order-id-input').value.trim();
  if (typed !== pendingDeleteOrderID) { toast('Order ID does not match', 'e'); return; }
  const btn = document.getElementById('del-order-btn');
  btn.disabled = true; btn.textContent = 'Deleting...';
  api({ action: 'deleteOrder', 'Order ID': pendingDeleteOrderID }, r => {
    btn.textContent = '🗑️ Delete Permanently';
    if (r.success) {
      toast('Order deleted: ' + pendingDeleteOrderID);
      closeModal('deleteOrderModal');
      pendingDeleteOrderID = '';
      loadOrders();
    } else {
      btn.disabled = false;
      toast(r.message || 'Delete failed', 'e');
    }
  });
}

function viewOrder(o) {
  currentEditOrder = o;
  document.getElementById('detailOrderID').textContent = 'Order: ' + (o['Order ID'] || '');
  const fields = [
    ['Order ID', o['Order ID']], ['Date', fmtDisplayDate(o['Date']||'')], ['Sales Person', o['Sales Person Name']],
    ['Customer Name', custLink(o['Customer Name'], o['Customer Phone'], o['Customer ID'])], ['Customer Phone', o['Customer Phone']], ['City', o['City']],
    ['Total Qty', o['Total Qty']], ['Charger Qty', o['Charger Qty']||'—'],
    ['Total Order Value', o['Total Order Value'] ? '₹'+Number(o['Total Order Value']).toLocaleString('en-IN') : '—'],
    ['Payment Mode', o['Payment Mode']], ['Order Status', o['Order Status']],
    ['Payment Status', o['Payment Status']],
    ['Corridor', o['Corridor']||o['Priority']||'—'],
    ['Suggested Transport', o['Suggested Transport']], ['Plan Dispatch Date', fmtDisplayDate(o['Plan Dispatch Date']||'')],
    ['Transport Charges', o['Transportation Charges']],
    ['Assigned CRM', o['Assigned CRM']], ['Final Status', o['Final Status']], ['Remarks', o['Order Remarks']]
  ];
  if (o['Lead ID']) fields.push(['Lead', recA('lead', o['Lead ID'], o['Lead ID'])]);   // kis lead se bana
  document.getElementById('orderDetailBody').innerHTML = `
    <div class="detail-grid">${fields.map(([l,v]) => `<div class="detail-item"><div class="detail-lbl">${l}</div><div class="detail-val">${v||'—'}</div></div>`).join('')}</div>
    <div style="font-size:12px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Order Items</div>
    <div id="detailItems"><div class="loading"><div class="spin"></div></div></div>`;
  openModal('orderDetailModal');
  loadSlips(o['Order ID']);

  api({ action: 'getItemsByOrder', 'Order ID': o['Order ID'] }, r => {
    if (!r.success || !r.data.length) { document.getElementById('detailItems').innerHTML = '<div class="empty"><div class="empty-txt">No items found</div></div>'; return; }
    const batteryItems = r.data.filter(i => (i['Battery Type']||'') !== 'Charger');
    let html = `<table class="items-table"><thead><tr><th>Item ID</th><th>Product Model</th><th>Battery Type</th><th>Price Type</th><th>Qty</th><th>Price/Unit (Ex GST)</th><th>Total (incl. 18% GST)</th><th>CRM</th></tr></thead><tbody>
      ${batteryItems.map(i=>`<tr><td class="td-id">${i['Item ID']||''}</td><td>${i['Product Model']||''}</td><td>${i['Battery Type']||''}</td><td>${i['Price Type']||'—'}</td><td>${i['Qty']||''}</td><td>₹${fmt(i['Price Unit (Excluding GST)'])}</td><td style="font-weight:600;color:var(--accent);">₹${fmt(Math.round(parseFloat(i['Total']||0)*1.18))}</td><td>${i['Assigned CRM']||''}</td></tr>`).join('')}
    </tbody></table>`;
    document.getElementById('detailItems').innerHTML = html;

    api({ action: 'getChargersByOrder', 'Order ID': o['Order ID'] }, cr => {
      if (cr.success && cr.data.length) {
        let chargerHTML = `<div style="margin-top:14px;">
          <div style="font-size:11px;font-weight:600;color:var(--warning);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">⚡ Charger Details</div>
          <table class="items-table">
            <thead><tr><th>Charger ID</th><th>Model</th><th>Qty</th><th>Price/Unit (₹)</th><th>Total incl. 5% GST (₹)</th><th>Date</th></tr></thead>
            <tbody>
              ${cr.data.map(c => `<tr>
                <td class="td-id">${c['Charger ID']||''}</td>
                <td>${c['Charger Model']||'—'}</td>
                <td>${c['Qty']||''}</td>
                <td>₹${fmt(c['Price/Unit']||0)}</td>
                <td>₹${fmt(c['Total']||0)}</td>
                <td>${fmtDisplayDate(c['Date']||'')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
        document.getElementById('detailItems').innerHTML += chargerHTML;
      }
    });
  });
}

// ========== MASTER MODELS (Common Sheet) ==========
let masterModels = [];

function loadMasterModels(cb) {
  if (masterModels.length) { if (cb) cb(); return; }
  api({ action: 'getMasterModels' }, r => {
    masterModels = (r.success && r.data) ? r.data : [];
    if (!r.success) toast('Could not load master models — only Other is available', 'w');
    if (cb) cb();
  });
}

function catToBtype(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('cycle'))                        return 'E-Cycle Battery';
  if (c.includes('rick') || c.includes('riksh'))  return 'E-Rikshaw Battery';
  if (c.includes('solar'))                        return 'Solar Battery';
  if (c.includes('invert'))                       return 'Inverter Battery';
  if (c.startsWith('3') || c.includes('three'))   return '3 Wheeler Battery';
  if (c.startsWith('2') || c.includes('two'))     return '2 Wheeler Battery';
  return '';
}

function modelPickerOptions() {
  const groups = {};
  masterModels.forEach(m => { const g = m.category || 'Other'; (groups[g] = groups[g] || []).push(m); });
  return '<option value="">Select model</option>' +
    Object.keys(groups).map(g => `<optgroup label="${g}">` +
      groups[g].map(m => `<option value="${m.code}">${m.code}${m.chemistry ? ' · ' + m.chemistry : ''}</option>`).join('') +
    '</optgroup>').join('') +
    '<option value="__other__">➕ Other (not in master)</option>';
}

function modelPickerHTML(prefix, id) {
  return `<select class="form-control" id="${prefix}-msel-${id}" onchange="onModelPick('${prefix}','${id}')" style="font-size:13px;">${modelPickerOptions()}</select>`;
}

function refreshModelPickers() {
  document.querySelectorAll('select[id*="-msel-"]').forEach(sel => {
    if (!sel.value) sel.innerHTML = modelPickerOptions();
  });
}

function onModelPick(prefix, id) {
  const sel     = document.getElementById(`${prefix}-msel-${id}`);
  const voltEl  = document.getElementById(`${prefix}-volt-${id}`);
  const ampEl   = document.getElementById(`${prefix}-amp-${id}`);
  const btEl    = document.getElementById(`${prefix}-btype-${id}`);
  const modelEl = document.getElementById(`${prefix}-model-${id}`);
  if (!sel || !modelEl) return;
  const val = sel.value;
  const isOther = val === '__other__';
  const m = masterModels.find(x => x.code === val);

  [voltEl, ampEl].forEach(el => {
    if (!el) return;
    el.readOnly = !isOther;
    el.style.background = isOther ? '' : 'var(--surface2)';
    if (!m) el.value = '';
  });
  modelEl.value = '';
  modelEl.dataset.source = isOther ? 'Other' : (m ? 'Master' : '');
  if (btEl) btEl.disabled = false;

  if (m) {
    voltEl.value  = m.voltage;
    ampEl.value   = m.capacity;
    modelEl.value = m.code;
    const bt = catToBtype(m.category);
    if (bt && btEl) { btEl.value = bt; btEl.disabled = true; }   // Master → lock
  }
  if (prefix === 'im') calcItemAuto(id); else calcEditItemAuto(id);
}

// ========== ORDER ITEMS LOGIC ==========
let itemRowCount = 1;

function isPerWattMode() { return false; }
function isVAMode() { return true; }

// ========== VALIDATION ==========
function markErr(el) { if (el) el.classList.add('field-error'); }
function clearErr(el) { if (el) el.classList.remove('field-error'); }
function clearErrIds(ids) { ids.forEach(id => clearErr(document.getElementById(id))); }
function isValidPhone(v) { return /^[6-9]\d{9}$/.test((v||'').trim()); }

// Order-level required fields check (Date, Sales Person, Customer Name/Phone/City, Payment Mode, Order Status, Payment Status)
function validateOrderMeta() {
  const fields = [
    ['o-date','Date'],
    ['o-sales','Sales Person'],
    ['o-cust','Customer Name'],
    ['o-phone','Customer Phone'],
    ['o-city','City'],
    ['o-paymode','Payment Mode'],
    ['o-status','Order Status'],
    ['o-paystatus','Payment Status']
  ];
  clearErrIds(fields.map(f => f[0]));
  clearErr(document.getElementById('o-plandispatch'));
  let firstBad = null;
  fields.forEach(([id, label]) => {
    const el = document.getElementById(id);
    const val = (el?.value || '').trim();
    if (!val) { markErr(el); if (!firstBad) firstBad = { el, msg: label + ' is required' }; }
  });
  const phoneEl  = document.getElementById('o-phone');
  const phoneVal = (phoneEl?.value || '').trim();
  if (phoneVal && !isValidPhone(phoneVal)) {
    markErr(phoneEl);
    if (!firstBad) firstBad = { el: phoneEl, msg: 'Enter a valid 10-digit phone number (starting with 6-9)' };
  }
  const dateVal     = document.getElementById('o-date')?.value;
  const dispatchVal = document.getElementById('o-plandispatch')?.value;
  if (dateVal && dispatchVal && dispatchVal < dateVal) {
    markErr(document.getElementById('o-plandispatch'));
    if (!firstBad) firstBad = { el: document.getElementById('o-plandispatch'), msg: 'Plan Dispatch Date cannot be before the Order Date' };
  }
  const planPayVal = document.getElementById('o-planpay')?.value;
  clearErr(document.getElementById('o-planpay'));
  if (dateVal && planPayVal && planPayVal < dateVal) {
    markErr(document.getElementById('o-planpay'));
    if (!firstBad) firstBad = { el: document.getElementById('o-planpay'), msg: 'Plan Payment Date cannot be before the Order Date' };
  }
  const transEl  = document.getElementById('o-transchg');
  clearErr(transEl);
  if (transEl && transEl.value !== '' && (parseFloat(transEl.value) < 0)) {
    markErr(transEl);
    if (!firstBad) firstBad = { el: transEl, msg: 'Transportation Charges cannot be negative' };
  }
  if (firstBad) { toast(firstBad.msg, 'e'); firstBad.el?.focus(); return false; }
  if (!accOrderCheck()) return false;   // Accounts: customer list se chuna ho
  return true;
}

// Edit Order modal validation (Customer Name/Phone/City, Payment Mode, Order/Payment Status, dispatch date, transport charges)
function validateEditOrderMeta() {
  const fields = [
    ['e-cust','Customer Name'],
    ['e-phone','Customer Phone'],
    ['e-city','City'],
    ['e-paymode','Payment Mode'],
    ['e-status','Order Status'],
    ['e-paystatus','Payment Status']
  ];
  clearErrIds(fields.map(f => f[0]));
  clearErr(document.getElementById('e-plandispatch'));
  clearErr(document.getElementById('e-transchg'));
  let firstBad = null;
  fields.forEach(([id, label]) => {
    const el = document.getElementById(id);
    const val = (el?.value || '').trim();
    if (!val) { markErr(el); if (!firstBad) firstBad = { el, msg: label + ' is required' }; }
  });
  const phoneEl  = document.getElementById('e-phone');
  const phoneVal = (phoneEl?.value || '').trim();
  if (phoneVal && !isValidPhone(phoneVal)) {
    markErr(phoneEl);
    if (!firstBad) firstBad = { el: phoneEl, msg: 'Enter a valid 10-digit phone number (starting with 6-9)' };
  }
  const origDate    = currentEditOrder ? toInputDate(currentEditOrder['Date'] || '') : '';
  const dispatchVal = document.getElementById('e-plandispatch')?.value;
  if (origDate && dispatchVal && dispatchVal < origDate) {
    markErr(document.getElementById('e-plandispatch'));
    if (!firstBad) firstBad = { el: document.getElementById('e-plandispatch'), msg: 'Plan Dispatch Date cannot be before the Order Date' };
  }
  const transEl = document.getElementById('e-transchg');
  if (transEl && transEl.value !== '' && (parseFloat(transEl.value) < 0)) {
    markErr(transEl);
    if (!firstBad) firstBad = { el: transEl, msg: 'Transportation Charges cannot be negative' };
  }
  if (firstBad) { toast(firstBad.msg, 'e'); firstBad.el?.focus(); return false; }
  return true;
}

// Item card-level validation used in saveAndAddMore() and submitOrder() last-card flow
function validateItemCard(id, prefix) {
  prefix = prefix || 'im';
  const qtyEl = document.getElementById(`${prefix}-qty-${id}`);
  const qty   = parseFloat(qtyEl?.value) || 0;
  clearErr(qtyEl);
  if (qty <= 0) { markErr(qtyEl); toast('Qty must be greater than 0', 'e'); qtyEl?.focus(); return false; }

  const ptEl = document.getElementById(`${prefix}-pricetype-${id}`);
  const pt   = ptEl?.value || '';
  if (pt === 'Per Watt') {
    const pwEl = document.getElementById(`${prefix}-perwatt-${id}`);
    clearErr(pwEl);
    if ((parseFloat(pwEl?.value)||0) <= 0) { markErr(pwEl); toast('Per Watt Price must be greater than 0', 'e'); pwEl?.focus(); return false; }
  } else {
    const priceEl = document.getElementById(`${prefix}-price-${id}`);
    clearErr(priceEl);
    if ((parseFloat(priceEl?.value)||0) <= 0) { markErr(priceEl); toast('Rate/Unit must be greater than 0', 'e'); priceEl?.focus(); return false; }
  }
  return true;
}

// Charger fields - agar checkbox ticked hai to model+qty+price sab bharna zaroori hai
function validateChargerFields() {
  const checkEl = document.getElementById('chargerCheck');
  if (!checkEl || !checkEl.checked) return true;
  const modelEl = document.getElementById('charger-model');
  const qtyEl   = document.getElementById('charger-qty');
  const priceEl = document.getElementById('charger-price');
  const model = modelEl?.value?.trim();
  const qty   = parseFloat(qtyEl?.value) || 0;
  const price = parseFloat(priceEl?.value) || 0;
  const anyFilled  = model || qty || price;
  const allFilled  = model && qty > 0 && price > 0;
  if (anyFilled && !allFilled) {
    if (!model) markErr(modelEl); else clearErr(modelEl);
    if (qty <= 0) markErr(qtyEl); else clearErr(qtyEl);
    if (price <= 0) markErr(priceEl); else clearErr(priceEl);
    toast('Fill in all charger details (Model, Qty, Price) or untick the checkbox', 'e');
    return false;
  }
  return true;
}

function markRequired(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const grp = el.closest('.form-group');
    const lbl = grp ? grp.querySelector('.form-label') : null;
    if (lbl && !lbl.querySelector('.req-mark')) lbl.innerHTML += ' <span class="req-mark">*</span>';
  });
}

// ========== SAVE + ADD MORE ==========
let currentOrderID = null;
let savedItemsData = [];
let itemSaveInProgress = false;

function saveAndAddMore() {
  const btn = document.getElementById('saveAddMoreBtn');
  const cards = document.querySelectorAll('#itemsBody [id^="item-row-"]');
  if (!cards.length) { toast('No items', 'e'); return; }
  const card = cards[cards.length - 1];
  const id   = card.id.replace('item-row-', '');

  const model = document.getElementById(`im-model-${id}`)?.value?.trim();
  if (!model) { toast('Select a model (for Other, fill in Voltage + Ampere)', 'e'); return; }

  const btype = document.getElementById(`im-btype-${id}`)?.value || '';
  if (!btype) { toast('Select a Battery Type', 'e'); return; }

  const pt      = document.getElementById(`im-pricetype-${id}`)?.value || '';
  if (!pt) { toast('Select a Price Type', 'e'); return; }
  if (!validateItemCard(id, 'im')) return;
  const isDup = savedItemsData.some(it => (it['Product Model']||'').trim().toLowerCase() === model.toLowerCase() && (it['Battery Type']||'') === btype);
  if (isDup) { toast('This item (Model + Battery Type) is already in the order — increase its Qty instead', 'e'); return; }
  const perWatt = pt === 'Per Watt';
  const volt    = parseFloat(document.getElementById(`im-volt-${id}`)?.value) || 0;
  const amp     = parseFloat(document.getElementById(`im-amp-${id}`)?.value) || 0;
  const pwPrice = perWatt ? (parseFloat(document.getElementById(`im-perwatt-${id}`)?.value) || 0) : 0;
  let pricePerUnit = 0;
  if (perWatt) pricePerUnit = volt * amp * pwPrice;
  else pricePerUnit = parseFloat(document.getElementById(`im-price-${id}`)?.value) || 0;

  const itemData = {
    'Product Model': model,
    'Battery Type':  document.getElementById(`im-btype-${id}`)?.value || '',
    'Qty':           document.getElementById(`im-qty-${id}`)?.value || 0,
    'Price Unit (Excluding GST)': pricePerUnit.toFixed ? pricePerUnit.toFixed(2) : pricePerUnit,
    'Total':         document.getElementById(`im-total-${id}`)?.value || 0,
    'Assigned CRM':  document.getElementById(`im-crm-${id}`)?.value || '',
    'Remarks':       document.getElementById(`im-remarks-${id}`)?.value || '',
    'Voltage':       volt || '',
    'Ampere':        amp || '',
    'Per Watt Price': perWatt ? (document.getElementById(`im-perwatt-${id}`)?.value || '') : '',
    'Price Type':    pt,
    'Warranty':      document.getElementById(`im-warranty-${id}`)?.value || '',
    'Model Source':  document.getElementById(`im-model-${id}`)?.dataset.source || ''
  };

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  itemSaveInProgress = true;

  const doSave = (orderID) => {
    api({ action: 'addOrderItem', 'Order ID': orderID, ...itemData }, r => {
      if (r.success) {
        savedItemsData.push({ ...itemData, itemID: r.itemID });
        renderSavedItems();
        card.remove();
        itemRowCount = 0;
        addItemRow();
        if (btn) { btn.disabled = false; btn.textContent = '✓ Save + Add More Item'; }
        itemSaveInProgress = false;
        toast('Item saved!');
        
        setTimeout(() => { document.getElementById('itemsBody')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
      } else {
        itemSaveInProgress = false;
        toast(r.message || 'Save failed', 'e');
        if (btn) { btn.disabled = false; btn.textContent = '✓ Save + Add More Item'; }
      }
    });
  };

  if (!currentOrderID) {
    if (!validateOrderMeta()) { itemSaveInProgress = false; if (btn) { btn.disabled = false; btn.textContent = '✓ Save + Add More Item'; } return; }
    const cust = document.getElementById('o-cust').value.trim();
    const todayVal = document.getElementById('o-date')?.value;
    const possibleDup = (allOrders||[]).find(o => (o['Customer Name']||'').trim().toLowerCase() === cust.toLowerCase() && toInputDate(o['Date']||'') === todayVal);
    if (possibleDup) toast(`⚠ ${cust} already has an order today (${possibleDup['Order ID']}) — check for a duplicate`, 'w');

    let totalQty = 0;
    savedItemsData.forEach(i => { totalQty += parseFloat(i['Qty']) || 0; });
    totalQty += parseFloat(document.getElementById(`im-qty-${id}`)?.value) || 0;

    const orderData = {
      action: 'addOrder',
      'Date': document.getElementById('o-date').value,
      'Sales Person Name': document.getElementById('o-sales').value,
      'Customer Name': cust, 'Lead ID': LD_ORDER_FOR || '',
      'Customer ID': document.getElementById('o-custid')?.value || '', 'Contact ID': document.getElementById('o-contact')?.value || '',
      'Customer Phone': document.getElementById('o-phone').value,
      'City': document.getElementById('o-city').value,
      'Total Qty': totalQty,
      'Payment Mode': document.getElementById('o-paymode').value,
      'Plan Payment Date': document.getElementById('o-planpay').value,
      'Order Status': document.getElementById('o-status').value,
      'Payment Status': document.getElementById('o-paystatus').value,
      'Suggested Transport': document.getElementById('o-transport').value,
      'Plan Dispatch Date': document.getElementById('o-plandispatch').value,
      'Order Remarks': document.getElementById('o-remarks').value,
      'Transportation Charges': document.getElementById('o-transchg').value,
      'Billing Address': document.getElementById('o-billing').value,
      'Shipping Address': document.getElementById('o-shipping').value,
      'Priority': document.getElementById('o-priority').value,
      'Corridor': document.getElementById('o-priority').value,
      'Assigned CRM': document.getElementById('o-crm').value,
      'Final Status': document.getElementById('o-finalstatus').value
    };

    api(orderData, r => {
      if (!r.success) {
        itemSaveInProgress = false;
        if (!r.success) { toast(r.message, 'e'); if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; } return; }
        if (btn) { btn.disabled = false; btn.textContent = '✓ Save + Add More Item'; }
        return;
      }
      currentOrderID = r.orderID;
      const badge = document.getElementById('currentOrderBadge');
      if (badge) { badge.style.display = 'inline-flex'; badge.textContent = '📋 ' + currentOrderID; }
      doSave(currentOrderID);
    });
  } else {
    doSave(currentOrderID);
  }
}

function renderSavedItems() {
  const list = document.getElementById('savedItemsList');
  const table = document.getElementById('savedItemsTable');
  if (!list || !table) return;
  if (!savedItemsData.length) { list.style.display = 'none'; return; }
  list.style.display = 'block';
  table.innerHTML = savedItemsData.map((item, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:11px;font-weight:700;color:var(--success);background:var(--success-dim);padding:2px 7px;border-radius:10px;">#${i+1}</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text);">${item['Product Model']}</div>
          <div style="font-size:11px;color:var(--text3);">${item['Battery Type']||''} | Qty: ${item['Qty']} | ₹${Number(item['Total']||0).toLocaleString('en-IN')}</div>
        </div>
      </div>
      <span style="font-size:11px;color:var(--success);">✓ Saved</span>
    </div>`).join('') + `<div style="padding:6px 14px;font-size:11px;color:var(--text3);">Total ${savedItemsData.length} item(s) saved</div>`;
}

function autoFillCRM() {
  const crmVal = document.getElementById('o-crm').value;
  document.querySelectorAll('[id^="im-crm-"]').forEach(el => { el.value = crmVal; });
}

function addItemRow() {
  itemRowCount++;
  const id     = itemRowCount;
  const crmVal = document.getElementById('o-crm').value;
  const body   = document.getElementById('itemsBody');
  const div    = document.createElement('div');
  div.id = `item-row-${id}`;
  div.style.cssText = 'background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px 14px 14px;position:relative;transition:border-color 0.15s;overflow:hidden;';

  const btypeOptions = ['2 Wheeler Battery','3 Wheeler Battery','Inverter Battery','Solar Battery','E-Rikshaw Battery','E-Cycle Battery']
    .map(o => `<option>${o}</option>`).join('');

  const lbl = (t, req) => `<label style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px;">${t}${req ? ' <span class="req-mark">*</span>' : ''}</label>`;

  div.innerHTML = `
    <div style="margin-bottom:10px;">
      <span style="font-size:11px;font-weight:600;color:var(--accent);">New Item</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>${lbl('Product Model', true)}${modelPickerHTML('im', id)}<input type="hidden" id="im-model-${id}"></div>
      <div>${lbl('Battery Type', true)}<select class="form-control" id="im-btype-${id}" style="font-size:13px;" onchange="autoGST(${id})"><option value="">Select type</option>${btypeOptions}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>${lbl('Price Type', true)}
        <select class="form-control" id="im-pricetype-${id}" style="font-size:13px;" onchange="onItemPriceTypeChange(${id})">
          <option value="">Select</option>
          <option>Absolute</option>
          <option>Per Watt</option>
          <option>Last Price</option>
        </select>
      </div>
      <div>${lbl('Voltage (V)')}<input class="form-control" id="im-volt-${id}" type="number" placeholder="48" oninput="calcItemAuto(${id})" readonly style="font-size:13px;background:var(--surface2);"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px;">
      <div>${lbl('Ampere (Ah)')}<input class="form-control" id="im-amp-${id}" type="number" placeholder="20" oninput="calcItemAuto(${id})" readonly style="font-size:13px;background:var(--surface2);"></div>
      <div>${lbl('Qty', true)}<input class="form-control" id="im-qty-${id}" type="number" placeholder="0" oninput="calcItemAuto(${id})" style="font-size:13px;"></div>
      <div id="im-pricefield-${id}">
        ${lbl('Rate/Unit (₹)', true)}<input class="form-control" id="im-price-${id}" type="number" placeholder="0" oninput="calcItemAuto(${id})" style="font-size:13px;">
      </div>
      <div id="im-pwfield-${id}" style="display:none;">
        ${lbl('Per Watt Price (₹)', true)}<input class="form-control" id="im-perwatt-${id}" type="number" placeholder="e.g. 12" oninput="calcItemAuto(${id})" style="font-size:13px;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
      <div>${lbl('Total (₹)')}<input class="form-control" id="im-total-${id}" readonly placeholder="Auto" style="background:var(--success-dim);color:var(--success);font-weight:600;font-size:13px;"></div>
      <div>${lbl('Warranty')}<input class="form-control" id="im-warranty-${id}" placeholder="e.g. 1 Year" style="font-size:13px;"></div>
      <div>${lbl('Assigned CRM')}<input class="form-control" id="im-crm-${id}" value="${crmVal}" placeholder="CRM name" style="font-size:13px;"></div>
      <div>${lbl('Remarks')}<input class="form-control" id="im-remarks-${id}" placeholder="Remarks..." style="font-size:13px;"></div>
    </div>`;

  body.appendChild(div);
}

function removeItemRow(id) {
  const row = document.getElementById(`item-row-${id}`);
  if (row) row.remove();
  updateOrderTotals();
}

function calcItemTotal(id) {
  const qty = parseFloat(document.getElementById(`im-qty-${id}`)?.value) || 0;
  const price = parseFloat(document.getElementById(`im-price-${id}`)?.value) || 0;
  const total = qty * price;
  const totalEl = document.getElementById(`im-total-${id}`);
  if (totalEl) totalEl.value = total ? total.toFixed(2) : '';
  updateOrderTotals();
}

// ========== CHARGER ==========
let savedChargersData = [];

function toggleCharger() {
  const checked = document.getElementById('chargerCheck').checked;
  document.getElementById('chargerFields').style.display = checked ? 'block' : 'none';
}

function calcCharger() {
  const qty   = parseFloat(document.getElementById('charger-qty')?.value) || 0;
  const price = parseFloat(document.getElementById('charger-price')?.value) || 0;
  const total = qty * price * 1.05;
  const el    = document.getElementById('charger-total');
  if (el) el.value = total ? total.toFixed(2) : '';
}

function saveAndAddMoreCharger() {
  const model = document.getElementById('charger-model')?.value?.trim();
  if (!model) { toast('Enter the Charger Model', 'e'); return; }
  const qty   = parseFloat(document.getElementById('charger-qty')?.value) || 0;
  if (!qty) { toast('Enter the Charger Qty', 'e'); return; }
  const price = parseFloat(document.getElementById('charger-price')?.value) || 0;
  if (!price) { toast('Enter the Charger Price', 'e'); return; }
  const total = parseFloat((qty * price * 1.05).toFixed(2));

  savedChargersData.push({ model, qty, price, total });
  renderSavedChargers();

  // Reset fields
  document.getElementById('charger-model').value = '';
  document.getElementById('charger-qty').value   = '';
  document.getElementById('charger-price').value = '';
  document.getElementById('charger-total').value = '';
  toast('Charger saved!');
}

function renderSavedChargers() {
  const list = document.getElementById('savedChargersList');
  if (!list) return;
  if (!savedChargersData.length) { list.style.display = 'none'; return; }
  list.style.display = 'block';
  list.innerHTML = '<div style="padding:6px 14px;background:var(--warning-dim);border-bottom:1px solid var(--warning-b);font-size:11px;font-weight:600;color:var(--warning);text-transform:uppercase;">⚡ Saved Chargers</div>' +
    savedChargersData.map((c, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-bottom:1px solid var(--border);">
        <div>
          <span style="font-size:11px;font-weight:700;color:var(--warning);background:var(--warning-dim);padding:2px 7px;border-radius:10px;">#${i+1}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text);margin-left:8px;">${c.model}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:8px;">Qty: ${c.qty} | ₹${fmt(c.total)}</span>
        </div>
        <span style="font-size:11px;color:var(--success);">✓ Saved</span>
      </div>`).join('') +
    `<div style="padding:5px 14px;font-size:11px;color:var(--text3);">Total ${savedChargersData.length} charger(s)</div>`;
}

function getChargerData() {
  // Abhi current form ka data lo agar kuch fill hai
  const model = document.getElementById('charger-model')?.value?.trim();
  const qty   = parseFloat(document.getElementById('charger-qty')?.value) || 0;
  const price = parseFloat(document.getElementById('charger-price')?.value) || 0;
  if (model && qty && price) {
    return { model, qty, price, total: parseFloat((qty * price * 1.05).toFixed(2)) };
  }
  return null;
}

function getAllChargersData() {
  const allChargers = [...savedChargersData];
  const current = getChargerData();
  if (current) allChargers.push(current);
  return allChargers;
}

function onItemPriceTypeChange(id) {
  const pt      = document.getElementById(`im-pricetype-${id}`)?.value || '';
  const pwField = document.getElementById(`im-pwfield-${id}`);
  const prField = document.getElementById(`im-pricefield-${id}`);
  if (pt === 'Per Watt') {
    if (pwField) pwField.style.display = 'block';
    if (prField) prField.style.display = 'none';
  } else {
    if (pwField) pwField.style.display = 'none';
    if (prField) prField.style.display = 'block';
  }
  calcItemAuto(id);
}

function calcItemAuto(id) {
  const pt   = document.getElementById(`im-pricetype-${id}`)?.value || '';
  const volt = parseFloat(document.getElementById(`im-volt-${id}`)?.value) || 0;
  const amp  = parseFloat(document.getElementById(`im-amp-${id}`)?.value) || 0;
  const qty  = parseFloat(document.getElementById(`im-qty-${id}`)?.value) || 0;

  const modelEl = document.getElementById(`im-model-${id}`);
  if (modelEl && modelEl.dataset.source === 'Other') modelEl.value = (volt && amp) ? `${volt}V-${amp}AH` : '';

  let total = 0;
  if (pt === 'Per Watt') {
    const pw = parseFloat(document.getElementById(`im-perwatt-${id}`)?.value) || 0;
    total = volt * amp * qty * pw;
  } else {
    const rate = parseFloat(document.getElementById(`im-price-${id}`)?.value) || 0;
    total = qty * rate;
  }

  const totalEl = document.getElementById(`im-total-${id}`);
  if (totalEl) totalEl.value = total ? total.toFixed(2) : '';
  updateOrderTotals();
}

function autoGST(id) { calcVAItem(id); }

function calcVAItem(id) {
  const volt = parseFloat(document.getElementById(`im-volt-${id}`)?.value) || 0;
  const amp  = parseFloat(document.getElementById(`im-amp-${id}`)?.value) || 0;
  const modelEl = document.getElementById(`im-model-${id}`);
  if (modelEl && modelEl.dataset.source === 'Other') modelEl.value = (volt && amp) ? `${volt}V-${amp}AH` : '';
  calcAbsoluteItem(id);
  updateOrderTotals();
}

function calcAbsoluteItem(id) {
  const qty   = parseFloat(document.getElementById(`im-qty-${id}`)?.value) || 0;
  const rate  = parseFloat(document.getElementById(`im-price-${id}`)?.value) || 0;
  const total = qty * rate;
  const totalEl = document.getElementById(`im-total-${id}`);
  if (totalEl) totalEl.value = total ? total.toFixed(2) : '';
  updateOrderTotals();
}

function updateOrderTotals() {
  let totalQty = 0, totalAmt = 0;
  document.querySelectorAll('[id^="im-qty-"]').forEach(el => {
    const id = el.id.replace('im-qty-', '');
    const row = document.getElementById(`item-row-${id}`);
    if (row) { totalQty += parseFloat(el.value) || 0; totalAmt += parseFloat(document.getElementById(`im-total-${id}`)?.value) || 0; }
  });
  document.getElementById('totalQtyDisplay').textContent = totalQty;
  document.getElementById('totalAmtDisplay').textContent = '₹' + fmt(totalAmt.toFixed(2));
}

function getItemRows() {
  const items = [];
  document.querySelectorAll('[id^="item-row-"]').forEach(row => {
    if (!row.id.startsWith('item-row-')) return;
    const id = row.id.replace('item-row-', '');
    const model = document.getElementById(`im-model-${id}`)?.value?.trim();
    if (model) {
      const pt = document.getElementById(`im-pricetype-${id}`)?.value || '';
      const volt = parseFloat(document.getElementById(`im-volt-${id}`)?.value) || 0;
      const amp  = parseFloat(document.getElementById(`im-amp-${id}`)?.value) || 0;
      let pricePerUnit = 0;
      if (pt === 'Per Watt') {
        const pw = parseFloat(document.getElementById(`im-perwatt-${id}`)?.value) || 0;
        pricePerUnit = volt * amp * pw;
      } else {
        pricePerUnit = parseFloat(document.getElementById(`im-price-${id}`)?.value) || 0;
      }
      items.push({
        'Product Model': model,
        'Battery Type': document.getElementById(`im-btype-${id}`)?.value || '',
        'Qty': document.getElementById(`im-qty-${id}`)?.value || 0,
        'Price Unit (Excluding GST)': pricePerUnit.toFixed ? pricePerUnit.toFixed(2) : pricePerUnit,
        'Total': document.getElementById(`im-total-${id}`)?.value || 0,
        'Assigned CRM': document.getElementById(`im-crm-${id}`)?.value || '',
        'Remarks': document.getElementById(`im-remarks-${id}`)?.value || '',
        'Voltage': volt || '',
        'Ampere': amp || '',
        'Per Watt Price': pt === 'Per Watt' ? (document.getElementById(`im-perwatt-${id}`)?.value || '') : '',
        'Model Source': document.getElementById(`im-model-${id}`)?.dataset.source || ''
      });
    }
  });
  return items;
}

// Aakhri item card adhoora to nahi? (kuch bhara hai lekin complete nahi)
function hasPartialItemCard() {
  const cards = document.querySelectorAll('#itemsBody [id^="item-row-"]');
  if (!cards.length) return false;
  const card = cards[cards.length - 1];
  const id   = card.id.replace('item-row-', '');

  const model = document.getElementById(`im-model-${id}`)?.value?.trim() || '';
  const btype = document.getElementById(`im-btype-${id}`)?.value || '';
  const pt    = document.getElementById(`im-pricetype-${id}`)?.value || '';
  const volt  = parseFloat(document.getElementById(`im-volt-${id}`)?.value) || 0;
  const amp   = parseFloat(document.getElementById(`im-amp-${id}`)?.value) || 0;
  const qty   = parseFloat(document.getElementById(`im-qty-${id}`)?.value) || 0;
  const price = parseFloat(document.getElementById(`im-price-${id}`)?.value) || 0;
  const pw    = parseFloat(document.getElementById(`im-perwatt-${id}`)?.value) || 0;

  const anyFilled = model || btype || pt || volt || amp || qty || price || pw;
  if (!anyFilled) return false;   // bilkul khaali card = theek hai, skip hoga

  // Kuch bhara hai — to poora complete hona chahiye
  const complete = model && btype && pt && qty > 0 && (pt === 'Per Watt' ? pw > 0 : price > 0);
  return !complete;
}

function submitOrder() {
  const btn = document.getElementById('submitOrderBtn');
  if (btn && btn.disabled) return;
  if (itemSaveInProgress) { toast('Saving item — wait a second', 'w'); return; }
  if (hasPartialItemCard()) {
    toast('The last item is incomplete — fill it in fully (or leave it blank), then click Create Order', 'e');
    return;
  }

  if (currentOrderID) {
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    if (!validateChargerFields()) { if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; } return; }
    const cards = document.querySelectorAll('#itemsBody [id^="item-row-"]');
    const finishOrder = () => {
      const chargers = getAllChargersData();
      if (chargers.length) {
        let pendingC = chargers.length;
        chargers.forEach(charger => {
          api({ action: 'addChargerItem', 'Order ID': currentOrderID, 'Charger Model': charger.model, 'Qty': charger.qty, 'Price/Unit': charger.price, 'Total': charger.total }, () => {
            pendingC--;
            if (pendingC === 0) {
              toast('Order complete: ' + currentOrderID);
              currentOrderID = null; closeModal('orderModal'); resetOrderForm(); loadOrders();
            }
          });
        });
      } else {
        toast('Order complete: ' + currentOrderID);
        currentOrderID = null; closeModal('orderModal'); resetOrderForm(); loadOrders();
      }
    };

    if (cards.length) {
      const card = cards[cards.length - 1];
      const id = card.id.replace('item-row-', '');
      const model = document.getElementById(`im-model-${id}`)?.value?.trim();
      if (model) {
        if (!validateItemCard(id, 'im')) { if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; } return; }
        const btypeChk = document.getElementById(`im-btype-${id}`)?.value || '';
        const isDup = savedItemsData.some(it => (it['Product Model']||'').trim().toLowerCase() === model.toLowerCase() && (it['Battery Type']||'') === btypeChk);
        if (isDup) { toast('This item (Model + Battery Type) is already in the order — increase its Qty instead', 'e'); if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; } return; }
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
        const pt = document.getElementById(`im-pricetype-${id}`)?.value || '';
        const volt = parseFloat(document.getElementById(`im-volt-${id}`)?.value) || 0;
        const amp  = parseFloat(document.getElementById(`im-amp-${id}`)?.value) || 0;
        let pricePerUnit = pt === 'Per Watt'
          ? volt * amp * (parseFloat(document.getElementById(`im-perwatt-${id}`)?.value) || 0)
          : parseFloat(document.getElementById(`im-price-${id}`)?.value) || 0;
        const itemData = {
          'Product Model': model,
          'Battery Type': document.getElementById(`im-btype-${id}`)?.value || '',
          'Qty': document.getElementById(`im-qty-${id}`)?.value || 0,
          'Price Unit (Excluding GST)': pricePerUnit.toFixed(2),
          'Total': document.getElementById(`im-total-${id}`)?.value || 0,
          'Assigned CRM': document.getElementById(`im-crm-${id}`)?.value || '',
          'Remarks': document.getElementById(`im-remarks-${id}`)?.value || '',
          'Voltage': volt || '',
          'Ampere': amp || '',
          'Price Type': pt,
          'Warranty': document.getElementById(`im-warranty-${id}`)?.value || '',
          'Model Source': document.getElementById(`im-model-${id}`)?.dataset.source || ''
        };
        api({ action: 'addOrderItem', 'Order ID': currentOrderID, ...itemData }, () => {
          finishOrder();
        });
        return;
      }
    }
    finishOrder();
    return;
  }

  if (!validateOrderMeta()) return;
  if (!validateChargerFields()) return;
  const cust = document.getElementById('o-cust').value.trim();
  let itemsValid = true;
  const seenCombos = [];
  document.querySelectorAll('[id^="item-row-"]').forEach(row => {
    if (!row.id.startsWith('item-row-') || !itemsValid) return;
    const id = row.id.replace('item-row-', '');
    const model = document.getElementById(`im-model-${id}`)?.value?.trim();
    if (model && !validateItemCard(id, 'im')) { itemsValid = false; return; }
    if (model) {
      const btypeChk = document.getElementById(`im-btype-${id}`)?.value || '';
      const comboKey = model.toLowerCase() + '|' + btypeChk;
      if (seenCombos.includes(comboKey)) { toast('This item (Model + Battery Type) is already in the order — increase its Qty instead', 'e'); itemsValid = false; return; }
      seenCombos.push(comboKey);
    }
  });
  if (!itemsValid) return;
  const todayVal2 = document.getElementById('o-date')?.value;
  const possibleDup2 = (allOrders||[]).find(o => (o['Customer Name']||'').trim().toLowerCase() === cust.toLowerCase() && toInputDate(o['Date']||'') === todayVal2);
  if (possibleDup2) toast(`⚠ ${cust} already has an order today (${possibleDup2['Order ID']}) — check for a duplicate`, 'w');
  const items = getItemRows();
  if (items.length === 0) { toast('Save at least one item first', 'e'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  let totalQty = 0;
  document.querySelectorAll('[id^="im-qty-"]').forEach(el => { totalQty += parseFloat(el.value) || 0; });

  const orderData = {
    action: 'addOrder',
    'Date': document.getElementById('o-date').value,
    'Sales Person Name': document.getElementById('o-sales').value,
    'Customer Name': cust, 'Lead ID': LD_ORDER_FOR || '',
    'Customer ID': document.getElementById('o-custid')?.value || '', 'Contact ID': document.getElementById('o-contact')?.value || '',
    'Customer Phone': document.getElementById('o-phone').value,
    'City': document.getElementById('o-city').value,
    'Total Qty': totalQty,
    'Payment Mode': document.getElementById('o-paymode').value,
    'Plan Payment Date': document.getElementById('o-planpay').value,
    'Order Status': document.getElementById('o-status').value,
    'Payment Status': document.getElementById('o-paystatus').value,
    'Suggested Transport': document.getElementById('o-transport').value,
    'Plan Dispatch Date': document.getElementById('o-plandispatch').value,
    'Order Remarks': document.getElementById('o-remarks').value,
    'Transportation Charges': document.getElementById('o-transchg').value,
    'Billing Address': document.getElementById('o-billing').value,
    'Shipping Address': document.getElementById('o-shipping').value,
    'Priority': document.getElementById('o-priority').value,
    'Assigned CRM': document.getElementById('o-crm').value,
    'Final Status': document.getElementById('o-finalstatus').value
  };

  api(orderData, r => {
    if (!r.success) { toast(r.message, 'e'); return; }
    const orderID = r.orderID;
    toast('Order created: ' + orderID);

    if (items.length === 0) { closeModal('orderModal'); resetOrderForm(); loadOrders(); return; }

    let pending = items.length;
    let firstItem = true;
    items.forEach(item => {
      api({ action: 'addOrderItem', 'Order ID': orderID, ...item }, ir => {
        pending--;
        if (firstItem && ir.success) {
          firstItem = false;
        }
        if (pending === 0) {
          const charger = getChargerData();
          if (charger) {
            api({ action: 'addChargerItem', 'Order ID': orderID, 'Charger Model': charger.model, 'Qty': charger.qty, 'Price/Unit': charger.price, 'Total': charger.total }, () => { closeModal('orderModal'); resetOrderForm(); loadOrders(); });
          } else {
            closeModal('orderModal'); resetOrderForm(); loadOrders();
          }
        }
      });
    });
  });
}

function resetOrderForm() {
  currentOrderID = null;
  LD_ORDER_FOR = ''; const ldn = document.getElementById('ldOrderNote'); if (ldn) ldn.remove();
  accOrderPick(null);
  savedItemsData = [];
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  const badge = document.getElementById('currentOrderBadge');
  if (badge) badge.style.display = 'none';
  const savedList = document.getElementById('savedItemsList');
  if (savedList) savedList.style.display = 'none';
  const btn = document.getElementById('submitOrderBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; }
  ['o-cust','o-sales'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  document.getElementById('perWattField').style.display = 'none';
  savedChargersData = [];
  const savedChargersList = document.getElementById('savedChargersList');
  if (savedChargersList) savedChargersList.style.display = 'none';
  const chargerCheck = document.getElementById('chargerCheck');
  if (chargerCheck) chargerCheck.checked = false;
  document.getElementById('chargerFields').style.display = 'none';
  document.getElementById('charger-model').value = '';
  document.getElementById('charger-qty').value = '';
  document.getElementById('charger-price').value = '';
  document.getElementById('charger-total').value = '';
  ['o-date','o-sales','o-cust','o-phone','o-city','o-paymode','o-planpay',
   'o-status','o-paystatus','o-transport','o-plandispatch','o-transchg',
  'o-crm','o-finalstatus','o-remarks','o-billing','o-shipping'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('itemsBody').innerHTML = '';
  itemRowCount = 0;
  addItemRow();
  document.getElementById('totalQtyDisplay').textContent = '0';
  document.getElementById('totalAmtDisplay').textContent = '₹0';
}

// ========== CRM ==========
let allCRM = [];
let crmBilledMap = {};

function loadCRM() {
  api({ action: 'getCRMBundle' }, r => {
    if (!r.success) { document.getElementById('crmTable').innerHTML = `<tr><td colspan="33"><div class="empty"><div class="empty-ico">🎯</div><div class="empty-txt">No CRM records</div></div></td></tr>`; return; }
    allCRM = r.crm || [];
    document.getElementById('crm-total').textContent = allCRM.length;
    document.getElementById('crm-prod').textContent = allCRM.filter(c => (c['Current Stage']||'').toLowerCase().includes('production')).length;
    document.getElementById('crm-dispatch').textContent = allCRM.filter(c => (c['Current Stage']||'').toLowerCase().includes('dispatch')).length;
    document.getElementById('crm-paid').textContent = allCRM.filter(c => c['Payment Received Actual']).length;
    crmBilledMap = r.billed || {};
    renderCRM(allCRM);
  });
}

function renderCRM(data) {
  if (!data.length) { document.getElementById('crmTable').innerHTML = '<tr><td colspan="32"><div class="empty"><div class="empty-ico">&#x1F3AF;</div><div class="empty-txt">No records</div></div></td></tr>'; return; }

  // Order wise group karo
  const crmGroups = {};
  const crmSeq = [];
  data.forEach(c => {
    const oid = c['Order ID'] || '';
    if (!crmGroups[oid]) { crmGroups[oid] = []; crmSeq.push(oid); }
    crmGroups[oid].push(c);
  });

  let crmRows = '';
  let crmSr = 1;
  crmSeq.forEach(orderID => {
    const items = crmGroups[orderID];
    const count = items.length;
    const first = items[0];

    items.forEach((c, idx) => {
      const isFirst = idx === 0;
      const bt = (isFirst && crmSr > 1) ? 'border-top:2px solid var(--border2);' : '';

      const orderCells = isFirst ? `
        <td class="td-id" rowspan="${count}" style="vertical-align:middle;${bt}">${orderID}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${fmtDisplayDate(first['Order Date']||'')}</td>
        <td class="td-bold" rowspan="${count}" style="vertical-align:middle;${bt}">${first['Customer Name']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Customer No']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Sales Person']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Payment Mode']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${fmtDisplayDate(first['Plan Payment Date']||'')}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Payment Status']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${fmtDisplayDate(first['Plan Dispatch Date']||'')}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">
          <button class="btn btn-sm btn-success" onclick='openPaymentModal("${orderID}","${first['Customer Name']||''}")' title="Payments">💰</button>
        </td>
      ` : '';

      crmRows += `<tr>
        <td style="${bt}">${crmSr++}</td>
        <td class="td-id" style="${bt}">${c['Item ID']||''}</td>
        ${orderCells}
        <td style="${bt}">${c['Product Type']||''}</td>
        <td style="${bt}">${c['Product Model']||''}</td>
        <td style="${bt}">${c['Qty']||''}</td>
        <td style="${bt}">${crmBilledMap[c['Item ID']] ? `<span style="color:var(--purple);font-weight:600;">🧾 ${crmBilledMap[c['Item ID']]}</span>` : '—'}</td>
        <td style="${bt}">${fmtDisplayDate(c['Production Start Plan']||'')}</td>
        <td style="${bt}">${fmtDisplayDate(c['Production Start Actual']||'')}</td>
        <td style="${bt}">${fmtDisplayDate(c['Production Complete Plan']||'')}</td>
        <td style="${bt}">${fmtDisplayDate(c['Production Complete Actual']||'')}</td>
        <td style="${bt}">${c['Production Delay']?'<span class="badge b-delay">'+c['Production Delay']+'</span>':''}</td>
        <td style="${bt}">${c['Payment Received Plan']||''}</td>
        <td style="${bt}">${c['Payment Received Actual']||''}</td>
        <td style="${bt}">${c['Payment Delay']?'<span class="badge b-delay">'+c['Payment Delay']+'</span>':''}</td>
        <td style="${bt}">${c['Ready to Dispatch Plan']||''}</td>
        <td style="${bt}">${c['Ready to Dispatch Actual']||''}</td>
        <td style="${bt}">${c['Dispatch Delay']?'<span class="badge b-delay">'+c['Dispatch Delay']+'</span>':''}</td>
        <td style="${bt}">${fmtDisplayDate(c['Billing Docs Actual']||'')}</td>
        <td style="${bt}">${c['Remarks']||''}</td>
        <td style="${bt}"><button class="btn btn-sm btn-warning" onclick='openCRMUpdate(${JSON.stringify(c)})'>Update</button></td>
      </tr>`;
    });
  });
  document.getElementById('crmTable').innerHTML = crmRows;
}

function searchCRM() {
  const q = document.getElementById('crmSearch').value.toLowerCase();
  renderCRM(q ? allCRM.filter(c => (c['Order ID']||'').toLowerCase().includes(q) || (c['Customer Name']||'').toLowerCase().includes(q)) : allCRM);
}

function openCRMUpdate(c) {
  document.getElementById('cu-orderid').value = c['Order ID']||'';
  document.getElementById('cu-stage').value = c['Current Stage']||'';
  document.getElementById('cu-nextstage').value = c['Next Stage']||'';
  document.getElementById('cu-followup').value = c['Follow-up With']||'';
  document.getElementById('cu-ps-plan').value = toInputDate(c['Production Start Plan']||'');
  document.getElementById('cu-ps-actual').value = toInputDate(c['Production Start Actual']||'');
  document.getElementById('cu-pc-plan').value = toInputDate(c['Production Complete Plan']||'');
  document.getElementById('cu-pc-actual').value = toInputDate(c['Production Complete Actual']||'');
  document.getElementById('cu-prod-delay').value = c['Production Delay']||'';
  document.getElementById('cu-pay-plan').value = toInputDate(c['Payment Received Plan']||'');
  document.getElementById('cu-pay-actual').value = toInputDate(c['Payment Received Actual']||'');
  document.getElementById('cu-pay-delay').value = c['Payment Delay']||'';
  document.getElementById('cu-disp-plan').value = toInputDate(c['Ready to Dispatch Plan']||'');
  document.getElementById('cu-disp-actual').value = toInputDate(c['Ready to Dispatch Actual']||'');
  document.getElementById('cu-disp-delay').value = c['Dispatch Delay']||'';
  document.getElementById('cu-remarks').value = c['Remarks']||'';
  openModal('crmUpdateModal');
}

function submitCRMUpdate() {
  var dateFields = ['cu-ps-plan','cu-ps-actual','cu-pc-plan','cu-pc-actual',
                    'cu-pay-plan','cu-pay-actual','cu-disp-plan','cu-disp-actual'];
  var fieldMap = {
    'Current Stage':'cu-stage','Next Stage':'cu-nextstage','Follow-up With':'cu-followup',
    'Production Start Plan':'cu-ps-plan','Production Start Actual':'cu-ps-actual',
    'Production Complete Plan':'cu-pc-plan','Production Complete Actual':'cu-pc-actual',
    'Production Delay':'cu-prod-delay','Payment Received Plan':'cu-pay-plan',
    'Payment Received Actual':'cu-pay-actual','Payment Delay':'cu-pay-delay',
    'Ready to Dispatch Plan':'cu-disp-plan','Ready to Dispatch Actual':'cu-disp-actual',
    'Dispatch Delay':'cu-disp-delay','Remarks':'cu-remarks'
  };
  var params = { action: 'updateCRM', 'Order ID': document.getElementById('cu-orderid').value };
  Object.entries(fieldMap).forEach(([key, id]) => {
    var el = document.getElementById(id);
    if (!el) return;
    var val = el.value;
    if (!val) return;
    if (dateFields.includes(id)) val = fmtDisplayDate(val);
    params[key] = val;
  });
  api(params, r => {
    if (r.success) { toast('CRM updated!'); closeModal('crmUpdateModal'); loadCRM(); }
    else toast(r.message, 'e');
  });
}

// ========== PAYMENTS MODAL ==========
let currentPaymentOrderID = '';
let currentPaymentCustName = '';


function openPaymentModal(orderID, custName) {
  currentPaymentOrderID = orderID;
  currentPaymentCustName = custName;
  document.getElementById('pm-orderid-display').textContent = orderID;
  document.getElementById('pm-cust-display').textContent = custName;
  document.getElementById('pm-amount').value = '';
  document.getElementById('pm-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('pm-mode').value = '';
  document.getElementById('pm-ref').value = '';
  document.getElementById('pm-remarks').value = '';
  document.getElementById('pm-total-received').textContent = '₹0';
  document.getElementById('pm-balance').textContent = '—';
  document.getElementById('pm-orderval-display').textContent = '—';
  openModal('paymentModal');
  const orderData = allOrders.find(o => o['Order ID'] === orderID);
  if (orderData && orderData['Total Order Value']) {
    document.getElementById('pm-orderval-display').textContent = '₹' + fmt(orderData['Total Order Value']);
    loadPaymentsList(orderID);
  } else {
    api({ action: 'getOrders' }, r => {
      const o = (r.data||[]).find(x => x['Order ID'] === orderID);
      if (o) document.getElementById('pm-orderval-display').textContent = '₹' + fmt(o['Total Order Value']||0);
      loadPaymentsList(orderID);
    });
  }
}

function loadPaymentsList(orderID) {
  const el = document.getElementById('pm-payments-list');
  el.innerHTML = '<div class="loading"><div class="spin"></div></div>';
  api({ action: 'getPayments', 'Order ID': orderID }, r => {
    if (!r.success || !r.data.length) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">No payment entries yet</div>';
      document.getElementById('pm-total-received').textContent = '₹0';
      document.getElementById('pm-balance').textContent = document.getElementById('pm-orderval-display').textContent;
      return;
    }
    const total = r.totalReceived || 0;
    document.getElementById('pm-total-received').textContent = '₹' + fmt(total);
    const orderVal = parseFloat((document.getElementById('pm-orderval-display').textContent||'').replace(/[₹,]/g,'')) || 0;
    const balance = orderVal - total;
    document.getElementById('pm-balance').textContent = orderVal ? '₹' + fmt(balance) : '—';
    el.innerHTML = r.data.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">💵</span>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--success);">₹${fmt(p['Amount']||0)}</div>
            <div style="font-size:11px;color:var(--text3);">${p['Date']||''} · ${p['Mode']||''} ${p['Reference']?'· '+p['Reference']:''}</div>
            ${p['Remarks']?`<div style="font-size:11px;color:var(--text3);">${p['Remarks']}</div>`:''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text3);">${p['Payment ID']||''}</span>
          <button class="btn btn-sm btn-danger" title="Delete payment" onclick="deletePayment('${p['Payment ID']||''}','${orderID}','${fmt(p['Amount']||0)}')">🗑️</button>
        </div>
      </div>`).join('');
  });
}

function submitPayment() {
  const btn = document.getElementById('pm-submit-btn');
  const amount = parseFloat(document.getElementById('pm-amount').value) || 0;
  if (!amount) { toast('Enter the amount', 'e'); return; }
  const mode = document.getElementById('pm-mode').value;
  if (!mode) { toast('Select a payment mode', 'e'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  api({
    action: 'addPayment',
    'Order ID': currentPaymentOrderID,
    'Amount': amount,
    'Date': document.getElementById('pm-date').value,
    'Mode': mode,
    'Reference': document.getElementById('pm-ref').value,
    'Remarks': document.getElementById('pm-remarks').value,
    'Added By': user.name || ''
  }, r => {
    if (btn) { btn.disabled = false; btn.textContent = '+ Add Payment'; }
    if (r.success) {
      toast('Payment added!');
      document.getElementById('pm-amount').value = '';
      document.getElementById('pm-ref').value = '';
      document.getElementById('pm-remarks').value = '';
      loadPaymentsList(currentPaymentOrderID);
    } else {
      toast(r.message || 'Failed', 'e');
    }
  });
}

function deletePayment(paymentID, orderID, amountLabel) {
  if (!paymentID) { toast('Payment ID not found', 'e'); return; }
  if (!confirm(`Delete payment ₹${amountLabel} (${paymentID})? This cannot be undone.`)) return;
  api({ action: 'deletePayment', 'Payment ID': paymentID, 'Order ID': orderID }, r => {
    if (r.success) {
      toast('Payment deleted');
      loadPaymentsList(orderID);   // list + Total Received + Balance refresh
    } else {
      toast(r.message || 'Delete failed', 'e');
    }
  });
}

function uploadPaymentSlip(file, orderID, custName, cb) {
  const status = document.getElementById('pm-slip-status');
  const zone   = document.getElementById('pm-slip-zone');
  if (status) { status.style.display = 'block'; status.style.color = 'var(--warning)'; status.textContent = 'Uploading screenshot...'; }
  const ext      = file.name.split('.').pop();
  const fileName = orderID + '_' + (custName||'').replace(/[^a-zA-Z0-9]/g,'') + '_' + Date.now() + '.' + ext;
  const mimeType = file.type || 'image/jpeg';
  api({ action: 'getAccessToken' }, tokenRes => {
    const token = tokenRes?.token || '';
    if (!token) { if (status) { status.style.color = 'var(--error)'; status.textContent = 'Auth error'; } if (cb) cb(); return; }
    api({ action: 'getUploadUrl', orderID, fileName, mimeType }, folderRes => {
      if (!folderRes.success) { if (status) { status.style.color = 'var(--error)'; status.textContent = 'Folder error'; } if (cb) cb(); return; }
      const folderId = folderRes.folderId;
      const meta = JSON.stringify({ name: fileName, parents: [folderId] });
      const form = new FormData();
      form.append('metadata', new Blob([meta], { type: 'application/json' }));
      form.append('file', new Blob([file], { type: mimeType }));
      fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: form
      })
      .then(r => r.json())
      .then(data => {
        if (data.id) {
          fetch('https://www.googleapis.com/drive/v3/files/' + data.id + '/permissions', {
            method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
          });
          if (status) { status.style.display = 'block'; status.style.color = 'var(--success)'; status.textContent = '✅ Uploaded!'; }
          document.getElementById('pm-slip-input').value = '';
          const nameEl = document.getElementById('pm-slip-name');
          const uploadBtn = document.getElementById('pm-slip-upload-btn');
          if (nameEl) nameEl.textContent = '';
          if (uploadBtn) uploadBtn.style.display = 'none';
        } else {
          if (status) { status.style.color = 'var(--error)'; status.textContent = 'Upload failed'; }
        }
        if (cb) cb();
      })
      .catch(err => { if (status) { status.style.color = 'var(--error)'; status.textContent = err.message; } if (cb) cb(); });
    });
  });
}

function onPmSlipSelect() {
  const file = document.getElementById('pm-slip-input').files[0];
  if (!file) return;
  const nameEl = document.getElementById('pm-slip-name');
  const uploadBtn = document.getElementById('pm-slip-upload-btn');
  const status = document.getElementById('pm-slip-status');
  if (nameEl) nameEl.textContent = file.name;
  if (uploadBtn) uploadBtn.style.display = 'inline-flex';
  if (status) { status.style.display = 'none'; status.textContent = ''; }
}

function uploadPmSlipNow() {
  const file = document.getElementById('pm-slip-input').files[0];
  if (!file) return;
  uploadPaymentSlip(file, currentPaymentOrderID, currentPaymentCustName, () => {});
}

// ========== PRODUCTION ==========
// ========== PRODUCTION ==========
let allProd = [], prodFilter = 'all', prodBilledMap = {};

function prodLiveStatus(p) {
  const t = parseFloat(p['Qty']) || 0, q = parseFloat(p['Produced Qty']) || 0;
  return (t > 0 && q >= t) ? 'Completed' : (q > 0 || p['Production Start Actual']) ? 'In Progress' : 'Pending';
}

function loadProduction() {
  api({ action: 'getProductionBundle' }, r => {
    if (!r.success) { document.getElementById('prodTable').innerHTML = `<tr><td colspan="22"><div class="empty"><div class="empty-ico">⚙️</div><div class="empty-txt">No production records</div></div></td></tr>`; return; }
    allProd = r.production || [];
    prodBilledMap = r.billed || {};
    const pendingCount = allProd.filter(p => prodLiveStatus(p) === 'Pending').length;
    const inprogCount  = allProd.filter(p => prodLiveStatus(p) === 'In Progress').length;
    const doneCount    = allProd.filter(p => prodLiveStatus(p) === 'Completed').length;
    document.getElementById('prod-total').textContent = allProd.length;
    document.getElementById('prod-inprog').textContent = inprogCount;
    document.getElementById('prod-done').textContent = doneCount;
    document.getElementById('prod-delayed').textContent = allProd.filter(p => p['Production Delay']).length;
    setText('ppc-all', allProd.length);
    setText('ppc-pending', pendingCount);
    setText('ppc-inprog', inprogCount);
    setText('ppc-completed', doneCount);
    if (!allProd.length) { document.getElementById('prodTable').innerHTML = `<tr><td colspan="22"><div class="empty"><div class="empty-ico">⚙️</div><div class="empty-txt">No records yet</div></div></td></tr>`; return; }
    renderProduction(prodBilledMap);
  });
}

function filterProduction(f, el) {
  prodFilter = f;
  document.querySelectorAll('#prodPipeline .pipe-node').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  renderProduction(prodBilledMap);
}

const OVERDUE_DAYS = 5;   // itne din se purana + incomplete = overdue highlight

function isProdOverdue(p) {
  if (prodLiveStatus(p) === 'Completed') return false;   // ban gaya to overdue nahi
  const t = parseDMY(fmtDisplayDate(p['Order Date'] || ''));
  if (!t) return false;
  const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
  return days > OVERDUE_DAYS;
}

function renderProduction(billedMap) {
    billedMap = billedMap || {};
    let list = allProd;
    if (prodFilter === 'pending')         list = allProd.filter(p => prodLiveStatus(p) === 'Pending');
    else if (prodFilter === 'inprogress') list = allProd.filter(p => prodLiveStatus(p) === 'In Progress');
    else if (prodFilter === 'completed')  list = allProd.filter(p => prodLiveStatus(p) === 'Completed');
    if (!list.length) { document.getElementById('prodTable').innerHTML = `<tr><td colspan="22"><div class="empty"><div class="empty-ico">⚙️</div><div class="empty-txt">No items match this filter</div></div></td></tr>`; return; }
    const prodGroups = {};
    const prodSeq = [];
    list.forEach(p => {
      const oid = p['Order ID'] || '';
      if (!prodGroups[oid]) { prodGroups[oid] = []; prodSeq.push(oid); }
      prodGroups[oid].push(p);
    });

    let prodRows = '';
    let prodSr = 1;
    prodSeq.forEach(orderID => {
      const items = prodGroups[orderID];
      const count = items.length;
      const first = items[0];

      items.forEach((p, idx) => {
        const isFirst = idx === 0;
        let bt = (isFirst && prodSr > 1) ? 'border-top:2px solid var(--border2);' : '';
        if (isProdOverdue(p)) bt += 'background:#FEF2F2;';   // 5+ din purana + incomplete → halka red
        const _tQty = parseFloat(p['Qty']) || 0;
        const _pQty = parseFloat(p['Produced Qty']) || 0;
        const liveStatus = (_tQty > 0 && _pQty >= _tQty) ? 'Completed'
                         : (_pQty > 0 || p['Production Start Actual']) ? 'In Progress'
                         : 'Pending';
        const statusBadge = `<span class="badge ${liveStatus==='Completed'?'b-ready':liveStatus==='In Progress'?'b-processing':'b-pending'}">${liveStatus}</span>`;
        const delayBadge  = p['Production Delay'] ? `<span class="badge b-delay">${p['Production Delay']}</span>` : '';

        const orderCells = isFirst ? `
          <td class="td-id" rowspan="${count}" style="vertical-align:middle;${bt}">${orderID}</td>
          <td rowspan="${count}" style="vertical-align:middle;${bt}">${fmtDisplayDate(first['Order Date']||'')}</td>
          <td class="td-bold" rowspan="${count}" style="vertical-align:middle;${bt}">
            <div>${first['Customer Name']||''}</div>
            <button class="btn btn-sm" style="margin-top:6px;white-space:nowrap;background:var(--warning-dim);color:var(--warning);border-color:var(--warning-b);" onclick='showProdSpec(${JSON.stringify(first['Customer Name']||'')})' title="View this customer's battery spec">🔋 Spec</button>
          </td>
          <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Charger Model']||'—'}</td>
          <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Charger Qty']||'—'}</td>
          <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Sales Person']||''}</td>
          <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Assigned CRM']||''}</td>
        ` : '';

        const producedQty = parseFloat(p['Produced Qty']) || 0;
        const totalQty    = parseFloat(p['Qty']) || 0;
        const pendingQty  = parseFloat(p['Pending Qty']) || (totalQty - producedQty);
        const billedQty   = billedMap[p['Item ID']] || 0;
        const qtyDisplay  = producedQty > 0
          ? `<span style="color:var(--success);font-weight:600;">${producedQty}</span>/<span style="font-weight:600;">${totalQty}</span>`
          : `${totalQty}`;
        const pendDisplay = pendingQty > 0
          ? `<span style="color:var(--warning);font-weight:600;">${pendingQty}</span>`
          : `<span style="color:var(--success);font-weight:600;">0 ✅</span>`;
        const billedDisplay = billedQty > 0
          ? `<span style="color:var(--purple);font-weight:600;">🧾 ${billedQty}</span>`
          : `<span style="color:var(--text3);">—</span>`;

        prodRows += `<tr>
          <td style="${bt}">${prodSr++}</td>
          <td class="td-id" style="${bt}">${p['Item ID']||''}</td>
          ${orderCells}
          <td style="${bt}">${p['Sales Remarks']||''}</td>
          <td style="${bt}">${p['Product Model']||''}</td>
          <td style="${bt}">${p['Battery Type']||''}</td>
          <td style="${bt}">${qtyDisplay}</td>
          <td style="${bt}">${pendDisplay}</td>
          <td style="${bt}">${billedDisplay}</td>
          <td style="${bt}">${fmtDisplayDate(p['Production Start Actual']||'')}</td>
          <td style="${bt}">${fmtDisplayDate(p['Production Complete Actual']||'')}</td>
          <td style="${bt}">${delayBadge}</td>
          <td style="${bt}">${statusBadge}</td>
          <td style="${bt}">${p['Remarks']||''}</td>
          <td style="${bt};white-space:nowrap;">
            <button class="btn btn-sm btn-warning" onclick='openProdUpdate(${JSON.stringify(p)})'>Update</button>
            <button class="btn btn-sm" style="margin-left:6px;background:var(--surface2);border-color:var(--border2);color:var(--text2);" onclick='printProdSlip(${JSON.stringify(p)},${JSON.stringify(first)})'>🖨️ Print</button>
          </td>
        </tr>`;
      });
    });
    document.getElementById('prodTable').innerHTML = prodRows;
}

// ========== PRODUCTION — CUSTOMER BATTERY SPEC (read-only view) ==========
function ensureProdSpecModal() {
  if (document.getElementById('prodSpecModal')) return;
  const html = `
  <div id="prodSpecModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.55);align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;">
    <div style="background:var(--surface,#fff);border-radius:14px;max-width:840px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.25);overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border,#e5e7eb);">
        <div id="prodSpecTitle" style="font-size:15px;font-weight:700;color:var(--text,#111);">🔋 Battery Spec</div>
        <button onclick="closeProdSpec()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3,#888);">✕</button>
      </div>
      <div style="padding:16px 20px;">
        <div style="font-size:12px;color:var(--text3,#888);margin-bottom:12px;">What goes on this customer's battery — sticker, BMS, connector, box, etc. (view only)</div>
        <div id="prodSpecBody" style="overflow-x:auto;"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--border,#e5e7eb);">
        <button class="btn" onclick="closeProdSpec()">Close</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('prodSpecModal').addEventListener('click', function (e) {
    if (e.target === this) closeProdSpec();
  });
}

function closeProdSpec() {
  const m = document.getElementById('prodSpecModal');
  if (m) m.style.display = 'none';
}

function showProdSpec(custName) {
  ensureProdSpecModal();
  const box = document.getElementById('prodSpecBody');
  document.getElementById('prodSpecTitle').textContent = '🔋 ' + custName + ' — Battery Spec';
  box.innerHTML = '<div class="loading"><div class="spin"></div></div>';
  document.getElementById('prodSpecModal').style.display = 'flex';

  api({ action: 'getBatterySpec', customerName: custName }, r => {
    const cols = (r.success && r.columns) ? r.columns : [];
    const rows = (r.success && r.data) ? r.data : [];
    if (!cols.length || !rows.length) {
      box.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3,#888);font-size:13px;">No battery spec has been set for this customer yet.</div>';
      return;
    }
    const esc = v => String(v == null ? '' : v).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    let html = '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr>' +
      cols.map(c => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border,#e5e7eb);white-space:nowrap;color:var(--text3,#888);text-transform:uppercase;font-size:10px;letter-spacing:0.4px;">${esc(c)}</th>`).join('') +
      '</tr></thead><tbody>';
    html += rows.map(row => '<tr>' + cols.map(c =>
      `<td style="padding:8px 10px;border-bottom:1px solid var(--border,#eee);color:var(--text,#111);">${esc(row[c]) || '—'}</td>`
    ).join('') + '</tr>').join('');
    html += '</tbody></table>';
    box.innerHTML = html;
  });
}

// ========== PLANNED PRODUCTION SLIP ==========
let plannedPickerItems = [];
let plannedSel = {};   // Item ID -> planned qty (string)

function plannedPending(p) {
  const t = parseFloat(p['Qty']) || 0;
  const pr = parseFloat(p['Produced Qty']) || 0;
  const pend = parseFloat(p['Pending Qty']);
  return isNaN(pend) ? (t - pr) : pend;
}

function openPlannedSlip() {
  if (!allProd || !allProd.length) { toast('Load the Production data first', 'w'); return; }
  plannedPickerItems = allProd.filter(p => plannedPending(p) > 0);
  plannedSel = {};
  const d = new Date();
  document.getElementById('ps-plan-date').value =
    d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  document.getElementById('ps-search').value = '';
  const sa = document.getElementById('ps-select-all'); if (sa) sa.checked = false;
  _mcLastKey = ''; _mcLast = null; _mcAnyShort = false;
  const mcBox = document.getElementById('ps-material-check');
  if (mcBox) { mcBox.innerHTML = ''; mcBox.style.display = 'none'; }
  openModal('plannedSlipModal');
  renderPlannedPicker();
}

function plannedFiltered() {
  const q = (document.getElementById('ps-search')?.value || '').toLowerCase();
  if (!q) return plannedPickerItems;
  return plannedPickerItems.filter(p =>
    String(p['Order ID']||'').toLowerCase().includes(q) ||
    String(p['Customer Name']||'').toLowerCase().includes(q) ||
    String(p['Item ID']||'').toLowerCase().includes(q) ||
    String(p['Product Model']||'').toLowerCase().includes(q));
}

// Production planning: time slots (purane LitpaxERP jaisa)
const PLAN_SLOTS = [
  { key: 's1', label: '9-12', col: 'Slot 9-12' },
  { key: 's2', label: '12-3', col: 'Slot 12-3' },
  { key: 's3', label: '3-6',  col: 'Slot 3-6'  },
  { key: 'ot', label: 'OT',   col: 'Slot OT'   }
];
function emptySlots() { return { s1: '', s2: '', s3: '', ot: '' }; }
function slotTotal(sel) { return sel ? PLAN_SLOTS.reduce((t, s) => t + (parseFloat(sel[s.key]) || 0), 0) : 0; }

function renderPlannedPicker() {
  const data = plannedFiltered();
  const body = document.getElementById('ps-picker-body');
  if (!data.length) { body.innerHTML = '<tr><td colspan="17"><div class="empty"><div class="empty-txt">No pending items</div></div></td></tr>'; updatePlannedSummary(); return; }
  body.innerHTML = data.map(p => {
    const iid = p['Item ID'] || '';
    const pend = plannedPending(p);
    const sel = plannedSel[iid];
    const checked = sel !== undefined;
    const tot = checked ? slotTotal(sel) : 0;
    const over = tot > pend;
    const cModel = p['Charger Model'] || '';
    const cQty   = parseFloat(p['Charger Qty']) || 0;
    const slotInputs = PLAN_SLOTS.map(s => `<td><input class="form-control" type="number" min="0" value="${checked ? (sel[s.key] || '') : ''}" placeholder="0" oninput="setPlannedSlot('${iid}','${s.key}',this.value)" style="font-size:12px;padding:5px 6px;width:62px;" ${checked ? '' : 'disabled'}></td>`).join('');
    return `<tr>
      <td><input type="checkbox" ${checked?'checked':''} onchange="togglePlannedItem('${iid}',this)" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;"></td>
      <td class="td-id">${p['Order ID']||''}</td>
      <td class="td-id">${iid}</td>
      <td class="td-bold">${p['Customer Name']||''}</td>
      <td>${p['Product Model']||''} <span id="ps-mc-${iid}" style="font-size:12px;font-weight:700;"></span></td>
      <td>${p['Battery Type']||''}</td>
      <td style="font-size:12px;color:var(--text2);">${p['Sales Remarks']||'<span style="color:var(--text3);">—</span>'}</td>
      <td>${cModel ? '⚡ '+cModel : '<span style="color:var(--text3);">—</span>'}</td>
      <td>${cQty > 0 ? '<span style="color:var(--warning);font-weight:600;">'+cQty+'</span>' : '<span style="color:var(--text3);">—</span>'}</td>
      <td>${parseFloat(p['Qty'])||0}</td>
      <td style="color:var(--success);font-weight:600;">${parseFloat(p['Produced Qty'])||0}</td>
      <td style="color:var(--warning);font-weight:600;">${pend}</td>
      ${slotInputs}
      <td id="ps-tot-${iid}" style="font-weight:700;color:${over ? 'var(--error)' : 'var(--accent)'};" title="${over ? 'Pending (' + pend + ') exceeded' : ''}">${tot || '—'}</td>
    </tr>`;
  }).join('');
  updatePlannedSummary();
}

function togglePlannedItem(iid, el) {
  const row = el.closest('tr');
  const inputs = row ? row.querySelectorAll('input[type="number"]') : [];
  if (el.checked) {
    plannedSel[iid] = emptySlots();
    inputs.forEach(i => { i.disabled = false; i.value = ''; });
    if (inputs[0]) inputs[0].focus();
  } else {
    delete plannedSel[iid];
    inputs.forEach(i => { i.disabled = true; i.value = ''; });
  }
  refreshPlannedTotal(iid);
  updatePlannedSummary();
}

function setPlannedSlot(iid, key, val) {
  if (plannedSel[iid] === undefined) return;
  plannedSel[iid][key] = val;
  refreshPlannedTotal(iid);
  updatePlannedSummary();
}

function refreshPlannedTotal(iid) {
  const cell = document.getElementById('ps-tot-' + iid);
  if (!cell) return;
  const p = plannedPickerItems.find(x => (x['Item ID']||'') === iid);
  const tot = slotTotal(plannedSel[iid]);
  const over = p && tot > plannedPending(p);
  cell.textContent = tot || '—';
  cell.style.color = over ? 'var(--error)' : 'var(--accent)';
  cell.title = over ? 'Pending (' + plannedPending(p) + ') exceeded' : '';
}

function togglePlannedSelectAll() {
  const on = document.getElementById('ps-select-all').checked;
  plannedFiltered().forEach(p => {
    const iid = p['Item ID'] || '';
    if (on) { if (!plannedSel[iid]) plannedSel[iid] = emptySlots(); }
    else delete plannedSel[iid];
  });
  renderPlannedPicker();
}

function updatePlannedSummary() {
  const ids = Object.keys(plannedSel);
  const qty = ids.reduce((t, iid) => t + slotTotal(plannedSel[iid]), 0);
  document.getElementById('ps-sel-count').textContent = ids.length;
  document.getElementById('ps-sel-qty').textContent = qty;
  const sumEl = document.getElementById('ps-slot-sum');
  if (sumEl) sumEl.innerHTML = PLAN_SLOTS.map(s => {
    const t = ids.reduce((a, iid) => a + (parseFloat(plannedSel[iid][s.key]) || 0), 0);
    return `⏰ ${s.label}: <b>${t}</b>`;
  }).join(' &nbsp;·&nbsp; ');
  scheduleMaterialCheck();
}

// ========== MATERIAL CHECK (IMS stock vs planned) ==========
let _mcTimer = null, _mcSeq = 0, _mcLastKey = '', _mcLast = null, _mcAnyShort = false;

function scheduleMaterialCheck() {
  clearTimeout(_mcTimer);
  _mcTimer = setTimeout(runMaterialCheck, 600);
}

function planModelTotals() {
  const agg = {};
  Object.keys(plannedSel).forEach(iid => {
    const q = slotTotal(plannedSel[iid]);
    if (q <= 0) return;
    const p = plannedPickerItems.find(x => (x['Item ID']||'') === iid);
    const m = p ? String(p['Product Model']||'').trim() : '';
    if (m) agg[m] = (agg[m] || 0) + q;
  });
  return Object.keys(agg).sort().map(m => ({ model: m, qty: agg[m] }));
}

async function runMaterialCheck() {
  const box = document.getElementById('ps-material-check');
  if (!box) return;
  const items = planModelTotals();
  if (!items.length) { box.innerHTML = ''; box.style.display = 'none'; _mcAnyShort = false; applyMcBadges(null); return; }

  const key = JSON.stringify(items);
  if (key === _mcLastKey && _mcLast) { renderMaterialCheck(_mcLast); return; }   // same plan — dobara call nahi

  if (!window.IMS_URL) {
    box.style.display = 'block';
    box.innerHTML = '<div style="padding:10px;color:var(--error);font-size:12px;">⚠ IMS_URL is missing in config.js</div>';
    return;
  }
  const seq = ++_mcSeq;
  box.style.display = 'block';
  box.innerHTML = '<div class="loading"><div class="spin"></div> Checking stock in IMS...</div>';
  try {
    let d = null;
    for (let attempt = 1; attempt <= 2 && !d; attempt++) {
      const r = await fetch(window.IMS_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'checkPlanStock', items, token: erpTok() })
      });
      const t = (await r.text()).trim();
      if (t.startsWith('{')) d = JSON.parse(t);        // HTML/404 aaya to ek baar retry
    }
    if (seq !== _mcSeq) return;
    if (!d || d.error || !d.success) throw new Error((d && (d.error || d.message)) || 'No response from IMS');
    _mcLastKey = key; _mcLast = d;
    renderMaterialCheck(d);
  } catch (e) {
    if (seq !== _mcSeq) return;
    _mcAnyShort = false;
    box.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px;">⚠ Material check failed: ${e.message}</div>`;
  }
}

function renderMaterialCheck(d) {
  const box = document.getElementById('ps-material-check');
  if (!box) return;
  const esc = v => String(v == null ? '' : v).replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]));
  const comps  = d.components || [];
  const models = d.models || [];
  comps.forEach(c => { c.storeShort = Math.max(0, (c.required || 0) - (c.store || 0)); });
  const anyTotalShort = comps.some(c => c.short > 0);
  const anyStoreShort = comps.some(c => c.storeShort > 0);
  _mcAnyShort = anyTotalShort || anyStoreShort;

  const rows = comps.map(c => {
    const bk = (c.storeShort > 0 && c.backups && c.backups.length)
      ? `<div style="font-size:10.5px;color:var(--text2);margin-top:3px;">↳ Backup: ${c.backups.map(b => `${esc(b.component)} — Store ${fmt(b.store)} / WIP ${fmt(b.wip)}`).join(' · ')}</div>`
      : '';
    const miss = c.inItems ? '' : '<div style="font-size:10.5px;color:var(--error);">Name not found in IMS Items</div>';
    let shortCell;
    if (c.short > 0) {
      shortCell = `<span style="color:var(--error);">⛔ ${fmt(c.storeShort)}</span>
        <div style="font-size:10px;color:var(--error);font-weight:500;">Short by ${fmt(c.short)} even after WIP</div>`;
    } else if (c.storeShort > 0) {
      shortCell = `<span style="color:var(--warning);">⚠ ${fmt(c.storeShort)}</span>
        <div style="font-size:10px;color:var(--text3);font-weight:500;">Above store stock — covered by WIP</div>`;
    } else {
      shortCell = `<span style="color:var(--success);">✓</span>`;
    }
    return `<tr>
      <td><div style="font-weight:600;">${esc(c.component)}</div>
          <div style="font-size:10.5px;color:var(--text3);">${esc(c.models.join(', '))}</div>${miss}${bk}</td>
      <td style="text-align:right;font-weight:600;">${fmt(c.required)}</td>
      <td style="text-align:right;">${fmt(c.store)}</td>
      <td style="text-align:right;">${fmt(c.wip)}</td>
      <td style="text-align:right;font-weight:700;">${shortCell}</td>
    </tr>`;
  }).join('');

  const notes = models
    .filter(m => m.status === 'notInMaster' || m.status === 'noBom')
    .map(m => `<div>• <b>${esc(m.model)}</b> — ${m.status === 'noBom' ? 'Master BOM not filled' : 'Not in master, not checked'}</div>`)
    .join('');

  const badge = anyTotalShort ? ['b-delay', '⛔ Stock short']
              : anyStoreShort ? ['b-pending', '⚠ Above store stock']
              : ['b-ready', '✓ Stock OK'];

  box.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);">📦 Material Check (IMS)</div>
      <span class="badge ${badge[0]}">${badge[1]}</span>
    </div>
    ${rows ? `<div class="table-wrap" style="border:1px solid var(--border);border-radius:10px;">
      <table><thead><tr><th>Component</th><th style="text-align:right;">Required</th><th style="text-align:right;">Store</th><th style="text-align:right;">WIP</th><th style="text-align:right;">Short (Store)</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : ''}
    ${notes ? `<div style="margin-top:8px;font-size:11.5px;color:var(--warning);line-height:1.6;">${notes}</div>` : ''}`;

  applyMcBadges(models, comps);
}

function mcKey(s) { return String(s || '').trim().replace(/\s+/g, '-').toLowerCase(); }   // "60V 32Ah" = "60V-32AH"

function applyMcBadges(models, comps) {
  const lvl = {};
  (models || []).forEach(m => {
    lvl[mcKey(m.model)] = m.status === 'short' ? 'short' : m.status === 'ok' ? 'ok' : '';
  });
  (comps || []).forEach(c => {
    const storeShort = Math.max(0, (c.required || 0) - (c.store || 0));
    if (storeShort > 0 && !(c.short > 0)) {
      (c.models || []).forEach(mc => { const k = mcKey(mc); if (lvl[k] === 'ok') lvl[k] = 'warn'; });
    }
  });
  plannedPickerItems.forEach(p => {
    const iid = p['Item ID'] || '';
    const el = document.getElementById('ps-mc-' + iid);
    if (!el) return;
    const selected = plannedSel[iid] !== undefined && slotTotal(plannedSel[iid]) > 0;
    const s = selected ? lvl[mcKey(p['Product Model'])] : '';
    el.textContent = s === 'ok' ? '✓' : s === 'warn' ? '⚠' : s === 'short' ? '⛔' : '';
    el.style.color = s === 'ok' ? 'var(--success)' : s === 'warn' ? 'var(--warning)' : 'var(--error)';
  });
}

function confirmPlannedSlip() {
  const planDate = document.getElementById('ps-plan-date').value;
  if (!planDate) { toast('Select a Plan Date', 'e'); return; }
  const ids = Object.keys(plannedSel);

  const rows = [], warns = [], remarkMap = {};
  for (const iid of ids) {
    const p = plannedPickerItems.find(x => (x['Item ID']||'') === iid);
    if (!p) continue;
    const sel = plannedSel[iid];
    const planned = slotTotal(sel);
    if (planned <= 0) continue;   // kisi slot me qty nahi → skip
    const pend = plannedPending(p);
    if (planned > pend) warns.push(`${p['Product Model']||iid}: planned ${planned} > pending ${pend}`);
    const row = {
      'Plan Date': fmtDisplayDate(planDate),
      'Order ID': p['Order ID']||'',
      'Item ID': iid,
      'Customer Name': p['Customer Name']||'',
      'Product Model': p['Product Model']||'',
      'Battery Type': p['Battery Type']||'',
      'Total Qty': parseFloat(p['Qty'])||0,
      'Produced Qty': parseFloat(p['Produced Qty'])||0,
      'Planned Qty': planned
    };
    PLAN_SLOTS.forEach(s => { row[s.col] = parseFloat(sel[s.key]) || 0; });
    remarkMap[iid] = p['Sales Remarks'] || '';
    rows.push(row);
  }
  if (!rows.length) { toast('Enter a qty in at least one slot of one item', 'e'); return; }
  if (_mcAnyShort) warns.push('Material Check: some components need more than the IMS store stock');

  if (warns.length) {
    const ok = confirm('⚠ Please note:\n\n• ' + warns.join('\n• ') + '\n\nCreate the slip anyway?');
    if (!ok) return;
  }

  const btn = document.getElementById('ps-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  // popup CLICK ke saath kholo — warna browser block karta hai
  const win = window.open('', '_blank', 'width=900,height=680');
  if (win) win.document.write('<p style="font-family:Arial;padding:24px;color:#555;">Creating planned slip...</p>');

  const planDateDisp = fmtDisplayDate(planDate);

  // Charger data ABHI nikaal lo (allProd se) — taaki print ke waqt available rahe
  const orderIDsInSlip = [...new Set(rows.map(r => String(r['Order ID']||'').trim()).filter(Boolean))];
  const chgSeen = {};
  const chargerList = [];
  (allProd || []).forEach(p => {
    const oid = String(p['Order ID']||'').trim();
    if (!oid || chgSeen[oid] || orderIDsInSlip.indexOf(oid) === -1) return;
    const cQty = parseFloat(p['Charger Qty']) || 0;
    if (cQty > 0) {
      chgSeen[oid] = true;
      chargerList.push({
        'Order ID': oid,
        'Customer Name': p['Customer Name'] || '',
        'Charger Model': p['Charger Model'] || 'Charger',
        'Charger Qty': cQty
      });
    }
  });

  // Slip me jitne unique customer hain — unki battery spec bulk laani hai
  const uniqueCusts = [...new Set(rows.map(r => String(r['Customer Name']||'').trim()).filter(Boolean))];

  let pending = rows.length, failed = 0;
  rows.forEach(r => {
    api({ action: 'addPlannedProduction', ...r, 'Added By': user.name || '' }, res => {
      if (!res || !res.success) failed++;
      if (--pending === 0) {
        if (btn) { btn.disabled = false; btn.textContent = '✓ Confirm & Generate Slip'; }
        if (failed) toast(failed + ' item(s) failed to save (the rest were saved)', 'w');
        else toast('Planned production saved!');
        closeModal('plannedSlipModal');

        // Spec bulk laao, phir slip banao (spec na aaye to bhi slip ban jaayegi)
        api({ action: 'getBatterySpecsBulk', customerNames: JSON.stringify(uniqueCusts) }, sr => {
          const specCols = (sr && sr.success && sr.columns) ? sr.columns : [];
          const specMap  = (sr && sr.success && sr.specs)   ? sr.specs   : {};
          const html = buildPlannedSlipPrint(rows, planDateDisp, chargerList, specCols, specMap, remarkMap);
          if (win) { win.document.open(); win.document.write(html); win.document.close(); }
        });
      }
    });
  });
}

function buildPlannedSlipPrint(rows, planDateDisp, chargerList, specCols, specMap, remarkMap) {
  chargerList = chargerList || [];
  remarkMap = remarkMap || {};
  specCols = specCols || [];
  specMap  = specMap || {};
  const esc = v => String(v == null ? '' : v).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  const totPlanned = rows.reduce((s,r)=> s + (parseFloat(r['Planned Qty'])||0), 0);
  const slotStrip = `<div class="slot-strip">${PLAN_SLOTS.map(s => {
    const t = rows.reduce((a,r)=> a + (parseFloat(r[s.col])||0), 0);
    return `<div class="slot-box"><div class="t">⏰ ${s.label}</div><div class="v">${t}</div></div>`;
  }).join('')}</div>`;

  // Order-wise group
  const groups = {}, seq = [];
  rows.forEach(r => {
    const oid = String(r['Order ID']||'').trim() || '—';
    if (!groups[oid]) { groups[oid] = { custName: r['Customer Name']||'', items: [] }; seq.push(oid); }
    groups[oid].items.push(r);
  });

  // Charger order-wise
  const chgByOrder = {};
  chargerList.forEach(c => {
    const oid = String(c['Order ID']||'').trim() || '—';
    (chgByOrder[oid] = chgByOrder[oid] || []).push(c);
  });

  function itemsTable(items) {
    const two = items.filter(r => (r['Battery Type']||'').toLowerCase().includes('2 wheeler'));
    const oth = items.filter(r => !(r['Battery Type']||'').toLowerCase().includes('2 wheeler'));
    const ordered = two.concat(oth);
    const body = ordered.map((r,i) => `
      <tr>
        <td>${i+1}</td>
        <td>${esc(r['Item ID'])||'—'}</td>
        <td>${esc(r['Product Model'])||'—'}</td>
        <td>${esc(r['Battery Type'])||'—'}</td>
        <td>${esc(remarkMap[r['Item ID']])||'—'}</td>
        <td class="c">${r['Total Qty']||'—'}</td>
        ${PLAN_SLOTS.map(s => `<td class="c sl">${parseFloat(r[s.col]) || '—'}</td>`).join('')}
        <td class="pq">${r['Planned Qty']||'—'}</td>
      </tr>`).join('');
    return `<table>
      <thead><tr><th style="width:36px;">#</th><th>Item ID</th><th>Product Model</th><th>Battery Type</th><th>Remarks</th><th class="c">Total</th>${PLAN_SLOTS.map(s => `<th class="c">⏰ ${s.label}</th>`).join('')}<th class="c">Planned</th></tr></thead>
      <tbody>${body}</tbody></table>`;
  }

  function chargerStrip(chgs) {
    if (!chgs || !chgs.length) return '';
    const parts = chgs.map(c => `${esc(c['Charger Model']||'Charger')} × ${c['Charger Qty']||0}`).join('  ·  ');
    return `<div class="charger-line">⚡ Charger: ${parts}</div>`;
  }

  function specBlock(custName) {
    const key = String(custName||'').trim();
    const sRows = specMap[key];
    if (!sRows || !sRows.length) {
      return `<div class="spec-none">🔋 <b>Battery Spec:</b> Not set</div>`;
    }
    const head = specCols.map(c => `<th>${esc(c)}</th>`).join('');
    const body = sRows.map(row => '<tr>' + specCols.map(c => `<td>${esc(row[c])||'—'}</td>`).join('') + '</tr>').join('');
    return `<div class="spec-wrap">
      <div class="spec-title">🔋 Battery Spec</div>
      <div class="spec-scroll"><table class="spec-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    </div>`;
  }

  const blocks = seq.map(oid => {
    const g = groups[oid];
    const plannedSum = g.items.reduce((s,r)=> s + (parseFloat(r['Planned Qty'])||0), 0);
    return `<div class="order-block">
      <div class="order-head">
        <span class="oid">📋 ${esc(oid)}</span>
        <span class="ocust">${esc(g.custName)||'—'}</span>
        <span class="ocount">${g.items.length} item · ${plannedSum} planned</span>
      </div>
      <div class="order-body">
        ${itemsTable(g.items)}
        ${chargerStrip(chgByOrder[oid])}
        ${specBlock(g.custName)}
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Planned Production Slip — ${planDateDisp}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;padding:18px 22px;color:#111;}
    .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e1b4b;padding-bottom:10px;margin-bottom:16px;}
    .brand{font-size:20px;font-weight:800;color:#1e1b4b;}.brand span{color:#6366f1;}
    .meta{text-align:right;font-size:12px;color:#444;line-height:1.8;}.meta strong{font-size:14px;color:#1e1b4b;}
    .no-print{margin-bottom:14px;}
    .no-print button{padding:9px 22px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;margin-right:8px;border:none;}
    .btn-print{background:#1e1b4b;color:#fff;}.btn-close{background:#f0f0f0;color:#333;border:1px solid #ccc !important;}

    .order-block{border:1.5px solid #d9d6f0;border-radius:9px;margin-bottom:16px;overflow:hidden;page-break-inside:avoid;}
    .order-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#1e1b4b;color:#fff;padding:9px 14px;}
    .order-head .oid{font-size:14px;font-weight:800;letter-spacing:0.3px;}
    .order-head .ocust{font-size:13px;font-weight:600;color:#c7c3f0;}
    .order-head .ocount{margin-left:auto;background:#6366f1;font-size:11px;font-weight:600;padding:2px 10px;border-radius:10px;}
    .order-body{padding:12px 14px;}

    table{width:100%;border-collapse:collapse;font-size:12px;}
    thead tr{background:#ede9fe;}thead th{padding:7px 9px;text-align:left;font-size:10.5px;font-weight:700;color:#1e1b4b;text-transform:uppercase;letter-spacing:0.3px;}
    thead th.c{text-align:center;}
    tbody td{padding:7px 9px;border-bottom:1px solid #eee;}
    tbody td.c{text-align:center;}
    tbody td.pq{text-align:center;font-weight:700;font-size:14px;color:#6366f1;}
    tbody td.sl{text-align:center;font-weight:600;font-size:13px;}
    .slot-strip{display:flex;gap:10px;margin-bottom:16px;}
    .slot-box{flex:1;border:1.5px solid #d9d6f0;border-radius:8px;padding:8px 12px;text-align:center;}
    .slot-box .t{font-size:11px;font-weight:700;color:#555;}
    .slot-box .v{font-size:22px;font-weight:800;color:#6366f1;}

    .charger-line{margin-top:9px;font-size:12px;font-weight:600;color:#b45309;background:#fef3c7;border-left:3px solid #f59e0b;padding:6px 11px;border-radius:4px;}

    .spec-wrap{margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:10px;}
    .spec-title{font-size:12px;font-weight:700;color:#047857;margin-bottom:6px;}
    .spec-scroll{overflow-x:auto;}
    .spec-table thead tr{background:#d1fae5;}
    .spec-table thead th{color:#065f46;}
    .spec-none{margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:10px;font-size:12px;color:#b91c1c;}

    .footer{margin-top:16px;display:flex;justify-content:space-between;font-size:11px;color:#999;border-top:1px solid #e0e0e0;padding-top:10px;}
    @media print{.no-print{display:none!important;}body{padding:10px 14px;}}
  </style></head><body>
  <div class="header">
    <div><div class="brand">Litpax<span>ERP</span></div>
    <div style="font-size:12px;color:#666;margin-top:2px;">Planned Production Slip</div></div>
    <div class="meta"><strong>📅 ${planDateDisp}</strong><br>
    Orders: <strong>${seq.length}</strong> · Items: <strong>${rows.length}</strong> · Planned Qty: <strong>${totPlanned}</strong></div>
  </div>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Print</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>
  ${slotStrip}
  ${blocks}
  <div class="footer"><span>Litpax Technology Pvt. Ltd.</span><span>LitpaxERP v3.0 — ${planDateDisp}</span></div>
  </body></html>`;
}
function printOrderRow(o) { currentEditOrder = o; printOrder(); }

function printAccountsOrder(orderID) {
  const o = accOrderFull[orderID];
  if (!o) { toast('Order data not found — refresh the page', 'e'); return; }
  currentEditOrder = o;
  printOrder();   // wahi Sales waala PDF/print
}

// ========== ORDER PRINT / PDF ==========
function printOrder() {
  if (!currentEditOrder) { toast('Order data not found', 'e'); return; }
  const o   = currentEditOrder;
  const oid = o['Order ID'] || '';

  // Window CLICK ke saath hi kholni hai — async callback se kholi to browser block kar deta hai
  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) { toast('Popup blocked — allow it from the popup icon in the address bar', 'e'); return; }
  win.document.write('<p style="font-family:Arial;padding:24px;color:#555;">Loading order data...</p>');

  api({ action: 'getItemsByOrder', 'Order ID': oid }, ir => {
    const items = (ir.data || []).filter(i => (i['Battery Type'] || '') !== 'Charger');
    api({ action: 'getChargersByOrder', 'Order ID': oid }, cr => {
      api({ action: 'getPayments', 'Order ID': oid }, pr => {
        const payments = (pr.success && pr.data) ? pr.data : [];
        const totalReceived = pr.totalReceived || 0;
        win.document.open();
        win.document.write(buildOrderPrint(o, items, cr.data || [], payments, totalReceived));
        win.document.close();
      });
    });
  });
}

function buildOrderPrint(o, items, chargers, payments, totalReceived) {
  payments = payments || [];
  totalReceived = totalReceived || 0;
  const oid = o['Order ID'] || '';
  const esc = v => String(v == null ? '' : v).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

  const info = (l, v) => `<div class="cell"><span class="lbl">${l}</span><span class="val">${esc(v) || '—'}</span></div>`;

  const itemRows = items.map((i, n) => `
    <tr>
      <td>${n + 1}</td>
      <td>${esc(i['Item ID'])}</td>
      <td>${esc(i['Product Model'])}</td>
      <td>${esc(i['Battery Type'])}</td>
      <td>${esc(i['Warranty']) || '—'}</td>
      <td class="r">${esc(i['Qty'])}</td>
      <td class="r">₹${fmt(i['Price Unit (Excluding GST)'])}</td>
      <td class="r b">₹${fmt(Math.round(parseFloat(i['Total'] || 0) * 1.18))}</td>
    </tr>`).join('');

  const chargerBlock = chargers.length ? `
    <div class="sec-t">⚡ Charger</div>
    <table>
      <thead><tr><th>#</th><th>Charger ID</th><th>Model</th><th class="r">Qty</th><th class="r">Rate/Unit</th><th class="r">Total (incl. 5% GST)</th></tr></thead>
      <tbody>${chargers.map((c, n) => `
        <tr>
          <td>${n + 1}</td>
          <td>${esc(c['Charger ID'])}</td>
          <td>${esc(c['Charger Model'])}</td>
          <td class="r">${esc(c['Qty'])}</td>
          <td class="r">₹${fmt(c['Price/Unit'] || 0)}</td>
          <td class="r b">₹${fmt(c['Total'] || 0)}</td>
        </tr>`).join('')}</tbody>
    </table>` : '';

    const orderVal = parseFloat(o['Total Order Value'] || 0);
  const balance  = orderVal - totalReceived;

  const paymentRows = payments.map((p, n) => `
    <tr>
      <td>${n + 1}</td>
      <td>${esc(fmtDisplayDate(p['Date'] || ''))}</td>
      <td>${esc(p['Mode'])}</td>
      <td>${esc(p['Reference']) || '—'}</td>
      <td>${esc(p['Remarks']) || '—'}</td>
      <td class="r b">₹${fmt(p['Amount'] || 0)}</td>
    </tr>`).join('');

  const paymentBlock = `
<div class="sec-t">💵 Payment Details</div>
<div class="tot" style="justify-content:flex-start;">
  <div style="text-align:left;"><span class="lbl">Total Received</span><span class="amt">₹${fmt(totalReceived)}</span></div>
  <div style="text-align:left;"><span class="lbl">Balance Pending</span><span class="amt" style="color:${balance > 0 ? '#C0392B' : '#157A5C'};">₹${fmt(balance)}</span></div>
  <div style="text-align:left;"><span class="lbl">Payment Status</span><span class="amt" style="color:#0D1F3C;font-size:13px;">${esc(o['Payment Status']) || '—'}</span></div>
</div>
${payments.length ? `
<table style="margin-top:10px;">
  <thead><tr><th>#</th><th>Date</th><th>Mode</th><th>Reference</th><th>Remarks</th><th class="r">Amount</th></tr></thead>
  <tbody>${paymentRows}</tbody>
</table>` : '<div style="margin-top:10px;color:#888;font-size:11.5px;">No payment entries yet</div>'}`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${esc(oid)} — ${esc(o['Customer Name'])}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif;padding:20px 24px;color:#1A2333;font-size:12px;}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0D1F3C;padding-bottom:10px;margin-bottom:14px;}
  .brand{font-size:20px;font-weight:800;color:#0D1F3C;}
  .brand span{color:#157A5C;}
  .sub{font-size:11px;color:#666;margin-top:2px;}
  .meta{text-align:right;font-size:11px;color:#444;line-height:1.7;}
  .meta .oid{font-size:15px;font-weight:700;color:#157A5C;}
  .no-print{margin-bottom:14px;}
  .no-print button{padding:9px 20px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-right:8px;border:none;}
  .b-print{background:#157A5C;color:#fff;}
  .b-close{background:#f0f0f0;color:#333;border:1px solid #ccc !important;}
  .sec-t{font-size:11px;font-weight:700;color:#0D1F3C;background:#EEF5F2;border-left:4px solid #157A5C;padding:6px 11px;border-radius:3px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.4px;}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid #E4E6EA;border-radius:4px;overflow:hidden;}
  .cell{padding:7px 11px;border-right:1px solid #E4E6EA;border-bottom:1px solid #E4E6EA;}
  .lbl{display:block;font-size:9px;color:#828A98;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;}
  .val{display:block;font-size:12px;font-weight:600;margin-top:2px;}
  table{width:100%;border-collapse:collapse;font-size:11.5px;}
  thead tr{background:#0D1F3C;color:#fff;}
  th{padding:7px 9px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.3px;}
  td{padding:7px 9px;border-bottom:1px solid #E4E6EA;}
  tbody tr:nth-child(even){background:#FAFAFB;}
  .r{text-align:right;}
  .b{font-weight:700;color:#0D1F3C;}
  .tot{display:flex;justify-content:flex-end;gap:26px;margin-top:12px;padding:11px 14px;background:#EEF5F2;border:1px solid #C7DED6;border-radius:5px;}
  .tot div{text-align:right;}
  .tot .lbl{font-size:9px;}
  .tot .amt{font-size:17px;font-weight:800;color:#157A5C;}
  .rem{margin-top:12px;padding:9px 12px;border:1px solid #E4E6EA;border-radius:4px;font-size:11.5px;}
  .sign{display:flex;justify-content:space-between;margin-top:44px;font-size:11px;color:#666;}
  .sign div{border-top:1px solid #999;padding-top:5px;width:180px;text-align:center;}
  .foot{margin-top:20px;display:flex;justify-content:space-between;font-size:10px;color:#999;border-top:1px solid #E4E6EA;padding-top:8px;}
  @media print{.no-print{display:none!important;}body{padding:12px 16px;}}
</style></head><body>

<div class="head">
  <div>
    <div class="brand">Litpax<span>ERP</span></div>
    <div class="sub">Sales Order Confirmation</div>
  </div>
  <div class="meta">
    <div class="oid">${esc(oid)}</div>
    Order Date: <b>${esc(fmtDisplayDate(o['Date'] || ''))}</b><br>
    Printed: ${new Date().toLocaleDateString('en-IN')}
  </div>
</div>

<div class="no-print">
  <button class="b-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button class="b-close" onclick="window.close()">✕ Close</button>
</div>

<div class="sec-t">Customer &amp; Order Details</div>
<div class="grid">
  ${info('Customer Name', o['Customer Name'])}
  ${info('Phone', o['Customer Phone'])}
  ${info('City', o['City'])}
  ${info('Sales Person', o['Sales Person Name'])}
  ${info('Plan Payment Date', fmtDisplayDate(o['Plan Payment Date'] || ''))}
  ${info('Plan Dispatch Date', fmtDisplayDate(o['Plan Dispatch Date'] || ''))}
  ${info('Suggested Transport', o['Suggested Transport'])}
  ${info('Billing Address', o['Billing Address'])}
  ${info('Shipping Address', o['Shipping Address'])}
</div>

<div class="sec-t">📦 Order Items</div>
<table>
  <thead><tr><th>#</th><th>Item ID</th><th>Product Model</th><th>Battery Type</th><th>Warranty</th><th class="r">Qty</th><th class="r">Rate/Unit (Ex GST)</th><th class="r">Total (incl. 18% GST)</th></tr></thead>
  <tbody>${itemRows || '<tr><td colspan="8" style="text-align:center;color:#888;">No items</td></tr>'}</tbody>
</table>

${chargerBlock}

<div class="tot">
  <div><span class="lbl">Total Qty</span><span class="amt" style="color:#0D1F3C;">${fmt(o['Total Qty'] || 0)}</span></div>
  <div><span class="lbl">Transport Charges</span><span class="amt" style="color:#0D1F3C;">₹${fmt(o['Transportation Charges'] || 0)}</span></div>
  <div><span class="lbl">Total Order Value</span><span class="amt">₹${fmt(o['Total Order Value'] || 0)}</span></div>
</div>
${paymentBlock}
${o['Order Remarks'] ? `<div class="rem"><b>Remarks:</b> ${esc(o['Order Remarks'])}</div>` : ''}

<div class="sign"><div>Customer Signature</div><div>For Litpax Technology Pvt. Ltd.</div></div>
<div class="foot"><span>Litpax Technology Pvt. Ltd.</span><span>LitpaxERP v3.0</span></div>
</body></html>`;

  return html;
}

function calcProdQty() {
  const produced = parseFloat(document.getElementById('pu-produced-qty').value) || 0;
  const total    = parseFloat(document.getElementById('pu-total-qty').textContent) || 0;
  const pending  = total - produced;
  document.getElementById('pu-pending-qty').textContent = pending >= 0 ? pending : 0;
}

function toggleProdDate(which) {
  const chk    = document.getElementById(`pu-${which}-chk`);
  const dateEl = document.getElementById(`pu-${which}`);
  if (!chk || !dateEl) return;
  if (chk.checked) {
    if (!dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  } else {
    dateEl.value = '';
  }
}

function openProdUpdate(p) {
  document.getElementById('pu-orderid').value = p['Order ID']||'';
  document.getElementById('pu-itemid').value = p['Item ID']||'';
  document.getElementById('pu-model').value = p['Product Model']||'';
  document.getElementById('pu-btype').value = p['Battery Type']||'';
  document.getElementById('pu-status').value = p['Status']||'Pending';
  const saVal = toInputDate(p['Production Start Actual']||'');
  const caVal = toInputDate(p['Production Complete Actual']||'');
  document.getElementById('pu-sa').value = saVal;
  document.getElementById('pu-ca').value = caVal;
  document.getElementById('pu-sa-chk').checked = !!saVal;
  document.getElementById('pu-ca-chk').checked = !!caVal;
  document.getElementById('pu-delay').value = p['Production Delay']||'';
  document.getElementById('pu-remarks').value = p['Remarks']||'';
  // Produced Qty info
  const totalQty    = parseFloat(p['Qty']) || 0;
  const producedQty = parseFloat(p['Produced Qty']) || 0;
  const pendingQty  = parseFloat(p['Pending Qty']) || (totalQty - producedQty);
  document.getElementById('pu-total-qty').textContent   = totalQty;
  document.getElementById('pu-produced-qty').value = producedQty || '';
  document.getElementById('pu-pending-qty').textContent = pendingQty > 0 ? pendingQty : 0;
  openModal('prodUpdateModal');
}

function submitProdUpdate() {
  const btn = document.getElementById('prodUpdateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

  var itemID  = document.getElementById('pu-itemid').value;
  var orderID = document.getElementById('pu-orderid').value;
  var params  = { action: 'updateProduction', 'Order ID': orderID };
  if (itemID) params['Item ID'] = itemID;

  var dateIds = ['pu-sa','pu-ca'];
  var fields = [
    ['Product Model','pu-model'],['Battery Type','pu-btype'],['Status','pu-status'],
    ['Production Start Actual','pu-sa'],
    ['Production Complete Actual','pu-ca'],
    ['Production Delay','pu-delay'],['Remarks','pu-remarks'],
    ['Produced Qty','pu-produced-qty']
  ];
  fields.forEach(([key, id]) => {
    var el = document.getElementById(id);
    if (!el) return;
    var val = el.value;
    if (!val) return;
    if (dateIds.includes(id)) val = fmtDisplayDate(val);
    params[key] = val;
  });
  var actualStart  = document.getElementById('pu-sa').value;
  var producedQty  = parseFloat(document.getElementById('pu-produced-qty').value) || 0;
  var totalQtyVal  = parseFloat(document.getElementById('pu-total-qty').textContent) || 0;
  if (totalQtyVal > 0 && producedQty >= totalQtyVal) params['Status'] = 'Completed';
  else if (producedQty > 0 || actualStart)           params['Status'] = 'In Progress';
  else                                               params['Status'] = 'Pending';

  const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = 'Update Production'; } };

  api(params, r => {
    resetBtn();
    if (r.success) {
      const crmParams = { action: 'updateCRM', 'Order ID': orderID };
      if (itemID) crmParams['Item ID'] = itemID;
      if (params['Production Start Actual'])    crmParams['Production Start Actual']    = params['Production Start Actual'];
      if (params['Production Complete Actual']) crmParams['Production Complete Actual'] = params['Production Complete Actual'];
      if (params['Production Delay'])           crmParams['Production Delay']           = params['Production Delay'];
      if (params['Status'] === 'Completed') {
        // Sirf tab jab is order ke SAARE items Completed hon
        const orderItems = allProd.filter(x => x['Order ID'] === orderID);
        const allDone = orderItems.every(x =>
          (x['Item ID'] === itemID) ? true : (x['Status'] === 'Completed')
        );
        if (allDone) crmParams['Current Stage'] = 'Production Complete';
      }
      if (Object.keys(crmParams).length > 2) api(crmParams, () => {});

      // FMS: Start / Complete checkbox ticked hai to us step ko Done karo
      if (document.getElementById('pu-sa-chk').checked) {
        api({ action: 'markFMSProductionDone', 'Item ID': itemID, 'Step': 'start', 'Actual': params['Production Start Actual'] || '' }, () => {});
      }
      if (document.getElementById('pu-ca-chk').checked) {
        api({ action: 'markFMSProductionDone', 'Item ID': itemID, 'Step': 'complete', 'Actual': params['Production Complete Actual'] || '' }, () => {});
      }

      toast('Production updated!');
      closeModal('prodUpdateModal');
      loadProduction();
    } else toast(r.message, 'e');
  });
}

// ========== DISPATCH ==========
// ========== DISPATCH ==========
let allDspItems = [], dspTotals = {}, dspBilled = {}, dspPayMap = {}, dspOrderMap = {};
let currentDispatchData = null;
let dspFilter = 'all';

function dspStatus(p) {
  const qty  = parseFloat(p['Qty'])||0;
  const disp = dspTotals[p['Item ID']]||0;
  const prod = parseFloat(p['Produced Qty'])||0;
  if (disp >= qty && qty > 0) return 'done';
  if (disp > 0)               return 'partial';
  if (prod > 0)               return 'ready';
  return 'waiting';
}

function filterDispatch(f, el) {
  dspFilter = f;
  document.querySelectorAll('#dspPipeline .pipe-node').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  renderDispatch();
}

function loadDispatch() {
  document.getElementById('dispatchTable').innerHTML = '<tr><td colspan="17"><div class="loading"><div class="spin"></div> Loading...</div></td></tr>';
  api({ action: 'getDispatchBundle' }, r => {
    if (!r.success) { document.getElementById('dispatchTable').innerHTML = '<tr><td colspan="17"><div class="empty"><div class="empty-txt">Load failed</div></div></td></tr>'; return; }
    allDspItems = r.production || [];
    dspOrderMap = r.orderMap || {};
    dspTotals   = r.dispTotals || {};
    dspBilled   = r.billed || {};
    const payTotals = r.payTotals || {};
    dspPayMap = {};
    [...new Set(allDspItems.map(p => p['Order ID']))].forEach(oid => {
      const ov = parseFloat(dspOrderMap[oid]?.['Total Order Value']) || 0;
      const received = payTotals[oid] || 0;
      dspPayMap[oid] = { received, orderVal: ov, balance: ov - received };
    });
    renderDispatch();
  });
}

function renderDispatch() {
  const q = (document.getElementById('dspSearch')?.value||'').toLowerCase();
  let data = allDspItems;
  if (q) data = data.filter(p => (p['Order ID']||'').toLowerCase().includes(q) || (p['Customer Name']||'').toLowerCase().includes(q));

  // Stats
  let ready = 0, partial = 0, done = 0;
  allDspItems.forEach(p => {
    const qty  = parseFloat(p['Qty'])||0;
    const disp = dspTotals[p['Item ID']]||0;
    if (disp >= qty && qty > 0) done++;
    else if (disp > 0) partial++;
    else if ((parseFloat(p['Produced Qty'])||0) > 0) ready++;
  });
  setText('dsp-total', allDspItems.length);
  setText('dsp-ready', ready);
  setText('dsp-partial', partial);
  setText('dsp-done', done);

  // Pipeline counts — hamesha full set pe (search ke andar bhi sahi rahe)
  setText('dpc-all', allDspItems.length);
  setText('dpc-waiting', allDspItems.filter(p => dspStatus(p) === 'waiting').length);
  setText('dpc-ready',   allDspItems.filter(p => dspStatus(p) === 'ready').length);
  setText('dpc-partial', allDspItems.filter(p => dspStatus(p) === 'partial').length);
  setText('dpc-done',    allDspItems.filter(p => dspStatus(p) === 'done').length);

  // Status filter
  if (dspFilter !== 'all') data = data.filter(p => dspStatus(p) === dspFilter);

  if (!data.length) { document.getElementById('dispatchTable').innerHTML = '<tr><td colspan="19"><div class="empty"><div class="empty-ico">🚚</div><div class="empty-txt">No records match this filter</div></div></td></tr>'; return; }

  // Order-wise grouping (Production jaisa)
  const groups = {}, seq = [];
  data.forEach(p => {
    const oid = p['Order ID']||'';
    if (!groups[oid]) { groups[oid] = []; seq.push(oid); }
    groups[oid].push(p);
  });

  let rows = '', sr = 1;
  seq.forEach(orderID => {
    const items = groups[orderID];
    const count = items.length;
    const first = items[0];
    const o = dspOrderMap[orderID] || {};
    const pay = dspPayMap[orderID] || {};
    const bal = pay.balance || 0;
    const payCell = pay.orderVal
      ? `<div style="font-size:11px;">Rcvd: <b style="color:var(--success);">₹${fmt(pay.received)}</b></div>
         <div style="font-size:11px;">Bal: <b style="color:${bal<=0?'var(--success)':'var(--error)'};">₹${fmt(bal)}</b></div>`
      : '—';

    items.forEach((p, idx) => {
      const isFirst = idx === 0;
      const bt = (isFirst && sr > 1) ? 'border-top:2px solid var(--border2);' : '';
      const qty      = parseFloat(p['Qty'])||0;
      const produced = parseFloat(p['Produced Qty'])||0;
      const billed   = dspBilled[p['Item ID']]||0;
      const disp     = dspTotals[p['Item ID']]||0;
      const pend     = qty - disp;
      const statusBadge = disp >= qty && qty > 0
        ? '<span class="badge b-dispatched">🚚 Dispatched</span>'
        : disp > 0
        ? '<span class="badge b-processing">Partial</span>'
        : produced > 0
        ? '<span class="badge b-ready">Ready</span>'
        : '<span class="badge b-pending">Waiting</span>';

      const orderCells = isFirst ? `
        <td class="td-id" rowspan="${count}" style="vertical-align:middle;${bt}">${orderID}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${fmtDisplayDate(first['Order Date']||'')}</td>
        <td class="td-bold" rowspan="${count}" style="vertical-align:middle;${bt}">${first['Customer Name']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${o['City']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Charger Model']||'—'}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${first['Charger Qty']||'—'}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${payCell}</td>
        <td rowspan="${count}" style="vertical-align:middle;${bt}">${fmtDisplayDate(o['Plan Dispatch Date']||'') || '—'}</td>
      ` : '';

      rows += `<tr>
        <td style="${bt}">${sr++}</td>
        <td class="td-id" style="${bt}">${p['Item ID']||''}</td>
        ${orderCells}
        <td style="${bt}">${p['Product Model']||''}</td>
        <td style="${bt}">${p['Battery Type']||''}</td>
        <td style="${bt}">${qty}</td>
        <td style="${bt};color:var(--success);font-weight:600;">${produced}</td>
        <td style="${bt};color:var(--purple);font-weight:600;">${billed || '—'}</td>
        <td style="${bt};color:var(--warning);font-weight:600;">${disp || '—'}</td>
        <td style="${bt};font-weight:600;color:${pend<=0?'var(--success)':'var(--warning)'};">${pend<=0?'0 ✅':pend}</td>
        <td style="${bt}">${statusBadge}</td>
        <td style="${bt}"><button class="btn btn-sm btn-primary" onclick='openDispatchModal(${JSON.stringify(p)})'>🚚 Dispatch</button></td>
      </tr>`;
    });
  });
  document.getElementById('dispatchTable').innerHTML = rows;
}

function searchDispatch() { renderDispatch(); }

// ========== DELIVERY CHALLAN ==========
// 👇 Apni asli company details bhar do (photo wale challan se)
const CHALLAN_HEADER = {
  company: 'Litpax Technology Pvt. Ltd.',
  gstin:   '06AAECL9497K1ZR',
  address: 'Sirsa, Haryana',   // 👈 poora address
  phones:  ''                  // 👈 phone number(s)
};

let allDC = [];               // saare challan rows
let dcSentMap = {};           // Item ID -> total qty already bheji
let dcItems = [];             // production rows (item list)
let dcOrderMap = {};          // Order ID -> order row
let currentChallanItems = []; // abhi fetch kiye gaye order ke items

function loadDeliveryChallan() {
  const rec = document.getElementById('dcRecent');
  if (rec) rec.innerHTML = '<div class="loading"><div class="spin"></div></div>';
  api({ action: 'getDispatchBundle' }, r => {
    dcItems    = (r.success && r.production) ? r.production : [];
    dcOrderMap = (r.success && r.orderMap) ? r.orderMap : {};
    buildOrderDatalist();
    reloadDCTotals(renderRecentChallans);
  });
}

function buildOrderDatalist() {
  const seen = {}, opts = [];
  dcItems.forEach(p => {
    const oid = String(p['Order ID'] || '').trim();
    if (!oid || seen[oid]) return;
    const o = dcOrderMap[oid] || {};
    const st = String(o['Order Status'] || o['Status'] || '');
    // status pata ho aur "complete" na ho to skip; warna list me rakho
    if (st && !st.toLowerCase().includes('complet')) return;
    seen[oid] = true;
    opts.push(`<option value="${oid}">${(p['Customer Name'] || '')}</option>`);
  });
  const dl = document.getElementById('dc-orderlist');
  if (dl) dl.innerHTML = opts.join('');
}

function reloadDCTotals(cb) {
  api({ action: 'getDeliveryChallans' }, r => {
    allDC = (r.success && r.data) ? r.data : [];
    dcSentMap = {};
    allDC.forEach(d => {
      const iid = String(d['Item ID'] || '').trim();
      if (!iid) return;
      dcSentMap[iid] = (dcSentMap[iid] || 0) + (parseFloat(d['Qty']) || 0);
    });
    if (cb) cb();
  });
}

function fetchChallanOrder() {
  const oid = (document.getElementById('dc-orderid').value || '').trim();
  const wrap = document.getElementById('dc-items-wrap');
  const meta = document.getElementById('dc-order-meta');
  if (!oid) { toast('Enter an Order ID', 'e'); return; }
  const items = dcItems.filter(p => String(p['Order ID']).trim().toLowerCase() === oid.toLowerCase());
  if (!items.length) {
    wrap.style.display = 'none';
    meta.innerHTML = '';
    toast('No items found for this Order ID', 'e');
    return;
  }
  const orderID = items[0]['Order ID'];
  const o = dcOrderMap[String(orderID).trim()] || {};
  document.getElementById('dc-address').value = o['Shipping Address'] || o['Billing Address'] || '';
  document.getElementById('dc-note').value = '';
  document.getElementById('dc-date').value = '';

  // Charger bhi laao — alag row ki tarah dikhega
  api({ action: 'getChargersByOrder', 'Order ID': orderID }, cr => {
    const chargers = (cr.success && cr.data) ? cr.data : [];
    const chargerItems = chargers.map(c => ({
      'Item ID':       c['Charger ID'] || '',
      'Order ID':      orderID,
      'Customer Name': items[0]['Customer Name'] || '',
      'Product Model': c['Charger Model'] || 'Charger',
      'Battery Type':  'Charger',
      'Qty':           c['Qty'] || 0,
      '_isCharger':    true
    }));
    const all = items.concat(chargerItems);
    currentChallanItems = all;
    meta.innerHTML = `Customer: ${items[0]['Customer Name'] || '—'} &nbsp;·&nbsp; ${items.length} item(s)` +
      (chargerItems.length ? ` <span style="color:var(--warning);">+ ${chargerItems.length} charger</span>` : '');
    renderChallanItems(all);
    wrap.style.display = 'block';
  });
}

function renderChallanItems(items) {
  let rows = '';
  items.forEach((p, i) => {
    const iid = String(p['Item ID'] || '').trim();
    const qty = parseFloat(p['Qty']) || 0;
    const sent = dcSentMap[iid] || 0;
    const pend = qty - sent;
    const sentDisp = sent > 0 ? `<span style="color:var(--warning);font-weight:600;">${sent}</span>` : '<span style="color:var(--text3);">—</span>';
    const penDisp  = pend <= 0 ? '<span style="color:var(--success);font-weight:600;">0 ✅</span>' : `<span style="color:var(--warning);font-weight:600;">${pend}</span>`;
    const partic = p['_isCharger']
      ? (p['Product Model'] || 'Charger')
      : ((p['Product Model'] || '') + ' ' + (p['Battery Type'] || '')).trim();
    rows += `<tr>
      <td><input type="checkbox" id="dc-chk-${i}" ${pend > 0 ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;"></td>
      <td class="td-id">${iid}</td>
      <td>${p['Product Model'] || ''}</td>
      <td>${p['_isCharger'] ? '⚡ Charger' : (p['Battery Type'] || '')}</td>
      <td>${qty}</td>
      <td>${sentDisp}</td>
      <td>${penDisp}</td>
      <td><input class="form-control" type="number" id="dc-qty-${i}" value="${pend > 0 ? pend : ''}" style="padding:5px 8px;font-size:12px;"></td>
      <td><input class="form-control" type="number" id="dc-amt-${i}" placeholder="0" style="padding:5px 8px;font-size:12px;"></td>
      <td><input class="form-control" id="dc-part-${i}" value="${partic.replace(/"/g,'&quot;')}" style="padding:5px 8px;font-size:12px;"></td>
    </tr>`;
  });
  document.getElementById('dc-item-rows').innerHTML = rows;
}

function submitChallan() {
  const lines = [];
  currentChallanItems.forEach((p, i) => {
    const chk = document.getElementById('dc-chk-' + i);
    if (!chk || !chk.checked) return;
    const q = parseFloat(document.getElementById('dc-qty-' + i).value) || 0;
    if (q <= 0) return;
    lines.push({
      itemId: String(p['Item ID'] || '').trim(),
      qty: q,
      amount: parseFloat(document.getElementById('dc-amt-' + i).value) || 0,
      particulars: document.getElementById('dc-part-' + i).value.trim(),
      _total: parseFloat(p['Qty']) || 0,
      _sent: dcSentMap[String(p['Item ID'] || '').trim()] || 0
    });
  });
  if (!lines.length) { toast('Select at least one item and enter a qty', 'e'); return; }

  const address = document.getElementById('dc-address').value.trim();
  if (!address) { toast('Enter the Name & Address', 'e'); return; }

  const over = lines.filter(l => l.qty > (l._total - l._sent));
  if (over.length) {
    if (!confirm(`⚠ ${over.length} item(s) have a challan qty above pending. Create anyway?`)) return;
  }

  const oid = String(currentChallanItems[0]['Order ID']).trim();
  const cust = currentChallanItems[0]['Customer Name'] || '';
  const note = document.getElementById('dc-note').value.trim();
  const billNo = document.getElementById('dc-billno').value.trim();
  const dateVal = document.getElementById('dc-date').value; // yyyy-mm-dd or ''

  const btn = document.getElementById('dc-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  const win = window.open('', '_blank', 'width=820,height=700');
  if (win) win.document.write('<p style="font-family:Arial;padding:24px;color:#555;">Creating challan...</p>');

  api({
    action: 'addDeliveryChallan',
    'Order ID': oid,
    'Customer Name': cust,
    'Address': address,
    'Note': note,
    'Bill No': billNo,
    'Date': dateVal,
    'Items': JSON.stringify(lines.map(l => ({ itemId: l.itemId, qty: l.qty, amount: l.amount, particulars: l.particulars }))),
    'Created By': (typeof user !== 'undefined' && user.name) ? user.name : ''
  }, r => {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save & Print Challan'; }
    if (r && r.success) {
      toast(`Challan saved — DC #${r.dcNo} (${r.lines} item)`);
      const ch = {
        dcNo: r.dcNo,
        date: fmtDisplayDate(dateVal || new Date().toISOString().split('T')[0]),
        orderId: oid, customer: cust, address: address, note: note, billNo: billNo,
        items: lines.map(l => ({ itemId: l.itemId, particulars: l.particulars, qty: l.qty, amount: l.amount }))
      };
      const html = buildChallanPrint(ch);
      if (win) { win.document.open(); win.document.write(html); win.document.close(); }
      document.getElementById('dc-items-wrap').style.display = 'none';
      document.getElementById('dc-orderid').value = '';
      document.getElementById('dc-billno').value = '';
      document.getElementById('dc-order-meta').innerHTML = '';
      reloadDCTotals(renderRecentChallans);
    } else {
      if (win) win.close();
      toast((r && r.message) || 'Save failed', 'e');
    }
  });
}

function groupDC() {
  const g = {};
  allDC.forEach(d => {
    const no = String(d['DC No']);
if (!g[no]) g[no] = { dcNo: d['DC No'], date: d['Date'], orderId: d['Order ID'], customer: d['Customer Name'], address: d['Address'], note: d['Note'], billNo: d['Bill No'], items: [] };
    g[no].items.push({ itemId: d['Item ID'], particulars: d['Particulars'], qty: d['Qty'], amount: d['Amount'] });
  });
  return g;
}

function renderRecentChallans() {
  const el = document.getElementById('dcRecent');
  setText('dc-count', Object.keys(groupDC()).length);
  if (!el) return;
  const g = groupDC();
  const nos = Object.keys(g).sort((a, b) => Number(b) - Number(a)).slice(0, 30);
  if (!nos.length) { el.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text3);font-size:13px;">No challans yet</div>'; return; }
  el.innerHTML = nos.map(no => {
    const c = g[no];
    const totQty = c.items.reduce((s, x) => s + (parseFloat(x.qty) || 0), 0);
    const totAmt = c.items.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface);">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);">📄 DC #${c.dcNo} <span style="font-size:11px;color:var(--text3);font-weight:400;margin-left:6px;">${c.orderId || ''} · ${c.items.length} item</span></div>
        <div style="font-size:11px;color:var(--text3);">${fmtDisplayDate(c.date || '')} · ${c.customer || ''} · Qty: ${totQty}${totAmt ? ' · ₹' + fmt(totAmt) : ''}${c.note ? ' · ' + c.note : ''}</div>
      </div>
      <button class="btn btn-sm btn-info" onclick="reprintChallan('${no}')">🖨️ Reprint</button>
    </div>`;
  }).join('');
}

function reprintChallan(no) {
  const c = groupDC()[String(no)];
  if (!c) { toast('Challan not found', 'e'); return; }
  const win = window.open('', '_blank', 'width=820,height=700');
  if (!win) { toast('Popup blocked — please allow it', 'e'); return; }
  win.document.write(buildChallanPrint(c));
  win.document.close();
}

function buildChallanPrint(ch) {
  const esc = v => String(v == null ? '' : v).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const dateDisp = fmtDisplayDate(ch.date || '') || new Date().toLocaleDateString('en-IN');
  const H = CHALLAN_HEADER;
  let totQty = 0, totAmt = 0, body = '';
  ch.items.forEach((it, idx) => {
    const q = parseFloat(it.qty) || 0, a = parseFloat(it.amount) || 0;
    totQty += q; totAmt += a;
    body += `<tr><td>${idx + 1}</td><td>${esc(it.particulars) || esc(it.itemId) || '—'}</td><td class="r">${q}</td><td class="r">${a ? '₹' + fmt(a) : '—'}</td></tr>`;
  });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Delivery Challan #${esc(ch.dcNo)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif;padding:22px 26px;color:#1a1a1a;font-size:13px;}
  .no-print{margin-bottom:14px;}
  .no-print button{padding:9px 20px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-right:8px;border:none;}
  .b-print{background:#b91c5c;color:#fff;}
  .b-close{background:#f0f0f0;color:#333;border:1px solid #ccc !important;}
  .box{border:2px solid #b91c5c;border-radius:6px;padding:16px 18px;}
  .head{text-align:center;border-bottom:2px solid #b91c5c;padding-bottom:10px;margin-bottom:12px;}
  .company{font-size:22px;font-weight:800;color:#b91c5c;letter-spacing:0.5px;}
  .cinfo{font-size:12px;color:#444;margin-top:4px;line-height:1.6;}
  .title{text-align:center;font-size:14px;font-weight:700;letter-spacing:2px;margin:6px 0 12px;color:#333;text-transform:uppercase;}
  .meta{display:flex;justify-content:space-between;font-size:13px;margin-bottom:12px;}
  .meta b{color:#b91c5c;}
  .addr{border:1px solid #ddd;border-radius:5px;padding:10px 12px;margin-bottom:14px;font-size:13px;white-space:pre-wrap;min-height:52px;}
  .addr .lbl{font-size:10px;color:#888;text-transform:uppercase;font-weight:600;display:block;margin-bottom:4px;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:4px;}
  th,td{border:1px solid #ccc;padding:8px 10px;}
  thead tr{background:#fce7f0;}
  th{text-align:left;font-size:12px;color:#333;}
  .r{text-align:right;}
  .warn{margin:14px 0;font-size:13px;font-weight:700;color:#b91c5c;text-align:center;letter-spacing:0.5px;}
  .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:12px;color:#555;}
  .sign div{border-top:1px solid #999;padding-top:5px;width:190px;text-align:center;}
  @media print{.no-print{display:none!important;}body{padding:12px 16px;}}
</style></head><body>
<div class="no-print">
  <button class="b-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button class="b-close" onclick="window.close()">✕ Close</button>
</div>
<div class="box">
  <div class="head">
    <div class="company">${esc(H.company)}</div>
    <div class="cinfo">${H.gstin ? 'GSTIN: ' + esc(H.gstin) : ''}${H.address ? ' &nbsp;|&nbsp; ' + esc(H.address) : ''}${H.phones ? '<br>' + esc(H.phones) : ''}</div>
  </div>
  <div class="title">Delivery Challan</div>
  <div class="meta">
    <div>Challan No: <b>${esc(ch.dcNo)}</b></div>
    <div>Order ID: <b>${esc(ch.orderId)}</b></div>
    ${ch.billNo ? `<div>Bill No: <b>${esc(ch.billNo)}</b></div>` : ''}
    <div>Date: <b>${esc(dateDisp)}</b></div>
  </div>
  <div class="addr"><span class="lbl">Name &amp; Address</span>${esc(ch.address)}</div>
  <table>
    <thead><tr><th style="width:44px;">#</th><th>Particulars</th><th class="r" style="width:90px;">Qty</th><th class="r" style="width:130px;">Amount (₹)</th></tr></thead>
    <tbody>
      ${body}
      <tr><td></td><td class="r" style="font-weight:700;">Total</td><td class="r" style="font-weight:700;">${totQty}</td><td class="r" style="font-weight:700;">${totAmt ? '₹' + fmt(totAmt) : '—'}</td></tr>
    </tbody>
  </table>
  ${ch.note ? `<div style="font-size:12px;color:#666;margin-bottom:4px;">Note: ${esc(ch.note)}</div>` : ''}
  <div class="warn">Only for Warranty — not for Sale</div>
  <div class="sign">
    <div>Customer Signature</div>
    <div>For ${esc(H.company)}<br>Manager / Prop.</div>
  </div>
</div>
</body></html>`;
}

function toggleDispatchFMS() {
  const chk    = document.getElementById('dsp-fms-chk');
  const dateEl = document.getElementById('dsp-date');
  if (!chk || !dateEl) return;
  if (chk.checked) {
    if (!dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  } else {
    dateEl.value = '';
  }
}

function openDispatchModal(p) {
  const oid  = p['Order ID']||'';
  const iid  = p['Item ID']||'';
  const qty      = parseFloat(p['Qty'])||0;
  const produced = parseFloat(p['Produced Qty'])||0;
  const billed   = dspBilled[iid]||0;
  const disp     = dspTotals[iid]||0;
  const pay      = dspPayMap[oid]||{};
  currentDispatchData = { p, oid, iid, qty, produced, billed, disp, balance: pay.balance||0 };

  document.getElementById('dsp-orderid-display').textContent = oid;
  document.getElementById('dsp-itemid-display').textContent  = iid;
  document.getElementById('dsp-product-display').textContent = p['Product Model']||'';
  document.getElementById('dsp-m-total').textContent      = qty;
  document.getElementById('dsp-m-produced').textContent   = produced;
  document.getElementById('dsp-m-billed').textContent     = billed;
  document.getElementById('dsp-m-dispatched').textContent = disp;

  const warnEl = document.getElementById('dsp-pay-warning');
  if ((pay.balance||0) > 0) {
    warnEl.style.display = 'block';
    warnEl.textContent = '⚠ Payment pending: ₹' + fmt(pay.balance) + ' balance on this order';
  } else warnEl.style.display = 'none';

  document.getElementById('dsp-qty').value      = (qty - disp) > 0 ? (qty - disp) : '';
  document.getElementById('dsp-date').value     = '';
  document.getElementById('dsp-fms-chk').checked = false;
  document.getElementById('dsp-transport').value= dspOrderMap[oid]?.['Suggested Transport'] || '';
  document.getElementById('dsp-vehicle').value  = '';
  document.getElementById('dsp-lr').value       = '';
  document.getElementById('dsp-driver').value   = '';
  document.getElementById('dsp-remarks').value  = '';
  openModal('dispatchModal');
  dscReset();
  loadDispatchHistory(oid, iid);
}

function loadDispatchHistory(orderID, itemID) {
  const el = document.getElementById('dsp-history');
  el.innerHTML = '<div class="loading"><div class="spin"></div></div>';
  api({ action: 'getAllDispatches' }, r => {
    const list = (r.data||[]).filter(d => d['Order ID'] === orderID && d['Item ID'] === itemID);
    if (!list.length) { el.innerHTML = '<div style="text-align:center;padding:8px;color:var(--text3);font-size:12px;">No dispatch entries yet</div>'; return; }
    el.innerHTML = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Previous Dispatches</div>' +
      list.map(d => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:5px;background:var(--surface);">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);">Qty: ${d['Dispatch Qty']||0} &nbsp;|&nbsp; ${d['Transport Name']||'—'} ${d['LR No']?'· LR: '+d['LR No']:''}</div>
            <div style="font-size:11px;color:var(--text3);">${fmtDisplayDate(d['Dispatch Date']||'')} ${d['Vehicle No']?'· '+d['Vehicle No']:''} ${d['Remarks']?'· '+d['Remarks']:''}</div>
          </div>
          <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text3);">${d['Dispatch ID']||''}</span>
        </div>`).join('');
  });
}

/* ===== Dispatch scan (PLT) — employee badge + battery serials ===== */
let DSC = { emp: null, list: [], staff: null };
const dscEsc = v => String(v == null ? '' : v).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function pltApi(params) {
  return new Promise((resolve, reject) => {
    const url = (window.SUITE || {}).PLT_URL;
    if (!url) return reject(new Error('PLT_URL is missing in config.js'));
    const key = 'pcb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const s = document.createElement('script');
    const t = setTimeout(() => { done(); reject(new Error('PLT did not respond in time')); }, 60000);
    function done() { clearTimeout(t); delete window[key]; s.remove(); }
    window[key] = res => { done(); (res && res.ok === false) ? reject(new Error(res.error || 'PLT error')) : resolve(res || {}); };
    s.onerror = () => { done(); reject(new Error('PLT network error')); };
    if (!params.token) params = Object.assign({}, params, { token: erpTok() });
    s.src = url + '?' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v == null ? '' : v)).join('&') + '&callback=' + key;
    document.body.appendChild(s);
  });
}

function dscReset() {
  DSC.emp = null; DSC.list = [];
  dscRender('');
  if (!DSC.staff) pltApi({ action: 'init', limit: 0 }).then(r => { DSC.staff = r.staff || []; })
    .catch(e => toast('Could not load PLT staff list: ' + e.message, 'e'));
  setTimeout(() => document.getElementById('dsp-scan')?.focus(), 150);
}

function dscScan(raw) {
  let v = String(raw || '').trim();
  if (!v) return;
  const pre = v.match(/^(\d{2,4})[:>?](.+)$/);            // scanner ka station prefix (jaise 111:) hata do
  if (pre) v = pre[2].trim();
  const badge = v.replace(/^STAFF[^A-Za-z0-9]+/i, '').trim();
  const emp = (DSC.staff || []).find(s => String(s.id).toLowerCase() === badge.toLowerCase());
  if (emp) { DSC.emp = emp; dscRender('✓ Employee: ' + emp.name + ' (' + emp.id + ')', 'ok'); return; }
  if (!DSC.staff) { dscRender('Loading staff list — scan again in 2 seconds', 'bad'); return; }
  if (!DSC.emp) { dscRender('Scan the employee badge first', 'bad'); return; }
  if (DSC.list.some(x => x.serial.toUpperCase() === v.toUpperCase())) { dscRender(v + ' is already scanned', 'bad'); return; }
  const c = currentDispatchData;
  dscRender('Checking ' + v + '...');
  pltApi({ action: 'dispatchCheck', serial: v, itemId: c.iid }).then(r => {
    if (r.itemId !== c.iid) { dscRender(r.serial + ' does not belong to this item — ' + r.itemId + ' · ' + r.customer, 'bad'); return; }
    if (DSC.list.some(x => x.serial === r.serial)) return;
    DSC.list.push(r);
    dscRender('✓ ' + r.serial, 'ok');
  }).catch(e => dscRender(e.message, 'bad'));
}

// Scanner Enter na bheje to bhi: typing rukne ke 300ms baad scan apne aap uthao
let _dscT = null;
function dscAuto() { clearTimeout(_dscT); _dscT = setTimeout(dscFlush, 300); }
function dscFlush() {
  clearTimeout(_dscT);
  const el = document.getElementById('dsp-scan');
  if (!el || !el.value.trim()) return;
  const v = el.value; el.value = '';
  dscScan(v);
}

function dscRemove(i) { DSC.list.splice(i, 1); dscRender(''); }

function dscRender(msg, kind) {
  const e = document.getElementById('dsp-emp');
  if (e) e.innerHTML = DSC.emp
    ? '<span style="display:inline-block;background:var(--success-dim);border:1px solid var(--success-b);color:var(--success);font-weight:700;font-size:14px;padding:6px 12px;border-radius:8px;">👤 ' +
        dscEsc(DSC.emp.name) + ' (' + dscEsc(DSC.emp.id) + ')</span>' +
      ' &nbsp; Batteries scanned: <b>' + DSC.list.length + '</b>'
    : '<span style="color:var(--error);font-weight:600;">⚠ Scan the employee badge first</span>';
  const sb = document.getElementById('dsp-scan');
  if (sb) sb.placeholder = DSC.emp ? 'Now scan the battery' : 'Scan the employee badge first';                 
  const l = document.getElementById('dsp-scan-list');
  if (l) l.innerHTML = DSC.list.map((x, i) =>
        `<span style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--surface);border:1px solid var(--border);padding:3px 8px;border-radius:6px;">${dscEsc(x.serial)} <a href="javascript:void 0" onclick="dscRemove(${i})" style="text-decoration:none;color:var(--text3);">×</a></span>`).join('');
  const q = document.getElementById('dsp-qty'); if (q) q.value = DSC.list.length;
  const m = document.getElementById('dsp-scan-msg');
  if (m) { m.textContent = msg || ''; m.style.color = kind === 'bad' ? 'var(--error)' : kind === 'ok' ? 'var(--success)' : 'var(--text3)'; }
}

function submitDispatch() {
  const c = currentDispatchData;
  if (!c) return;
  const btn = document.getElementById('dsp-submit-btn');
  if (!DSC.emp) { toast('Scan the employee badge first', 'e'); document.getElementById('dsp-scan')?.focus(); return; }
  const dq = DSC.list.length;
  if (dq <= 0) { toast('Scan at least one battery', 'e'); document.getElementById('dsp-scan')?.focus(); return; }
  const transport = document.getElementById('dsp-transport').value.trim();
  if (!transport) { toast('Enter the Transport Name', 'e'); return; }
  const lrEl = document.getElementById('dsp-lr');
  const lrNo = (lrEl?.value || '').trim();
  clearErr(lrEl);
  if (!lrNo) { markErr(lrEl); toast('Enter the LR / Bilty No', 'e'); lrEl?.focus(); return; }

  // ⚠ WARNINGS — block kuch nahi, sirf confirm
  const warn = [];
  if (c.balance > 0) warn.push('Payment pending — Balance ₹' + fmt(c.balance));
  if (dq + c.disp > c.billed)   warn.push('Billed qty (' + c.billed + ') exceeded by this dispatch');
  if (dq + c.disp > c.produced) warn.push('Produced qty (' + c.produced + ') exceeded by this dispatch');
  if (dq + c.disp > c.qty)      warn.push('Order qty (' + c.qty + ') exceeded by this dispatch');
  if (warn.length) {
    const ok = confirm('⚠ Please note:\n\n• ' + warn.join('\n• ') + '\n\nDispatch anyway?');
    if (!ok) return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  // PLT ke through: ERP Dispatch + PLT Dispatched + IMS — ek saath
  pltApi({
    action: 'dispatchBatch',
    itemId: c.iid,
    serials: DSC.list.map(x => x.serial).join(','),
    transport: transport,
    lr: lrNo,
    vehicle: document.getElementById('dsp-vehicle').value,
    driver: document.getElementById('dsp-driver').value,
    date: document.getElementById('dsp-date').value,
    remarks: document.getElementById('dsp-remarks').value,
    empId: DSC.emp.id,
    empName: DSC.emp.name
  }).then(r => {
    if (btn) { btn.disabled = false; btn.textContent = '🚚 Save Dispatch'; }
    const res = (r.results || [])[0] || {};
    if (!res.ok) { toast(res.error || 'Dispatch failed', 'e'); return; }
    if (document.getElementById('dsp-fms-chk')?.checked) {
      api({ action: 'markFMSProductionDone', 'Item ID': c.iid, 'Step': 'dispatch', 'Actual': fmtDisplayDate(document.getElementById('dsp-date').value) }, () => {});
    }
    if (res.mode === 'SHADOW') toast('SHADOW mode: no ERP entry created — set MODE_DISPATCH = LIVE in Links', 'w');
    else toast('Dispatch saved! ' + res.ref + ' · ' + res.erp + ' · ' + res.count + ' battery');
    closeModal('dispatchModal');
    loadDispatch();
  }).catch(e => {
    if (btn) { btn.disabled = false; btn.textContent = '🚚 Save Dispatch'; }
    toast('Dispatch failed: ' + e.message, 'e');
  });
}

// ========== MASTER DATA ==========
// ========== CUSTOMERS (Regular / Inactive / All) ==========
let allCustInsights = [], custFilter = 'regular';

function ensureCustPipeline() {
  if (document.getElementById('custPipeline')) return;
  const tbody = document.getElementById('custTable');
  const anchor = tbody && (tbody.closest('.card') || tbody.closest('table'));
  if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin', `
    <div id="custPipeline" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;">
      <button class="btn btn-sm cust-f-btn" id="cf-regular"  onclick="filterCustomers('regular')">🔁 Regular (<span id="cfc-regular">0</span>)</button>
      <button class="btn btn-sm cust-f-btn" id="cf-inactive" onclick="filterCustomers('inactive')">⚠️ Inactive (<span id="cfc-inactive">0</span>)</button>
      <button class="btn btn-sm cust-f-btn" id="cf-all"      onclick="filterCustomers('all')">👥 All (<span id="cfc-all">0</span>)</button>
      <input class="form-control" id="custSearch" placeholder="Search name / city / phone..." oninput="renderCustomers()" style="max-width:240px;margin-left:auto;font-size:13px;">
    </div>`);
  const thead = tbody.closest('table')?.querySelector('thead');
  if (thead) thead.innerHTML = '<tr><th>Customer</th><th>City</th><th>Phone</th><th>Sales Person</th><th style="text-align:right;">Orders</th><th style="text-align:right;">Total Value</th><th>Last Order</th><th style="text-align:right;">Days Since</th><th style="text-align:right;">Avg Gap</th><th>Next Expected</th><th>Status</th><th>Actions</th></tr>';
}

function loadCustomers() {
  ensureCustPipeline();
  accEnsure(accListTools);   // Accounts: + Add → naya account, Admin: Duplicates
  const isSales = user.role === 'Sales' && user.salesName;
  document.getElementById('custTable').innerHTML = '<tr><td colspan="12"><div class="loading"><div class="spin"></div> Loading...</div></td></tr>';
  api({ action: 'getCustomerInsights', salesName: isSales ? user.salesName : '' }, r => {
    allCustInsights = (r.success && r.data) ? r.data : [];
    allCustInsights.forEach((c, i) => { c._i = i; });
    if (!r.success) toast(r.message || 'Could not load customers', 'e');
    renderCustomers();
  });
}

function filterCustomers(f) { custFilter = f; renderCustomers(); }

function renderCustomers() {
  const esc = v => String(v == null ? '' : v).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
  const all = allCustInsights;

  setText('cfc-regular',  all.filter(c => c.isRegular).length);
  setText('cfc-inactive', all.filter(c => c.isInactive).length);
  setText('cfc-all',      all.length);
  document.querySelectorAll('.cust-f-btn').forEach(b => b.classList.remove('btn-primary'));
  document.getElementById('cf-' + custFilter)?.classList.add('btn-primary');

  let data = custFilter === 'regular'  ? all.filter(c => c.isRegular)
           : custFilter === 'inactive' ? all.filter(c => c.isInactive)
           : all.slice();

  const q = (document.getElementById('custSearch')?.value || '').trim().toLowerCase();
  if (q) data = data.filter(c => [c.name, c.city, c.phone, c.salesPerson].some(v => String(v || '').toLowerCase().includes(q)));

  if (custFilter === 'regular')       data.sort((a, b) => (a.daysToNext ?? 9999) - (b.daysToNext ?? 9999));   // overdue pehle
  else if (custFilter === 'inactive') data.sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));         // sabse purana pehle
  else                                data.sort((a, b) => a.name.localeCompare(b.name));

  const tbl = document.getElementById('custTable');
  if (!data.length) { tbl.innerHTML = '<tr><td colspan="12"><div class="empty"><div class="empty-ico">👥</div><div class="empty-txt">No customers in this list</div></div></td></tr>'; return; }

  tbl.innerHTML = data.map(c => {
    const st = c.status === 'Overdue'  ? `<span class="badge b-delay">🔴 Overdue (${Math.abs(c.daysToNext)}d)</span>`
             : c.status === 'Due Soon' ? `<span class="badge b-pending">🟡 Due in ${c.daysToNext}d</span>`
             : c.status === 'On Track' ? `<span class="badge b-ready">🟢 On Track</span>` : '';
    const inact = c.isInactive ? ` <span class="badge b-credit">⚠️ Inactive</span>` : '';
    const noOrd = !c.orders ? `<span style="color:var(--text3);font-size:11px;">No orders</span>` : '';
    const dsCol = c.daysSince == null ? '—'
                : `<span style="font-weight:600;color:${c.daysSince > 30 ? 'var(--error)' : 'var(--text)'};">${c.daysSince}d</span>`;
    return `<tr>
      <td class="td-bold">${custLink(c.name, c.phone, c.cust && c.cust.CustomerID)}${ACC_MODE && c.cust ? '<div class="acc-types acc-types-sm">' + accTypeBadges(c.cust.Type) + '</div>' : ''}</td>
      <td>${esc(c.city) || '—'}</td>
      <td>${esc(c.phone) || '—'}</td>
      <td>${esc(c.salesPerson) || '—'}</td>
      <td style="text-align:right;font-weight:600;">${c.orders}</td>
      <td style="text-align:right;font-weight:600;color:var(--accent);">${c.totalValue ? '₹' + fmt(c.totalValue) : '—'}</td>
      <td>${c.lastOrder || '—'}</td>
      <td style="text-align:right;">${dsCol}</td>
      <td style="text-align:right;">${c.avgGap != null ? c.avgGap + 'd' : '—'}</td>
      <td>${c.nextExpected || '—'}</td>
      <td>${st}${inact}${noOrd}</td>
      <td style="white-space:nowrap;">
        ${(user.role === 'Sales' && c.cust) ? `<button class="btn btn-sm btn-warning" onclick="${ACC_MODE ? `openCustomer(allCustInsights[${c._i}].cust.CustomerID)` : `openCustEdit(allCustInsights[${c._i}].cust)`}" title="Edit">📝</button>` : ''}
        <button class="btn btn-sm btn-info" onclick="openCustDocs(allCustInsights[${c._i}].name)" title="Docs">📎</button>
        <button class="btn btn-sm" onclick="openBatterySpec(allCustInsights[${c._i}].name)" style="background:var(--warning-dim);color:var(--warning);border-color:var(--warning-b);" title="Battery Spec">🔋</button>
      </td>
    </tr>`;
  }).join('');
}
function submitCust() {
  api({ action:'addCustomer', CompanyName:document.getElementById('c-name').value, ContactPerson:document.getElementById('c-contact').value, Phone:document.getElementById('c-phone').value, GSTIN:document.getElementById('c-gst').value, City:document.getElementById('c-city').value, CreditDays:document.getElementById('c-credit').value, 'Added By': user.salesName || user.name || '' }, r => {
    if (r.success) { toast('Customer added'); closeModal('custModal'); loadCustomers(); } else toast(r.message,'e');
  });
}

function loadProducts() {
  api({ action: 'getProducts' }, r => {
    if (!r.success || !r.data.length) { document.getElementById('productTable').innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-ico">⚡</div><div class="empty-txt">No products</div></div></td></tr>`; return; }
    document.getElementById('productTable').innerHTML = r.data.map(p => `<tr><td class="td-id">${p.ProductID}</td><td class="td-bold">${p.ProductName}</td><td>${p.Category}</td><td>₹${fmt(p.SalePrice)}</td><td style="font-family:monospace;font-size:11px;">${p.HSNCode}</td><td>${p.GSTPercent}%</td><td>${p.Unit}</td></tr>`).join('');
  });
}
function submitProduct() {
  api({ action:'addProduct', ProductID:document.getElementById('p-id').value, ProductName:document.getElementById('p-name').value, Category:document.getElementById('p-cat').value, SalePrice:document.getElementById('p-price').value, HSNCode:document.getElementById('p-hsn').value, GSTPercent:document.getElementById('p-gst').value, Unit:document.getElementById('p-unit').value }, r => {
    if (r.success) { toast('Product added'); closeModal('prodModal'); loadProducts(); } else toast(r.message,'e');
  });
}

function loadSuppliers() {
  api({ action: 'getSuppliers' }, r => {
    if (!r.success || !r.data.length) { document.getElementById('suppTable').innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-ico">🏭</div><div class="empty-txt">No suppliers</div></div></td></tr>`; return; }
    document.getElementById('suppTable').innerHTML = r.data.map(s => `<tr><td class="td-id">${s.SupplierID}</td><td class="td-bold">${s.CompanyName}</td><td>${s.ContactPerson}</td><td>${s.Phone}</td><td style="font-family:monospace;font-size:11px;">${s.GSTIN}</td><td>${s.City}</td></tr>`).join('');
  });
}
function submitSupp() {
  api({ action:'addSupplier', SupplierID:document.getElementById('s-id').value, CompanyName:document.getElementById('s-name').value, ContactPerson:document.getElementById('s-contact').value, Phone:document.getElementById('s-phone').value, GSTIN:document.getElementById('s-gst').value, City:document.getElementById('s-city').value }, r => {
    if (r.success) { toast('Supplier added'); closeModal('suppModal'); loadSuppliers(); } else toast(r.message,'e');
  });
}

function loadUsers() {
  api({ action: 'getUsers' }, r => {
    if (!r.success || !r.data.length) { document.getElementById('usersTable').innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-ico">🔐</div><div class="empty-txt">No users</div></div></td></tr>`; return; }
    document.getElementById('usersTable').innerHTML = r.data.map(u => `<tr><td class="td-id">${u.UserID}</td><td class="td-bold">${u.Name}</td><td>${u.Username}</td><td><span class="badge b-processing">${u.Role}</span></td><td style="color:${u.IsActive===true||u.IsActive==='TRUE'?'var(--success)':'var(--error)'};">${u.IsActive===true||u.IsActive==='TRUE'?'✅ Active':'❌ Inactive'}</td></tr>`).join('');
  });
}
function submitUser() {
  api({ action:'addUser', UserID:document.getElementById('u-id').value, Name:document.getElementById('u-name').value, Username:document.getElementById('u-uname').value, Password:document.getElementById('u-pass').value, Role:document.getElementById('u-role').value, IsActive:true }, r => {
    if (r.success) { toast('User added'); closeModal('userModal'); loadUsers(); } else toast(r.message,'e');
  });
}

// ========== ACCOUNTS ==========
let allAccounts = [];
let accFilter = 'all', accProdMap = {}, accOrderValMap = {};
let accOrderFull = {};   // orderID -> poora order row (Transport Charges + PDF print ke liye)

function accStatus(a) {
  const pd = accProdMap[a['Item ID']] || {};
  return (typeof pd === 'object' ? (pd.status || 'Pending') : (pd || 'Pending'));
}

function filterAccounts(f, el) {
  accFilter = f;
  document.querySelectorAll('#accPipeline .pipe-node').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAccounts(allAccounts, accProdMap, accOrderValMap);
}

// orderPayMap: { orderID: { total, balance, orderVal } }
let orderPayMap = {};

// accItemMap: { itemID: OrderItems row } — Price Type + Rate ke liye
let accItemMap = {};

function loadAccounts() {
  document.getElementById('accountsTable').innerHTML = '<tr><td colspan="16"><div class="loading"><div class="spin"></div> Loading...</div></td></tr>';
  api({ action: 'getAccountsBundle' }, r => {
    if (!r.success || !r.accounts || !r.accounts.length) {
      document.getElementById('accountsTable').innerHTML = '<tr><td colspan="16"><div class="empty"><div class="empty-ico">💰</div><div class="empty-txt">No accounts data</div></div></td></tr>';
      return;
    }
    allAccounts       = r.accounts || [];
    const prodMap     = r.prodMap || {};
    const orderValMap = r.orderValMap || {};
    const payTotals   = r.payTotals || {};
    accItemMap        = r.itemMap || {};

    const uniqueOrderIDs = [...new Set(allAccounts.map(a => a['Order ID']))];
    const totalQty    = allAccounts.reduce((s,a) => s + (parseFloat(a['Qty'])||0), 0);
    const withCharger = allAccounts.filter(a => a['Charger Qty']).length;
    document.getElementById('acc-total').textContent   = allAccounts.length;
    document.getElementById('acc-orders').textContent  = uniqueOrderIDs.length;
    document.getElementById('acc-qty').textContent     = totalQty;
    document.getElementById('acc-charger').textContent = withCharger;

    // Production produced/pending merge
    allAccounts.forEach(a => {
      const pd = prodMap[a['Item ID']];
      if (pd) { a['Produced Qty'] = pd.producedQty; a['Pending Qty'] = pd.pendingQty; }
    });

    // orderPayMap banao
    orderPayMap = {};
    uniqueOrderIDs.forEach(orderID => {
      const received = payTotals[orderID] || 0;
      const ov = orderValMap[orderID] || 0;
      orderPayMap[orderID] = { totalReceived: received, orderVal: ov, balance: ov - received };
    });

        accProdMap = prodMap;
    accOrderValMap = orderValMap;

    // Poore order rows laao — Transport Charges dikhane aur PDF print ke liye
    api({ action: 'getOrders' }, ordRes => {
      accOrderFull = {};
      (ordRes.data || []).forEach(o => { accOrderFull[o['Order ID']] = o; });
      renderAccounts(allAccounts, prodMap, orderValMap);
    });
  });
}

function renderAccounts(data, prodMap, orderValMap) {
  prodMap = prodMap || {};
  orderValMap = orderValMap || {};

  // Pipeline counts (Production status wise) — hamesha full set pe
  setText('apc-all', allAccounts.length);
  setText('apc-pending', allAccounts.filter(a => accStatus(a) === 'Pending').length);
  setText('apc-inprog',  allAccounts.filter(a => accStatus(a) === 'In Progress').length);
  setText('apc-completed', allAccounts.filter(a => accStatus(a) === 'Completed').length);

  // Production-status filter
  if (accFilter === 'pending')         data = data.filter(a => accStatus(a) === 'Pending');
  else if (accFilter === 'inprogress') data = data.filter(a => accStatus(a) === 'In Progress');
  else if (accFilter === 'completed')  data = data.filter(a => accStatus(a) === 'Completed');

  if (!data.length) {
    document.getElementById('accountsTable').innerHTML = '<tr><td colspan="22"><div class="empty"><div class="empty-ico">💰</div><div class="empty-txt">No records match this filter</div></div></td></tr>';
    return;
  }

  // Orders group karo
  const orderGroups = {};
  const orderSeq = [];
  data.forEach(a => {
    const oid = a['Order ID'] || '';
    if (!orderGroups[oid]) { orderGroups[oid] = []; orderSeq.push(oid); }
    orderGroups[oid].push(a);
  });

  let rows = '';
  let sr = 1;
  orderSeq.forEach(orderID => {
    const items   = orderGroups[orderID];
    const count   = items.length;
    const payData = orderPayMap[orderID] || {};
    const orderVal  = payData.orderVal || orderValMap[orderID] || 0;
    const received  = payData.totalReceived || 0;
    const balance   = orderVal - received;
    const balColor  = balance <= 0 ? 'var(--success)' : balance < orderVal ? 'var(--warning)' : 'var(--error)';
    const firstItem = items[0];

    items.forEach((a, idx) => {
      const prodData   = prodMap[a['Item ID']] || {};
      const prodStatus = typeof prodData === 'object' ? (prodData.status || 'Pending') : (prodData || 'Pending');
      const prodBadge  = prodStatus === 'Completed'
        ? '<span class="badge b-ready">✅ Done</span>'
        : prodStatus === 'In Progress'
        ? '<span class="badge b-processing">⚙️ In Progress</span>'
        : prodStatus === 'Delayed'
        ? '<span class="badge b-delay">⚠️ Delayed</span>'
        : '<span class="badge b-pending">⏳ Pending</span>';

      const isFirst = idx === 0;
      const borderTop = isFirst && sr > 1 ? 'border-top:2px solid var(--border2);' : '';

      // Order-level cells sirf pehli row mein (rowspan)
      // Charger info — order level se lo (pehle item se)
      const chargerModel = firstItem['Charger Model'] || '';
      const chargerQty   = firstItem['Charger Qty'] || '';

      const transCharge = parseFloat((accOrderFull[orderID] || {})['Transportation Charges']) || 0;
      const orderCells = isFirst ? `
        <td class="td-id" rowspan="${count}" style="vertical-align:middle;${borderTop}">${orderID}</td>
        <td rowspan="${count}" style="vertical-align:middle;${borderTop}">${fmtDisplayDate(a['Order Date']||'')}</td>
        <td class="td-bold" rowspan="${count}" style="vertical-align:middle;${borderTop}">${a['Customer Name']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${borderTop}">${a['Sales Person']||''}</td>
        <td rowspan="${count}" style="vertical-align:middle;${borderTop}">${a['Assigned CRM']||''}</td>
        <td rowspan="${count}" style="font-weight:600;color:var(--accent);vertical-align:middle;${borderTop}">₹${fmt(orderVal)}</td>
        <td rowspan="${count}" style="font-weight:600;color:var(--success);vertical-align:middle;${borderTop}">₹${fmt(received)}</td>
        <td rowspan="${count}" style="font-weight:700;color:${balColor};vertical-align:middle;${borderTop}">₹${fmt(balance)}</td>
        <td rowspan="${count}" style="vertical-align:middle;${borderTop}">${transCharge ? '₹'+fmt(transCharge) : '—'}</td>
        <td rowspan="${count}" style="vertical-align:middle;${borderTop}">${chargerModel || '—'}</td>
        <td rowspan="${count}" style="vertical-align:middle;${borderTop}">${chargerQty || '—'}</td>
        <td rowspan="${count}" style="vertical-align:middle;${borderTop}">
          <button class="btn btn-sm btn-info" onclick='openAccSlipsDrawer("${orderID}","${a['Customer Name']||''}")'>📎 Slips</button>
          <button class="btn btn-sm" style="margin-top:4px;" onclick="printAccountsOrder('${orderID}')">🖨️ Print</button>
        </td>
      ` : '';

      const aProd      = parseFloat(a['Produced Qty']) || 0;
      const aTotal     = parseFloat(a['Qty']) || 0;
      const aPending   = parseFloat(a['Pending Qty']) || (aTotal - aProd);
      const aBilledQty = parseFloat(a['Billed Qty']) || 0;
      const aQtyDisp = aProd > 0
        ? `<span style="color:var(--success);font-weight:600;">${aProd}</span>/<span style="font-weight:600;">${aTotal}</span>`
        : `${aTotal}`;
      const aPendDisp = aPending > 0
        ? `<span style="color:var(--warning);font-weight:600;">${aPending}</span>`
        : `<span style="color:var(--success);font-weight:600;">0 ✅</span>`;

      const itm      = accItemMap[a['Item ID']] || {};
      const pType    = itm['Price Type'] || '—';
      const rateUnit = parseFloat(itm['Price Unit (Excluding GST)']) || 0;
      const perWatt  = parseFloat(itm['Per Watt Price']) || 0;
      const pTypeCls = pType === 'Per Watt' ? 'b-pdc' : pType === 'Absolute' ? 'b-advance' : pType === 'Last Price' ? 'b-credit' : 'b-pending';

      let rateCell;
      if (pType === 'Per Watt') {
        rateCell = perWatt
          ? `<span style="font-weight:600;color:var(--purple);">₹${fmt(perWatt)}/W</span>` +
            (rateUnit ? `<div style="font-size:10px;color:var(--text3);">= ₹${fmt(rateUnit)}/unit</div>` : '')
          : '<span style="color:var(--text3);">—</span>';
      } else {
        rateCell = rateUnit
          ? `<span style="font-weight:600;color:var(--text);">₹${fmt(rateUnit)}/unit</span>`
          : '<span style="color:var(--text3);">—</span>';
      }

      rows += `<tr style="${borderTop}">
        <td style="${borderTop}">${sr++}</td>
        <td class="td-id" style="${borderTop}">${a['Item ID']||''}</td>
        ${orderCells}
        <td style="${borderTop}">${a['Product Model']||''}</td>
        <td style="${borderTop}">${a['Battery Type']||''}</td>
        <td style="${borderTop}">${pType !== '—' ? `<span class="badge ${pTypeCls}">${pType}</span>` : '—'}</td>
        <td style="${borderTop}">${rateCell}</td>
        <td style="${borderTop}">${aQtyDisp}</td>
        <td style="${borderTop}">${aPendDisp}</td>
        <td style="${borderTop};font-weight:600;color:var(--purple);">${aBilledQty > 0 ? aBilledQty : '—'}</td>
        <td style="${borderTop}">${prodBadge}</td>
        <td style="${borderTop}"><button class="btn btn-sm btn-primary" onclick='openBillingModal(${JSON.stringify(a)})'>🧾 Bill</button></td>
      </tr>`;
    });
  });

  document.getElementById('accountsTable').innerHTML = rows;
}

// ========== BILLING ==========
let currentBillingData = {};

function openBillingModal(a) {
  currentBillingData = a;
  document.getElementById('bl-orderid-display').textContent  = a['Order ID'] || '';
  document.getElementById('bl-itemid-display').textContent   = a['Item ID'] || '';
  document.getElementById('bl-product-display').textContent  = a['Product Model'] || '';
  document.getElementById('bl-total-qty').textContent        = a['Qty'] || 0;
  document.getElementById('bl-produced-qty').textContent     = a['Produced Qty'] || 0;
  document.getElementById('bl-invoice-date').value           = '';
  document.getElementById('bl-invoice-no').value             = '';
  document.getElementById('bl-billed-qty-input').value       = a['Produced Qty'] || '';
  document.getElementById('bl-invoice-amount').value         = '';
  document.getElementById('bl-remarks').value                = '';
  document.getElementById('bl-billed-qty').textContent       = a['Billed Qty'] || 0;
  document.getElementById('bl-fms-chk').checked              = false;
  openModal('billingModal');
  loadBillingHistory(a['Order ID'], a['Item ID']);
}

function toggleBillingFMS() {
  const chk    = document.getElementById('bl-fms-chk');
  const dateEl = document.getElementById('bl-invoice-date');
  if (!chk || !dateEl) return;
  if (chk.checked) {
    if (!dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  } else {
    dateEl.value = '';
  }
}

function loadBillingHistory(orderID, itemID) {
  const el = document.getElementById('bl-history');
  el.innerHTML = '<div class="loading"><div class="spin"></div></div>';
  api({ action: 'getBillings', 'Order ID': orderID, 'Item ID': itemID }, r => {
    if (!r.success || !r.data.length) {
      el.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text3);font-size:12px;">No billing entries yet</div>';
      return;
    }
    el.innerHTML = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Previous Billings</div>' +
      r.data.map(b => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:5px;background:var(--surface);">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);">Invoice: ${b['Invoice No']||'—'} &nbsp;|&nbsp; Qty: ${b['Billed Qty']||0} &nbsp;|&nbsp; ₹${fmt(b['Invoice Amount']||0)}</div>
            <div style="font-size:11px;color:var(--text3);">${b['Invoice Date']||''} ${b['Remarks']?'· '+b['Remarks']:''}</div>
          </div>
          <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text3);">${b['Billing ID']||''}</span>
        </div>`).join('');
  });
}

function submitBilling() {
  const btn = document.getElementById('bl-submit-btn');
  const invoiceNo = document.getElementById('bl-invoice-no').value.trim();
  if (!invoiceNo) { toast('Enter the Invoice No', 'e'); return; }
  const billedQty = parseFloat(document.getElementById('bl-billed-qty-input').value) || 0;
  if (!billedQty) { toast('Enter the Billed Qty', 'e'); return; }
  const amount = parseFloat(document.getElementById('bl-invoice-amount').value) || 0;
  if (!amount) { toast('Enter the Invoice Amount', 'e'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  api({
    action: 'addBilling',
    'Order ID':       currentBillingData['Order ID'] || '',
    'Item ID':        currentBillingData['Item ID'] || '',
    'Invoice No':     invoiceNo,
    'Invoice Date':   document.getElementById('bl-invoice-date').value,
    'Billed Qty':     billedQty,
    'Invoice Amount': amount,
    'Remarks':        document.getElementById('bl-remarks').value,
    'Added By':       user.name || ''
  }, r => {
    if (btn) { btn.disabled = false; btn.textContent = '🧾 Save Billing'; }
    if (r.success) {
      // FMS: Billing checkbox ticked hai to us step ko Done karo
      if (document.getElementById('bl-fms-chk')?.checked) {
        api({ action: 'markFMSProductionDone', 'Item ID': currentBillingData['Item ID'] || '', 'Step': 'billing', 'Actual': fmtDisplayDate(document.getElementById('bl-invoice-date').value) }, () => {});
      }
      toast('Billing saved! ' + r.billingID);
      document.getElementById('bl-invoice-no').value    = '';
      document.getElementById('bl-billed-qty-input').value = '';
      document.getElementById('bl-invoice-amount').value = '';
      document.getElementById('bl-remarks').value        = '';
      loadBillingHistory(currentBillingData['Order ID'], currentBillingData['Item ID']);
      loadAccounts();
    } else {
      toast(r.message || 'Failed', 'e');
    }
  });
}

function viewOrderPayments(orderID, custName, orderVal) {
  document.getElementById('vp-orderid').textContent  = orderID;
  document.getElementById('vp-custname').textContent = custName;
  document.getElementById('vp-orderval').textContent = '₹' + fmt(orderVal||0);
  document.getElementById('vp-list').innerHTML = '<div class="loading"><div class="spin"></div></div>';
  document.getElementById('vp-total').textContent   = '₹0';
  document.getElementById('vp-balance').textContent = '—';
  openModal('viewPaymentsModal');
  api({ action: 'getPayments', 'Order ID': orderID }, r => {
    if (!r.success || !r.data.length) {
      document.getElementById('vp-list').innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">No payment entries yet</div>';
      document.getElementById('vp-total').textContent   = '₹0';
      document.getElementById('vp-balance').textContent = '₹' + fmt(orderVal||0);
      return;
    }
    const total   = r.totalReceived || 0;
    const balance = (parseFloat(orderVal)||0) - total;
    document.getElementById('vp-total').textContent   = '₹' + fmt(total);
    document.getElementById('vp-balance').textContent = '₹' + fmt(balance);
    document.getElementById('vp-list').innerHTML = r.data.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">💵</span>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--success);">₹${fmt(p['Amount']||0)}</div>
            <div style="font-size:11px;color:var(--text3);">${p['Date']||''} · ${p['Mode']||''} ${p['Reference']?'· '+p['Reference']:''}</div>
            ${p['Remarks']?`<div style="font-size:11px;color:var(--text3);">${p['Remarks']}</div>`:''}
          </div>
        </div>
        <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text3);">${p['Payment ID']||''}</span>
      </div>`).join('');
  });
}

function searchAccounts() {
  const q = (document.getElementById('accSearch').value||'').toLowerCase();
  if (!q) { loadAccounts(); return; }
  const filtered = allAccounts.filter(a =>
    (a['Order ID']||'').toLowerCase().includes(q) ||
    (a['Customer Name']||'').toLowerCase().includes(q) ||
    (a['Product Model']||'').toLowerCase().includes(q)
  );
  renderAccounts(filtered, accProdMap, accOrderValMap);
}

function logout() {
  sessionStorage.removeItem('erp_staff');
  sessionStorage.removeItem('erp_user');
  localStorage.removeItem('erp_user');   // backup bhi hatao, warna dobara auto-login ho jayega
  sessionStorage.removeItem('erp_token'); localStorage.removeItem('erp_token');
  window.location.href = 'index.html';
}

// ========== LEADS (ERP ke andar) ==========
// Sales: sirf apni leads (backend filter karta hai) · Admin: sab + Assigned To badal sakta hai
const LD_STAGES = ['New Lead', 'Quotation Sent', 'Follow-up', 'Order Confirmed', 'Lost'];
const LD_SHORT  = { 'New Lead': 'New', 'Quotation Sent': 'Quotation', 'Follow-up': 'Follow-up', 'Order Confirmed': 'Won', 'Lost': 'Lost' };
const LD_EMOJI  = { 'New Lead': '🆕', 'Quotation Sent': '📄', 'Follow-up': '📞', 'Order Confirmed': '✅', 'Lost': '❌' };
const LD_NEXT   = { 'New Lead': 'Quotation Sent', 'Quotation Sent': 'Follow-up', 'Follow-up': 'Order Confirmed' };
let ldAll = [], ldMe = { admin: false }, ldPeople = [], ldStage = 'Open', ldDueOnly = false, ldLoaded = false;

const ldEsc = v => String(v == null ? '' : v).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
function ldToday() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function ldAddDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function ldDmy(ymd) { const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (ymd || ''); }
function ldOpen(l) { return l.Stage !== 'Order Confirmed' && l.Stage !== 'Lost'; }
function ldDue(l) { return ldOpen(l) && l['Next Follow-up'] && l['Next Follow-up'] <= ldToday(); }
function ldBadge(st) { return `<span class="ld-st ld-st-${(LD_SHORT[st] || 'New').toLowerCase().replace(/[^a-z]/g, '')}">${LD_EMOJI[st] || ''} ${ldEsc(LD_SHORT[st] || st)}</span>`; }

function loadLeads(page) {
  const tb = document.getElementById('ldTable');
  if (!ldLoaded && tb) tb.innerHTML = '<tr><td colspan="8"><div class="loading"><div class="spin"></div></div></td></tr>';
  api({ action: 'getLeads' }, r => {
    if (!r || !r.success) { if (tb) tb.innerHTML = `<tr><td colspan="8" class="ld-empty">${ldEsc((r && r.message) || 'Could not load leads')}</td></tr>`; return; }
    ldAll = r.data || []; ldMe = r.me || {}; ldPeople = r.salesPeople || []; ldLoaded = true;
    document.querySelectorAll('.ld-adm').forEach(el => el.style.display = ldMe.admin ? '' : 'none');
    const ow = document.getElementById('ldOwner');
    if (ow) {
      const cur = ow.value;
      ow.style.display = ldMe.admin ? '' : 'none';
      ow.innerHTML = '<option value="">Sab salesperson</option>' + ldPeople.map(n => `<option>${ldEsc(n)}</option>`).join('') + '<option value="__none">Unassigned</option>';
      ow.value = cur;
    }
    if (page === 'leaddash') renderLeadDash(); else renderLeads();
  });
}

function ldToggleDue() { ldDueOnly = !ldDueOnly; document.getElementById('ldDueBtn').classList.toggle('ld-on', ldDueOnly); renderLeads(); }
function ldSetStage(s) { ldStage = s; renderLeads(); }

function ldVisible() {   // Admin ke owner filter ke baad
  const ow = (document.getElementById('ldOwner') || {}).value || '';
  return ldAll.filter(l => !ow || (ow === '__none' ? !l['Assigned To'] : l['Assigned To'] === ow));
}

function renderLeads() {
  const base = ldVisible();
  const cnt = s => base.filter(l => l.Stage === s).length;
  const due = base.filter(ldDue).length;
  document.getElementById('ldKpis').innerHTML = [
    ['Open leads', base.filter(ldOpen).length, ''], ['Quotation', cnt('Quotation Sent'), ''], ['Follow-up', cnt('Follow-up'), ''],
    ['Won', cnt('Order Confirmed'), 'c-green'], ['Due today / overdue', due, due ? 'c-red' : '']
  ].map(([l, v, c]) => `<div class="stat ${c}"><div class="stat-lbl">${l}</div><div class="stat-val">${v}</div></div>`).join('');
  const tabs = [['Open', 'Open', base.filter(ldOpen).length]].concat(LD_STAGES.map(s => [s, LD_EMOJI[s] + ' ' + LD_SHORT[s], cnt(s)])).concat([['All', 'All', base.length]]);
  document.getElementById('ldStageTabs').innerHTML = tabs.map(([k, t, n]) =>
    `<button class="ld-tab${ldStage === k ? ' on' : ''}" onclick="ldSetStage('${k}')">${t} <b>${n}</b></button>`).join('');
  const q = (document.getElementById('ldSearch').value || '').trim().toLowerCase();
  let rows = base.filter(l => ldStage === 'All' ? true : ldStage === 'Open' ? ldOpen(l) : l.Stage === ldStage);
  if (ldDueOnly) rows = rows.filter(ldDue);
  if (q) rows = rows.filter(l => [l['Lead ID'], l['Customer Name'], l.Company, l.Phone, l.City, l.State, l.Notes].join(' ').toLowerCase().includes(q));
  // follow-up wali (pehle overdue) upar, phir nayi
  rows = rows.slice().sort((a, b) => {
    const fa = ldOpen(a) && a['Next Follow-up'] ? a['Next Follow-up'] : '9999', fb = ldOpen(b) && b['Next Follow-up'] ? b['Next Follow-up'] : '9999';
    return fa < fb ? -1 : fa > fb ? 1 : (b['Lead ID'] > a['Lead ID'] ? 1 : -1);
  });
  const tb = document.getElementById('ldTable'), td = ldToday();
  if (!rows.length) { tb.innerHTML = `<tr><td colspan="8" class="ld-empty">${ldAll.length ? 'No leads match this filter' : 'No leads yet — start with <b>+ New Lead</b>'}</td></tr>`; return; }
  tb.innerHTML = rows.map(l => {
    const f = l['Next Follow-up'], open = ldOpen(l);
    const fcls = open && f ? (f < td ? 'ld-over' : f === td ? 'ld-today' : '') : '';
    const req = [l.Voltage, l.Capacity, l['No. of Batteries'] ? '× ' + l['No. of Batteries'] : ''].filter(Boolean).join(' ');
    const nx = LD_NEXT[l.Stage];
    return `<tr>
      <td class="td-id">${ldEsc(l['Lead ID'])}<div class="ld-sub">${ldDmy(l['Date Added'])}${l['Lead Source'] ? ' · ' + ldEsc(l['Lead Source']) : ''}</div></td>
      <td class="td-bold">${custLink(l['Customer Name'], l.Phone, l['Customer ID'], l.Company || l['Customer Name'])}${(l.Company && l.Company !== l['Customer Name']) || l.City ? `<div class="ld-sub">${ldEsc([l.Company !== l['Customer Name'] ? l.Company : '', l.City].filter(Boolean).join(' · '))}</div>` : ''}</td>
      <td><a class="ld-tel" href="tel:${ldEsc(l.Phone)}">${ldEsc(l.Phone)}</a> <a class="ld-wa" href="https://wa.me/91${ldEsc(String(l.Phone).slice(-10))}" target="_blank" title="WhatsApp">💬</a></td>
      <td>${ldEsc(String(l['Application Type'] || '').replace(/\s*\(.*\)$/, ''))}${req ? `<div class="ld-sub">${ldEsc(req)}</div>` : ''}</td>
      <td>${ldBadge(l.Stage)}${l.Stage === 'Lost' && l['Lost Reason'] ? `<div class="ld-sub">${ldEsc(l['Lost Reason'])}</div>` : ''}${l['Order ID'] ? `<div class="ld-sub">📦 ${ordLink(l['Order ID'])}</div>` : ''}</td>
      <td class="${fcls}">${open && f ? ldDmy(f) + (fcls === 'ld-over' ? ' ⚠' : fcls === 'ld-today' ? ' • aaj' : '') : '—'}</td>
      <td class="ld-adm"${ldMe.admin ? '' : ' style="display:none"'}>${ldEsc(l['Assigned To']) || '<span class="ld-muted">—</span>'}</td>
      <td class="ld-act"><button class="btn btn-sm" onclick="openLeadModal('${ldEsc(l['Lead ID'])}')">Edit</button>${l.Stage === 'Order Confirmed' && !l['Order ID'] ? `<button class="btn btn-sm btn-primary" onclick="ldToOrder('${ldEsc(l['Lead ID'])}')" title="Create an order from this lead">📦 Order</button>` : ''}${nx ? `<button class="btn btn-sm" onclick="ldMoveNext('${ldEsc(l['Lead ID'])}')" title="Next stage: ${ldEsc(LD_SHORT[nx])}">${LD_EMOJI[nx]} ›</button>` : ''}</td>
    </tr>`;
  }).join('');
}

// ---- Add / Edit ----
function ldPickStage(s) {
  document.querySelectorAll('#ldPills .ld-pill').forEach(b => b.classList.toggle('on', b.dataset.s === s));
  document.getElementById('ldPills').dataset.stage = s;
  document.getElementById('ld-lost-wrap').style.display = s === 'Lost' ? '' : 'none';
}
const LD_MAP = [['ld-name', 'Customer Name'], ['ld-phone', 'Phone'], ['ld-company', 'Company'], ['ld-email', 'Email'], ['ld-city', 'City'], ['ld-state', 'State'],
  ['ld-app', 'Application Type'], ['ld-volt', 'Voltage'], ['ld-cap', 'Capacity'], ['ld-qty', 'No. of Batteries'], ['ld-budget', 'Budget Range'],
  ['ld-brand', 'Existing Brand'], ['ld-source', 'Lead Source'], ['ld-follow', 'Next Follow-up'], ['ld-lost', 'Lost Reason'], ['ld-notes', 'Notes']];

function openLeadModal(id) {
  const l = id ? ldAll.find(x => x['Lead ID'] === id) : null;
  document.getElementById('ld-id').value = l ? l['Lead ID'] : '';
  document.getElementById('ldModalTitle').textContent = l ? `${l['Lead ID']} — ${l['Customer Name']}` : 'New Lead';
  LD_MAP.forEach(([el, k]) => {
    const e = document.getElementById(el); let v = l ? (l[k] || '') : '';
    if (e.tagName === 'SELECT' && v && ![...e.options].some(o => o.value === v)) e.insertAdjacentHTML('beforeend', `<option>${ldEsc(v)}</option>`);   // purani value bhi dikhe
    e.value = v;
  });
  if (!l) document.getElementById('ld-follow').value = ldAddDays(1);
  ldPickStage(l ? l.Stage : 'New Lead');
  // Assigned To — sirf Admin badal sakta hai
  const aw = document.getElementById('ld-assign-wrap'), as = document.getElementById('ld-assign');
  const admin = !!ldMe.admin || user.role === 'Admin';
  aw.style.display = admin ? '' : 'none';
  as.innerHTML = '<option value="">-- Unassigned --</option>' + ldPeople.map(n => `<option>${ldEsc(n)}</option>`).join('');
  if (l && l['Assigned To'] && ![...as.options].some(o => o.value === l['Assigned To'])) as.insertAdjacentHTML('beforeend', `<option>${ldEsc(l['Assigned To'])}</option>`);
  as.value = l ? (l['Assigned To'] || '') : '';
  document.getElementById('ldDelBtn').style.display = (l && admin) ? '' : 'none';
  document.getElementById('ldMeta').innerHTML = l ? `Banai: ${ldEsc(l['Created By'])} · ${ldDmy(l['Date Added'])}${l['Last Updated'] ? ` &nbsp;·&nbsp; Aakhri badlav: ${ldEsc(l['Updated By'])} · ${ldEsc(l['Last Updated'])}` : ''}` : '';
  // customer suggestions (ERP Customers)
  const fill = () => { document.getElementById('ldCustList').innerHTML = custCache.map(c => `<option value="${ldEsc(c.CompanyName)}">${ldEsc([c.ContactPerson, c.City].filter(Boolean).join(' · '))}</option>`).join(''); };
  if (custCache.length) fill(); else api({ action: 'getCustomers' }, r => { custCache = (r.success && r.data) ? r.data : []; fill(); });
  if (!ldLoaded && admin) api({ action: 'getLeads' }, r => { if (r && r.success) { ldPeople = r.salesPeople || []; ldMe = r.me || ldMe; ldAll = r.data || []; ldLoaded = true;
    const keep = as.value; as.innerHTML = '<option value="">-- Unassigned --</option>' + ldPeople.map(n => `<option>${ldEsc(n)}</option>`).join(''); as.value = keep; } });
  openModal('leadModal');
}

function ldFillCustomer() {   // ERP customer chuna → phone/city/company bhar do (khaali ho to)
  const n = document.getElementById('ld-name').value.trim().toLowerCase();
  const c = custCache.find(x => String(x.CompanyName || '').trim().toLowerCase() === n);
  if (!c) return;
  [['ld-phone', c.Phone], ['ld-city', c.City], ['ld-company', c.CompanyName]].forEach(([id, v]) => { const e = document.getElementById(id); if (e && !e.value && v) e.value = v; });
}

function saveLead(force) {
  const id = document.getElementById('ld-id').value;
  const d = { action: 'saveLead', Stage: document.getElementById('ldPills').dataset.stage || 'New Lead' };
  if (id) d['Lead ID'] = id;
  LD_MAP.forEach(([el, k]) => { d[k] = document.getElementById(el).value.trim(); });
  if (document.getElementById('ld-assign-wrap').style.display !== 'none') d['Assigned To'] = document.getElementById('ld-assign').value;
  if (!d['Customer Name']) return toast('Enter the customer name', 'e');
  if (String(d.Phone).replace(/\D/g, '').length < 10) return toast('Enter a valid phone number (10 digits)', 'e');
  if (!d['Application Type']) return toast('Choose an application type', 'e');
  if (d.Stage === 'Lost' && !d['Lost Reason']) return toast('Enter the reason for Lost', 'e');
  if (force) d.force = '1';
  const btn = document.getElementById('ldSaveBtn'); btn.disabled = true; btn.textContent = 'Saving…';
  api(d, r => {
    btn.disabled = false; btn.textContent = 'Save Lead';
    if (r && r.duplicate) { if (confirm('⚠ ' + r.message + '\n\nCreate a new lead anyway?')) saveLead(true); return; }
    if (!r || !r.success) return toast((r && r.message) || 'Save failed', 'e');
    toast(id ? `${r.id} updated` : `Lead ${r.id} created`, 's');
    closeModal('leadModal');
    const pg = document.querySelector('.page.active');
    loadLeads(pg && pg.id === 'page-leaddash' ? 'leaddash' : 'leads');
  });
}

function ldMoveNext(id) {
  const l = ldAll.find(x => x['Lead ID'] === id), nx = l && LD_NEXT[l.Stage];
  if (!nx) return;
  const d = { action: 'saveLead', 'Lead ID': id, Stage: nx };
  if (nx === 'Follow-up' && (!l['Next Follow-up'] || l['Next Follow-up'] <= ldToday())) d['Next Follow-up'] = ldAddDays(2);   // follow-up ki date aage
  api(d, r => {
    if (!r || !r.success) return toast((r && r.message) || 'Stage not changed', 'e');
    toast(`${id} → ${LD_SHORT[nx]}`, 's');
    loadLeads('leads');
  });
}

function deleteLead() {
  const id = document.getElementById('ld-id').value;
  if (!id || !confirm('Delete ' + id + '? This cannot be undone.')) return;
  api({ action: 'deleteLead', 'Lead ID': id }, r => {
    if (!r || !r.success) return toast((r && r.message) || 'Delete failed', 'e');
    toast(id + ' deleted', 's'); closeModal('leadModal'); loadLeads('leads');
  });
}

// ---- Dashboard ----
function ldBars(el, pairs, total) {
  const max = Math.max(1, ...pairs.map(p => p[1]));
  document.getElementById(el).innerHTML = pairs.length ? pairs.map(([k, v, cls]) =>
    `<div class="ld-bar"><span class="ld-bar-k">${ldEsc(k)}</span><span class="ld-bar-t"><i class="${cls || ''}" style="width:${Math.round(v / max * 100)}%"></i></span><b>${v}</b><span class="ld-muted">${total ? Math.round(v / total * 100) + '%' : ''}</span></div>`).join('')
    : '<div class="ld-empty">No data yet</div>';
}
function renderLeadDash() {
  const L = ldVisible(), n = L.length, won = L.filter(l => l.Stage === 'Order Confirmed').length, lost = L.filter(l => l.Stage === 'Lost').length;
  const closed = won + lost, conv = closed ? Math.round(won / closed * 100) : 0;
  const week = L.filter(l => ldOpen(l) && l['Next Follow-up'] && l['Next Follow-up'] <= ldAddDays(7)).sort((a, b) => a['Next Follow-up'] < b['Next Follow-up'] ? -1 : 1);
  const thisMonth = ldToday().slice(0, 7);
  document.getElementById('ldDashKpis').innerHTML = [
    ['Total leads', n, ''], ['New this month', L.filter(l => String(l['Date Added']).slice(0, 7) === thisMonth).length, ''],
    ['Open', L.filter(ldOpen).length, ''], ['Won', won, 'c-green'], ['Lost', lost, ''], ['Conversion (won / closed)', conv + '%', 'c-amber']
  ].map(([l, v, c]) => `<div class="stat ${c}"><div class="stat-lbl">${l}</div><div class="stat-val">${v}</div></div>`).join('');
  ldBars('ldFunnel', LD_STAGES.map(s => [LD_EMOJI[s] + ' ' + LD_SHORT[s], L.filter(l => l.Stage === s).length, 'ld-c-' + LD_SHORT[s].toLowerCase().replace(/[^a-z]/g, '')]), n);
  const group = k => { const m = {}; L.forEach(l => { const v = l[k] || '(khaali)'; m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8); };
  ldBars('ldSources', group('Lead Source'), n);
  ldBars('ldApps', group('Application Type'), n);
  const ppl = {}; L.forEach(l => { const k = l['Assigned To'] || 'Unassigned'; (ppl[k] = ppl[k] || []).push(l); });
  document.getElementById('ldPeople').innerHTML = Object.entries(ppl).sort((a, b) => b[1].length - a[1].length).map(([k, a]) => {
    const w = a.filter(l => l.Stage === 'Order Confirmed').length, ls = a.filter(l => l.Stage === 'Lost').length, c = w + ls;
    return `<tr><td class="td-bold">${ldEsc(k)}</td><td>${a.length}</td><td>${a.filter(ldOpen).length}</td><td>${w}</td><td>${ls}</td><td>${c ? Math.round(w / c * 100) + '%' : '—'}</td><td>${a.filter(l => ldDue(l) && l['Next Follow-up'] < ldToday()).length || '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="7" class="ld-empty">No data yet</td></tr>';
  document.getElementById('ldWeekCount').textContent = week.length + ' follow-up';
  const td = ldToday();
  document.getElementById('ldWeek').innerHTML = week.map(l => `<tr onclick="openLeadModal('${ldEsc(l['Lead ID'])}')" style="cursor:pointer">
    <td class="${l['Next Follow-up'] < td ? 'ld-over' : l['Next Follow-up'] === td ? 'ld-today' : ''}">${ldDmy(l['Next Follow-up'])}</td><td class="td-id">${ldEsc(l['Lead ID'])}</td>
    <td class="td-bold">${ldEsc(l['Customer Name'])}</td><td>${ldEsc(l.Phone)}</td><td>${ldBadge(l.Stage)}</td>
    <td class="ld-adm"${ldMe.admin ? '' : ' style="display:none"'}>${ldEsc(l['Assigned To'])}</td></tr>`).join('') || '<tr><td colspan="6" class="ld-empty">No follow-ups in the next 7 days</td></tr>';
}

const DEALER_CHECK_URL = 'https://litpax-technology.github.io/Dealer-Check/';

function goToDealerCheck() {
  window.open(DEALER_CHECK_URL, '_blank');   // nayi tab — ERP wahin khula rahega
}

// ========== APPS LAUNCHER (mobile tap + bahar click pe band) ==========
function toggleAppsMenu(e) {
  e.stopPropagation();
  document.getElementById('appsMenu')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  const m = document.getElementById('appsMenu');
  if (m && !m.contains(e.target)) m.classList.remove('open');
});

// ========== PAYMENT SLIPS (legacy) ==========
function loadSlips(orderID) {
  const el = document.getElementById('slipsList');
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--text3);">Loading...</div>';
  api({ action: 'getSlips', orderID }, r => {
    if (!r.success) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);">No slips found</div>'; return; }
    if (!r.data.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);">No slips uploaded yet</div>'; return; }
    el.innerHTML = r.data.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
        <div>
          <div style="font-size:12px;font-weight:500;color:var(--text);">📎 ${s.name}</div>
          <div style="font-size:11px;color:var(--text3);">Uploaded: ${s.date}</div>
        </div>
        <a href="${s.url}" target="_blank" class="btn btn-sm btn-info" style="text-decoration:none;">View</a>
      </div>`).join('');
  });
}

// ========== ACCOUNTS SLIPS DRAWER ==========
function openAccSlipsDrawer(orderID, custName) {
  document.getElementById('payDrawerTitle').textContent = '📎 ' + orderID + ' Slips';
  document.getElementById('payDrawerSub').textContent   = custName;
  // Hide upload section for accounts role
  const uploadSection = document.getElementById('payUploadZone');
  const uploadStatus  = document.getElementById('payUploadStatus');
  const uploadBtn     = document.getElementById('payUploadBtn');
  const uploadLabel   = uploadBtn ? uploadBtn.parentElement.querySelector('[style*="Upload"]') : null;
  if (user.role === 'Accounts') {
    if (uploadSection) uploadSection.style.display = 'none';
    if (uploadBtn) uploadBtn.style.display = 'none';
    if (uploadStatus) uploadStatus.style.display = 'none';
    // Hide "Upload New Proof" label
    document.querySelectorAll('.pay-drawer-body > div[style*="font-size:11px"]').forEach(el => {
      if (el.textContent.includes('Upload New Proof')) el.style.display = 'none';
    });
  }
  loadPaySlips(orderID, custName);
  document.getElementById('payDrawer').classList.add('open');
  document.getElementById('payDrawerOverlay').classList.add('show');
}

// ========== PAYMENT DRAWER ==========
let currentPayOrder = null;

function openPayDrawerFromDetail() {
  if (!currentEditOrder) return;
  closeModal('orderDetailModal');
  openPayDrawer(currentEditOrder);
}

function openPayDrawer(o) {
  currentPayOrder = o;
  const orderID  = o['Order ID'] || '';
  const custName = o['Customer Name'] || '';
  const total    = o['Total Order Value'] ? '₹' + Number(o['Total Order Value']).toLocaleString('en-IN') : '';
  document.getElementById('payDrawerTitle').textContent = '💳 ' + orderID;
  document.getElementById('payDrawerSub').textContent   = custName + (total ? ' | ' + total : '');
  document.getElementById('paySlipInput').value = '';
  document.getElementById('paySlipNote').value = '';
  document.getElementById('payUploadPrompt').style.display = 'block';
  document.getElementById('payFilePreview').style.display  = 'none';
  document.getElementById('payUploadBtn').disabled = true;
  document.getElementById('payUploadStatus').style.display = 'none';
  document.getElementById('payUploadZone').classList.remove('has-file');
  document.getElementById('payDrawer').classList.add('open');
  document.getElementById('payDrawerOverlay').classList.add('show');
  loadPaySlips(orderID, custName);
}

function closePayDrawer() {
  document.getElementById('payDrawer').classList.remove('open');
  document.getElementById('payDrawerOverlay').classList.remove('show');
  currentPayOrder = null;
}

function loadPaySlips(orderID, custName) {
  const el = document.getElementById('payDrawerSlips');
  el.innerHTML = '<div class="loading"><div class="spin"></div></div>';
  api({ action: 'getSlips', orderID }, r => {
    if (!r.success || !r.data.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">No payments uploaded yet</div>';
      return;
    }
    el.innerHTML = r.data.map(s => `
      <div class="slip-item">
        <span class="slip-icon">${s.name.endsWith('.pdf') ? '📄' : '🖼️'}</span>
        <div class="slip-info">
          <div class="slip-name">${s.name}</div>
          <div class="slip-date">${s.date}</div>
          ${s.note ? `<div style="font-size:11px;color:var(--text2);margin-top:3px;padding:4px 8px;background:var(--surface2);border-radius:4px;border-left:2px solid var(--accent);">📝 ${s.note}</div>` : ''}
        </div>
        <a href="${s.url}" target="_blank" class="btn btn-sm btn-info" style="text-decoration:none;flex-shrink:0;">View</a>
      </div>`).join('');
  });
}

function onPaySlipSelect() {
  const file = document.getElementById('paySlipInput').files[0];
  if (!file) return;
  document.getElementById('payUploadPrompt').style.display = 'none';
  document.getElementById('payFilePreview').style.display  = 'block';
  document.getElementById('payFileName').textContent = file.name;
  document.getElementById('payUploadZone').classList.add('has-file');
  document.getElementById('payUploadBtn').disabled = false;
  const thumb = document.getElementById('payFileThumb');
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => { thumb.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:120px;border-radius:8px;margin:0 auto;display:block;">`; };
    reader.readAsDataURL(file);
  } else {
    thumb.innerHTML = '<div style="font-size:36px;text-align:center;">📄</div>';
  }
}

function uploadPaySlip() {
  const file = document.getElementById('paySlipInput').files[0];
  if (!file || !currentPayOrder) return;
  const orderID  = currentPayOrder['Order ID'] || '';
  const custName = (currentPayOrder['Customer Name'] || '').replace(/[^a-zA-Z0-9]/g, '');
  const ext      = file.name.split('.').pop();
  const fileName = orderID + '_' + custName + '_' + Date.now() + '.' + ext;
  const mimeType = file.type || 'image/jpeg';
  const btn    = document.getElementById('payUploadBtn');
  const status = document.getElementById('payUploadStatus');
  btn.disabled = true; btn.textContent = 'Uploading...';
  status.style.display = 'block'; status.style.color = 'var(--warning)'; status.textContent = '⏳ Uploading...';
  if (file.size > 4 * 1024 * 1024) { status.style.color = 'var(--error)'; status.textContent = '❌ File is larger than 4MB'; btn.disabled = false; btn.textContent = '⬆ Upload Payment Proof'; return; }

  api({ action: 'getAccessToken' }, tokenRes => {
    const token = tokenRes?.token || '';
    if (!token) { status.style.color = 'var(--error)'; status.textContent = '❌ Auth error'; btn.disabled = false; btn.textContent = '⬆ Upload Payment Proof'; return; }
    api({ action: 'getUploadUrl', orderID, fileName, mimeType }, folderRes => {
      if (!folderRes.success) { status.style.color = 'var(--error)'; status.textContent = '❌ Folder error'; btn.disabled = false; btn.textContent = '⬆ Upload Payment Proof'; return; }
      const folderId = folderRes.folderId;
      const note = (document.getElementById('paySlipNote')?.value || '').trim();
      const meta = JSON.stringify({ name: fileName, parents: [folderId], description: note });
      const form = new FormData();
      form.append('metadata', new Blob([meta], { type: 'application/json' }));
      form.append('file', new Blob([file], { type: mimeType }));
      fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: form })
      .then(r => r.json())
      .then(data => {
        btn.disabled = false; btn.textContent = '⬆ Upload Payment Proof';
        if (data.id) {
          fetch('https://www.googleapis.com/drive/v3/files/' + data.id + '/permissions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }) });
          status.style.color = 'var(--success)'; status.textContent = '✅ Uploaded successfully!';
          document.getElementById('paySlipInput').value = '';
          document.getElementById('paySlipNote').value = '';
          document.getElementById('payUploadPrompt').style.display = 'block';
          document.getElementById('payFilePreview').style.display  = 'none';
          document.getElementById('payUploadZone').classList.remove('has-file');
          btn.disabled = true;
          setTimeout(() => loadPaySlips(orderID, custName), 500);
        } else { status.style.color = 'var(--error)'; status.textContent = '❌ Upload failed'; }
      })
      .catch(err => { btn.disabled = false; btn.textContent = '⬆ Upload Payment Proof'; status.style.color = 'var(--error)'; status.textContent = '❌ ' + err.message; });
    });
  });
}

// ========== CUSTOMER DOCS ==========
let currentCustName = '';

function openCustDocs(custName) {
  currentCustName = custName;
  document.getElementById('custDocsTitle').textContent = '📎 ' + custName + ' — Documents';
  document.getElementById('custDocStatus').style.display = 'none';
  document.getElementById('custDocPreviewWrap').style.display = 'none';
  document.getElementById('custDocFileInput').value = '';
  openModal('custDocsModal');
  loadCustDocs(custName);
}

function loadCustDocs(custName) {
  const el = document.getElementById('custDocsList');
  el.innerHTML = '<div class="loading"><div class="spin"></div></div>';
  api({ action: 'getCustomerDocs', customerName: custName }, r => {
    if (!r.success || !r.data.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px;">No documents uploaded yet</div>'; return; }
    el.innerHTML = r.data.map(d => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
        <div>
          <div style="font-size:12px;font-weight:500;color:var(--text);">📄 ${d.name}</div>
          <div style="font-size:11px;color:var(--text3);">Uploaded: ${d.date}</div>
        </div>
        <a href="${d.url}" target="_blank" class="btn btn-sm btn-info" style="text-decoration:none;">View</a>
      </div>`).join('');
  });
}

function previewCustDoc() {
  const file = document.getElementById('custDocFileInput').files[0];
  if (!file) return;
  const wrap = document.getElementById('custDocPreviewWrap');
  const prev = document.getElementById('custDocPreview');
  wrap.style.display = 'block';
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => { prev.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:120px;border-radius:8px;">`; };
    reader.readAsDataURL(file);
  } else { prev.innerHTML = `<div style="padding:10px;background:var(--surface2);border-radius:8px;font-size:12px;">📄 ${file.name}</div>`; }
  document.getElementById('custDocUploadBtn').style.display = 'inline-flex';
}

function uploadCustDoc() {
  const file = document.getElementById('custDocFileInput').files[0];
  if (!file || !currentCustName) return;
  const status = document.getElementById('custDocStatus');
  const btn    = document.getElementById('custDocUploadBtn');
  status.style.display = 'block'; status.style.color = 'var(--warning)'; status.textContent = '⏳ Uploading...';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
  if (file.size > 4 * 1024 * 1024) { status.style.color = 'var(--error)'; status.textContent = '❌ File is larger than 4MB'; if (btn) { btn.disabled = false; btn.textContent = '⬆ Upload'; } return; }
  const mimeType     = file.type || 'application/pdf';
  const custFileName = currentCustName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + file.name;
  api({ action: 'getAccessToken' }, tokenRes => {
    const token = tokenRes?.token || '';
    if (!token) { status.style.color = 'var(--error)'; status.textContent = '❌ Token not found'; if (btn) { btn.disabled = false; btn.textContent = '⬆ Upload'; } return; }
    api({ action: 'getCustFolderId' }, folderRes => {
      if (!folderRes.success || !folderRes.folderId) { status.style.color = 'var(--error)'; status.textContent = '❌ Folder error: ' + (folderRes.message || 'Unknown'); if (btn) { btn.disabled = false; btn.textContent = '⬆ Upload'; } return; }
      const folderId = folderRes.folderId;
      const meta = JSON.stringify({ name: custFileName, parents: [folderId] });
      const form = new FormData();
      form.append('metadata', new Blob([meta], { type: 'application/json' }));
      form.append('file', new Blob([file], { type: mimeType }));
      fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: form })
      .then(r => r.json())
      .then(data => {
        if (btn) { btn.disabled = false; btn.textContent = '⬆ Upload'; }
        if (data.id) {
          fetch('https://www.googleapis.com/drive/v3/files/' + data.id + '/permissions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }) });
          status.style.color = 'var(--success)'; status.textContent = '✅ Uploaded!';
          loadCustDocs(currentCustName);
          document.getElementById('custDocFileInput').value = '';
          document.getElementById('custDocPreviewWrap').style.display = 'none';
        } else { status.style.color = 'var(--error)'; status.textContent = '❌ Upload failed: ' + (data.error?.message || JSON.stringify(data)); }
      })
      .catch(err => { if (btn) { btn.disabled = false; btn.textContent = '⬆ Upload'; } status.style.color = 'var(--error)'; status.textContent = '❌ ' + err.message; });
    });
  });
}

// ========== BATTERY SPEC (customer-wise, sheet-driven columns) ==========
// Columns yahan hardcode NAHI — GAS BatterySpec sheet ke header se aate hain.
// Naya column chahiye? Sheet me "Customer Name" ke baad, "Updated By" se pehle header add kar do.
let currentSpecCust = '';
let currentSpecColumns = [];

function openBatterySpec(custName) {
  currentSpecCust = custName;
  currentSpecColumns = [];
  document.getElementById('batterySpecTitle').textContent = '🔋 ' + custName + ' — Battery Spec';
  document.getElementById('specStatus').style.display = 'none';
  document.getElementById('specThead').innerHTML = '';
  document.getElementById('specTbody').innerHTML =
    `<tr><td><div class="loading"><div class="spin"></div></div></td></tr>`;
  openModal('batterySpecModal');
  loadBatterySpec(custName);
}

function loadBatterySpec(custName) {
  api({ action: 'getBatterySpec', customerName: custName }, r => {
    currentSpecColumns = (r.success && r.columns) ? r.columns : [];
    if (!currentSpecColumns.length) {
      document.getElementById('specThead').innerHTML = '';
      document.getElementById('specTbody').innerHTML =
        `<tr><td style="padding:16px;color:var(--error);font-size:12px;">No column headers found — check the BatterySpec sheet</td></tr>`;
      return;
    }
    document.getElementById('specThead').innerHTML =
      '<tr>' + currentSpecColumns.map(c => `<th>${c}</th>`).join('') + '<th style="width:44px;"></th></tr>';
    document.getElementById('specTbody').innerHTML = '';
    const rows = (r.success && r.data) ? r.data : [];
    if (!rows.length) { addSpecRow(); return; }
    rows.forEach(row => addSpecRow(row));
  });
}

function addSpecRow(values) {
  values = values || {};
  if (!currentSpecColumns.length) return;
  const tb = document.getElementById('specTbody');
  const tr = document.createElement('tr');
  tr.innerHTML = currentSpecColumns.map(c =>
    `<td><input class="form-control" data-col="${c}" value="${(values[c] || '').toString().replace(/"/g, '&quot;')}" placeholder="${c}" style="font-size:12px;padding:5px 8px;"></td>`
  ).join('') +
  `<td style="text-align:center;"><button class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()" title="Remove">✕</button></td>`;
  tb.appendChild(tr);
}

function collectSpecRows() {
  const rows = [];
  document.querySelectorAll('#specTbody tr').forEach(tr => {
    const obj = {}; let any = false;
    tr.querySelectorAll('input[data-col]').forEach(inp => {
      const v = inp.value.trim();
      obj[inp.dataset.col] = v;
      if (v) any = true;
    });
    if (any) rows.push(obj);
  });
  return rows;
}

function saveBatterySpec() {
  const btn = document.getElementById('specSaveBtn');
  const status = document.getElementById('specStatus');
  const rows = collectSpecRows();
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  api({ action: 'saveBatterySpec', customerName: currentSpecCust, rows: JSON.stringify(rows), 'Added By': user.name || '' }, r => {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Spec'; }
    if (r.success) {
      toast('Battery spec saved!');
      status.style.display = 'block'; status.style.color = 'var(--success)'; status.textContent = '✅ Saved ' + rows.length + ' row(s)';
    } else {
      toast(r.message || 'Save failed', 'e');
      status.style.display = 'block'; status.style.color = 'var(--error)'; status.textContent = '❌ ' + (r.message || 'Failed');
    }
  });
}

// ---- Column editor (headings rename/add/delete) ----
function openSpecColumns() {
  const list = document.getElementById('specColsList');
  // Jo abhi table me dikh rahe hain (server se aaye) wahi editable
  const cols = currentSpecColumns.length ? currentSpecColumns.slice() : [];
  list.innerHTML = cols.map(c => specColRowHTML(c)).join('');
  if (!cols.length) addSpecColInput();
  document.getElementById('specColsStatus').style.display = 'none';
  openModal('specColsModal');
}

function specColRowHTML(name) {
  const safe = (name || '').toString().replace(/"/g, '&quot;');
  return `<div class="spec-col-row" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
    <input class="form-control spec-col-input" value="${safe}" placeholder="Column name" style="font-size:13px;">
    <button class="btn btn-sm btn-danger" onclick="this.closest('.spec-col-row').remove()" title="Remove column">✕</button>
  </div>`;
}

function addSpecColInput() {
  document.getElementById('specColsList').insertAdjacentHTML('beforeend', specColRowHTML(''));
}

function saveSpecColumns() {
  const btn = document.getElementById('specColsSaveBtn');
  const status = document.getElementById('specColsStatus');
  const cols = [];
  let bad = false;
  document.querySelectorAll('#specColsList .spec-col-input').forEach(inp => {
    const v = inp.value.trim();
    if (!v) return;                       // khaali skip
    if (cols.some(c => c.toLowerCase() === v.toLowerCase())) bad = true;  // duplicate
    cols.push(v);
  });
  if (!cols.length) { toast('Keep at least one column', 'e'); return; }
  if (bad) { toast('Two columns have the same name — make them different', 'e'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  api({ action: 'setBatterySpecColumns', columns: JSON.stringify(cols) }, r => {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Columns'; }
    if (r.success) {
      toast('Columns updated!');
      closeModal('specColsModal');
      loadBatterySpec(currentSpecCust);   // table naye columns ke sath reload
    } else {
      status.style.display = 'block'; status.style.color = 'var(--error)'; status.textContent = '❌ ' + (r.message || 'Failed');
      toast(r.message || 'Failed', 'e');
    }
  });
}


// ========== MY DASHBOARD ==========
let myAllOrders = [];

function loadMyDashboard() {
  const fromEl = document.getElementById('my-from-date');
  const toEl   = document.getElementById('my-to-date');
  if (fromEl) fromEl.value = '';
  if (toEl)   toEl.value   = '';
  setMyRangeActiveBtn('all');
  api({ action: 'getOrders' }, r => {
    let orders = r.data || [];
    if (user.role === 'Sales' && user.salesName) {
      orders = orders.filter(o => (o['Sales Person Name']||'') === user.salesName);
    }
    myAllOrders = orders;
    renderMyDashboard();
  });
}

function setMyDateRange(preset) {
  const today = new Date();
  let from = null, to = null;
  if (preset === 'today') { from = today; to = today; }
  else if (preset === 'thismonth') { from = new Date(today.getFullYear(), today.getMonth(), 1); to = today; }
  else if (preset === 'lastmonth') {
    from = new Date(today.getFullYear(), today.getMonth()-1, 1);
    to   = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (preset === 'thisyear') { from = new Date(today.getFullYear(), 0, 1); to = today; }
  document.getElementById('my-from-date').value = from ? toInputDateStr(from) : '';
  document.getElementById('my-to-date').value   = to   ? toInputDateStr(to)   : '';
  setMyRangeActiveBtn(preset);
  renderMyDashboard();
}

function setMyRangeActiveBtn(preset) {
  document.querySelectorAll('.my-range-btn').forEach(b => b.classList.remove('btn-primary'));
  const btn = document.getElementById('my-range-' + preset + '-btn');
  if (btn) btn.classList.add('btn-primary');
}

function applyMyDateFilter() {
  setMyRangeActiveBtn('custom');
  renderMyDashboard();
}

function renderMyDashboard() {
  const fromVal = document.getElementById('my-from-date')?.value;  // "2026-08-22"
  const toVal   = document.getElementById('my-to-date')?.value;

  // from/to ko bhi parseDMY jaisa local-midnight banao (warna IST/UTC mismatch)
  function inputToTs(v, endOfDay) {
    if (!v) return null;
    const p = v.split('-');   // yyyy-mm-dd
    const d = new Date(parseInt(p[0],10), parseInt(p[1],10) - 1, parseInt(p[2],10));
    let ts = d.getTime();
    if (endOfDay) ts += 24*60*60*1000 - 1;
    return ts;
  }
  const fromTs = inputToTs(fromVal, false);
  const toTs   = inputToTs(toVal, true);

  const orders = myAllOrders.filter(o => {
    const t = parseDMY(o['Date']);
    if (fromTs !== null && t < fromTs) return false;
    if (toTs !== null && t > toTs) return false;
    return true;
  });

  const completedOrders = orders.filter(o => isOrderCompleted(o));
  const pendingOrders   = orders.filter(o => !isOrderCompleted(o));

  const totalSale     = orders.reduce((s,o)          => s + (parseFloat(o['Total Order Value'])||0), 0);
  const completedSale = completedOrders.reduce((s,o) => s + (parseFloat(o['Total Order Value'])||0), 0);
  const pendingSale   = pendingOrders.reduce((s,o)   => s + (parseFloat(o['Total Order Value'])||0), 0);

  setText('my-total-sale',     '₹' + fmt(Math.round(totalSale)));
  setText('my-pending-sale',   '₹' + fmt(Math.round(pendingSale)));
  setText('my-completed-sale', '₹' + fmt(Math.round(completedSale)));
  setText('my-total-orders',     orders.length);
  setText('my-pending-orders',   pendingOrders.length);
  setText('my-completed-orders', completedOrders.length);
}

// ========== EDIT ORDER ==========
let currentEditOrder = null;
let editItemRowCount = 0;

function addEditItemRow(model='', btype='', qty='', price='', total='', crm='', remarks='', isExisting=false, itemID='', volt='', amp='', priceType='', warranty='', perwatt='') {
  editItemRowCount++;
  const id     = 'e' + editItemRowCount;
  const crmVal = crm || document.getElementById('e-crm').value || '';

  const btypeOptions = ['2 Wheeler Battery','3 Wheeler Battery','Inverter Battery','Solar Battery','E-Rikshaw Battery','E-Cycle Battery']
    .map(o => `<option ${btype===o?'selected':''}>${o}</option>`).join('');

  const lbl = (t, req) => `<label style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px;">${t}${req ? ' <span class="req-mark">*</span>' : ''}</label>`;

  const div = document.createElement('div');
  div.id = `edit-item-row-${id}`;
  div.dataset.existing = isExisting ? 'true' : 'false';
  div.dataset.itemid   = itemID;
  div.style.cssText = 'background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;position:relative;';

  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <span style="font-size:11px;font-weight:600;color:${isExisting?'var(--success)':'var(--accent)'};">${isExisting?'✏️ Existing Item':'New Item'}</span>
      <button class="btn btn-sm btn-danger" onclick="removeEditItemRow('${id}')">✕ Remove</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>${lbl('Product Model')}${isExisting
        ? `<input class="form-control" id="eim-model-${id}" value="${model}" readonly style="background:var(--accent-dim);color:var(--accent);font-weight:600;font-size:13px;">`
        : `${modelPickerHTML('eim', id)}<input type="hidden" id="eim-model-${id}">`}</div>
      <div>${lbl('Battery Type', true)}<select class="form-control" id="eim-btype-${id}" style="font-size:13px;"><option value="">Select type</option>${btypeOptions}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>${lbl('Price Type', true)}
        <select class="form-control" id="eim-pricetype-${id}" style="font-size:13px;" onchange="onEditItemPriceTypeChange('${id}')">
          <option value="">Select</option>
          <option ${priceType==='Absolute'?'selected':''}>Absolute</option>
          <option ${priceType==='Per Watt'?'selected':''}>Per Watt</option>
          <option ${priceType==='Last Price'?'selected':''}>Last Price</option>
        </select>
      </div>
      <div>${lbl('Voltage (V)')}<input class="form-control" id="eim-volt-${id}" type="number" value="${volt}" placeholder="48" oninput="calcEditItemAuto('${id}')" style="font-size:13px;"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>${lbl('Ampere (Ah)')}<input class="form-control" id="eim-amp-${id}" type="number" value="${amp}" placeholder="20" oninput="calcEditItemAuto('${id}')" style="font-size:13px;"></div>
      <div>${lbl('Qty', true)}<input class="form-control" id="eim-qty-${id}" type="number" value="${qty}" placeholder="0" oninput="calcEditItemAuto('${id}')" style="font-size:13px;"></div>
      <div id="eim-pricefield-${id}">
        ${lbl('Rate/Unit (₹)', true)}<input class="form-control" id="eim-price-${id}" type="number" value="${price}" placeholder="0" oninput="calcEditItemAuto('${id}')" style="font-size:13px;">
      </div>
      <div id="eim-pwfield-${id}" style="display:none;">
        ${lbl('Per Watt Price (₹)', true)}<input class="form-control" id="eim-perwatt-${id}" type="number" value="${perwatt}" placeholder="e.g. 12" oninput="calcEditItemAuto('${id}')" style="font-size:13px;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div>${lbl('Total (₹)')}<input class="form-control" id="eim-total-${id}" readonly value="${total}" placeholder="Auto" style="background:var(--success-dim);color:var(--success);font-weight:600;font-size:13px;"></div>
      <div>${lbl('Warranty')}<input class="form-control" id="eim-warranty-${id}" value="${warranty}" placeholder="e.g. 1 Year" style="font-size:13px;"></div>
      <div>${lbl('Assigned CRM')}<input class="form-control" id="eim-crm-${id}" value="${crmVal}" placeholder="CRM name" style="font-size:13px;"></div>
      <div>${lbl('Remarks')}<input class="form-control" id="eim-remarks-${id}" value="${remarks}" placeholder="Remarks..." style="font-size:13px;"></div>
    </div>`;

  document.getElementById('editItemsBody').appendChild(div);

  // Master model = lock | purana model (48V 20Ah) = pehle jaisa | naya row = picker se
  const eModelEl = document.getElementById(`eim-model-${id}`);
  const eVoltEl  = document.getElementById(`eim-volt-${id}`);
  const eAmpEl   = document.getElementById(`eim-amp-${id}`);
  const inMaster = isExisting && masterModels.some(x => x.code.toLowerCase() === String(model).trim().toLowerCase());
  eModelEl.dataset.source = isExisting ? (inMaster ? 'Master' : 'Legacy') : '';
  if (!isExisting || inMaster) [eVoltEl, eAmpEl].forEach(el => { el.readOnly = true; el.style.background = 'var(--surface2)'; });

  // Agar priceType set hai to show/hide fields
  if (priceType === 'Per Watt') {
    document.getElementById(`eim-pwfield-${id}`).style.display = 'block';
    document.getElementById(`eim-pricefield-${id}`).style.display = 'none';
  }
  calcEditItemAuto(id);
}

function removeEditItemRow(id) {
  const row = document.getElementById(`edit-item-row-${id}`);
  if (!row) return;
  const itemID  = row.dataset.itemid;
  const isExist = row.dataset.existing === 'true';
  const orderID = document.getElementById('e-orderid')?.value || '';

  // Naya (abhi tak save nahi hua) item — sirf screen se hatao
  if (!isExist || !itemID) { row.remove(); return; }

  // Existing item — backend se bhi delete karo
  if (!confirm('Remove this item from the order? (It will also be removed from Production/Accounts)')) return;
  row.remove();
  api({ action: 'deleteOrderItem', 'Item ID': itemID, 'Order ID': orderID }, r => {
    if (r.success) toast('Item removed');
    else toast(r.message || 'Delete failed', 'e');
  });
}

function onEditItemPriceTypeChange(id) {
  const pt = document.getElementById(`eim-pricetype-${id}`)?.value || '';
  const pwField = document.getElementById(`eim-pwfield-${id}`);
  const prField = document.getElementById(`eim-pricefield-${id}`);
  if (pt === 'Per Watt') {
    if (pwField) pwField.style.display = 'block';
    if (prField) prField.style.display = 'none';
  } else {
    if (pwField) pwField.style.display = 'none';
    if (prField) prField.style.display = 'block';
  }
  calcEditItemAuto(id);
}

function calcEditItemAuto(id) {
  const pt   = document.getElementById(`eim-pricetype-${id}`)?.value || '';
  const volt = parseFloat(document.getElementById(`eim-volt-${id}`)?.value) || 0;
  const amp  = parseFloat(document.getElementById(`eim-amp-${id}`)?.value) || 0;
  const qty  = parseFloat(document.getElementById(`eim-qty-${id}`)?.value) || 0;

  const modelEl = document.getElementById(`eim-model-${id}`);
  if (modelEl) {
    const src = modelEl.dataset.source;
    if (src === 'Other') modelEl.value = (volt && amp) ? `${volt}V-${amp}AH` : '';
    else if (src === 'Legacy' && volt && amp) modelEl.value = `${volt}V ${amp}Ah`;   // purane items pehle jaisa
  }

  let total = 0;
  if (pt === 'Per Watt') {
    const pw = parseFloat(document.getElementById(`eim-perwatt-${id}`)?.value) || 0;
    total = volt * amp * qty * pw;
  } else {
    const rate = parseFloat(document.getElementById(`eim-price-${id}`)?.value) || 0;
    total = qty * rate;
  }
  const totalEl = document.getElementById(`eim-total-${id}`);
  if (totalEl) totalEl.value = total ? total.toFixed(2) : '';
}

function calcEditItemTotal(id) {
  calcEditItemAuto(id);
}

// ========== EDIT ORDER — CHARGER SECTION (dynamically injected) ==========
function ensureEditChargerSection() {
  if (document.getElementById('edit-charger-section')) return;
  const itemsBody = document.getElementById('editItemsBody');
  if (!itemsBody) return;
  const html = `
    <div id="edit-charger-section" style="margin-top:16px;">
      <div style="font-size:11px;font-weight:650;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">⚡ Charger</div>
      <div id="edit-existing-chargers" style="margin-bottom:10px;"></div>
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;">
        <div style="font-size:11px;font-weight:600;color:var(--accent);margin-bottom:10px;">+ Add New Charger</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div><label class="form-label">Charger Model</label><input class="form-control" id="ec-model" placeholder="e.g. 48V 5A Charger" style="font-size:13px;margin-top:5px;"></div>
          <div><label class="form-label">Qty</label><input class="form-control" id="ec-qty" type="number" placeholder="0" oninput="calcEditCharger()" style="font-size:13px;margin-top:5px;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><label class="form-label">Price/Unit (₹)</label><input class="form-control" id="ec-price" type="number" placeholder="0" oninput="calcEditCharger()" style="font-size:13px;margin-top:5px;"></div>
          <div><label class="form-label">Total incl. 5% GST (₹)</label><input class="form-control" id="ec-total" readonly placeholder="Auto" style="background:var(--success-dim);color:var(--success);font-weight:600;font-size:13px;margin-top:5px;"></div>
        </div>
        <button class="btn btn-sm btn-primary" id="ec-save-btn" style="margin-top:10px;" onclick="saveEditCharger()">+ Add Charger to Order</button>
      </div>
    </div>`;
  itemsBody.insertAdjacentHTML('afterend', html);
}

function calcEditCharger() {
  const qty   = parseFloat(document.getElementById('ec-qty')?.value) || 0;
  const price = parseFloat(document.getElementById('ec-price')?.value) || 0;
  const total = qty * price * 1.05;
  const el = document.getElementById('ec-total');
  if (el) el.value = total ? total.toFixed(2) : '';
}

function renderEditChargers(chargers) {
  const el = document.getElementById('edit-existing-chargers');
  if (!el) return;
  if (!chargers.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 0 2px;">No chargers in this order yet</div>'; return; }
  el.innerHTML = chargers.map(c => {
    const cid = c['Charger ID'] || '';
    return `
    <div id="echg-row-${cid}" style="border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface2);padding:8px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
          <span style="font-size:12px;font-weight:600;color:var(--text);">${c['Charger Model']||'—'}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:8px;">Qty: ${c['Qty']||0} · ₹${fmt(c['Price/Unit']||0)}/unit · Total ₹${fmt(c['Total']||0)}</span>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-sm btn-warning" onclick="toggleChargerEdit('${cid}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEditCharger('${cid}')">🗑️</button>
        </div>
      </div>
      <div id="echg-edit-${cid}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div><label style="font-size:10px;color:var(--text3);">Model</label><input class="form-control" id="echg-model-${cid}" value="${(c['Charger Model']||'').replace(/"/g,'&quot;')}" style="font-size:12px;margin-top:3px;"></div>
          <div><label style="font-size:10px;color:var(--text3);">Qty</label><input class="form-control" id="echg-qty-${cid}" type="number" value="${c['Qty']||0}" oninput="calcEditChargerRow('${cid}')" style="font-size:12px;margin-top:3px;"></div>
          <div><label style="font-size:10px;color:var(--text3);">Price/Unit (₹)</label><input class="form-control" id="echg-price-${cid}" type="number" value="${c['Price/Unit']||0}" oninput="calcEditChargerRow('${cid}')" style="font-size:12px;margin-top:3px;"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
          <span style="font-size:11px;color:var(--text3);">Total incl. 5% GST: <b id="echg-total-${cid}" style="color:var(--success);">₹${fmt(c['Total']||0)}</b></span>
          <button class="btn btn-sm btn-primary" onclick="saveEditChargerRow('${cid}')">💾 Save</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleChargerEdit(cid) {
  const el = document.getElementById(`echg-edit-${cid}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function calcEditChargerRow(cid) {
  const qty   = parseFloat(document.getElementById(`echg-qty-${cid}`)?.value) || 0;
  const price = parseFloat(document.getElementById(`echg-price-${cid}`)?.value) || 0;
  const total = qty * price * 1.05;
  const el = document.getElementById(`echg-total-${cid}`);
  if (el) el.textContent = '₹' + fmt(total.toFixed(2));
}

function saveEditChargerRow(cid) {
  const orderID = document.getElementById('e-orderid').value;
  const model = document.getElementById(`echg-model-${cid}`)?.value?.trim();
  const qty   = parseFloat(document.getElementById(`echg-qty-${cid}`)?.value) || 0;
  const price = parseFloat(document.getElementById(`echg-price-${cid}`)?.value) || 0;
  if (!model) { toast('Enter the Charger Model', 'e'); return; }
  if (qty <= 0) { toast('Qty must be greater than 0', 'e'); return; }
  if (price <= 0) { toast('Price must be greater than 0', 'e'); return; }
  const total = parseFloat((qty * price * 1.05).toFixed(2));
  api({ action: 'updateChargerItem', 'Charger ID': cid, 'Order ID': orderID, 'Charger Model': model, 'Qty': qty, 'Price/Unit': price, 'Total': total }, r => {
    if (r.success) { toast('Charger updated!'); loadEditChargers(orderID); }
    else toast(r.message || 'Update failed', 'e');
  });
}

function deleteEditCharger(cid) {
  const orderID = document.getElementById('e-orderid').value;
  if (!confirm('Delete this charger?')) return;
  api({ action: 'deleteChargerItem', 'Charger ID': cid, 'Order ID': orderID }, r => {
    if (r.success) { toast('Charger deleted'); loadEditChargers(orderID); }
    else toast(r.message || 'Delete failed', 'e');
  });
}

function loadEditChargers(orderID) {
  api({ action: 'getChargersByOrder', 'Order ID': orderID }, r => {
    renderEditChargers(r.success ? (r.data || []) : []);
  });
}

function saveEditCharger() {
  const orderID = document.getElementById('e-orderid').value;
  if (!orderID) return;
  const modelEl = document.getElementById('ec-model');
  const qtyEl   = document.getElementById('ec-qty');
  const priceEl = document.getElementById('ec-price');
  const model = modelEl?.value?.trim();
  clearErr(modelEl); clearErr(qtyEl); clearErr(priceEl);
  if (!model) { markErr(modelEl); toast('Enter the Charger Model', 'e'); return; }
  const qty = parseFloat(qtyEl?.value) || 0;
  if (qty <= 0) { markErr(qtyEl); toast('Charger Qty must be greater than 0', 'e'); return; }
  const price = parseFloat(priceEl?.value) || 0;
  if (price <= 0) { markErr(priceEl); toast('Charger Price must be greater than 0', 'e'); return; }
  const total = parseFloat((qty * price * 1.05).toFixed(2));
  const btn = document.getElementById('ec-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  api({ action: 'addChargerItem', 'Order ID': orderID, 'Charger Model': model, 'Qty': qty, 'Price/Unit': price, 'Total': total }, r => {
    if (btn) { btn.disabled = false; btn.textContent = '+ Add Charger to Order'; }
    if (r.success) {
      toast('Charger added to the order!');
      modelEl.value = ''; qtyEl.value = ''; priceEl.value = '';
      document.getElementById('ec-total').value = '';
      loadEditChargers(orderID);
    } else {
      toast(r.message || 'Could not add the charger', 'e');
    }
  });
}

function openEditOrder() {
  if (!currentEditOrder) return;
  const o = currentEditOrder;
  ['e-cust','e-phone','e-city','e-paymode','e-status','e-paystatus','e-plandispatch','e-transchg'].forEach(id => clearErr(document.getElementById(id)));
  document.getElementById('e-orderid').value = o['Order ID'] || '';
  document.getElementById('e-cust').value = o['Customer Name'] || '';
  document.getElementById('e-phone').value = o['Customer Phone'] || '';
  document.getElementById('e-city').value = o['City'] || '';
  document.getElementById('e-priority').value = o['Priority'] || '';
  document.getElementById('e-paymode').value = o['Payment Mode'] || '';
  document.getElementById('e-status').value = o['Order Status'] || '';
  document.getElementById('e-paystatus').value = o['Payment Status'] || '';
  document.getElementById('e-transport').value = o['Suggested Transport'] || '';
  document.getElementById('e-plandispatch').value = toInputDate(o['Plan Dispatch Date'] || '');
  document.getElementById('e-transchg').value = o['Transportation Charges'] || '';
  document.getElementById('e-crm').value = o['Assigned CRM'] || '';
  document.getElementById('e-finalstatus').value = o['Final Status'] || '';
  document.getElementById('e-remarks').value = o['Order Remarks'] || '';
  document.getElementById('e-billing').value = o['Billing Address'] || '';
  document.getElementById('e-shipping').value = o['Shipping Address'] || '';
  closeModal('orderDetailModal');
  openModal('editOrderModal');
  ensureEditChargerSection();
  ['ec-model','ec-qty','ec-price','ec-total'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['ec-model','ec-qty','ec-price'].forEach(id => clearErr(document.getElementById(id)));
  loadEditChargers(o['Order ID']);
  editItemRowCount = 0;
  document.getElementById('editItemsBody').innerHTML = '';
  loadMasterModels(() => api({ action: 'getItemsByOrder', 'Order ID': o['Order ID'] }, r => {
    if (r.success && r.data.length) {
      r.data.forEach(item => {
        addEditItemRow(
          item['Product Model']||'',
          item['Battery Type']||'',
          item['Qty']||'',
          item['Price Unit (Excluding GST)']||'',
          item['Total']||'',
          item['Assigned CRM']||'',
          item['Remarks']||'',
          true,
          item['Item ID']||'',
          item['Voltage']||'',
          item['Ampere']||'',
          item['Price Type']||'',
          item['Warranty']||'',
          item['Per Watt Price']||''
        );
      });
    }
    addEditItemRow('','','','','','','', false, '');
  }));
}

function submitEditOrder() {
  const orderID = document.getElementById('e-orderid').value;
  if (!orderID) return;
  if (!validateEditOrderMeta()) return;

  const preRows = document.querySelectorAll('[id^="edit-item-row-"]');
  let editItemsValid = true;
  const editSeenCombos = [];
  preRows.forEach(row => {
    if (!editItemsValid) return;
    const id = row.id.replace('edit-item-row-', '');
    const model = document.getElementById(`eim-model-${id}`)?.value?.trim();
    if (!model) return;
    if (!validateItemCard(id, 'eim')) { editItemsValid = false; return; }
    const btypeChk = document.getElementById(`eim-btype-${id}`)?.value || '';
    const comboKey = model.toLowerCase() + '|' + btypeChk;
    if (editSeenCombos.includes(comboKey)) {
      toast('This item (Model + Battery Type) is already in the order — increase its Qty instead', 'e');
      editItemsValid = false; return;
    }
    editSeenCombos.push(comboKey);
  });
  if (!editItemsValid) return;

  const params = {
    action: 'updateOrder', 'Order ID': orderID,
    'Customer Name': document.getElementById('e-cust').value,
    'Customer Phone': document.getElementById('e-phone').value,
    'City': document.getElementById('e-city').value,
    'Priority': document.getElementById('e-priority').value,
    'Corridor': document.getElementById('e-priority').value,
    'Payment Mode': document.getElementById('e-paymode').value,
    'Order Status': document.getElementById('e-status').value,
    'Payment Status': document.getElementById('e-paystatus').value,
    'Suggested Transport': document.getElementById('e-transport').value,
    'Plan Dispatch Date': fmtDisplayDate(document.getElementById('e-plandispatch').value),
    'Transportation Charges': document.getElementById('e-transchg').value,
    'Assigned CRM': document.getElementById('e-crm').value,
    'Final Status': document.getElementById('e-finalstatus').value,
    'Order Remarks': document.getElementById('e-remarks').value,
    'Billing Address': document.getElementById('e-billing').value,
    'Shipping Address': document.getElementById('e-shipping').value
  };
  
  const editBtn = document.getElementById('submitEditBtn');
  if (editBtn) { editBtn.disabled = true; editBtn.textContent = 'Saving...'; }

  api(params, r => {
    if (!r.success) { toast(r.message, 'e'); if (editBtn) { editBtn.disabled = false; editBtn.textContent = 'Save Changes'; } return; }
    const allRows = document.querySelectorAll('[id^="edit-item-row-"]');
    const updateTasks = [], addTasks = [];
    allRows.forEach(row => {
      const id = row.id.replace('edit-item-row-', '');
      const model = document.getElementById(`eim-model-${id}`)?.value?.trim();
      if (!model) return;
      const ePT   = document.getElementById(`eim-pricetype-${id}`)?.value || '';
      const eVolt = parseFloat(document.getElementById(`eim-volt-${id}`)?.value) || 0;
      const eAmp  = parseFloat(document.getElementById(`eim-amp-${id}`)?.value) || 0;
      let ePricePerUnit = ePT === 'Per Watt'
        ? eVolt * eAmp * (parseFloat(document.getElementById(`eim-perwatt-${id}`)?.value) || 0)
        : parseFloat(document.getElementById(`eim-price-${id}`)?.value) || 0;

      const itemData = {
        'Product Model': model,
        'Battery Type': document.getElementById(`eim-btype-${id}`)?.value || '',
        'Qty': document.getElementById(`eim-qty-${id}`)?.value || 0,
        'Price Unit (Excluding GST)': ePricePerUnit ? ePricePerUnit.toFixed(2) : (document.getElementById(`eim-price-${id}`)?.value || 0),
        'Total': document.getElementById(`eim-total-${id}`)?.value || 0,
        'Assigned CRM': document.getElementById(`eim-crm-${id}`)?.value || '',
        'Remarks': document.getElementById(`eim-remarks-${id}`)?.value || '',
        'Voltage': eVolt || '',
        'Ampere': eAmp || '',
        'Price Type': ePT,
        'Warranty': document.getElementById(`eim-warranty-${id}`)?.value || '',
        'Model Source': document.getElementById(`eim-model-${id}`)?.dataset.source || ''
      };
      if (row.dataset.existing === 'true' && row.dataset.itemid) updateTasks.push({ ...itemData, 'Item ID': row.dataset.itemid, 'Order ID': orderID });
      else addTasks.push({ ...itemData, 'Order ID': orderID });
    });

    let total = updateTasks.length + addTasks.length;
    let done = 0;
    const finish = () => {
      done++;
      if (done >= total) {
        let totalQty = 0;
        allRows.forEach(row => {
          const id = row.id.replace('edit-item-row-', '');
          const qty = parseFloat(document.getElementById('eim-qty-' + id)?.value) || 0;
          const model = document.getElementById('eim-model-' + id)?.value?.trim();
          const btype = document.getElementById('eim-btype-' + id)?.value || '';
          if (qty > 0 && (model || btype)) totalQty += qty;   // model ya btype koi bhi ho, qty count karo
        });
        api({ action: 'updateOrder', 'Order ID': orderID, 'Total Qty': String(totalQty) }, () => {
          toast('Order updated!');
          if (editBtn) { editBtn.disabled = false; editBtn.textContent = 'Save Changes'; }
          closeModal('editOrderModal');
          loadOrders();
        });
      }
    };

    if (total === 0) {
      let totalQty = 0;
      allRows.forEach(row => {
        const id = row.id.replace('edit-item-row-', '');
        const qty = parseFloat(document.getElementById('eim-qty-' + id)?.value) || 0;
        const model = document.getElementById('eim-model-' + id)?.value?.trim();
        if (model) totalQty += qty;
      });
      api({ action: 'updateOrder', 'Order ID': orderID, 'Total Qty': String(totalQty) }, () => {
        toast('Order updated!');
        if (editBtn) { editBtn.disabled = false; editBtn.textContent = 'Save Changes'; }
        closeModal('editOrderModal');
        loadOrders();
      });
      return;
    }

    updateTasks.forEach(item => { api({ action: 'updateOrderItem', ...item }, finish); });
    addTasks.forEach(item => {
      api({ action: 'addOrderItem', ...item }, ir => {
        finish();
      });
    });
  });
}

// ========== SIDEBAR TOGGLE ==========
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
});

// ========== INIT ==========
document.getElementById('o-date').value = new Date().toISOString().split('T')[0];
document.getElementById('o-date').readOnly = true;
document.getElementById('o-date').style.background = 'var(--surface2)';
document.getElementById('o-date').style.cursor = 'not-allowed';

markRequired(['o-date','o-sales','o-cust','o-phone','o-city','o-paymode','o-status','o-paystatus']);
markRequired(['e-cust','e-phone','e-city','e-paymode','e-status','e-paystatus']);
markRequired(['dsp-lr','dsp-transport','dsp-qty']);

// Field-error class ko auto-clear karo jab user field fix kare
document.addEventListener('input', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('field-error') && t.value && String(t.value).trim()) t.classList.remove('field-error');
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('field-error') && t.value) t.classList.remove('field-error');
});

if (user.role === 'Sales' && user.salesName) {
  const sel = document.getElementById('o-sales');
  if (sel) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === user.salesName) {
        sel.selectedIndex = i;
        sel.disabled = true;
        break;
      }
    }
  }
}

loadOrders();

/* ============================================================
   ORDER TRACKING (Admin) — Order ID daalo, poori history
   IIFE mein wrapped hai taaki esc/render private rahein.
   ============================================================ */
(function () {

  function esc(v) {
    return String(v == null ? '' : v).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  let otListBuilt = false;

  window.openTrackModal = function (orderID) {
    openModal('orderTrackModal');
    document.getElementById('trackModalTitle').textContent = '🔍 Track Order — ' + orderID;
    document.getElementById('ot-result').innerHTML = '<div class="loading"><div class="spin"></div> Loading history...</div>';
    const inp = document.getElementById('ot-orderid');
    if (inp) inp.value = orderID;   // trackOrder isi input se padhta hai
    trackOrder();
  };

  window.loadOrderTracking = function () {
    if (otListBuilt) return;
    api({ action: 'getOrders' }, r => {
      if (!r.success) return;
      const dl = document.getElementById('ot-orderlist');
      if (dl) dl.innerHTML = (r.data || [])
        .sort((a, b) => String(b['Order ID']).localeCompare(String(a['Order ID'])))
        .map(o => `<option value="${esc(o['Order ID'] || '')}">${esc(o['Customer Name'] || '')}</option>`).join('');
      otListBuilt = true;
    });
  };

  window.trackOrder = function () {
    const oid = (document.getElementById('ot-orderid').value || '').trim();
    if (!oid) { toast('Enter an Order ID', 'e'); return; }
    const box = document.getElementById('ot-result');
    box.innerHTML = '<div class="loading"><div class="spin"></div> Loading history...</div>';

    // Ek hi call me poora data — bahut fast
    api({ action: 'getTrackOrder', 'Order ID': oid }, r => {
      if (!r || !r.success) {
        box.innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-txt">${(r && r.message) || 'Could not load history'}</div></div>`;
        return;
      }
      const bag = {
        order:         r.order || null,
        items:         r.items || [],
        chargers:      r.chargers || [],
        payments:      r.payments || [],
        totalReceived: r.totalReceived || 0,
        prod:          r.prod || [],
        crm:           r.crm || [],
        billings:      r.billings || [],
        dispatches:    r.dispatches || [],
        challans:      r.challans || [],
        slips:         r.slips || []
      };
      render(oid, bag);
      const inp = document.getElementById('ot-orderid');
      if (inp) inp.select();
    });
  };

  function render(oid, b) {
    const box = document.getElementById('ot-result');
    if (!b.order) {
      box.innerHTML = `<div class="empty"><div class="empty-ico">🔍</div><div class="empty-txt">Order <b>${esc(oid)}</b> not found</div></div>`;
      return;
    }
    const o = b.order;

    const prodBy = {}; b.prod.forEach(p => { prodBy[p['Item ID']] = p; });
    const billQ = {}; b.billings.forEach(x => { const k = x['Item ID']; billQ[k] = (billQ[k] || 0) + (parseFloat(x['Billed Qty']) || 0); });
    const dispQ = {}; b.dispatches.forEach(d => { const k = d['Item ID']; dispQ[k] = (dispQ[k] || 0) + (parseFloat(d['Dispatch Qty']) || 0); });

    const orderVal = parseFloat(o['Total Order Value']) || 0;
    const received = b.totalReceived || 0;
    const balance  = orderVal - received;

    const totalQ   = b.items.reduce((s, i) => s + (parseFloat(i['Qty']) || 0), 0);
    const totalDsp = Object.values(dispQ).reduce((s, x) => s + x, 0);

    const anyProdStart = b.prod.some(p => p['Production Start Actual'] || (parseFloat(p['Produced Qty']) || 0) > 0);
    const allProdDone  = b.prod.length > 0 && b.prod.every(p => { const t = parseFloat(p['Qty']) || 0, q = parseFloat(p['Produced Qty']) || 0; return t > 0 && q >= t; });
    const anyBilled    = b.billings.length > 0;
    const anyDsp       = b.dispatches.length > 0;
    const fullDsp      = totalQ > 0 && totalDsp >= totalQ;

    const steps = [
      { l: 'Order Received', s: 'done' },
      { l: 'Production',     s: allProdDone ? 'done' : anyProdStart ? 'active' : 'todo' },
      { l: 'Billing',       s: anyBilled ? 'done' : 'todo' },
      { l: 'Dispatch',      s: fullDsp ? 'done' : anyDsp ? 'active' : 'todo' },
      
    ];
    const stepHTML = steps.map((st, i) => {
      const col = st.s === 'done' ? 'var(--success)' : st.s === 'active' ? 'var(--warning)' : 'var(--border2)';
      const ic  = st.s === 'done' ? '✓' : st.s === 'active' ? '•' : (i + 1);
      const line = i < steps.length - 1
        ? `<div style="flex:1;height:2px;background:${steps[i + 1].s !== 'todo' ? 'var(--success)' : 'var(--border2)'};margin-top:15px;min-width:20px;"></div>`
        : '';
      return `<div style="display:flex;align-items:flex-start;${i < steps.length - 1 ? 'flex:1;' : ''}">
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:60px;">
          <div style="width:30px;height:30px;border-radius:50%;background:${col};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">${ic}</div>
          <div style="font-size:10px;font-weight:600;color:${st.s === 'todo' ? 'var(--text3)' : 'var(--text)'};text-align:center;line-height:1.2;">${st.l}</div>
        </div>${line}</div>`;
    }).join('');

    const meta = [
      ['Order ID', esc(o['Order ID'])],
      ['Order Date', fmtDisplayDate(o['Date'] || '')],
      ['Customer', esc(o['Customer Name'])],
      ['Phone', esc(o['Customer Phone'])],
      ['City', esc(o['City'])],
      ['Sales Person', esc(o['Sales Person Name'])],
      ['Assigned CRM', esc(o['Assigned CRM'])],
      ['Payment Mode', esc(o['Payment Mode'])],
      ['Plan Dispatch', fmtDisplayDate(o['Plan Dispatch Date'] || '')]
    ].map(([l, v]) => `<div class="detail-item"><div class="detail-lbl">${l}</div><div class="detail-val">${v || '—'}</div></div>`).join('');

    const balColor = balance <= 0 ? 'var(--success)' : balance < orderVal ? 'var(--warning)' : 'var(--error)';
    const moneyStrip = `
      <div class="stats-row" style="margin-bottom:0;">
        <div class="stat c-teal"><div class="stat-lbl">Order Value</div><div class="stat-val" style="font-size:18px;">₹${fmt(orderVal)}</div></div>
        <div class="stat c-green"><div class="stat-lbl">Received</div><div class="stat-val" style="font-size:18px;">₹${fmt(received)}</div></div>
        <div class="stat ${balance <= 0 ? 'c-green' : 'c-red'}"><div class="stat-lbl">Balance</div><div class="stat-val" style="font-size:18px;color:${balColor};">₹${fmt(balance)}</div></div>
        <div class="stat c-blue"><div class="stat-lbl">Total Qty</div><div class="stat-val">${totalQ}</div></div>
      </div>`;

    const itemRows = b.items.map((it, n) => {
      const iid = it['Item ID'];
      const p = prodBy[iid] || {};
      const tq = parseFloat(it['Qty']) || 0;
      const pq = parseFloat(p['Produced Qty']) || 0;
      const pend = (tq - pq) > 0 ? (tq - pq) : 0;
      const bq = billQ[iid] || 0;
      const dq = dispQ[iid] || 0;
      const st = (tq > 0 && pq >= tq)
        ? '<span class="badge b-ready">Done</span>'
        : (pq > 0 || p['Production Start Actual'])
        ? '<span class="badge b-processing">In Progress</span>'
        : '<span class="badge b-pending">Pending</span>';
      return `<tr>
        <td>${n + 1}</td>
        <td class="td-id">${esc(iid)}</td>
        <td>${esc(it['Product Model'])}</td>
        <td>${esc(it['Battery Type'])}</td>
        <td style="text-align:right;">${tq}</td>
        <td style="text-align:right;color:var(--success);font-weight:600;">${pq}</td>
        <td style="text-align:right;color:${pend ? 'var(--warning)' : 'var(--success)'};font-weight:600;">${pend || '0 ✅'}</td>
        <td style="text-align:right;color:var(--purple);font-weight:600;">${bq || '—'}</td>
        <td style="text-align:right;color:var(--accent);font-weight:600;">${dq || '—'}</td>
        <td>${st}</td>
      </tr>`;
    }).join('');

    const chargerRows = b.chargers.map((c, n) => `
      <tr>
        <td>${n + 1}</td>
        <td class="td-id">${esc(c['Charger ID'])}</td>
        <td>${esc(c['Charger Model'])}</td>
        <td style="text-align:right;">${esc(c['Qty'] || 0)}</td>
        <td style="text-align:right;">₹${fmt(c['Price/Unit'] || 0)}</td>
        <td style="text-align:right;color:var(--accent);font-weight:600;">₹${fmt(c['Total'] || 0)}</td>
      </tr>`).join('');

    const prodRows = b.prod.map(p => `
      <tr>
        <td class="td-id">${esc(p['Item ID'])}</td>
        <td>${esc(p['Product Model'])}</td>
        <td>${fmtDisplayDate(p['Production Start Actual'] || '') || '—'}</td>
        <td>${fmtDisplayDate(p['Production Complete Actual'] || '') || '—'}</td>
        <td>${p['Production Delay'] ? '<span class="badge b-delay">' + esc(p['Production Delay']) + '</span>' : '—'}</td>
      </tr>`).join('');

    const billRows = b.billings.map(x => `
      <tr>
        <td>${esc(x['Invoice No'] || '—')}</td>
        <td>${fmtDisplayDate(x['Invoice Date'] || '') || '—'}</td>
        <td class="td-id">${esc(x['Item ID'])}</td>
        <td style="text-align:right;">${esc(x['Billed Qty'] || 0)}</td>
        <td style="text-align:right;color:var(--accent);font-weight:600;">₹${fmt(x['Invoice Amount'] || 0)}</td>
      </tr>`).join('');

    const dspRows = b.dispatches.map(d => `
      <tr>
        <td class="td-id">${esc(d['Item ID'])}</td>
        <td style="text-align:right;">${esc(d['Dispatch Qty'] || 0)}</td>
        <td>${fmtDisplayDate(d['Dispatch Date'] || '') || '—'}</td>
        <td>${esc(d['Transport Name'] || '—')}</td>
        <td>${esc(d['Vehicle No'] || '—')}</td>
        <td>${esc(d['LR No'] || '—')}</td>
        <td>${esc(d['Driver No'] || '—')}</td>
      </tr>`).join('');

    const chGroups = {};
    b.challans.forEach(d => {
      const no = String(d['DC No']);
      if (!chGroups[no]) chGroups[no] = { no: d['DC No'], date: d['Date'], qty: 0, amt: 0, n: 0 };
      chGroups[no].qty += parseFloat(d['Qty']) || 0;
      chGroups[no].amt += parseFloat(d['Amount']) || 0;
      chGroups[no].n++;
    });
    const chRows = Object.values(chGroups).sort((a, b2) => Number(b2.no) - Number(a.no)).map(c => `
      <tr>
        <td class="td-id">DC #${esc(c.no)}</td>
        <td>${fmtDisplayDate(c.date || '') || '—'}</td>
        <td style="text-align:right;">${c.n}</td>
        <td style="text-align:right;">${c.qty}</td>
        <td style="text-align:right;">${c.amt ? '₹' + fmt(c.amt) : '—'}</td>
      </tr>`).join('');

    const payRows = b.payments.map(p => `
      <tr>
        <td>${fmtDisplayDate(p['Date'] || '') || '—'}</td>
        <td>${esc(p['Mode'] || '—')}</td>
        <td>${esc(p['Reference'] || '—')}</td>
        <td>${esc(p['Remarks'] || '')}</td>
        <td style="text-align:right;color:var(--success);font-weight:600;">₹${fmt(p['Amount'] || 0)}</td>
      </tr>`).join('');

    const slipHTML = b.slips.length ? b.slips.map(s => `
      <a href="${esc(s.url)}" target="_blank" class="slip-item" style="text-decoration:none;">
        <span class="slip-icon">${String(s.name || '').toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
        <div class="slip-info"><div class="slip-name">${esc(s.name)}</div><div class="slip-date">${esc(s.date)}</div></div>
        <span class="btn btn-sm btn-info">View</span>
      </a>`).join('') : '<div style="padding:14px;text-align:center;color:var(--text3);font-size:12px;">No payment slips uploaded</div>';

    const crm0 = b.crm[0] || {};
    const crmNote = (crm0['Current Stage'] || crm0['Remarks'])
      ? `<div style="padding:12px 16px;">
           ${crm0['Current Stage'] ? `<div style="margin-bottom:6px;"><span class="detail-lbl">Current Stage</span> <span class="badge b-processing">${esc(crm0['Current Stage'])}</span></div>` : ''}
           ${crm0['Follow-up With'] ? `<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Follow-up: <b>${esc(crm0['Follow-up With'])}</b></div>` : ''}
           ${crm0['Remarks'] ? `<div style="font-size:12px;color:var(--text2);">📝 ${esc(crm0['Remarks'])}</div>` : ''}
         </div>`
      : '';

    const cardTbl = (title, heads, rows, empty) => `
      <div class="card">
        <div class="card-head"><div class="card-title">${title}</div></div>
        ${rows
          ? `<div class="table-wrap"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`
          : `<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;">${empty}</div>`}
      </div>`;

    box.innerHTML = `
      <div class="card">
        <div class="card-head" style="flex-wrap:wrap;gap:8px;">
          <div class="card-title">${esc(o['Order ID'])} — ${esc(o['Customer Name'])}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${orderStatusBadge(o['Order Status'])} ${payStatusBadge(o['Payment Status'])}</div>
        </div>
        <div style="padding:16px;">
          <div style="display:flex;align-items:flex-start;margin-bottom:18px;overflow-x:auto;padding-bottom:4px;">${stepHTML}</div>
          <div class="detail-grid" style="margin-bottom:14px;">${meta}</div>
          ${moneyStrip}
          ${o['Order Remarks'] ? `<div style="margin-top:14px;padding:9px 12px;border:1px solid var(--border);border-radius:var(--r);font-size:12px;"><b>Remarks:</b> ${esc(o['Order Remarks'])}</div>` : ''}
        </div>
      </div>
      ${cardTbl('📦 Order Items', ['#', 'Item ID', 'Product Model', 'Battery Type', 'Qty', 'Produced', 'Pending', 'Billed', 'Dispatched', 'Prod Status'], itemRows, 'No items')}
      ${b.chargers.length ? cardTbl('⚡ Chargers', ['#', 'Charger ID', 'Model', 'Qty', 'Rate/Unit', 'Total (incl. GST)'], chargerRows, '') : ''}
      ${cardTbl('⚙️ Production', ['Item ID', 'Product Model', 'Start Actual', 'Complete Actual', 'Delay'], prodRows, 'No production data yet')}
      ${cardTbl('🧾 Billing', ['Invoice No', 'Invoice Date', 'Item ID', 'Billed Qty', 'Amount'], billRows, 'No billing entries')}
      ${cardTbl('🚚 Dispatch', ['Item ID', 'Qty', 'Date', 'Transport', 'Vehicle', 'LR No', 'Driver'], dspRows, 'No dispatches yet')}
      ${cardTbl('📄 Delivery Challans', ['DC No', 'Date', 'Items', 'Total Qty', 'Amount'], chRows, 'No challans yet')}
      ${cardTbl('💵 Payments', ['Date', 'Mode', 'Reference', 'Remarks', 'Amount'], payRows, 'No payment entries')}
      <div class="card"><div class="card-head"><div class="card-title">📎 Payment Slips</div></div><div style="padding:12px 16px;">${slipHTML}</div></div>
      ${crmNote ? `<div class="card"><div class="card-head"><div class="card-title">🎯 CRM</div></div>${crmNote}</div>` : ''}
    `;
  }

})();

// =============================================
// STAFF — team login → naam + PIN (backend: ErpStaff.gs)
// sales / accountant / crm / production / dispatch → "Who is working?" → page reload with that person
// =============================================
const ESTF = { list: [], emp: null, empErr: '', salesNames: [] };
const eEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eIni = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
function eApi(p) { return new Promise(res => api(p, res)); }

(async function erpStaffBoot() {
  if (user.role === 'Admin') { erpStaffAdminLoad(); return; }
  const r = await eApi({ action: 'getStaff' });
  if (!r || r.success === false) return;                     // purana server → pehle jaisa
  ESTF.list = r.staff || [];
  if (ERP_STAFF && !r.me) { sessionStorage.removeItem('erp_staff'); location.reload(); return; }
  if (ERP_STAFF) { document.getElementById('erpSwitch').style.display = ''; document.getElementById('userRl').textContent = (r.me.team || user.role) + ' · ' + r.me.id; return; }
  if (r.need) erpStaffPick();
})();
function erpStaffNeed(msg) {
  if (document.querySelector('#erpPick.show')) return;
  sessionStorage.removeItem('erp_staff');
  toast(msg || 'Pick your name first', 'e');
  eApi({ action: 'getStaff', staffToken: '' }).then(r => { ESTF.list = (r && r.staff) || []; erpStaffPick(); });
}
function erpOverlay(id) {
  let ov = document.getElementById(id);
  if (!ov) { ov = document.createElement('div'); ov.id = id; ov.className = 'erp-ov'; document.body.appendChild(ov); }
  return ov;
}
function erpStaffPick() {
  const ov = erpOverlay('erpPick'), L = ESTF.list.filter(s => s.active !== false);
  ov.classList.add('solid');
  ov.innerHTML = `<div class="erp-box" role="dialog" aria-modal="true" aria-labelledby="erpPickT">
    <div class="erp-head"><span>Litpax ERP</span><span>${eEsc((L[0] && L[0].team) || user.role || '')} team</span></div>
    <h2 id="erpPickT">Who is working?</h2><p class="erp-stf-sub">Pick your name, then enter your PIN.</p>
    ${L.length ? `<div class="erp-grid">${L.map(s => `<button type="button" class="erp-card" data-id="${eEsc(s.id)}" onclick="erpStaffPin(this.dataset.id)">
      <span class="erp-ini">${eEsc(eIni(s.name))}</span><b>${eEsc(s.name)}</b><small>${eEsc(s.id)}${s.salesName ? ' · ' + eEsc(s.salesName) : ''}</small></button>`).join('')}</div>`
      : '<p class="erp-stf-sub">No active people in this team. Ask the admin.</p>'}
    <div id="erpPin"></div>
    <div class="erp-actions"><button type="button" class="btn" onclick="logout()">Sign out</button></div></div>`;
  ov.classList.add('show');
  const f = ov.querySelector('.erp-card'); if (f) f.focus();
}
function erpStaffPin(id) {
  const s = ESTF.list.find(x => x.id === id); if (!s) return;
  document.querySelectorAll('.erp-card').forEach(c => c.classList.toggle('on', c.dataset.id === id));
  document.getElementById('erpPin').innerHTML = `<div class="erp-pin"><label for="erpPinIn">PIN for <b>${eEsc(s.name)}</b></label>
    <div class="erp-row"><input id="erpPinIn" type="password" inputmode="numeric" autocomplete="off" maxlength="16" placeholder="••••"
      onkeydown="if(event.key==='Enter')erpStaffEnter('${eEsc(id)}')">
    <button type="button" id="erpGo" class="btn btn-primary" onclick="erpStaffEnter('${eEsc(id)}')">Enter</button></div></div>`;
  document.getElementById('erpPinIn').focus();
}
async function erpStaffEnter(id) {
  const inp = document.getElementById('erpPinIn'), pin = inp.value.trim();
  if (!pin) { toast('Enter your PIN', 'e'); return; }
  const btn = document.getElementById('erpGo'); btn.disabled = true; btn.textContent = '…';
  const r = await eApi({ action: 'staffLogin', empId: id, pin, staffToken: '' });
  if (!r || r.success === false) { toast((r && r.message) || 'Could not sign in', 'e'); btn.disabled = false; btn.textContent = 'Enter'; inp.value = ''; inp.focus(); return; }
  sessionStorage.setItem('erp_staff', JSON.stringify({ id: r.me.id, name: r.me.name, team: r.me.team, salesName: r.me.salesName || '', token: r.staffToken, login: user.username }));
  location.reload();                                         // poora ERP us person ke naam / Sales Name se khule
}
function erpStaffSwitch() { sessionStorage.removeItem('erp_staff'); location.reload(); }

// ---- Admin: Users page → Team Staff & PINs ----
async function erpStaffAdminLoad(withEmp, refresh) {
  const r = await eApi({ action: 'getStaff', withEmployees: withEmp ? 1 : '', refresh: refresh ? 1 : '' });
  if (!r || r.success === false) { const t = document.getElementById('staffTable'); if (t) t.innerHTML = '<tr><td colspan="7">Staff list not available — deploy the new ERP script version.</td></tr>'; return; }
  ESTF.list = r.staff || [];
  if (withEmp) { ESTF.emp = r.employees || null; ESTF.empErr = r.empError || (r.employees ? '' : 'Employee list did not come from the server'); ESTF.salesNames = r.salesNames || []; }
  erpStaffTable();
}
function erpStaffTable() {
  const t = document.getElementById('staffTable'); if (!t) return;
  const L = ESTF.list.slice().sort((a, b) => (a.team + a.name).localeCompare(b.team + b.name));
  t.innerHTML = L.length ? L.map(s => `<tr><td>${eEsc(s.id)}</td><td><b>${eEsc(s.name)}</b></td><td>${eEsc(s.team)}</td><td>${eEsc(s.salesName || '—')}</td>
    <td>${s.hasPin ? '<span class="badge b-paid">set</span>' : '<span class="badge b-delay">not set</span>'}</td>
    <td>${s.active !== false ? '<span class="badge b-paid">Active</span>' : '<span class="badge b-pending">Inactive</span>'}</td>
    <td><button class="btn" data-id="${eEsc(s.id)}" onclick="erpStaffEdit(this.dataset.id)">Edit</button></td></tr>`).join('')
    : '<tr><td colspan="7">No staff yet — add your Sales, Accounts, CRM, Production and Dispatch people.</td></tr>';
}
function erpEmpOptions(q) {
  const have = {}; ESTF.list.forEach(s => { have[s.id] = 1; });
  q = String(q || '').toLowerCase().trim();
  const L = (ESTF.emp || []).filter(e => !have[e.id] && (!q || (e.name + ' ' + e.id + ' ' + e.dept + ' ' + e.desig).toLowerCase().includes(q)));
  return `<option value="">${L.length ? '— Pick employee (' + L.length + ') —' : 'No match'}</option>` +
    L.map(e => `<option value="${eEsc(e.id)}">${eEsc(e.name + ' · ' + e.id + (e.dept ? ' · ' + e.dept : ''))}</option>`).join('');
}
function erpEmpFilter(inp) { const sel = document.getElementById('esEmp'); if (sel) { sel.innerHTML = erpEmpOptions(inp.value); if (sel.options.length === 2) sel.selectedIndex = 1; } }
async function erpEmpRefresh(btn) {
  btn.disabled = true; btn.textContent = '…';
  await erpStaffAdminLoad(true, true);
  btn.disabled = false; btn.textContent = '↻';
  const sel = document.getElementById('esEmp'); if (sel) sel.innerHTML = erpEmpOptions((document.getElementById('esQ') || {}).value);
  toast(ESTF.empErr || 'Employee list refreshed', ESTF.empErr ? 'e' : 's');
}
function erpSalesToggle() { const w = document.getElementById('esSalesWrap'); if (w) w.style.display = document.getElementById('esTeam').value === 'Sales' ? '' : 'none'; }
async function erpStaffEdit(id) {
  const s = id ? ESTF.list.find(x => x.id === id) : null;
  const ov = erpOverlay('erpAdmin');
  if (!ESTF.emp || !ESTF.salesNames.length) { ov.innerHTML = '<div class="erp-box"><p class="erp-stf-sub">Loading…</p></div>'; ov.classList.add('show'); await erpStaffAdminLoad(true); }
  const teams = ['Sales', 'Accounts', 'CRM', 'Production', 'Dispatch'];
  ov.innerHTML = `<div class="erp-box" role="dialog" aria-modal="true">
    <div class="erp-top"><h2>${s ? 'Edit ' + eEsc(s.name) : 'Add person'}</h2><button type="button" class="btn" onclick="document.getElementById('erpAdmin').classList.remove('show')">Close</button></div>
    <div class="erp-form">
      ${s ? `<div class="erp-fixed"><b>${eEsc(s.name)}</b><span>${eEsc(s.id)}</span></div><input type="hidden" id="esEmp" value="${eEsc(s.id)}">`
          : ESTF.empErr ? `<div class="erp-err">⚠️ ${eEsc(ESTF.empErr)}</div>`
          : `<label>Employee (from Common Employees sheet)</label>
             <div class="erp-row"><input id="esQ" placeholder="Search name, Emp ID or department…" autocomplete="off" oninput="erpEmpFilter(this)">
             <button type="button" class="btn" title="Reload list from the sheet" onclick="erpEmpRefresh(this)">↻</button></div>
             <select id="esEmp" size="6" class="erp-list">${erpEmpOptions('')}</select>`}
      <div class="erp-grid2">
        <div><label>Team</label><select id="esTeam" onchange="erpSalesToggle()">${teams.map(t => `<option ${s && s.team === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div id="esSalesWrap"><label>Sales Name <small>(name used on orders)</small></label><input id="esSales" list="esSalesList" value="${eEsc(s ? s.salesName : '')}" placeholder="e.g. Vijay">
          <datalist id="esSalesList">${ESTF.salesNames.map(n => `<option value="${eEsc(n)}">`).join('')}</datalist></div>
        <div><label>Status</label><select id="esAct"><option value="true">Active</option><option value="false" ${s && s.active === false ? 'selected' : ''}>Inactive</option></select></div>
        <div><label>${s ? 'New PIN (leave empty to keep)' : 'PIN (4-8 digits)'}</label><input id="esPin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div>
      </div>
    </div>
    <div class="erp-actions"><button type="button" class="btn" onclick="document.getElementById('erpAdmin').classList.remove('show')">Cancel</button>
      <button type="button" class="btn btn-primary" id="esSave" data-new="${s ? '' : '1'}" onclick="erpStaffSave(this)">Save</button></div></div>`;
  ov.classList.add('show');
  erpSalesToggle();
  const q = document.getElementById('esQ'); if (q) q.focus();
}
async function erpStaffSave(btn) {
  const d = { action: 'saveStaff', isNew: btn.dataset.new ? 'true' : 'false', empId: (document.getElementById('esEmp') || {}).value || '',
    team: document.getElementById('esTeam').value, salesName: document.getElementById('esSales').value.trim(),
    active: document.getElementById('esAct').value, pin: document.getElementById('esPin').value.trim() };
  if (!d.empId) { toast('Pick the employee from the list', 'e'); return; }
  if (d.team === 'Sales' && !d.salesName) { toast('Pick the Sales Name used on orders', 'e'); return; }
  if (d.pin && !/^\d{4,8}$/.test(d.pin)) { toast('PIN must be 4-8 digits', 'e'); return; }
  if (d.isNew === 'true' && !d.pin) { toast('Set a PIN for the new person', 'e'); return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  const r = await eApi(d);
  if (!r || r.success === false) { toast((r && r.message) || 'Could not save', 'e'); btn.disabled = false; btn.textContent = 'Save'; return; }
  toast('Saved', 's'); document.getElementById('erpAdmin').classList.remove('show');
  erpStaffAdminLoad();
}

/* =====================================================================
   LINKED RECORDS — Salesforce jaisa: naam / ID pe click → us record ka page
   Customer page (Customer 360): orders, payments, leads, Service tickets, Advance Replacement
   Dusre app ka record (ticket, case) → Suite khud sahi app kholta hai (open-record message)
   ===================================================================== */
let LD_ORDER_FOR = '';                 // lead se order ban raha hai to us lead ki ID
let C360 = null, C360_BACK = null;      // abhi khula customer + kahan se aaye the
const recEsc = v => String(v == null ? '' : v).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
// link banane wale (click → record)
function recA(type, key, text, nm) {
  if (!key) return recEsc(text || '');
  return `<a href="#" class="rec-link" data-t="${recEsc(type)}" data-k="${recEsc(key)}"${nm ? ` data-n="${recEsc(nm)}"` : ''} onclick="return recGo(this, event)">${recEsc(text || key)}</a>`;
}
// customer link: naam hi asli pehchaan (same phone wale doosre customer pe nahi jaana). vname = master me jo naam hoga (lead me Company)
function custLink(name, phone, id, vname) {
  name = String(name || '').trim(); if (!name) return '—';
  const k = String(id || '').trim() || name;
  return recA('customer', k, name, String(vname || name).trim());
}
function ordLink(id) { return id ? recA('order', id, id) : ''; }
function recGo(el, e) { if (e) { e.preventDefault(); e.stopPropagation(); } openRec(el.dataset.t, el.dataset.k, el.dataset.n); return false; }
// kaunsa record kahan khulta hai
function openRec(type, key, nm) {
  if (type === 'customer') return openCustomer(key, nm);
  if (type === 'order') return openOrderRec(key);
  if (type === 'lead') return openLeadRec(key);
  suiteOpen(type, key);   // ticket / case → Service Hub
}
function suiteOpen(type, id) {
  if (window.parent === window) return toast('This record opens inside Litpax Suite', 'w');
  try { window.parent.postMessage({ source: 'litpax-suite', type: 'open-record', rtype: type, id: id }, location.origin); } catch (e) {}
}
function suiteCan(mod) { try { return (sessionStorage.getItem('suite_can') || '').split(',').indexOf(mod) !== -1; } catch (e) { return false; } }

// ---- Order: wahi purana detail popup ----
function openOrderRec(id) {
  closeModal('orderDetailModal');
  const o = (allOrders || []).find(x => x['Order ID'] === id) || (adAllOrders || []).find(x => x['Order ID'] === id);
  if (o) return viewOrder(o);
  api({ action: 'getOrders' }, r => {
    const f = ((r && r.data) || []).find(x => x['Order ID'] === id);
    if (!f) return toast(id + ' not found', 'e');
    if (user.role === 'Sales' && user.salesName && (f['Sales Person Name'] || '') !== user.salesName) return toast(id + ' is not your order', 'e');
    viewOrder(f);
  });
}
// ---- Lead: wahi lead form ----
function openLeadRec(id) {
  const go = () => { if (!ldAll.find(x => x['Lead ID'] === id)) return toast(id + ' not found (or not yours)', 'e'); openLeadModal(id); };
  if (ldLoaded) return go();
  api({ action: 'getLeads' }, r => {
    if (!r || !r.success) return toast((r && r.message) || 'Could not load leads', 'e');
    ldAll = r.data || []; ldMe = r.me || {}; ldPeople = r.salesPeople || []; ldLoaded = true; go();
  });
}
// ---- Lead → Order (lead ki details order form me) ----
function ldToOrder(id) {
  if (!ACC_MODE && !ldToOrder._chk) { ldToOrder._chk = 1; return accEnsure(() => ldToOrder(id)); }   // Accounts on? → convert flow
  if (ACC_MODE) return accConvertLead(id);
  const l = ldAll.find(x => x['Lead ID'] === id); if (!l) return;
  resetOrderForm();
  LD_ORDER_FOR = id;
  const set = (el, v) => { const e = document.getElementById(el); if (!e || !v) return; if (e.tagName === 'SELECT' && ![...e.options].some(o => o.value === v)) return; e.value = v; };
  set('o-cust', l.Company || l['Customer Name']); set('o-phone', l.Phone); set('o-city', l.City); set('o-sales', l['Assigned To']);
  openModal('orderModal');
  const body = document.querySelector('#orderModal .modal-body') || document.querySelector('#orderModal .modal');
  if (body) body.insertAdjacentHTML('afterbegin', `<div id="ldOrderNote" class="rec-note">📋 Lead <b>${recEsc(id)}</b> — the new order will be linked to this lead</div>`);
}

// ---- Customer page ----
function openCustomer(key, nm, hint) {
  key = String(key || '').trim(); if (!key) return;
  ['orderDetailModal', 'leadModal'].forEach(m => { const el = document.getElementById(m); if (el && el.classList.contains('show')) el.classList.remove('show'); });
  const cur = document.querySelector('.page.active');
  if (cur && cur.id !== 'page-customer') C360_BACK = { page: cur.id.replace('page-', ''), title: document.getElementById('pageTitle').textContent, sub: document.getElementById('pageSub').textContent };
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-customer').classList.add('active');
  document.getElementById('pageTitle').textContent = ACC_MODE ? 'Account' : 'Customer';
  document.getElementById('pageSub').textContent = pageMeta.customer.sub;
  document.getElementById('c360').innerHTML = '<div class="loading"><div class="spin"></div></div>';
  api({ action: 'getCustomer360', key, name: String(nm || '').trim(), hint: String(hint || '').trim() }, r => {
    if (!r || !r.success) { document.getElementById('c360').innerHTML = `<div class="empty"><div class="empty-ico">👤</div><div class="empty-txt">${recEsc((r && r.message) || 'Could not load customer')}</div></div>`; return; }
    C360 = r; renderC360();
  });
}
function c360Back() {
  const b = C360_BACK;
  if (!b) return nav(roleAccess[user.role] ? roleAccess[user.role][0] : 'orders');
  const el = document.getElementById('nav-' + b.page);
  if (document.getElementById('page-' + b.page)) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + b.page).classList.add('active');
    document.getElementById('pageTitle').textContent = b.title; document.getElementById('pageSub').textContent = b.sub;
    if (el) el.classList.add('active');
  }
}
const c360Rs = v => '₹' + fmt(Math.round(v || 0));
function c360Sec(icon, title, n, body, empty) {
  return `<div class="card c360-rel"><div class="card-head"><div class="card-title">${icon} ${title} <span class="c360-n">${n}</span></div></div>${n ? body : `<div class="c360-empty">${empty}</div>`}</div>`;
}
function c360Row(main, sub, right, extra) {
  return `<div class="c360-row"><div class="c360-main">${main}${sub ? `<div class="c360-sub">${sub}</div>` : ''}</div><div class="c360-right">${right || ''}${extra ? `<div class="c360-sub">${extra}</div>` : ''}</div></div>`;
}
function renderC360() {
  const r = C360, c = r.customer, t = r.totals;
  const can = suiteCan('m-service');
  const tkLink = (id) => can ? recA('ticket', id, id) : recEsc(id);
  const csLink = (id) => can ? recA('case', id, id) : recEsc(id);
  const tone = s => /dispatch|complete|closed|order confirmed|delivered/i.test(s) ? 'b-ready' : /lost|cancel|reject/i.test(s) ? 'b-credit' : 'b-pending';
  const pill = s => s ? `<span class="badge ${tone(s)}">${recEsc(s)}</span>` : '';
  const tel = c.Phone ? `<a href="tel:${recEsc(c.Phone)}">${recEsc(c.Phone)}</a>` : '—';
  const info = [['Contact', c.ContactPerson], ['Phone', tel, 1], ['City', c.City], ['GSTIN', c.GSTIN], ['Credit days', c.CreditDays], ['Added by', c['Added By']]]
    .map(([l, v, raw]) => `<div class="c360-kv"><span>${l}</span><b>${v ? (raw ? v : recEsc(v)) : '—'}</b></div>`).join('');
  const orders = r.orders.map(o => c360Row(`${ordLink(o.id)} <span class="c360-muted">· ${recEsc(fmtDisplayDate(o.date))}</span>`,
    recEsc([o.qty ? o.qty + ' batteries' : '', o.sales, o.final || ''].filter(Boolean).join(' · ')), `<b>${c360Rs(o.value)}</b>`,
    o.due > 0 ? `<span class="c360-due">Due ${c360Rs(o.due)}</span>` : (o.value ? '<span class="c360-ok">Paid</span>' : ''))).join('');
  const pays = r.payments.map(p => c360Row(`<b>${c360Rs(p.Amount)}</b> <span class="c360-muted">· ${recEsc(fmtDisplayDate(p.Date || p['Payment Date'] || ''))}</span>`,
    recEsc([p.Mode || p['Payment Mode'], p['Reference'] || p['Ref No'] || ''].filter(Boolean).join(' · ')), ordLink(p['Order ID']))).join('');
  const leads = r.leads.map(l => c360Row(`${recA('lead', l.id, l.id)} <span class="c360-muted">· ${recEsc(fmtDisplayDate(l.date))}</span>`,
    recEsc([l.app, l.qty ? '× ' + l.qty : '', l.assigned].filter(Boolean).join(' · ')), ldBadge(l.stage), l.orderId ? '📦 ' + ordLink(l.orderId) : '')).join('');
  const tks = r.tickets.map(k => c360Row(`${tkLink(k.id)} <span class="c360-muted">· ${recEsc(k.date)}</span>`,
    recEsc([k.complaint, k.model, k.items && +k.items ? k.items + ' items' : ''].filter(Boolean).join(' · ')), pill(k.status))).join('');
  const css = r.cases.map(k => c360Row(`${csLink(k.id)} <span class="c360-muted">· ${recEsc(k.date)}</span>`,
    recEsc([k.model, k.serial && 'SN ' + k.serial, k.warranty].filter(Boolean).join(' · ')), pill(k.status), k.ticket ? 'Ticket ' + tkLink(k.ticket) : '')).join('');
  if (r.isAccount) { ACC_MODE = true; if (r.meta) ACC_META = r.meta; document.getElementById('pageTitle').textContent = 'Account'; }
  const via = r.via && r.via.contact ? `<span class="c360-muted">Opened from phone → ${recEsc(r.via.contact.Name)}${r.via.contact.Role ? ' (' + recEsc(r.via.contact.Role) + ')' : ''}</span>` : '';
  document.getElementById('c360').innerHTML = `
    <div class="c360-top"><button class="btn btn-sm" onclick="c360Back()">← Back</button>${r.found ? '' : '<span class="c360-warn">⚠ Not in the customer master — showing records matched by name / phone</span>'}${via}</div>
    <div class="c360-grid">
      <div class="c360-side">
        ${r.isAccount ? accSideHtml(r) : `<div class="card c360-card">
          <div class="c360-av">${recEsc(String(c.CompanyName || '?').trim().charAt(0).toUpperCase())}</div>
          <div class="c360-name">${recEsc(c.CompanyName)}</div>
          <div class="c360-id">${recEsc(c.CustomerID || 'No ID')}</div>
          <div class="c360-info">${info}</div>
        </div>`}
        <div class="stats-row c360-kpis">
          <div class="stat c-blue"><div class="stat-lbl">Orders</div><div class="stat-val">${t.orders}</div></div>
          <div class="stat c-green"><div class="stat-lbl">Total business</div><div class="stat-val">${c360Rs(t.value)}</div></div>
          <div class="stat ${t.due ? 'c-red' : 'c-green'}"><div class="stat-lbl">Payment due</div><div class="stat-val">${c360Rs(t.due)}</div></div>
          <div class="stat ${r.tickets.some(k => !/closed|cancel/i.test(k.status)) ? 'c-amber' : ''}"><div class="stat-lbl">Service tickets</div><div class="stat-val">${r.tickets.length}</div></div>
        </div>
        ${r.hiddenOrders ? `<div class="c360-muted c360-hint">${r.hiddenOrders} order(s) belong to other salespeople (hidden from you)</div>` : ''}
      </div>
      <div class="c360-main-col">
        ${c360Sec('📦', 'Orders', r.orders.length, orders, 'No orders')}
        ${c360Sec('💰', 'Payments', r.payments.length, pays, 'No payments')}
        ${r.team === 'Admin' || r.team === 'Sales' ? c360Sec('🎯', 'Leads', r.leads.length, leads, 'No leads') : ''}
        ${c360Sec('🛠', 'Service tickets', r.tickets.length, tks, 'No service tickets')}
        ${c360Sec('🔁', 'Advance Replacement', r.cases.length, css, 'No replacement cases')}
      </div>
    </div>`;
}

// ---- Suite se aaya "ye record kholo" ----
function recFromSuite(rtype, id) {
  try { sessionStorage.removeItem('suite_open'); } catch (e) {}
  if (rtype === 'customer' && /\|/.test(String(id))) {   // Service / Replacement se: "phone|naam"
    const [ph, nm] = String(id).split('|');
    return openCustomer(ph || nm, '', ph ? nm : '');
  }
  if (['customer', 'order', 'lead'].indexOf(rtype) !== -1 && id) openRec(rtype, id);
}
window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.source !== 'litpax-suite' || e.data.type !== 'open-record') return;
  recFromSuite(e.data.rtype, e.data.id);
});
setTimeout(() => {   // ERP pehli baar khula aur koi record kholna tha
  let p = null; try { p = JSON.parse(sessionStorage.getItem('suite_open') || 'null'); } catch (e) {}
  if (p && p.app === 'erp' && Date.now() - (p.t || 0) < 60000) recFromSuite(p.rtype, p.id);
}, 400);

/* =====================================================================
   ACCOUNTS — Account (company) + Contacts (us company ke log)
   · Customers list / Account page / naya order / lead convert sab isi se
   · Backend: ERP GAS Accounts.gs (acct* actions). Setup se pehle purana Customers hi chalta hai
   ===================================================================== */
let ACC_MODE = false, ACC_META = { types: ['OEM', 'Dealer', 'Retail'], roles: ['Owner', 'Purchase', 'Accounts', 'Service', 'Sales'] };
let ACC_CTX = null;       // naya account kis kaam ke liye: {from:'order'|'list'|'lead'|'page', lead, name…}
const accEsc = recEsc;
const accIsAdmin = () => user.role === 'Admin';

// getCustomers ke saath hi mode + meta aata hai (loadCustCache ise use karta hai)
function accFromCustomers(r) {
  ACC_MODE = !!(r && r.accounts);
  if (r && r.meta) ACC_META = r.meta;
}
function accEnsure(cb) {
  if (custCache.length) return cb();
  api({ action: 'getCustomers' }, r => { custCache = (r.success && r.data) ? r.data : []; accFromCustomers(r); accFillDatalist(); cb(); });
}
function accFillDatalist() {
  document.querySelectorAll('.acc-pick .btn').forEach(b => { b.style.display = ACC_MODE ? '' : 'none'; });
  const dl = document.getElementById('custSuggestions');
  if (dl) dl.innerHTML = custCache.map(c => `<option value="${accEsc(c.CompanyName)}">${accEsc([c.Type, c.City, c.Phone].filter(Boolean).join(' · '))}</option>`).join('');
}
const accTypeBadges = t => String(t || '').split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="acc-type">${accEsc(x)}</span>`).join('') || '<span class="acc-type acc-type-none">Type not set</span>';

/* ---------- Order form: customer list se ---------- */
function accFindByName(v) { v = String(v || '').trim().toLowerCase(); return v ? custCache.find(c => String(c.CompanyName || '').trim().toLowerCase() === v) : null; }
function accOrderPick(c, contactId) {
  const idEl = document.getElementById('o-custid'), wrap = document.getElementById('o-contact-wrap'), sel = document.getElementById('o-contact'), note = document.getElementById('o-acct-note');
  if (!idEl) return;
  idEl.value = c ? c.CustomerID : '';
  if (note) note.innerHTML = c ? `🏢 ${accTypeBadges(c.Type)} <span class="c360-muted">${accEsc(c.CustomerID)}</span>` : '';
  const cs = c && Array.isArray(c.contacts) ? c.contacts.filter(x => x.Active !== 'No') : [];
  if (wrap) wrap.style.display = ACC_MODE && c ? '' : 'none';
  if (sel) {
    sel.innerHTML = '<option value="">— Not specified —</option>' + cs.map(x => `<option value="${accEsc(x['Contact ID'])}" data-ph="${accEsc(x.Phone)}">${accEsc(x.Name)}${x.Role ? ' · ' + accEsc(x.Role) : ''}${x.Phone ? ' · ' + accEsc(x.Phone) : ''}${x.Primary === 'Yes' ? ' ⭐' : ''}</option>`).join('');
    const pick = contactId || (cs.find(x => x.Primary === 'Yes') || cs[0] || {})['Contact ID'] || '';
    sel.value = pick;
  }
}
function accContactChange() {
  const sel = document.getElementById('o-contact'), o = sel && sel.selectedOptions[0];
  if (o && o.dataset.ph) { const ph = document.getElementById('o-phone'); ph.value = o.dataset.ph; clearErr(ph); }
}
function accOrderNew() {
  ACC_CTX = { from: 'order' };
  accOpenForm(null, { name: document.getElementById('o-cust').value.trim(), phone: document.getElementById('o-phone').value.trim(), city: document.getElementById('o-city').value.trim() });
}
// validateOrderMeta se: list ka customer chuna hai?
function accOrderCheck() {
  if (!ACC_MODE) return true;
  const el = document.getElementById('o-cust'), id = document.getElementById('o-custid');
  if (!el || !el.value.trim()) return true;           // khaali → purana "required" message
  const c = accFindByName(el.value);
  if (c && id && !id.value) accOrderPick(c);
  if (id && id.value) return true;
  markErr(el);
  toast('Pick the customer from the list — or click "+ New" to create the account', 'e');
  return false;
}

/* ---------- Account form (naya / edit) ---------- */
function accModals() {
  if (document.getElementById('acctModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" id="acctModal"><div class="modal" style="max-width:640px;">
  <div class="modal-head"><div class="modal-title" id="acctTitle">New Account</div><button class="modal-close" onclick="closeModal('acctModal')">✕</button></div>
  <div class="modal-body">
    <div id="acctDup"></div>
    <input type="hidden" id="af-id">
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Account name *</label><input class="form-control" id="af-name" placeholder="Company / shop name (or person's name for retail)"></div>
      <div class="form-group full"><label class="form-label">Type *</label><div class="acc-chips" id="af-types"></div></div>
      <div class="form-group"><label class="form-label">City</label><input class="form-control" id="af-city"></div>
      <div class="form-group"><label class="form-label">State</label><input class="form-control" id="af-state"></div>
      <div class="form-group"><label class="form-label">GSTIN</label><input class="form-control" id="af-gst" maxlength="15" style="text-transform:uppercase"></div>
      <div class="form-group"><label class="form-label">Credit days</label><input class="form-control" id="af-credit" inputmode="numeric"></div>
      <div class="form-group acc-edit-only"><label class="form-label">PAN</label><input class="form-control" id="af-pan" maxlength="10" style="text-transform:uppercase"></div>
      <div class="form-group acc-edit-only"><label class="form-label">Pincode</label><input class="form-control" id="af-pin" inputmode="numeric" maxlength="6"></div>
      <div class="form-group full acc-edit-only"><label class="form-label">Address</label><input class="form-control" id="af-addr"></div>
    </div>
    <div class="acc-new-only">
      <div class="acc-sub">First contact <span class="c360-muted">— the person you deal with</span></div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Name</label><input class="form-control" id="af-cname"></div>
        <div class="form-group"><label class="form-label">Role</label><select class="form-control" id="af-crole"></select></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="af-cphone" inputmode="numeric" maxlength="13"></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="af-cemail"></div>
      </div>
    </div>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal('acctModal')">Cancel</button><button class="btn btn-primary" id="af-save" onclick="accSave()">Save</button></div>
</div></div>
<div class="modal-overlay" id="conModal"><div class="modal" style="max-width:520px;">
  <div class="modal-head"><div class="modal-title" id="conTitle">Add Contact</div><button class="modal-close" onclick="closeModal('conModal')">✕</button></div>
  <div class="modal-body">
    <input type="hidden" id="cf-id"><input type="hidden" id="cf-acc">
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Name *</label><input class="form-control" id="cf-name"></div>
      <div class="form-group"><label class="form-label">Role</label><select class="form-control" id="cf-role"></select></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="cf-phone" inputmode="numeric" maxlength="13"></div>
      <div class="form-group"><label class="form-label">Alt phone</label><input class="form-control" id="cf-alt" inputmode="numeric" maxlength="13"></div>
      <div class="form-group full"><label class="form-label">Email</label><input class="form-control" id="cf-email"></div>
      <div class="form-group"><label class="acc-chk"><input type="checkbox" id="cf-primary"> Primary contact ⭐</label></div>
      <div class="form-group" id="cf-active-wrap"><label class="acc-chk"><input type="checkbox" id="cf-active" checked> Active</label></div>
    </div>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal('conModal')">Cancel</button><button class="btn btn-primary" id="cf-save" onclick="accContactSave()">Save</button></div>
</div></div>
<div class="modal-overlay" id="convModal"><div class="modal" style="max-width:600px;">
  <div class="modal-head"><div class="modal-title" id="convTitle">Convert lead</div><button class="modal-close" onclick="closeModal('convModal')">✕</button></div>
  <div class="modal-body" id="convBody"></div>
</div></div>
<div class="modal-overlay" id="dupModal"><div class="modal" style="max-width:980px;">
  <div class="modal-head"><div class="modal-title">Duplicate accounts</div><button class="modal-close" onclick="closeModal('dupModal')">✕</button></div>
  <div class="modal-body" id="dupBody"></div>
</div></div>
<div class="modal-overlay" id="accSetModal"><div class="modal" style="max-width:520px;">
  <div class="modal-head"><div class="modal-title">Account types &amp; contact roles</div><button class="modal-close" onclick="closeModal('accSetModal')">✕</button></div>
  <div class="modal-body"><div class="form-grid">
    <div class="form-group full"><label class="form-label">Account types (comma separated)</label><input class="form-control" id="as-types"></div>
    <div class="form-group full"><label class="form-label">Contact roles (comma separated)</label><input class="form-control" id="as-roles"></div>
  </div><div class="c360-muted" style="font-size:12px;">Removing a type does not change accounts that already use it.</div></div>
  <div class="modal-foot"><button class="btn" onclick="closeModal('accSetModal')">Cancel</button><button class="btn btn-primary" onclick="accSettingsSave(this)">Save</button></div>
</div></div>`);
}
function accRoleOpts(sel, v) { sel.innerHTML = '<option value="">—</option>' + ACC_META.roles.map(r => `<option${r === v ? ' selected' : ''}>${accEsc(r)}</option>`).join(''); }
function accTypeChips(cur) {
  const on = String(cur || '').split(',').map(x => x.trim());
  document.getElementById('af-types').innerHTML = ACC_META.types.map(t => `<label class="acc-chip"><input type="checkbox" value="${accEsc(t)}"${on.includes(t) ? ' checked' : ''}> ${accEsc(t)}</label>`).join('');
}
// a = existing account (edit) ya null (naya); pre = {name, phone, city, state, cname, email}
function accOpenForm(a, pre) {
  accModals();
  if (a) ACC_CTX = null;
  pre = pre || {};
  const set = (id, v) => { document.getElementById(id).value = v == null ? '' : v; };
  document.getElementById('acctDup').innerHTML = '';
  document.getElementById('acctTitle').textContent = a ? 'Edit Account' : 'New Account';
  document.querySelectorAll('#acctModal .acc-new-only').forEach(e => { e.style.display = a ? 'none' : ''; });
  document.querySelectorAll('#acctModal .acc-edit-only').forEach(e => { e.style.display = a ? '' : 'none'; });
  set('af-id', a ? a['Account ID'] : '');
  set('af-name', a ? a['Account Name'] : pre.name); set('af-city', a ? a.City : pre.city); set('af-state', a ? a.State : pre.state);
  set('af-gst', a ? a.GSTIN : ''); set('af-credit', a ? a['Credit Days'] : ''); set('af-pan', a ? a.PAN : ''); set('af-pin', a ? a.Pincode : ''); set('af-addr', a ? a.Address : '');
  set('af-cname', pre.cname || ''); set('af-cphone', pre.phone || ''); set('af-cemail', pre.email || '');
  accRoleOpts(document.getElementById('af-crole'), pre.role || '');
  accTypeChips(a ? a.Type : pre.type || '');
  const fin = !!(a && C360 && C360.can && C360.can.financeOnly);
  ['af-name'].forEach(id => { document.getElementById(id).disabled = fin; });
  document.querySelectorAll('#af-types input').forEach(i => { i.disabled = fin; });
  const b = document.getElementById('af-save'); b.disabled = false; b.textContent = 'Save';
  openModal('acctModal');
  setTimeout(() => document.getElementById(a ? 'af-city' : 'af-name').focus(), 60);
}
function accSave(force) {
  const g = id => document.getElementById(id).value.trim();
  const id = g('af-id');
  const types = [...document.querySelectorAll('#af-types input:checked')].map(i => i.value).join(', ');
  const p = { action: 'acctSave', 'Account Name': g('af-name'), Type: types, City: g('af-city'), State: g('af-state'), GSTIN: g('af-gst').toUpperCase(), 'Credit Days': g('af-credit') };
  if (id) Object.assign(p, { 'Account ID': id, PAN: g('af-pan').toUpperCase(), Pincode: g('af-pin'), Address: g('af-addr') });
  else Object.assign(p, { contactName: g('af-cname'), contactRole: g('af-crole'), contactPhone: g('af-cphone'), contactEmail: g('af-cemail') });
  if (!p['Account Name']) return toast('Enter the account name', 'e');
  if (!id && !types) return toast('Choose at least one type', 'e');
  const oldGst = id && C360 && C360.account ? String(C360.account.GSTIN || '').toUpperCase() : '';
  if (p.GSTIN && p.GSTIN !== oldGst && p.GSTIN.length !== 15) return toast('GSTIN must be 15 characters', 'e');
  if (!id && p.contactPhone && !isValidPhone(p.contactPhone.replace(/\D/g, '').slice(-10))) return toast('Enter a valid 10-digit phone number', 'e');
  if (ACC_CTX && ACC_CTX.lead && !id) p.leadId = ACC_CTX.lead;
  if (force) p.force = 'true';
  if (id && C360 && C360.account && C360.account['Account Name'] !== p['Account Name'] && confirm('Rename it in old orders, challans and other records too?\n\nOK = rename everywhere · Cancel = only the account')) p.renameRecords = 'true';
  const b = document.getElementById('af-save'); b.disabled = true; b.textContent = 'Saving…';
  api(p, r => {
    b.disabled = false; b.textContent = 'Save';
    if (!r || !r.success) return toast((r && r.message) || 'Save failed', 'e');
    if (r.duplicate) return accShowDup(r.matches, !!id);
    toast(id ? 'Account updated' + (r.renamed ? ` · renamed in ${r.renamed} places` : '') : `Account ${r.id} created`, 's');
    closeModal('acctModal');
    custCache = []; accEnsure(() => accAfterSave(r.account, r.contactId));
  });
}
// "pehle se hai" — use karo / kholo / phir bhi banao
function accShowDup(list, isEdit) {
  const box = document.getElementById('acctDup');
  const useBtn = ACC_CTX && (ACC_CTX.from === 'order' || ACC_CTX.from === 'lead');
  box.innerHTML = `<div class="acc-dup"><b>⚠ Looks like this account already exists:</b>${list.map(a => `
    <div class="acc-dup-row"><div><b>${accEsc(a['Account Name'])}</b> <span class="c360-muted">${accEsc(a['Account ID'])}</span> ${accTypeBadges(a.Type)}
      <div class="c360-sub">${accEsc([a.City, (a.why || []).join(', ')].filter(Boolean).join(' · '))}</div></div>
      <div>${useBtn ? `<button class="btn btn-sm btn-primary" onclick="accUseExisting('${accEsc(a['Account ID'])}')">Use this</button>` : `<button class="btn btn-sm" onclick="closeModal('acctModal');openCustomer('${accEsc(a['Account ID'])}')">Open</button>`}</div></div>`).join('')}
    <div style="margin-top:8px;"><button class="btn btn-sm" onclick="accSave(true)">${isEdit ? 'Save anyway' : 'It is different — create anyway'}</button></div></div>`;
}
function accUseExisting(id) {
  closeModal('acctModal');
  accEnsure(() => { const c = custCache.find(x => x.CustomerID === id); if (c) accAfterSave({ 'Account ID': id }, ''); });
}
// save ke baad: kahan se aaye the wahan wapas
function accAfterSave(acc, contactId) {
  const ctx = ACC_CTX || {}; ACC_CTX = null;
  const id = acc && acc['Account ID'];
  const c = custCache.find(x => x.CustomerID === id);
  if (ctx.from === 'order' && c) {
    const el = document.getElementById('o-cust'); el.value = c.CompanyName; clearErr(el);
    onCustNameInput(); accOrderPick(c, contactId);
    return;
  }
  if (ctx.from === 'lead' && c) return accLeadToOrder(ctx.lead, c, ctx);
  if (ctx.from === 'list') { if (typeof loadCustomers === 'function') loadCustomers(); return openCustomer(id); }
  if (C360 && document.getElementById('page-customer').classList.contains('active')) openCustomer(id, '', '', true);
}

/* ---------- Contact form ---------- */
function accContactOpen(accId, conId) {
  accModals();
  const a = C360 && C360.account;
  const c = conId && a ? a.contacts.find(x => x['Contact ID'] === conId) : null;
  const set = (id, v) => { document.getElementById(id).value = v == null ? '' : v; };
  document.getElementById('conTitle').textContent = c ? 'Edit Contact' : 'Add Contact';
  set('cf-id', c ? c['Contact ID'] : ''); set('cf-acc', accId);
  set('cf-name', c ? c.Name : ''); set('cf-phone', c ? c.Phone : ''); set('cf-alt', c ? c['Alt Phone'] : ''); set('cf-email', c ? c.Email : '');
  accRoleOpts(document.getElementById('cf-role'), c ? c.Role : '');
  document.getElementById('cf-primary').checked = !!(c && c.Primary === 'Yes');
  document.getElementById('cf-active').checked = !c || c.Active !== 'No';
  document.getElementById('cf-active-wrap').style.display = c ? '' : 'none';
  openModal('conModal');
  setTimeout(() => document.getElementById('cf-name').focus(), 60);
}
function accContactSave(force) {
  const g = id => document.getElementById(id).value.trim();
  const id = g('cf-id');
  const p = { action: 'acctContactSave', 'Account ID': g('cf-acc'), Name: g('cf-name'), Role: g('cf-role'), Phone: g('cf-phone'), 'Alt Phone': g('cf-alt'), Email: g('cf-email'),
    Primary: document.getElementById('cf-primary').checked ? 'Yes' : '' };
  if (id) { p['Contact ID'] = id; p.Active = document.getElementById('cf-active').checked ? 'Yes' : 'No'; }
  if (!p.Name) return toast('Enter the contact name', 'e');
  if (force) p.force = 'true';
  const b = document.getElementById('cf-save'); b.disabled = true; b.textContent = 'Saving…';
  api(p, r => {
    b.disabled = false; b.textContent = 'Save';
    if (!r || !r.success) return toast((r && r.message) || 'Save failed', 'e');
    if (r.duplicate) { if (confirm('⚠ ' + r.msg + '.\n\nSave anyway?')) accContactSave(true); return; }
    toast(id ? 'Contact updated' : 'Contact added', 's');
    closeModal('conModal'); custCache = [];
    if (C360 && C360.account) { C360.account = r.account; renderC360(); }
  });
}

/* ---------- Lead → Account → Order ---------- */
function accConvertLead(id) {
  const l = ldAll.find(x => x['Lead ID'] === id); if (!l) return;
  accModals();
  const name = l.Company || l['Customer Name'];
  document.getElementById('convTitle').textContent = 'Convert lead ' + id;
  document.getElementById('convBody').innerHTML = '<div class="loading"><div class="spin"></div></div>';
  openModal('convModal');
  accEnsure(() => api({ action: 'acctMatch', name, phone: l.Phone || '' }, r => {
    const list = (r && r.success && r.data) || [];
    const pre = { name, phone: l.Phone, city: l.City, state: l.State, cname: l['Customer Name'], email: l.Email, role: l.Company ? '' : 'Owner', type: l.Company ? '' : 'Retail' };
    ACC_CTX = { from: 'lead', lead: id, person: l['Customer Name'], phone: l.Phone, email: l.Email };
    document.getElementById('convBody').innerHTML = `
      <div class="rec-note">🎯 <b>${accEsc(name)}</b>${l['Customer Name'] && l.Company ? ' · ' + accEsc(l['Customer Name']) : ''}${l.Phone ? ' · ' + accEsc(l.Phone) : ''}${l.City ? ' · ' + accEsc(l.City) : ''}</div>
      ${list.length ? `<div class="acc-sub">Existing account${list.length > 1 ? 's' : ''} that match</div>` + list.map(a => `
        <div class="acc-dup-row"><div><b>${accEsc(a['Account Name'])}</b> <span class="c360-muted">${accEsc(a['Account ID'])}</span> ${accTypeBadges(a.Type)}
          <div class="c360-sub">${accEsc([a.City, (a.why || []).join(', ')].filter(Boolean).join(' · '))}</div></div>
          <div><button class="btn btn-sm btn-primary" onclick="accConvertUse('${accEsc(a['Account ID'])}')">Use this account</button></div></div>`).join('') : '<div class="c360-muted" style="margin:6px 0 10px;">No existing account matches this lead.</div>'}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn ${list.length ? '' : 'btn-primary'}" id="convNew">+ Create new account</button><button class="btn" onclick="closeModal('convModal')">Cancel</button></div>`;
    document.getElementById('convNew').onclick = () => { closeModal('convModal'); accOpenForm(null, pre); };
  }));
}
function accConvertUse(accId) {
  const ctx = ACC_CTX; if (!ctx) return;
  const c = custCache.find(x => x.CustomerID === accId);
  api({ action: 'acctLinkLead', leadId: ctx.lead, 'Account ID': accId }, r => {
    if (!r || !r.success) return toast((r && r.message) || 'Could not link the lead', 'e');
    closeModal('convModal');
    accLeadToOrder(ctx.lead, c || { CustomerID: accId, CompanyName: r.account['Account Name'], contacts: r.account.contacts, Type: r.account.Type }, ctx);
  });
}
// lead ka insaan is account ka contact nahi hai to pooch ke jod do, phir order form
function accLeadToOrder(leadId, c, ctx) {
  ACC_CTX = null;
  const ph = String(ctx.phone || '').replace(/\D/g, '').slice(-10);
  const has = (c.contacts || []).some(x => String(x.Phone || '').slice(-10) === ph || String(x.Name || '').trim().toLowerCase() === String(ctx.person || '').trim().toLowerCase());
  const open = contactId => {
    const l = ldAll.find(x => x['Lead ID'] === leadId) || {};
    resetOrderForm();
    LD_ORDER_FOR = leadId;
    openModal('orderModal');
    const el = document.getElementById('o-cust'); el.value = c.CompanyName;
    onCustNameInput(); accOrderPick(c, contactId);
    if (l['Assigned To']) { const s = document.getElementById('o-sales'); if ([...s.options].some(o => o.value === l['Assigned To'])) s.value = l['Assigned To']; }
    if (ph && !document.getElementById('o-phone').value) document.getElementById('o-phone').value = ph;
    const body = document.querySelector('#orderModal .modal-body');
    if (body) body.insertAdjacentHTML('afterbegin', `<div id="ldOrderNote" class="rec-note">📋 Order from lead <b>${recEsc(leadId)}</b> for <b>${recEsc(c.CompanyName)}</b> — it will be linked to the lead and the account</div>`);
  };
  if (!has && ctx.person && ph && confirm(`Add ${ctx.person} (${ph}) as a contact of ${c.CompanyName}?`)) {
    api({ action: 'acctContactSave', 'Account ID': c.CustomerID, Name: ctx.person, Phone: ph, Email: ctx.email || '', force: 'true' }, r => {
      if (r && r.success && r.account) { c.contacts = r.account.contacts; custCache = []; accEnsure(() => {}); }
      open(r && r.id);
    });
  } else open('');
}

/* ---------- Duplicates (Admin) ---------- */
let ACC_DUP = null;
function accDupOpen(tab) {
  accModals(); openModal('dupModal');
  document.getElementById('dupBody').innerHTML = '<div class="loading"><div class="spin"></div></div>';
  if (tab === 'history') return accMergeHistory();
  api({ action: 'acctDupes' }, r => {
    if (!r || !r.success) { document.getElementById('dupBody').innerHTML = `<div class="empty"><div class="empty-txt">${accEsc((r && r.message) || 'Could not load')}</div></div>`; return; }
    ACC_DUP = r; accDupRender();
  });
}
function accDupTabs(on) {
  return `<div class="acc-tabs"><button class="btn btn-sm ${on === 'dup' ? 'btn-primary' : ''}" onclick="accDupOpen()">Duplicates</button><button class="btn btn-sm ${on === 'history' ? 'btn-primary' : ''}" onclick="accDupOpen('history')">Merge history</button>
    ${ACC_DUP && ACC_DUP.noType ? `<span class="c360-muted" style="margin-left:auto;">${ACC_DUP.noType} account(s) have no type yet — open them from Customers to set it</span>` : ''}</div>`;
}
function accDupRender() {
  const g = ACC_DUP.groups;
  document.getElementById('dupBody').innerHTML = accDupTabs('dup') + (g.length ? g.map((grp, gi) => `
    <div class="card acc-grp">
      <div class="acc-grp-head"><b>${grp.accounts.length} accounts</b> <span class="c360-muted">· ${accEsc(grp.reasons.join(' · '))}</span></div>
      ${grp.accounts.map((a, i) => `
        <label class="acc-grp-row"><input type="radio" name="keep${gi}" value="${accEsc(a['Account ID'])}"${i === 0 ? ' checked' : ''}>
          <div class="acc-grp-main"><b>${accEsc(a['Account Name'])}</b> <span class="c360-muted">${accEsc(a['Account ID'])}</span> ${accTypeBadges(a.Type)}
            <div class="c360-sub">${accEsc([a.City, a.GSTIN && 'GST ' + a.GSTIN, (a.contacts || []).filter(c => c.Active !== 'No').map(c => c.Name + (c.Phone ? ' ' + c.Phone : '')).join(', ')].filter(Boolean).join(' · '))}</div></div>
          <div class="acc-grp-stats">${a.stats.orders} order${a.stats.orders === 1 ? '' : 's'} · ${c360Rs(a.stats.value)}${a.stats.last ? `<div class="c360-sub">last ${accEsc(fmtDisplayDate(a.stats.last))}</div>` : ''}</div>
        </label>`).join('')}
      <div class="acc-grp-foot"><button class="btn btn-sm btn-primary" onclick="accMerge(${gi}, this)">Merge into selected</button><button class="btn btn-sm" onclick="accNotDup(${gi}, this)">Not duplicates</button></div>
    </div>`).join('') : '<div class="empty"><div class="empty-ico">✅</div><div class="empty-txt">No duplicate accounts found</div></div>');
}
function accMerge(gi, btn) {
  const grp = ACC_DUP.groups[gi];
  const keep = (document.querySelector(`input[name="keep${gi}"]:checked`) || {}).value;
  const k = grp.accounts.find(a => a['Account ID'] === keep), others = grp.accounts.filter(a => a['Account ID'] !== keep);
  const n = others.reduce((s, a) => s + a.stats.orders, 0);
  if (!confirm(`Merge into "${k['Account Name']}" (${keep})?\n\n${others.map(a => '• ' + a['Account Name'] + ' (' + a['Account ID'] + ') — ' + a.stats.orders + ' orders').join('\n')}\n\n${n} order(s) and all related records (production, accounts, challans, leads, service) will move to ${k['Account Name']}. Contacts move too.\nYou can undo this from Merge history.`)) return;
  btn.disabled = true; btn.textContent = 'Merging…';
  api({ action: 'acctMerge', keep, ids: others.map(a => a['Account ID']).join(',') }, r => {
    if (!r || !r.success) { btn.disabled = false; btn.textContent = 'Merge into selected'; return toast((r && r.message) || 'Merge failed', 'e'); }
    toast(`Merged · ${r.cells} cells updated` + (r.skipped && r.skipped.length ? ' · battery spec kept as is' : ''), 's');
    custCache = []; accDupOpen();
  });
}
function accNotDup(gi, btn) {
  const grp = ACC_DUP.groups[gi];
  if (!confirm('Mark these as different accounts? They will not show here again.')) return;
  btn.disabled = true;
  api({ action: 'acctNotDup', ids: grp.ids.join(',') }, r => {
    if (!r || !r.success) { btn.disabled = false; return toast((r && r.message) || 'Failed', 'e'); }
    ACC_DUP.groups.splice(gi, 1); accDupRender();
  });
}
function accMergeHistory() {
  api({ action: 'acctMerges' }, r => {
    const rows = (r && r.success && r.data) || [];
    document.getElementById('dupBody').innerHTML = accDupTabs('history') + (rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Kept</th><th>Merged</th><th>Cells</th><th>By</th><th></th></tr></thead><tbody>${rows.map(m => `
      <tr><td>${accEsc(m.Time)}</td><td><b>${accEsc(m['Keep Name'])}</b> <span class="c360-muted">${accEsc(m['Keep ID'])}</span></td><td>${accEsc(m['Merged Names'] || m['Merged IDs'])}</td>
      <td>${accEsc(m['Cells Changed'])}</td><td>${accEsc(m.By)}</td>
      <td>${m.Undone === 'Yes' ? '<span class="c360-muted">Undone</span>' : `<button class="btn btn-sm" onclick="accUndo('${accEsc(m['Merge ID'])}', this)">Undo</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><div class="empty-txt">No merges yet</div></div>');
  });
}
function accUndo(mid, btn) {
  if (!confirm('Undo this merge? Names and IDs go back to how they were (cells changed since are left alone).')) return;
  btn.disabled = true;
  api({ action: 'acctUndo', mergeId: mid }, r => {
    if (!r || !r.success) { btn.disabled = false; return toast((r && r.message) || 'Undo failed', 'e'); }
    toast(`Undone · ${r.cells} cells restored` + (r.conflicts ? ` · ${r.conflicts} changed later, left as is` : ''), 's');
    custCache = []; accMergeHistory();
  });
}
function accSettingsOpen() {
  accModals();
  document.getElementById('as-types').value = ACC_META.types.join(', ');
  document.getElementById('as-roles').value = ACC_META.roles.join(', ');
  openModal('accSetModal');
}
function accSettingsSave(btn) {
  btn.disabled = true;
  api({ action: 'acctSettingsSave', types: document.getElementById('as-types').value, roles: document.getElementById('as-roles').value }, r => {
    btn.disabled = false;
    if (!r || !r.success) return toast((r && r.message) || 'Save failed', 'e');
    ACC_META = r.meta; toast('Saved', 's'); closeModal('accSetModal');
  });
}

/* ---------- Account page (renderC360 ka account wala hissa) ---------- */
function accSideHtml(r) {
  const a = r.account, can = r.can || {};
  const kv = [['City', [a.City, a.State].filter(Boolean).join(', ')], ['GSTIN', a.GSTIN], ['PAN', a.PAN], ['Credit days', a['Credit Days']], ['Sales owner', a['Sales Owner']], ['Address', [a.Address, a.Pincode].filter(Boolean).join(' - ')]]
    .map(([l, v]) => `<div class="c360-kv"><span>${l}</span><b>${v ? accEsc(v) : '—'}</b></div>`).join('');
  const cons = (a.contacts || []).map(c => `
    <div class="acc-con${c.Active === 'No' ? ' acc-con-off' : ''}">
      <div class="acc-con-av">${accEsc(String(c.Name || '?').charAt(0).toUpperCase())}</div>
      <div class="acc-con-main"><b>${accEsc(c.Name)}</b>${c.Primary === 'Yes' ? ' <span title="Primary contact">⭐</span>' : ''}${c.Role ? ` <span class="acc-role">${accEsc(c.Role)}</span>` : ''}${c.Active === 'No' ? ' <span class="c360-muted">(inactive)</span>' : ''}
        <div class="c360-sub">${[c.Phone && `<a href="tel:${accEsc(c.Phone)}">${accEsc(c.Phone)}</a>`, c['Alt Phone'] && accEsc(c['Alt Phone']), c.Email && accEsc(c.Email)].filter(Boolean).join(' · ') || '—'}</div></div>
      ${can.contacts ? `<button class="btn btn-sm acc-con-edit" onclick="accContactOpen('${accEsc(a['Account ID'])}','${accEsc(c['Contact ID'])}')" title="Edit">✎</button>` : ''}
    </div>`).join('');
  return `
    <div class="card c360-card">
      <div class="c360-av">${accEsc(String(a['Account Name'] || '?').trim().charAt(0).toUpperCase())}</div>
      <div class="c360-name">${accEsc(a['Account Name'])}</div>
      <div class="c360-id">${accEsc(a['Account ID'])}</div>
      <div class="acc-types">${accTypeBadges(a.Type)}</div>
      ${a['Old Names'] ? `<div class="c360-muted acc-aka">Also known as: ${accEsc(a['Old Names'].split('|').join(', '))}</div>` : ''}
      <div class="c360-info">${kv}</div>
      ${can.edit ? `<button class="btn btn-sm acc-edit-btn" onclick="accOpenForm(C360.account)">✎ Edit account</button>` : ''}
    </div>
    <div class="card c360-card acc-cons">
      <div class="acc-cons-head"><b>👥 Contacts</b> <span class="c360-n">${(a.contacts || []).filter(c => c.Active !== 'No').length}</span>
        ${can.contacts ? `<button class="btn btn-sm" onclick="accContactOpen('${accEsc(a['Account ID'])}')">+ Add</button>` : ''}</div>
      ${cons || '<div class="c360-empty">No contacts yet</div>'}
    </div>`;
}

/* ---------- Customers page: buttons ---------- */
function accListTools() {
  if (!ACC_MODE || document.getElementById('accTools')) return;
  const head = document.querySelector('#page-customers .card-head');
  if (!head) return;
  const add = head.querySelector('.btn-primary');
  if (add) add.setAttribute('onclick', "ACC_CTX={from:'list'};accOpenForm(null)");
  if (accIsAdmin()) head.insertAdjacentHTML('beforeend', `<span id="accTools" style="display:flex;gap:6px;"><button class="btn" onclick="accDupOpen()">🔀 Duplicates</button><button class="btn" onclick="accSettingsOpen()" title="Account types & contact roles">⚙</button></span>`);
}
