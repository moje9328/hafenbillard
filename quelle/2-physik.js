// ===================================================================
// 2 · PHYSIK
// Reine Kugelphysik ohne Darstellung (läuft auch in Node für Tests).
//
// Verfahren: fester Schritt PHYSIK.DT. Innerhalb eines Schritts bewegen
// sich die Kugeln geradlinig. Der früheste Kontakt (Kugel–Kugel,
// Kugel–Bande, Kugel–Bandenecke) wird exakt berechnet, alle Kugeln
// laufen bis dorthin, der Stoß wird aufgelöst, dann geht es weiter.
// Dadurch gibt es kein Durchtunneln, auch bei sehr starken Stößen, und
// keine Positionskorrektur, die Kugeln künstlich beschleunigen könnte.
// Reibung wird am Ende jedes Schritts angewendet.
//
// Gleichzeitige Kontakte (z. B. beim Anstoß ins Dreieck) werden der
// Reihe nach zum selben Zeitpunkt aufgelöst; ein Stoß wirkt nur, wenn
// sich die Kugeln aufeinander zu bewegen. Ruhende, sich berührende
// Kugeln erzeugen daher keine Ereignisse und zittern nicht.
// ===================================================================

const EPS_ZEIT = 1e-9;
const EPS_ANNAEHERUNG = 1e-7;   // mm/s: darunter gilt „bewegt sich nicht aufeinander zu“

// Zeit bis zum Kontakt zweier Kugeln (Abstand 2R) bei konstanter Relativbewegung, sonst Infinity
function zeitKugelKugel(ax, ay, avx, avy, bx, by, bvx, bvy, R2) {
  const dx = bx - ax, dy = by - ay;
  const wx = bvx - avx, wy = bvy - avy;
  const b = dx * wx + dy * wy;              // halbe lineare Komponente
  if (b >= -EPS_ANNAEHERUNG) return Infinity; // entfernen sich oder stehen relativ still
  const a = wx * wx + wy * wy;
  const c = dx * dx + dy * dy - R2 * R2;
  if (c <= 0) return 0;                     // berühren/überlappen schon und nähern sich: sofort
  const disk = b * b - a * c;
  if (disk < 0) return Infinity;
  return (-b - Math.sqrt(disk)) / a;
}

// Zeit, bis eine Kugel (Mittelpunkt p, Geschwindigkeit v) eine Bandenstrecke berührt
function zeitKugelStrecke(px, py, vx, vy, s, R) {
  const vn = vx * s.n.x + vy * s.n.y;
  if (vn >= -EPS_ANNAEHERUNG) return Infinity;   // bewegt sich nicht auf die Bande zu
  const abst = (px - s.p.x) * s.n.x + (py - s.p.y) * s.n.y - R;
  if (abst < -R) return Infinity;                // liegt hinter der Bande (gehört nicht hierher)
  const t = abst <= 0 ? 0 : abst / -vn;
  // Berührpunkt muss auf der Strecke liegen (sonst übernehmen die Eckpunkte)
  const cx = px + vx * t - s.n.x * R, cy = py + vy * t - s.n.y * R;
  const u = (cx - s.p.x) * s.d.x + (cy - s.p.y) * s.d.y;
  if (u < 0 || u > s.len) return Infinity;
  return t;
}

// Zeit bis zum Kontakt mit einem festen Punkt (Bandennase, Backenende)
function zeitKugelPunkt(px, py, vx, vy, q, R) {
  return zeitKugelKugel(px, py, vx, vy, q.x, q.y, 0, 0, R);
}

// Prüft, ob eine Kugel durch die Kehle einer Tasche gerollt ist
function taschenTreffer(x, y, R) {
  for (const t of TISCH.taschen) {
    const ax = x - t.kehle.x, ay = y - t.kehle.y;
    const tief = ax * t.achse.x + ay * t.achse.y;
    if (tief <= 0) continue;
    const seit = Math.abs(ax * -t.achse.y + ay * t.achse.x);
    if (seit < t.kehleBreite / 2 + R) return t;
  }
  return null;
}

