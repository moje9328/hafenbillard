# Hafenbillard – Übergabe

Vierzehntes Pixelhafen-Spiel: 2D-Poolbillard (8-Ball) in der Draufsicht, Hafenkneipe als Kulisse,
Kalle die Krabbe (Original aus Krabbenalarm) als Maskottchen. Gegen den Computer (Entspannt /
Herausfordernd), zu zweit am selben Gerät, freies Training mit Übungen.

## Stand (Runde 1, 2026-11-09)

- Online seit 2026-11-09: https://moje9328.github.io/hafenbillard/ (Repo `moje9328/hafenbillard`, Pages aus main /, `sw.js` CACHE `hafenbillard-v1`).
- Übersichtsseite `~/spiele-seite`: Karte in `SPIELE` + 3 Bilder (Commit 4c28945), online.

## Bauen und Prüfen

```
python3 quelle/baue.py              # baut index.html aus quelle/ (index.html nie direkt bearbeiten)
node quelle/test-logik.js           # 331 Prüfungen: Physik, Vorschau, Aufbau, Regeln, Computer, 16 KI-Partien
python3 quelle/test-browser.py      # Chromium, ~400 Prüfungen inkl. kompletter Partien über die echte Bedienung
python3 quelle/test-browser.py webkit   # dasselbe mit dem Safari-Motor
python3 quelle/mache-icons.py       # App-Icons neu zeichnen
```

Lokal spielen: `cd ~/hafenbillard-app && python3 -m http.server 8000` → http://localhost:8000/
(oder index.html direkt öffnen). `?tempo=8` in der Adresse lässt die Zeit nur für Tests schneller laufen.

## Aufbau der Quellen (`quelle/`)

| Datei | Inhalt |
|---|---|
| `1-einstellungen.js` | **Zentrale Geometrie** (`TISCH`: Maße in mm, Kugelradius, Banden als Strecken mit Normale, Taschen mit Mund/Backen/Kehle/Lochzeichen, Kopflinie, Fußpunkt) und `PHYSIK`-Konstanten, Stärke↔Tempo |
| `2-physik.js` | Kugelphysik: fester Schritt 1/240 s, innerhalb des Schritts exakte Kontaktzeiten (Kugel–Kugel, Kugel–Bande, Kugel–Bandenecke), Reibung, Stillstand, Taschen (Kugel fällt erst, wenn ihr Mittelpunkt die Kehle überquert). `wirfStrahl` (Vorschau/KI) nutzt dieselben Kontaktfunktionen. Platzierungsprüfung |
| `3-aufbau.js` | Dreieck (Acht Mitte, hintere Ecken voll/halb, Rest gemischt, 0,2 mm Spalt + ±0,07 mm Toleranz), Acht wieder einsetzen, Übungen |
| `3-regeln.js` | `Stossprotokoll` sammelt Ereignisse; `werteStossAus` wertet den ganzen Stoß erst nach Stillstand aus (Hausregeln) |
| `3-computer.js` | Computergegner als Generator in Zeitscheiben; prüft Lochchancen geometrisch, rechnet Kandidaten auf einer Kopie mit derselben Physik + Regeln, Sicherheits- und Bandenstöße, Ball in Hand, Taschenansage; danach Ungenauigkeit je Stufe |
| `4-krabbe.js` | Kalle, wörtlich wie in Sonnenrutsch/Krabben-Krawall (aus Krabbenalarm) |
| `5-speicher.js` | `pixelhafen.hafenbillard` v1: Ton, Stärke, Modus, Zielhilfe, Siege; try/catch |
| `6-ton.js` | Web-Audio-Geräusche, max. 7 gleichzeitig, leise Kontakte stumm; Grundgerüst aus Sonnenrutsch |
| `7-grafik.js` | `Ansicht` (Welt↔Bild, 90° gedreht im Hochformat, sobald der Tisch dadurch größer wird) und Zeichnen |
| `8-eingabe.js` | Pointer Events/Tastatur → Aktionen |
| `duell.js` | gemeinsamer „Freunde herausfordern“-Baustein (zählt Siege gegen den Computer je Stärke) |
| `9-app.js` | Zustände, ein Game Loop, Stoßablauf, Auswertung, Computerzug, Menüs, `window.__billard` für Tests |

## Entscheidungen

- Eigene Physik statt Bibliothek (Planck/Box2D sind für Kugelbillard ungenau bei schnellen Kreisen; die ereignisgesteuerte Lösung ist kurz und tunnelt nie).
- Anstoß: Ohne Lage-Toleranz verhielt sich das Dreieck wie ein Newton-Pendel (fast alle Energie in zwei Eckkugeln, nur ~3 Kugeln an der Bande). Mit Spalt/Toleranz verteilt sich der Anstoß natürlich; kräftige Anstöße sind in Tests zu >85 % gültig.
- Ungültiger Anstoß: Wahl „neu aufbauen und selbst anstoßen“ oder „Tisch übernehmen“; der Computer baut immer neu auf.
- Revanche: Wer verloren hat, stößt an.
- Fehler aus Sonnenrutsch vermieden: Fenstertitel behalten ihre `id` (zeigeFenster setzt nur `aria-labelledby`). Ein Test fängt das ab (Ergebnisfenster).

## Nicht geprüft

- Echtes Handy/Tablet (nur Playwright-Emulation Chromium + WebKit), echte Safe-Area-Ränder (Notch).
- Ob die Geräusche gut klingen (nur erzeugt, nicht angehört).
- Gefühl der Physik und Schwierigkeit für Menschen (Test-Bot spielt mit den Planerzügen).
- 120-Hz-Bildschirme, sehr langsame Geräte.
- Teilen über das echte Handy-Teilen-Menü.
