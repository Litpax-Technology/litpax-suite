/* =============================================================
 * Litpax Suite — module bridge
 * Har module page ke END me (app script ke baad) load hota hai.
 * Suite ke andar (iframe) chale tab hi kuch karta hai; akela khole to original app jaisa.
 *  - Logout → poore Suite se sign out
 *  - IMS: Config IMS_HIDE_PAGES wale pages chhupao (Inward approval Suite se hota hai)
 * ============================================================= */
(function () {
  if (window.parent === window) return;
  document.documentElement.classList.add('in-suite');

  var cfg = {};
  try { cfg = JSON.parse(sessionStorage.getItem('suite_bridge') || '{}'); } catch (e) {}
  var hide = cfg.hidePages || [];

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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
  else patch();
})();
