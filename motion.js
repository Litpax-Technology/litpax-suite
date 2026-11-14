/* =============================================================
 * Litpax Suite — band hone ka animation (global)
 * Apps dialog ko classList.remove('show'/'open') ya add('hidden') se
 * turant chhupa dete hain. Ye un dialogs pe pehle .lx-out lagata hai,
 * ~160ms baad asli class hatata hai. App ke code me koi badlaav nahi.
 * ============================================================= */
(function () {
  if (window.__lxMotion) return; window.__lxMotion = true;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var OUT_MS = 160;
  // [selector, class jo hatne se band hota hai]
  var OFF = [['.modal-overlay', 'show'], ['.ov', 'open'], ['.iv-overlay', 'open'], ['.stf-ov', 'show'],
             ['.sp-ov', 'show'], ['.rp-ov', 'show'], ['.overlay', 'show']];
  // [selector, class jo lagne se band hota hai]
  var ON = [['.modal-backdrop', 'hidden'], ['.diary-wrap', 'hidden']];

  var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'classList');
  if (!desc || !desc.get) return;
  var owner = new WeakMap();
  Object.defineProperty(Element.prototype, 'classList', {
    configurable: true, enumerable: desc.enumerable,
    get: function () { var l = desc.get.call(this); owner.set(l, this); return l; },
    set: desc.set
  });

  var P = DOMTokenList.prototype, rawAdd = P.add, rawRemove = P.remove, rawToggle = P.toggle, rawContains = P.contains;
  var timers = new WeakMap();
  function rule(el, list, cls) {
    if (!el || !el.matches) return false;
    for (var i = 0; i < list.length; i++) if (list[i][1] === cls && el.matches(list[i][0])) return true;
    return false;
  }
  function cancel(el, l) {
    var t = timers.get(el);
    if (t) { clearTimeout(t); timers.delete(el); }
    rawRemove.call(l, 'lx-out');
  }
  function later(el, l, fn) {
    if (timers.has(el)) return;                       // pehle se band ho raha hai
    rawAdd.call(l, 'lx-out');
    timers.set(el, setTimeout(function () { timers.delete(el); rawRemove.call(l, 'lx-out'); fn(); }, OUT_MS));
  }

  P.remove = function () {
    var el = owner.get(this), l = this, args = arguments;
    if (args.length === 1 && rule(el, OFF, args[0]) && rawContains.call(l, args[0]) && el.isConnected)
      return later(el, l, function () { rawRemove.apply(l, args); });
    if (args.length === 1 && rule(el, ON, args[0])) cancel(el, l);   // dobara khula → band hona roko
    return rawRemove.apply(l, args);
  };
  P.add = function () {
    var el = owner.get(this), l = this, args = arguments;
    if (args.length === 1 && rule(el, OFF, args[0])) cancel(el, l);  // dobara khula
    if (args.length === 1 && rule(el, ON, args[0]) && !rawContains.call(l, args[0]) && el.isConnected)
      return later(el, l, function () { rawAdd.apply(l, args); });
    return rawAdd.apply(l, args);
  };
  P.toggle = function (cls, force) {
    var has = rawContains.call(this, cls), want = force === undefined ? !has : !!force;
    if (want === has) return has;
    if (want) this.add(cls); else this.remove(cls);
    return want;
  };
})();

/* =============================================================
 * Litpax Suite — premium polish (v2)
 * Sab kuch Web Animations (element.animate) se hota hai: app ki CSS,
 * classes ya logic ko haath nahi lagata. Animation khatam → element
 * bilkul pehle jaisa. OS me "reduce motion" on ho to kuch nahi chalta.
 *  1. Loading bar  — server (GAS) call chal raha ho to upar patli line
 *  2. Button press — dabane par halka "press" + ripple
 *  3. Card lift    — clickable card/tile par hover me halka upar
 *  4. Smooth data  — naye rows/cards ek ke baad ek fade-in
 *  5. Images       — load hote hi fade-in
 * ============================================================= */
