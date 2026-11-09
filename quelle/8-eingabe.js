// ===================================================================
// 8 · EINGABE
// Übersetzt Pointer- und Tastaturereignisse in Aktionen für die App.
// Pointer Events für Maus, Finger und Stift (keine doppelten Touch-/
// Mausauslösungen). Nur der erste Finger zählt. Menüs liegen außerhalb
// der Leinwand und lösen daher nie Tischaktionen aus.
// ===================================================================

function richteEingabeEin(leinwand, a) {
  // a: { tisch(welt, phase), fein(richtung, wiederholung), staerke(wert 0..1), staerkeSchritt(d), stoss(),
  //      bestaetigen(), pause(), ton(), tasche(nr), verschiebe(dx, dy), darf() }
  let zeiger = null;   // id des aktiven Pointers auf dem Tisch

  function weltPunkt(e) {
    const r = leinwand.getBoundingClientRect();
    return Ansicht.zuWelt(e.clientX - r.left, e.clientY - r.top);
  }
  leinwand.addEventListener('pointerdown', e => {
    if (!e.isPrimary || zeiger !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    zeiger = e.pointerId;
    try { leinwand.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    leinwand.focus({ preventScroll: true });
    a.tisch(weltPunkt(e), 'start');
  });
  leinwand.addEventListener('pointermove', e => {
    if (e.pointerId !== zeiger) return;
    a.tisch(weltPunkt(e), 'zug');
  });
  const ende = e => {
    if (e.pointerId !== zeiger) return;
    zeiger = null;
    a.tisch(weltPunkt(e), e.type === 'pointercancel' ? 'abbruch' : 'ende');
  };
  leinwand.addEventListener('pointerup', ende);
  leinwand.addEventListener('pointercancel', ende);
  leinwand.addEventListener('lostpointercapture', e => { if (e.pointerId === zeiger) { zeiger = null; a.tisch(null, 'abbruch'); } });
  leinwand.addEventListener('contextmenu', e => e.preventDefault());

  // Feinzielen: Tippen = ein kleiner Schritt, Halten = langsam weiterdrehen (ein Timer, sauber beendet)
  function feinKnopf(knopf, richtung) {
    let timer = null, schritte = 0, aktiv = null;
    const stopp = () => { if (timer) { clearTimeout(timer); timer = null; } aktiv = null; };
    const weiter = () => {
      schritte++;
      a.fein(richtung, schritte);
      timer = setTimeout(weiter, schritte < 12 ? 70 : 40);
    };
    knopf.addEventListener('pointerdown', e => {
      if (!e.isPrimary || aktiv !== null || knopf.disabled) return;
      e.preventDefault();
      aktiv = e.pointerId;
      try { knopf.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
      schritte = 0;
      a.fein(richtung, 0);
      timer = setTimeout(weiter, 380);
    });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) knopf.addEventListener(t, e => { if (e.pointerId === aktiv) stopp(); });
    // Tastatur (Enter/Leertaste auf dem Knopf) erzeugt einen click mit detail 0
    knopf.addEventListener('click', e => { if (e.detail === 0) a.fein(richtung, 0); });
    return stopp;
  }
  const stoppL = feinKnopf(document.getElementById('linksKnopf'), -1);
  const stoppR = feinKnopf(document.getElementById('rechtsKnopf'), 1);

  // Stärkeregler (eigenes Element mit role=slider)
  const regler = document.getElementById('staerke');
  const spur = regler.querySelector('.spur');
  let reglerZeiger = null;
  const reglerWert = e => {
    const r = spur.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
  };
  regler.addEventListener('pointerdown', e => {
    if (!e.isPrimary || reglerZeiger !== null || regler.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    reglerZeiger = e.pointerId;
    try { regler.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    regler.focus({ preventScroll: true });
    a.staerke(reglerWert(e));
  });
  regler.addEventListener('pointermove', e => { if (e.pointerId === reglerZeiger) a.staerke(reglerWert(e)); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) regler.addEventListener(t, e => { if (e.pointerId === reglerZeiger) reglerZeiger = null; });
  regler.addEventListener('keydown', e => {
    const gross = e.shiftKey ? 10 : 2;
    let d = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'PageUp') d = e.key === 'PageUp' ? 10 : gross;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'PageDown') d = e.key === 'PageDown' ? -10 : -gross;
    else if (e.key === 'Home') { a.staerke(0); e.preventDefault(); e.stopPropagation(); return; }
    else if (e.key === 'End') { a.staerke(1); e.preventDefault(); e.stopPropagation(); return; }
    if (d !== null) { a.staerkeSchritt(d / 100); e.preventDefault(); e.stopPropagation(); }
  });

  // Stoßen: genau ein Stoß pro Klick (click feuert für Maus, Finger und Tastatur genau einmal)
  document.getElementById('stossKnopf').addEventListener('click', () => a.stoss());

  // Tastatur fürs ganze Spiel
  document.addEventListener('keydown', e => {
    if (!a.darf()) return;
    const ziel = e.target;
    const aufBedienelement = ziel && ziel.closest && ziel.closest('button, a, select, input, [role="slider"]');
    if (e.key === ' ' || e.code === 'Space') {
      if (aufBedienelement) return;          // Leertaste auf einem Knopf bedient nur diesen Knopf
      e.preventDefault();
      if (e.repeat) return;                  // keine automatische Wiederholung
      a.stoss();
      return;
    }
    if (e.key === 'Enter' && !aufBedienelement) { e.preventDefault(); if (!e.repeat) a.bestaetigen(); return; }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); if (!e.repeat) a.pause(); return; }
    if (e.key === 'm' || e.key === 'M') { if (!e.repeat) a.ton(); return; }
    if (/^[1-6]$/.test(e.key)) { a.tasche(Number(e.key) - 1); return; }
    if (aufBedienelement && ziel.closest('[role="slider"], select')) return;
    const grob = e.shiftKey;
    if (e.key === 'ArrowLeft') { e.preventDefault(); a.fein(-1, grob ? 20 : 0, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); a.fein(1, grob ? 20 : 0, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); a.staerkeSchritt(grob ? 0.1 : 0.02); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); a.staerkeSchritt(grob ? -0.1 : -0.02); }
  });

  return {
    loslassen() { zeiger = null; reglerZeiger = null; stoppL(); stoppR(); },
  };
}
