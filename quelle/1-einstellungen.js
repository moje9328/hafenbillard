// ===================================================================
// 1 · EINSTELLUNGEN UND TISCHGEOMETRIE
// Alle Maße an EINER Stelle, in Millimetern (Weltkoordinaten).
// Ursprung = Tischmitte, x nach rechts (lange Seite), y nach unten.
// Diese Geometrie ist auf allen Geräten gleich; nur die Darstellung
// wird skaliert oder um 90° gedreht.
// Vorbild: 7-Fuß-Kneipentisch (Spielfläche 1980 × 990 mm, Kugel 57,2 mm).
// ===================================================================

const TISCH = (() => {
  const L = 1980, B = 990;                  // Spielfläche bis zu den Bandennasen
  const R = 28.6;                           // Kugelradius
  const ECK_MUND = 118;                     // Öffnung der Ecktaschen zwischen den Bandennasen
  const MITTE_MUND = 128;                   // Öffnung der Mitteltaschen
  const ECK_BACKE = 48, MITTE_BACKE = 34;   // Länge der Taschenbacken (schräge Bandenstücke)
  const ECK_WINKEL = 38 * Math.PI / 180;    // Backe gegen die Bande gemessen (142° Schnittwinkel)
  const MITTE_WINKEL = 77 * Math.PI / 180;  // Mitteltasche: 103° Schnittwinkel

  const a = ECK_MUND / Math.SQRT2;          // wo die Bandennase an der Ecke endet
  const m = MITTE_MUND / 2;

  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const norm = v => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };

  // Bandenstücke als Strecken. n = Normale zur Spielfläche hin (Kugeln stoßen nur von dieser Seite).
  const banden = [];
  function strecke(p, q, innen) {
    // innen: ein Punkt auf der Spielseite, damit die Normale richtig herum zeigt
    const d = norm(sub(q, p));
    let n = { x: -d.y, y: d.x };
    if ((innen.x - p.x) * n.x + (innen.y - p.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    banden.push({ p, q, d, n, len: Math.hypot(q.x - p.x, q.y - p.y) });
  }

  const X = L / 2, Y = B / 2;
  const taschen = [];
  // Ecktaschen: Reihenfolge oben links, oben rechts, unten rechts, unten links
  const ecken = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sy] of ecken) {
    const ecke = { x: sx * X, y: sy * Y };
    const A = { x: sx * (X - a), y: sy * Y };       // Ende der langen Bande
    const Bp = { x: sx * X, y: sy * (Y - a) };      // Ende der kurzen Bande
    // Backen: von der Nase aus nach außen, unter ECK_WINKEL zur Bande geneigt
    const A2 = { x: A.x + sx * Math.cos(ECK_WINKEL) * ECK_BACKE, y: A.y + sy * Math.sin(ECK_WINKEL) * ECK_BACKE };
    const B2 = { x: Bp.x + sx * Math.sin(ECK_WINKEL) * ECK_BACKE, y: Bp.y + sy * Math.cos(ECK_WINKEL) * ECK_BACKE };
    const achse = norm({ x: sx, y: sy });
    const mitte = { x: (A.x + Bp.x) / 2, y: (A.y + Bp.y) / 2 };
    strecke(A, A2, { x: mitte.x + achse.x, y: mitte.y + achse.y });
    strecke(Bp, B2, { x: mitte.x + achse.x, y: mitte.y + achse.y });
    const kehle = { x: (A2.x + B2.x) / 2, y: (A2.y + B2.y) / 2 };
    taschen.push({
      art: 'ecke', mund: [A, Bp], kehlePunkte: [A2, B2], kehle, achse,
      kehleBreite: Math.hypot(A2.x - B2.x, A2.y - B2.y),
      ecke,
    });
  }
  // Mitteltaschen: oben, unten
  for (const sy of [-1, 1]) {
    const A = { x: -m, y: sy * Y }, Bp = { x: m, y: sy * Y };
    const A2 = { x: A.x + Math.cos(MITTE_WINKEL) * MITTE_BACKE, y: A.y + sy * Math.sin(MITTE_WINKEL) * MITTE_BACKE };
    const B2 = { x: Bp.x - Math.cos(MITTE_WINKEL) * MITTE_BACKE, y: Bp.y + sy * Math.sin(MITTE_WINKEL) * MITTE_BACKE };
    const achse = { x: 0, y: sy };
    strecke(A, A2, { x: 0, y: sy * Y });
    strecke(Bp, B2, { x: 0, y: sy * Y });
    const kehle = { x: 0, y: (A2.y + B2.y) / 2 };
    taschen.push({
      art: 'mitte', mund: [A, Bp], kehlePunkte: [A2, B2], kehle, achse,
      kehleBreite: Math.hypot(A2.x - B2.x, A2.y - B2.y),
    });
  }
  // Reihenfolge der Taschen für Anzeige und Tasten 1–6: oben links, oben Mitte, oben rechts, unten rechts, unten Mitte, unten links
  const REIHE = [0, 4, 1, 2, 5, 3];
  const sortiert = REIHE.map(i => taschen[i]);
  sortiert.forEach((t, i) => { t.nr = i; });
  const NAMEN = ['oben links', 'oben Mitte', 'oben rechts', 'unten rechts', 'unten Mitte', 'unten links'];
  sortiert.forEach((t, i) => { t.name = NAMEN[i]; });
  // Sichtbares Loch: Vorderkante an der Kehle (dort fällt die Kugel wirklich)
  for (const t of sortiert) {
    const r = t.kehleBreite / 2 + 8;
    t.zeichen = { x: t.kehle.x + t.achse.x * r * 0.82, y: t.kehle.y + t.achse.y * r * 0.82, r };
  }

  // Lange Banden (oben und unten, je zwei Stücke) und kurze Banden (links, rechts)
  for (const sy of [-1, 1]) {
    strecke({ x: -X + a, y: sy * Y }, { x: -m, y: sy * Y }, { x: 0, y: 0 });
    strecke({ x: m, y: sy * Y }, { x: X - a, y: sy * Y }, { x: 0, y: 0 });
  }
  for (const sx of [-1, 1]) strecke({ x: sx * X, y: -Y + a }, { x: sx * X, y: Y - a }, { x: 0, y: 0 });

  // Ecken der Bandenstücke (Nasen und Backenenden) als runde Stoßpunkte.
  // Doppelte Punkte (Bande endet dort, wo die Backe beginnt) nur einmal.
  const punkte = [];
  for (const s of banden) for (const p of [s.p, s.q]) {
    if (!punkte.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 0.01)) punkte.push(p);
  }

  const kopfX = -L / 4;   // Kopflinie: hinter ihr (links) liegt das Kopffeld
  const fussX = L / 4;    // Fußpunkt: Spitze des Dreiecks
  return {
    L, B, R, X, Y, ECK_MUND, MITTE_MUND,
    banden, punkte, taschen: sortiert,
    kopfX, fussX,
    RAHMEN: 118,          // Holzrahmen außen um die Banden (nur Darstellung)
    BANDE: 34,            // sichtbare Gummibande (nur Darstellung)
  };
})();

