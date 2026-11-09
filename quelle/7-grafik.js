// ===================================================================
// 7 · GRAFIK
// Ansicht: rechnet Welt (mm) ↔ Bildschirm (CSS-Pixel). Im Hochformat
// wird der Tisch um 90° gedreht, sonst liegt er quer. Eingaben,
// Zielhilfe, Taschenwahl und Zeichnen benutzen alle DIESE Umrechnung.
// Die Weltpositionen ändern sich durch Größenänderungen nie.
// ===================================================================

const Ansicht = {
  gedreht: false, s: 0.3, cx: 0, cy: 0, w: 1, h: 1, dpr: 1,
  // Außenmaß des Tisches mit Rahmen (halbe Breite/Höhe in mm)
  get aussenX() { return TISCH.X + TISCH.BANDE + TISCH.RAHMEN; },
  get aussenY() { return TISCH.Y + TISCH.BANDE + TISCH.RAHMEN; },
  passe(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const rand = Math.min(14, Math.min(w, h) * 0.03);
    const quer = Math.min((w - 2 * rand) / (2 * this.aussenX), (h - 2 * rand) / (2 * this.aussenY));
    const hoch = Math.min((w - 2 * rand) / (2 * this.aussenY), (h - 2 * rand) / (2 * this.aussenX));
    // Drehen, sobald der Tisch dadurch größer wird (Handy hochkant, auch kurze Bildschirme)
    this.gedreht = hoch > quer * 1.001;
    this.s = Math.max(0.01, this.gedreht ? hoch : quer);
    this.cx = w / 2; this.cy = h / 2;
  },
  // gedreht: Welt +x zeigt nach oben, Welt +y nach rechts (Drehung ohne Spiegelung)
  zuBild(x, y) {
    return this.gedreht ? { x: this.cx + y * this.s, y: this.cy - x * this.s } : { x: this.cx + x * this.s, y: this.cy + y * this.s };
  },
  zuWelt(px, py) {
    const u = (px - this.cx) / this.s, v = (py - this.cy) / this.s;
    return this.gedreht ? { x: -v, y: u } : { x: u, y: v };
  },
  // Richtung (Welt) → Richtung (Bild) und zurück
  welt2d(c) {
    const s = this.s * this.dpr;
    if (this.gedreht) c.setTransform(0, -s, s, 0, this.cx * this.dpr, this.cy * this.dpr);
    else c.setTransform(s, 0, 0, s, this.cx * this.dpr, this.cy * this.dpr);
  },
  bild2d(c) { c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); },
};

