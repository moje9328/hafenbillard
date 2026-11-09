// ===================================================================
// 3 · REGELN (8-Ball, Hafenbillard-Hausregeln)
// Während eines Stoßes wird nur protokolliert (Stossprotokoll). Erst wenn
// alle Kugeln ruhen, wertet werteStossAus() den ganzen Stoß auf einmal aus.
// Keine Zugwechsel mitten in einzelnen Kollisionen.
// ===================================================================

// Sammelt alle Ereignisse eines Stoßes
class Stossprotokoll {
  constructor() {
    this.ersterKontakt = null;     // Nummer der zuerst getroffenen Objektkugel
    this.bandeNachKontakt = false; // irgendeine Kugel hat nach dem ersten Kontakt eine Bande berührt
    this.bandenKugeln = new Set(); // Objektkugeln mit Bandenkontakt (für den Anstoß)
    this.versenkt = [];            // [{ nr, tasche }] in Reihenfolge
    this.kontakte = 0;
  }
  ereignis(e) {
    if (e.typ === 'kugel') {
      this.kontakte++;
      if (this.ersterKontakt === null) {
        if (e.a === 0) this.ersterKontakt = e.b;
        else if (e.b === 0) this.ersterKontakt = e.a;
      }
    } else if (e.typ === 'bande') {
      if (this.ersterKontakt !== null) this.bandeNachKontakt = true;
      if (e.kugel !== 0) this.bandenKugeln.add(e.kugel);
    } else if (e.typ === 'tasche') {
      this.versenkt.push({ nr: e.kugel, tasche: e.tasche });
    }
  }
}

const FOUL_TEXTE = {
  nichts: 'Foul: keine Kugel getroffen.',
  falsch: 'Foul: zuerst die falsche Kugel getroffen.',
  weisse: 'Foul: die Weiße ist in eine Tasche gefallen.',
  bande: 'Foul: nach dem Treffer ist keine Kugel gefallen und keine an eine Bande gerollt.',
};
const GRUPPEN_NAME = { voll: 'Volle', halb: 'Halbe' };
const gruppenKugeln = g => g === 'voll' ? VOLLE : g === 'halb' ? HALBE : [];

// Welche Kugeln darf die Person am Zug zuerst treffen?
// aufTisch: Set der Kugelnummern auf dem Tisch beim Stoßbeginn
function erlaubteZiele(gruppe, aufTisch, anstoss = false) {
  if (anstoss) return [...aufTisch].filter(n => n !== 0);
  if (!gruppe) return [...aufTisch].filter(n => n !== 0 && n !== 8);
  const eigene = gruppenKugeln(gruppe).filter(n => aufTisch.has(n));
  return eigene.length ? eigene : [8];
}
const spieltAufAcht = (gruppe, aufTisch) => !!gruppe && gruppenKugeln(gruppe).every(n => !aufTisch.has(n));

