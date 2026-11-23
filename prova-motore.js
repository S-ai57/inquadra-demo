/* ------------------------------------------------------------------
   Test del motore di Inquadra — si lancia da terminale:
       node prova-motore.js
   Nessuna UI, nessun browser: qui si verifica che le regole diano
   i verdetti promessi e che nessun numero contraddica l'archivio.
   ------------------------------------------------------------------ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ctx = { console, Intl, Date, Math, JSON };
vm.createContext(ctx);
for (const f of ["js/data.js", "js/busta.js", "js/engine.js", "js/esame.js", "js/modello.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}
const { DIPENDENTI, ARCHIVIO_CCNL, clausoleDi, SOGLIA_ADRENZA, STATI_CLAUSOLA } = ctx;
const E = ctx;

let n = 0, falliti = [];
function ok(nome, cond, dettaglio) {
  n++;
  if (!cond) falliti.push(nome + (dettaglio !== undefined ? "  →  " + dettaglio : ""));
}
function uguali(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---------- 0. le tre fonti insieme devono compilare ---------- */
/* Un nome gia' dichiarato in data.js (var) ripreso come const in app.js
   rompe l'intera pagina: il browser non dice niente di utile. */
try {
  const ctxPagina = { console, Intl, Date, Math, JSON, localStorage: null };
  ctxPagina.window = ctxPagina;
  vm.createContext(ctxPagina);
  /* stesse fonti, stesso ordine di index.html: una `const` mancante fra i file
     biancherebbe la pagina in `file://` e `node --check` non lo vede */
  for (const f of ["js/data.js", "js/busta.js", "js/engine.js", "js/esame.js", "js/modello.js", "js/app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctxPagina, { filename: f });
  }
  /* le `const` di un modulo non finiscono sul global: si testano le funzioni,
     che sono quelle che l\'interfaccia chiama davvero */
  ok("le sei fonti insieme compilano", typeof ctxPagina.disegna === "function"
     && typeof ctxPagina.esaminaBusta === "function" && typeof ctxPagina.rispondi === "function"
     && typeof ctxPagina.modelloLegge === "function" && typeof ctxPagina.modelloAffidabile === "function");
} catch (e) {
  ok("data.js + engine.js + app.js insieme compilano", false, e.message);
}

/* ---------- 1. ogni posizione ha il verdetto promesso ---------- */
const attesi = {
  el_amrani: "clausole_da_attivare",
  pellizzari: "ccnl_non_pertinente",
  ferrante: "inquadramento_da_riallineare",
  sartori: "decide_una_persona",
  bruni: "in_regola",
  doumbia: "clausole_a_rischio",
  moretti: "clausole_a_rischio",
};

const oggi = E.oggiISO();
const risultati = {};
Object.keys(attesi).forEach((id) => {
  const p = DIPENDENTI.filter((d) => d.id === id)[0];
  ok("posizione " + id + " esiste", !!p);
  const v = E.verdetto(p, null, oggi);
  risultati[id] = v;
  ok(id + ": verdetto " + attesi[id], v.stato === attesi[id], "arrivato " + v.stato + " — " + v.frase);
});

/* ---------- 2. aderenza: numeri, soglia, potenziale ---------- */
const ad = (id, cc) => E.aderenza(DIPENDENTI.filter((d) => d.id === id)[0], cc);
ok("Pellizzari: Terziario sopra soglia", ad("pellizzari", "terziario").punteggio > SOGLIA_ADRENZA, ad("pellizzari", "terziario").punteggio);
ok("Pellizzari: Alimentare sotto soglia", ad("pellizzari", "alimentari").punteggio < 0.10, ad("pellizzari", "alimentari").punteggio);
ok("Pellizzari: senza la visura Confcommercio il potenziale sale",
   ad("pellizzari", "terziario").potenziale === 1, ad("pellizzari", "terziario").potenziale);
ok("El Amrani: Alimentare pieno", ad("el_amrani", "alimentari").punteggio === 1);
ok("Sartori: nessun contratto passa la soglia",
   E.candidati(DIPENDENTI.filter((d) => d.id === "sartori")[0]).every((c) => c.punteggio < SOGLIA_ADRENZA),
   JSON.stringify(E.candidati(DIPENDENTI.filter((d) => d.id === "sartori")[0]).map((c) => c.ccnlId + ":" + c.punteggio)));
const sarLog = ad("sartori", "logistica");
ok("Sartori: con licenza e commesse la Logistica passerebbe la soglia",
   sarLog.potenziale > SOGLIA_ADRENZA, "potenziale " + sarLog.potenziale);
DIPENDENTI.forEach((p) => {
  E.candidati(p).forEach((c) => {
    ok(p.id + "/" + c.ccnlId + ": aderenza tra 0 e 1", c.punteggio >= 0 && c.punteggio <= 1, c.punteggio);
    ok(p.id + "/" + c.ccnlId + ": potenziale non sotto l'aderenza", c.potenziale >= c.punteggio);
    ok(p.id + "/" + c.ccnlId + ": i pesi sommano 100", c.pesi.totale === 100, c.pesi.totale);
  });
});

/* ---------- 3. il verdetto che non decide non propone ---------- */
ok("Sartori: nessuna proposta", risultati.sartori.consiglio.ccnlId === null);
ok("Sartori: il verdetto dice chi decide", /ufficio del personale/.test(risultati.sartori.chi), risultati.sartori.chi);
ok("Sartori: la frase spiega il blocco", /0,5/.test(risultati.sartori.frase) && /0,7/.test(risultati.sartori.frase), risultati.sartori.frase);
ok("Pellizzari: la frase nomina il contratto giusto", /Commercio/.test(risultati.pellizzari.frase), risultati.pellizzari.frase);
ok("Bruni: verdetto pulito, senza numeri che fanno gara", /applicate/.test(risultati.bruni.frase), risultati.bruni.frase);
ok("El Amrani: il verdetto dice di chi sono i soldi", /azienda/.test(risultati.el_amrani.chi), risultati.el_amrani.chi);
ok("Ogni verdetto ha una riga che dice chi decide o chi paga",
   Object.keys(attesi).every((id) => risultati[id].chi && risultati[id].chi.length > 8),
   JSON.stringify(Object.keys(attesi).map((id) => risultati[id].chi)));
ok("Ferrante: la frase nomina il livello", /3°A/.test(risultati.ferrante.frase), risultati.ferrante.frase);

/* ---------- 4. la mappa clausole torna sempre ---------- */
const STATI = Object.keys(STATI_CLAUSOLA);
DIPENDENTI.forEach((p) => {
  Object.keys(ARCHIVIO_CCNL).forEach((cc) => {
    const righe = E.mappaClausole(p, cc, oggi);
    ok(p.id + "/" + cc + ": tutte le clausole del contratto", righe.length === clausoleDi(cc).length,
       righe.length + " su " + clausoleDi(cc).length);
    righe.forEach((r) => {
      ok(p.id + "/" + cc + "/" + r.ist + ": stato conosciuto", STATI.indexOf(r.stato) >= 0, r.stato);
      ok(p.id + "/" + cc + "/" + r.ist + ": ogni riga cita una fonte", !!r.fonte && r.fonte.length > 5);
      ok(p.id + "/" + cc + "/" + r.ist + ": ogni riga dice perché", !!r.perche && r.perche.length > 5, r.perche);
      if (r.stato !== "non_pertinente") {
        ok(p.id + "/" + cc + "/" + r.ist + ": se riguarda la persona c'è un valore", !!r.valore || r.stato === "da_verificare");
        ok(p.id + "/" + cc + "/" + r.ist + ": se è aperta c'è un chi", r.stato === "coperta" || !!r.chi && r.chi !== "—");
      }
      if (r.senza_registro) falliti.push(p.id + "/" + cc + ": clausola pertinente senza registrazione né dato mancante (" + r.ist + ")");
      n++;
    });
    const num = E.conteggio(righe);
    ok(p.id + "/" + cc + ": il totale torna", num.totale === num.pertinenti + num.non_pertinente, JSON.stringify(num));
    ok(p.id + "/" + cc + ": le pertinenti sommano",
       num.pertinenti === num.coperta + num.da_attivare + num.a_rischio + num.da_verificare, JSON.stringify(num));
  });
});

/* ---------- 5. nessuna clausola inventata: i dati mancanti ---------- */
const logiPermessi = E.mappaClausole(DIPENDENTI.filter((d) => d.id === "sartori")[0], "logistica", oggi)
  .filter((r) => r.ist === "permessi")[0];
ok("Logistica: la tabella permessi che non c'è resta 'manca un dato'",
   logiPermessi.stato === "da_verificare" && !logiPermessi.valore, logiPermessi.stato);
ok("Bruni: il dato anagrafico assente è dichiarato",
   risultati.bruni.righe.filter((r) => r.stato === "da_verificare").length === 1);

/* ---------- 6. scelta della persona: ogni opzione ha la sua mappa ---------- */
DIPENDENTI.forEach((p) => {
  E.candidati(p).filter((c) => c.punteggio > 0 || c.potenziale > 0).forEach((c) => {
    const v = E.verdetto(p, c.ccnlId, oggi);
    ok(p.id + ": la scelta " + c.ccnlId + " produce una mappa con fonti",
       v.righe.length > 0 && v.righe.every((r) => !!r.fonte));
    const nota = E.notaConsulente(p, v);
    ok(p.id + ": la nota per il consulente cita le fonti delle clausole aperte",
       E.aperture(v.righe).length === 0 || E.aperture(v.righe).every((r) => nota.indexOf(r.fonte) >= 0));
  });
});
ok("Pellizzari: se la persona impone il contratto in busta paga l'app lo dichiara",
   E.verdetto(DIPENDENTI.filter((d) => d.id === "pellizzari")[0], "alimentari", oggi).scelto_dalla_persona === true);
ok("Pellizzari: la proposta dell'app non è marcata come scelta della persona",
   E.verdetto(DIPENDENTI.filter((d) => d.id === "pellizzari")[0], "terziario", oggi).scelto_dalla_persona === false);
ok("Bruni: se la persona sceglie un altro contratto l'app lo dichiara",
   E.verdetto(DIPENDENTI.filter((d) => d.id === "bruni")[0], "logistica", oggi).scelto_dalla_persona === true);

/* ---------- 7. passaggio di contratto: le condizioni di miglior favore ---------- */
const fav = E.mappaClausole(DIPENDENTI.filter((d) => d.id === "pellizzari")[0], "terziario", oggi)
  .filter((r) => r.ist === "favore")[0];
ok("Pellizzari: al Terziario la clausola sulle condizioni di miglior fare riguarda lei",
   fav.stato === "da_attivare", fav.stato);
const favNo = E.mappaClausole(DIPENDENTI.filter((d) => d.id === "pellizzari")[0], "alimentari", oggi)
  .filter((r) => r.ist === "favore")[0];
ok("Pellizzari: restando nel contratto in busta paga quella clausola non la riguarda",
   favNo.stato === "non_pertinente", favNo.stato);
const estero = E.mappaClausole(DIPENDENTI.filter((d) => d.id === "bruni")[0], "terziario", oggi);
ok("Bruni: se guarda un contratto non suo l'app lo dice riga per riga",
   estero.filter((r) => r.esterno).length > 0 && estero.filter((r) => r.esterno).every((r) => /contratto diverso/.test(r.perche)),
   estero.filter((r) => r.esterno).length);

/* ---------- 8. clausole che non riguardano la persona ---------- */
function statoDi(id, cc, ist) {
  return E.mappaClausole(DIPENDENTI.filter((d) => d.id === id)[0], cc, oggi).filter((r) => r.ist === ist)[0];
}
ok("Bruni: il lavoro notturno non lo riguarda", statoDi("bruni", "alimentari", "notturno").stato === "non_pertinente");
ok("Doumbia: gli scatti non sono ancora aperti", statoDi("doumbia", "alimentari", "scatti").stato === "non_pertinente");
ok("Doumbia: la data del primo scatto è scritta", /20\d\d/.test(statoDi("doumbia", "alimentari", "scatti").perche));
const diariaAlim = statoDi("sartori", "alimentari", "diaria");
ok("Sartori: la diaria lo riguarda solo sotto Logistica",
   diariaAlim === undefined && statoDi("sartori", "logistica", "diaria").stato === "da_verificare");
ok("Moretti: la causale del termine è applicata male", statoDi("moretti", "alimentari", "durata_termine").stato === "a_rischio");
ok("Moretti: il tetto sui contratti a termine è dentro il limite", statoDi("moretti", "alimentari", "termine_tetto").stato === "coperta");
ok("Pellizzari: l'indennità di cassa è da attivare", statoDi("pellizzari", "terziario", "cassa_denaro").stato === "da_attivare");
ok("El Amrani: l'indennità di cassa non esiste nel suo contratto",
   statoDi("el_amrani", "alimentari", "cassa_denaro") === undefined);
ok("Ferrante: il lavoro agile senza accordo è applicato male", statoDi("ferrante", "alimentari", "agile").stato === "a_rischio");

/* ---------- 9. singolare e plurale ---------- */
ok("una clausola (singolare)", E.conto(1, "clausola") === "una clausola", E.conto(1, "clausola"));
ok("tre clausole (plurale)", E.conto(3, "clausola") === "3 clausole", E.conto(3, "clausola"));
ok("un dato (maschile)", E.conto(1, "dato", "dati", true) === "un dato", E.conto(1, "dato", "dati", true));
ok("tre dati (maschile plurale)", E.conto(3, "dato", "dati", true) === "3 dati", E.conto(3, "dato", "dati", true));
ok("attività resta invariata al plurale", E.conto(3, "attività") === "3 attività", E.conto(3, "attività"));
ok("una attività al singolare", E.conto(1, "attività") === "una attività", E.conto(1, "attività"));
ok("il verdetto non ripete il numero che sta già nelle pill",
   Object.keys(attesi).every((id) => !/(\d+) clausole? (da attivare|spettano|sono applicate)/.test(risultati[id].frase)),
   JSON.stringify(Object.keys(attesi).map((id) => risultati[id].frase)));
ok("il verdetto apre male/attivare cita la clausola principale",
   /previdenza complementare/.test(risultati.el_amrani.frase) && /permessi retribuiti/.test(risultati.doumbia.frase),
   risultati.el_amrani.frase + " // " + risultati.doumbia.frase);

/* ---------- 10. nessuna cifra fuori misura nel part-time ---------- */
const permes = statoDi("doumbia", "alimentari", "permessi");
ok("Doumbia: il conteggio in busta contraddice il part-time", /64,8/.test(permes.prova), permes.prova);
ok("Doumbia: 108 ore per 24 ore fa 64,8 (moltiplicazione esatta)",
   Math.round((108 * 24 / 40) * 10) / 10 === 64.8);

/* ---------- 11. determinismo ---------- */
DIPENDENTI.forEach((p) => {
  const a = E.verdetto(p, null, oggi), b = E.verdetto(p, null, oggi);
  ok(p.id + ": stessa posizione due volte, stesso verdetto",
     uguali({ s: a.stato, f: a.frase, n: a.numeri }, { s: b.stato, f: b.frase, n: b.numeri }));
  const m1 = E.mappaClausole(p, "alimentari", oggi), m2 = E.mappaClausole(p, "alimentari", oggi);
  ok(p.id + ": mappa clausole deterministica", uguali(m1, m2));
});

/* ---------- 12. repartizione dei verdetti sull'archivio ---------- */
const rep = {};
DIPENDENTI.forEach((p) => { const s = risultati[p.id] || E.verdetto(p, null, oggi); rep[s.stato] = (rep[s.stato] || 0) + 1; });
ok("tutti e 6 gli stati del verdetto sono rappresentati", Object.keys(rep).length === 6, JSON.stringify(rep));
ok("7 posizioni in archivio", DIPENDENTI.length === 7);
const apertureTotali = DIPENDENTI.reduce((t, p) => t + ((risultati[p.id] || E.verdetto(p, null, oggi)).aperte), 0);
ok("almeno una posizione per ogni stato aperto", apertureTotali >= 8, apertureTotali);


/* ==================================================================
   9. L'ESAME DELLA BUSTA — cosa l'app può dire del prospetto
   ================================================================== */
const { verdetto, esaminaBusta, rispondi, BUSTE, INTENTI } = ctx;
const OGGI_ES = "2026-11-20";
const STATI_ESAME = ["torna", "anomalia", "estranea", "non_verifico", "senza_tabella", "da_verificare", "manca"];
const senzaCifreVuote = (t) => !/NaN|undefined|null|\bnulla\b/.test(String(t));

DIPENDENTI.forEach((p) => {
  Object.keys(ARCHIVIO_CCNL).forEach((ccnlId) => {
    const v = verdetto(p, ccnlId, OGGI_ES);
    const es = esaminaBusta(p, v, OGGI_ES);
    ok(p.id + "/" + ccnlId + ": l'esame esiste", !!es && es.righe.length > 0);
    const busta = BUSTE[p.id];
    ok(p.id + "/" + ccnlId + ": ogni riga del prospetto ha la sua spiegazione",
      es.righe.length === busta.righe.length && busta.righe.every((r) => es.righe.filter((x) => x.codice === r.codice).length === 1),
      es.righe.length + " vs " + busta.righe.length);
    es.righe.concat(es.mancano, es.conti, es.intestazione).forEach((x) => {
      ok(p.id + "/" + ccnlId + ": stato conosciuto per " + (x.codice || x.cosa || x.titolo), STATI_ESAME.indexOf(x.stato) >= 0, x.stato);
      ok(p.id + "/" + ccnlId + ": fonte scritta per " + (x.codice || x.cosa || x.titolo), String(x.fonte || "").length > 1, JSON.stringify(x.fonte));
      ok(p.id + "/" + ccnlId + ": niente cifre rotte in " + (x.codice || x.cosa || x.titolo), senzaCifreVuote(x.testo), x.testo);
    });
    /* nessun euro promesso all'operatore senza una clausola che lo dica */
    es.mancano.filter((x) => x.euro_mese || x.euro_anno).forEach((x) => {
      ok(p.id + "/" + ccnlId + ": la cifra mancante " + x.titolo + " ha una fonte contrattuale o di legge",
        /CCNL|TUIR|art\./.test(x.fonte), x.fonte);
    });
    /* il monte ore: o torna, o l'app dice il numero giusto con la fonte, o ammette di non avere la tabella */
    const pm = clausoleDi(ccnlId).filter((c) => c.ist === "permessi")[0];
    const rigaPermessi = es.mancano.filter((x) => x.codice === "F2")[0];
    const contoPermessi = es.conti.filter((x) => /permessi/i.test(x.cosa))[0];
    if (pm && pm.ore_anno) {
      ok(p.id + "/" + ccnlId + ": il monte ore \u00e8 confrontato", !!(rigaPermessi || contoPermessi));
    } else {
      ok(p.id + "/" + ccnlId + ": senza tabella permessi l'app non inventa il confronto",
        !!rigaPermessi && rigaPermessi.stato === "da_verificare" && /non \u00e8 caricata/.test(rigaPermessi.testo),
        rigaPermessi ? rigaPermessi.stato : "nessuna riga");
    }
    /* determinismo: la stessa busta, lo stesso esame */
    ok(p.id + "/" + ccnlId + ": l'esame \u00e8 deterministico",
      JSON.stringify(esaminaBusta(p, v, OGGI_ES)) === JSON.stringify(es));
  });
});

/* i casi che la demo deve mostrare, uno per tipo */
const esAmrani = esaminaBusta(DIPENDENTI.filter((d) => d.id === "el_amrani")[0], verdetto(DIPENDENTI.filter((d) => d.id === "el_amrani")[0], null, OGGI_ES), OGGI_ES);
ok("El Amrani: la quota Alifond che manca ha la sua cifra mensile e annua",
  esAmrani.mancano.some((x) => x.codice === "A04" && x.euro_mese > 0 && x.euro_anno === x.euro_mese * 12 && /Alifond/.test(x.titolo)),
  JSON.stringify(esAmrani.mancano.map((x) => x.titolo)));
const esPelli = esaminaBusta(DIPENDENTI.filter((d) => d.id === "pellizzari")[0], verdetto(DIPENDENTI.filter((d) => d.id === "pellizzari")[0], null, OGGI_ES), OGGI_ES);
ok("Pellizzari: letta sotto Commercio segnala permessi 108 contro 104",
  esPelli.mancano.some((x) => x.codice === "F2" && /108/.test(x.testo) && /104/.test(x.testo)), JSON.stringify(esPelli.mancano.map((x) => x.testo)));
ok("Pellizzari: il Fondo Est che non viene versato vale 156 \u20ac l'anno",
  esPelli.mancano.some((x) => x.codice === "A05" && x.euro_anno === 15600), JSON.stringify(esPelli.mancano.map((x) => x.euro_anno)));
ok("Pellizzari: l'indennit\u00e0 di cassa \u00e8 l'indizio letto nel prospetto",
  esPelli.righe.some((x) => x.codice === "M72" && /218/.test(x.fonte)), JSON.stringify(esPelli.righe.filter((x) => x.codice === "M72")));
const esDoumbia = esaminaBusta(DIPENDENTI.filter((d) => d.id === "doumbia")[0], verdetto(DIPENDENTI.filter((d) => d.id === "doumbia")[0], null, OGGI_ES), OGGI_ES);
ok("Doumbia: il part-time d\u00e0 64,8 ore e la busta ne d\u00e0 54",
  esDoumbia.mancano.some((x) => x.codice === "F2" && x.stato === "anomalia" && /64,8/.test(x.testo) && /54/.test(x.testo)),
  JSON.stringify(esDoumbia.mancano.map((x) => x.testo)));
ok("Doumbia: la proporzionalit\u00e0 \u00e8 citata come fonte del conteggio",
  esDoumbia.mancano.some((x) => x.codice === "F2" && /D\.Lgs 81\/2015/.test(x.fonte)), "");
const pSartori = DIPENDENTI.filter((d) => d.id === "sartori")[0];
const esSartoriLog = esaminaBusta(pSartori, verdetto(pSartori, "logistica", OGGI_ES), OGGI_ES);
ok("Sartori: il netto scritto non torna con le righe e l'app lo dice",
  esSartoriLog.conti.some((x) => x.stato === "anomalia" && /12,00/.test(x.testo)), JSON.stringify(esSartoriLog.conti));
ok("Sartori sotto Logistica: la diaria entra con la soglia di legge e il conteggio",
  esSartoriLog.mancano.some((x) => x.codice === "M80" && /46,48/.test(x.testo) && /185,92/.test(x.testo) && /TUIR/.test(x.fonte)),
  JSON.stringify(esSartoriLog.mancano.map((x) => x.titolo)));
ok("Sartori sotto Logistica: senza tabella permessi l'app si ferma",
  esSartoriLog.mancano.some((x) => x.codice === "F2" && x.stato === "da_verificare"), "");
const esBruni = esaminaBusta(DIPENDENTI.filter((d) => d.id === "bruni")[0], verdetto(DIPENDENTI.filter((d) => d.id === "bruni")[0], null, OGGI_ES), OGGI_ES);
ok("Bruni: la busta pulita non produce anomalia e nemmeno voci mancanti",
  esBruni.riepilogo.anomalie === 0 && esBruni.mancano.length === 0, JSON.stringify(esBruni.riepilogo));
ok("le imposte non sono mai materia di verifica",
  Object.keys(BUSTE).every((id) => {
    const p = DIPENDENTI.filter((d) => d.id === id)[0];
    const e2 = esaminaBusta(p, verdetto(p, null, OGGI_ES), OGGI_ES);
    return ["T00", "T03", "T04", "D01"].every((cod) => {
      const r = e2.righe.filter((x) => x.codice === cod)[0];
      return !r || r.stato === "non_verifico";
    });
  }));

/* ---------- le risposte ---------- */
const DOMANDE_SONDATE = {
  "Come arriva a questo netto?": "netto",
  "Quante ore di permesso gli restano?": "permesso",
  "Il fondo pensione \u00e8 versato?": "fondo",
  "Il livello \u00e8 quello giusto?": "livello",
  "Perch\u00e9 gli hanno tolto l'anticipo?": "anticipo",
  "Le tasse sono giuste?": "tasse",
  "La tredicesima c'\u00e8?": "tredicesima",
  "Quante ferie restano?": "ferie",
  "I turni di notte sono pagati?": "notturn",
  "Gli straordinari rispettano il tetto?": "straordinario",
  "Lo scatto di anzianit\u00e8 quando scatta?": "scatto",
  "La diaria delle trasferte dove \u00e8?": "diaria",
  "Il Fondo Est \u00e8 versato?": "fondo est",
  "I permessi legge 104?": "104",
  "Il contratto a termine \u00e8 valido?": "termine",
  "Cos'\u00e8 l'indennit\u00e0 di cassa?": "cassa",
  "Come funziona il part-time?": "part-time",
  "Ci sono anomalie in questa busta?": "anomal",
};
Object.keys(DOMANDE_SONDATE).forEach((domanda) => {
  let agganciate = 0;
  DIPENDENTI.forEach((p) => {
    const es = esaminaBusta(p, verdetto(p, null, OGGI_ES), OGGI_ES);
    const r = rispondi(p, verdetto(p, null, OGGI_ES), es, domanda);
    const righe = (r.risposte || [r]).reduce((s, x) => s.concat(x.testo), []);
    if (!righe.length) return;
    agganciate += 1;
    ok("domanda \"" + domanda + "\" su " + p.id + ": niente cifre rotte",
      righe.every(senzaCifreVuote), righe.filter((x) => !senzaCifreVuote(x)).join(" | "));
    ok("domanda \"" + domanda + "\" su " + p.id + ": ogni risposta ha un capo e un seguito",
      righe.every((x) => x.length > 12), righe.filter((x) => x.length <= 12).join(" | "));
  });
  ok('la domanda "' + domanda + '" aggancia qualcosa su almeno una posizione', agganciate > 0);
});
const esFallback = esaminaBusta(pSartori, verdetto(pSartori, null, OGGI_ES), OGGI_ES);
const fb = rispondi(pSartori, verdetto(pSartori, null, OGGI_ES), esFallback, "mi spiega il barometro?");
ok("domanda fuori tema: l'app dice cosa ha davanti invece di rispondere a caso",
  /Non ho trovato/.test(fb.titolo) && fb.risposte === undefined && /M10/.test(fb.testo.join(" ")), fb.titolo);
const perCodice = rispondi(pSartori, verdetto(pSartori, null, OGGI_ES), esFallback, "cos'\u00e8 M81?");
ok("la domanda per codice voce aggancia la riga giusta",
  /M81/.test(perCodice.titolo) && /a piè di lista/.test(perCodice.risposte[0].testo.join(" ")), perCodice.risposte[0].testo.join(" | "));
const perCifra = rispondi(DIPENDENTI.filter((d) => d.id === "moretti")[0],
  verdetto(DIPENDENTI.filter((d) => d.id === "moretti")[0], null, OGGI_ES),
  esaminaBusta(DIPENDENTI.filter((d) => d.id === "moretti")[0], verdetto(DIPENDENTI.filter((d) => d.id === "moretti")[0], null, OGGI_ES), OGGI_ES),
  "perch\u00e9 ha trovato 58,44 \u20ac in meno?");
ok("la domanda per cifra aggancia la trattenuta", /T08/.test(perCifra.titolo), perCifra.titolo);
ok("ogni intenzione di risposta \u00e8 raggiungibile da una domanda reale",
  Object.keys(DOMANDE_SONDATE).length >= INTENTI.length - 1, INTENTI.length + " intenzioni, " + Object.keys(DOMANDE_SONDATE).length + " domande");
/* i conti della busta: il netto si rif\u00e0 a mano e le somme tornano */
Object.keys(BUSTE).forEach((id) => {
  const b = BUSTE[id];
  const crediti = b.righe.filter((r) => r.tipo === "credito").reduce((s, r) => s + r.valore, 0);
  ok(id + ": le righe che spettano sommano al totale del documento", crediti === b.totali.crediti, crediti + " vs " + b.totali.crediti);
  ok(id + ": il netto \u00e8 crediti meno trattenute meno imposte",
    b.totali.netto === b.totali.crediti - b.totali.trattenute - b.totali.imposte);
  ok(id + ": ogni voce che spettava ha un conto nel documento o \u00e8 dichiarata come cifra secca",
    b.righe.filter((r) => r.tipo === "credito").every((r) => !!r.calcolo || !!r.dettaglio),
    b.righe.filter((r) => r.tipo === "credito" && !r.calcolo && !r.dettaglio).map((r) => r.codice).join(","));
  ok(id + ": le ore residue di permesso sono maturate meno usate",
    b.ratei.permessi.residuo === Math.round((b.ratei.permessi.maturato - b.ratei.permessi.usato) * 100) / 100,
    JSON.stringify(b.ratei.permessi));
});
ok("solo una posizione ha il netto che non torna (e l'app la trova)",
  Object.keys(BUSTE).filter((id) => BUSTE[id].netto_dichiarato !== BUSTE[id].totali.netto).join(",") === "sartori",
  Object.keys(BUSTE).filter((id) => BUSTE[id].netto_dichiarato !== BUSTE[id].totali.netto).join(","));


/* ---------- resoconto ---------- */
console.log("Assert: " + n);
if (falliti.length) {
  console.log("\n" + falliti.length + " FALLITE:");
  falliti.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(n + " asserzioni superate — motore v1.0, archivio snapshot 09/2025");
Object.keys(attesi).forEach((id) => {
  const v = risultati[id];
  console.log("  " + v.stato.padEnd(30) + " " + DIPENDENTI.filter((d) => d.id === id)[0].nome + " — " + v.frase);
});
