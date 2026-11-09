// Logik-Tests ohne Browser. Aufruf: node quelle/test-logik.js
// Prüft Physik (reproduzierbare Szenarien), Zielvorschau, Aufbau, Regeln (definierte Stoßereignisse)
// und den Computer (inkl. kompletter Partien Computer gegen Computer).
const L = require('./lade-logik.js')();
const { TISCH, PHYSIK, Physik, neueKugel, baueDreieck, setzeAchtEin, zufall, wirfStrahl, platzGueltig, naechsterFreierPlatz,
  Stossprotokoll, werteStossAus, werteTrainingAus, erlaubteZiele, Computer, UEBUNGEN, staerkeZuTempo, tempoZuStaerke, gruppeVon } = L;
const R = TISCH.R;
let geprueft = 0; const fehler = [];
function ok(bed, text) { geprueft++; if (!bed) { fehler.push(text); console.log('  FEHLER:', text); } }
const nahe = (a, b, tol) => Math.abs(a - b) <= tol;
function abschnitt(t) { console.log('·', t); }
const lauf = (kugeln, max = 40) => Physik.simuliere(kugeln, max);

// Liegt jede Kugel auf erlaubter Fläche? (Rechteck oder Taschenmund/-kanal, nie hinter einer Bande)
function aufFlaeche(k) {
  if (Math.abs(k.x) <= TISCH.X - R + 0.01 && Math.abs(k.y) <= TISCH.Y - R + 0.01) return true;
  for (const s of TISCH.banden) { const d = (k.x - s.p.x) * s.n.x + (k.y - s.p.y) * s.n.y; const u = (k.x - s.p.x) * s.d.x + (k.y - s.p.y) * s.d.y; if (u >= 0 && u <= s.len && d < R - 0.01) return false; }
  return TISCH.taschen.some(t => Math.hypot(k.x - t.kehle.x, k.y - t.kehle.y) < 180);
}
function minAbstand(kugeln) {
  const a = kugeln.filter(k => k.aufTisch); let m = Infinity;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) m = Math.min(m, Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y));
  return m;
}