// zustand: { amZug, gruppen: [g0, g1], anstoss, angesagt (Taschennummer oder null), aufTisch: Set }
// Ergebnis: siehe unten (ein flaches Objekt, damit Tests es leicht prüfen können)
function werteStossAus(zustand, p) {
  const ich = zustand.amZug, du = 1 - ich;
  const meine = zustand.gruppen[ich];
  const versenktNr = p.versenkt.map(v => v.nr);
  const weisseWeg = versenktNr.includes(0);
  const achtWeg = versenktNr.includes(8);
  const objektVersenkt = p.versenkt.filter(v => v.nr !== 0);
  const erg = {
    foul: null, foulText: '', weiter: false, naechster: du, gruppen: zustand.gruppen.slice(),
    ende: null, ballInHand: false, achtEinsetzen: false, neuAufbauWahl: false, anstossLegal: null,
    gruppeNeu: null, meldung: '',
  };

  // ---------- Anstoß ----------
  if (zustand.anstoss) {
    const legal = objektVersenkt.length > 0 || p.bandenKugeln.size >= 4;
    erg.anstossLegal = legal;
    erg.achtEinsetzen = achtWeg;
    if (!legal) {
      erg.neuAufbauWahl = true;
      erg.foul = 'anstoss';
      erg.foulText = 'Ungültiger Anstoß: keine Kugel gefallen und weniger als vier Kugeln an der Bande.';
      erg.ballInHand = weisseWeg;   // falls der Tisch übernommen wird
      erg.meldung = erg.foulText;
      return erg;
    }
    if (weisseWeg) {
      erg.foul = 'weisse';
      erg.foulText = FOUL_TEXTE.weisse;
      erg.ballInHand = true;
      erg.meldung = 'Anstoß gültig, aber ' + FOUL_TEXTE.weisse.replace('Foul: ', '') + ' Ball in Hand für die andere Seite.';
      return erg;
    }
    const sonstige = objektVersenkt.filter(v => v.nr !== 8);
    if (sonstige.length) { erg.weiter = true; erg.naechster = ich; }
    erg.meldung = achtWeg ? 'Die Acht ist beim Anstoß gefallen und wird wieder eingesetzt.' : (erg.weiter ? 'Guter Anstoß! Der Tisch ist noch offen.' : 'Anstoß gültig. Der Tisch ist noch offen.');
    return erg;
  }

  // ---------- normaler Stoß ----------
  const ziele = erlaubteZiele(meine, zustand.aufTisch);
  const aufAcht = spieltAufAcht(meine, zustand.aufTisch);
  let foul = null;
  if (p.ersterKontakt === null) foul = 'nichts';
  else if (!ziele.includes(p.ersterKontakt)) foul = 'falsch';
  else if (weisseWeg) foul = 'weisse';
  else if (objektVersenkt.length === 0 && !p.bandeNachKontakt) foul = 'bande';
  if (!foul && weisseWeg) foul = 'weisse';
  if (foul) {
    erg.foul = foul;
    erg.foulText = FOUL_TEXTE[foul];
    if (foul === 'falsch') {
      const erlaubt = !meine ? 'eine volle oder halbe Kugel (nicht die Acht)' : aufAcht ? 'die Acht' : 'eine Kugel der ' + GRUPPEN_NAME[meine];
      erg.foulText += ` Erlaubt war ${erlaubt}.`;
    }
  }

  // Acht gefallen: Sieg oder Niederlage
  if (achtWeg) {
    const tasche = p.versenkt.find(v => v.nr === 8).tasche;
    if (!aufAcht) erg.ende = { sieger: du, grund: 'Die Acht ist zu früh gefallen.' };
    else if (foul) erg.ende = { sieger: du, grund: 'Die Acht ist zusammen mit einem Foul gefallen. ' + erg.foulText.replace('Foul: ', '') };
    else if (zustand.angesagt !== tasche) erg.ende = { sieger: du, grund: 'Die Acht ist in die falsche Tasche gefallen.' };
    else erg.ende = { sieger: ich, grund: 'Die Acht ist sauber in die angesagte Tasche gefallen.' };
    erg.weiter = false;
    erg.naechster = du;
    erg.meldung = erg.ende.grund;
    return erg;
  }

  if (foul) {
    erg.ballInHand = true;
    erg.meldung = erg.foulText + ' Ball in Hand für die andere Seite.';
    return erg;
  }

  // Gruppenzuweisung bei offenem Tisch: erste versenkte volle oder halbe Kugel
  let gruppe = meine;
  if (!meine) {
    const erste = objektVersenkt.find(v => v.nr !== 8);
    if (erste) {
      gruppe = gruppeVon(erste.nr);
      erg.gruppen[ich] = gruppe;
      erg.gruppen[du] = gruppe === 'voll' ? 'halb' : 'voll';
      erg.gruppeNeu = gruppe;
    }
  }
  const eigeneGefallen = gruppe ? objektVersenkt.some(v => gruppeVon(v.nr) === gruppe) : false;
  if (eigeneGefallen) {
    erg.weiter = true;
    erg.naechster = ich;
    erg.meldung = erg.gruppeNeu ? `Gruppe vergeben: ${GRUPPEN_NAME[gruppe]}.` : 'Getroffen! Weiter geht’s.';
  } else {
    erg.meldung = objektVersenkt.length ? 'Nur fremde Kugeln gefallen. Wechsel.' : 'Keine eigene Kugel gefallen. Wechsel.';
  }
  return erg;
}

// Training: keine Gruppen, keine Niederlage. Die Weiße wird nach dem Versenken neu gesetzt.
function werteTrainingAus(p) {
  const weisseWeg = p.versenkt.some(v => v.nr === 0);
  const gefallen = p.versenkt.filter(v => v.nr !== 0).length;
  return { weiter: true, ballInHand: weisseWeg, gefallen, meldung: weisseWeg ? 'Die Weiße ist gefallen. Leg sie wieder auf den Tisch.' : gefallen ? 'Schön versenkt!' : '' };
}
