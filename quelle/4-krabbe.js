// ===================================================================
// 4 · KRABBE
// Die Hauptfigur ist Kalle aus „Krabbenalarm“ (~/krabbenalarm-app/index.html,
// Funktion malKrabbe und FIGUREN.kalle). Zeichenhelfer und malKrabbe sind von
// dort wörtlich übernommen. Neu sind nur Zusatz-Optionen für die Varianten
// (Augen, Brauen, Scheren, Mund) und Flug-Mimik. Ohne diese Optionen zeichnet
// der Code Kalle exakt wie im Original (geprüft per Pixelvergleich).
//
// Alle Varianten sind rein kosmetisch: Der Physikkörper ist immer
// KRABBE_PHYSIK aus 1-einstellungen.js, egal welche Krabbe gewählt ist.
// ===================================================================

const begrenzt = (wert, min, max) => Math.max(min, Math.min(max, wert));

// --- Zeichenhelfer, unverändert aus Krabbenalarm ---
function oval(c, x, y, rx, ry, farbe, rand, dicke = 0.8) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (farbe) { c.fillStyle = farbe; c.fill(); }
  if (rand) { c.strokeStyle = rand; c.lineWidth = dicke; c.stroke(); }
}

function eckig(c, x, y, b, h, r, farbe, rand, dicke = 0.8) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + b, y, x + b, y + h, r);
  c.arcTo(x + b, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + b, y, r);
  c.closePath();
  if (farbe) { c.fillStyle = farbe; c.fill(); }
  if (rand) { c.strokeStyle = rand; c.lineWidth = dicke; c.stroke(); }
}

function strich(c, farbe, dicke, ...punkte) {
  c.beginPath();
  c.moveTo(punkte[0], punkte[1]);
  for (let i = 2; i < punkte.length; i += 2) c.lineTo(punkte[i], punkte[i + 1]);
  c.strokeStyle = farbe;
  c.lineWidth = dicke;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

function bogen(c, farbe, dicke, x0, y0, sx, sy, x1, y1) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(sx, sy, x1, y1);
  c.strokeStyle = farbe;
  c.lineWidth = dicke;
  c.lineCap = 'round';
  c.stroke();
}

function flaeche(c, farbe, rand, ...punkte) {
  c.beginPath();
  c.moveTo(punkte[0], punkte[1]);
  for (let i = 2; i < punkte.length; i += 2) c.lineTo(punkte[i], punkte[i + 1]);
  c.closePath();
  if (farbe) { c.fillStyle = farbe; c.fill(); }
  if (rand) { c.strokeStyle = rand; c.lineWidth = 0.8; c.lineJoin = 'round'; c.stroke(); }
}

function balken(c, farbe, ...liste) {
  c.fillStyle = farbe;
  for (const [x, y, b, h] of liste) c.fillRect(x, y, b, h);
}

// --- Die fünf Krabben. farbe = [Hauptfarbe, dunkel, hell] wie in Krabbenalarm ---
// Kalle hat exakt die Farben aus Krabbenalarm (FIGUREN.kalle).
const KRABBEN = {
  kalle: { name: 'Kalle', text: 'Das Original aus Krabbenalarm.', farbe: ['#e8503a', '#a82c24', '#ff9478'] },
  tilda: { name: 'Tilda', text: 'Türkis, mit frechem Blick.', farbe: ['#1fb5ab', '#0f6e6a', '#86ece2'], augen: 'frech', mund: 'grinsen' },
  koko: { name: 'Koko', text: 'Koralle, mit runden Kuschelscheren.', farbe: ['#ff7a52', '#c2462a', '#ffbfa0'], scheren: 'rund' },
  viola: { name: 'Viola', text: 'Violett, mit Brauen und Mandelaugen.', farbe: ['#9a5ee0', '#5a3298', '#d4b6ff'], augen: 'oval', brauen: true },
  goldi: { name: 'Goldi', text: 'Goldgelb, eine Schere mit Zacken.', farbe: ['#efb02a', '#a26b14', '#ffe28a'], scheren: 'zacken' },
};
const KRABBEN_REIHE = ['kalle', 'tilda', 'koko', 'viola', 'goldi'];