// ================= PHYSIK =================
abschnitt('Gerader zentraler Stoß');
{
  const k = [neueKugel(0, -400, 0), neueKugel(3, 0, 0)];
  const v0 = 2000; Physik.stoss(k, 0, v0);
  let ev = [], p0 = k[0].vx;
  while (!ev.some(e => e.typ === 'kugel')) { p0 = k[0].vx + k[1].vx; Physik.schritt(k, e => ev.push(e)); }
  const impuls = k[0].vx + k[1].vx;
  ok(k[1].vx > 0.95 * k[0].vx + 1500 * 0.9, 'Objektkugel übernimmt fast die ganze Geschwindigkeit');
  ok(k[0].vx >= 0 && k[0].vx < 0.06 * p0, 'Weiße bleibt bei vollem Treffer fast stehen');
  ok(Math.abs(k[1].vy) < 1e-6 && Math.abs(k[0].vy) < 1e-6, 'keine seitliche Ablenkung bei zentralem Stoß');
  ok(impuls <= p0 + 1e-6 && impuls > p0 * 0.97, 'Impuls bleibt (bis auf Reibung) erhalten');
  ok(Math.hypot(k[0].x - k[1].x, k[0].y - k[1].y) >= 2 * R - 1e-6, 'keine Überlappung beim Kontakt');
}
abschnitt('Schräger Treffer: Bahnen ~90° auseinander');
{
  const k = [neueKugel(0, -400, 0), neueKugel(5, 0, R)];   // halbvoller Treffer
  Physik.stoss(k, 0, 2000);
  let ev = [], e0 = 0;
  while (!ev.some(e => e.typ === 'kugel')) { e0 = Physik.energie(k); Physik.schritt(k, e => ev.push(e)); }
  const w = Math.atan2(k[0].vy, k[0].vx), o = Math.atan2(k[1].vy, k[1].vx);
  let d = Math.abs(w - o) * 180 / Math.PI; if (d > 180) d = 360 - d;
  ok(nahe(d, 90, 4), `Winkel zwischen Weißer und Objektkugel ≈ 90° (ist ${d.toFixed(1)}°)`);
  ok(nahe(o * 180 / Math.PI, 30, 1.5), `Objektkugel läuft entlang der Stoßlinie (30°, ist ${(o * 180 / Math.PI).toFixed(1)}°)`);
  const e1 = Physik.energie(k);
  ok(e1 < e0 && e1 > e0 * 0.9, 'Energie nimmt beim Stoß ab, aber nicht unplausibel stark');
}
abschnitt('Bandenreflexion');
for (const grad of [90, 60, 30]) {
  const w = -grad * Math.PI / 180;   // nach oben zur oberen Bande
  const k = [neueKugel(5, -300, 200)];
  k[0].vx = Math.cos(w) * 1500; k[0].vy = Math.sin(w) * 1500;
  let ev = [], vor = null;
  while (!ev.some(e => e.typ === 'bande')) { vor = { vx: k[0].vx, vy: k[0].vy }; Physik.schritt(k, e => ev.push(e)); }
  const nachW = Math.atan2(k[0].vy, k[0].vx) * 180 / Math.PI;
  ok(k[0].vy > 0, `Bande ${grad}°: Kugel prallt zurück`);
  ok(nahe(Math.abs(k[0].vy) / Math.abs(vor.vy), PHYSIK.E_BANDE, 0.03), `Bande ${grad}°: senkrechter Anteil mit Stoßzahl ${PHYSIK.E_BANDE}`);
  ok(nahe(k[0].vx / vor.vx, PHYSIK.BANDE_GLEIT, 0.03) || grad === 90, `Bande ${grad}°: Anteil entlang der Bande bleibt fast erhalten`);
  ok(Math.abs(k[0].y + TISCH.Y) >= R - 0.01, `Bande ${grad}°: Kugel dringt nicht in die Bande ein`);
  void nachW;
}
abschnitt('Starke Stöße ohne Durchtunneln');
{
  // Maximalstärke gegen eine einzelne Kugel, sehr nah und weit weg, schräg und gerade
  for (const [dx, dy, w] of [[2 * R + 0.5, 0, 0], [3 * R, 10, 0.05], [900, 0, 0], [600, 30, 0.04]]) {
    const k = [neueKugel(0, 0, 0), neueKugel(1, dx, dy)];
    Physik.stoss(k, w, PHYSIK.V_MAX * 1.5);
    const ev = lauf(k);
    ok(ev.some(e => e.typ === 'kugel'), `Treffer bei hoher Geschwindigkeit (Abstand ${dx})`);
  }
  // Weiße mit 1,5-facher Maximalgeschwindigkeit in alle Richtungen: bleibt immer auf dem Tisch oder fällt in eine Tasche
  let raus = 0;
  for (let i = 0; i < 72; i++) {
    const k = [neueKugel(0, 100, 50)];
    Physik.stoss(k, i * 5 * Math.PI / 180, PHYSIK.V_MAX * 1.5);
    for (let n = 0; n < 240 * 20 && Physik.inBewegung(k); n++) { Physik.schritt(k, null); if (k[0].aufTisch && !aufFlaeche(k[0])) raus++; }
  }
  ok(raus === 0, `keine Kugel verlässt den Tisch durch die Banden (${raus})`);
}
abschnitt('Anstoß: viele Aufbauten');
{
  let ueberlapp = 0, raus = 0, energieFehler = 0, legal = 0, n = 60;
  for (let s = 1; s <= n; s++) {
    const r = zufall(s * 11);
    const k = baueDreieck(r);
    ok(minAbstand(k) >= 2 * R, `Aufbau ${s}: keine Überlappung im Dreieck`);
    const w = k[0]; w.x = TISCH.kopfX - 30; w.y = (r() - 0.5) * 300;
    const spitze = k.filter(b => b.nr).sort((a, b) => a.x - b.x)[0];
    Physik.stoss(k, Math.atan2(spitze.y - w.y, spitze.x - w.x), PHYSIK.V_MAX);
    const p = new Stossprotokoll();
    let e0 = Physik.energie(k);
    for (let i = 0; i < 240 * 30 && Physik.inBewegung(k); i++) {
      Physik.schritt(k, e => p.ereignis(e));
      const e1 = Physik.energie(k);
      if (e1 > e0 * (1 + 1e-9) + 1e-6) energieFehler++;
      e0 = e1;
      if (minAbstand(k) < 2 * R - 0.01) ueberlapp++;
      for (const b of k) if (b.aufTisch && !aufFlaeche(b)) raus++;
    }
    if (p.versenkt.some(v => v.nr) || p.bandenKugeln.size >= 4) legal++;
    ok(!Physik.inBewegung(k), `Aufbau ${s}: alles kommt zur Ruhe`);
  }
  ok(ueberlapp === 0, `keine Überlappungen während der Anstöße (${ueberlapp})`);
  ok(raus === 0, `keine Kugel außerhalb der Spielfläche (${raus})`);
  ok(energieFehler === 0, `Kontaktbehandlung erzeugt nie Energie (${energieFehler})`);
  ok(legal >= n * 0.85, `kräftiger Anstoß ist meist gültig (${legal}/${n})`);
}
abschnitt('Ausrollen und Stillstand');
{
  const k = [neueKugel(5, -900, 0)]; k[0].vx = 900;
  let vorher = 900, steigt = 0, schritte = 0;
  while (Physik.inBewegung(k)) { Physik.schritt(k, null); const v = Math.hypot(k[0].vx, k[0].vy); if (v > vorher) steigt++; vorher = v; schritte++; }
  ok(steigt === 0, 'Geschwindigkeit nimmt beim Ausrollen nur ab');
  ok(k[0].vx === 0 && k[0].vy === 0, 'Restgeschwindigkeit wird exakt 0');
  ok(schritte > 240 && schritte < 240 * 10, `Ausrollzeit plausibel (${(schritte / 240).toFixed(1)} s)`);
  const weg = k[0].x + 900;
  ok(nahe(weg, Computer.rollWeg(900), 15), `Rollweg passt zur Formel (${weg.toFixed(0)} mm)`);
  // Ruhende, sich berührende Kugeln: keine Ereignisse, kein Zittern
  const r = [neueKugel(1, 0, 0), neueKugel(2, 2 * R, 0), neueKugel(3, R, R * Math.sqrt(3))];
  const vor = JSON.stringify(r.map(b => [b.x, b.y]));
  let ev = 0; for (let i = 0; i < 2400; i++) Physik.schritt(r, () => ev++);
  ok(ev === 0 && JSON.stringify(r.map(b => [b.x, b.y])) === vor, 'ruhende Kugeln in Berührung bleiben exakt liegen');
  // Schwächster Stoß bewegt die Kugel ein Stück, stärkster weit
  ok(Computer.rollWeg(staerkeZuTempo(0)) > 60 && Computer.rollWeg(staerkeZuTempo(0)) < 200, 'schwächster Stoß rollt einige Zentimeter');
  ok(Computer.rollWeg(staerkeZuTempo(1)) > 4 * TISCH.L, 'stärkster Stoß rollt mehrere Tischlängen (ohne Banden)');
  ok(nahe(tempoZuStaerke(staerkeZuTempo(0.37)), 0.37, 1e-9), 'Stärke ↔ Tempo umkehrbar');
}
abschnitt('Mehrere Kontakte gleichzeitig (Newton-Pendel)');
{
  const k = [neueKugel(0, -300, 0), neueKugel(1, 0, 0), neueKugel(2, 2 * R, 0), neueKugel(3, 4 * R, 0)];
  Physik.stoss(k, 0, 1500);
  for (let i = 0; i < 60; i++) Physik.schritt(k, null);
  ok(k[3].vx > 1200 && Math.abs(k[1].vx) < 150 && Math.abs(k[2].vx) < 150, 'Impuls wandert durch die Reihe zur letzten Kugel');
  ok(minAbstand(k) >= 2 * R - 1e-6, 'keine Überlappung in der Reihe');
}
abschnitt('Taschen');
{
  const rolle = (x, y, w, v) => { const k = [neueKugel(5, x, y)]; k[0].vx = Math.cos(w) * v; k[0].vy = Math.sin(w) * v; return { ev: lauf(k), k: k[0] }; };
  // Gerade in jede Tasche entlang ihrer Achse
  for (const t of TISCH.taschen) {
    const sx = t.kehle.x - t.achse.x * 500, sy = t.kehle.y - t.achse.y * 500;
    const r = rolle(sx, sy, Math.atan2(t.achse.y, t.achse.x), 1200);
    ok(!r.k.aufTisch && r.ev.some(e => e.typ === 'tasche' && e.tasche === t.nr), `gerade in Tasche ${t.name}`);
  }
  // Entlang der Bande in die Ecke
  const r = rolle(300, TISCH.Y - R - 2, 0, 1500);
  ok(r.ev.some(e => e.typ === 'tasche' && e.tasche === 3), 'entlang der unteren Bande in die Ecke unten rechts');
  // Knapp verfehlt: Zielpunkte entlang der Mundlinie der Ecktasche unten rechts.
  // In der Mitte fällt die Kugel, an den Backen prallt sie ab (keine magnetische Tasche).
  const eck = TISCH.taschen[3], [A, Bm] = eck.mund;
  const ziele = f => { const z = { x: A.x + (Bm.x - A.x) * f, y: A.y + (Bm.y - A.y) * f }; return rolle(400, 100, Math.atan2(z.y - 100, z.x - 400), 1500); };
  for (const f of [0.3, 0.5, 0.75]) ok(!ziele(f).k.aufTisch, `Mundlinie ${f}: fällt`);
  for (const f of [0.15, 0.95, 1.1]) { const r2 = ziele(f); ok(r2.k.aufTisch && r2.ev.some(e => e.typ === 'bande'), `Mundlinie ${f}: knapp verfehlt, prallt an der Backe ab`); }
  // Langsam auslaufende Kugel vor der Tasche bleibt liegen (keine magnetische Tasche)
  const k = [neueKugel(5, 0, TISCH.Y - R - 120)]; k[0].vy = Math.sqrt(2 * PHYSIK.ROLL_KONST * 40);
  lauf(k);
  ok(k[0].aufTisch, 'kurz vor der Mitteltasche liegen gebliebene Kugel fällt nicht hinein');
  ok(!taschenTrefferAlle(k[0]), 'Taschen ziehen nicht an');
  // Kugel quer an der Mitteltasche vorbei (flacher Winkel) fällt nicht
  // Nach dem Fallen ist die Kugel aus der aktiven Physik
  const f = [neueKugel(0, -300, 0), neueKugel(5, TISCH.X - 250, TISCH.Y - 250)];
  const tt = TISCH.taschen[3];
  f[1].vx = tt.achse.x * 900; f[1].vy = tt.achse.y * 900;
  lauf(f);
  ok(!f[1].aufTisch && f[1].fall && f[1].fall.tasche === 3, 'gefallene Kugel ist nicht mehr auf dem Tisch und hat Fallanimation');
  Physik.stoss(f, Math.atan2(tt.kehle.y, tt.kehle.x - -300), 2000);
  const ev2 = lauf(f);
  ok(!ev2.some(e => e.typ === 'kugel' && (e.a === 5 || e.b === 5)), 'gefallene Kugel wird nicht mehr getroffen');
}
function taschenTrefferAlle(k) { return L.taschenTreffer(k.x, k.y, R); }

