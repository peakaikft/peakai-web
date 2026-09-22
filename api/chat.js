/* ─── Peak AI · weboldali chatbot backend ────────────────────────────
   Vercel serverless function (zero-config, nincs npm-függőség — a
   beépített `fetch`-et használja). A Claude API-t hívja saját
   rendszerprompttal, és egy tool-lal (visszahivas_kerese) a meglévő
   Make.com webhookra küldi a leadet, ugyanoda, ahova a főoldali
   visszahívás-kérő űrlap ír. A beszélgetést best-effort Supabase-be
   naplózza, ha a környezeti változók be vannak állítva.

   Szükséges környezeti változók (Vercel → Project → Settings → Environment Variables):
     ANTHROPIC_API_KEY        — kötelező, külön kulcs a chatbothoz
     CHATBOT_MODEL             — opcionális, alapértelmezett: claude-sonnet-5
     MAKE_WEBHOOK_URL          — opcionális, alapértelmezett a meglévő
                                  visszahívás-webhook (nem titok, a
                                  kliensoldali JS-ben is szerepel)
     SUPABASE_URL               — opcionális, csak naplózáshoz
     SUPABASE_SERVICE_ROLE_KEY  — opcionális, csak naplózáshoz
   ──────────────────────────────────────────────────────────────────── */

var ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
var ANTHROPIC_VERSION = '2023-06-01';
var DEFAULT_MODEL = 'claude-sonnet-5';
var MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || 'https://hook.eu2.make.com/6sre7eo775aes5pwxxxrw9yrlq1psrmp';
var ALLOWED_ORIGIN = 'https://peakai.hu';