// ---------- Kugeln und Welt ----------
function neueKugel(nr, x, y) {
  return { nr, x, y, vx: 0, vy: 0, aufTisch: true, fall: null };
}

const Physik = {
  // Ein Stoß: Weiße bekommt Geschwindigkeit in Richtung winkel
  stoss(kugeln, winkel, tempo) {
    const w = kugeln.find(k => k.nr === 0 && k.aufTisch);
    if (!w) return false;
    w.vx = Math.cos(winkel) * tempo;
    w.vy = Math.sin(winkel) * tempo;
    return true;
  },

  inBewegung(kugeln) {
    for (const k of kugeln) if (k.aufTisch && (k.vx !== 0 || k.vy !== 0)) return true;
    return false;
  },

  energie(kugeln) {
    let e = 0;
    for (const k of kugeln) if (k.aufTisch) e += 0.5 * (k.vx * k.vx + k.vy * k.vy);
    return e;
  },

  // Ein fester Schritt. ereignis(e) wird für jeden Kontakt aufgerufen:
  //   { typ: 'kugel', a, b, staerke }   { typ: 'bande', kugel, staerke }   { typ: 'tasche', kugel, tasche }
  schritt(kugeln, ereignis, dt = PHYSIK.DT) {
    const R = TISCH.R, R2 = 2 * R;
    const aktiv = kugeln.filter(k => k.aufTisch);
    let rest = dt, zaehler = 0;

    while (rest > EPS_ZEIT) {
      // frühesten Kontakt suchen
      let tMin = rest, art = null, i1 = -1, i2 = -1, ziel = null;
      for (let i = 0; i < aktiv.length; i++) {
        const a = aktiv[i];
        const bewegt = a.vx !== 0 || a.vy !== 0;
        const va = bewegt ? Math.hypot(a.vx, a.vy) : 0;
        for (let j = i + 1; j < aktiv.length; j++) {
          const b = aktiv[j];
          if (!bewegt && b.vx === 0 && b.vy === 0) continue;
          // Schnelltest: können sich die beiden in der Restzeit überhaupt erreichen?
          const reichweite = (va + Math.abs(b.vx) + Math.abs(b.vy)) * tMin + R2 + 0.5;
          const ddx = b.x - a.x, ddy = b.y - a.y;
          if (ddx > reichweite || -ddx > reichweite || ddy > reichweite || -ddy > reichweite) continue;
          const t = zeitKugelKugel(a.x, a.y, a.vx, a.vy, b.x, b.y, b.vx, b.vy, R2);
          if (t < tMin) { tMin = t; art = 'kugel'; i1 = i; i2 = j; }
        }
        if (!bewegt) continue;
        // Schnelltest: weit weg von allen Banden und Taschen? Dann keine Bandenprüfung nötig.
        const spiel = va * tMin + 1;
        if (Math.abs(a.x) < TISCH.X - R - spiel && Math.abs(a.y) < TISCH.Y - R - spiel) continue;
        for (const s of TISCH.banden) {
          const t = zeitKugelStrecke(a.x, a.y, a.vx, a.vy, s, R);
          if (t < tMin) { tMin = t; art = 'strecke'; i1 = i; ziel = s; }
        }
        for (const q of TISCH.punkte) {
          const t = zeitKugelPunkt(a.x, a.y, a.vx, a.vy, q, R);
          if (t < tMin) { tMin = t; art = 'punkt'; i1 = i; ziel = q; }
        }
      }

      // alle bis zum Kontakt (oder Schrittende) bewegen
      if (tMin > 0) {
        for (const k of aktiv) { k.x += k.vx * tMin; k.y += k.vy * tMin; }
        rest -= tMin;
      }
      if (!art) break;

      if (++zaehler > PHYSIK.MAX_EREIGNISSE) {
        // Notbremse gegen Endlosschleifen: Rest des Schritts ohne weitere Kontakte
        for (const k of aktiv) { k.x += k.vx * rest; k.y += k.vy * rest; }
        rest = 0;
        break;
      }

      if (art === 'kugel') {
        const a = aktiv[i1], b = aktiv[i2];
        let nx = b.x - a.x, ny = b.y - a.y;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;   // > 0: nähern sich
        if (vn > 0) {
          const j = (1 + PHYSIK.E_KUGEL) / 2 * vn;         // gleiche Massen
          a.vx -= j * nx; a.vy -= j * ny;
          b.vx += j * nx; b.vy += j * ny;
          if (ereignis) ereignis({ typ: 'kugel', a: a.nr, b: b.nr, staerke: vn });
        }
      } else {
        const k = aktiv[i1];
        let nx, ny;
        if (art === 'strecke') { nx = ziel.n.x; ny = ziel.n.y; }
        else { nx = k.x - ziel.x; ny = k.y - ziel.y; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; }
        const vn = k.vx * nx + k.vy * ny;                    // < 0: auf die Bande zu
        if (vn < 0) {
          const tx = k.vx - vn * nx, ty = k.vy - vn * ny;
          k.vx = tx * PHYSIK.BANDE_GLEIT - vn * PHYSIK.E_BANDE * nx;
          k.vy = ty * PHYSIK.BANDE_GLEIT - vn * PHYSIK.E_BANDE * ny;
          if (ereignis) ereignis({ typ: 'bande', kugel: k.nr, staerke: -vn });
        }
      }
    }

    // Taschen: Kugel ist durch die Kehle gerollt → fällt
    for (const k of aktiv) {
      const t = taschenTreffer(k.x, k.y, R);
      if (t) {
        k.aufTisch = false;
        k.fall = { tasche: t.nr, zeit: 0, x: k.x, y: k.y, vx: k.vx, vy: k.vy };
        k.vx = 0; k.vy = 0;
        if (ereignis) ereignis({ typ: 'tasche', kugel: k.nr, tasche: t.nr });
      }
    }

    // Reibung: gleichmäßiges Ausrollen, kleine Restgeschwindigkeit → 0
    for (const k of aktiv) {
      if (!k.aufTisch || (k.vx === 0 && k.vy === 0)) continue;
      const v = Math.hypot(k.vx, k.vy);
      const neu = v - (PHYSIK.ROLL_KONST + PHYSIK.ROLL_LINEAR * v) * dt;
      if (neu < PHYSIK.V_STOPP) { k.vx = 0; k.vy = 0; }
      else { k.vx *= neu / v; k.vy *= neu / v; }
    }
  },

  // Fallanimation weiterführen (nur Darstellung, nicht Teil der aktiven Physik)
  fallSchritt(kugeln, dt) {
    for (const k of kugeln) if (k.fall && k.fall.zeit < PHYSIK.FALL_DAUER) k.fall.zeit = Math.min(PHYSIK.FALL_DAUER, k.fall.zeit + dt);
  },

  // Ganzen Stoß ohne Darstellung durchrechnen (Tests und Computer). Gibt die Ereignisliste zurück.
  simuliere(kugeln, maxSek = PHYSIK.MAX_STOSSDAUER) {
    const ereignisse = [];
    const n = Math.ceil(maxSek / PHYSIK.DT);
    let i = 0;
    for (; i < n && Physik.inBewegung(kugeln); i++) Physik.schritt(kugeln, e => ereignisse.push(e));
    if (i >= n) Physik.anhalten(kugeln);
    return ereignisse;
  },

  anhalten(kugeln) { for (const k of kugeln) { k.vx = 0; k.vy = 0; } },

  kopie(kugeln) { return kugeln.map(k => ({ nr: k.nr, x: k.x, y: k.y, vx: k.vx, vy: k.vy, aufTisch: k.aufTisch, fall: null })); },
};