// ================= ZIELVORSCHAU =================
abschnitt('Zielvorschau = tatsächlicher erster Kontakt');
{
  const r = zufall(99);
  let gleich = 0, n = 300, kugelFaelle = 0;
  for (let i = 0; i < n; i++) {
    const k = baueDreieck(zufall(i + 5));
    // Kugeln zufällig verteilen (gültige Plätze)
    for (const b of k) { const p = naechsterFreierPlatz(k.filter(x => x !== b), (r() - 0.5) * 1800, (r() - 0.5) * 900); b.x = p.x; b.y = p.y; }
    const w = k[0], winkel = r() * Math.PI * 2;
    const v = wirfStrahl(k, w.x, w.y, Math.cos(winkel), Math.sin(winkel), [0]);
    const kopie = Physik.kopie(k);
    Physik.stoss(kopie, winkel, 1500);
    const ev = lauf(kopie);
    const erstes = ev.find(e => (e.typ === 'kugel' && (e.a === 0 || e.b === 0)) || (e.typ === 'bande' && e.kugel === 0) || (e.typ === 'tasche' && e.kugel === 0));
    let passt = false;
    if (v.art === 'kugel') passt = erstes && erstes.typ === 'kugel' && (erstes.a === v.kugel || erstes.b === v.kugel);
    else if (v.art === 'bande') passt = erstes && erstes.typ === 'bande';
    else if (v.art === 'tasche') passt = erstes && erstes.typ === 'tasche';
    if (v.art === 'kugel') kugelFaelle++;
    if (passt) gleich++;
    else if (fehler.length < 30) console.log('   Vorschau', v.art, v.kugel, 'tatsächlich', JSON.stringify(erstes));
    // Linie geht nie durch eine andere Kugel: Abstand jeder Kugel zum Strahl bis zum Treffer ≥ 2R
    for (const b of k) {
      if (b.nr === 0 || (v.art === 'kugel' && b.nr === v.kugel)) continue;
      const ax = b.x - w.x, ay = b.y - w.y, t = ax * Math.cos(winkel) + ay * Math.sin(winkel);
      if (t < 0 || t > v.t) continue;
      const q = Math.abs(ax * Math.sin(winkel) - ay * Math.cos(winkel));
      if (q < 2 * R - 0.01) { ok(false, 'Vorschaulinie geht durch eine Kugel'); break; }
    }
  }
  ok(gleich === n, `Vorschau und Simulation stimmen überein (${gleich}/${n}, davon ${kugelFaelle} Kugeltreffer)`);
}

