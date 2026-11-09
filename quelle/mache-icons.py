#!/usr/bin/env python3
# Zeichnet die App-Icons (Tuch, Acht und Kalle aus dem Spiel). Aufruf: python3 quelle/mache-icons.py
import asyncio, pathlib, base64
from playwright.async_api import async_playwright
ORDNER = pathlib.Path(__file__).resolve().parent.parent
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto((ORDNER / 'index.html').as_uri()); await pg.wait_for_timeout(400)
        for groesse, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
            daten = await pg.evaluate('''(n) => { const cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d');
              const v = c.createRadialGradient(n / 2, n / 2, n * 0.1, n / 2, n / 2, n * 0.75); v.addColorStop(0, '#22B5A5'); v.addColorStop(1, '#0E7469');
              c.fillStyle = v; c.fillRect(0, 0, n, n);
              c.lineWidth = n * 0.06; c.strokeStyle = '#5A3420'; c.strokeRect(n * 0.03, n * 0.03, n * 0.94, n * 0.94);
              Grafik.malKugel(c, 8, n * 0.66, n * 0.36, n * 0.17);
              const e = n * 0.62 / 44; c.save(); c.translate(n * 0.06, n * 0.4); c.scale(e, e); malKrabbe(c, { figur: 'kalle', mund: 'jubel', schereHoch: true, schereAuf: true }); c.restore();
              return cv.toDataURL('image/png').split(',')[1]; }''', groesse)
            (ORDNER / 'icons' / name).write_bytes(base64.b64decode(daten))
        await b.close()
asyncio.run(main())
