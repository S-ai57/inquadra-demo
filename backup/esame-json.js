// stampa l'esame di una persona in JSON, per provarci il modello vero
const fs = require("fs"), vm = require("vm"), path = require("path");
const dir = path.join(__dirname, "..");
const ctx = { console, Date, Math, JSON, Intl };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
ctx.document = undefined;
vm.createContext(ctx);
for (const f of ["js/data.js", "js/busta.js", "js/engine.js", "js/esame.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
}
const id = process.argv[2] || "pellizzari";
const lettura = process.argv[3] || null;
const p = ctx.DIPENDENTI.filter((d) => d.id === id)[0];
const v = ctx.verdetto(p, lettura);
const es = ctx.esaminaBusta(p, v);
es.persona = { nome: p.nome, ruolo: p.ruolo, livello: p.livello, mansioni: p.mansioni };
process.stdout.write(JSON.stringify(es));