// ================= AUFBAU UND PLATZIEREN =================
abschnitt('Aufbau');
{
  for (let s = 1; s <= 200; s++) {
    const k = baueDreieck(zufall(s));
    const pl = L.dreieckPlaetze();
    const nr = (reihe, j) => { const p = pl.find(q => q.reihe === reihe && q.j === j); return k.find(b => b.nr && Math.hypot(b.x - p.x, b.y - p.y) < 1).nr; };
    if (nr(2, 1) !== 8) { ok(false, 'Acht nicht in der Mitte'); break; }
    const ecken = [gruppeVon(nr(4, 0)), gruppeVon(nr(4, 4))].sort().join();
    if (ecken !== 'halb,voll') { ok(false, 'hintere Ecken nicht voll + halb'); break; }
    if (new Set(k.map(b => b.nr)).size !== 16) { ok(false, 'nicht 16 verschiedene Kugeln'); break; }
    if (minAbstand(k) < 2 * R) { ok(false, 'Überlappung im Aufbau'); break; }
  }
  ok(true, '200 Aufbauten: Acht Mitte, Ecken voll/halb, 16 Kugeln, keine Überlappung');
  const k = baueDreieck(zufall(1));
  ok(k[0].x < TISCH.kopfX, 'Weiße beginnt im Kopffeld');
  // Mischen ist fair: jede Nummer landet mal an der Spitze
  const spitzen = new Set();
  for (let s = 1; s <= 300; s++) { const kk = baueDreieck(zufall(s)); spitzen.add(kk.filter(b => b.nr).sort((a, b) => a.x - b.x)[0].nr); }
  ok(spitzen.size >= 12 && !spitzen.has(8), `Spitze wird fair gemischt (${spitzen.size} verschiedene Kugeln, nie die Acht)`);
}
abschnitt('Ball in Hand / Platzieren');
{
  const k = baueDreieck(zufall(3));
  const acht = k.find(b => b.nr === 8);
  ok(!platzGueltig(k, acht.x, acht.y, { ohne: 0 }), 'auf einer Kugel ungültig');
  ok(!platzGueltig(k, acht.x - 2 * R + 1, acht.y, { ohne: 0 }), 'knapp überlappend ungültig');
  ok(!platzGueltig(k, TISCH.taschen[0].kehle.x, TISCH.taschen[0].kehle.y, { ohne: 0 }), 'in einer Ecktasche ungültig');
  ok(!platzGueltig(k, 0, -TISCH.Y - 10, { ohne: 0 }), 'in einer Mitteltasche ungültig');
  ok(!platzGueltig(k, TISCH.X - R + 2, 0, { ohne: 0 }), 'in der Bande ungültig');
  ok(platzGueltig(k, -500, 200, { ohne: 0 }), 'freie Stelle gültig');
  ok(!platzGueltig(k, 0, 0, { ohne: 0, nurKopffeld: true }), 'beim Anstoß nur im Kopffeld');
  ok(platzGueltig(k, TISCH.kopfX - 10, 0, { ohne: 0, nurKopffeld: true }), 'Kopffeld gültig');
  const r = zufall(5); let schlecht = 0;
  for (let i = 0; i < 500; i++) {
    const p = naechsterFreierPlatz(k, (r() - 0.5) * 2400, (r() - 0.5) * 1400, { ohne: 0 });
    if (!p || !platzGueltig(k, p.x, p.y, { ohne: 0 }) || minAbstand([...k.filter(b => b.nr), neueKugel(0, p.x, p.y)]) < 2 * R) schlecht++;
  }
  ok(schlecht === 0, `nächster freier Platz ist immer gültig und überlappungsfrei (${schlecht})`);
  // Acht wieder einsetzen: Fußpunkt frei → dorthin; belegt → dahinter
  const k2 = [neueKugel(0, -300, 0), neueKugel(8, 0, 0), neueKugel(3, TISCH.fussX, 0)];
  k2[1].aufTisch = false;
  setzeAchtEin(k2);
  ok(k2[1].aufTisch && k2[1].x > TISCH.fussX && Math.abs(k2[1].y) < 1e-9 && minAbstand(k2) >= 2 * R, 'Acht wird hinter einer Kugel auf dem Fußpunkt eingesetzt');
}