// Physik-Konstanten (alle in mm und Sekunden)
const PHYSIK = {
  DT: 1 / 240,              // fester Simulationsschritt
  E_KUGEL: 0.95,            // Stoßzahl Kugel–Kugel
  E_BANDE: 0.76,            // Stoßzahl senkrecht zur Bande
  BANDE_GLEIT: 0.975,       // Anteil der Geschwindigkeit entlang der Bande, der erhalten bleibt
  ROLL_KONST: 140,          // Rollreibung (mm/s²)
  ROLL_LINEAR: 0.32,        // geschwindigkeitsabhängige Bremsung (1/s): schnelle Kugeln verlieren mehr
  V_STOPP: 6,               // darunter ist eine Kugel in Ruhe (mm/s)
  V_MIN: 180,               // schwächster Stoß (mm/s)
  V_MAX: 7500,              // stärkster Stoß (mm/s)
  MAX_EREIGNISSE: 400,      // Sicherheitsgrenze für Kontakte pro Schritt
  FALL_DAUER: 0.32,         // Einrollanimation in die Tasche (s)
  MAX_STOSSDAUER: 40,       // Sicherheitsgrenze (s), danach werden Restbewegungen gestoppt
};

// Stoßstärke 0..1 (Regler) → Startgeschwindigkeit der Weißen.
// Leicht gekrümmt, damit sanfte Stöße fein dosierbar bleiben.
function staerkeZuTempo(s) {
  const k = Math.max(0, Math.min(1, s));
  return PHYSIK.V_MIN + (PHYSIK.V_MAX - PHYSIK.V_MIN) * Math.pow(k, 1.7);
}
function tempoZuStaerke(v) {
  const k = (Math.max(PHYSIK.V_MIN, Math.min(PHYSIK.V_MAX, v)) - PHYSIK.V_MIN) / (PHYSIK.V_MAX - PHYSIK.V_MIN);
  return Math.pow(k, 1 / 1.7);
}

// Kugeln: 0 = Weiße, 1–7 volle, 8 = Acht, 9–15 halbe
const KUGEL_FARBEN = {
  1: '#F2C230', 2: '#2D63C8', 3: '#D8402F', 4: '#6E3FA8', 5: '#F07D2A', 6: '#2E8B4E', 7: '#8E2A28', 8: '#16161A',
  9: '#F2C230', 10: '#2D63C8', 11: '#D8402F', 12: '#6E3FA8', 13: '#F07D2A', 14: '#2E8B4E', 15: '#8E2A28',
};
const gruppeVon = nr => nr === 0 ? 'weiss' : nr === 8 ? 'acht' : nr < 8 ? 'voll' : 'halb';
const VOLLE = [1, 2, 3, 4, 5, 6, 7], HALBE = [9, 10, 11, 12, 13, 14, 15];

// Kleiner reproduzierbarer Zufall (für Aufbau, Computer und Tests)
function zufall(saat) {
  let s = (saat >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
