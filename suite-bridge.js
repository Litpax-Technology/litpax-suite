/* =============================================================
 * Litpax Suite — module bridge
 * Har module page ke END me (app script ke baad) load hota hai.
 *  - Logout → poore Suite se sign out
 *  - IMS: Config IMS_HIDE_PAGES wale pages chhupao (Inward approval Suite se hota hai)
 *  - Common sidebar: app ke pages Suite ke sidebar me (app ka apna sidebar chhup jaata hai)
 *  - Akela khola to Suite pe bhej deta hai (PLT Line Scan ko chhod ke)
 * ============================================================= */
(function () {
  /* ---- akela khola (seedha link) → Suite pe bhejo, wahi app khulega.
         PLT Line Scan (line tablet) akela hi chalta hai. Debug ke liye URL me ?solo=1 ---- */
  var GO = { 'erp/app.html': 'm-erp', 'erp/index.html': 'm-erp', 'erp/': 'm-erp', 'ims/index.html': 'm-ims', 'ims/': 'm-ims', 'soms/index.html': 'm-soms', 'soms/': 'm-soms',
             'service/index.html': 'm-service', 'service/': 'm-service', 'plt/admin.html': 'm-pltAdmin', 'agent/index.html': 'm-agent', 'agent/': 'm-agent',
             'service/replace/index.html': 'm-replace', 'service/replace/': 'm-replace' };
  if (window.parent === window) {
    if (/[?&]solo=1/.test(location.search)) return;
    var m = location.pathname.match(/(service\/replace|erp|ims|soms|service|plt|agent)\/([\w.-]*)$/), to = m && GO[m[1] + '/' + m[2]];
    if (to) location.replace(location.pathname.slice(0, m.index) + '#' + to);
    return;
  }
  document.documentElement.classList.add('in-suite');

  var cfg = {};
  try { cfg = JSON.parse(sessionStorage.getItem('suite_bridge') || '{}'); } catch (e) {}
  // 'inward' ab nahi chhupta — IMS Inward khud approval (SOMS) ke through jaata hai
  var hide = (cfg.hidePages || []).filter(function (p) { return p !== 'inward'; });

  function toSuite(type) {
    try { window.parent.postMessage({ source: 'litpax-suite', type: type }, location.origin); } catch (e) {}
  }

  function patch() {
    // ---- logout: ERP / IMS / PLT function, SOMS button ----
    if (typeof window.logout === 'function') window.logout = function () { toSuite('logout'); };
    var lb = document.getElementById('logoutBtn');
    if (lb) lb.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); toSuite('logout'); }, true);

    // ---- jis app me apna logout nahi (PLT Line Scan / Line Admin) → chhota Sign out button ----
    if (!lb && typeof window.logout !== 'function' && !document.getElementById('suiteOut')) {
      var b = document.createElement('button');
      b.id = 'suiteOut'; b.type = 'button'; b.textContent = '⏻ Sign out'; b.title = 'Sign out';
      b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;border:1px solid #e6e8f0;background:#fff;color:#6b7085;' +
        'font:600 12.5px Inter,system-ui,sans-serif;padding:7px 12px;border-radius:8px;cursor:pointer;box-shadow:0 2px 8px rgba(20,22,50,.08)';
      b.onclick = function () { if (confirm('Sign out?')) toSuite('logout'); };
      document.body.appendChild(b);
    }

    // ---- IMS: hidden pages ----
    if (hide.length) {
      hide.forEach(function (p) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-page="' + p + '"]'), function (el) { el.style.display = 'none'; });
      });
      if (typeof window.showPage === 'function' && !window.showPage._suite) {
        var orig = window.showPage;
        window.showPage = function (page) {
          if (hide.indexOf(page) !== -1) return orig.call(this, 'stock');   // home page chhupa ho to Stock Summary
          return orig.apply(this, arguments);
        };
        window.showPage._suite = true;
      }
    }
  }

  // Ctrl+K kisi bhi app ke andar → Suite ka Ask Litpax
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k' && !/\/agent\//.test(location.pathname)) { e.preventDefault(); toSuite('agent'); }
  });

  /* ---- Common sidebar: app ka apna sidebar Suite me chhupao, uske pages Suite ke sidebar me dikhao ----
     root  = sidebar ke andar jahan items hain · item = page link · sec = group heading · badge = ginti
     acts  = sidebar ke neeche wale button (Switch person, Staff & PINs) → Suite sidebar me "You" ke neeche */
  var NAV = [
    { root: '.app-body > .sidebar', item: '.nav-item', sec: '.nav-sec',
      css: '.sidebar,.sidebar-overlay,.hamburger,.topbar-brand{display:none!important}.topbar{padding-left:24px!important}' },          // ERP
    { root: '#app-shell .sidebar nav', item: '.ni', sec: '.ng-label', badge: '.nbadge', acts: '#stf-me button',
      css: '#app-shell>.sidebar{display:none!important}' },                                                                              // IMS
    { root: '#sidebar .nav', item: '.nav-item', badge: '.badge', acts: '.stf-switch',
      css: '#sidebar,#hamburger,.sidebar-overlay{display:none!important}.main{margin-left:0!important}' },                               // SOMS
    { root: '#sbNav', item: '.sb-item', sec: '.sb-grp', acts: '.sb-switch',
      css: '#sidebar,#sbOverlay,.menu-btn{display:none!important}.main{margin-left:0!important}' }                                       // Service
  ];
  var NC = null, sendT = 0, lastSent = '';
  function shown(el, stop) {                       // role ke hisaab se app ne chhupaya to nahi?
    for (; el && el !== stop; el = el.parentElement) if (getComputedStyle(el).display === 'none') return false;
    return true;
  }
  function itemsOf() {
    var root = document.querySelector(NC.root); if (!root) return [];
    var sb = root.closest('.sidebar, #sidebar');
    if (sb && !shown(sb.parentElement, null)) return [];   // app abhi apni login screen pe hai → pages nahi
    var out = [], sec = '', i = 0;
    Array.prototype.forEach.call(root.querySelectorAll(NC.item + (NC.sec ? ',' + NC.sec : '')), function (el) {
      if (NC.sec && el.matches(NC.sec)) { sec = el.textContent.trim(); return; }
      i++;
      if (!shown(el, root)) return;
      var c = el.cloneNode(true);
      Array.prototype.forEach.call(c.querySelectorAll('svg,.nav-icon,.ic,.nav-ic,.nbadge,.badge'), function (x) { x.remove(); });
      var b = NC.badge && el.querySelector(NC.badge), bt = b && shown(b, el) ? b.textContent.trim() : '';
      out.push({ k: el.id || el.getAttribute('data-page') || el.getAttribute('data-view') || el.getAttribute('data-nav') || 'i' + i,
                 label: c.textContent.replace(/\s+/g, ' ').trim(), sec: sec, badge: bt && bt !== '0' ? bt : '', active: el.classList.contains('active') });
    });
    if (NC.acts) Array.prototype.forEach.call(document.querySelectorAll(NC.acts), function (b, n) {
      if (!shown(b, sb)) return;
      var t = b.textContent.replace(/[^\w&/ .-]+/g, ' ').replace(/\s+/g, ' ').trim();
      out.push({ k: 'act' + n, label: /^switch$/i.test(t) ? 'Switch person' : t, sec: 'You', badge: '', active: false });
    });
    return out;
  }
  function elOf(k) {                                  // key → asli element (page link ya button)
    if (/^act\d+$/.test(k)) return NC.acts ? document.querySelectorAll(NC.acts)[+k.slice(3)] : null;
    var el = null;
    Array.prototype.forEach.call(document.querySelector(NC.root).querySelectorAll(NC.item), function (x, n) {
      if (!el && (x.id || x.getAttribute('data-page') || x.getAttribute('data-view') || x.getAttribute('data-nav') || 'i' + (n + 1)) === k) el = x;
    });
    return el;
  }
  function sendNav() {
    clearTimeout(sendT);
    sendT = setTimeout(function () {
      var items = itemsOf(), j = JSON.stringify(items);
      if (j === lastSent) return;
      lastSent = j;
      try { window.parent.postMessage({ source: 'litpax-suite', type: 'nav', items: items }, location.origin); } catch (e) {}
    }, 150);
  }
  function setupNav() {
    for (var i = 0; i < NAV.length && !NC; i++) if (document.querySelector(NAV[i].root)) NC = NAV[i];
    if (!NC) return;
    var st = document.createElement('style'); st.id = 'suiteNavCss'; st.textContent = NC.css;
    document.head.appendChild(st);
    new MutationObserver(sendNav).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.source !== 'litpax-suite') return;
      if (e.data.type === 'nav-ask') { lastSent = ''; sendNav(); }
      if (e.data.type === 'nav-go' && itemsOf().some(function (x) { return x.k === e.data.k; })) {
        var el = elOf(e.data.k); if (el) el.click();
      }
    });
    sendNav();
  }

  function init() { patch(); setupNav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