var SYSTEM_PROMPT = [
  'Ön a Peak AI weboldalán megjelenő AI asszisztens — egyben élő bemutatója is annak, amit a PEAK AI Reception csomag telefonos AI-asszisztense tud. Kizárólag magyarul válaszol, magázódva, rövid és konkrét mondatokban.',
  '',
  'KI ÖN ÉS KINEK DOLGOZIK:',
  'A Peak AI (jogi neve AlignMed Kft., Szeged) kis- és középvállalkozásoknak épít AI telefonos recepciós és online foglalási rendszert. Célközönség: gumiszerviz, autószerviz, klímatechnika, épületgépészet, fűtés- és hűtésszerelés, villanyszerelés, víz- és gázszerelés, fogorvosi rendelő, magánorvosi praxis, kozmetika és fodrászat, fitness és pilates stúdió, állatorvosi rendelő, ingatlanközvetítés.',
  'Ha megkérdezik, mi ön: elmondja, hogy AI-asszisztens (Claude, az Anthropic nyelvi modellje) — soha nem állítja magáról, hogy ember.',
  '',
  'CSOMAGOK — PONTOS, ÉLŐ ÁRAK, NE KEREKÍTSEN ÉS NE TALÁLJON KI MÁST:',
  '',
  '1) PEAK Booking — 89 000 Ft + áfa / hó.',
  'Saját foglalási oldal, szolgáltatások/árak/nyitvatartás kezelése, időpontfoglalás és lemondás, e-mailes visszaigazolás és automata emlékeztető, alap CRM és riportok. NINCS benne telefonos AI-asszisztens.',
  'Bevezetési díj: 149 000 Ft + áfa. 12 hónapos szerződés. 14 napos díjmentes próbaüzem.',
  '',
  '2) PEAK AI Reception — 179 000 Ft + áfa / hó. Ez a "Legnépszerűbb" csomag — ÖN ennek az élő bemutatója.',
  'Minden, ami a PEAK Bookingban, PLUSZ telefonos AI-asszisztens 300 perc/hó beépített kerettel: felveszi a hívást, foglal/módosít/lemond telefonon, megválaszolja a gyakori kérdéseket és az ár-információt, rögzíti a visszahívási igényt és irányít emberhez, hívásösszefoglalót és visszahívási listát ad minden hívásról.',
  'Kereten felüli perc: 120 Ft + áfa / perc, a következő hónapban külön tételként számlázva.',
  'Bevezetési díj: 249 000 Ft + áfa. 12 hónapos szerződés. 14 napos díjmentes próbaüzem.',
  '',
  '3) PEAK Pro — 299 000 Ft + áfa / hó, 2 forrásig (telephely vagy partnercég együtt), 800 perc/hó.',
  'Egyetlen hívás sem vész el a telephelyek vagy partnercégek között — mindegyik ugyanabba a naptárba fut be, egy helyről kezelve. Minden további forrás: +59 000 Ft + áfa/hó (+400 perc). Forrásonkénti kapacitás és eltérő szolgáltatások/árak, központi ügyféladatbázis, forrásonkénti riportok, hívásirányítás, flottás ügyfélkezelés.',
  'Kereten felüli perc: 120 Ft + áfa / perc. Bevezetési díj: 399 000 Ft + áfa. 12 hónapos szerződés. 14 napos díjmentes próbaüzem.',
  '',
  'MINDHÁROM CSOMAGBAN BENNE VAN (nem külön fizetendő): adatbázis-szintű ütközésvédelem — egy időpontot nem foglal le kétszer, még ha egyszerre több csatornáról (pult, weboldal, telefon) érkezik is a foglalás —, valamint automatikus időpont-emlékeztető e-mail minden ügyfélnek.',
  'Az árban NINCS benne: a saját telefonszám átirányításának esetleges szolgáltatói díja (ha a látogató szolgáltatója ilyet számol fel), és a kereten felüli percek.',
  'JELENLEG NINCS éves előrefizetési kedvezmény. Ha rákérdeznek, mondja: "Jelenleg nincs ilyen kedvezmény, a fenti a havidíj."',
  '',
  'MIT TUD A TELEFONOS ASSZISZTENS (a Reception és Pro csomagban):',
  'Időpontot foglal felmérésre/telepítésre/javításra/karbantartásra, visszahívást kér ha a kérdés meghaladja a hatáskörét, válaszol nyitvatartásra/címre/szolgáltatási körre, megjelöli a sürgős eseteket, 0–24 elérhető.',
  'MIT NEM TESZ: nem mond konkrét árat/árajánlatot egyedi esetre (azt felmérés után az ügyfél adja), nem ígér kiszállási időpontot emberi megerősítés nélkül, nem talál ki terméknevet/márkát/garanciát/akciót, nem adja ki magát embernek, nem hív fel senkit magától (nem hideghívásra való).',
  '',
  'SZABÁLYOK — EZEKET SOSE SZEGJE MEG:',
  '- Nem alkuszik egyedi árban, és nem ígér kedvezményt vagy egyedi csomagot. Ha kérik: "Ez egyedi elbírálást igényel, Barnabás, az alapító tudja megnézni — kérje meg, hogy hívja vissza."',
  '- Nem foglal ténylegesen időpontot saját magán, és nem ígér konkrét visszahívási időt a rendszer megerősítése nélkül — csak a visszahívási igényt rögzíti a visszahivas_kerese eszközzel.',
  '- Nem talál ki funkciót, integrációt, határidőt vagy garanciát, ami nincs fent leírva. Ha nem tudja a választ, mondja meg őszintén, és ajánlja fel a visszahívást vagy a barnabas@peakai.hu címet.',
  '- ÁSZF, adatkezelés vagy szerződéses részletkérdésnél a megfelelő oldalra irányít (/aszf/, /adatkezeles/), nem improvizál jogi tartalmat.',
  '- Nem beszél lekicsinylően más cégekről; versenytárs kérdésnél tényszerű és higgadt.',
  '- Nem tér el a Peak AI / foglalás / árazás témától; irreleváns kérdésnél barátságosan visszatereli a témára.',
  '- Soha nem használ emojit.',
  '',
  'MIKOR HASZNÁLJA A visszahivas_kerese ESZKÖZT:',
  'Csak akkor hívja meg, ha a látogató KIFEJEZETTEN visszahívást vagy demót szeretne, ÉS a beszélgetésben megadta a nevét és a telefonszámát. Ha valamelyik hiányzik, kérdezzen rá, mielőtt meghívná az eszközt. Soha ne találjon ki nevet vagy telefonszámot.',
  '',
  'HANGVÉTEL: magázódás, rövid mondatok (2-4 mondat, kivéve ha a látogató részletesebb listát kér), konkrétum általánosság helyett — a célközönség szakiparos és orvos, a nagyotmondás náluk hiteltelen.'
].join('\n');

var TOOL = {
  name: 'visszahivas_kerese',
  description: 'Visszahívási igény rögzítése a Peak AI belső rendszerében, amikor a látogató demót vagy visszahívást kér, és megadta a nevét és a telefonszámát.',
  input_schema: {
    type: 'object',
    properties: {
      nev: { type: 'string', description: 'A látogató neve, pontosan úgy, ahogy megadta.' },
      telefon: { type: 'string', description: 'Telefonszám, pontosan úgy, ahogy megadta.' },
      mikor: {
        type: 'string',
        enum: ['Délelőtt (8–12)', 'Délután (12–17)', 'Este (17–20)', 'Bármikor'],
        description: 'Mikor hívható vissza. Ha nem mondta, válasszon "Bármikor" értéket.'
      },
      uzenet: { type: 'string', description: 'Rövid összefoglaló arról, mire kíváncsi, milyen iparágban/cégben dolgozik, ha elhangzott a beszélgetésben.' }
    },
    required: ['nev', 'telefon']
  }
};

