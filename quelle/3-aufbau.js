// ===================================================================
// 3 · AUFBAU
// Dreieck für 8-Ball, Wiedereinsetzen der Acht, Übungsaufbauten.
// ===================================================================

const LUECKE = 0.2;   // mm Abstand zwischen Kugeln im Dreieck: berühren sich fast, überlappen nie

// Positionen des Dreiecks: Spitze auf dem Fußpunkt, Reihen nach rechts (zur Fußbande)
function dreieckPlaetze() {
  const D = 2 * TISCH.R + LUECKE;
  const plaetze = [];
  for (let reihe = 0; reihe < 5; reihe++) {
    for (let j = 0; j <= reihe; j++) {
      plaetze.push({ reihe, j, x: TISCH.fussX + reihe * D * Math.sqrt(3) / 2, y: (j - reihe / 2) * D });
    }
  }
  return plaetze;
}

// Faire Belegung: Acht in der Mitte (Reihe 3, mittlere Kugel), hinten links/rechts je
// eine volle und eine halbe (Seite zufällig), alle anderen gemischt.
function baueDreieck(rnd = Math.random) {
  const plaetze = dreieckPlaetze();
  const idx = (reihe, j) => plaetze.findIndex(p => p.reihe === reihe && p.j === j);
  const belegt = new Array(15).fill(0);
  const mischen = arr => { for (let i = arr.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [arr[i], arr[k]] = [arr[k], arr[i]]; } return arr; };
  const volle = mischen(VOLLE.slice()), halbe = mischen(HALBE.slice());
  belegt[idx(2, 1)] = 8;
  const vollLinks = rnd() < 0.5;
  belegt[idx(4, 0)] = vollLinks ? volle.pop() : halbe.pop();
  belegt[idx(4, 4)] = vollLinks ? halbe.pop() : volle.pop();
  const rest = mischen(volle.concat(halbe));
  for (let i = 0; i < 15; i++) if (!belegt[i]) belegt[i] = rest.pop();
  const kugeln = [neueKugel(0, TISCH.kopfX - 60, 0)];
  // Kleine Lage-Toleranz wie bei einem echten Dreieck (±0,07 mm je Achse). Weil der Spalt 0,2 mm beträgt
  // und 2 · 0,07 · √2 < 0,2 ist, können sich Kugeln dabei nie überlappen. Sie verteilt die Energie beim Anstoß natürlicher.
  plaetze.forEach((p, i) => kugeln.push(neueKugel(belegt[i], p.x + (rnd() - 0.5) * 0.14, p.y + (rnd() - 0.5) * 0.14)));
  return kugeln;
}

// Acht wieder einsetzen: Fußpunkt, sonst auf der Längsachse Richtung Fußbande, sonst Richtung Kopf
function setzeAchtEin(kugeln) {
  const acht = kugeln.find(k => k.nr === 8);
  if (!acht) return null;
  acht.aufTisch = false;
  const versuche = [];
  for (let x = TISCH.fussX; x <= TISCH.X - TISCH.R; x += 2) versuche.push(x);
  for (let x = TISCH.fussX; x >= -TISCH.X + TISCH.R; x -= 2) versuche.push(x);
  for (const x of versuche) {
    if (platzGueltig(kugeln, x, 0, { ohne: 8 })) {
      Object.assign(acht, { x, y: 0, vx: 0, vy: 0, aufTisch: true, fall: null });
      return acht;
    }
  }
  const p = naechsterFreierPlatz(kugeln, TISCH.fussX, 0, { ohne: 8 });
  Object.assign(acht, { x: p.x, y: p.y, vx: 0, vy: 0, aufTisch: true, fall: null });
  return acht;
}

// Übungsaufbauten für das Training
const UEBUNGEN = {
  gerade: {
    name: 'Gerader Stoß',
    text: 'Weiße, Kugel und Tasche liegen auf einer Linie. Stoß mittig und gefühlvoll.',
    baue: () => {
      // Weiße, Kugel und obere rechte Ecktasche auf einer Linie
      const t = TISCH.taschen[2];
      const ziel = { x: (t.mund[0].x + t.mund[1].x) / 2, y: (t.mund[0].y + t.mund[1].y) / 2 };
      const start = { x: 0, y: 160 };
      const dx = ziel.x - start.x, dy = ziel.y - start.y, l = Math.hypot(dx, dy);
      return [neueKugel(0, start.x, start.y), neueKugel(3, start.x + dx / l * 420, start.y + dy / l * 420)];
    },
  },
  schnitt: {
    name: 'Schnitt',
    text: 'Die Kugel liegt schräg zur Tasche. Triff sie dünn auf der richtigen Seite.',
    baue: () => [neueKugel(0, -250, 200), neueKugel(11, 560, -260)],
  },
  bande: {
    name: 'Bandenstoß',
    text: 'Der direkte Weg ist versperrt. Spiel die Weiße über die Bande an die Kugel.',
    baue: () => [neueKugel(0, -500, 280), neueKugel(8, 0, 120), neueKugel(5, 500, 280), neueKugel(2, 120, 250)],
  },
};
