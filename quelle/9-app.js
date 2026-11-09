// ===================================================================
// 9 · APP
// Spielzustände, EIN Game Loop, Stoßablauf, Auswertung nach Stillstand,
// Computerzüge, Menüs und Einstellungen.
//
// Zustände (data-zustand am <html>):
//   menue · platzieren · zielen · stoss · rollen · computer · uebergabe · anstossWahl · ende
// Pause ist ein eigener Schalter: Physik und Computer rechnen dann nicht.
// ===================================================================

(() => {
  const $ = id => document.getElementById(id);
  const wurzel = document.documentElement;
  const leinwand = $('bild');
  const c = leinwand.getContext('2d');
  const bewegungArm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Nur für automatische Tests: ?tempo=8 lässt Zeit schneller laufen (gleiche Physik, mehr Schritte pro Bild)
  const TEMPO = (() => { const t = Number(new URLSearchParams(location.search).get('tempo')); return t >= 1 && t <= 50 ? t : 1; })();
  const GRAD = Math.PI / 180;

  // ---------- Spielstand ----------
  let zustand = 'menue';
  let pausiert = false;
  let spiel = null;          // aktuelle Partie
  let zeit = 0;              // Spielzeit (läuft in Pause nicht)
  let rnd = Math.random;
  const ui = { staerke: 0.4, winkel: 0 };
  let anim = null;           // Stoßanimation
  let ki = null;             // Computerzug
  let platzZiehen = false;
  let meldungTimer = null;
  let krabbe = { mund: 'lachen', bis: 0, art: null };
  let auswertungSperre = false;

  const NAMEN = { computer: ['Du', 'Computer'], zweier: ['Spieler 1', 'Spieler 2'], training: ['Training', ''] };
  const name = i => NAMEN[spiel.modus][i];
  const istComputerZug = () => spiel && spiel.modus === 'computer' && spiel.amZug === 1;
  const menschZielt = () => zustand === 'zielen' && !pausiert && !istComputerZug();

  function setzeZustand(z) {
    zustand = z;
    wurzel.dataset.zustand = z;
    aktualisiereBedienung();
  }

  // ---------- Partie ----------
  function neuePartie(modus, anstosser = 0) {
    abbrechenAlles();
    spiel = {
      modus,
      stufe: Speicher.stufe,
      kugeln: baueDreieck(rnd),
      amZug: anstosser,
      gruppen: [null, null],
      anstoss: modus !== 'training',
      anstossVon: anstosser,
      angesagt: null,
      ballInHand: modus === 'training' ? null : 'kopffeld',
      platz: null,
      protokoll: null,
      aufTischVorher: null,
      stoesse: [0, 0], fouls: [0, 0], versenkt: [0, 0],
      uebung: 'frei',
    };
    wurzel.dataset.modus = modus;
    ui.winkel = 0;
    $('uebungWahl').value = 'frei';
    if (modus === 'training') zeigeMeldung('Training: Alle Kugeln sind frei. Viel Spaß!', 'gut', 2600);
    aktualisiereKopf();
    beginneZug();
  }

  function trainingAufbau(art) {
    abbrechenAlles();
    spiel.uebung = art;
    spiel.kugeln = art === 'frei' ? baueDreieck(rnd) : UEBUNGEN[art].baue();
    spiel.ballInHand = null; spiel.angesagt = null; spiel.platz = null;
    if (art !== 'frei') zeigeMeldung(UEBUNGEN[art].text, 'gut', 4200);
    beginneZug();
  }

  // Alles Laufende (Animation, Computerplanung, Ziehen) sauber beenden
  function abbrechenAlles() {
    anim = null; ki = null; platzZiehen = false; auswertungSperre = false;
    if (eingabe) eingabe.loslassen();
  }

  function aufTischSet() { return new Set(spiel.kugeln.filter(k => k.aufTisch).map(k => k.nr)); }
  function weisse() { return spiel.kugeln.find(k => k.nr === 0); }
  function mussAnsagen() {
    return spiel.modus !== 'training' && !spiel.anstoss && spieltAufAcht(spiel.gruppen[spiel.amZug], aufTischSet());
  }
  function ziele() {
    if (spiel.modus === 'training') return [...aufTischSet()].filter(n => n !== 0);
    return erlaubteZiele(spiel.gruppen[spiel.amZug], aufTischSet(), spiel.anstoss);
  }

  function beginneZug() {
    spiel.angesagt = null;
    aktualisiereKopf();
    const w = weisse();
    if (spiel.ballInHand || !w.aufTisch) {
      if (!spiel.ballInHand) spiel.ballInHand = 'tisch';
      const nurKopffeld = spiel.ballInHand === 'kopffeld';
      const wunsch = w.aufTisch ? { x: w.x, y: w.y } : (nurKopffeld ? { x: TISCH.kopfX - 60, y: 0 } : { x: TISCH.kopfX, y: 0 });
      const p = naechsterFreierPlatz(spiel.kugeln, wunsch.x, wunsch.y, { ohne: 0, nurKopffeld });
      spiel.platz = { x: p.x, y: p.y, gueltig: true };
    } else spiel.platz = null;
    if (istComputerZug()) { starteComputer(); return; }
    if (spiel.platz) setzeZustand('platzieren');
    else { zielAufNaechstes(); setzeZustand('zielen'); }
  }

  // Queue zu Beginn auf die nächste erlaubte Kugel richten (bequemer Startpunkt)
  function zielAufNaechstes() {
    const w = weisse(); if (!w.aufTisch) return;
    let best = null, bd = Infinity;
    for (const nr of ziele()) {
      const k = spiel.kugeln.find(b => b.nr === nr && b.aufTisch); if (!k) continue;
      const d = Math.hypot(k.x - w.x, k.y - w.y);
      if (d < bd) { bd = d; best = k; }
    }
    if (best) ui.winkel = Math.atan2(best.y - w.y, best.x - w.x);
  }

  // ---------- Platzieren (Ball in Hand) ----------
  function setzePlatz(x, y) {
    const nurKopffeld = spiel.ballInHand === 'kopffeld';
    spiel.platz = { x, y, gueltig: platzGueltig(spiel.kugeln, x, y, { ohne: 0, nurKopffeld }) };
    aktualisiereBedienung();
  }
  function bestaetigePlatz() {
    if (zustand !== 'platzieren' || pausiert || !spiel.platz || !spiel.platz.gueltig) return false;
    const w = weisse();
    Object.assign(w, { x: spiel.platz.x, y: spiel.platz.y, vx: 0, vy: 0, aufTisch: true, fall: null });
    spiel.platz = null;
    spiel.ballInHand = spiel.anstoss ? 'kopffeld-gelegt' : null;
    Ton.ablegen();
    zielAufNaechstes();
    setzeZustand('zielen');
    return true;
  }

  // ---------- Stoß ----------
  function stossErlaubt() {
    if (!menschZielt()) return false;
    if (!weisse().aufTisch) return false;
    if (mussAnsagen() && spiel.angesagt === null) return false;
    return true;
  }
  function stoss() {
    if (zustand === 'platzieren') { bestaetigePlatz(); return; }
    if (!stossErlaubt()) return;
    starteStoss(ui.winkel, ui.staerke);
  }
  function starteStoss(winkel, staerke) {
    if (zustand === 'stoss' || zustand === 'rollen') return;   // nie zwei Stöße gleichzeitig
    ui.winkel = winkel; ui.staerke = staerke;
    const zurueck = 10 + staerke * 150;
    anim = { t: 0, dauer: bewegungArm() ? 0.04 : 0.07 + staerke * 0.06, von: zurueck, winkel, staerke };
    setzeZustand('stoss');
  }
  // Wird im Loop aufgerufen; der Impuls kommt genau in dem Bild, in dem der Queue die Weiße berührt
  function stossKontakt() {
    const { winkel, staerke } = anim;
    anim = null;
    spiel.protokoll = new Stossprotokoll();
    spiel.aufTischVorher = aufTischSet();
    spiel.stoesse[spiel.amZug]++;
    spiel.rollZeit = 0;
    Physik.stoss(spiel.kugeln, winkel, staerkeZuTempo(staerke));
    Ton.queue(staerke);
    setzeZustand('rollen');
  }

  function physikEreignis(e) {
    spiel.protokoll.ereignis(e);
    if (e.typ === 'kugel') Ton.kugel(e.staerke);
    else if (e.typ === 'bande') Ton.bande(e.staerke);
    else if (e.typ === 'tasche') Ton.tasche();
  }

  // ---------- Auswertung (erst wenn alles ruht) ----------
  function auswerten() {
    if (auswertungSperre) return;
    auswertungSperre = true;
    const p = spiel.protokoll;
    const ich = spiel.amZug;
    for (const k of spiel.kugeln) if (k.fall) k.fall = null;   // Einrollanimation fertig: raus aus allem

    if (spiel.modus === 'training') {
      const t = werteTrainingAus(p);
      if (t.gefallen) { reagiere('jubel'); spiel.versenkt[0] += t.gefallen; }
      if (t.ballInHand) { reagiere('verdutzt'); spiel.ballInHand = 'tisch'; }
      if (t.meldung) zeigeMeldung(t.meldung, t.ballInHand ? 'foul' : 'gut');
      auswertungSperre = false;
      beginneZug();
      return;
    }

    const erg = werteStossAus({ amZug: ich, gruppen: spiel.gruppen, anstoss: spiel.anstoss, angesagt: spiel.angesagt, aufTisch: spiel.aufTischVorher }, p);
    spiel.letztesErgebnis = erg;
    const eigene = p.versenkt.filter(v => v.nr !== 0 && v.nr !== 8).length;
    spiel.versenkt[ich] += eigene;

    if (erg.ende) { auswertungSperre = false; beendePartie(erg.ende); return; }

    if (erg.neuAufbauWahl) {
      spiel.fouls[ich]++;
      reagiere('verdutzt'); Ton.foul();
      const du = 1 - ich;
      if (erg.achtEinsetzen) setzeAchtEin(spiel.kugeln);
      auswertungSperre = false;
      if (spiel.modus === 'computer' && du === 1) {
        zeigeMeldung(erg.foulText + ' Der Computer baut neu auf und stößt selbst an.', 'foul', 4200);
        neuePartieBehalten(du);
      } else {
        $('anstossGrund').textContent = erg.foulText;
        $('anstossFrage').textContent = `${name(du)} darf wählen: neu aufbauen und selbst anstoßen oder den Tisch so übernehmen${erg.ballInHand ? ' (mit Ball in Hand, weil die Weiße gefallen ist)' : ''}.`;
        spiel.wahlFuer = du;
        spiel.wahlBallInHand = erg.ballInHand;
        setzeZustand('anstossWahl');
        zeigeFenster('fAnstossWahl');
      }
      return;
    }

    if (erg.achtEinsetzen) setzeAchtEin(spiel.kugeln);
    spiel.gruppen = erg.gruppen;
    spiel.anstoss = false;
    if (spiel.ballInHand === 'kopffeld-gelegt') spiel.ballInHand = null;

    if (erg.foul) {
      spiel.fouls[ich]++;
      reagiere('verdutzt'); Ton.foul();
      zeigeMeldung(erg.meldung, 'foul', 4200);
    } else if (erg.weiter) {
      if (!istComputerZug() || spiel.modus === 'zweier') reagiere('jubel');
      zeigeMeldung(erg.meldung, 'gut', 2400);
    } else zeigeMeldung(erg.meldung, '', 2400);

    spiel.ballInHand = erg.ballInHand ? 'tisch' : null;
    const wechsel = erg.naechster !== ich;
    spiel.amZug = erg.naechster;
    auswertungSperre = false;
    aktualisiereKopf();
    if (wechsel) {
      Ton.wechsel();
      if (spiel.modus === 'zweier') { zeigeUebergabe(erg); return; }
    }
    beginneZug();
  }

  // Neu aufbauen nach ungültigem Anstoß, Gruppen und Zähler der Partie bleiben
  function neuePartieBehalten(anstosser) {
    spiel.kugeln = baueDreieck(rnd);
    spiel.gruppen = [null, null];
    spiel.anstoss = true; spiel.anstossVon = anstosser;
    spiel.amZug = anstosser;
    spiel.ballInHand = 'kopffeld';
    spiel.angesagt = null;
    beginneZug();
  }

  function zeigeUebergabe(erg) {
    $('uebergabeTitel').textContent = erg.foul ? 'Foul – Wechsel' : 'Wechsel';
    $('uebergabeGrund').textContent = erg.meldung;
    $('uebergabeGrund').hidden = !erg.meldung;
    $('uebergabeName').textContent = `${name(spiel.amZug)} ist dran${spiel.ballInHand ? ' – mit Ball in Hand' : ''}`;
    krabbeInLeinwand($('uebergabeKrabbe'), { figur: 'kalle', mund: erg.foul ? 'verdutzt' : 'lachen', schielen: !!erg.foul, schereAuf: !erg.foul });
    setzeZustand('uebergabe');
    zeigeFenster('fUebergabe');
  }

  function beendePartie(ende) {
    abbrechenAlles();
    spiel.ende = ende;
    setzeZustand('ende');
    const mensch = spiel.modus === 'computer' ? ende.sieger === 0 : true;
    $('ergebnisTitel').textContent = spiel.modus === 'computer' ? (ende.sieger === 0 ? 'Gewonnen!' : 'Der Computer gewinnt') : `${name(ende.sieger)} gewinnt!`;
    $('ergebnisGrund').textContent = ende.grund;
    $('ergebnisZahlen').textContent = `Stöße: ${name(0)} ${spiel.stoesse[0]}, ${name(1)} ${spiel.stoesse[1]} · Fouls: ${spiel.fouls[0]} / ${spiel.fouls[1]}`;
    if (spiel.modus === 'computer' && ende.sieger === 0) Speicher.sieg(spiel.stufe);
    Speicher.partie();
    if (mensch) Ton.sieg(); else Ton.niederlage();
    krabbeInLeinwand($('ergebnisKrabbe'), mensch ? { figur: 'kalle', mund: 'jubel', schereHoch: true, schereAuf: true } : { figur: 'kalle', mund: 'verdutzt', schielen: true });
    $('ergebnisFreunde').hidden = spiel.modus !== 'computer';
    zeigeFenster('fErgebnis');
    ansage(`${$('ergebnisTitel').textContent} ${ende.grund}`);
  }

  // ---------- Computer ----------
  function starteComputer() {
    const lage = { kugeln: spiel.kugeln, gruppe: spiel.gruppen[1], anstoss: spiel.anstoss, ballInHand: spiel.ballInHand && spiel.ballInHand.startsWith('kopffeld') ? 'kopffeld' : spiel.ballInHand, modus: spiel.modus };
    ki = { phase: 'denken', start: zeit, planer: Computer.planer(lage, spiel.stufe, rnd), plan: null, t: 0 };
    setzeZustand('computer');
  }
  function computerSchritt(dt) {
    if (!ki) return;
    if (ki.phase === 'denken') {
      ki.planer.arbeite(5);
      const mindest = 0.75 / TEMPO;
      if (ki.planer.fertig && zeit - ki.start >= mindest) {
        ki.plan = Computer.ungenau(ki.planer.ergebnis, spiel.stufe, rnd);
        ki.winkelStart = ui.winkel;
        ki.staerkeStart = ui.staerke;
        ki.t = 0;
        if (spiel.platz && ki.plan.weiss) {
          ki.phase = 'legen';
          ki.von = { x: spiel.platz.x, y: spiel.platz.y };
        } else ki.phase = 'zielen';
        aktualisiereBedienung();
      }
    } else if (ki.phase === 'legen') {
      ki.t += dt * TEMPO;
      const q = Math.min(1, ki.t / 0.55);
      const e = q * q * (3 - 2 * q);
      setzePlatz(ki.von.x + (ki.plan.weiss.x - ki.von.x) * e, ki.von.y + (ki.plan.weiss.y - ki.von.y) * e);
      if (q >= 1) {
        const nurKopffeld = spiel.ballInHand === 'kopffeld';
        let p = ki.plan.weiss;
        if (!platzGueltig(spiel.kugeln, p.x, p.y, { ohne: 0, nurKopffeld })) p = naechsterFreierPlatz(spiel.kugeln, p.x, p.y, { ohne: 0, nurKopffeld });
        const w = weisse();
        Object.assign(w, { x: p.x, y: p.y, vx: 0, vy: 0, aufTisch: true, fall: null });
        spiel.platz = null;
        spiel.ballInHand = spiel.anstoss ? 'kopffeld-gelegt' : null;
        Ton.ablegen();
        ki.phase = 'zielen'; ki.t = 0; ki.winkelStart = ui.winkel;
        aktualisiereBedienung();
      }
    } else if (ki.phase === 'zielen') {
      if (ki.t === 0 && ki.plan.tasche !== null && ki.plan.tasche !== undefined) {
        spiel.angesagt = ki.plan.tasche;
        zeigeMeldung(`Der Computer sagt die Acht an: Tasche ${TISCH.taschen[ki.plan.tasche].name}.`, 'gut', 2600);
      }
      ki.t += dt * TEMPO;
      const q = Math.min(1, ki.t / 0.75);
      const e = q * q * (3 - 2 * q);
      let d = ki.plan.winkel - ki.winkelStart;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      ui.winkel = ki.winkelStart + d * e;
      ui.staerke = ki.staerkeStart + (ki.plan.staerke - ki.staerkeStart) * e;
      zeigeStaerke();
      if (q >= 1) {
        const plan = ki.plan;
        ki = null;
        ui.winkel = plan.winkel;
        starteStoss(plan.winkel, plan.staerke);
      }
    }
  }

  // ---------- Krabbe ----------
  function reagiere(art) {
    if (art === 'jubel') krabbe = { mund: 'jubel', art, bis: zeit + 1.6 };
    else if (art === 'verdutzt') krabbe = { mund: 'verdutzt', art, bis: zeit + 1.6 };
    malKopfKrabbe(true);
  }
  let krabbeZuletzt = '';
  function malKopfKrabbe(sofort) {
    if (krabbe.art && zeit > krabbe.bis) krabbe = { mund: 'lachen', art: null, bis: 0 };
    const ruhig = bewegungArm();
    const o = { figur: 'kalle', mund: krabbe.mund };
    if (krabbe.art === 'jubel') { o.schereHoch = true; o.schereAuf = true; o.tanzt = !ruhig; o.wedel = ruhig ? 0 : zeit * 2; }
    else if (krabbe.art === 'verdutzt') { o.schielen = true; }
    else { o.wedel = ruhig ? 0 : zeit * 0.35; o.blick = zustand === 'rollen' ? 0.6 : 0; }
    const schl = JSON.stringify(o);
    if (!sofort && schl === krabbeZuletzt) return;
    krabbeZuletzt = schl;
    const ziel = spiel && spiel.modus === 'training' ? $('trainingKrabbe') : $('kopfKrabbe');
    krabbeInLeinwand(ziel, o);
  }

  // ---------- Anzeige: Kopf, Status, Bedienung ----------
  const kugelLeinwand = new Map();
  function malKugelReihe(cv, nummern) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = 7 * dpr, abst = 2 * r + 3 * dpr;
    cv.width = Math.max(1, Math.round(nummern.length * abst));
    cv.height = Math.round(2 * r + 2 * dpr);
    const k = cv.getContext('2d');
    k.clearRect(0, 0, cv.width, cv.height);
    nummern.forEach((nr, i) => Grafik.malKugel(k, nr, r + i * abst + dpr, r + dpr * 0.5, r));
    cv.hidden = !nummern.length;
  }
  function aktualisiereKopf() {
    if (!spiel) return;
    const auf = aufTischSet();
    for (const i of [0, 1]) {
      const el = $('sp' + i);
      el.querySelector('.nm').textContent = name(i);
      el.classList.toggle('aktiv', spiel.amZug === i && spiel.modus !== 'training');
      const g = spiel.gruppen[i];
      const gt = el.querySelector('.gtext'), cv = el.querySelector('canvas');
      let nummern = [];
      if (!g) gt.textContent = spiel.anstoss ? 'Anstoß' : 'Tisch offen';
      else {
        const rest = gruppenKugeln(g).filter(n => auf.has(n));
        if (rest.length) { gt.textContent = `${GRUPPEN_NAME[g]} · ${rest.length}`; nummern = rest; }
        else { gt.textContent = 'Jetzt die Acht'; nummern = auf.has(8) ? [8] : []; }
      }
      const schl = i + ':' + nummern.join(',');
      if (kugelLeinwand.get(i) !== schl) { kugelLeinwand.set(i, schl); malKugelReihe(cv, nummern); }
      el.setAttribute('aria-label', `${name(i)}${spiel.amZug === i ? ', am Zug' : ''}. ${gt.textContent}`);
    }
  }

  function statusText() {
    if (!spiel) return '';
    const wer = spiel.modus === 'computer' ? (spiel.amZug === 0 ? 'Du bist dran' : 'Der Computer ist dran') : spiel.modus === 'zweier' ? `${name(spiel.amZug)} ist dran` : 'Training';
    if (zustand === 'rollen' || zustand === 'stoss') return 'Kugeln rollen …';
    if (zustand === 'computer') {
      if (!ki || ki.phase === 'denken') return 'Der Computer denkt nach …';
      if (ki.phase === 'legen') return 'Der Computer legt die Weiße hin …';
      return 'Der Computer zielt …';
    }
    if (zustand === 'platzieren') {
      const wo = spiel.ballInHand === 'kopffeld' ? 'im Kopffeld (links der gestrichelten Linie)' : 'irgendwo auf den Tisch';
      if (spiel.platz && !spiel.platz.gueltig) return 'Dort geht es nicht: nicht auf eine Kugel, nicht in eine Tasche' + (spiel.ballInHand === 'kopffeld' ? ', nur im Kopffeld.' : '.');
      return `${spiel.anstoss ? 'Anstoß' : 'Ball in Hand'}: Leg die Weiße ${wo} und tippe „Hier ablegen“.`;
    }
    if (zustand === 'zielen') {
      if (mussAnsagen()) {
        if (spiel.angesagt === null) return `${wer}: <b>Tasche für die Acht wählen</b> – tippe eine Tasche an (Tasten 1–6).`;
        return `${wer}: Acht angesagt für <b>${TISCH.taschen[spiel.angesagt].name}</b>. <button type="button" class="btn klein" id="ansageAendern" style="min-height:44px;padding:4px 12px;font-size:14px">Tasche ändern</button>`;
      }
      if (spiel.modus === 'training') return 'Training: Ziele und stoße. Alle Kugeln sind frei.';
      if (spiel.anstoss) return `${wer}: Anstoß!`;
      const g = spiel.gruppen[spiel.amZug];
      return `${wer} – ${g ? `spiele eine <b>${g === 'voll' ? 'volle' : 'halbe'}</b> Kugel.` : 'Tisch offen: volle oder halbe Kugel.'}`;
    }
    return '';
  }
  let statusZuletzt = '';
  function aktualisiereBedienung() {
    const html = statusText();
    if (html !== statusZuletzt) {
      statusZuletzt = html;
      $('status').innerHTML = html;
      const k = $('ansageAendern');
      if (k) k.addEventListener('click', () => { spiel.angesagt = null; Ton.klick(); aktualisiereBedienung(); });
    }
    const knopf = $('stossKnopf');
    const mensch = spiel && !istComputerZug() && !pausiert;
    if (zustand === 'platzieren') {
      knopf.textContent = 'Hier ablegen';
      knopf.disabled = !(mensch && spiel.platz && spiel.platz.gueltig);
    } else {
      knopf.textContent = zustand === 'rollen' || zustand === 'stoss' ? 'Rollt …' : 'Stoßen';
      knopf.disabled = !stossErlaubtOhnePause();
    }
    const zielbar = zustand === 'zielen' && mensch;
    $('linksKnopf').disabled = !zielbar; $('rechtsKnopf').disabled = !zielbar;
    $('staerke').setAttribute('aria-disabled', zielbar ? 'false' : 'true');
  }
  function stossErlaubtOhnePause() {
    return zustand === 'zielen' && spiel && !istComputerZug() && !pausiert && weisse().aufTisch && !(mussAnsagen() && spiel.angesagt === null);
  }

  function zeigeStaerke() {
    const p = Math.round(ui.staerke * 100);
    const spur = $('staerke').querySelector('.spur');
    const breite = spur.getBoundingClientRect().width || 200;
    spur.style.setProperty('--spurbreite', breite + 'px');
    spur.querySelector('.fuell').style.width = (ui.staerke * 100) + '%';
    spur.querySelector('.griff').style.left = (ui.staerke * 100) + '%';
    $('staerkeText').textContent = p + ' %';
    $('staerke').setAttribute('aria-valuenow', String(p));
    $('staerke').setAttribute('aria-valuetext', `${p} Prozent`);
  }

  function zeigeMeldung(text, art = '', dauer = 2400) {
    const m = $('meldung');
    m.textContent = text;
    m.className = 'zeigen' + (art ? ' ' + art : '');
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(() => { m.className = ''; }, dauer / Math.max(1, TEMPO / 2));
  }
  function ansage(text) { $('ansage').textContent = ''; setTimeout(() => { $('ansage').textContent = text; }, 30); }

  // ---------- Zielvorschau (dieselbe Geometrie wie die Physik) ----------
  function vorschau() {
    if (zustand !== 'zielen' || istComputerZug()) return null;
    const w = weisse(); if (!w.aufTisch) return null;
    const dx = Math.cos(ui.winkel), dy = Math.sin(ui.winkel);
    const s = wirfStrahl(spiel.kugeln, w.x, w.y, dx, dy, [0]);
    const v = { start: { x: w.x, y: w.y }, treffer: { x: s.x, y: s.y }, art: s.art };
    if (s.art === 'kugel') {
      const ob = spiel.kugeln.find(k => k.nr === s.kugel);
      v.objekt = { x: ob.x, y: ob.y };
      v.richtung = { x: s.nx, y: s.ny };
      const cos = Math.max(0, dx * s.nx + dy * s.ny);
      const erweitert = spiel.modus === 'training' && Speicher.hilfe;
      if (erweitert) {
        const weiter = wirfStrahl(spiel.kugeln, ob.x, ob.y, s.nx, s.ny, [ob.nr, 0], 1600);
        v.objektLaenge = Math.max(40, weiter.t);
        const tx = dx - (dx * s.nx + dy * s.ny) * s.nx, ty = dy - (dx * s.nx + dy * s.ny) * s.ny, tl = Math.hypot(tx, ty);
        v.weissWeiter = tl > 0.05 ? { x: tx / tl, y: ty / tl } : null;
      } else v.objektLaenge = 50 + 130 * cos;
      v.erlaubt = spiel.modus === 'training' ? true : ziele().includes(s.kugel);
    }
    return v;
  }

  // ---------- Eingabe-Aktionen ----------
  function tischAktion(welt, phase) {
    if (pausiert || !spiel || !welt) { if (phase === 'abbruch') platzZiehen = false; return; }
    if (zustand === 'platzieren' && !istComputerZug()) {
      if (phase === 'start' || phase === 'zug') { setzePlatz(welt.x, welt.y); platzZiehen = true; }
      if (phase === 'ende' || phase === 'abbruch') platzZiehen = false;
      return;
    }
    if (!menschZielt()) return;
    // Tasche für die Acht wählen: Antippen in der Nähe einer Tasche
    if (phase === 'start' && mussAnsagen() && spiel.angesagt === null) {
      const t = TISCH.taschen.find(t => Math.hypot(welt.x - t.zeichen.x, welt.y - t.zeichen.y) < t.zeichen.r + 70);
      if (t) { waehleTasche(t.nr); return; }
    }
    const w = weisse();
    const dx = welt.x - w.x, dy = welt.y - w.y;
    // Beim Aufsetzen festlegen, wie gezielt wird (bleibt für das ganze Ziehen gleich):
    // Finger auf dem Queue hinter der Weißen → der Queue folgt dem Finger, gestoßen wird in die Gegenrichtung.
    // Finger woanders → die Weiße zielt auf den Punkt unter dem Finger.
    if (phase === 'start') zielArt = aufQueue(dx, dy) ? 'queue' : 'punkt';
    if (phase === 'abbruch') { zielArt = null; return; }
    const art = zielArt;
    if (phase === 'ende') zielArt = null;             // erst nach der letzten Richtung zurücksetzen
    if (Math.hypot(dx, dy) < TISCH.R * 0.6) return;   // zu nah an der Weißen: Richtung unklar
    ui.winkel = art === 'queue' ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx);
  }
  let zielArt = null;
  // Liegt der Punkt (relativ zur Weißen) auf dem sichtbaren Queue bzw. in einem fingerbreiten Streifen darum?
  function aufQueue(dx, dy) {
    const ux = Math.cos(ui.winkel), uy = Math.sin(ui.winkel);
    const hinten = -(dx * ux + dy * uy);              // Abstand hinter der Weißen entlang des Queues
    const quer = Math.abs(dx * uy - dy * ux);         // seitlicher Abstand zur Queue-Linie
    const breite = Math.max(70, 26 / Ansicht.s);      // mindestens ~26 Bildschirmpixel zu jeder Seite
    return hinten > TISCH.R * 0.6 && hinten < 1700 && quer < breite;
  }
  function waehleTasche(nr) {
    if (!menschZielt() || !mussAnsagen()) return;
    spiel.angesagt = nr;
    Ton.klick();
    zeigeMeldung(`Acht angesagt: Tasche ${TISCH.taschen[nr].name}.`, 'gut', 2000);
    aktualisiereBedienung();
  }
  function fein(richtung, schritte, taste) {
    if (pausiert || !spiel) return;
    if (zustand === 'platzieren' && !istComputerZug()) {
      if (!taste) return;
      const p = spiel.platz || { x: 0, y: 0 };
      const schritt = schritte >= 20 ? 30 : 5;
      // Bildschirmrichtung links/rechts in Weltrichtung umrechnen
      const a = Ansicht.zuWelt(Ansicht.cx + richtung, Ansicht.cy), o = Ansicht.zuWelt(Ansicht.cx, Ansicht.cy);
      setzePlatz(p.x + (a.x - o.x) * schritt, p.y + (a.y - o.y) * schritt);
      return;
    }
    if (!menschZielt()) return;
    // Uhrzeigersinn auf dem Bildschirm; im gedrehten Bild ist die Drehrichtung dieselbe (Drehung ohne Spiegelung)
    const grad = schritte >= 20 ? 1 : schritte > 10 ? 0.4 : 0.1;
    ui.winkel += richtung * grad * GRAD;
  }
  function staerkeSetzen(w) {
    if (pausiert || !spiel || !menschZielt()) return;
    ui.staerke = Math.max(0, Math.min(1, w));
    zeigeStaerke();
  }
  function staerkeSchritt(d) {
    if (pausiert || !spiel) return;
    if (zustand === 'platzieren' && !istComputerZug()) {
      const p = spiel.platz || { x: 0, y: 0 };
      const schritt = Math.abs(d) >= 0.1 ? 30 : 5;
      const a = Ansicht.zuWelt(Ansicht.cx, Ansicht.cy - Math.sign(d)), o = Ansicht.zuWelt(Ansicht.cx, Ansicht.cy);
      setzePlatz(p.x + (a.x - o.x) * schritt, p.y + (a.y - o.y) * schritt);
      return;
    }
    staerkeSetzen(ui.staerke + d);
  }

  // ---------- Fenster ----------
  let fensterOffen = null, zurueckZu = null;
  function zeigeFenster(id) {
    for (const s of document.querySelectorAll('#fenster section')) s.hidden = s.id !== id;
    $('fenster').hidden = false;
    fensterOffen = id;
    const sec = $(id);
    // Titel behalten ihre eigene id (andere Teile schreiben hinein); das Fenster verweist nur darauf
    const titel = sec.querySelector('[data-titel]');
    if (titel) { if (!titel.id) titel.id = id + 'Titel'; sec.closest('.tafel').setAttribute('aria-labelledby', titel.id); }
    sec.closest('.tafel').classList.toggle('breit', id === 'fRegeln');
    const erster = sec.querySelector('.btn.main, button');
    if (erster) setTimeout(() => erster.focus({ preventScroll: true }), 30);
  }
  function schliesseFenster() { $('fenster').hidden = true; fensterOffen = null; leinwand.focus({ preventScroll: true }); }

  function zeigeStart() {
    abbrechenAlles();
    pausiert = false;
    spiel = null;
    setzeZustand('menue');
    wurzel.dataset.modus = Speicher.modus;
    aktualisiereStartwahl();
    krabbeInLeinwand($('startKrabbe'), { figur: 'kalle', mund: 'lachen', schereAuf: true, schereHoch: true });
    zeigeFenster('fStart');
  }
  function aktualisiereStartwahl() {
    for (const b of document.querySelectorAll('.js-modus')) b.setAttribute('aria-pressed', String(b.dataset.modus === Speicher.modus));
    for (const b of document.querySelectorAll('.js-stufe')) b.setAttribute('aria-pressed', String(b.dataset.stufe === Speicher.stufe));
    $('stufenWahl').hidden = Speicher.modus !== 'computer';
  }
  function zeigeRegeln() {
    zurueckZu = fensterOffen || (spiel ? 'spiel' : 'fStart');
    if (spiel && !pausiert && zustand !== 'menue' && zustand !== 'ende') setzePause(true, false);
    zeigeFenster('fRegeln');
  }

  function setzePause(an, fenster = true) {
    if (!spiel || zustand === 'menue' || zustand === 'ende') return;
    if (an === pausiert) { if (an && fenster) zeigeFenster('fPause'); return; }
    pausiert = an;
    if (an) {
      if (eingabe) eingabe.loslassen();
      platzZiehen = false;
      if (fenster) zeigeFenster('fPause');
    } else {
      // bewusst fortsetzen: Dialog des Zustands (z. B. Übergabe) wieder zeigen
      if (zustand === 'uebergabe') zeigeFenster('fUebergabe');
      else if (zustand === 'anstossWahl') zeigeFenster('fAnstossWahl');
      else schliesseFenster();
      letzteZeit = performance.now();
    }
    aktualisiereBedienung();
  }

  function aktualisiereTon() {
    for (const b of document.querySelectorAll('.js-ton')) {
      b.setAttribute('aria-pressed', String(Ton.istAn()));
      if (b.classList.contains('btn')) b.textContent = Ton.istAn() ? 'Ton: an' : 'Ton: aus';
    }
  }
  function schalteTon() { Ton.setze(!Ton.istAn()); Speicher.ton = Ton.istAn(); aktualisiereTon(); Ton.klick(); }

  // ---------- Leinwandgröße (Ansicht) ----------
  let groesse = '';
  function passeGroesse() {
    const r = leinwand.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const schl = `${w}x${h}@${dpr}`;
    if (schl === groesse) return;
    groesse = schl;
    leinwand.width = Math.round(w * dpr); leinwand.height = Math.round(h * dpr);
    Ansicht.passe(w, h, dpr);
    zeigeStaerke();
  }

  // ---------- EIN Game Loop ----------
  let letzteZeit = performance.now();
  let akku = 0;
  function loop(jetzt) {
    requestAnimationFrame(loop);
    let dt = Math.min(0.1, Math.max(0, (jetzt - letzteZeit) / 1000));
    letzteZeit = jetzt;
    passeGroesse();
    if (!pausiert && spiel) {
      zeit += dt;
      aktualisiere(dt);
    }
    zeichne();
  }

  function aktualisiere(dt) {
    if (zustand === 'stoss' && anim) {
      anim.t += dt * TEMPO;
      if (anim.t >= anim.dauer) stossKontakt();
    }
    if (zustand === 'rollen') {
      akku += dt * TEMPO;
      let n = 0;
      while (akku >= PHYSIK.DT && n < 240 * TEMPO) {
        Physik.schritt(spiel.kugeln, physikEreignis);
        akku -= PHYSIK.DT; n++;
        spiel.rollZeit += PHYSIK.DT;
      }
      Physik.fallSchritt(spiel.kugeln, dt * TEMPO);
      if (spiel.rollZeit > PHYSIK.MAX_STOSSDAUER) Physik.anhalten(spiel.kugeln);
      const faellt = spiel.kugeln.some(k => k.fall && k.fall.zeit < PHYSIK.FALL_DAUER);
      if (!Physik.inBewegung(spiel.kugeln) && !faellt) { akku = 0; auswerten(); }
    } else {
      akku = 0;
      Physik.fallSchritt(spiel.kugeln, dt * TEMPO);
    }
    if (zustand === 'computer') computerSchritt(dt);
    malKopfKrabbe(false);
  }

  function zeichne() {
    if (!spiel) {
      // Menü: leerer Tisch im Hintergrund
      Grafik.male(c, { kugeln: [], zeit, angesagt: null });
      return;
    }
    const w = weisse();
    const z = {
      kugeln: spiel.kugeln, zeit, angesagt: spiel.angesagt,
      kopffeld: zustand === 'platzieren' || (zustand === 'computer' && spiel.ballInHand === 'kopffeld') ? spiel.ballInHand === 'kopffeld' : false,
      platz: spiel.platz && (zustand === 'platzieren' || (zustand === 'computer' && ki && ki.phase === 'legen') || (zustand === 'computer' && spiel.platz)) ? spiel.platz : null,
      weissVersteckt: !!spiel.platz,
      taschenWahl: menschZielt() && mussAnsagen() && spiel.angesagt === null,
      erweitert: spiel.modus === 'training' && Speicher.hilfe,
      vorschau: vorschau(),
      markiert: null,
      queue: null,
    };
    if (w.aufTisch && !spiel.platz && (zustand === 'zielen' || zustand === 'stoss' || (zustand === 'computer' && ki && ki.phase === 'zielen'))) {
      let abstand = 10 + ui.staerke * 150;
      if (zustand === 'stoss' && anim) {
        const q = Math.min(1, anim.t / anim.dauer);
        abstand = anim.von * (1 - q * q);
      }
      z.queue = { weiss: w, winkel: ui.winkel, abstand };
    }
    Grafik.male(c, z);
  }

  // ---------- Verdrahtung ----------
  let eingabe = null;
  eingabe = richteEingabeEin(leinwand, {
    tisch: tischAktion,
    fein,
    staerke: staerkeSetzen,
    staerkeSchritt,
    stoss,
    bestaetigen: () => { if (zustand === 'platzieren') bestaetigePlatz(); },
    pause: () => {
      if (fensterOffen === 'fRegeln') { $('regelnZurueck').click(); return; }
      if (pausiert) { if (fensterOffen === 'fPause') setzePause(false); return; }
      setzePause(true);
    },
    ton: schalteTon,
    tasche: waehleTasche,
    darf: () => !!spiel && (fensterOffen === null || fensterOffen === 'fPause' || fensterOffen === 'fRegeln'),
  });

  // Erste Berührung irgendwo weckt den Ton (Browser verlangen eine Nutzeraktion)
  const wecken = () => { if (Ton.istAn()) Ton.wecke(); };
  document.addEventListener('pointerdown', wecken, { capture: true });
  document.addEventListener('keydown', wecken, { capture: true });

  for (const b of document.querySelectorAll('.js-modus')) b.addEventListener('click', () => { Speicher.modus = b.dataset.modus; Ton.klick(); aktualisiereStartwahl(); });
  for (const b of document.querySelectorAll('.js-stufe')) b.addEventListener('click', () => { Speicher.stufe = b.dataset.stufe; Ton.klick(); aktualisiereStartwahl(); });
  for (const b of document.querySelectorAll('.js-ton')) b.addEventListener('click', schalteTon);
  $('spielenKnopf').addEventListener('click', () => { Ton.klick(); schliesseFenster(); pausiert = false; neuePartie(Speicher.modus, 0); });
  $('regelnKnopf').addEventListener('click', () => { Ton.klick(); zeigeRegeln(); });
  $('regelnKnopfSpiel').addEventListener('click', () => { Ton.klick(); zeigeRegeln(); });
  $('pauseRegelnKnopf').addEventListener('click', () => { Ton.klick(); zeigeRegeln(); });
  $('regelnZurueck').addEventListener('click', () => {
    Ton.klick();
    if (zurueckZu === 'fStart' || !spiel) zeigeFenster('fStart');
    else if (zurueckZu === 'fPause' || zurueckZu === 'spiel') zeigeFenster('fPause');
    else zeigeFenster(zurueckZu);
  });
  $('pauseKnopf').addEventListener('click', () => { Ton.klick(); setzePause(true); });
  $('weiterKnopf').addEventListener('click', () => { Ton.klick(); setzePause(false); });
  $('neustartKnopf').addEventListener('click', () => { Ton.klick(); const m = spiel.modus; pausiert = false; schliesseFenster(); neuePartie(m, 0); });
  $('menueKnopf').addEventListener('click', () => { Ton.klick(); zeigeStart(); });
  $('uebergabeKnopf').addEventListener('click', () => { Ton.klick(); schliesseFenster(); beginneZug(); });
  $('neuAnstossKnopf').addEventListener('click', () => { Ton.klick(); schliesseFenster(); neuePartieBehalten(spiel.wahlFuer); });
  $('uebernehmenKnopf').addEventListener('click', () => {
    Ton.klick(); schliesseFenster();
    spiel.amZug = spiel.wahlFuer; spiel.anstoss = false;
    spiel.ballInHand = spiel.wahlBallInHand ? 'tisch' : null;
    beginneZug();
  });
  $('revancheKnopf').addEventListener('click', () => {
    Ton.klick(); schliesseFenster();
    const verlierer = 1 - spiel.ende.sieger;
    neuePartie(spiel.modus, verlierer);
    zeigeMeldung(`Revanche! ${name(verlierer)} stößt an.`, 'gut', 2600);
  });
  $('ergebnisMenueKnopf').addEventListener('click', () => { Ton.klick(); zeigeStart(); });
  $('neuAufbauKnopf').addEventListener('click', () => { Ton.klick(); if (spiel && !pausiert) trainingAufbau(spiel.uebung === 'frei' ? 'frei' : spiel.uebung); });
  $('uebungWahl').addEventListener('change', e => { Ton.klick(); if (spiel && !pausiert) trainingAufbau(e.target.value); });
  $('hilfeKnopf').addEventListener('click', () => { Speicher.hilfe = !Speicher.hilfe; Ton.klick(); zeigeHilfe(); });
  function zeigeHilfe() { const k = $('hilfeKnopf'); k.setAttribute('aria-pressed', String(Speicher.hilfe)); k.textContent = `Erweiterte Zielhilfe: ${Speicher.hilfe ? 'an' : 'aus'}`; }

  // Freunde herausfordern (gemeinsamer Pixelhafen-Baustein): Siege gegen den Computer je Stärke
  const duell = PixelDuell.erstelle({
    spiel: 'Hafenbillard',
    adresse: 'https://moje9328.github.io/hafenbillard/',
    schluessel: 'pixelhafen.hafenbillard.freunde',
    stand: st => ({ punkte: Speicher.siege(st) }),
    stufen: { entspannt: 'Entspannt', herausfordernd: 'Herausfordernd' },
    stufe: () => Speicher.stufe,
    beiStufe: st => { Speicher.stufe = st; aktualisiereStartwahl(); },
    einheit: 'Siege', levelWort: '', wasText: 'deine Siege gegen den Computer',
    erklaerung: 'Gezählt werden deine Siege gegen den Computer auf der gewählten Stärke.',
  });
  if (duell.offen) { $('startDuell').textContent = duell.startText(); $('startDuell').hidden = false; }
  $('freundeKnopf').addEventListener('click', () => { Ton.klick(); duell.oeffne(); });
  $('ergebnisFreunde').addEventListener('click', () => { Ton.klick(); duell.oeffne(); });

  // Tabwechsel: automatisch pausieren, Fortsetzen nur bewusst
  document.addEventListener('visibilitychange', () => { if (document.hidden) setzePause(true); else letzteZeit = performance.now(); });
  window.addEventListener('blur', () => { /* kein Pausieren bei bloßem Fokuswechsel (z. B. Teilen-Dialog) */ });

  // Offline-Helfer (nicht auf dem lokalen Testserver)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/^(127\.|localhost)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Start
  Ton.setze(Speicher.ton);
  aktualisiereTon();
  zeigeHilfe();
  zeigeStaerke();
  zeigeStart();
  requestAnimationFrame(t => { letzteZeit = t; requestAnimationFrame(loop); });

  // Für automatische Tests (liest nur und ruft dieselben Aktionen wie die Knöpfe auf)
  window.__billard = {
    zustand: () => zustand, pausiert: () => pausiert, spiel: () => spiel, ui, Ansicht, TISCH,
    tempo: TEMPO,
    vorschau: () => vorschau(),
    zielArt: () => zielArt,
    saat(s) { rnd = zufall(s); },
    // Vorschlag des Computers für die Person am Zug (für den Test-Bot, der dann über die echte Bedienung spielt)
    vorschlag(stufe = 'herausfordernd') {
      const lage = { kugeln: spiel.kugeln, gruppe: spiel.gruppen[spiel.amZug], anstoss: spiel.anstoss, ballInHand: spiel.platz ? (spiel.ballInHand === 'kopffeld' ? 'kopffeld' : 'tisch') : null, modus: spiel.modus };
      const p = Computer.planer(lage, stufe, zufall(7));
      while (!p.arbeite(50));
      return JSON.parse(JSON.stringify(p.ergebnis));
    },
    ton: () => Ton.status(),
  };
})();
