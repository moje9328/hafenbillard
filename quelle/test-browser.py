#!/usr/bin/env python3
# Browser-Test mit Playwright. Aufruf: python3 quelle/test-browser.py [chromium|webkit] [bilder-ordner]
# Startet selbst einen kleinen Webserver und prüft das fertige index.html:
# Darstellung auf Handy (hoch/quer), Tablet und PC, Eingabe-Umrechnung (auch gedreht),
# komplette Partien über die echte Bedienung (gegen den Computer und zu zweit),
# Doppelstoß-Schutz, Ball in Hand, Taschenwahl, Pause/Tabwechsel, Revanche, Neustart,
# Training, Ton-Einstellung, Spielen ohne localStorage.
import asyncio, http.server, math, pathlib, socketserver, sys, threading
from playwright.async_api import async_playwright

ORDNER = pathlib.Path(__file__).resolve().parent.parent
MOTOR = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
BILDER = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ORDNER / 'quelle' / 'testbilder'
BILDER.mkdir(parents=True, exist_ok=True)

class Leise(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ORDNER), **k)
    def log_message(self, *a): pass
server = socketserver.TCPServer(('127.0.0.1', 0), Leise)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_address[1]}/index.html'

fehler, geprueft = [], 0
def ok(bed, text):
    global geprueft
    geprueft += 1
    if not bed:
        fehler.append(text); print('  FEHLER:', text)

async def neue_seite(b, w, h, touch=False, dpr=2, init=None, bewegung='no-preference', tempo=10, speicher=True):
    opt = dict(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=touch, reduced_motion=bewegung)
    if MOTOR == 'chromium': opt['is_mobile'] = touch
    ctx = await b.new_context(**opt)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page()
    pg.fehler = []
    pg.on('console', lambda m: pg.fehler.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.fehler.append(str(e)))
    await pg.goto(URL + (f'?tempo={tempo}' if tempo else ''))
    await pg.wait_for_timeout(300)
    pg.touch = touch
    return ctx, pg

