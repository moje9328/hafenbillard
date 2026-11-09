// Lädt Einstellungen, Physik, Aufbau, Regeln und Computer in Node – exakt dieselben Dateien wie im Spiel.
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function ladeLogik() {
  const ctx = { console, Math, Object, Array, Set, Map, Infinity, Date, performance: { now: () => Date.now() } };
  vm.createContext(ctx);
  ctx.globalThis = ctx;
  const teile = ['1-einstellungen.js', '2-physik.js', '3-aufbau.js', '3-regeln.js', '3-computer.js'];
  const code = teile.map(n => fs.readFileSync(path.join(__dirname, n), 'utf8')).join('\n;\n')
    + '\n;globalThis.__ = { TISCH, PHYSIK, staerkeZuTempo, tempoZuStaerke, gruppeVon, VOLLE, HALBE, zufall, neueKugel, Physik, wirfStrahl, platzGueltig, naechsterFreierPlatz, taschenTreffer, zeitKugelKugel, dreieckPlaetze, baueDreieck, setzeAchtEin, UEBUNGEN, Stossprotokoll, werteStossAus, werteTrainingAus, erlaubteZiele, spieltAufAcht, FOUL_TEXTE, Computer, COMPUTER_STUFEN };';
  vm.runInContext(code, ctx, { filename: 'hafenbillard-logik.js' });
  return ctx.__;
};