// ================= REGELN =================
abschnitt('Regeln mit definierten Stoßereignissen');
const alle = () => new Set([0, ...L.VOLLE, 8, ...L.HALBE]);
function prot(ereignisse) { const p = new Stossprotokoll(); for (const e of ereignisse) p.ereignis(e); return p; }
const K = (a, b) => ({ typ: 'kugel', a, b, staerke: 500 });
const B = k => ({ typ: 'bande', kugel: k, staerke: 300 });
const T = (k, t = 0) => ({ typ: 'tasche', kugel: k, tasche: t });
const z = (o = {}) => ({ amZug: 0, gruppen: [null, null], anstoss: false, angesagt: null, aufTisch: alle(), ...o });
{
  // Anstoß
  let e = werteStossAus(z({ anstoss: true }), prot([K(0, 1), K(1, 2), T(2, 1)]));
  ok(e.anstossLegal && !e.foul && e.weiter && e.gruppen[0] === null, 'Anstoß mit versenkter Kugel: gültig, weiter, Tisch offen');
  e = werteStossAus(z({ anstoss: true }), prot([K(0, 1), B(1), B(2), B(3), B(4)]));
  ok(e.anstossLegal && !e.weiter && e.naechster === 1, 'Anstoß mit 4 Bandenkugeln: gültig, Wechsel');
  e = werteStossAus(z({ anstoss: true }), prot([K(0, 1), B(1), B(2), B(3), B(0), B(1)]));
  ok(!e.anstossLegal && e.neuAufbauWahl && e.naechster === 1, 'Anstoß mit 3 Bandenkugeln (Weiße zählt nicht): ungültig, andere darf neu aufbauen');
  e = werteStossAus(z({ anstoss: true }), prot([K(0, 1), T(8, 2)]));
  ok(e.anstossLegal && e.achtEinsetzen && !e.ende && !e.weiter, 'Acht beim Anstoß: wird eingesetzt, kein Sieg/keine Niederlage, Wechsel');
  e = werteStossAus(z({ anstoss: true }), prot([K(0, 1), T(8, 2), T(3, 1)]));
  ok(e.achtEinsetzen && !e.ende && e.weiter, 'Acht + andere Kugel beim Anstoß: Acht zurück, weiter');
  e = werteStossAus(z({ anstoss: true }), prot([K(0, 1), T(3, 1), T(0, 4)]));
  ok(e.anstossLegal && e.foul === 'weisse' && e.ballInHand && e.naechster === 1, 'Weiße fällt beim Anstoß: Ball in Hand für die andere Seite');
  e = werteStossAus(z({ anstoss: true }), prot([K(0, 1), T(8, 0), T(0, 4)]));
  ok(!e.ende && e.achtEinsetzen, 'Acht und Weiße beim Anstoß: keine Niederlage (Anstoßregel hat Vorrang)');
  e = werteStossAus(z({ anstoss: true, amZug: 1 }), prot([B(0)]));
  ok(e.neuAufbauWahl && e.naechster === 0, 'Anstoß ohne Treffer: ungültig');

  // Gruppenzuweisung
  e = werteStossAus(z(), prot([K(0, 3), T(3, 0)]));
  ok(!e.foul && e.gruppen[0] === 'voll' && e.gruppen[1] === 'halb' && e.weiter, 'offener Tisch: volle versenkt → Volle, weiter');
  e = werteStossAus(z(), prot([K(0, 3), T(12, 0), T(3, 1)]));
  ok(e.gruppen[0] === 'halb', 'beide Gruppen fallen: zuerst gefallene (halbe) entscheidet');
  e = werteStossAus(z(), prot([K(0, 3), T(3, 0), T(0, 2)]));
  ok(e.foul === 'weisse' && e.gruppen[0] === null && e.ballInHand, 'Foul: keine Gruppe vergeben');
  e = werteStossAus(z(), prot([K(0, 8), B(8)]));
  ok(e.foul === 'falsch', 'offener Tisch: Acht zuerst getroffen ist Foul');
  e = werteStossAus(z(), prot([K(0, 11), T(4, 0)]));
  ok(!e.foul && e.gruppen[0] === 'voll' && e.weiter, 'offener Tisch: halbe getroffen, volle versenkt → Volle');

  // Legaler Stoß / Fouls
  const g = { gruppen: ['voll', 'halb'] };
  e = werteStossAus(z(g), prot([K(0, 2), T(2, 3)]));
  ok(!e.foul && e.weiter && e.naechster === 0, 'eigene Kugel versenkt: bleibt am Zug');
  e = werteStossAus(z(g), prot([K(0, 2), B(2)]));
  ok(!e.foul && !e.weiter && e.naechster === 1, 'eigene getroffen, Bande, nichts gefallen: Wechsel ohne Foul');
  e = werteStossAus(z(g), prot([K(0, 2), T(10, 0)]));
  ok(!e.foul && !e.weiter && e.naechster === 1, 'nur fremde Kugel gefallen: Wechsel');
  e = werteStossAus(z(g), prot([K(0, 2), T(10, 0), T(5, 1)]));
  ok(!e.foul && e.weiter, 'eigene und fremde gefallen: weiter');
  e = werteStossAus(z(g), prot([B(0), B(0)]));
  ok(e.foul === 'nichts' && e.ballInHand && e.foulText.includes('keine Kugel'), 'Foul: keine Kugel getroffen');
  e = werteStossAus(z(g), prot([K(0, 12), B(12)]));
  ok(e.foul === 'falsch' && e.foulText.startsWith('Foul: zuerst die falsche Kugel getroffen.'), 'Foul: falsche Kugel zuerst (Text)');
  e = werteStossAus(z(g), prot([K(0, 2), T(0, 1)]));
  ok(e.foul === 'weisse', 'Foul: Weiße versenkt');
  e = werteStossAus(z(g), prot([B(0), K(0, 2)]));
  ok(e.foul === 'bande', 'Foul: Bande nur vor dem Kontakt, danach nichts');
  e = werteStossAus(z(g), prot([K(0, 2), B(0)]));
  ok(!e.foul, 'Weiße erreicht nach dem Kontakt eine Bande: gültig');
  e = werteStossAus(z(g), prot([K(0, 2), T(2, 0), T(0, 1)]));
  ok(e.foul === 'weisse' && !e.weiter && e.naechster === 1, 'Foul beendet den Zug, auch wenn eine eigene Kugel fiel');
  e = werteStossAus(z(g), prot([K(0, 8), B(8)]));
  ok(e.foul === 'falsch', 'Acht zuerst, solange eigene Kugeln da sind: Foul');

  // Acht
  const nurNoch = new Set([0, 8, 9, 10]);
  const aufAcht = { gruppen: ['voll', 'halb'], aufTisch: nurNoch, angesagt: 2 };
  e = werteStossAus(z(aufAcht), prot([K(0, 8), T(8, 2)]));
  ok(e.ende && e.ende.sieger === 0, 'Acht legal in die angesagte Tasche: Sieg');
  e = werteStossAus(z(aufAcht), prot([K(0, 8), T(8, 4)]));
  ok(e.ende && e.ende.sieger === 1 && e.ende.grund.includes('falsche Tasche'), 'Acht in falsche Tasche: Niederlage');
  e = werteStossAus(z(aufAcht), prot([K(0, 8), T(8, 2), T(0, 5)]));
  ok(e.ende && e.ende.sieger === 1 && e.ende.grund.includes('Foul'), 'Acht mit Foul (Weiße fällt mit): Niederlage');
  e = werteStossAus(z(aufAcht), prot([K(0, 9), T(8, 2)]));
  ok(e.ende && e.ende.sieger === 1, 'Acht nach falscher erster Kugel: Niederlage');
  e = werteStossAus(z(g), prot([K(0, 2), T(8, 0)]));
  ok(e.ende && e.ende.sieger === 1 && e.ende.grund.includes('zu früh'), 'Acht zu früh: Niederlage');
  e = werteStossAus(z({ ...g, aufTisch: new Set([0, 1, 8, 9]) }), prot([K(0, 1), T(1, 0), T(8, 3)]));
  ok(e.ende && e.ende.sieger === 1, 'letzte eigene und Acht im selben Stoß: zu früh → Niederlage');
  e = werteStossAus(z({ ...aufAcht, amZug: 1, gruppen: ['halb', 'voll'] }), prot([K(0, 8), T(8, 2)]));
  ok(e.ende && e.ende.sieger === 1, 'Sieg zählt für die Person am Zug (Spieler 2)');
  e = werteStossAus(z(aufAcht), prot([K(0, 8), B(8)]));
  ok(!e.ende && !e.foul && e.naechster === 1, 'Acht verfehlt die Tasche: einfacher Wechsel');
  e = werteStossAus(z(), prot([K(0, 3), T(8, 0)]));
  ok(e.ende && e.ende.sieger === 1, 'offener Tisch, Acht fällt: Niederlage');
  ok(JSON.stringify(erlaubteZiele('voll', nurNoch)) === '[8]', 'erlaubtes Ziel nach eigener Gruppe: nur die Acht');

  // Training
  const t = werteTrainingAus(prot([K(0, 8), T(8, 0), T(0, 1)]));
  ok(t.weiter && t.ballInHand && t.gefallen === 1, 'Training: Acht ohne Folgen, Weiße wird neu gelegt');
}

