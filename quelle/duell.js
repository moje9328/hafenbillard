// ===================================================================
// PIXELHAFEN · FREUNDE HERAUSFORDERN
// Gemeinsamer Baustein für die Pixelhafen-Spiele: eigene Rangliste mit Freunden
// und ein Link zum Teilen. Ohne Server und ohne Anmeldung: Name, Punkte, Level
// und Stufe stehen im Link (#name=…&punkte=…&level=…&stufe=…). Wer den Link
// öffnet, hat den Freund danach in seiner Liste. Alles bleibt auf dem Gerät.
//
// Benutzung:
//   const duell = PixelDuell.erstelle({
//     spiel: 'Froschsprung',                       // Name im Text
//     adresse: 'https://moje9328.github.io/froschsprung/',
//     schluessel: 'pixelhafen.froschsprung.freunde',
//     stand: stufe => ({ punkte: 123, level: 4 }),  // eigener Rekord (für die Stufe)
//     // freiwillig:
//     stufen: { leicht: 'Leicht', normal: 'Normal' }, stufe: () => 'normal',
//     beiStufe: stufe => {…},                       // Link kam mit einer Stufe
//     levelWort: 'Level', einheit: 'Punkte', wasText: 'deinen Rekord',
//     beiZu: () => {…},                             // Fenster wurde geschlossen
//     erklaerung: 'Gezählt werden …',               // Satz unter der Überschrift
//   });
//   duell.oeffne();              // Fenster mit Rangliste und Teilen
//   duell.offen                  // Herausforderung aus dem Link oder null
//   duell.startText()            // Satz für den Startbildschirm (oder '')
//   duell.endText(punkte)        // Satz für den Ende-Bildschirm
// ===================================================================