(function () {
  if (window.__lxPolish) return; window.__lxPolish = true;
  if (!Element.prototype.animate) return;
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.22, 1, .36, 1)';
  var FINE = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  function anim(el, kf, opt) { try { return el.animate(kf, opt); } catch (e) { return null; } }

  /* ---------- 1. Loading bar (fetch + JSONP script calls) ---------- */
  var bar = null, busy = 0, hideT = 0, trickleT = 0, prog = 0;
  function ensureBar() {
    if (bar || !document.body) return bar;
    bar = document.createElement('div');
    bar.id = 'lxBar'; bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    return bar;
  }
  function setProg(p) { prog = p; if (bar) bar.style.transform = 'scaleX(' + p + ')'; }
  function start() {
    busy++;
    if (!ensureBar()) return;
    clearTimeout(hideT);
    if (busy === 1) {
      bar.classList.add('on'); setProg(Math.max(prog, .08));
      clearInterval(trickleT);
      trickleT = setInterval(function () { if (prog < .9) setProg(prog + (.92 - prog) * .08); }, 220);
    }
  }
  function done() {
    busy = Math.max(0, busy - 1);
    if (busy || !bar) return;
    clearInterval(trickleT); setProg(1);
    hideT = setTimeout(function () { bar.classList.remove('on'); setTimeout(function () { if (!busy) setProg(0); }, 300); }, 220);
  }
  if (window.fetch) {
    var rawFetch = window.fetch;
    window.fetch = function () {
      start();
      var p;
      try { p = rawFetch.apply(this, arguments); } catch (e) { done(); throw e; }
      var finished = false, fin = function () { if (!finished) { finished = true; done(); } };
      p.then(fin, fin);
      setTimeout(fin, 60000);
      return p;
    };
  }
  function watchScript(s) {   // JSONP: <script src=".../exec?...callback=...">
    if (s.__lxW || !s.src || !/script\.google|googleusercontent|[?&](callback|cb)=/.test(s.src)) return;
    s.__lxW = true; start();
    var finished = false, fin = function () { if (!finished) { finished = true; done(); } };
    s.addEventListener('load', fin); s.addEventListener('error', fin);
    setTimeout(fin, 60000);
  }

  if (REDUCE) {   // reduce motion: sirf loading bar (bina animation), baaki kuch nahi
    new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.tagName === 'SCRIPT') watchScript(n); }); }); })
      .observe(document.documentElement, { childList: true, subtree: true });
    return;
  }

  /* ---------- 2. Button press + ripple ---------- */
  var BTN = 'button, .btn, [class*="-btn"], [class*="btn-"], [role="button"], input[type="submit"], input[type="button"]';
  function isDark(c) {
    var m = c && c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    if (!m || (m[4] !== undefined && +m[4] < .3)) return false;
    return (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) < 150;
  }
  function ripple(btn, x, y) {
    var r = btn.getBoundingClientRect();
    if (r.width < 24 || r.height < 18 || r.width > 520) return;
    var cs = getComputedStyle(btn);
    var box = document.createElement('span');
    box.className = 'lx-ripple-box';
    box.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' + cs.borderRadius;
    var d = Math.max(r.width, r.height) * 2.2, dot = document.createElement('i');
    dot.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (x - r.left - d / 2) + 'px;top:' + (y - r.top - d / 2) + 'px;background:' +
      (isDark(cs.backgroundColor) ? 'rgba(255,255,255,.28)' : 'rgba(20,22,20,.09)');
    box.appendChild(dot); document.body.appendChild(box);
    var a = anim(dot, [{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' });
    setTimeout(function () { box.remove(); }, 680);
    if (!a) box.remove();
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var b = e.target.closest && e.target.closest(BTN);
    if (!b || b.disabled || b.closest('.lx-noanim')) return;
    var press = anim(b, [{ scale: '1' }, { scale: '.965' }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
    ripple(b, e.clientX, e.clientY);
    var up = function () {
      document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true);
      if (press) press.cancel();                                   // dabaya hua state hatao
      anim(b, [{ scale: '.965' }, { scale: '1.012', offset: .55 }, { scale: '1' }], { duration: 320, easing: EASE });
    };
    document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
  }, true);

  /* ---------- 3. Clickable card lift (sirf jahan cursor:pointer ho) ---------- */
  var CARD = '[class*="card"], [class*="tile"], [class*="kpi"], [class*="stat-card"], [class*="board-card"]';
  if (FINE) {
    document.addEventListener('pointerover', function (e) {
      var c = e.target.closest && e.target.closest(CARD);
      if (!c || c.__lxLift === 1 || c.closest('.modal, [class*="modal"], dialog')) return;
      if (c.__lxLift === 0) return;
      if (getComputedStyle(c).cursor !== 'pointer') { c.__lxLift = 0; return; }
      c.__lxLift = 1;
      var a = anim(c, [{ translate: '0 0' }, { translate: '0 -3px' }], { duration: 380, easing: EASE, fill: 'forwards' });
      var out = function (ev) {
        if (ev.relatedTarget && c.contains(ev.relatedTarget)) return;
        c.removeEventListener('pointerout', out);
        if (a) a.cancel();
        anim(c, [{ translate: '0 -3px' }, { translate: '0 0' }], { duration: 420, easing: EASE });
        c.__lxLift = undefined;
      };
      c.addEventListener('pointerout', out);
    }, true);
  }

  /* ---------- 4. Smooth data: naye rows / cards ek ke baad ek ---------- */
  var ITEM = /(^|\s)[\w-]*(card|tile|kpi|stat|row|item)([\w-]*)(\s|$)/i;
  var lastAnim = new WeakMap();
  function visible(el) {
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.width > 0;
  }
  function animateBatch(parent, els) {
    var now = Date.now(), prev = lastAnim.get(parent) || 0;
    lastAnim.set(parent, now);
    if (now - prev < 1200) return;                     // search typing jaise baar-baar render → animation nahi
    var n = 0;
    for (var i = 0; i < els.length && n < 24; i++) {
      var el = els[i];
      if (!el.isConnected || !visible(el)) continue;
      anim(el, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }],
        { duration: 420, delay: Math.min(n, 14) * 28, easing: EASE, fill: 'backwards' });
      n++;
    }
  }
  var pending = new Map(), flushT = 0;
  function flush() {
    flushT = 0;
    pending.forEach(function (els, parent) { if (els.length >= 2) animateBatch(parent, els); });
    pending.clear();
  }
  function consider(node) {
    if (node.nodeType !== 1) return;
    if (node.tagName === 'SCRIPT') { watchScript(node); return; }
    if (node.tagName === 'IMG') { fadeImg(node); }
    else if (node.querySelectorAll) Array.prototype.forEach.call(node.querySelectorAll('img'), fadeImg);
    var p = node.parentElement;
    if (!p || node.id === 'lxBar' || node.classList.contains('lx-ripple-box')) return;
    if (node.closest('input, textarea, select, [contenteditable], .ac-list, .suggest-box, [class*="toast"], [class*="dropdown"]')) return;
    var ok = node.tagName === 'TR' ? !!node.closest('tbody') : ITEM.test(node.className && node.className.baseVal === undefined ? node.className : '');
    if (!ok) return;
    if (!pending.has(p)) pending.set(p, []);
    pending.get(p).push(node);
    if (!flushT) flushT = requestAnimationFrame(flush);
  }

  /* ---------- 5. Image fade-in ---------- */
  function fadeImg(img) {
    if (img.__lxImg || img.complete) return;
    img.__lxImg = true;
    img.addEventListener('load', function () { anim(img, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }); }, { once: true });
  }

  function boot() {
    ensureBar();
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) consider(ms[i].addedNodes[j]);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
