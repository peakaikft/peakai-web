/* ─── Peak AI · weboldali chatbot ────────────────────────────────────
   Önálló widget, függőség nélkül — a PEAK AI Reception csomag élő
   bemutatója. A beszélgetés a /api/chat szerverless végpontra megy,
   ami a Claude API-t hívja. GA4-mérés a meglévő window.peakTrack-kel
   (lásd assets/consent.js), csak ha a látogató elfogadta a mérést.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  var API_URL = '/api/chat';
  var SESSION_KEY = 'peakai_chat_session';
  var GREETING = 'Jó napot! Ebben az ablakban a PEAK AI Reception csomag AI-asszisztensét próbálhatja ki — kérdezzen a csomagokról, az árakról vagy a bevezetésről. Miben segíthetek?';
  var MAX_LEN = 2000;

  function track(name, params) {
    if (typeof window.peakTrack === 'function') window.peakTrack(name, params || {});
  }

  function sessionId() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('s' + Date.now() + Math.random().toString(16).slice(2));
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) { return 'no-storage'; }
  }

  function injectStyles() {
    var css = document.createElement('style');
    css.textContent =
      '#pk-chat-btn{position:fixed;right:20px;bottom:20px;z-index:9998;width:58px;height:58px;border-radius:50%;' +
      'background:#0B0E13;border:1px solid #1E232C;cursor:pointer;display:grid;place-items:center;' +
      'box-shadow:0 12px 30px rgba(6,8,16,.28);transition:transform .15s ease}' +
      '#pk-chat-btn:hover{transform:translateY(-2px)}' +
      '#pk-chat-btn svg{width:26px;height:22px;display:block}' +
      '#pk-chat-panel{position:fixed;right:20px;bottom:90px;z-index:9999;width:368px;max-width:calc(100vw - 32px);' +
      'height:520px;max-height:calc(100vh - 130px);background:#0B0E13;border:1px solid #1E232C;border-radius:16px;' +
      'box-shadow:0 24px 60px rgba(6,8,16,.4);display:none;flex-direction:column;overflow:hidden;' +
      'font-family:Manrope,system-ui,-apple-system,sans-serif}' +
      '#pk-chat-panel.open{display:flex}' +
      '#pk-chat-head{padding:16px 18px;border-bottom:1px solid #1E232C;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}' +
      '#pk-chat-head .ttl{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;color:#F4F6FA;font-size:.98rem}' +
      '#pk-chat-head .sub{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.66rem;letter-spacing:.14em;' +
      'text-transform:uppercase;color:#5A6472;margin-top:4px}' +
      '#pk-chat-close{background:transparent;border:0;color:#A8B1BD;cursor:pointer;font-size:1.1rem;line-height:1;padding:4px}' +
      '#pk-chat-close:hover{color:#F4F6FA}' +
      '#pk-chat-disclosure{padding:10px 18px;font-size:.74rem;line-height:1.5;color:#5A6472;border-bottom:1px solid #1E232C}' +
      '#pk-chat-disclosure a{color:#5DE8E2;text-decoration:none}' +
      '#pk-chat-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}' +
      '.pk-msg{max-width:84%;padding:10px 13px;border-radius:12px;font-size:.9rem;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}' +
      '.pk-msg.user{align-self:flex-end;background:#1FAEA8;color:#0B0E13}' +
      '.pk-msg.bot{align-self:flex-start;background:#14181F;color:#DCE1E8;border:1px solid #1E232C}' +
      '.pk-msg.err{align-self:flex-start;background:rgba(255,122,122,.1);color:#FF9E9E;border:1px solid rgba(255,122,122,.25)}' +
      '.pk-typing{align-self:flex-start;color:#5A6472;font-size:.82rem;font-family:"JetBrains Mono",monospace}' +
      '#pk-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid #1E232C}' +
      '#pk-chat-input{flex:1;resize:none;background:#14181F;border:1px solid #2C3542;border-radius:9px;color:#F4F6FA;' +
      'font-family:Manrope,system-ui,sans-serif;font-size:.9rem;padding:10px 12px;max-height:80px}' +
      '#pk-chat-input:focus{outline:none;border-color:#5DE8E2}' +
      '#pk-chat-input::placeholder{color:#5A6472}' +
      '#pk-chat-send{background:#5DE8E2;border:1px solid #5DE8E2;color:#0B0E13;border-radius:9px;padding:0 16px;' +
      'font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:.86rem;cursor:pointer}' +
      '#pk-chat-send:hover{background:#7BFFF7;border-color:#7BFFF7}' +
      '#pk-chat-send:disabled{opacity:.5;cursor:default}' +
      '@media(max-width:480px){#pk-chat-panel{right:16px;left:16px;width:auto;bottom:84px}}';
    document.head.appendChild(css);
  }

  function svgMark() {
    return '<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">' +
      '<polygon points="20,72 60,6 100,72" fill="#5DE8E2"/>' +
      '<polygon points="0,72 28,32 56,72" fill="#5DE8E2" opacity=".55"/>' +
      '<polygon points="62,72 90,38 118,72" fill="#5DE8E2" opacity=".75"/>' +
      '<rect x="0" y="72" width="120" height="2" fill="#5DE8E2" opacity=".9"/></svg>';
  }

  function build() {
    injectStyles();

    var btn = document.createElement('button');
    btn.id = 'pk-chat-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Peak AI chat megnyitása');
    btn.innerHTML = svgMark();
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = 'pk-chat-panel';
    panel.innerHTML =
      '<div id="pk-chat-head">' +
        '<div><div class="ttl">Peak AI asszisztens</div><div class="sub">PEAK AI Reception · élő bemutató</div></div>' +
        '<button type="button" id="pk-chat-close" aria-label="Bezárás">&#10005;</button>' +
      '</div>' +
      '<div id="pk-chat-disclosure">Ezt egy AI válaszolja, magyarul — nem élő ügyfélszolgálat. A beszélgetést rögzítjük, hogy jobbá tehessük. <a href="/adatkezeles/#chatbot">Részletek</a></div>' +
      '<div id="pk-chat-msgs" aria-live="polite"></div>' +
      '<form id="pk-chat-form">' +
        '<textarea id="pk-chat-input" rows="1" maxlength="' + MAX_LEN + '" placeholder="Írjon üzenetet…" aria-label="Üzenet"></textarea>' +
        '<button type="submit" id="pk-chat-send">Küldés</button>' +
      '</form>';
    document.body.appendChild(panel);

    var msgsEl = panel.querySelector('#pk-chat-msgs');
    var form = panel.querySelector('#pk-chat-form');
    var input = panel.querySelector('#pk-chat-input');
    var sendBtn = panel.querySelector('#pk-chat-send');

    var history = []; // {role:'user'|'assistant', content:'...'}
    var opened = false;
    var busy = false;

    function addBubble(role, text) {
      var el = document.createElement('div');
      el.className = 'pk-msg ' + (role === 'user' ? 'user' : role === 'err' ? 'err' : 'bot');
      el.textContent = text;
      msgsEl.appendChild(el);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      return el;
    }

    function openPanel() {
      panel.classList.add('open');
      if (!opened) {
        opened = true;
        addBubble('bot', GREETING);
        history.push({ role: 'assistant', content: GREETING });
        track('chatbot_megnyitas', {});
      }
      setTimeout(function () { input.focus(); }, 50);
    }
    function closePanel() { panel.classList.remove('open'); }

    btn.addEventListener('click', function () {
      if (panel.classList.contains('open')) closePanel(); else openPanel();
    });
    panel.querySelector('#pk-chat-close').addEventListener('click', closePanel);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var text = input.value.trim().slice(0, MAX_LEN);
      if (!text) return;

      addBubble('user', text);
      history.push({ role: 'user', content: text });
      track('chatbot_uzenet', { hossz: text.length });
      input.value = '';
      input.style.height = 'auto';

      busy = true;
      sendBtn.disabled = true;
      var typing = document.createElement('div');
      typing.className = 'pk-typing';
      typing.textContent = 'Válaszol…';
      msgsEl.appendChild(typing);
      msgsEl.scrollTop = msgsEl.scrollHeight;

      fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-16),
          sessionId: sessionId(),
          page: location.href
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.json();
      }).then(function (data) {
        typing.remove();
        var reply = (data && data.reply) ? data.reply : 'Elnézést, nem sikerült választ adnom. Írjon a barnabas@peakai.hu címre.';
        addBubble('bot', reply);
        history.push({ role: 'assistant', content: reply });
        if (data && data.leadCaptured) track('chatbot_lead', {});
      }).catch(function () {
        typing.remove();
        addBubble('err', 'Most nem sikerült kapcsolódni. Próbálja újra, vagy írjon a barnabas@peakai.hu címre.');
      }).finally(function () {
        busy = false;
        sendBtn.disabled = false;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
