/* =============================================================
 * Ask Litpax — chat UI (Suite ke andar, sirf Admin)
 * Backend: Litpax_Suite_AGENT GAS (config.js → AGENT_URL). Login: Suite ka token.
 * ============================================================= */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var CFG = window.CONFIG || {};
  var HKEY = 'agent_chat';
  var A = { history: [], busy: false };

  /* ---------------- API ---------------- */
  function token() { try { return sessionStorage.getItem('suite_token') || ''; } catch (e) { return ''; } }
  function api(action, data) {
    var url = CFG.API_URL;
    if (!url || /^PASTE_/.test(url)) return Promise.reject(new Error('AGENT_URL is not set in config.js'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, CFG.TIMEOUT_MS || 120000);
    var body = JSON.stringify(Object.assign({ action: action, token: token() }, data || {}));
    return fetch(url, { method: 'POST', body: body, redirect: 'follow', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        clearTimeout(timer);
        var j;
        try { j = JSON.parse(t); } catch (e) { throw new Error('The agent did not respond correctly. Check AGENT_URL.'); }
        if (j && j.ok === false) {
          var err = String(j.error || 'Request failed');
          if (/^LOGIN:/.test(err)) { toSuite('logout'); err = err.replace(/^LOGIN:\s*/, ''); }
          var e2 = new Error(err); e2.steps = j.steps; throw e2;
        }
        return j;
      }, function (e) {
        clearTimeout(timer);
        throw new Error(e && e.name === 'AbortError' ? 'This took too long. Please ask a shorter question.' : 'Network error. Check your connection.');
      });
  }
  function toSuite(type) { try { window.parent.postMessage({ source: 'litpax-suite', type: type }, location.origin); } catch (e) {} }
  window.logout = function () { toSuite('logout'); };   // suite-bridge: alag Sign out button na aaye

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.className = 'toast show';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  /* ---------------- markdown (chhota, safe) ---------------- */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?]|$)/g, '$1<i>$2</i>')
      .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>');
  }
  function isNumCell(s) { return /^[-₹\s]*[\d,]+(\.\d+)?\s*%?$/.test(s.trim()); }
  function table(lines) {
    var rows = lines.map(function (l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); });
    var head = rows[0], body = rows.slice(2);
    var num = head.map(function (_, i) { return body.length && body.every(function (r) { return !r[i] || isNumCell(r[i]); }); });
    return '<div class="ag-tbl"><table><thead><tr>' + head.map(function (h, i) { return '<th' + (num[i] ? ' class="num"' : '') + '>' + inline(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body.map(function (r) {
        return '<tr>' + head.map(function (_, i) { return '<td' + (num[i] ? ' class="num"' : '') + '>' + inline(r[i] || '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function chart(json) {
    var c;
    try { c = JSON.parse(json); } catch (e) { return ''; }
    var labels = c.labels || [], values = (c.values || []).map(Number);
    if (!labels.length || labels.length !== values.length) return '';
    var max = Math.max.apply(null, values.map(Math.abs).concat([1]));
    return '<figure class="ag-chart"><figcaption>' + esc(c.title || '') + '</figcaption>' +
      labels.map(function (l, i) {
        var v = values[i], w = Math.max(2, Math.round(Math.abs(v) / max * 100));
        return '<div class="ag-bar"><span class="l" title="' + esc(l) + '">' + esc(l) + '</span><span class="t"><i style="width:' + w + '%"></i></span><span class="v">' + esc(v.toLocaleString('en-IN')) + '</span></div>';
      }).join('') + '</figure>';
  }
  function md(src) {
    var out = [], lines = String(src || '').replace(/\r/g, '').split('\n'), i = 0, list = null;
    function closeList() { if (list) { out.push('</' + list + '>'); list = null; } }
    while (i < lines.length) {
      var line = lines[i];
      if (/^```chart\s*$/.test(line.trim())) {
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
        i++; closeList(); out.push(chart(buf.join('\n'))); continue;
      }
      if (/^```/.test(line.trim())) {
        var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(esc(lines[i++]));
        i++; closeList(); out.push('<pre>' + code.join('\n') + '</pre>'); continue;
      }
      var e = esc(line);
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        var tl = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) tl.push(esc(lines[i++]));
        closeList(); out.push(table(tl)); continue;
      }
      var h = line.match(/^(#{1,4})\s+(.*)/);
      if (h) { closeList(); out.push('<h4>' + inline(esc(h[2])) + '</h4>'); i++; continue; }
      var li = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/);
      if (li || ol) {
        var want = li ? 'ul' : 'ol';
        if (list !== want) { closeList(); out.push('<' + want + '>'); list = want; }
        out.push('<li>' + inline(esc((li || ol)[1])) + '</li>'); i++; continue;
      }
      closeList();
      if (!line.trim()) { i++; continue; }
      var tl2 = line.trim();
      if (/^_.+_$/.test(tl2)) { out.push('<p class="ag-src">' + inline(esc(tl2.slice(1, -1))) + '</p>'); i++; continue; }
      out.push('<p>' + inline(e) + '</p>'); i++;
    }
    closeList();
    return out.join('');
  }

  /* ---------------- chat ---------------- */
  function save() { try { sessionStorage.setItem(HKEY, JSON.stringify(A.history.slice(-30))); } catch (e) {} }
  function scrollEnd() { var s = $('agScroll'); s.scrollTop = s.scrollHeight; }

  function addMe(text) {
    var d = document.createElement('div');
    d.className = 'ag-msg me'; d.innerHTML = '<div class="b">' + esc(text) + '</div>';
    $('agLog').appendChild(d); scrollEnd();
  }
  function addBot(text, steps, isErr) {
    var d = document.createElement('div');
    d.className = 'ag-msg bot' + (isErr ? ' err' : '');
    var st = (steps && steps.length) ? '<details class="ag-steps"><summary>How I found this · ' + steps.length + ' step' + (steps.length > 1 ? 's' : '') + '</summary><ol>' +
      steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></details>' : '';
    d.innerHTML = '<div class="av" aria-hidden="true">✦</div><div class="b">' + (isErr ? '<p>' + esc(text) + '</p>' : md(text)) + st +
      (isErr ? '' : '<div class="ag-tools"><button type="button" class="ag-copy">Copy</button></div>') + '</div>';
    var cp = d.querySelector('.ag-copy');
    if (cp) cp.onclick = function () {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Copied'); }, function () { toast('Could not copy'); });
    };
    $('agLog').appendChild(d); scrollEnd();
  }
  function addTyping() {
    var d = document.createElement('div');
    d.className = 'ag-msg bot typing';
    d.innerHTML = '<div class="av" aria-hidden="true">✦</div><div class="b"><span class="dots"><i></i><i></i><i></i></span><span class="tx">Reading your sheets…</span></div>';
    $('agLog').appendChild(d); scrollEnd();
    var msgs = ['Reading your sheets…', 'Crunching the numbers…', 'Writing the answer…'], k = 0;
    d._t = setInterval(function () { k = (k + 1) % msgs.length; var t = d.querySelector('.tx'); if (t) t.textContent = msgs[k]; }, 3500);
    return d;
  }

  function ask(q) {
    q = String(q || '').trim();
    if (!q || A.busy) return;
    A.busy = true; $('agSend').disabled = true;
    $('agHello').classList.add('hidden');
    addMe(q);
    var prior = A.history.slice(-8);
    A.history.push({ role: 'user', text: q }); save();
    var t = addTyping();
    api('ask', { q: q, history: prior }).then(function (r) {
      A.history.push({ role: 'model', text: r.answer, steps: r.steps || [] }); save();
      addBot(r.answer, r.steps);
    }).catch(function (e) {
      addBot(e.message, e.steps, true);
    }).then(function () {
      clearInterval(t._t); t.remove();
      A.busy = false; $('agSend').disabled = false; $('agQ').focus();
    });
  }

  function restore() {
    try { A.history = JSON.parse(sessionStorage.getItem(HKEY) || '[]'); } catch (e) { A.history = []; }
    if (!A.history.length) return;
    $('agHello').classList.add('hidden');
    A.history.forEach(function (h) { if (h.role === 'user') addMe(h.text); else addBot(h.text, h.steps); });
  }
  function clearChat() {
    A.history = []; save();
    $('agLog').innerHTML = ''; $('agHello').classList.remove('hidden'); $('agQ').focus();
  }

  function showSources() {
    if (A.busy) return;
    $('agHello').classList.add('hidden');
    var t = addTyping();
    api('sources').then(function (r) {
      var rows = (r.sources || []).map(function (s) { return '| ' + s.id + ' | ' + (s.linked ? 'Connected' : 'Not linked') + ' | ' + s.about + ' |'; });
      addBot('**I can read these sources:**\n\n| Source | Status | What it holds |\n|---|---|---|\n' + rows.join('\n'));
    }).catch(function (e) { addBot(e.message, null, true); })
      .then(function () { clearInterval(t._t); t.remove(); });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    $('agChips').innerHTML = (window.AGENT_PROMPTS || []).map(function (p, i) {
      return '<button type="button" data-i="' + i + '">' + esc(p.label) + '</button>';
    }).join('');
    $('agChips').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      ask(window.AGENT_PROMPTS[+b.dataset.i].q);
    };
    var q = $('agQ');
    $('agForm').onsubmit = function (e) { e.preventDefault(); var v = q.value; q.value = ''; q.style.height = ''; ask(v); };
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('agForm').requestSubmit ? $('agForm').requestSubmit() : $('agForm').onsubmit(e); } });
    q.addEventListener('input', function () { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 160) + 'px'; });
    $('agClear').onclick = clearChat;
    $('agSources').onclick = showSources;

    // Suite se aaya sawaal (floating button / Ctrl+K): ?q=
    var pre = new URLSearchParams(location.search).get('q');

    restore();
    api('ping').then(function (r) {
      $('agStatus').textContent = r.keySet ? 'Online · ' + r.model + ' · read-only' : 'Key not set. Add GEMINI_KEY in GAS Script Properties';
      $('agStatus').className = r.keySet ? 'ok' : 'warn';
      if (pre && r.keySet) ask(pre);
    }).catch(function (e) {
      $('agStatus').textContent = e.message; $('agStatus').className = 'warn';
    });
    q.focus();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
