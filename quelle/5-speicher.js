// ===================================================================
// 5 · SPEICHER
// Einstellungen und Siege lokal unter pixelhafen.hafenbillard (Version 1).
// Ohne localStorage (privates Fenster, gesperrt) läuft alles weiter,
// es wird dann nur nichts gemerkt.
// ===================================================================

const Speicher = (() => {
  const SCHLUESSEL = 'pixelhafen.hafenbillard';
  const STANDARD = () => ({ v: 1, ton: true, stufe: 'entspannt', modus: 'computer', hilfe: true, siege: { entspannt: 0, herausfordernd: 0 }, partien: 0 });
  let daten = STANDARD();

  function lager() { try { return window.localStorage || null; } catch (e) { return null; } }
  function lade() {
    try {
      const roh = lager() && lager().getItem(SCHLUESSEL);
      if (!roh) return;
      const d = JSON.parse(roh);
      if (!d || d.v !== 1) return;
      const s = STANDARD();
      daten = {
        v: 1,
        ton: typeof d.ton === 'boolean' ? d.ton : s.ton,
        stufe: COMPUTER_STUFEN[d.stufe] ? d.stufe : s.stufe,
        modus: ['computer', 'zweier', 'training'].includes(d.modus) ? d.modus : s.modus,
        hilfe: typeof d.hilfe === 'boolean' ? d.hilfe : s.hilfe,
        siege: {
          entspannt: Math.max(0, Math.floor(Number(d.siege && d.siege.entspannt) || 0)),
          herausfordernd: Math.max(0, Math.floor(Number(d.siege && d.siege.herausfordernd) || 0)),
        },
        partien: Math.max(0, Math.floor(Number(d.partien) || 0)),
      };
    } catch (e) { daten = STANDARD(); }
  }
  function sichere() {
    try { const l = lager(); if (l) l.setItem(SCHLUESSEL, JSON.stringify(daten)); } catch (e) { /* voll oder gesperrt: egal */ }
  }
  lade();

  return {
    get ton() { return daten.ton; }, set ton(w) { daten.ton = !!w; sichere(); },
    get stufe() { return daten.stufe; }, set stufe(w) { if (COMPUTER_STUFEN[w]) { daten.stufe = w; sichere(); } },
    get modus() { return daten.modus; }, set modus(w) { daten.modus = w; sichere(); },
    get hilfe() { return daten.hilfe; }, set hilfe(w) { daten.hilfe = !!w; sichere(); },
    siege: stufe => daten.siege[stufe] || 0,
    sieg(stufe) { daten.siege[stufe] = (daten.siege[stufe] || 0) + 1; sichere(); },
    partie() { daten.partien++; sichere(); },
    neuLaden: lade,
  };
})();