// ================= COMPUTER =================
abschnitt('Computer');
function plane(lage, stufe, saat = 1) {
  const p = Computer.planer(lage, stufe, zufall(saat));
  let scheiben = 0, maxMs = 0;
  while (true) { const t0 = Date.now(); const f = p.arbeite(5); maxMs = Math.max(maxMs, Date.now() - t0); scheiben++; if (f) break; if (scheiben > 2000) break; }
  return { e: p.ergebnis, scheiben, maxMs };
}
{
  // Einfache Lage: Weiße, eine volle Kugel vor der Ecktasche
  const t = TISCH.taschen[2];
  const k = [neueKugel(0, 0, 150), neueKugel(3, t.kehle.x - t.achse.x * 300, t.kehle.y - t.achse.y * 300), neueKugel(8, -500, 200), neueKugel(11, -300, -300)];
  for (const stufe of ['entspannt', 'herausfordernd']) {
    const { e } = plane({ kugeln: k, gruppe: 'voll', anstoss: false, ballInHand: null, modus: '8ball' }, stufe);
    ok(e.kugel === 3 && e.art === 'loch', `${stufe}: wählt die legale Kugel 3 als Lochstoß`);
    // ohne Ungenauigkeit gespielt: fällt
    const kk = Physik.kopie(k); Physik.stoss(kk, e.winkel, staerkeZuTempo(e.staerke));
    const p = prot(lauf(kk));
    ok(p.ersterKontakt === 3 && p.versenkt.some(v => v.nr === 3) && !p.versenkt.some(v => v.nr === 0), `${stufe}: geplanter Stoß versenkt Kugel 3 ohne Foul`);
  }
  // Hindernis: Kugel 3 ist verdeckt, Kugel 5 frei
  const k2 = [neueKugel(0, -600, 0), neueKugel(3, 300, 0), neueKugel(12, -300, 0), neueKugel(13, -300, 2 * R + 1), neueKugel(14, -300, -2 * R - 1), neueKugel(5, -100, 350), neueKugel(8, 600, -300)];
  const { e: e2 } = plane({ kugeln: k2, gruppe: 'voll', anstoss: false, ballInHand: null, modus: '8ball' }, 'herausfordernd');
  ok(e2.kugel === 5 || e2.art === 'sicher', 'verdeckte Kugel wird nicht direkt angespielt');
  const kk2 = Physik.kopie(k2); Physik.stoss(kk2, e2.winkel, staerkeZuTempo(e2.staerke));
  const p2 = prot(lauf(kk2));
  ok(p2.ersterKontakt !== null && [3, 5].includes(p2.ersterKontakt), `trifft zuerst eine eigene Kugel (${p2.ersterKontakt})`);
  // Acht: Tasche wird angesagt
  const k3 = [neueKugel(0, -200, 100), neueKugel(8, 300, -100), neueKugel(9, -700, 300)];
  const { e: e3 } = plane({ kugeln: k3, gruppe: 'voll', anstoss: false, ballInHand: null, modus: '8ball' }, 'herausfordernd');
  ok(Number.isInteger(e3.tasche) && e3.tasche >= 0 && e3.tasche < 6, 'sagt vor dem Stoß auf die Acht eine Tasche an');
  // Ball in Hand: gültiger Platz
  for (let s = 1; s <= 12; s++) {
    const k4 = baueDreieck(zufall(s)); Physik.stoss(k4, 0.002 * s, PHYSIK.V_MAX); lauf(k4);
    const w = k4[0]; w.aufTisch = false;
    for (const stufe of ['entspannt', 'herausfordernd']) {
      const { e, maxMs } = plane({ kugeln: k4, gruppe: s % 2 ? 'voll' : null, anstoss: false, ballInHand: 'tisch', modus: '8ball' }, stufe, s);
      ok(e.weiss && platzGueltig(k4, e.weiss.x, e.weiss.y, { ohne: 0 }), `Ball in Hand (${stufe}, Lage ${s}): gültiger Platz`);
      ok(maxMs < 60, `Zeitscheiben bleiben kurz (${stufe}, Lage ${s}: ${maxMs} ms)`);
    }
  }
  // Anstoß: Kopffeld
  const { e: e5 } = plane({ kugeln: baueDreieck(zufall(2)), gruppe: null, anstoss: true, ballInHand: 'kopffeld', modus: '8ball' }, 'entspannt');
  ok(e5.weiss && e5.weiss.x <= TISCH.kopfX && e5.staerke > 0.8, 'Anstoß aus dem Kopffeld mit viel Kraft');
}

