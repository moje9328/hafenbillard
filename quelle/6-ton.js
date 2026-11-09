// ===================================================================
// 6 · TON
// Eigene kurze Geräusche mit Web Audio, keine Dateien. Startet erst nach
// einer Nutzeraktion und ist abschaltbar. Grundgerüst (Kontext, iPhone-
// Stummschalter, Hüllkurven) aus Sonnenrutsch übernommen. Höchstens
// MAX_STIMMEN Geräusche gleichzeitig; leise Berührungen bleiben stumm.
// ===================================================================

const Ton = (() => {
  let ctx = null, haupt = null, stummAudio = null;
  let an = true;

  // iPhone: Web-Audio ist bei aktivem Stumm-Schalter sonst stumm. „playback“ stellt die Audio-Sitzung wie bei
  // einem Musikplayer ein (Safari ab 16.4). Ältere iOS-Versionen: ein unhörbarer Dauerton über ein Audio-Element.
  function sitzung() {
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!ios) return;
      if (!stummAudio) {
        // 0,25 s Stille als WAV (8 kHz, 8 Bit)
        const n = 2000, b = new Uint8Array(44 + n);
        const w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
        const d = new DataView(b.buffer);
        w(0, 'RIFF'); d.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
        d.setUint32(24, 8000, true); d.setUint32(28, 8000, true); d.setUint16(32, 1, true); d.setUint16(34, 8, true); w(36, 'data'); d.setUint32(40, n, true);
        b.fill(128, 44);
        let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
        stummAudio = new Audio('data:audio/wav;base64,' + btoa(bin));
        stummAudio.loop = true; stummAudio.volume = 0.01;
        stummAudio.setAttribute('playsinline', '');
      }
      stummAudio.play().catch(() => {});
    } catch (e) { /* egal */ }
  }

  function wecke() {
    if (!an) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const komp = ctx.createDynamicsCompressor();
        komp.threshold.value = -16; komp.knee.value = 10; komp.ratio.value = 6;
        haupt = ctx.createGain();
        haupt.gain.value = 0.8;   // Handy-Lautsprecher sind leise: etwas mehr Grundlautstärke (der Kompressor fängt Spitzen ab)
        haupt.connect(komp).connect(ctx.destination);
      }
      // Auch „interrupted“ (iOS nach Anruf/Appwechsel) wieder aufwecken, nicht nur „suspended“
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      sitzung();
    } catch (e) { ctx = null; }
  }
  const bereit = () => an && ctx && ctx.state === 'running';

  function huelle(g, t, laut, dauer, anstieg = 0.005) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut), t + anstieg);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  }
  function ton(f1, f2, dauer, { typ = 'square', laut = 0.3, start = 0, anstieg } = {}) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = typ;
    osc.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dauer);
    huelle(g, t, laut, dauer, anstieg);
    osc.connect(g).connect(haupt);
    osc.start(t); osc.stop(t + dauer + 0.03);
  }

  const v = () => 1 + (Math.random() * 2 - 1) * 0.05;

  // Begrenzung gleichzeitiger Geräusche
  const MAX_STIMMEN = 7;
  let stimmenEnde = [];
  function frei(dauer) {
    const t = ctx.currentTime;
    stimmenEnde = stimmenEnde.filter(e => e > t);
    if (stimmenEnde.length >= MAX_STIMMEN) return false;
    stimmenEnde.push(t + dauer);
    return true;
  }
  // Kurzer, gefilterter Klick (Holz/Phenolharz) – ohne Rauschen, aus zwei Sinus-Anteilen
  function klack(f, laut, dauer, start = 0) {
    ton(f * v(), f * 0.82, dauer, { typ: 'sine', laut, start, anstieg: 0.002 });
    ton(f * 2.7 * v(), f * 2.2, dauer * 0.5, { typ: 'triangle', laut: laut * 0.35, start, anstieg: 0.001 });
  }
  let letzteKugel = 0;

  return {
    wecke,
    istAn: () => an,
    status: () => ({ kontext: ctx ? ctx.state : 'keiner', an, stimmen: stimmenEnde.length }),   // für Tests
    setze(wert) {
      an = !!wert;
      // Beim Laden (noch keine Berührung) wird kein Audiokontext erzeugt: Ton startet erst nach Nutzeraktion
      if (an) { if (ctx || !navigator.userActivation || navigator.userActivation.hasBeenActive) wecke(); }
      else { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); if (stummAudio) stummAudio.pause(); }
    },
    // Queue trifft die Weiße
    queue(staerke) {
      if (!bereit() || !frei(0.12)) return;
      const s = Math.max(0.05, Math.min(1, staerke));
      klack(900 + s * 500, 0.08 + s * 0.22, 0.07);
      ton(140, 90, 0.08, { typ: 'sine', laut: 0.05 + s * 0.12 });
    },
    // Kugel trifft Kugel: Lautstärke nach Aufprallgeschwindigkeit (mm/s)
    kugel(tempo) {
      if (!bereit() || tempo < 40) return;           // ruhende/zarte Berührungen bleiben stumm
      const t = ctx.currentTime;
      if (t - letzteKugel < 0.018) return;           // nicht zehn Klicks im selben Augenblick
      if (!frei(0.08)) return;
      letzteKugel = t;
      const s = Math.min(1, tempo / 4500);
      klack(1900 + s * 900, 0.03 + Math.pow(s, 0.7) * 0.3, 0.05 + s * 0.03);
    },
    // Bande: gedämpfter, tiefer Klang
    bande(tempo) {
      if (!bereit() || tempo < 80 || !frei(0.12)) return;
      const s = Math.min(1, tempo / 4000);
      ton(120 * v(), 70, 0.11, { typ: 'sine', laut: 0.04 + s * 0.22 });
      ton(260 * v(), 180, 0.05, { typ: 'triangle', laut: 0.02 + s * 0.05 });
    },
    // Tasche: Plumps und kurzes Nachrollen
    tasche() {
      if (!bereit() || !frei(0.5)) return;
      ton(180, 90, 0.14, { typ: 'sine', laut: 0.28 });
      ton(520, 300, 0.06, { typ: 'triangle', laut: 0.06, start: 0.02 });
      [0.12, 0.2, 0.27, 0.33].forEach((st, i) => ton(240 - i * 25, 200 - i * 25, 0.05, { typ: 'sine', laut: 0.08 - i * 0.015, start: st }));
    },
    klick() { if (bereit() && frei(0.05)) ton(660, 660, 0.04, { typ: 'square', laut: 0.04 }); },
    // Ablegen der Weißen
    ablegen() { if (bereit() && frei(0.1)) ton(330, 240, 0.08, { typ: 'sine', laut: 0.12 }); },
    // Foul: freundlich-verdutztes „Hm-hm“
    foul() {
      if (!bereit()) return;
      ton(392, 370, 0.16, { typ: 'triangle', laut: 0.13 });
      ton(311, 294, 0.24, { typ: 'triangle', laut: 0.13, start: 0.17 });
    },
    // Wechsel: kleines Signal
    wechsel() { if (bereit()) { ton(587, 587, 0.08, { typ: 'triangle', laut: 0.08 }); ton(784, 784, 0.1, { typ: 'triangle', laut: 0.08, start: 0.08 }); } },
    // Kleine Siegesfanfare in Dur
    sieg() {
      if (!bereit()) return;
      const noten = [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32], [880, 0.46], [1047, 0.56], [1319, 0.68]];
      noten.forEach(([f, st], i) => {
        const lang = i === noten.length - 1 ? 0.5 : 0.11;
        ton(f, f, lang, { typ: 'triangle', laut: 0.22, start: st });
        ton(f / 2, f / 2, lang, { typ: 'square', laut: 0.03, start: st });
      });
    },
    niederlage() {
      if (!bereit()) return;
      ton(392, 370, 0.3, { typ: 'triangle', laut: 0.18 });
      ton(330, 247, 0.6, { typ: 'triangle', laut: 0.18, start: 0.3 });
    },
  };
})();