const Grafik = (() => {
  const FARBE = {
    tuch: '#169C8F', tuchHell: '#22B5A5', tuchDunkel: '#0E7469',
    bande: '#11806F', bandeKante: '#0A5A4F',
    holz: '#5A3420', holzHell: '#8A5634', holzDunkel: '#2E190E',
    messing: '#D9A945', messingHell: '#FFE29A', messingDunkel: '#8C6420',
    creme: '#FFF4DC', gelb: '#FFD35A', koralle: '#FF805B', tuerkis: '#24D6CD', marine: '#10243A',
  };
  const R = TISCH.R;
  let hintergrund = null, hgSchluessel = '';

  // ---------- Kneipenkulisse (wird zwischengespeichert) ----------
  function malHintergrund(c, w, h) {
    const v = c.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, '#1b1612'); v.addColorStop(1, '#120d0a');
    c.fillStyle = v; c.fillRect(0, 0, w, h);
    // Dielenboden: ruhige, schmale Holzbahnen
    const breite = Math.max(26, Math.min(w, h) / 9);
    for (let i = 0, x = 0; x < w; i++, x += breite) {
      c.fillStyle = i % 2 ? 'rgba(120, 76, 44, 0.16)' : 'rgba(150, 96, 56, 0.12)';
      c.fillRect(x, 0, breite - 1.5, h);
      c.fillStyle = 'rgba(0, 0, 0, 0.25)';
      c.fillRect(x + breite - 1.5, 0, 1.5, h);
      // Stöße der Dielen versetzt
      const versatz = ((i * 137) % 5) / 5 * h * 0.5;
      for (let y = versatz; y < h; y += h * 0.55) c.fillRect(x, y, breite - 1.5, 1.2);
    }
    // Warmes Lampenlicht über dem Tisch
    const licht = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    licht.addColorStop(0, 'rgba(255, 196, 120, 0.22)');
    licht.addColorStop(0.5, 'rgba(255, 170, 90, 0.07)');
    licht.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    c.fillStyle = licht; c.fillRect(0, 0, w, h);
    // Dezente maritime Dinge am Rand, nur wenn neben dem Tisch Platz ist
    const randX = Ansicht.gedreht ? (w - 2 * Ansicht.aussenY * Ansicht.s) / 2 : (w - 2 * Ansicht.aussenX * Ansicht.s) / 2;
    if (randX > 90) {
      const r = Math.min(randX * 0.32, 46);
      bullauge(c, randX / 2, h * 0.28, r);
      rettungsring(c, w - randX / 2, h * 0.7, r * 0.9);
      bullauge(c, w - randX / 2, h * 0.26, r * 0.8);
    }
  }
  function bullauge(c, x, y, r) {
    const meer = c.createLinearGradient(0, y - r, 0, y + r);
    meer.addColorStop(0, '#1d3d66'); meer.addColorStop(0.55, '#24577f'); meer.addColorStop(0.56, '#123050'); meer.addColorStop(1, '#0b1d33');
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = meer; c.fill();
    c.beginPath(); c.arc(x + r * 0.35, y - r * 0.3, r * 0.14, 0, Math.PI * 2); c.fillStyle = 'rgba(255, 244, 220, 0.8)'; c.fill();
    c.lineWidth = r * 0.22; c.strokeStyle = FARBE.messingDunkel; c.beginPath(); c.arc(x, y, r * 1.05, 0, Math.PI * 2); c.stroke();
    c.lineWidth = r * 0.08; c.strokeStyle = FARBE.messing; c.beginPath(); c.arc(x, y, r * 1.05, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) { const w = i / 8 * Math.PI * 2; c.beginPath(); c.arc(x + Math.cos(w) * r * 1.05, y + Math.sin(w) * r * 1.05, r * 0.05, 0, Math.PI * 2); c.fillStyle = FARBE.messingHell; c.fill(); }
    c.globalAlpha = 1;
  }
  function rettungsring(c, x, y, r) {
    c.lineWidth = r * 0.42;
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.arc(x, y, r * 0.78, i * Math.PI / 2, (i + 1) * Math.PI / 2);
      c.strokeStyle = i % 2 ? 'rgba(255, 244, 220, 0.55)' : 'rgba(255, 128, 91, 0.55)'; c.stroke();
    }
    c.lineWidth = r * 0.05; c.strokeStyle = 'rgba(200, 170, 120, 0.5)';
    c.beginPath(); c.arc(x, y, r * 0.78, 0, Math.PI * 2); c.stroke();
  }

  // ---------- Tisch ----------
  function rundRechteck(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // Zeichnet den Tisch in Weltkoordinaten (Transformation ist gesetzt)
  function malTisch(c, kopffeld) {
    const X = TISCH.X, Y = TISCH.Y, AX = Ansicht.aussenX, AY = Ansicht.aussenY;
    // Schatten des Tisches
    c.save();
    c.shadowColor = 'rgba(0, 0, 0, 0.6)'; c.shadowBlur = 60 * Ansicht.s * Ansicht.dpr; c.shadowOffsetY = 0;
    rundRechteck(c, -AX, -AY, 2 * AX, 2 * AY, 70); c.fillStyle = FARBE.holzDunkel; c.fill();
    c.restore();
    // Holzrahmen mit warmem Verlauf
    const holz = c.createLinearGradient(0, -AY, 0, AY);
    holz.addColorStop(0, '#6E4128'); holz.addColorStop(0.5, FARBE.holz); holz.addColorStop(1, '#43261A');
    rundRechteck(c, -AX, -AY, 2 * AX, 2 * AY, 70); c.fillStyle = holz; c.fill();
    // Maserung: feine, ruhige Linien
    c.save(); rundRechteck(c, -AX, -AY, 2 * AX, 2 * AY, 70); c.clip();
    c.strokeStyle = 'rgba(30, 14, 6, 0.25)'; c.lineWidth = 3;
    for (let i = -6; i <= 6; i++) {
      c.beginPath(); c.moveTo(-AX, i * 55 + 8); c.bezierCurveTo(-AX * 0.4, i * 55 - 12, AX * 0.3, i * 55 + 20, AX, i * 55 - 4); c.stroke();
    }
    c.restore();
    // Warme Lichtkante außen und innen
    c.lineWidth = 6; c.strokeStyle = 'rgba(255, 196, 130, 0.35)';
    rundRechteck(c, -AX + 4, -AY + 4, 2 * AX - 8, 2 * AY - 8, 66); c.stroke();
    // Tauwerk-Intarsie (gedrehtes Seil) als dezente maritime Verzierung
    const tau = 46;
    c.setLineDash([16, 10]); c.lineWidth = 7; c.strokeStyle = 'rgba(214, 178, 118, 0.42)';
    rundRechteck(c, -AX + tau, -AY + tau, 2 * (AX - tau), 2 * (AY - tau), 40); c.stroke();
    c.setLineDash([]);

    // Tuch (bis zu den Bandennasen und in die Taschenöffnungen)
    const tuch = c.createRadialGradient(0, 0, 50, 0, 0, X * 1.1);
    tuch.addColorStop(0, FARBE.tuchHell); tuch.addColorStop(0.65, FARBE.tuch); tuch.addColorStop(1, FARBE.tuchDunkel);
    c.fillStyle = tuch;
    c.fillRect(-X - TISCH.BANDE, -Y - TISCH.BANDE, 2 * (X + TISCH.BANDE), 2 * (Y + TISCH.BANDE));

    // Taschen (Löcher): Vorderkante liegt an der Kehle
    for (const t of TISCH.taschen) {
      const { x: mx, y: my, r } = t.zeichen;
      const g = c.createRadialGradient(mx - t.achse.x * r * 0.4, my - t.achse.y * r * 0.4, r * 0.1, mx, my, r);
      g.addColorStop(0, '#000'); g.addColorStop(0.75, '#07090c'); g.addColorStop(1, '#1d1a17');
      c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    }
    // Banden (Gummi mit Tuch bezogen), inklusive Taschenbacken
    for (const sy of [-1, 1]) {
      const ecL = TISCH.taschen.find(t => t.art === 'ecke' && t.ecke.x < 0 && Math.sign(t.ecke.y) === sy);
      const ecR = TISCH.taschen.find(t => t.art === 'ecke' && t.ecke.x > 0 && Math.sign(t.ecke.y) === sy);
      const mi = TISCH.taschen.find(t => t.art === 'mitte' && Math.sign(t.kehle.y) === sy);
      bandenStueck(c, [ecL.kehlePunkte[0], ecL.mund[0], mi.mund[0], mi.kehlePunkte[0]], 'y', sy);
      bandenStueck(c, [mi.kehlePunkte[1], mi.mund[1], ecR.mund[0], ecR.kehlePunkte[0]], 'y', sy);
    }
    for (const sx of [-1, 1]) {
      const oben = TISCH.taschen.find(t => t.art === 'ecke' && Math.sign(t.ecke.x) === sx && t.ecke.y < 0);
      const unten = TISCH.taschen.find(t => t.art === 'ecke' && Math.sign(t.ecke.x) === sx && t.ecke.y > 0);
      bandenStueck(c, [oben.kehlePunkte[1], oben.mund[1], unten.mund[1], unten.kehlePunkte[1]], 'x', sx);
    }
    // Messing: Eckbeschläge und Mittelbeschläge mit Nieten
    for (const t of TISCH.taschen) messingBeschlag(c, t);
    // Diamanten (Markierungen) als kleine Perlmutt-Punkte in Messingfassung
    const diamant = (x, y) => {
      c.beginPath(); c.moveTo(x, y - 13); c.lineTo(x + 9, y); c.lineTo(x, y + 13); c.lineTo(x - 9, y); c.closePath();
      c.fillStyle = FARBE.messingDunkel; c.fill();
      c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 6, y); c.lineTo(x, y + 9); c.lineTo(x - 6, y); c.closePath();
      c.fillStyle = '#F4EEDD'; c.fill();
    };
    const mitteRahmen = TISCH.BANDE + TISCH.RAHMEN * 0.36;
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const x = -X + i * TISCH.L / 8;
      diamant(x, -Y - mitteRahmen); diamant(x, Y + mitteRahmen);
    }
    for (let i = 1; i < 4; i++) {
      const y = -Y + i * TISCH.B / 4;
      diamant(-X - mitteRahmen, y); diamant(X + mitteRahmen, y);
    }
    // kleiner Anker auf beiden Stirnseiten
    anker(c, -X - mitteRahmen - 32, 0, 1); anker(c, X + mitteRahmen + 32, 0, -1);

    // Kopflinie und Fußpunkt (dezent)
    c.strokeStyle = 'rgba(255, 244, 220, 0.16)'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(TISCH.kopfX, -Y); c.lineTo(TISCH.kopfX, Y); c.stroke();
    c.beginPath(); c.arc(TISCH.fussX, 0, 5, 0, Math.PI * 2); c.fillStyle = 'rgba(255, 244, 220, 0.3)'; c.fill();
    if (kopffeld) {
      c.fillStyle = 'rgba(255, 211, 90, 0.08)';
      c.fillRect(-X, -Y, TISCH.kopfX + X, 2 * Y);
      c.strokeStyle = 'rgba(255, 211, 90, 0.6)'; c.lineWidth = 4; c.setLineDash([18, 12]);
      c.beginPath(); c.moveTo(TISCH.kopfX, -Y); c.lineTo(TISCH.kopfX, Y); c.stroke(); c.setLineDash([]);
    }
  }

  function bandenStueck(c, p, achse, seite) {
    // p: [Backenende, Nase, Nase, Backenende]; nach außen bis hinter die Bande verlängern
    const aussen = achse === 'y' ? seite * (TISCH.Y + TISCH.BANDE) : seite * (TISCH.X + TISCH.BANDE);
    c.beginPath();
    c.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < 4; i++) c.lineTo(p[i].x, p[i].y);
    if (achse === 'y') { c.lineTo(p[3].x, aussen); c.lineTo(p[0].x, aussen); }
    else { c.lineTo(aussen, p[3].y); c.lineTo(aussen, p[0].y); }
    c.closePath();
    const g = achse === 'y'
      ? c.createLinearGradient(0, seite * TISCH.Y, 0, aussen)
      : c.createLinearGradient(seite * TISCH.X, 0, aussen, 0);
    g.addColorStop(0, '#1BAE9E'); g.addColorStop(0.35, FARBE.bande); g.addColorStop(1, FARBE.bandeKante);
    c.fillStyle = g; c.fill();
    // Lichtkante an der Nase
    c.beginPath(); c.moveTo(p[1].x, p[1].y); c.lineTo(p[2].x, p[2].y);
    c.strokeStyle = 'rgba(190, 255, 240, 0.35)'; c.lineWidth = 2.5; c.stroke();
  }

  function messingBeschlag(c, t) {
    const z = t.zeichen;
    const r = z.r + 20;
    // Bogen um das Loch, auf dem Holzrahmen
    const grund = Math.atan2(t.achse.y, t.achse.x);
    const breite = t.art === 'ecke' ? 1.25 : 1.05;
    c.lineWidth = 16;
    const g = c.createLinearGradient(z.x - r, z.y - r, z.x + r, z.y + r);
    g.addColorStop(0, FARBE.messingHell); g.addColorStop(0.45, FARBE.messing); g.addColorStop(1, FARBE.messingDunkel);
    c.strokeStyle = g;
    c.beginPath(); c.arc(z.x, z.y, r - 6, grund - breite, grund + breite); c.stroke();
    for (const w of [-breite * 0.8, 0, breite * 0.8]) {
      c.beginPath(); c.arc(z.x + Math.cos(grund + w) * (r - 6), z.y + Math.sin(grund + w) * (r - 6), 3.4, 0, Math.PI * 2);
      c.fillStyle = FARBE.messingDunkel; c.fill();
    }
  }

  function anker(c, x, y, seite) {
    c.save(); c.translate(x, y); c.rotate(seite * Math.PI / 2);
    c.strokeStyle = 'rgba(232, 196, 120, 0.55)'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -22); c.lineTo(0, 22); c.stroke();
    c.beginPath(); c.moveTo(-12, -12); c.lineTo(12, -12); c.stroke();
    c.beginPath(); c.arc(0, -27, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 4, 19, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke();
    c.restore();
  }

  // ---------- Kugeln (im Bildraum, damit Licht und Nummern immer aufrecht sind) ----------
  function malKugel(c, nr, x, y, r, alpha = 1) {
    c.globalAlpha = alpha;
    // Schatten (Licht von oben, leicht versetzt)
    c.beginPath(); c.ellipse(x + r * 0.16, y + r * 0.26, r * 0.98, r * 0.9, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0, 20, 18, 0.35)'; c.fill();
    const farbe = nr === 0 ? '#F8F3E6' : KUGEL_FARBEN[nr];
    const halb = nr >= 9;
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = halb ? '#F8F3E6' : farbe; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    if (halb) { c.fillStyle = farbe; c.fillRect(x - r, y - r * 0.55, 2 * r, r * 1.1); }
    // Nummernfeld
    if (nr !== 0) {
      c.beginPath(); c.arc(x, y, r * (halb ? 0.5 : 0.52), 0, Math.PI * 2); c.fillStyle = '#FFFDF6'; c.fill();
      if (nr === 8) { c.lineWidth = Math.max(0.6, r * 0.06); c.strokeStyle = '#d8d2c4'; c.stroke(); }
      c.fillStyle = '#121214';
      c.font = `800 ${Math.max(7, r * (nr >= 10 ? 0.66 : 0.74))}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(nr), x, y + r * 0.04);
    } else {
      // Weiße: kleiner roter Punkt (wie bei Trainingskugeln) zur Unterscheidung von hellen Halben
      c.beginPath(); c.arc(x + r * 0.35, y + r * 0.3, r * 0.13, 0, Math.PI * 2); c.fillStyle = 'rgba(214, 64, 47, 0.75)'; c.fill();
    }
    // Rundung und Glanz
    const schatten = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r * 1.05);
    schatten.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    schatten.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
    schatten.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    c.fillStyle = schatten; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    c.restore();
    c.beginPath(); c.ellipse(x - r * 0.36, y - r * 0.42, r * 0.26, r * 0.17, -0.6, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255, 255, 255, 0.85)'; c.fill();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.lineWidth = Math.max(0.6, r * 0.05); c.strokeStyle = nr === 8 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)'; c.stroke();
    c.globalAlpha = 1;
  }

  // ---------- Queue (in Weltkoordinaten) ----------
  function malQueue(c, w, winkel, abstand) {
    const ux = Math.cos(winkel), uy = Math.sin(winkel);
    const px = -uy, py = ux;
    const spitze = R + abstand;
    const laenge = 1480;
    const punkt = (d, b) => ({ x: w.x - ux * d + px * b, y: w.y - uy * d + py * b });
    const teil = (d0, d1, b0, b1, farbe) => {
      const a = punkt(d0, b0), b = punkt(d1, b1), cc = punkt(d1, -b1), d = punkt(d0, -b0);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath();
      c.fillStyle = farbe; c.fill();
    };
    const breite = d => 5.5 + (d - spitze) / laenge * 9;
    // Schatten des Queues auf dem Tisch
    c.save(); c.translate(10, 14); c.globalAlpha = 0.25;
    teil(spitze, spitze + laenge, breite(spitze), breite(spitze + laenge), '#000');
    c.restore();
    const holz = c.createLinearGradient(punkt(0, -10).x, punkt(0, -10).y, punkt(0, 10).x, punkt(0, 10).y);
    holz.addColorStop(0, '#C99A62'); holz.addColorStop(0.5, '#F2D3A0'); holz.addColorStop(1, '#B9864F');
    teil(spitze + 26, spitze + 980, breite(spitze + 26), breite(spitze + 980), holz);
    teil(spitze, spitze + 6, breite(spitze), breite(spitze + 6), '#3E6FBF');            // Kreide
    teil(spitze + 6, spitze + 26, breite(spitze + 6), breite(spitze + 26), FARBE.creme);  // Zwinge
    teil(spitze + 980, spitze + 1000, breite(spitze + 980), breite(spitze + 1000), FARBE.messing);
    teil(spitze + 1000, spitze + laenge, breite(spitze + 1000), breite(spitze + laenge), '#3A1F14');
    teil(spitze + 1120, spitze + 1140, breite(spitze + 1120), breite(spitze + 1140), FARBE.koralle);
    teil(spitze + 1160, spitze + 1172, breite(spitze + 1160), breite(spitze + 1172), FARBE.gelb);
    teil(spitze + laenge - 30, spitze + laenge, breite(spitze + laenge - 30), breite(spitze + laenge), '#151515');
  }

  // ---------- Zielhilfe (Bildraum, Werte aus der Welt umgerechnet) ----------
  function malVorschau(c, v, erweitert) {
    if (!v) return;
    const s = Ansicht.s;
    const a = Ansicht.zuBild(v.start.x, v.start.y), b = Ansicht.zuBild(v.treffer.x, v.treffer.y);
    c.save();
    c.lineCap = 'round';
    c.setLineDash([Math.max(4, 9 * s * 3), Math.max(4, 7 * s * 3)]);
    c.lineWidth = Math.max(1.6, 5 * s); c.strokeStyle = 'rgba(255, 244, 220, 0.85)';
    // Linie beginnt am Rand der Weißen
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l > R * s) {
      const k = (R * s) / l;
      c.beginPath(); c.moveTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k); c.lineTo(b.x, b.y); c.stroke();
    }
    c.setLineDash([]);
    // Geisterkugel am Treffpunkt
    c.beginPath(); c.arc(b.x, b.y, R * s, 0, Math.PI * 2);
    c.lineWidth = Math.max(1.4, 4 * s); c.strokeStyle = v.art === 'kugel' ? 'rgba(255, 244, 220, 0.95)' : 'rgba(255, 244, 220, 0.55)'; c.stroke();
    c.fillStyle = 'rgba(255, 244, 220, 0.12)'; c.fill();
    if (v.art === 'kugel') {
      // Richtung der getroffenen Kugel
      const o = Ansicht.zuBild(v.objekt.x, v.objekt.y);
      const e = Ansicht.zuBild(v.objekt.x + v.richtung.x * v.objektLaenge, v.objekt.y + v.richtung.y * v.objektLaenge);
      c.lineWidth = Math.max(2, 6 * s); c.strokeStyle = v.erlaubt === false ? 'rgba(255, 128, 91, 0.95)' : 'rgba(255, 211, 90, 0.95)';
      c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(e.x, e.y); c.stroke();
      // Pfeilspitze
      const wx = e.x - o.x, wy = e.y - o.y, wl = Math.hypot(wx, wy) || 1, ux = wx / wl, uy = wy / wl, p = Math.max(5, 14 * s);
      c.beginPath(); c.moveTo(e.x + ux * p * 0.4, e.y + uy * p * 0.4); c.lineTo(e.x - ux * p + uy * p * 0.6, e.y - uy * p - ux * p * 0.6); c.lineTo(e.x - ux * p - uy * p * 0.6, e.y - uy * p + ux * p * 0.6); c.closePath();
      c.fillStyle = c.strokeStyle; c.fill();
      if (v.erlaubt === false) {
        // falsche Kugel: kleines X auf dem Geist
        const d = R * s * 0.55;
        c.strokeStyle = FARBE.koralle; c.lineWidth = Math.max(2, 5 * s);
        c.beginPath(); c.moveTo(b.x - d, b.y - d); c.lineTo(b.x + d, b.y + d); c.moveTo(b.x + d, b.y - d); c.lineTo(b.x - d, b.y + d); c.stroke();
      }
      if (erweitert && v.weissWeiter) {
        const w2 = Ansicht.zuBild(v.treffer.x + v.weissWeiter.x * 260, v.treffer.y + v.weissWeiter.y * 260);
        c.setLineDash([Math.max(3, 6 * s * 3), Math.max(3, 8 * s * 3)]);
        c.lineWidth = Math.max(1.2, 3 * s); c.strokeStyle = 'rgba(255, 244, 220, 0.45)';
        c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(w2.x, w2.y); c.stroke();
        c.setLineDash([]);
      }
    }
    c.restore();
  }

  // ---------- Taschenwahl für die Acht ----------
  function malTaschenWahl(c, angesagt, zeit, aktiv) {
    for (const t of TISCH.taschen) {
      const z = t.zeichen;
      const m = Ansicht.zuBild(z.x, z.y);
      const r = (z.r + 10) * Ansicht.s;
      const gewaehlt = angesagt === t.nr;
      if (!aktiv && !gewaehlt) continue;
      c.beginPath(); c.arc(m.x, m.y, r + (gewaehlt ? 0 : Math.sin(zeit * 4) * 2 + 2), 0, Math.PI * 2);
      c.lineWidth = gewaehlt ? 4 : 2.5; c.strokeStyle = gewaehlt ? FARBE.gelb : 'rgba(255, 211, 90, 0.7)';
      c.setLineDash(gewaehlt ? [] : [5, 5]); c.stroke(); c.setLineDash([]);
      if (gewaehlt) {
        malKugel(c, 8, m.x, m.y, Math.max(9, R * Ansicht.s * 0.9));
      } else {
        c.fillStyle = 'rgba(255, 211, 90, 0.95)'; c.font = `700 ${Math.max(11, r * 0.5)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(t.nr + 1), m.x, m.y);
      }
    }
  }

  // ---------- Ball in Hand: Platzierungsanzeige ----------
  function malPlatzierung(c, pos, gueltig) {
    const m = Ansicht.zuBild(pos.x, pos.y), r = R * Ansicht.s;
    c.beginPath(); c.arc(m.x, m.y, r + 6, 0, Math.PI * 2);
    c.lineWidth = 3; c.strokeStyle = gueltig ? FARBE.tuerkis : FARBE.koralle; c.setLineDash(gueltig ? [] : [4, 4]); c.stroke(); c.setLineDash([]);
    if (!gueltig) {
      c.beginPath(); c.arc(m.x, m.y, r + 6, 0, Math.PI * 2); c.fillStyle = 'rgba(255, 128, 91, 0.25)'; c.fill();
      const d = r * 0.8;
      c.strokeStyle = FARBE.koralle; c.lineWidth = 3;
      c.beginPath(); c.moveTo(m.x - d, m.y - d); c.lineTo(m.x + d, m.y + d); c.moveTo(m.x + d, m.y - d); c.lineTo(m.x - d, m.y + d); c.stroke();
    }
  }

  // ---------- Ganzes Bild ----------
  function male(c, z) {
    const { w, h, dpr } = Ansicht;
    // Hintergrund nur neu zeichnen, wenn sich Größe oder Drehung ändern
    const schl = `${w}x${h}@${dpr}:${Ansicht.gedreht}`;
    if (schl !== hgSchluessel) {
      hgSchluessel = schl;
      hintergrund = document.createElement('canvas');
      hintergrund.width = Math.round(w * dpr); hintergrund.height = Math.round(h * dpr);
      const hc = hintergrund.getContext('2d');
      hc.setTransform(dpr, 0, 0, dpr, 0, 0);
      malHintergrund(hc, w, h);
      Ansicht.welt2d(hc);
      malTisch(hc, false);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(hintergrund, 0, 0);
    if (z.kopffeld) {
      Ansicht.welt2d(c);
      c.fillStyle = 'rgba(255, 211, 90, 0.08)';
      c.fillRect(-TISCH.X, -TISCH.Y, TISCH.kopfX + TISCH.X, 2 * TISCH.Y);
      c.strokeStyle = 'rgba(255, 211, 90, 0.65)'; c.lineWidth = 4; c.setLineDash([18, 12]);
      c.beginPath(); c.moveTo(TISCH.kopfX, -TISCH.Y); c.lineTo(TISCH.kopfX, TISCH.Y); c.stroke(); c.setLineDash([]);
    }
    Ansicht.bild2d(c);
    const rs = R * Ansicht.s;
    // fallende Kugeln (unter den anderen): rollen zur Lochmitte und werden kleiner
    for (const k of z.kugeln) {
      if (!k.fall || k.fall.zeit >= PHYSIK.FALL_DAUER) continue;
      const t = TISCH.taschen[k.fall.tasche], q = k.fall.zeit / PHYSIK.FALL_DAUER;
      const ziel = t.zeichen;
      const x = k.fall.x + (ziel.x - k.fall.x) * q, y = k.fall.y + (ziel.y - k.fall.y) * q;
      const m = Ansicht.zuBild(x, y);
      malKugel(c, k.nr, m.x, m.y, rs * (1 - 0.35 * q), 1 - q * 0.75);
    }
    if (z.vorschau) malVorschau(c, z.vorschau, z.erweitert);
    for (const k of z.kugeln) {
      if (!k.aufTisch) continue;
      if (k.nr === 0 && z.weissVersteckt) continue;
      const m = Ansicht.zuBild(k.x, k.y);
      malKugel(c, k.nr, m.x, m.y, rs);
    }
    // markierte Zielkugeln (erlaubte erste Kugel) dezent
    if (z.markiert) for (const nr of z.markiert) {
      const k = z.kugeln.find(b => b.nr === nr && b.aufTisch); if (!k) continue;
      const m = Ansicht.zuBild(k.x, k.y);
      c.beginPath(); c.arc(m.x, m.y, rs + Math.max(2, rs * 0.22), 0, Math.PI * 2);
      c.lineWidth = Math.max(1.2, rs * 0.12); c.strokeStyle = 'rgba(255, 244, 220, 0.5)'; c.stroke();
    }
    if (z.platz) {
      const m = Ansicht.zuBild(z.platz.x, z.platz.y);
      malKugel(c, 0, m.x, m.y, rs, 0.92);
      malPlatzierung(c, z.platz, z.platz.gueltig);
    }
    if (z.taschenWahl || z.angesagt !== null) malTaschenWahl(c, z.angesagt, z.zeit, z.taschenWahl);
    if (z.queue) {
      Ansicht.welt2d(c);
      malQueue(c, z.queue.weiss, z.queue.winkel, z.queue.abstand);
      Ansicht.bild2d(c);
    }
  }
  return { male, malKugel, FARBE };
})();