// Zeichnet die Krabbe im Bereich 44 x 36, die Füße stehen unten in der Mitte
// Zusätzliche Optionen (alle freiwillig):
//   klammer: 0..1  – Scheren greifen nach den Katapult-Seilen
//   mund: 'entschlossen' | 'verdutzt' (neben lachen, oh, jubel, tot aus dem Original)
//   schielen: true – die Pupillen schauen verdutzt in verschiedene Richtungen
function malKrabbe(c, o) {
  const fig = KRABBEN[o.figur] || KRABBEN.kalle;
  const [haupt, dunkel, hell] = fig.farbe;
  const mx = 22;
  const lauf = o.lauf || 0;
  const rand = '#3a1418';

  // Beine
  for (const seite of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const heben = Math.max(0, Math.sin(lauf * Math.PI * 2 + i * 2.1 + (seite > 0 ? 1.5 : 0))) * 2;
      const hx = mx + seite * (6.5 + i * 1.7), hy = 28 + i * 0.3;
      const kx = mx + seite * (12 + i * 2.6), ky = 25.5 + i * 1.3 - heben;
      const fx = mx + seite * (13.5 + i * 3.1), fy = 35 - heben;
      bogen(c, rand, 2, hx, hy, kx, ky - 1, fx, fy);
      bogen(c, dunkel, 1.1, hx, hy, kx, ky - 1, fx, fy);
    }
  }

  // Scheren
  const auf = o.schereAuf ? 0.85 : 0.42;
  for (const seite of [-1, 1]) {
    let hoch = Math.sin((o.wedel || 0) * 5 + (seite > 0 ? 1.4 : 0)) * (o.tanzt ? 2.4 : 0.6) - (o.schereHoch ? 3 : 0);
    let cx = mx + seite * 16, cy = 14.5 + hoch;
    if (o.klammer) { cx += seite * 3 * o.klammer; cy -= 7 * o.klammer; }
    // Scherengröße je Variante (Koko rund und groß, Goldi rechts größer mit Zacken)
    let gross = 4.7, offen = auf;
    if (fig.scheren === 'rund') { gross = 5.9; offen = auf * 0.62; }
    if (fig.scheren === 'zacken' && seite > 0) gross = 5.6;
    bogen(c, rand, 3.4, mx + seite * 9, 25.5, mx + seite * 16.5, 26, cx, cy + 3);
    bogen(c, haupt, 2, mx + seite * 9, 25.5, mx + seite * 16.5, 26, cx, cy + 3);
    c.save();
    c.translate(cx, cy);
    c.rotate(seite * 0.22);
    c.beginPath();
    c.arc(0, 0, gross, -Math.PI / 2 + offen, -Math.PI / 2 - offen + Math.PI * 2);
    c.lineTo(0, 0.6);
    c.closePath();
    c.fillStyle = haupt;
    c.fill();
    c.strokeStyle = rand;
    c.lineWidth = 0.9;
    c.lineJoin = 'round';
    c.stroke();
    if (fig.scheren === 'zacken' && seite > 0) {
      // kleine Zacken an der Innenkante der großen Schere
      for (let z = 0; z < 3; z++) {
        const w = -Math.PI / 2 + offen + 0.25 + z * 0.32;
        const ax = Math.cos(w) * gross * 0.92, ay = Math.sin(w) * gross * 0.92;
        flaeche(c, hell, rand, ax, ay, ax * 0.72 + 0.6, ay * 0.72, Math.cos(w + 0.18) * gross * 0.92, Math.sin(w + 0.18) * gross * 0.92);
      }
      oval(c, 2.2, 2.4, 0.8, 0.8, dunkel);
    }
    oval(c, -1.5, 1.3, fig.scheren === 'rund' ? 2 : 1.4, fig.scheren === 'rund' ? 1.4 : 1, hell);
    c.restore();
  }

  // Augenstiele hinter dem Körper
  const blick = begrenzt(o.blick || 0, -1, 1);
  const blickY = o.blickHoch ? -0.9 : 0.2;
  for (const seite of [-1, 1]) {
    const ex = mx + seite * 5.2;
    strich(c, rand, 2.6, mx + seite * 4, 22, ex, 13);
    strich(c, haupt, 1.4, mx + seite * 4, 22, ex, 13);
  }

  // Körper
  const verl = c.createLinearGradient(0, 18, 0, 32);
  verl.addColorStop(0, hell);
  verl.addColorStop(0.32, haupt);
  verl.addColorStop(1, dunkel);
  oval(c, mx, 25, 11.4, 6.9, verl, rand, 0.95);
  oval(c, mx - 4, 21.2, 4.2, 1.2, 'rgba(255, 255, 255, 0.55)');
  oval(c, mx + 6.5, 23, 0.9, 0.7, dunkel);
  oval(c, mx + 4.5, 21.2, 0.7, 0.5, dunkel);
  oval(c, mx - 7.4, 25, 1.7, 1, 'rgba(255, 150, 150, 0.6)');
  oval(c, mx + 7.4, 25, 1.7, 1, 'rgba(255, 150, 150, 0.6)');

  // Augen
  const mund = o.mund || fig.mund || 'lachen';
  for (const seite of [-1, 1]) {
    const ex = mx + seite * 5.2, ey = 10.8;
    if (fig.augen === 'oval') oval(c, ex, ey - 0.3, 2.9, 4.2, '#ffffff', '#1a1820', 0.8);
    else oval(c, ex, ey, 3.7, 3.7, '#ffffff', '#1a1820', 0.8);
    if (o.mund === 'tot') {
      strich(c, '#1a1820', 0.8, ex - 1.5, ey - 1.5, ex + 1.5, ey + 1.5);
      strich(c, '#1a1820', 0.8, ex + 1.5, ey - 1.5, ex - 1.5, ey + 1.5);
    } else {
      let bx = blick * 1.3, by = blickY;
      if (o.schielen) { bx = seite * -1.1; by = seite * 0.9; }
      const pg = fig.augen === 'oval' ? 1.5 : 1.7;
      oval(c, ex + bx, ey + by, pg, fig.augen === 'oval' ? 2 : pg, '#1a1820');
      oval(c, ex + bx - 0.5, ey + by - 0.6, 0.55, 0.55, '#ffffff');
    }
    // Tildas freche Lider: oben halb zu, links etwas tiefer
    if (fig.augen === 'frech' && o.mund !== 'tot' && mund !== 'oh' && mund !== 'verdutzt') {
      const tief = seite < 0 ? 1.2 : 0.4;
      c.save();
      c.beginPath();
      c.ellipse(ex, ey, 3.7, 3.7, 0, 0, Math.PI * 2);
      c.clip();
      c.beginPath();
      c.moveTo(ex - 4, ey - 4.5);
      c.lineTo(ex + 4, ey - 4.5);
      c.lineTo(ex + 4, ey - 0.2 + tief - seite * 0.5);
      c.lineTo(ex - 4, ey - 0.2 + tief + seite * 0.5);
      c.closePath();
      c.fillStyle = haupt;
      c.fill();
      c.restore();
      strich(c, '#1a1820', 0.8, ex - 3.4, ey - 0.2 + tief + seite * 0.45, ex + 3.4, ey - 0.2 + tief - seite * 0.45);
    }
  }

  // Augenbrauen: Viola immer, alle anderen nur, wenn sie entschlossen schauen
  if (fig.brauen || mund === 'entschlossen') {
    const dick = fig.brauen ? 1.5 : 0.95;
    for (const seite of [-1, 1]) {
      const ex = mx + seite * 5.2, ey = fig.augen === 'oval' ? 4.8 : 6.1;
      let innen = 0, aussen = 0;
      if (mund === 'entschlossen') { innen = 1.5; aussen = -0.6; }
      else if (mund === 'oh' || mund === 'verdutzt' || mund === 'jubel') { innen = -1; aussen = -0.4; }
      else if (fig.brauen) { innen = 0.3; aussen = -0.6; }
      strich(c, '#1a1820', dick, ex - seite * 2.6, ey + innen, ex + seite * 2.4, ey + aussen);
    }
  }

  // Mund
  if (mund === 'lachen') {
    c.beginPath();
    c.arc(mx, 24.3, 3.3, 0.25, Math.PI - 0.25);
    c.strokeStyle = '#1a1820';
    c.lineWidth = 0.8;
    c.lineCap = 'round';
    c.stroke();
  } else if (mund === 'oh' || mund === 'tot') {
    oval(c, mx, 26.4, 1.9, 2.1, '#1a1820');
    oval(c, mx, 27.3, 1.1, 1, '#ff8a8a');
  } else if (mund === 'jubel') {
    c.beginPath();
    c.arc(mx, 24.8, 3.8, 0, Math.PI);
    c.closePath();
    c.fillStyle = '#1a1820';
    c.fill();
    oval(c, mx, 27.4, 1.9, 1, '#ff8a8a');
  } else if (mund === 'grinsen') {
    // schiefes, freches Grinsen
    bogen(c, '#1a1820', 0.85, mx - 3.4, 25.2, mx + 0.5, 28.2, mx + 3.8, 24.2);
    strich(c, '#1a1820', 0.7, mx + 3.3, 23.6, mx + 4.2, 24.6);
  } else if (mund === 'entschlossen') {
    // zusammengebissen: gerader Strich mit Zähnchen
    eckig(c, mx - 3, 25.2, 6, 2, 0.8, '#ffffff', '#1a1820', 0.75);
    strich(c, '#1a1820', 0.5, mx, 25.4, mx, 27);
  } else if (mund === 'verdutzt') {
    oval(c, mx + 0.6, 26.3, 1.2, 1, '#1a1820');
  }
}

// Zeichnet die Krabbe scharf in eine eigene Leinwand (Menüs, Anzeige)
function krabbeInLeinwand(leinwand, o) {
  const c = leinwand.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, leinwand.width, leinwand.height);
  const e = Math.min(leinwand.width / 44, leinwand.height / 36);
  c.setTransform(e, 0, 0, e, (leinwand.width - 44 * e) / 2, (leinwand.height - 36 * e) / 2);
  malKrabbe(c, o);
  c.setTransform(1, 0, 0, 1, 0, 0);
}