// Egyszerű, best-effort memóriabeli rate-limit (nem oszlik meg az összes
// szerverless példány között, de egy elszabaduló kliens ellen elég).
var hits = new Map();
function rateLimited(ip) {
  var now = Date.now();
  var windowMs = 10 * 60 * 1000;
  var max = 30;
  var arr = (hits.get(ip) || []).filter(function (t) { return now - t < windowMs; });
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // durva védőháló hosszan futó instance ellen
  return arr.length > max;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  var origin = req.headers.origin || '';
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'rate_limited', message: 'Túl sok kérés érkezett — próbálja néhány perc múlva.' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'config', message: 'A chatbot jelenleg nem elérhető.' });
    return;
  }

  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { res.status(400).json({ error: 'bad_request' }); return; }
  }
  if (!body || typeof body !== 'object') { res.status(400).json({ error: 'bad_request' }); return; }

  var incoming = Array.isArray(body.messages) ? body.messages : [];
  var sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 80) : 'unknown';
  var page = typeof body.page === 'string' ? body.page.slice(0, 200) : '';

  if (incoming.length === 0 || incoming.length > 40) {
    res.status(400).json({ error: 'bad_request', message: 'Érvénytelen üzenet.' });
    return;
  }

  var trimmed = incoming.slice(-16).map(function (m) {
    return {
      role: m && m.role === 'assistant' ? 'assistant' : 'user',
      content: String((m && m.content) || '').slice(0, 2000)
    };
  }).filter(function (m) { return m.content.trim().length > 0; });

  if (trimmed.length === 0) { res.status(400).json({ error: 'bad_request' }); return; }

  var lastUser = trimmed[trimmed.length - 1];
  logToSupabase(sessionId, lastUser.role, lastUser.content, page).catch(function () {});

  var working = trimmed.map(function (m) { return { role: m.role, content: m.content }; });
  var leadCaptured = false;
  var finalText = '';

  try {
    for (var round = 0; round < 3; round++) {
      var resp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: process.env.CHATBOT_MODEL || DEFAULT_MODEL,
          max_tokens: 600,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          tools: [TOOL],
          messages: working
        })
      });

      if (!resp.ok) {
        var errText = await resp.text().catch(function () { return ''; });
        console.error('anthropic_error', resp.status, errText);
        res.status(502).json({ error: 'upstream', message: 'Nem sikerült választ kapni. Próbálja újra.' });
        return;
      }

      var data = await resp.json();
      var blocks = Array.isArray(data.content) ? data.content : [];
      var textBlocks = blocks.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim();
      var toolUses = blocks.filter(function (b) { return b.type === 'tool_use'; });

      if (textBlocks) finalText = finalText ? finalText + '\n' + textBlocks : textBlocks;

      if (data.stop_reason === 'tool_use' && toolUses.length > 0) {
        working.push({ role: 'assistant', content: blocks });
        var toolResults = [];
        for (var i = 0; i < toolUses.length; i++) {
          var tu = toolUses[i];
          if (tu.name === 'visszahivas_kerese') {
            var ok = await sendLead(tu.input, page).catch(function () { return false; });
            if (ok) leadCaptured = true;
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: ok ? 'Rögzítve, továbbítva Barnabásnak.' : 'A rögzítés nem sikerült — kérje meg a látogatót, hogy írjon a barnabas@peakai.hu címre.'
            });
          } else {
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Ismeretlen eszköz.' });
          }
        }
        working.push({ role: 'user', content: toolResults });
        continue;
      }
      break;
    }
  } catch (err) {
    console.error('chat_handler_error', err);
    res.status(502).json({ error: 'upstream', message: 'Nem sikerült választ kapni. Próbálja újra.' });
    return;
  }

  if (!finalText) finalText = 'Elnézést, nem sikerült választ adnom. Kérjük, próbálja újra, vagy írjon a barnabas@peakai.hu címre.';

  logToSupabase(sessionId, 'assistant', finalText, page).catch(function () {});

  res.status(200).json({ reply: finalText, leadCaptured: leadCaptured });
};

async function sendLead(input, page) {
  var nev = String((input && input.nev) || '').trim().slice(0, 120);
  var telefon = String((input && input.telefon) || '').trim().slice(0, 40);
  var mikor = String((input && input.mikor) || 'Bármikor').slice(0, 40);
  var uzenet = String((input && input.uzenet) || '').slice(0, 500);
  if (!nev || !telefon) return false;
  var resp = await fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nev: nev,
      telefon: telefon,
      mikor: mikor,
      consent: 'igen',
      source: 'chatbot',
      uzenet: uzenet,
      page: page || 'chatbot',
      submittedAt: new Date().toISOString()
    })
  });
  return resp.ok;
}

async function logToSupabase(sessionId, role, content, page) {
  var url = process.env.SUPABASE_URL;
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(url.replace(/\/$/, '') + '/rest/v1/chatbot_beszelgetesek', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apikey': key,
      'authorization': 'Bearer ' + key,
      'prefer': 'return=minimal'
    },
    body: JSON.stringify([{ session_id: sessionId, role: role, content: String(content).slice(0, 4000), page: page }])
  });
}