// ---------- Strahl für Zielvorschau und Computer ----------
// Wirft eine Kugel (Radius R) von (x, y) in Richtung (dx, dy) und findet den ersten Kontakt
// mit genau denselben Funktionen wie die Physik. Kugeln mit nr in ohne werden ignoriert.
// Rückgabe: { art: 'kugel'|'bande'|'tasche'|null, t (mm), x, y (Mittelpunkt beim Kontakt), kugel, nx, ny }
function wirfStrahl(kugeln, x, y, dx, dy, ohne = [], maxWeg = 6000) {
  const R = TISCH.R;
  let best = { art: null, t: maxWeg, x: x + dx * maxWeg, y: y + dy * maxWeg };
  for (const k of kugeln) {
    if (!k.aufTisch || ohne.includes(k.nr)) continue;
    const t = zeitKugelKugel(x, y, dx, dy, k.x, k.y, 0, 0, 2 * R);
    if (t < best.t) {
      const cx = x + dx * t, cy = y + dy * t;
      const l = Math.hypot(k.x - cx, k.y - cy) || 1;
      best = { art: 'kugel', t, x: cx, y: cy, kugel: k.nr, nx: (k.x - cx) / l, ny: (k.y - cy) / l };
    }
  }
  for (const s of TISCH.banden) {
    const t = zeitKugelStrecke(x, y, dx, dy, s, R);
    if (t < best.t) best = { art: 'bande', t, x: x + dx * t, y: y + dy * t, nx: s.n.x, ny: s.n.y };
  }
  for (const q of TISCH.punkte) {
    const t = zeitKugelPunkt(x, y, dx, dy, q, R);
    if (t < best.t) {
      const cx = x + dx * t, cy = y + dy * t, l = Math.hypot(cx - q.x, cy - q.y) || 1;
      best = { art: 'bande', t, x: cx, y: cy, nx: (cx - q.x) / l, ny: (cy - q.y) / l };
    }
  }
  // Tasche: Strahl überquert die Kehle, bevor er etwas anderes trifft
  for (const ta of TISCH.taschen) {
    const vn = dx * ta.achse.x + dy * ta.achse.y;
    if (vn <= 0) continue;
    const tief = (x - ta.kehle.x) * ta.achse.x + (y - ta.kehle.y) * ta.achse.y;
    const t = -tief / vn;
    if (t <= 0 || t >= best.t) continue;
    const cx = x + dx * t, cy = y + dy * t;
    const seit = Math.abs((cx - ta.kehle.x) * -ta.achse.y + (cy - ta.kehle.y) * ta.achse.x);
    if (seit < ta.kehleBreite / 2 + R) best = { art: 'tasche', t, x: cx, y: cy, tasche: ta.nr };
  }
  return best;
}