// Ganze Partien: Computer gegen Computer mit denselben Regeln wie im Spiel
abschnitt('Komplette Partien Computer gegen Computer');
function partie(saat, stufen) {
  const r = zufall(saat);
  let kugeln = baueDreieck(r);
  let amZug = 0, gruppen = [null, null], anstoss = true, bih = 'kopffeld', stoesse = 0, fouls = 0, ueberlapp = 0, ungueltigePlaetze = 0, maxSims = 0;
  const log = [];
  while (stoesse < 300) {
    const lage = { kugeln, gruppe: gruppen[amZug], anstoss, ballInHand: bih, modus: '8ball' };
    const p = Computer.planer(lage, stufen[amZug], r); while (!p.arbeite(50));
    maxSims = Math.max(maxSims, p.ergebnis.simulationen || 0);
    const plan = Computer.ungenau(p.ergebnis, stufen[amZug], r);
    if (bih) {
      const pos = plan.weiss;
      if (!pos || !platzGueltig(kugeln, pos.x, pos.y, { ohne: 0, nurKopffeld: bih === 'kopffeld' })) ungueltigePlaetze++;
      const w = kugeln[0]; Object.assign(w, { x: pos.x, y: pos.y, vx: 0, vy: 0, aufTisch: true, fall: null });
    }
    const vorher = new Set(kugeln.filter(k => k.aufTisch).map(k => k.nr));
    Physik.stoss(kugeln, plan.winkel, staerkeZuTempo(plan.staerke));
    const pr = new Stossprotokoll();
    for (let i = 0; i < 240 * 40 && Physik.inBewegung(kugeln); i++) { Physik.schritt(kugeln, e => pr.ereignis(e)); if (i % 8 === 0 && minAbstand(kugeln) < 2 * R - 0.01) ueberlapp++; }
    for (const k of kugeln) k.fall = null;
    stoesse++;
    const e = werteStossAus({ amZug, gruppen, anstoss, angesagt: plan.tasche, aufTisch: vorher }, pr);
    if (e.foul) fouls++;
    log.push(`${amZug}:${e.foul || (e.weiter ? '+' : '-')}`);
    if (e.ende) return { sieger: e.ende.sieger, grund: e.ende.grund, stoesse, fouls, ueberlapp, ungueltigePlaetze, maxSims, log };
    if (e.neuAufbauWahl) { kugeln = baueDreieck(r); amZug = 1 - amZug; gruppen = [null, null]; anstoss = true; bih = 'kopffeld'; continue; }
    if (e.achtEinsetzen) setzeAchtEin(kugeln);
    gruppen = e.gruppen; anstoss = false;
    bih = e.ballInHand ? 'tisch' : null;
    if (!kugeln[0].aufTisch) bih = 'tisch';
    amZug = e.naechster;
  }
  return { sieger: null, stoesse, fouls, ueberlapp, ungueltigePlaetze, maxSims, log };
}
{
  const t0 = Date.now();
  let fertig = 0, siegeH = 0, n = 0, alleStoesse = 0;
  const gruende = {};
  for (let s = 1; s <= 16; s++) {
    // abwechselnd: wer stößt an, wer ist stärker
    const stufen = s % 2 ? ['herausfordernd', 'entspannt'] : ['entspannt', 'herausfordernd'];
    const p = partie(s, stufen);
    n++;
    if (p.sieger !== null) { fertig++; if (stufen[p.sieger] === 'herausfordernd') siegeH++; gruende[p.grund] = (gruende[p.grund] || 0) + 1; }
    alleStoesse += p.stoesse;
    ok(p.ueberlapp === 0, `Partie ${s}: keine Überlappungen`);
    ok(p.ungueltigePlaetze === 0, `Partie ${s}: alle Ball-in-Hand-Plätze gültig`);
    ok(p.maxSims <= 130, `Partie ${s}: Rechenaufwand begrenzt (${p.maxSims} Simulationen)`);
  }
  console.log(`   ${fertig}/${n} Partien beendet, Ø ${(alleStoesse / n).toFixed(0)} Stöße, Herausfordernd gewinnt ${siegeH}/${fertig}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log('   Gründe:', JSON.stringify(gruende));
  ok(fertig === n, 'alle Partien enden mit einem Sieger');
  ok(siegeH >= fertig * 0.6, `„Herausfordernd“ gewinnt meistens gegen „Entspannt“ (${siegeH}/${fertig})`);
}

console.log(`\n${geprueft} Prüfungen, ${fehler.length} Fehler`);
process.exit(fehler.length ? 1 : 0);
