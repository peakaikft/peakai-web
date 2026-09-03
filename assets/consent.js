/* ─── Peak AI · mérés és süti-hozzájárulás ──────────────────────────
   Egyetlen fájl minden oldalhoz. Google Analytics 4 (G-6B6Q541Y2X)
   Consent Mode v2-vel: alapból minden tárolás TILTVA, süti csak akkor
   jön létre, ha a látogató az „Elfogadom" gombra kattint. A döntést a
   böngésző localStorage-ában jegyezzük meg (peakai_consent), 12 hónapig.
   Elutasításnál a GA süti nélküli, anonim „ping"-eket küld (Consent Mode),
   amelyből a Google modellezett forgalmi adatot ad — személyes adat nem.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  var GA_ID = 'G-6B6Q541Y2X';
  var KEY = 'peakai_consent';
  var TTL_DAYS = 365;

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  /* 1. alapértelmezés: minden tiltva, mielőtt a gtag betöltődne */
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500
  });

  function readChoice() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.t || Date.now() - obj.t > TTL_DAYS * 864e5) return null;
      return obj.v === 'granted' ? 'granted' : 'denied';
    } catch (e) { return null; }
  }
  function saveChoice(v) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }
  function applyChoice(v) {
    gtag('consent', 'update', {
      analytics_storage: v,
      functionality_storage: v
    });
  }

  /* 2. GA betöltése (mindig: tiltott állapotban is csak süti nélküli ping megy) */
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });

  var choice = readChoice();
  if (choice) applyChoice(choice);

  /* 3. süti-sáv, csak ha még nincs döntés */
  function showBanner() {
    var css = document.createElement('style');
    css.textContent =
      '#pk-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;' +
      'background:#0B0E13;color:#A8B1BD;border:1px solid #1E232C;border-radius:14px;padding:18px 20px;' +
      'font:15px/1.55 Manrope,system-ui,-apple-system,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.35)}' +
      '#pk-consent p{margin:0 0 14px}#pk-consent a{color:#5DE8E2;text-decoration:none}' +
      '#pk-consent .row{display:flex;gap:10px;flex-wrap:wrap}' +
      '#pk-consent button{cursor:pointer;border-radius:8px;padding:10px 18px;font:600 14px "Space Grotesk",system-ui,sans-serif;border:1px solid #2C3542;background:transparent;color:#F4F6FA}' +
      '#pk-consent button.ok{background:#5DE8E2;border-color:#5DE8E2;color:#0B0E13}' +
      '#pk-consent button.ok:hover{background:#7BFFF7;border-color:#7BFFF7}' +
      '#pk-consent button:hover{border-color:#5A6472}' +
      '@media(max-width:480px){#pk-consent{left:10px;right:10px;bottom:10px;padding:16px}}';
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.id = 'pk-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Süti-beállítások');
    box.innerHTML =
      '<p>Forgalmi statisztikához Google Analytics sütit használnánk — csak akkor, ha engedélyezi. ' +
      'Elutasításkor nem jön létre süti. Részletek az ' +
      '<a href="/adatkezeles/#weboldal">adatkezelési tájékoztatóban</a>.</p>' +
      '<div class="row"><button type="button" class="ok" id="pk-ok">Elfogadom</button>' +
      '<button type="button" id="pk-no">Elutasítom</button></div>';
    document.body.appendChild(box);

    function done(v) {
      saveChoice(v);
      applyChoice(v);
      gtag('event', 'suti_dontes', { dontes: v });
      box.parentNode && box.parentNode.removeChild(box);
    }
    document.getElementById('pk-ok').addEventListener('click', function () { done('granted'); });
    document.getElementById('pk-no').addEventListener('click', function () { done('denied'); });
  }

  /* 4. konverziós események: e-mail kattintás, demó-CTA, kalkulátor */
  function bindEvents() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.indexOf('mailto:') === 0) {
        gtag('event', 'email_kattintas', { hely: location.pathname, szoveg: (a.textContent || '').trim().slice(0, 60) });
      } else if (/#kapcsolat$/.test(href) && a.classList.contains('btn')) {
        gtag('event', 'demo_cta', { hely: location.pathname, szoveg: (a.textContent || '').trim().slice(0, 60) });
      } else if (href.indexOf('/kalkulator/') !== -1 && location.pathname.indexOf('/kalkulator/') === -1) {
        gtag('event', 'kalkulator_megnyitas', { hely: location.pathname });
      }
    });
  }

  /* nyilvános segédfüggvény az oldalaknak: window.peakTrack('esemeny', {...}) */
  window.peakTrack = function (name, params) { gtag('event', name, params || {}); };

  function init() {
    bindEvents();
    if (!choice) showBanner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
