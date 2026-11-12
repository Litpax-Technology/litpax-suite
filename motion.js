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
