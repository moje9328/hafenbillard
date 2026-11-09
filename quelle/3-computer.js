// ===================================================================
// 3 · COMPUTERGEGNER
// Fair: Er sieht nur den Tisch, wählt Ziel, Tasche, Winkel und Stärke
// und stößt dann über dieselbe Physik wie ein Mensch. Zum Planen rechnet
// er Kandidaten auf einer KOPIE des Tisches durch (wie ein Mensch, der
// sich den Stoß vorstellt). Danach kommt eine Ungenauigkeit je Stufe
// dazu. Keine Bahnkorrektur, kein Verschieben, kein garantierter Treffer.
//
// Die Planung läuft als Generator in kleinen Zeitscheiben, damit die
// Oberfläche nie einfriert, und hat feste Obergrenzen.
// ===================================================================

const COMPUTER_STUFEN = {
  entspannt: {
    name: 'Entspannt',
    kandidaten: 6,           // wie viele Lochchancen genauer durchgerechnet werden
    staerken: 2,
    robust: 0,               // Zusatzsimulationen mit leicht verfehltem Winkel
    stellung: false,         // denkt nicht an die nächste Position der Weißen
    winkelFehler: 1.15,      // Grad (Standardabweichung)
    staerkeFehler: 0.09,
    auswahlStreuung: 0.35,   // wählt nicht immer den besten Stoß
    sicherheit: false,       // spielt selten bewusst auf Sicherheit
    maxSimulationen: 26,
  },
  herausfordernd: {
    name: 'Herausfordernd',
    kandidaten: 14,
    staerken: 3,
    robust: 2,
    stellung: true,
    winkelFehler: 0.22,
    staerkeFehler: 0.035,
    auswahlStreuung: 0,
    sicherheit: true,
    maxSimulationen: 90,
  },
};

