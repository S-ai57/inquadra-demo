const fs = require("fs"), vm = require("vm");
const c = {}; vm.createContext(c);
for (const f of ["js/data.js", "js/busta.js", "js/engine.js", "js/esame.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), c, { filename: f });
const persona = process.argv[2] || "sartori";
let scelta = process.argv[3] || null;
const p = c.DIPENDENTI.filter(d => d.id === persona)[0];
const v = c.verdetto(p, scelta, "2026-11-20");
const es = c.esaminaBusta(p, v, "2026-11-20");
console.log("lettura " + es.lettura + " · " + JSON.stringify(es.riepilogo));
console.log("\n-- CONTI --");
es.conti.forEach(r => console.log(" [" + r.stato + "] " + r.cosa + ": " + r.testo));
console.log("\n-- MANCANO / DA VERIFICARE --");
es.mancano.forEach(r => console.log(" [" + r.stato + "] " + r.titolo + ": " + r.testo + "  <<" + r.fonte));
console.log("\n-- CAMBIA --");
es.cambio.forEach(r => console.log(" ~ " + r.cosa + ": " + r.testo));
console.log("\n-- DOMANDE --");
["Come arriva a questo netto?", "Quante ore di permesso gli restano?", "Il fondo pensione è versato?",
 "Il livello è quello giusto?", "Perché gli hanno tolto 58,44 €?", "la diaria", "ci sono anomalie?", "mi spiega il barometro?"]
  .forEach(q => {
    const r = c.rispondi(p, v, es, q);
    console.log("\n D: " + q + "\n R: " + r.titolo);
    const lista = r.risposte ? r.risposte : [r];
    lista.forEach(x => x.testo.forEach(t => console.log("    · " + t)));
  });