const PixelDuell = (() => {
  const zahl = n => Math.floor(Number(n) || 0).toLocaleString('de-DE');

  function reinerName(text) {
    // Nur sichtbare Zeichen und nicht zu lang: Der Name kommt aus einem fremden Link
    const sauber = String(text == null ? '' : text).normalize('NFC').replace(/[\p{C}<>]/gu, '').trim();
    return Array.from(sauber).slice(0, 12).join('');
  }

  function lager() { try { return window.localStorage || null; } catch (e) { return null; } }

  let stilDa = false;
  function stil() {
    if (stilDa) return;
    stilDa = true;
    const css = document.createElement('style');
    css.textContent = `
.pxd { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
  background: rgba(4, 8, 24, 0.78); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  touch-action: auto; -webkit-user-select: none; user-select: none; overflow-y: auto; overscroll-behavior: contain;
  font: 16px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #eef3ff; text-align: left; }
.pxd[hidden] { display: none; }
.pxd * { box-sizing: border-box; }
.pxd-tafel { width: min(100%, 420px); max-height: calc(100dvh - 24px); overflow-y: auto; padding: 20px 18px 18px; background: #101d45; border: 2px solid #2b4183; border-radius: 16px; box-shadow: 0 16px 50px rgba(0,0,0,0.55); }
.pxd h2 { margin: 0 0 4px; color: #f2b84b; font: 16px/1.4 'Press Start 2P', 'Courier New', monospace; letter-spacing: 0; }
.pxd p { margin: 8px 0 0; }
.pxd .pxd-klein { color: #aab7da; font-size: 13px; line-height: 1.4; }
.pxd .pxd-duell { margin: 12px 0 0; padding: 10px 12px; background: #182a5c; border-left: 4px solid #f2b84b; border-radius: 8px; }
.pxd .pxd-duell:empty { display: none; }
.pxd .pxd-stufen { display: flex; gap: 4px; margin: 14px 0 0; padding: 4px; background: #0a1330; border-radius: 12px; }
.pxd .pxd-stufen[hidden] { display: none; }
.pxd .pxd-stufen button { flex: 1 1 0; min-height: 40px; padding: 6px 4px; color: #aab7da; background: transparent; border: 0; border-radius: 9px; font-weight: 600; font-size: 14px; line-height: 1.2; font-family: inherit; cursor: pointer; }
.pxd .pxd-stufen button[aria-pressed="true"] { color: #eef3ff; background: #182a5c; box-shadow: 0 1px 2px rgba(0,0,0,0.3); }
.pxd ol { display: grid; gap: 6px; margin: 14px 0 0; padding: 0; list-style: none; }
.pxd li { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 4px 4px 4px 12px; background: #182a5c; border-radius: 10px; }
.pxd li.pxd-ich { box-shadow: inset 0 0 0 2px #f2b84b; }
.pxd .pxd-platz { flex: none; width: 22px; color: #aab7da; font: 10px/1 'Press Start 2P', 'Courier New', monospace; }
.pxd .pxd-wer { flex: 1 1 auto; min-width: 0; overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.pxd .pxd-wer small { display: block; color: #aab7da; font-weight: 400; font-size: 12px; }
.pxd .pxd-wie { flex: none; font: 11px/1 'Press Start 2P', 'Courier New', monospace; font-variant-numeric: tabular-nums; }
.pxd .pxd-weg, .pxd .pxd-leer { flex: none; width: 36px; height: 36px; }
.pxd .pxd-weg { padding: 0; color: #aab7da; background: transparent; border: 0; border-radius: 8px; font-size: 20px; line-height: 1; cursor: pointer; }
.pxd .pxd-weg:hover { color: #eef3ff; background: #101d45; }
.pxd label { display: grid; gap: 6px; margin: 16px 0 0; font-weight: 600; }
.pxd input { width: 100%; min-height: 46px; padding: 10px 12px; color: #eef3ff; background: #0a1330; border: 1px solid #2b4183; border-radius: 10px; font-size: 16px; line-height: 1.3; font-family: inherit; -webkit-user-select: text; user-select: text; touch-action: auto; }
.pxd input[hidden] { display: none; }
.pxd .pxd-status { min-height: 22px; margin: 10px 0 0; color: #f2b84b; font-weight: 600; }
.pxd .pxd-status:empty { display: none; }
.pxd .pxd-knoepfe { display: grid; gap: 8px; margin: 16px 0 0; }
.pxd .pxd-btn { min-height: 48px; padding: 10px 14px; color: #eef3ff; background: #182a5c; border: 1px solid #2b4183; border-radius: 12px; font-weight: 600; font-size: 16px; line-height: 1.2; font-family: inherit; cursor: pointer; }
.pxd .pxd-btn.pxd-main { color: #1d1505; background: #f2b84b; border-color: #a9781f; box-shadow: 0 3px 0 #a9781f; }
.pxd .pxd-btn:disabled { opacity: 0.45; cursor: default; }
.pxd .pxd-btn:hover:not(:disabled) { filter: brightness(1.08); }
.pxd :focus-visible { outline: 3px solid #f2b84b; outline-offset: 2px; }
`;
    document.head.append(css);
  }

  function erstelle(cfg) {
    const spiel = cfg.spiel;
    const stufen = cfg.stufen || null;
    const einheit = cfg.einheit || 'Punkte';
    const levelWort = cfg.levelWort === undefined ? 'Level' : cfg.levelWort;
    const stufeJetzt = () => (stufen ? (cfg.stufe ? cfg.stufe() : Object.keys(stufen)[0]) : '');
    const stufeName = st => (stufen && stufen[st] ? stufen[st] : '');

    // ---------- Speicher: { name, freunde: [{ name, punkte, level, stufe }] } ----------
    let daten = { name: '', freunde: [] };
    try {
      const l = lager();
      const roh = l ? JSON.parse(l.getItem(cfg.schluessel) || 'null') : null;
      if (roh && typeof roh === 'object') {
        daten.name = reinerName(roh.name);
        if (Array.isArray(roh.freunde)) {
          daten.freunde = roh.freunde.filter(f => f && reinerName(f.name) && Number.isInteger(f.punkte) && f.punkte > 0)
            .map(f => ({ name: reinerName(f.name), punkte: f.punkte, level: Number.isInteger(f.level) ? f.level : 0, stufe: typeof f.stufe === 'string' ? f.stufe : '' }))
            .slice(0, 60);
        }
      }
    } catch (e) { /* kaputt: leer anfangen */ }
    function sichern() { try { const l = lager(); if (l) l.setItem(cfg.schluessel, JSON.stringify(daten)); } catch (e) { /* gesperrt */ } }

    const freunde = (st = stufeJetzt()) => daten.freunde.filter(f => !stufen || f.stufe === st);
    const eigener = (st = stufeJetzt()) => {
      const s = cfg.stand(st) || {};
      return { punkte: Math.max(0, Math.floor(Number(s.punkte) || 0)), level: Math.max(0, Math.floor(Number(s.level) || 0)) };
    };

    // ---------- Wurde das Spiel über den Link eines Freundes geöffnet? ----------
    let offen = null;
    if (location.hash.length > 1) {
      const t = new URLSearchParams(location.hash.slice(1));
      const name = reinerName(t.get('name'));
      const punkte = Number(t.get('punkte'));
      const level = t.has('level') ? Number(t.get('level')) : 0;
      const stufe = t.get('stufe') || '';
      if (t.has('punkte')) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* egal */ } }
      const gut = name && Number.isInteger(punkte) && punkte >= 1 && punkte <= 999999999
        && Number.isInteger(level) && level >= 0 && level <= 9999
        && (stufen ? Object.prototype.hasOwnProperty.call(stufen, stufe) : true);
      if (gut) {
        const st = stufen ? stufe : '';
        const bekannt = daten.freunde.find(f => f.name === name && f.stufe === st);
        if (bekannt) { bekannt.punkte = Math.max(bekannt.punkte, punkte); bekannt.level = Math.max(bekannt.level, level); }
        else daten.freunde.push({ name, punkte, level, stufe: st });
        daten.freunde.sort((a, b) => b.punkte - a.punkte);
        daten.freunde = daten.freunde.slice(0, 60);
        sichern();
        offen = { name, punkte, level, stufe: st };
        if (stufen && cfg.beiStufe) { try { cfg.beiStufe(st); } catch (e) { /* egal */ } }
      }
    }

    function ergebnisText(e) {
      let t = zahl(e.punkte) + ' ' + einheit;
      const teile = [];
      if (levelWort && e.level > 0) teile.push(levelWort + ' ' + e.level);
      if (stufen && e.stufe) teile.push('Stufe ' + stufeName(e.stufe));
      if (teile.length) t += ' (' + teile.join(', ') + ')';
      return t;
    }

    function startText() {
      if (!offen) return '';
      const mein = eigener(offen.stufe || stufeJetzt()).punkte;
      if (mein > offen.punkte) return offen.name + ' hat dich herausgefordert: ' + ergebnisText(offen) + '. Du liegst schon vorn, schick deinen Link zurück!';
      return offen.name + ' fordert dich heraus: ' + ergebnisText(offen) + '. Schaffst du mehr?';
    }

    function endText(punkte, st = stufeJetzt()) {
      const liste = freunde(st);
      const ueber = liste.filter(f => f.punkte >= punkte).sort((a, b) => a.punkte - b.punkte)[0];
      if (ueber) return 'Noch ' + zahl(ueber.punkte - punkte + 1) + ' ' + einheit + ', dann liegst du vor ' + ueber.name + '.';
      if (liste.length) return 'Du liegst vor allen Freunden in deiner Liste. Fordere sie heraus!';
      return 'Fordere deine Freunde heraus: Wer schafft mehr?';
    }

    // ---------- Fenster ----------
    let wurzel = null, el = {}, sichtStufe = '', vorher = null, unterdrueckt = [];

    function baue() {
      stil();
      wurzel = document.createElement('div');
      wurzel.className = 'pxd';
      wurzel.hidden = true;
      wurzel.innerHTML = `
<div class="pxd-tafel" role="dialog" aria-modal="true" aria-labelledby="pxdTitel">
  <h2 id="pxdTitel">FREUNDE</h2>
  <p class="pxd-klein" data-r="unter"></p>
  <p class="pxd-duell" data-r="duell"></p>
  <div class="pxd-stufen" role="group" aria-label="Schwierigkeit" data-r="stufen" hidden></div>
  <ol data-r="liste" aria-label="Rangliste"></ol>
  <label>Dein Name für den Link
    <input type="text" data-r="name" maxlength="12" autocomplete="off" enterkeyhint="send" placeholder="zum Beispiel Sam">
  </label>
  <p class="pxd-klein">Im Link stehen nur dein Name und dein Ergebnis. Schicken Freunde dir ihren Link zurück, stehen sie hier in deiner Liste. Alles bleibt auf deinem Gerät.</p>
  <p class="pxd-status" role="status" data-r="status"></p>
  <input type="text" data-r="link" readonly hidden aria-label="Dein Link zum Kopieren">
  <div class="pxd-knoepfe">
    <button class="pxd-btn pxd-main" type="button" data-r="teilen">Freunde herausfordern</button>
    <button class="pxd-btn" type="button" data-r="zu">Schließen</button>
  </div>
</div>`;
      wurzel.querySelectorAll('[data-r]').forEach(n => { el[n.dataset.r] = n; });
      // Das Spiel darunter soll von Tippen und Tasten hier drin nichts merken
      for (const typ of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel',
        'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'keydown', 'keyup', 'keypress', 'gesturestart']) {
        wurzel.addEventListener(typ, e => e.stopPropagation());
      }
      wurzel.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); schliesse(); }
        else if (e.key === 'Enter' && e.target === el.name) { e.preventDefault(); teile(); }
        else if (e.key === 'Tab') {
          const f = [...wurzel.querySelectorAll('button:not(:disabled), input:not([hidden])')];
          if (!f.length) return;
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      });
      wurzel.addEventListener('click', e => { if (e.target === wurzel) schliesse(); });
      el.zu.addEventListener('click', schliesse);
      el.teilen.addEventListener('click', teile);
      el.name.addEventListener('input', () => { el.link.hidden = true; el.status.textContent = ''; });
      if (stufen) {
        el.stufen.hidden = false;
        for (const [id, name] of Object.entries(stufen)) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = name;
          b.dataset.stufe = id;
          b.addEventListener('click', () => { sichtStufe = id; zeichne(); });
          el.stufen.append(b);
        }
      }
      document.body.append(wurzel);
    }

    function zeichne() {
      const mein = eigener(sichtStufe);
      el.unter.textContent = 'Deine Rangliste' + (stufen ? ' auf Stufe ' + stufeName(sichtStufe) : '') + ' in ' + spiel + '.' + (cfg.erklaerung ? ' ' + cfg.erklaerung : '');
      el.duell.textContent = offen && (!stufen || offen.stufe === sichtStufe) ? startText() : '';
      if (stufen) for (const b of el.stufen.children) b.setAttribute('aria-pressed', String(b.dataset.stufe === sichtStufe));

      const eintraege = freunde(sichtStufe).map(f => ({ name: f.name, punkte: f.punkte, level: f.level, freund: f }));
      eintraege.push({ name: daten.name ? daten.name + ' (du)' : 'Du', punkte: mein.punkte, level: mein.level, ich: true });
      eintraege.sort((a, b) => b.punkte - a.punkte || (a.ich ? -1 : 1));
      el.liste.textContent = '';
      eintraege.forEach((e, i) => {
        const li = document.createElement('li');
        if (e.ich) li.className = 'pxd-ich';
        const platz = document.createElement('span'); platz.className = 'pxd-platz'; platz.textContent = i + 1;
        const wer = document.createElement('span'); wer.className = 'pxd-wer'; wer.textContent = e.name;
        if (levelWort && e.level > 0) { const k = document.createElement('small'); k.textContent = levelWort + ' ' + e.level; wer.append(k); }
        const wie = document.createElement('span'); wie.className = 'pxd-wie'; wie.textContent = zahl(e.punkte);
        li.append(platz, wer, wie);
        if (e.freund) {
          const weg = document.createElement('button');
          weg.type = 'button'; weg.className = 'pxd-weg'; weg.textContent = '×';
          weg.setAttribute('aria-label', e.name + ' aus der Liste entfernen');
          weg.addEventListener('click', () => {
            daten.freunde = daten.freunde.filter(x => x !== e.freund);
            sichern();
            zeichne();
            el.zu.focus();
          });
          li.append(weg);
        } else {
          const leer = document.createElement('span'); leer.className = 'pxd-leer'; li.append(leer);
        }
        el.liste.append(li);
      });

      el.teilen.disabled = mein.punkte <= 0;
      el.status.textContent = mein.punkte <= 0 ? 'Spiel zuerst eine Runde' + (stufen ? ' auf dieser Stufe' : '') + ', dann kannst du dein Ergebnis teilen.' : '';
      el.link.hidden = true;
    }

    function oeffne() {
      if (!wurzel) baue();
      sichtStufe = stufeJetzt();
      el.name.value = daten.name;
      zeichne();
      vorher = document.activeElement;
      unterdrueckt = [...document.body.children].filter(n => n !== wurzel && n instanceof HTMLElement && !n.inert && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE');
      unterdrueckt.forEach(n => { n.inert = true; });
      wurzel.hidden = false;
      (el.teilen.disabled ? el.zu : el.teilen).focus({ preventScroll: true });
    }

    function schliesse() {
      if (!wurzel || wurzel.hidden) return;
      daten.name = reinerName(el.name.value);
      sichern();
      wurzel.hidden = true;
      unterdrueckt.forEach(n => { n.inert = false; });
      unterdrueckt = [];
      if (vorher && vorher.focus && document.contains(vorher)) { try { vorher.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
      if (cfg.beiZu) cfg.beiZu();
    }

    function linkFuer(st) {
      const mein = eigener(st);
      const t = new URLSearchParams({ name: daten.name || 'Ein Freund', punkte: mein.punkte });
      if (levelWort && mein.level > 0) t.set('level', mein.level);
      if (stufen) t.set('stufe', st);
      return cfg.adresse + '#' + t.toString();
    }

    async function teile() {
      const mein = eigener(sichtStufe);
      if (mein.punkte <= 0) return;
      daten.name = reinerName(el.name.value);
      sichern();
      const adresse = linkFuer(sichtStufe);
      const text = 'Ich habe ' + ergebnisText({ punkte: mein.punkte, level: mein.level, stufe: sichtStufe }) + ' in ' + spiel + '. Schaffst du mehr?';
      el.status.textContent = '';
      el.link.hidden = true;
      try {
        if (navigator.share) {
          await navigator.share({ title: spiel, text, url: adresse });
          el.status.textContent = 'Geteilt! Viel Glück.';
          return;
        }
        await navigator.clipboard.writeText(text + ' ' + adresse);
        el.status.textContent = 'Link kopiert! Füge ihn jetzt im Chat ein.';
      } catch (error) {
        if (error && error.name === 'AbortError') return;   // selbst abgebrochen
        el.link.value = adresse;
        el.link.hidden = false;
        el.link.focus();
        el.link.select();
        el.status.textContent = 'Kopiere diesen Link:';
      }
    }

    return {
      oeffne,
      schliesse,
      get istOffen() { return !!wurzel && !wurzel.hidden; },
      get offen() { return offen; },
      freunde,
      startText,
      endText,
      linkFuer,
    };
  }

  return { erstelle, reinerName };
})();