// ---------- Platzieren ----------
// Ist (x, y) eine gültige Position für eine Kugel? Ganz auf dem Tuch, nicht in einer
// Tasche, nicht auf einer anderen Kugel. nurKopffeld: links der Kopflinie.
function platzGueltig(kugeln, x, y, { ohne = 0, nurKopffeld = false } = {}) {
  const R = TISCH.R;
  if (!isFinite(x) || !isFinite(y)) return false;
  if (Math.abs(x) > TISCH.X - R || Math.abs(y) > TISCH.Y - R) return false;
  if (nurKopffeld && x > TISCH.kopfX) return false;
  // Vor jeder Taschenöffnung (Mundlinie) muss die ganze Kugel auf dem Tuch liegen
  for (const t of TISCH.taschen) {
    if (t.art !== 'ecke') continue;
    const [A] = t.mund;
    const d = (x - A.x) * t.achse.x + (y - A.y) * t.achse.y;   // > 0: hinter der Mundlinie
    if (d > -R) return false;
  }
  for (const k of kugeln) {
    if (!k.aufTisch || k.nr === ohne) continue;
    if (Math.hypot(k.x - x, k.y - y) < 2 * R + 0.01) return false;
  }
  return true;
}

// Nächste gültige Position zu einem Wunschpunkt (Spirale nach außen)
function naechsterFreierPlatz(kugeln, x, y, opt = {}) {
  if (platzGueltig(kugeln, x, y, opt)) return { x, y };
  for (let r = 4; r < 1400; r += 4) {
    const n = Math.max(8, Math.round(r / 3));
    for (let i = 0; i < n; i++) {
      const w = i / n * Math.PI * 2;
      const px = x + Math.cos(w) * r, py = y + Math.sin(w) * r;
      if (platzGueltig(kugeln, px, py, opt)) return { x: px, y: py };
    }
  }
  return null;
}