const Computer = (() => {
  const R = TISCH.R;
  const grad = Math.PI / 180;

  function gauss(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Geschwindigkeit, mit der eine Kugel ungefähr s mm weit rollt
  function tempoFuerWeg(s) {
    let lo = 0, hi = PHYSIK.V_MAX * 1.2;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (rollWeg(m) < s) lo = m; else hi = m;
    }
    return hi;
  }
  function rollWeg(v) {
    const c = PHYSIK.ROLL_KONST, k = PHYSIK.ROLL_LINEAR;
    return v / k - c / (k * k) * Math.log(1 + k * v / c);
  }

  // Zielpunkt in der Tasche: etwas hinter der Kehlenmitte
  const taschenZiel = t => ({ x: t.kehle.x + t.achse.x * 6, y: t.kehle.y + t.achse.y * 6 });

  // Direkte Lochchance prüfen: Weiße bei w, Objektkugel b, Tasche t
  function lochChance(kugeln, w, b, t) {
    const z = taschenZiel(t);
    let dx = z.x - b.x, dy = z.y - b.y;
    const dObj = Math.hypot(dx, dy);
    dx /= dObj; dy /= dObj;
    // Weg der Objektkugel frei? (dieselbe Geometrie wie die Physik)
    const bahn = wirfStrahl(kugeln, b.x, b.y, dx, dy, [b.nr, 0]);
    if (bahn.art !== 'tasche' || bahn.tasche !== t.nr) return null;
    const gx = b.x - dx * 2 * R, gy = b.y - dy * 2 * R;
    let ux = gx - w.x, uy = gy - w.y;
    const dWeiss = Math.hypot(ux, uy);
    if (dWeiss < 1) return null;
    ux /= dWeiss; uy /= dWeiss;
    const schnitt = Math.acos(Math.max(-1, Math.min(1, ux * dx + uy * dy)));
    if (schnitt > 80 * grad) return null;
    const weg = wirfStrahl(kugeln, w.x, w.y, ux, uy, [0]);
    if (weg.art !== 'kugel' || weg.kugel !== b.nr || Math.hypot(weg.x - gx, weg.y - gy) > 1.5) return null;
    // grobe Schwierigkeit: dünne Schnitte und lange Wege sind schwerer, Mitteltaschen mögen keine steilen Winkel
    const einlauf = Math.acos(Math.max(-1, Math.min(1, dx * t.achse.x + dy * t.achse.y)));
    const einlaufStrafe = t.art === 'mitte' ? Math.max(0, einlauf - 25 * grad) * 2 : Math.max(0, einlauf - 30 * grad);
    const guete = Math.cos(schnitt) * 1.2 - (dWeiss + dObj) / 4000 - einlaufStrafe - schnitt * 0.25;
    return { kugel: b.nr, tasche: t.nr, winkel: Math.atan2(uy, ux), schnitt, dWeiss, dObj, guete };
  }

  // Stärke so wählen, dass die Objektkugel die Tasche sicher erreicht
  function staerkeVorschlaege(c, anzahl) {
    const vObj = tempoFuerWeg(c.dObj + 150);
    const anteil = Math.max(0.12, Math.cos(c.schnitt) * (1 + PHYSIK.E_KUGEL) / 2);
    const vKontakt = vObj / anteil;
    // Weiße muss mit vKontakt ankommen: rollt dWeiss weit → Startgeschwindigkeit grob
    const v0 = tempoFuerWeg(rollWeg(vKontakt) + c.dWeiss);
    const basis = tempoZuStaerke(v0);
    const faktoren = anzahl >= 3 ? [1, 1.25, 1.6] : anzahl === 2 ? [1.1, 1.5] : [1.25];
    return faktoren.map(f => Math.min(1, Math.max(0.04, basis * f)));
  }

  function alleKugelnAufTisch(kugeln) { return new Set(kugeln.filter(k => k.aufTisch).map(k => k.nr)); }

  // Einen Stoß auf einer Kopie durchrechnen und mit den echten Regeln bewerten
  function probiere(lage, kugeln, winkel, staerke, tasche) {
    const kopie = Physik.kopie(kugeln);
    Physik.stoss(kopie, winkel, staerkeZuTempo(staerke));
    const prot = new Stossprotokoll();
    const ereignisse = Physik.simuliere(kopie, 14);
    for (const e of ereignisse) prot.ereignis(e);
    if (lage.modus === 'training') {
      const tr = werteTrainingAus(prot);
      return { kopie, prot, erg: { foul: tr.ballInHand ? 'weisse' : null, weiter: tr.gefallen > 0, ende: null } };
    }
    const erg = werteStossAus({ amZug: 0, gruppen: [lage.gruppe, lage.gruppe ? (lage.gruppe === 'voll' ? 'halb' : 'voll') : null], anstoss: false, angesagt: tasche, aufTisch: alleKugelnAufTisch(kugeln) }, prot);
    return { kopie, prot, erg };
  }

  // Wie viele direkte Chancen hätte eine Seite von dieser Lage aus? (für Stellungsspiel und Sicherheit)
  function chancenZahl(kugeln, gruppe) {
    const w = kugeln.find(k => k.nr === 0 && k.aufTisch);
    if (!w) return { n: 3, beste: 1 };   // Weiße weg: Gegner hätte Ball in Hand
    const aufTisch = alleKugelnAufTisch(kugeln);
    const ziele = erlaubteZiele(gruppe, aufTisch);
    let n = 0, beste = -9;
    for (const nr of ziele) {
      const b = kugeln.find(k => k.nr === nr);
      for (const t of TISCH.taschen) {
        const c = lochChance(kugeln, w, b, t);
        if (c) { n++; beste = Math.max(beste, c.guete); }
      }
    }
    return { n, beste };
  }

  const andere = g => g === 'voll' ? 'halb' : g === 'halb' ? 'voll' : null;

  // ---------- Planer ----------
  // lage: { kugeln, gruppe, anstoss, ballInHand: null|'tisch'|'kopffeld', modus }
  function* planeSchritte(lage, stufe, rnd, ergebnis) {
    const S = COMPUTER_STUFEN[stufe] || COMPUTER_STUFEN.entspannt;
    const kugeln = Physik.kopie(lage.kugeln);
    const aufTisch = alleKugelnAufTisch(kugeln);
    let sims = 0;

    // Anstoß: Weiße ins Kopffeld, voll auf die Spitze
    if (lage.anstoss) {
      const y = (rnd() * 2 - 1) * 160;
      const w0 = kugeln.find(k => k.nr === 0);
      // Weiße schon abgelegt? Dann von dort, sonst einen Platz im Kopffeld wählen
      const pos = !lage.ballInHand && w0 && w0.aufTisch ? { x: w0.x, y: w0.y } : naechsterFreierPlatz(kugeln, TISCH.kopfX - 30, y, { ohne: 0, nurKopffeld: true });
      const spitze = kugeln.filter(k => k.aufTisch && k.nr !== 0).sort((a, b) => a.x - b.x)[0];
      const winkel = Math.atan2(spitze.y - pos.y, spitze.x - pos.x);
      Object.assign(ergebnis, { art: 'anstoss', weiss: lage.ballInHand ? pos : null, winkel, staerke: stufe === 'herausfordernd' ? 1 : 0.9, tasche: null });
      return;
    }

    const ziele = lage.modus === 'training' ? [...aufTisch].filter(n => n !== 0) : erlaubteZiele(lage.gruppe, aufTisch);
    const aufAcht = lage.modus !== 'training' && ziele.length === 1 && ziele[0] === 8;
    const weissPositionen = [];
    const weiss = kugeln.find(k => k.nr === 0);
    let chancen = [];

    if (lage.ballInHand) {
      // Für jedes Paar aus Kugel und Tasche ein paar Plätze hinter dem Geisterball prüfen
      const nurKopffeld = lage.ballInHand === 'kopffeld';
      for (const nr of ziele) {
        const b = kugeln.find(k => k.nr === nr);
        if (!b || !b.aufTisch) continue;
        for (const t of TISCH.taschen) {
          const z = taschenZiel(t);
          let dx = z.x - b.x, dy = z.y - b.y; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
          let beste = null;
          for (const abst of [170, 340]) for (const dreh of [0, -20, 20]) {
            const w = dreh * grad;
            const ex = dx * Math.cos(w) - dy * Math.sin(w), ey = dx * Math.sin(w) + dy * Math.cos(w);
            const pos = { x: b.x - dx * 2 * R - ex * abst, y: b.y - dy * 2 * R - ey * abst };
            if (!platzGueltig(kugeln, pos.x, pos.y, { ohne: 0, nurKopffeld })) continue;
            const c = lochChance(kugeln, pos, b, t);
            if (c && (!beste || c.guete > beste.guete)) { c.weiss = pos; beste = c; }
          }
          if (beste) chancen.push(beste);
        }
        yield;
      }
      const notPlatz = naechsterFreierPlatz(kugeln, TISCH.kopfX - 100, 0, { ohne: 0, nurKopffeld });
      weissPositionen.push(chancen.length ? chancen.slice().sort((a, b) => b.guete - a.guete)[0].weiss : notPlatz);
    } else {
      weissPositionen.push({ x: weiss.x, y: weiss.y });
      for (const nr of ziele) {
        const b = kugeln.find(k => k.nr === nr);
        if (!b || !b.aufTisch) continue;
        for (const t of TISCH.taschen) {
          const c = lochChance(kugeln, weissPositionen[0], b, t);
          if (c) { c.weiss = weissPositionen[0]; chancen.push(c); }
        }
      }
    }
    yield;

    chancen.sort((a, b) => b.guete - a.guete);
    // bei Ball in Hand: pro Ziel/Tasche nur den besten Platz behalten
    const gesehen = new Set();
    chancen = chancen.filter(c => { const s = c.kugel + '-' + c.tasche; if (gesehen.has(s)) return false; gesehen.add(s); return true; });
    chancen = chancen.slice(0, S.kandidaten);
    yield;

    // Kandidaten mit der echten Physik durchrechnen
    const bewertet = [];
    for (const c of chancen) {
      for (const st of staerkeVorschlaege(c, S.staerken)) {
        if (sims >= S.maxSimulationen) break;
        const welt = Physik.kopie(kugeln);
        const w0 = welt.find(k => k.nr === 0);
        w0.x = c.weiss.x; w0.y = c.weiss.y; w0.aufTisch = true;
        const r = probiere(lage, welt, c.winkel, st, aufAcht ? c.tasche : null);
        sims++;
        const versenktZiel = r.prot.versenkt.some(v => v.nr === c.kugel);
        let wert = -1;
        if (!r.erg.foul && (r.erg.weiter || (r.erg.ende && r.erg.ende.sieger === 0)) && versenktZiel) {
          wert = 1 + c.guete * 0.3;
          if (r.erg.ende && r.erg.ende.sieger === 0) wert += 5;
          else if (S.stellung) {
            const g = r.erg.gruppen ? r.erg.gruppen[0] : lage.gruppe;
            const nach = chancenZahl(r.kopie, lage.modus === 'training' ? null : g);
            wert += Math.min(3, nach.n) * 0.25 + Math.max(0, nach.beste) * 0.3;
          }
          // Robustheit: kleine Winkelfehler durchprobieren
          let treffer = 1, versuche = 1;
          for (let i = 0; i < S.robust && sims < S.maxSimulationen; i++) {
            const welt2 = Physik.kopie(kugeln);
            const w2 = welt2.find(k => k.nr === 0); w2.x = c.weiss.x; w2.y = c.weiss.y; w2.aufTisch = true;
            const abw = (i % 2 ? 1 : -1) * S.winkelFehler * 1.2 * grad;
            const r2 = probiere(lage, welt2, c.winkel + abw, st, aufAcht ? c.tasche : null);
            sims++; versuche++;
            if (!r2.erg.foul && r2.prot.versenkt.some(v => v.nr === c.kugel) && !(r2.erg.ende && r2.erg.ende.sieger !== 0)) treffer++;
          }
          wert *= treffer / versuche;
        } else if (r.erg.ende && r.erg.ende.sieger !== 0) wert = -10;
        else if (r.erg.foul) wert = -2;
        else wert = -0.5;
        bewertet.push({ ...c, staerke: st, wert, art: 'loch' });
        yield;
      }
    }

    // Sicherheit oder Notlösung, wenn keine gute Lochchance
    const besteLoch = bewertet.reduce((m, b) => b.wert > m ? b.wert : m, -Infinity);
    if (besteLoch < 0.6 && sims < S.maxSimulationen + 30) {
      const wp = weissPositionen[0];
      const versuche = [];
      for (const nr of ziele) {
        const b = kugeln.find(k => k.nr === nr);
        if (!b || !b.aufTisch) continue;
        const basis = Math.atan2(b.y - wp.y, b.x - wp.x);
        const dist = Math.hypot(b.x - wp.x, b.y - wp.y);
        const breite = Math.asin(Math.min(1, 1.6 * R / Math.max(dist, 2 * R + 1)));
        for (const off of [0, -0.6, 0.6]) versuche.push({ kugel: nr, winkel: basis + off * breite, dist });
        // über eine Bande (Spiegelung an den vier Bandenlinien)
        for (const [mx, my] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const sx = mx ? mx * (TISCH.X - R) : null, sy = my ? my * (TISCH.Y - R) : null;
          const zx = sx !== null ? 2 * sx - b.x : b.x, zy = sy !== null ? 2 * sy - b.y : b.y;
          versuche.push({ kugel: nr, winkel: Math.atan2(zy - wp.y, zx - wp.x), dist: Math.hypot(zx - wp.x, zy - wp.y), bande: true });
        }
      }
      // direkte, freie Treffer zuerst
      for (const v of versuche) {
        const s = wirfStrahl(kugeln, wp.x, wp.y, Math.cos(v.winkel), Math.sin(v.winkel), [0]);
        v.frei = s.art === 'kugel' && s.kugel === v.kugel;
      }
      versuche.sort((a, b) => (b.frei - a.frei) || (a.dist - b.dist));
      const grenze = S.sicherheit ? 16 : 8;
      for (const v of versuche.slice(0, grenze)) {
        for (const anteil of [0.45, 0.75]) {
          const st = Math.min(1, tempoZuStaerke(tempoFuerWeg(v.dist + 500 + anteil * 900)));
          const welt = Physik.kopie(kugeln);
          const w0 = welt.find(k => k.nr === 0); w0.x = wp.x; w0.y = wp.y; w0.aufTisch = true;
          const r = probiere(lage, welt, v.winkel, st, null);
          sims++;
          let wert;
          if (r.erg.ende) wert = r.erg.ende.sieger === 0 ? 4 : -10;
          else if (r.erg.foul) wert = -2;
          else if (r.erg.weiter) wert = 0.9;
          else {
            wert = 0.2;
            if (S.sicherheit && lage.modus !== 'training') {
              const gegnerGruppe = r.erg.gruppen ? r.erg.gruppen[1] : andere(lage.gruppe);
              const gegner = chancenZahl(r.kopie, gegnerGruppe);
              wert += 0.5 - Math.min(4, gegner.n) * 0.12 - Math.max(0, gegner.beste) * 0.2;
            }
          }
          bewertet.push({ kugel: v.kugel, tasche: null, winkel: v.winkel, staerke: st, wert, art: 'sicher', weiss: wp });
          yield;
        }
      }
    }

    if (!bewertet.length) {
      // gar nichts gefunden: auf die nächste erlaubte Kugel
      const wp = weissPositionen[0];
      const b = ziele.map(nr => kugeln.find(k => k.nr === nr)).filter(Boolean)[0];
      bewertet.push({ kugel: b.nr, tasche: null, winkel: Math.atan2(b.y - wp.y, b.x - wp.x), staerke: 0.5, wert: -3, art: 'sicher', weiss: wp });
    }

    bewertet.sort((a, b) => b.wert - a.wert);
    let wahl = bewertet[0];
    if (S.auswahlStreuung > 0 && bewertet.length > 1 && rnd() < S.auswahlStreuung) {
      const gute = bewertet.filter(b => b.wert > -1).slice(0, 3);
      if (gute.length) wahl = gute[Math.floor(rnd() * gute.length)];
    }
    // Für die Acht muss eine Tasche angesagt werden
    let tasche = wahl.tasche;
    if (aufAcht && tasche === null) {
      // Sicherheitsstoß auf die Acht: die Tasche ansagen, die ihr am nächsten liegt
      const acht = kugeln.find(k => k.nr === 8);
      tasche = TISCH.taschen.reduce((m, t) => Math.hypot(t.kehle.x - acht.x, t.kehle.y - acht.y) < Math.hypot(m.kehle.x - acht.x, m.kehle.y - acht.y) ? t : m).nr;
    }
    Object.assign(ergebnis, {
      art: wahl.art, weiss: lage.ballInHand ? wahl.weiss : null, winkel: wahl.winkel, staerke: wahl.staerke,
      tasche: aufAcht ? tasche : null, kugel: wahl.kugel, wert: wahl.wert, simulationen: sims,
    });
  }

  return {
    // Erstellt einen Planer. arbeite(ms) rechnet höchstens ms Millisekunden und gibt true zurück, wenn fertig.
    planer(lage, stufe, rnd = Math.random) {
      const ergebnis = {};
      const gen = planeSchritte(lage, stufe, rnd, ergebnis);
      let fertig = false;
      return {
        ergebnis,
        get fertig() { return fertig; },
        arbeite(ms = 6) {
          if (fertig) return true;
          const ende = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + ms;
          while (!fertig) {
            if (gen.next().done) fertig = true;
            if ((typeof performance !== 'undefined' ? performance.now() : Date.now()) > ende) break;
          }
          return fertig;
        },
      };
    },
    // Menschliche Ungenauigkeit auf den geplanten Stoß
    ungenau(plan, stufe, rnd = Math.random) {
      const S = COMPUTER_STUFEN[stufe] || COMPUTER_STUFEN.entspannt;
      return {
        ...plan,
        winkel: plan.winkel + gauss(rnd) * S.winkelFehler * grad,
        staerke: Math.min(1, Math.max(0.02, plan.staerke * (1 + gauss(rnd) * S.staerkeFehler))),
      };
    },
    lochChance, tempoFuerWeg, rollWeg,
  };
})();
