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
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, Math.max(CFG.TIMEOUT_MS || 0, 170000));
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
  function toSuite(type, extra) { try { window.parent.postMessage(Object.assign({ source: 'litpax-suite', type: type }, extra || {}), location.origin); } catch (e) {} }
  var WARN_RE = /\b(short|shortage|warning|overdue|late|failed|not found|missing|expired|blocked|uh-oh)\b|⚠/i;   // Litu pareshan ho
  window.logout = function () { toSuite('logout'); };   // suite-bridge: alag Sign out button na aaye

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.className = 'toast show';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  /* ---------------- markdown (chhota, safe) ---------------- */
  function inline(s) {
    return linkIds(s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?]|$)/g, '$1<i>$2</i>')
      .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>'));
  }

  /* ---------------- clickable IDs → us app me record khulta hai ---------------- */
  var ID_RE = /\b(LTX-R-\d{3,}|ORD-\d{3,}|LD-\d{3,}|ACC-\d{3,}|C\d{3,4}|AR-\d{3,}|PO-[A-Z0-9-]*\d|LP\d{3,5}-\d{3,})\b/g;
  function idType(id) {
    if (/^LTX-R-/.test(id)) return 'ticket';
    if (/^ORD-/.test(id)) return 'order';
    if (/^LD-/.test(id)) return 'lead';
    if (/^(ACC-|C\d)/.test(id)) return 'customer';
    if (/^AR-/.test(id)) return 'case';
    if (/^PO-/.test(id)) return 'po';
    return 'serial';
  }
  var ID_TIP = { ticket: 'Open ticket in Service Hub', order: 'Open order in ERP', lead: 'Open lead in ERP', customer: 'Open account in ERP',
    'case': 'Open case in Advance Replacement', po: 'Ask about this purchase order', serial: 'Show the full history of this battery' };
  function linkIds(html) {
    return html.split(/(<[^>]+>)/).map(function (part, i, all) {
      if (part.charAt(0) === '<') return part;
      if (i > 0 && /^<code/.test(all[i - 1])) return part;   // code ke andar link nahi
      return part.replace(ID_RE, function (id) {
        var t = idType(id);
        return '<a href="#" class="ag-id ag-id-' + t + '" data-rt="' + t + '" data-id="' + id + '" title="' + ID_TIP[t] + '">' + id + '</a>';
      });
    }).join('');
  }
  function openId(rt, id) {
    if (rt === 'po') return ask('Show purchase order ' + id + ': vendor, items, ordered vs received, expected date and status.');
    if (rt === 'serial') return ask('Battery 360 for serial ' + id + ': line history, dispatch, customer, service and replacement.');
    if (window.parent === window) return toast('This opens inside Litpax Suite');
    try { window.parent.postMessage({ source: 'litpax-suite', type: 'open-record', rtype: rt, id: id }, location.origin); } catch (e) {}
  }
  function isNumCell(s) { return /^[-₹\s]*[\d,]+(\.\d+)?\s*%?$/.test(s.trim()); }
  function table(lines) {
    var rows = lines.map(function (l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); });
    var head = rows[0], body = rows.slice(2);
    var num = head.map(function (_, i) { return body.length && body.every(function (r) { return !r[i] || isNumCell(r[i]); }); });
    return '<div class="ag-tblw"><div class="ag-tbl"><table><thead><tr>' + head.map(function (h, i) { return '<th' + (num[i] ? ' class="num"' : '') + '>' + inline(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body.map(function (r) {
        return '<tr>' + head.map(function (_, i) { return '<td' + (num[i] ? ' class="num"' : '') + '>' + inline(r[i] || '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="ag-tbl-x"><button type="button" data-x="sheet" title="Open this table as a new Google Sheet">Google Sheet ↗</button>' +
      '<button type="button" data-x="wa" title="Copy as WhatsApp text and open WhatsApp">WhatsApp text</button></div></div>';
  }

  /* ---------------- export: table → Google Sheet / WhatsApp ---------------- */
  function tblData(wrap) {
    var t = wrap.querySelector('table');
    return {
      columns: Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); }),
      rows: Array.prototype.map.call(t.querySelectorAll('tbody tr'), function (tr) {
        return Array.prototype.map.call(tr.children, function (td) { return td.textContent.trim(); });
      })
    };
  }
  function askOf(el) {   // ye jawab kis sawaal ka tha
    var m = el.closest('.ag-msg');
    while (m && !m.classList.contains('me')) m = m.previousElementSibling;
    return m ? m.textContent.trim() : 'Ask Litpax';
  }
  function waText(title, d) {
    var lines = ['*' + title.slice(0, 120) + '*', ''];
    d.rows.forEach(function (r, i) {
      var first = r[0] || '', rest = [];
      for (var k = 1; k < d.columns.length; k++) if (r[k]) rest.push(d.columns[k] + ': ' + r[k]);
      lines.push((i + 1) + '. *' + first + '*' + (rest.length ? '\n   ' + rest.join(' · ') : ''));
    });
    lines.push('', '— Litpax Suite');
    return lines.join('\n');
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (ok, no) {
      var x = document.createElement('textarea'); x.value = t; x.style.position = 'fixed'; x.style.opacity = '0';
      document.body.appendChild(x); x.select();
      try { document.execCommand('copy') ? ok() : no(); } catch (e) { no(e); } x.remove();
    });
  }
  function exportTbl(btn) {
    var wrap = btn.closest('.ag-tblw'), d = tblData(wrap), title = askOf(btn);
    if (btn.dataset.x === 'wa') {
      var txt = waText(title, d);
      copyText(txt).then(function () { toast('Copied — paste it in WhatsApp'); }, function () { toast('Could not copy'); });
      window.open('https://wa.me/?text=' + encodeURIComponent(txt.slice(0, 3500)), '_blank', 'noopener');
      return;
    }
    if (btn.disabled) return;
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Creating…';
    var tab = window.open('', '_blank');   // popup blocker se bachne ke liye abhi khol lo
    api('export', { title: title, columns: d.columns, rows: d.rows }).then(function (r) {
      btn.textContent = 'Opened ✓';
      if (tab) tab.location = r.url; else window.open(r.url, '_blank', 'noopener');
      toast('Sheet created in Drive › Ask Litpax Exports');
    }, function (e) {
      if (tab) tab.close();
      toast(e.message); btn.textContent = label;
    }).then(function () { setTimeout(function () { btn.disabled = false; if (btn.textContent === 'Opened ✓') btn.textContent = label; }, 4000); });
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
      (isErr ? '' : '<div class="ag-tools"><button type="button" class="ag-copy">Copy</button>' +
        (VOICE.tts ? '<button type="button" class="ag-copy ag-say" aria-label="Read this answer aloud">🔊 Listen</button>' : '') + '</div>') + '</div>';
    var cp = d.querySelector('.ag-copy');
    if (cp) cp.onclick = function () {
      copyText(text).then(function () { toast('Copied'); }, function () { toast('Could not copy'); });
    };
    var say = d.querySelector('.ag-say');
    if (say) say.onclick = function () { speak(text, say); };
    $('agLog').appendChild(d); scrollEnd();
    return d;
  }
  /* ---------------- action cards (badlav / naya record / mail) ---------------- */
  function addAction(a) {
    var d = document.createElement('div');
    d.className = 'ag-msg bot';
    var body = '';
    if (a.type === 'email') {
      body = '<div class="ag-card mail"><div class="ag-card-h">✉ Email draft</div>' +
        '<label>To<input class="f-to" value="' + esc(a.to) + '"></label>' +
        '<label>Cc<input class="f-cc" value="' + esc(a.cc || '') + '" placeholder="optional"></label>' +
        '<label>Subject<input class="f-sub" value="' + esc(a.subject) + '"></label>' +
        '<label>Message<textarea class="f-body" rows="9">' + esc(a.body) + '</textarea></label>';
    } else {
      body = '<div class="ag-card' + (a.risk ? ' risk' : '') + '"><div class="ag-card-h">' + (a.type === 'create' ? '＋ ' : '✎ ') + esc(a.title) +
        (a.via ? ' <span class="ag-via" title="Saved through the app with its normal checks">via ' + esc(a.via) + '</span>' : '') + '</div>' +
        (a.reason ? '<div class="ag-card-r">' + esc(a.reason) + '</div>' : '') +
        '<table>' + a.rows.map(function (r) {
          return '<tr><th>' + esc(r.col) + '</th>' + (a.type === 'update' ? '<td class="old">' + esc(r.old) + '</td><td class="arr">→</td>' : '') + '<td class="nw">' + esc(r.nw) + '</td></tr>';
        }).join('') + '</table>' +
        (a.warn ? '<div class="ag-card-w">' + esc(a.warn) + '</div>' : a.risk && !a.via ? '<div class="ag-card-w">Quantity / amount change. Related totals in other sheets will not update by themselves.</div>' : '');
    }
    body += '<div class="ag-card-a"><button type="button" class="go">' + (a.type === 'email' ? 'Send' : 'Confirm') + '</button>' +
      '<button type="button" class="no">Cancel</button><span class="st"></span></div></div>';
    d.innerHTML = '<div class="av" aria-hidden="true">✦</div><div class="b">' + body + '</div>';
    var go = d.querySelector('.go'), no = d.querySelector('.no'), st = d.querySelector('.st'), armed = !a.risk;
    function done(msg, ok) {
      go.remove(); no.remove(); st.textContent = msg; st.className = 'st ' + (ok ? 'ok' : 'bad');
      Array.prototype.forEach.call(d.querySelectorAll('input,textarea'), function (x) { x.disabled = true; });
    }
    no.onclick = function () { api('cancel', { id: a.id }).catch(function () {}); done('Cancelled', false); };
    go.onclick = function () {
      if (!armed) { armed = true; go.textContent = 'Yes, save it'; go.classList.add('warn'); return; }
      var edits = a.type === 'email' ? { to: d.querySelector('.f-to').value, cc: d.querySelector('.f-cc').value, subject: d.querySelector('.f-sub').value, body: d.querySelector('.f-body').value } : {};
      go.disabled = no.disabled = true; st.textContent = a.type === 'email' ? 'Sending…' : 'Saving…';
      api('execute', { id: a.id, edits: edits }).then(function (r) {
        done('✓ ' + r.done, true);
        toSuite('agent-done');   // Litu confetti
        A.history.push({ role: 'model', text: '[Done] ' + r.done }); save();
        if (r.undo && r.logId) {
          var u = document.createElement('button'); u.type = 'button'; u.className = 'undo'; u.textContent = 'Undo';
          u.onclick = function () {
            u.disabled = true;
            api('undo', { logId: r.logId }).then(function (x) { st.textContent = '↺ ' + x.done; u.remove(); }, function (e) { toast(e.message); u.disabled = false; });
          };
          st.parentNode.appendChild(u);
        }
      }, function (e) { go.disabled = no.disabled = false; st.textContent = e.message; st.className = 'st bad'; });
    };
    $('agLog').appendChild(d); scrollEnd();
  }

  function addTyping() {
    var d = document.createElement('div');
    d.className = 'ag-msg bot typing';
    d.innerHTML = '<div class="av" aria-hidden="true">✦</div><div class="b"><span class="dots"><i></i><i></i><i></i></span><span class="tx">Reading your sheets…</span></div>';
    $('agLog').appendChild(d); scrollEnd();
    var msgs = ['Reading your sheets…', 'Crunching the numbers…', 'Writing the answer…'], k = 0;
    var t0 = Date.now();
    d._t = setInterval(function () { k = (k + 1) % msgs.length; var t = d.querySelector('.tx'); if (t) t.textContent = msgs[k] + ' ' + Math.round((Date.now() - t0) / 1000) + 's'; }, 3000);
    return d;
  }

  function ask(q, byVoice) {
    q = String(q || '').trim();
    if (!q || A.busy) return;
    A.busy = true; $('agSend').disabled = true;
    $('agHello').classList.add('hidden');
    addMe(q);
    var prior = A.history.slice(-8);
    A.history.push({ role: 'user', text: q }); save();
    var t = addTyping();
    toSuite('agent-busy');
    api('ask', { q: q, history: prior }).then(function (r) {
      toSuite('agent-answer', { warn: WARN_RE.test(r.answer || '') });
      A.history.push({ role: 'model', text: r.answer, steps: r.steps || [] }); save();
      var bm = addBot(r.answer, r.steps);
      (r.actions || []).forEach(addAction);
      if (byVoice && bm) { var sb = bm.querySelector('.ag-say'); if (sb) speak(r.answer, sb); }
    }).catch(function (e) {
      toSuite('agent-answer', { warn: true });
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

  /* ---------------- voice: 🎤 bolo → sawaal · 🔊 jawab suno (browser ka free feature) ---------------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var VOICE = { stt: !!SR, tts: !!window.speechSynthesis, rec: null, on: false, lang: 'en-IN' };
  try { VOICE.lang = localStorage.getItem('ag_lang') || 'en-IN'; } catch (e) {}
  function setLang(l) {
    VOICE.lang = l; try { localStorage.setItem('ag_lang', l); } catch (e) {}
    var b = $('agLang'); if (b) { b.textContent = l === 'hi-IN' ? 'हि' : 'EN'; b.title = 'Voice language: ' + (l === 'hi-IN' ? 'Hindi' : 'English (India)') + ' — click to switch'; }
  }
  function micStop() { if (VOICE.rec) try { VOICE.rec.stop(); } catch (e) {} }
  function micStart() {
    if (VOICE.on) return micStop();
    if (A.busy) return;
    if (window.speechSynthesis) speechSynthesis.cancel();
    var rec = new SR(), q = $('agQ'), base = q.value ? q.value.replace(/\s*$/, ' ') : '', fin = '', err = '';
    rec.lang = VOICE.lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
      }
      q.value = base + fin + interim; q.dispatchEvent(new Event('input'));
    };
    rec.onerror = function (e) { err = e.error || 'error'; };
    rec.onend = function () {
      VOICE.on = false; VOICE.rec = null; $('agMic').classList.remove('rec'); $('agMic').setAttribute('aria-pressed', 'false');
      if (err === 'not-allowed' || err === 'service-not-allowed') return toast('Microphone is blocked. Allow it from the 🔒 icon in the address bar.');
      if (err === 'no-speech') return toast('Did not hear anything. Try again.');
      if (err && err !== 'aborted') return toast('Voice error: ' + err);
      var v = q.value.trim();
      if (fin.trim() && v) { q.value = ''; q.style.height = ''; ask(v, true); }
    };
    try { rec.start(); } catch (e) { return toast('Could not start the microphone'); }
    VOICE.rec = rec; VOICE.on = true;
    $('agMic').classList.add('rec'); $('agMic').setAttribute('aria-pressed', 'true');
  }
  function plainForSpeech(md) {
    return String(md || '')
      .replace(/```chart[\s\S]*?```/g, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/((?:^\s*\|.*\|\s*$\n?)+)/gm, function (t) { var n = t.trim().split('\n').length - 2; return n > 0 ? ' A table with ' + n + ' row' + (n > 1 ? 's' : '') + ' is shown on screen. ' : ' '; })
      .replace(/^\s*_.*_\s*$/gm, ' ')                 // Source: line
      .replace(/[*_`#>|]/g, ' ')
      .replace(/₹\s?/g, 'rupees ')
      .replace(/\s+/g, ' ').trim();
  }
  function speak(text, btn) {
    var ss = window.speechSynthesis;
    if (!ss) return;
    if (ss.speaking && VOICE.btn === btn) { ss.cancel(); return; }
    ss.cancel();
    var t = plainForSpeech(text);
    if (!t) return;
    var lang = /[\u0900-\u097F]/.test(t) ? 'hi-IN' : (VOICE.lang === 'hi-IN' ? 'hi-IN' : 'en-IN');
    var u = new SpeechSynthesisUtterance(t.slice(0, 3000));
    u.lang = lang; u.rate = 1;
    var vs = ss.getVoices().filter(function (v) { return v.lang === lang; });
    if (!vs.length) vs = ss.getVoices().filter(function (v) { return v.lang && v.lang.indexOf(lang.slice(0, 2)) === 0; });
    if (vs.length) u.voice = vs[0];
    VOICE.btn = btn;
    if (btn) { btn.textContent = '■ Stop'; btn.classList.add('on'); }
    u.onend = u.onerror = function () { if (btn) { btn.textContent = '🔊 Listen'; btn.classList.remove('on'); } };
    ss.speak(u);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (/[?&]mini=1/.test(location.search)) { document.body.classList.add('mini'); $('agQ').placeholder = 'Ask anything… or tap 🎤'; }   // Suite ke Litu ka chhota chat
    if (/[?&]mini=1/.test(location.search)) document.addEventListener('keydown', function (e) {   // Esc → Suite chat band kare
      if (e.key === 'Escape' && !document.querySelector('.ag-card input:focus, .ag-card textarea:focus')) toSuite('litu-close');
    });
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
    $('agClear').onclick = function () { if (window.speechSynthesis) speechSynthesis.cancel(); clearChat(); };
    // IDs (record kholo) + table export — ek hi jagah se
    $('agLog').addEventListener('click', function (e) {
      var a = e.target.closest('a.ag-id');
      if (a) { e.preventDefault(); return openId(a.dataset.rt, a.dataset.id); }
      var x = e.target.closest('.ag-tbl-x button');
      if (x) exportTbl(x);
    });
    if (VOICE.stt) {
      $('agMic').hidden = false; $('agLang').hidden = false; setLang(VOICE.lang);
      $('agMic').onclick = micStart;
      $('agLang').onclick = function () { setLang(VOICE.lang === 'hi-IN' ? 'en-IN' : 'hi-IN'); };
    }
    if (VOICE.tts) { try { speechSynthesis.getVoices(); } catch (e) {} }
    $('agSources').onclick = showSources;

    // Suite se aaya sawaal (floating button / Ctrl+K): ?q=
    var pre = new URLSearchParams(location.search).get('q');

    restore();
    api('ping').then(function (r) {
      $('agStatus').textContent = r.keySet ? 'Online · ' + r.model + ' · changes need your Confirm' : 'Key not set. Add GEMINI_KEY in GAS Script Properties';
      $('agStatus').className = r.keySet ? 'ok' : 'warn';
      if (pre && r.keySet) ask(pre);
    }).catch(function (e) {
      $('agStatus').textContent = e.message; $('agStatus').className = 'warn';
    });
    q.focus();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