Z = 'window.__billard'
async def zustand(pg): return await pg.evaluate(f'{Z}.zustand()')
async def warte_auf(pg, bedingung, ms=20000, schritt=40):
    for _ in range(ms // schritt):
        if await pg.evaluate(bedingung): return True
        await pg.wait_for_timeout(schritt)
    return False

# Weltpunkt → Seitenkoordinate (über dieselbe Ansicht wie das Spiel)
async def bildpunkt(pg, x, y):
    return await pg.evaluate('''([x, y]) => { const r = document.getElementById('bild').getBoundingClientRect();
      const p = window.__billard.Ansicht.zuBild(x, y); return [r.left + p.x, r.top + p.y]; }''', [x, y])

async def tippe(pg, x, y):
    if pg.touch: await pg.touchscreen.tap(x, y)
    else: await pg.mouse.click(x, y)

async def tippe_knopf(pg, sel):
    if pg.touch: await pg.tap(sel)
    else: await pg.click(sel)

# ---------- Ein Stoß über die echte Bedienung ----------
async def menschlicher_stoss(pg, plan, nutze_knopf=False):
    s = await pg.evaluate(f'{Z}.spiel()')
    z = await zustand(pg)
    if z == 'platzieren':
        wx, wy = plan['weiss']['x'], plan['weiss']['y']
        px, py = await bildpunkt(pg, wx, wy)
        await tippe(pg, px, py)
        await pg.wait_for_timeout(30)
        gueltig = await pg.evaluate(f'{Z}.spiel().platz && {Z}.spiel().platz.gueltig')
        if not gueltig:
            # Pixelraster: kleinen Schritt per Pfeiltaste versuchen
            for taste in ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] * 3:
                await pg.keyboard.press(taste)
                if await pg.evaluate(f'{Z}.spiel().platz.gueltig'): break
        ok(await pg.evaluate("!document.getElementById('stossKnopf').disabled"), 'Hier ablegen ist bei gültigem Platz bedienbar')
        await tippe_knopf(pg, '#stossKnopf')
        await pg.wait_for_timeout(30)
        ok(await zustand(pg) == 'zielen', 'nach dem Ablegen kann gezielt werden')
        # Die Weiße liegt pixelgenau etwas anders: Stoß von der echten Lage aus neu planen
        plan = await pg.evaluate(f'{Z}.vorschlag("herausfordernd")')
    # Acht: Tasche antippen
    if plan.get('tasche') is not None and await pg.evaluate(f'{Z}.spiel().angesagt === null'):
        t = await pg.evaluate(f'{Z}.TISCH.taschen[{plan["tasche"]}].zeichen')
        px, py = await bildpunkt(pg, t['x'], t['y'])
        await tippe(pg, px, py)
        ok(await pg.evaluate(f'{Z}.spiel().angesagt') == plan['tasche'], 'Tasche für die Acht per Antippen gewählt')
    s = await pg.evaluate(f'{Z}.spiel()')
    w = [k for k in s['kugeln'] if k['nr'] == 0][0]
    # Grob zielen: auf einen Punkt in Stoßrichtung tippen (Finger muss nicht auf der Weißen liegen)
    d = 380
    px, py = await bildpunkt(pg, w['x'] + math.cos(plan['winkel']) * d, w['y'] + math.sin(plan['winkel']) * d)
    vp = pg.viewport_size
    px = min(max(px, 2), vp['width'] - 2); py = min(max(py, 2), vp['height'] - 2)
    r = await pg.evaluate("(() => { const r = document.getElementById('bild').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
    if not (r[0] < px < r[2] and r[1] < py < r[3]):
        px, py = await bildpunkt(pg, w['x'] + math.cos(plan['winkel']) * 120, w['y'] + math.sin(plan['winkel']) * 120)
    await tippe(pg, px, py)
    # Fein nachstellen mit Pfeiltasten (0,1° pro Druck)
    await pg.focus('#bild')
    for _ in range(300):
        ist = await pg.evaluate(f'{Z}.ui.winkel')
        diff = math.atan2(math.sin(plan['winkel'] - ist), math.cos(plan['winkel'] - ist)) * 180 / math.pi
        if abs(diff) <= 0.06: break
        if _ == 299: ok(False, f'Feinzielen erreicht den Zielwinkel nicht (Rest {diff:.2f}°)')
        # Bildschirm-Uhrzeigersinn = Weltwinkel + (Drehung ohne Spiegelung)
        await pg.keyboard.press('Shift+ArrowRight' if diff > 1 else 'ArrowRight' if diff > 0 else 'Shift+ArrowLeft' if diff < -1 else 'ArrowLeft')
    # Stärke: Regler antippen, dann mit Pfeiltasten auf ±1 %
    spur = await pg.evaluate("(() => { const r = document.querySelector('#staerke .spur').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    await tippe(pg, spur[0] + spur[2] * plan['staerke'], spur[1] + spur[3] / 2)
    for _ in range(60):
        ist = await pg.evaluate(f'{Z}.ui.staerke')
        if abs(ist - plan['staerke']) <= 0.011: break
        await pg.keyboard.press('ArrowUp' if plan['staerke'] > ist else 'ArrowDown')
    vorher = sum((await pg.evaluate(f'{Z}.spiel().stoesse')))
    if nutze_knopf: await tippe_knopf(pg, '#stossKnopf')
    else:
        await pg.focus('#bild'); await pg.keyboard.press(' ')
    ok(await warte_auf(pg, f"['stoss','rollen'].includes({Z}.zustand()) || sum() !== {vorher}".replace('sum()', f'{Z}.spiel().stoesse[0] + {Z}.spiel().stoesse[1]'), 3000), 'Stoß wurde ausgelöst')

async def spiele_partie(pg, max_stoesse=120, name='', bilder=False):
    """Spielt eine Partie über die Bedienung bis zum Ergebnis. Gibt Statistik zurück."""
    stat = {'mensch': 0, 'computer': 0, 'uebergaben': 0, 'bih': 0, 'acht': 0, 'fouls': 0, 'anstosswahl': 0}
    for runde in range(max_stoesse * 3):
        z = await zustand(pg)
        if z == 'ende': break
        if z in ('rollen', 'stoss'):
            ok(await pg.evaluate("document.getElementById('stossKnopf').disabled"), 'Stoßen ist gesperrt, solange Kugeln rollen')
            ok('rollen' in (await pg.evaluate("document.getElementById('status').textContent")), 'Status „Kugeln rollen …“')
            await warte_auf(pg, f"!['rollen','stoss'].includes({Z}.zustand())", 30000)
            continue
        if z == 'computer':
            stat['computer'] += 1
            await warte_auf(pg, f"{Z}.zustand() !== 'computer'", 20000)
            continue
        if z == 'uebergabe':
            stat['uebergaben'] += 1
            await tippe_knopf(pg, '#uebergabeKnopf'); await pg.wait_for_timeout(30); continue
        if z == 'anstossWahl':
            stat['anstosswahl'] += 1
            await tippe_knopf(pg, '#neuAnstossKnopf'); await pg.wait_for_timeout(30); continue
        if z in ('zielen', 'platzieren'):
            if z == 'platzieren': stat['bih'] += 1
            plan = await pg.evaluate(f'{Z}.vorschlag("herausfordernd")')
            if plan.get('tasche') is not None: stat['acht'] += 1
            await menschlicher_stoss(pg, plan, nutze_knopf=(stat['mensch'] % 2 == 1))
            stat['mensch'] += 1
            if bilder and stat['mensch'] == 3: await pg.screenshot(path=str(BILDER / f'{name}-rollen.png'))
            if stat['mensch'] > max_stoesse: break
            continue
        await pg.wait_for_timeout(50)
    s = await pg.evaluate(f'{Z}.spiel()')
    stat['fouls'] = sum(s['fouls'])
    stat['ende'] = s.get('ende')
    return stat

async def layout_pruefen(pg, name):
    m = await pg.evaluate('''() => {
      const r = id => { const e = document.getElementById(id).getBoundingClientRect(); return { l: e.left, t: e.top, r: e.right, b: e.bottom, w: e.width, h: e.height }; };
      const b = r('bild');
      const A = window.__billard.Ansicht, T = window.__billard.TISCH;
      const ecken = [[-A.aussenX, -A.aussenY], [A.aussenX, A.aussenY], [-A.aussenX, A.aussenY], [A.aussenX, -A.aussenY]].map(([x, y]) => A.zuBild(x, y));
      const taschen = T.taschen.map(t => { const p = A.zuBild(t.zeichen.x, t.zeichen.y); return p.x >= 0 && p.y >= 0 && p.x <= b.w && p.y <= b.h; });
      const knoepfe = [...document.querySelectorAll('#spiel button, #staerke')].filter(e => e.offsetParent).map(e => { const q = e.getBoundingClientRect(); return [e.id || e.className, q.width, q.height]; });
      return { b, ecken, taschen, knoepfe, gedreht: A.gedreht, s: A.s, scrollW: document.documentElement.scrollWidth, w: innerWidth,
        steuer: r('steuerung'), kopf: r('kopf'), dpr: document.getElementById('bild').width / b.w };
    }''')
    ok(m['scrollW'] <= m['w'], f'{name}: kein waagerechtes Scrollen')
    ok(all(m['taschen']), f'{name}: alle sechs Taschen sichtbar')
    ok(all(-1 <= e['x'] <= m['b']['w'] + 1 and -1 <= e['y'] <= m['b']['h'] + 1 for e in m['ecken']), f'{name}: ganzer Tisch mit Rahmen im Bild')
    klein = [k for k in m['knoepfe'] if k[1] < 43.5 or k[2] < 43.5]
    ok(not klein, f'{name}: alle Bedienelemente mindestens 44×44 px {klein}')
    # Bedienung liegt außerhalb der Spielfläche
    st, b = m['steuer'], m['b']
    ok(st['t'] >= b['b'] - 1 or st['l'] >= b['r'] - 1, f'{name}: Bedienung außerhalb der Spielfläche')
    ok(abs(m['dpr'] - 2) < 0.05, f'{name}: Leinwand nutzt devicePixelRatio')
    return m

async def main():
    async with async_playwright() as p:
        b = await (p.webkit if MOTOR == 'webkit' else p.chromium).launch()

        print('· Darstellung auf verschiedenen Geräten')
        for name, w, h, touch, gedreht in [('pc', 1440, 900, False, False), ('handy-hoch', 390, 844, True, True), ('handy-quer', 844, 390, True, False), ('tablet', 820, 1180, True, True), ('klein', 360, 640, True, True)]:
            ctx, pg = await neue_seite(b, w, h, touch)
            await pg.screenshot(path=str(BILDER / f'{name}-menue.png'))
            await tippe_knopf(pg, '#spielenKnopf'); await pg.wait_for_timeout(200)
            m = await layout_pruefen(pg, name)
            ok(m['gedreht'] == gedreht, f'{name}: Tisch {"gedreht" if gedreht else "quer"}')
            # Eingabe-Umrechnung: Tippen auf eine Kugel richtet den Queue genau dorthin aus
            await tippe_knopf(pg, '#stossKnopf')   # Weiße im Kopffeld ablegen
            await pg.wait_for_timeout(50)
            s = await pg.evaluate(f'{Z}.spiel()')
            w0 = [k for k in s['kugeln'] if k['nr'] == 0][0]
            ziel = [k for k in s['kugeln'] if k['nr'] == 8][0]
            px, py = await bildpunkt(pg, ziel['x'], ziel['y'])
            await tippe(pg, px, py)
            winkel = await pg.evaluate(f'{Z}.ui.winkel')
            soll = math.atan2(ziel['y'] - w0['y'], ziel['x'] - w0['x'])
            ok(abs(math.atan2(math.sin(winkel - soll), math.cos(winkel - soll))) < 0.01, f'{name}: Tippen zielt korrekt (auch gedreht)')
            v = await pg.evaluate(f'{Z}.vorschau()')
            ok(v and v['art'] == 'kugel' and v['objekt'] is not None, f'{name}: Zielhilfe zeigt den ersten Kontakt')
            # Feinzielen-Knopf: genau 0,1°
            await tippe_knopf(pg, '#rechtsKnopf'); await pg.wait_for_timeout(30)
            w2 = await pg.evaluate(f'{Z}.ui.winkel')
            ok(abs((w2 - winkel) * 180 / math.pi - 0.1) < 1e-6, f'{name}: Feinzielen-Knopf dreht um 0,1°')
            # Menüknöpfe lösen keine Tischaktion aus
            await tippe_knopf(pg, '#tonKnopf'); await tippe_knopf(pg, '#tonKnopf')
            ok(await pg.evaluate(f'{Z}.ui.winkel') == w2, f'{name}: Ton-Knopf verändert das Zielen nicht')
            # Größenänderung verändert keine Weltpositionen
            vorher = await pg.evaluate(f'JSON.stringify({Z}.spiel().kugeln.map(k => [k.x, k.y]))')
            await pg.set_viewport_size({'width': h, 'height': w}); await pg.wait_for_timeout(150)
            ok(await pg.evaluate(f'JSON.stringify({Z}.spiel().kugeln.map(k => [k.x, k.y]))') == vorher, f'{name}: Drehen des Geräts ändert keine Kugelposition')
            await layout_pruefen(pg, name + '-gedreht')
            await pg.set_viewport_size({'width': w, 'height': h}); await pg.wait_for_timeout(150)
            await pg.screenshot(path=str(BILDER / f'{name}-zielen.png'))
            ok(not pg.fehler, f'{name}: keine JS-Fehler {pg.fehler[:3]}')
            await ctx.close()

        print('· Doppelstoß-Schutz und Bedienung während des Rollens')
        ctx, pg = await neue_seite(b, 1280, 800, tempo=1)
        await pg.click('#spielenKnopf'); await pg.click('#stossKnopf'); await pg.wait_for_timeout(50)
        await pg.evaluate(f'{Z}.ui.staerke = 0.5')
        await pg.focus('#bild')
        # Doppelklick auf Stoßen + Leertaste + gehaltene Leertaste: genau ein Stoß
        await pg.click('#stossKnopf', click_count=2)
        await pg.keyboard.press(' ')
        await pg.keyboard.down(' '); await pg.wait_for_timeout(400); await pg.keyboard.up(' ')
        ok(await pg.evaluate(f'{Z}.spiel().stoesse[0]') == 1, 'Doppelklick, Leertaste und Tastenwiederholung lösen genau einen Stoß aus')
        await pg.wait_for_timeout(200)
        ok(await zustand(pg) == 'rollen', 'Kugeln rollen nach dem Anstoß')
        w_vor = await pg.evaluate(f'{Z}.ui.winkel')
        bild = await pg.evaluate("(() => { const r = document.getElementById('bild').getBoundingClientRect(); return [r.left + r.width * 0.2, r.top + r.height * 0.2]; })()")
        await pg.mouse.click(*bild)
        await pg.keyboard.press('ArrowLeft')
        ok(await pg.evaluate(f'{Z}.ui.winkel') == w_vor, 'Zielen ist während des Rollens gesperrt')
        geschw = await pg.evaluate(f'JSON.stringify({Z}.spiel().kugeln.map(k => [k.vx, k.vy]))')
        ok(geschw != '[]', 'Bewegung läuft')
        # Pause: Physik steht
        await pg.click('#pauseKnopf')
        pos1 = await pg.evaluate(f'JSON.stringify({Z}.spiel().kugeln.map(k => [k.x, k.y]))')
        await pg.wait_for_timeout(600)
        pos2 = await pg.evaluate(f'JSON.stringify({Z}.spiel().kugeln.map(k => [k.x, k.y]))')
        ok(pos1 == pos2 and await pg.evaluate(f'{Z}.pausiert()'), 'Pause hält die Physik an')
        await pg.click('#weiterKnopf')
        await pg.wait_for_timeout(300)
        ok(await pg.evaluate(f'JSON.stringify({Z}.spiel().kugeln.map(k => [k.x, k.y]))') != pos2 or await zustand(pg) != 'rollen', 'nach „Weiter“ läuft die Physik weiter')
        # Tabwechsel pausiert automatisch, Fortsetzen nur bewusst
        await pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))")
        ok(await pg.evaluate(f'{Z}.pausiert()'), 'Tabwechsel pausiert')
        await pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(300)
        ok(await pg.evaluate(f'{Z}.pausiert()'), 'nach Rückkehr bleibt die Pause, bis man bewusst fortsetzt')
        ok(await pg.is_visible('#fPause'), 'Pausenfenster sichtbar')
        await pg.keyboard.press('p')
        ok(not await pg.evaluate(f'{Z}.pausiert()'), 'P setzt fort')
        ok(not pg.fehler, f'keine JS-Fehler {pg.fehler[:3]}')
        await ctx.close()

        print('· Ball in Hand: ungültige Plätze')
        ctx, pg = await neue_seite(b, 1280, 800)
        await pg.click('#spielenKnopf'); await pg.wait_for_timeout(100)
        s = await pg.evaluate(f'{Z}.spiel()')
        acht = [k for k in s['kugeln'] if k['nr'] == 8][0]
        for (x, y, text) in [(acht['x'], acht['y'], 'auf einer Kugel'), (0, 0, 'außerhalb des Kopffelds beim Anstoß'), (-960, -480, 'in der Ecktasche')]:
            px, py = await bildpunkt(pg, x, y)
            await pg.mouse.click(px, py)
            ok(not await pg.evaluate(f'{Z}.spiel().platz.gueltig'), f'Platz {text} ist ungültig')
            ok(await pg.evaluate("document.getElementById('stossKnopf').disabled"), f'Ablegen {text} nicht möglich')
            ok('geht es nicht' in await pg.evaluate("document.getElementById('status').textContent"), f'Hinweis bei ungültigem Platz ({text})')
        await pg.screenshot(path=str(BILDER / 'ungueltig.png'))
        await pg.keyboard.press('Enter')
        ok(await zustand(pg) == 'platzieren', 'Enter bestätigt keinen ungültigen Platz')
        px, py = await bildpunkt(pg, -700, 150)
        await pg.mouse.click(px, py)
        ok(await pg.evaluate(f'{Z}.spiel().platz.gueltig'), 'freier Platz im Kopffeld ist gültig')
        await pg.focus('#bild'); await pg.keyboard.press('Enter')
        ok(await zustand(pg) == 'zielen', 'Enter bestätigt gültigen Platz')
        await ctx.close()

        print('· Komplette Partie gegen den Computer (Herausfordernd), Handy hochkant')
        init_stufe = "try { localStorage.setItem('pixelhafen.hafenbillard', JSON.stringify({ v: 1, ton: true, stufe: 'herausfordernd', modus: 'computer', hilfe: true, siege: {}, partien: 0 })); } catch (e) {}"
        ctx, pg = await neue_seite(b, 390, 844, True, init=init_stufe, tempo=12)
        await pg.evaluate(f'{Z}.saat(4)')
        await tippe_knopf(pg, '#spielenKnopf')
        stat = await spiele_partie(pg, name='computer', bilder=True)
        print('   ', {k: v for k, v in stat.items() if k != 'ende'}, stat['ende'], pg.fehler[:3])
        ok(await zustand(pg) == 'ende' and stat['ende'] and stat['ende']['grund'], 'Partie gegen den Computer endet mit Gewinner und Grund')
        ok(stat['computer'] > 0 and stat['mensch'] > 0, 'beide Seiten haben gespielt')
        ok(await pg.is_visible('#fErgebnis'), 'Ergebnisfenster sichtbar')
        grund = await pg.evaluate("document.getElementById('ergebnisGrund').textContent")
        ok(len(grund) > 10, f'Ergebnisgrund wird angezeigt: {grund}')
        await pg.screenshot(path=str(BILDER / 'ergebnis.png'))
        # Revanche setzt alles zurück
        await tippe_knopf(pg, '#revancheKnopf'); await pg.wait_for_timeout(200)
        s = await pg.evaluate(f'{Z}.spiel()')
        verlierer = 1 - stat['ende']['sieger']
        ok(s['anstossVon'] == verlierer and s['fouls'] == [0, 0] and s['stoesse'][1 - verlierer] == 0 and s['stoesse'][verlierer] <= 1, 'Revanche: wer verloren hat, stößt an; Zähler zurückgesetzt')
        ok(s['stoesse'][verlierer] == 1 or (sum(1 for k in s['kugeln'] if k['aufTisch']) == 16 and s['gruppen'] == [None, None] and s['anstoss']), 'Revanche: neuer Aufbau mit offenem Tisch')
        ok(not pg.fehler, f'keine JS-Fehler {pg.fehler[:3]}')
        await ctx.close()

        print('· Komplette Partie zu zweit, PC')
        ctx, pg = await neue_seite(b, 1440, 900, tempo=12)
        await pg.evaluate(f'{Z}.saat(9)')
        await pg.click('.js-modus[data-modus="zweier"]')
        ok(await pg.is_hidden('#stufenWahl'), 'Zu zweit: keine Computerstärke')
        await pg.click('#spielenKnopf')
        ok(await pg.evaluate("document.querySelector('#sp1 .nm').textContent") == 'Spieler 2', 'Zu zweit: Namen Spieler 1/2')
        stat = await spiele_partie(pg, name='zweier')
        print('   ', {k: v for k, v in stat.items() if k != 'ende'}, stat['ende'], pg.fehler[:3])
        ok(await zustand(pg) == 'ende' and stat['ende'], 'Partie zu zweit endet mit Gewinner')
        ok(stat['uebergaben'] > 0, 'Übergabehinweis beim Zugwechsel erscheint')
        ok(stat['acht'] > 0, 'Tasche für die Acht wurde gewählt')
        # Neustart über Pause-Menü (nach Revanche)
        await pg.click('#revancheKnopf'); await pg.wait_for_timeout(100)
        await pg.click('#pauseKnopf'); await pg.click('#neustartKnopf'); await pg.wait_for_timeout(100)
        s = await pg.evaluate(f'{Z}.spiel()')
        ok(await zustand(pg) == 'platzieren' and s['stoesse'] == [0, 0] and sum(1 for k in s['kugeln'] if k['aufTisch']) == 16 and not await pg.evaluate(f'{Z}.pausiert()'), 'Neustart setzt alles vollständig zurück')
        await pg.click('#pauseKnopf'); await pg.click('#menueKnopf')
        ok(await zustand(pg) == 'menue' and await pg.is_visible('#fStart'), 'Zum Menü')
        ok(not pg.fehler, f'keine JS-Fehler {pg.fehler[:3]}')
        await ctx.close()

        print('· Partie gegen den Computer (Entspannt), Handy quer, Safari-Engine falls gewählt')
        ctx, pg = await neue_seite(b, 844, 390, True, tempo=12)
        await pg.evaluate(f'{Z}.saat(21)')
        await tippe_knopf(pg, '#spielenKnopf')
        stat = await spiele_partie(pg, name='quer')
        print('   ', {k: v for k, v in stat.items() if k != 'ende'}, stat['ende'], pg.fehler[:3])
        ok(await zustand(pg) == 'ende', 'Partie im Querformat endet')
        ok(not pg.fehler, f'keine JS-Fehler {pg.fehler[:3]}')
        await ctx.close()

        print('· Training')
        ctx, pg = await neue_seite(b, 1280, 800, tempo=10)
        await pg.click('.js-modus[data-modus="training"]'); await pg.click('#spielenKnopf'); await pg.wait_for_timeout(100)
        ok(await zustand(pg) == 'zielen' and await pg.is_visible('#trainingLeiste'), 'Training startet direkt mit Zielen und Trainingsleiste')
        for uebung in ['gerade', 'schnitt', 'bande']:
            await pg.select_option('#uebungWahl', uebung); await pg.wait_for_timeout(80)
            n = await pg.evaluate(f'{Z}.spiel().kugeln.length')
            ok(n >= 2 and await zustand(pg) == 'zielen', f'Übung {uebung} aufgebaut')
        # gerader Stoß: Vorschlag spielen → Kugel fällt
        await pg.select_option('#uebungWahl', 'gerade'); await pg.wait_for_timeout(80)
        plan = await pg.evaluate(f'{Z}.vorschlag("herausfordernd")')
        await menschlicher_stoss(pg, plan)
        await warte_auf(pg, f"{Z}.zustand() !== 'rollen' && {Z}.zustand() !== 'stoss'")
        ok(await pg.evaluate(f'!{Z}.spiel().kugeln.find(k => k.nr === 3).aufTisch'), 'Übung gerader Stoß: Kugel versenkt')
        # Bandenübung: direkter Weg versperrt
        await pg.select_option('#uebungWahl', 'bande'); await pg.wait_for_timeout(80)
        v = await pg.evaluate(f'''(() => {{ const s = {Z}.spiel(); const w = s.kugeln[0], z = s.kugeln.find(k => k.nr === 5);
            {Z}.ui.winkel = Math.atan2(z.y - w.y, z.x - w.x); return {Z}.vorschau(); }})()''')
        ok(v['art'] == 'kugel' and v['objekt'] and abs(v['objekt']['x'] - 500) > 1, 'Bandenübung: Vorschau endet an der Kugel im Weg, nicht an der verdeckten Zielkugel')
        # erweiterte Hilfe an/aus
        hilfe1 = await pg.evaluate(f"{Z}.vorschau().weissWeiter !== undefined")
        await pg.click('#hilfeKnopf')
        hilfe2 = await pg.evaluate(f"{Z}.vorschau().weissWeiter !== undefined")
        ok(hilfe1 and not hilfe2, 'erweiterte Zielhilfe lässt sich abschalten')
        await pg.click('#hilfeKnopf')
        # Weiße versenken → neu platzieren
        await pg.evaluate(f'''(() => {{ const s = {Z}.spiel(); const w = s.kugeln[0]; const t = {Z}.TISCH.taschen[0];
            w.x = t.kehle.x - t.achse.x * 200; w.y = t.kehle.y - t.achse.y * 200; {Z}.ui.winkel = Math.atan2(t.achse.y, t.achse.x); {Z}.ui.staerke = 0.3; }})()''')
        await pg.focus('#bild'); await pg.keyboard.press(' ')
        await warte_auf(pg, f"{Z}.zustand() === 'platzieren'", 8000)
        ok(await zustand(pg) == 'platzieren', 'Training: versenkte Weiße wird neu platziert')
        await pg.click('#stossKnopf')
        ok(await zustand(pg) == 'zielen', 'Training: nach dem Ablegen weiter')
        await pg.click('#neuAufbauKnopf'); await pg.wait_for_timeout(80)
        ok(await pg.evaluate(f'{Z}.spiel().kugeln.filter(k => k.aufTisch).length') == 4 and await pg.evaluate(f'{Z}.spiel().kugeln[0].x') == -500, 'Neu aufbauen setzt die gewählte Übung (Bande) neu')
        await pg.select_option('#uebungWahl', 'frei'); await pg.wait_for_timeout(80)
        ok(await pg.evaluate(f'{Z}.spiel().kugeln.filter(k => k.aufTisch).length') == 16, 'Freies Spiel: alle Kugeln')
        await pg.screenshot(path=str(BILDER / 'training.png'))
        ok(not pg.fehler, f'keine JS-Fehler {pg.fehler[:3]}')
        await ctx.close()

        print('· Regeln, Ton-Einstellung, Speicher')
        ctx, pg = await neue_seite(b, 1280, 800)
        await pg.click('#regelnKnopf')
        txt = await pg.evaluate("document.getElementById('fRegeln').textContent")
        ok('Ball in Hand' in txt and 'keine offiziellen Turnierregeln' in txt and 'vier' in txt, 'Regeln werden angezeigt')
        await pg.screenshot(path=str(BILDER / 'regeln.png'))
        await pg.click('#regelnZurueck')
        ok(await pg.is_visible('#fStart'), 'Zurück aus den Regeln')
        await pg.click('#fStart .js-ton')
        await pg.click('.js-stufe[data-stufe="herausfordernd"]')
        await pg.reload(); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('#fStart .js-ton').getAttribute('aria-pressed')") == 'false', 'Ton-Einstellung bleibt nach Neuladen gespeichert')
        ok(await pg.evaluate("document.querySelector('.js-stufe[data-stufe=\"herausfordernd\"]').getAttribute('aria-pressed')") == 'true', 'Computerstärke bleibt gespeichert')
        ok(await pg.evaluate(f"{Z}.ton().kontext") == 'keiner', 'kein Audio, solange Ton aus ist')
        # Regeln mitten im Spiel pausieren
        await pg.click('#spielenKnopf'); await pg.click('#regelnKnopfSpiel')
        ok(await pg.evaluate(f'{Z}.pausiert()') and await pg.is_visible('#fRegeln'), 'Regeln im Spiel pausieren')
        await pg.click('#regelnZurueck'); await pg.click('#weiterKnopf')
        ok(not await pg.evaluate(f'{Z}.pausiert()'), 'aus den Regeln zurück ins Spiel')
        await ctx.close()
        ctx, pg = await neue_seite(b, 1280, 800)
        ok(await pg.evaluate(f"{Z}.ton().kontext") == 'keiner', 'Audio startet nicht vor der ersten Nutzeraktion')
        await pg.click('#spielenKnopf'); await pg.wait_for_timeout(100)
        if MOTOR == 'chromium':
            ok(await pg.evaluate(f"{Z}.ton().kontext") in ('running', 'suspended'), 'Audio wird nach Nutzeraktion gestartet')
        await ctx.close()

        print('· Ohne localStorage')
        sperre = "Object.defineProperty(window, 'localStorage', { get() { throw new Error('gesperrt'); } });"
        ctx, pg = await neue_seite(b, 1280, 800, init=sperre)
        await pg.click('#spielenKnopf'); await pg.click('#stossKnopf'); await pg.wait_for_timeout(50)
        await pg.focus('#bild'); await pg.keyboard.press(' ')
        await warte_auf(pg, f"!['rollen','stoss'].includes({Z}.zustand())", 15000)
        ok(await pg.evaluate(f'{Z}.spiel().stoesse[0]') == 1 and not pg.fehler, f'spielbar ohne localStorage {pg.fehler[:2]}')
        await ctx.close()

        print('· Weniger Bewegung')
        ctx, pg = await neue_seite(b, 390, 844, True, bewegung='reduce', tempo=1)
        await tippe_knopf(pg, '#spielenKnopf'); await tippe_knopf(pg, '#stossKnopf')
        await pg.focus('#bild'); await pg.keyboard.press(' ')
        await pg.wait_for_timeout(80)
        ok(await zustand(pg) == 'rollen', 'mit „weniger Bewegung“: Stoß ohne lange Animation')
        ok(not pg.fehler, f'keine JS-Fehler {pg.fehler[:3]}')
        await ctx.close()

        await b.close()
    print(f'\n{MOTOR}: {geprueft} Prüfungen, {len(fehler)} Fehler')
    sys.exit(1 if fehler else 0)

asyncio.run(main())
