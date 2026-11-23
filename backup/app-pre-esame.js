/* ------------------------------------------------------------------
   Interfaccia di Inquadra: coda delle posizioni, anagrafica del
   contratto, verdetto con la mappa di tutte le clausole, nota per il
   consulente. Vanilla JS, nessuna dipendenza, nessuna build.
   ------------------------------------------------------------------ */

const statoApp = {
  vista: "elenco",
  personaId: null,
  lavorazione: null,   /* non vuoto mentre la verifica gira */
  verdetto: null,
  scelta: null,        /* contratto scelto da chi guarda (null = quello dell'app) */
  nota: null,
  errore: null,
};

/* --- parametri della demo (scorciatoie sole per le prove) --------- */
const QUERY = (typeof location !== "undefined" && location.search) || "";
const NOAI = /(^|[?&])noai=1/.test(QUERY);
const AUTO = /(^|[?&])auto=1/.test(QUERY);
const NOTOUR = /(^|[?&])notour=1/.test(QUERY);
/* la passata simulata: 40 secondi, accorciati solo con ?noai=1 per le prove */
const DURATA_VERIFICA = NOAI ? 1200 : AI_MS;

/* ---------- utilità ------------------------------------------------ */
function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function $(id) { return document.getElementById(id); }

const TRACCIATI_ICONA = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-check": '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  minus: '<path d="M5 12h14"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  refresh: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594 1.594z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "pen-line": '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
};
function icona(nome) {
  const t = TRACCIATI_ICONA[nome];
  if (!t) return "";
  return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t + "</svg>";
}
function badgeStato(statoClausola) {
  const s = STATI_CLAUSOLA[statoClausola];
  if (!s) return "";
  return '<span class="badge ' + esc(statoClausola) + '">' + icona(s.icona) + esc(s.parola) + "</span>";
}

/* ---------- cosa resta in memoria su questo browser ---------------- */
const Store = {
  chiave: "fontanella.inquadra.v1",
  leggi() {
    try { return JSON.parse(localStorage.getItem(this.chiave)) || { fatti: {}, tour: false }; }
    catch (e) { return this._mem || { fatti: {}, tour: false }; }
  },
  scrivi(d) {
    this._mem = d;
    try { localStorage.setItem(this.chiave, JSON.stringify(d)); } catch (e) { /* continua in memoria */ }
  },
  verifica(id, esito) {
    const d = this.leggi();
    d.fatti[id] = { stato: esito.stato, scelta: esito.scelta, ts: Date.now() };
    this.scrivi(d);
  },
  fatto(id) { return this.leggi().fatti[id] || null; },
  tourVisto() { return !!this.leggi().tour; },
  tourFatto() { const d = this.leggi(); d.tour = true; this.scrivi(d); },
  azzera() { try { localStorage.removeItem(this.chiave); } catch (e) { this._mem = null; } },
};

/* ---------- testata ------------------------------------------------ */
function testataHTML() {
  return '<header class="testata"><div class="testata-interna">'
    + '<img class="logo" src="assets/logos/horizontal-gradient.png" alt="Galene.AI">'
    + '<div class="testata-titoli"><span class="app-nome">' + esc(APP.nome) + '</span>'
    + '<span class="ente">' + esc(AZIENDA.ragione) + " · " + esc(AZENDA_UFFICIO) + "</span></div>"
    + '<span class="spacer"></span>'
    + '<button class="link-pulito" id="riapri-guida">riapri la guida</button>'
    + "</div></header>";
}
const AZENDA_UFFICIO = APP.ufficio;

/* ============================================================
   VISTA 1 — la coda delle posizioni
   ============================================================ */
function vistaElenco() {
  const coda = DIPENDENTI.length;
  const righe = DIPENDENTI.map((p) => {
    const f = Store.fatto(p.id);
    const destra = f
      ? badgeVerdetto(f.stato) + '<button class="apri" data-apri="' + esc(p.id) + '">Apri di nuovo ›</button>'
      : '<button class="apri" data-apri="' + esc(p.id) + '">Apri la verifica ›</button>';
    return '<li class="riga">'
      + '<div class="riga-corpo">'
      + '<div class="riga-nome">' + esc(p.nome) + "</div>"
      + '<div class="riga-ruolo">' + esc(p.ruolo) + "</div>"
      + '<p class="riga-nota">' + esc(notaCoda(p, f)) + "</p>"
      + '<span class="riga-contratto">' + icona("briefcase") + "in busta paga: " + esc(nomeContratto(p.ccnl_in_busta)) + "</span>"
      + "</div>" + destra + "</li>";
  }).join("");

  return '<section class="intro"><h1>' + esc(APP.sottotitolo) + "</h1>"
    + "<p>" + esc(AZIENDA.ragione) + " ha " + conto(AZIENDA.unita.length, "attività") + " ("
    + esc(AZIENDA.unita.map(unitaCorta).join(", ")) + ") e un solo contratto applicato a tutti. "
    + "Questa è la coda del controllo che l'ufficio del personale fa sulle posizioni, una per una.</p></section>"
    + '<div class="elenco-cabeza"><div><span class="cifra-occhio">' + coda + "</span>"
    + "<span>posizioni in coda: ognuna apre la sua mappa di clausole, con la fonte di ogni riga.</span></div></div>"
    + '<ul class="elenco">' + righe + "</ul>"
    + valutatoreHTML();
}
function nomeContratto(id) { return ARCHIVIO_CCNL[id].nome_corto; }
/* le tre unità chiamate con la parola che usano in azienda */
const UNITA_CORTE = { stab: "stabilimento", spaccio: "spaccio", dep: "consegne" };
function unitaCorta(u) { return UNITA_CORTE[u.id] || u.nome; }

/* una riga sola, e dice cosa non sa ancora l'app */
function notaCoda(p, fatto) {
  if (!fatto) return "Da verificare: " + p.mansioni.charAt(0).toLowerCase() + p.mansioni.slice(1);
  return VERDETTI_PAROLA[fatto.stato] + " · verificata in questa sessione";
}

const VERDETTI_PAROLA = {
  ccnl_non_pertinente: "contratto da cambiare",
  inquadramento_da_riallineare: "livello da riallineare",
  clausole_a_rischio: "clausole applicate male",
  clausole_da_attivare: "clausole da attivare",
  decide_una_persona: "decide una persona",
  in_regola: "tutto a posto",
};
const VERDETTI_TONO = {
  ccnl_non_pertinente: "a_rischio",
  inquadramento_da_riallineare: "da_attivare",
  clausole_a_rischio: "a_rischio",
  clausole_da_attivare: "da_attivare",
  decide_una_persona: "da_verificare",
  in_regola: "coperta",
};
function badgeVerdetto(statoVerdetto) {
  return '<span class="badge ' + esc(VERDETTI_TONO[statoVerdetto]) + '">'
    + icona(STATI_CLAUSOLA[VERDETTI_TONO[statoVerdetto]].icona) + esc(VERDETTI_PAROLA[statoVerdetto]) + "</span>";
}

/* ============================================================
   VISTA 2 — la posizione
   ============================================================ */
function personaCorrente() {
  return DIPENDENTI.filter((d) => d.id === statoApp.personaId)[0] || DIPENDENTI[0];
}

function vistaPersona() {
  const p = personaCorrente();
  const anz = anzianita(p.dal);
  const unita = AZIENDA.unita.filter((u) => u.id === p.unita)[0];

  let corpo = "";
  if (statoApp.lavorazione) corpo = lavorazioneHTML();
  else if (statoApp.verdetto) corpo = verdettoHTML(p) + candidatiHTML(p) + mappaHTML(p) + notaBloccoHTML(p) + valutatoreHTML();
  else corpo = ctaHTML();

  return '<div class="torna"><button class="link-pulito" id="torna-coda">‹ coda delle posizioni</button></div>'
    + '<div class="intestazione"><h1>' + esc(p.nome) + badgeStatoPersona(p) + "</h1>"
    + "<p>" + esc(p.ruolo) + " · " + esc(unita.nome) + " · dal " + esc(dataISO(p.dal)) + " (" + esc(antoTesto(anz)) + ")</p></div>"
    + '<dl class="fatti">'
    + fattoHTML("Attività svolta", p.mansioni, "dalla lettera di incarico e dai turni")
    + fattoHTML("Livello in busta paga", p.livello, "dal prospetto paga di " + esc(ultimoMese()))
    + fattoHTML("Contratto applicato", nomeContratto(p.ccnl_in_busta) + " · " + p.contratto, "dal prospetto paga, cio\u00e8 dal contratto dichiarato all\u2019INPS ogni mese")
    + "</dl>"
    + '<div class="blocco"><h2>' + icona("file-text") + "Da quali atti risulta</h2>"
    + '<ul class="atti">' + attiHTML(p) + "</ul></div>"
    + corpo;
}
function fattoHTML(titolo, valore, sotto) {
  return '<div class="fatto"><dt>' + esc(titolo) + "</dt><dd>" + esc(valore) + "<em>" + esc(sotto) + "</em></dd></div>";
}
function antoTesto(anz) {
  const a = anz.anni === 1 ? "1 anno" : anz.anni + " anni";
  const m = anz.mesi % 12;
  if (!m) return a + " di servizio";
  return a + " e " + m + " mesi di servizio";
}
function ultimoMese() {
  const M = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return M[d.getMonth()] + " " + d.getFullYear();
}
function badgeStatoPersona(p) {
  const f = Store.fatto(p.id);
  return f ? " " + badgeVerdetto(f.stato) : "";
}
function attiHTML(p) {
  const u = AZIENDA.unita.filter((x) => x.id === p.unita)[0];
  const atti = [
    { t: "Lettera di assunzione del " + dataISO(p.dal), d: "mansioni e livello iniziale", i: "file-text" },
    { t: "Prospetto paga di " + ultimoMese(), d: "contratto, livello e voci retributive", i: "file-text" },
    { t: "Turni e orari: " + p.turni, d: "orario effettivo, domeniche e notti lavorate", i: "clock" },
    { t: "Visura dell'unità " + u.nome, d: "classifica l'attività con il codice ATECO " + u.ateco + ", cioè il codice della camera di commercio", i: "briefcase" },
  ];
  if (p.mancanti && Object.keys(p.mancanti).filter((k) => p.mancanti[k]).length) {
    atti.push({ t: "Atti che mancano", d: Object.keys(p.mancanti).filter((k) => p.mancanti[k]).map((k) => p.mancanti[k]).join(" "), i: "help", manca: true });
  }
  /* una riga sola: la spiegazione lunga resta nel tooltip, non spezza l'elenco */
  return atti.map((a) => '<li class="atto' + (a.manca ? " manca" : "") + '">' + icona(a.i)
    + "<span><strong>" + esc(a.t) + "</strong><em>" + esc(a.d) + "</em></span></li>").join("");
}

/* ---------- il pulsante: la verifica non parte mai da sola --------- */
function ctaHTML() {
  const f = Store.fatto(personaCorrente().id);
  const secondi = Math.round(DURATA_VERIFICA / 1000);
  return '<div class="cta-verifica" id="cta-verifica"><h3>' + icona("scale") + " Verifica a quale contratto porta questa posizione</h3>"
    + "<p>L'app legge gli atti qui sopra, confronta i contratti dell'archivio e apre la mappa delle clausole. "
    + "Circa " + secondi + " secondi: i dati qui sopra non cambiano.</p>"
    + '<button class="primario" id="avvia-verifica">' + icona("sparkles") + " Verifica le clausole</button>"
    + (f ? '<div class="azioni" style="justify-content:center"><button class="secondario" id="riapri-esito">' + icona("history") + " mostra l'esito di prima</button></div>" : "")
    + "</div>";
}

/* ---------- i 40 secondi ---------- */
const FASI = [
  "Leggo la lettera di incarico e l'ultimo prospetto paga",
  "Confronto l'attività svolta con i contratti dell'archivio",
  "Apro le clausole del contratto pertinente",
  "Controllo come risulta applicata ogni clausola",
];
function lavorazioneHTML() {
  const w = statoApp.lavorazione;
  const pct = Math.min(100, Math.round((Date.now() - w.inizio) / DURATA_VERIFICA * 100));
  const resto = Math.max(0, Math.ceil((DURATA_VERIFICA - (Date.now() - w.inizio)) / 1000));
  return '<div class="blocco lavorazione" id="lavorazione"><h2>' + icona("sparkles") + " Sto leggendo la posizione di " + esc(personaCorrente().nome) + "</h2>"
    + '<div class="lav-bar"><i style="width:' + pct + '%"></i></div><ul class="lav-fasi">'
    + FASI.map((f, i) => {
        const classe = i < w.fase ? "fatta" : i === w.fase ? "attiva" : "";
        const marcatore = i < w.fase ? icona("check") : i === w.fase ? '<span class="spinner"></span>' : icona("minus");
        return '<li class="' + classe + '">' + marcatore + esc(f) + "</li>";
      }).join("")
    + "</ul><p class=\"lav-conta\">tempo che resta: " + resto + "s</p></div>";
}
function avviaVerifica() {
  if (statoApp.lavorazione) return;
  statoApp.nota = null;
  statoApp.scelta = null;
  statoApp.lavorazione = { inizio: Date.now(), fase: 0, timer: null, tick: null };
  disegna();
  statoApp.lavorazione.timer = setTimeout(() => {
    const p = personaCorrente();
    const v = verdetto(p, null);
    statoApp.lavorazione = null;
    statoApp.verdetto = v;
    statoApp.scelta = v.scelta;
    Store.verifica(p.id, v);
    disegna();
    const titolo = $("verdetto");
    if (titolo) titolo.scrollIntoView({ behavior: "smooth", block: "start" });
  }, DURATA_VERIFICA);
  statoApp.lavorazione.tick = setInterval(aggiornaLavorazione, 250);
}
function aggiornaLavorazione() {
  const w = statoApp.lavorazione;
  if (!w) return clearInterval(w && w.tick);
  w.fase = Math.min(FASI.length - 1, Math.floor((Date.now() - w.inizio) / DURATA_VERIFICA * FASI.length));
  const nodo = $("lavorazione");
  if (nodo) nodo.outerHTML = lavorazioneHTML();
}
function fermalavorazione() {
  const w = statoApp.lavorazione;
  if (!w) return;
  clearTimeout(w.timer); clearInterval(w.tick);
  statoApp.lavorazione = null;
}

/* ============================================================
   IL VERDETTO — l'elemento tipograficamente più pesante
   ============================================================ */
const VERDETTI_ETICHETTA = {
  ccnl_non_pertinente: "Il contratto non è quello dell'attività",
  inquadramento_da_riallineare: "Il livello non è quello delle mansioni",
  clausole_a_rischio: "Clausole applicate male",
  clausole_da_attivare: "Clausole da attivare",
  decide_una_persona: "L'app non decide",
  in_regola: "Nessuna clausola aperta",
};
/* i tre contatori accanto al verdetto: lo zero e il plurale scritti
   come li direbbe una persona, non come li sputa un loop */
const CHIPS_CONTEGGIO = [
  { chiave: "da_attivare",  icona: "bolt",  uno: "una clausola da attivare", zero: "nessuna clausola da attivare",
    molti: (n) => n + " clausole da attivare" },
  { chiave: "a_rischio",    icona: "alert", uno: "una clausola applicata male", zero: "nessuna clausola applicata male",
    molti: (n) => n + " clausole applicate male" },
  { chiave: "da_verificare", icona: "help", uno: "un dato che manca", zero: "nessun dato che manca",
    molti: (n) => n + " dati che mancano" },
];
function chipConto(n, c) {
  const testo = n === 0 ? c.zero : n === 1 ? c.uno : c.molti(n);
  return "<li>" + icona(c.icona) + " " + esc(testo) + "</li>";
}
function verdettoHTML(p) {
  const v = statoApp.verdetto;
  const n = v.numeri;
  return '<div class="blocco verdetto" id="verdetto">'
    + '<div class="verdetto-stato">' + esc(VERDETTI_ETICHETTA[v.stato]) + "</div>"
    + '<p class="verdetto-frase" id="frase-verdetto">' + esc(v.frase) + "</p>"
    + '<p class="verdetto-chi">' + icona("user") + "<span>" + esc(v.chi.charAt(0).toUpperCase() + v.chi.slice(1)) + ".</span></p>"
    + '<ul class="conteggi">'
    + "<li>" + icona("scale") + " " + n.pertinenti + " di " + n.totale + " clausole la riguardano</li>"
    + CHIPS_CONTEGGIO.map((c) => chipConto(n[c.chiave], c)).join("")
    + "</ul>"
    + '<p class="defs">“La riguardano” sono le clausole che la sua posizione attiva davvero; le altre tre cifre sono un conto dentro quella. '
    + "La mappa qui sotto le elenca una per una, con la fonte e il perché di ognuna.</p>"
    + "</div>";
}

/* ============================================================
   QUALE CONTRATTO — le opzioni tutte dello stesso peso
   ============================================================ */
function candidatiHTML(p) {
  const v = statoApp.verdetto;
  /* tutti e tre i contratti dell'archivio, dello stesso peso: chi guarda
     deve poter leggere perché gli altri due non c'entrano, non vederli nascosti */
  const candidati = v.consiglio.candidati;
  const carte = candidati.map((c) => cartaHTML(p, c, v)).join("");
  const avvertenza = v.consiglio.ccnlId === null
    ? '<p class="soglia-nota">' + icona("help") + " Nessun contratto passa la soglia: " + esc(v.consiglio.motivo) + ". "
      + "Sotto trovi le prove che mancano; con quelle l'aderenza salirebbe.</p>"
    : "";
  const sceltaNota = v.scelto_dalla_persona
    ? '<p class="soglia-nota">' + icona("alert") + " Hai scelto tu questo contratto: non è un consiglio dell'app.</p>"
    : "";

  return '<div class="blocco' + (v.consiglio.ccnlId === null ? " blocco-avvertenza" : "") + '" id="contratti">'
    + "<h2>" + icona("briefcase") + " Quale contratto si applica</h2>"
    + '<p class="blocco-sottotitolo">Scegli tu il contratto di riferimento: la mappa delle clausole si rifà subito. '
    + "L'aderenza misura quanto le prove dell'attività svolta somigliano al campo di applicazione del contratto: 0 = niente a che vedere, 1 = coincide. "
    + "L'app propone solo sopra " + due(SOGLIA_ADRENZA) + " e se stacca il secondo di " + due(SOGLIA_DISTACCO) + ".</p>"
    + '<p class="defs legenda"><span>' + icona("check") + " criterio trovato nelle prove</span>"
    + "<span>" + icona("minus") + " non trovato</span>"
    + "<span>" + icona("help") + " la prova manca, e l'aderenza pu\u00f2 salire</span></p>"
    + '<div class="candidati" style="grid-template-columns:repeat(' + Math.min(candidati.length, 3) + ',minmax(0,1fr))">' + carte + "</div>"
    + avvertenza + sceltaNota + "</div>";
}
function cartaHTML(p, c, v) {
  const arc = ARCHIVIO_CCNL[c.ccnlId];
  const selezionato = c.ccnlId === v.scelta;
  const consiglioApp = v.consiglio.ccnlId === c.ccnlId;
  const inBusta = c.ccnlId === p.ccnl_in_busta;
  const mancanti = c.criteri.filter((x) => x.stato === "manca");
  return '<button class="cand' + (selezionato ? " selezione" : "") + '" data-ccnl="' + esc(c.ccnlId) + '">'
    + '<div class="cand-cabeza"><span class="cand-nome">' + esc(arc.nome) + "</span>"
    + (consiglioApp ? '<span class="badge consiglio">' + icona("sparkles") + "il nostro consiglio</span>" : "")
    + (inBusta ? '<span class="badge coperta">in busta paga</span>' : "") + "</div>"
    + '<div class="cand-codice"><strong>' + esc(arc.codice) + "</strong> \u00b7 " + esc(arc.sigle) + " \u00b7 " + esc(arc.vigenza) + "</div>"
    + '<p class="cand-campo">' + esc(arc.campo) + "</p>"
    + '<div class="cand-punteggio"><b>' + due(c.punteggio) + "</b><span>aderenza"
    + (mancanti.length ? " · potrebbe salire a " + due(c.potenziale) + " con le prove che mancano" : "") + "</span></div>"
    + '<div class="barra"><i style="width:' + Math.round(c.punteggio * 100) + '%"></i></div>'
    + (c.punteggio === 0 ? '<p class="cand-perche">nessun criterio trovato: l\u2019attivit\u00e0 di questa persona non ricade in questo contratto</p>' : "")
    + '<ul class="criteri">' + c.criteri.map((cr) =>
        '<li class="' + esc(cr.stato) + '">' + icona(cr.stato === "si" ? "check" : cr.stato === "manca" ? "help" : "minus")
        + "<span>" + esc(cr.testo) + " <em>(" + esc(cr.fonte) + ", " + cr.peso + " punti)</em></span></li>").join("")
    + "</ul></button>";
}

/* ============================================================
   LA MAPPA — tutte le clausole, con la fonte di ogni riga
   ============================================================ */
const GRUPPI = [
  { chiavi: ["da_attivare", "a_rischio"], titolo: "Cosa chiede il contratto a questa persona", aperto: true,
    oltre: "Sono le clausole che spettano a questa persona e oggi non sono applicate, o sono applicate in modo non conforme." },
  { chiavi: ["da_verificare"], titolo: "Manca un dato: qui decide una persona", aperto: false,
    oltre: "L'app non ipotizza: dice esattamente quale atto serve e chi può procurarlo." },
  { chiavi: ["coperta"], titolo: "Già applicate", aperto: false, oltre: "" },
  { chiavi: ["non_pertinente"], titolo: "Non la riguardano", aperto: false,
    oltre: "Il contratto le prevede, la sua posizione no. Sono elencate per non lasciarle nell'ombra." },
];
function mappaHTML(p) {
  const v = statoApp.verdetto;
  /* quando non c'è nulla da attivare è il momento dei dati che mancano:
     quel gruppo si apre da solo, altrimenti la schermata resta muta */
  const mostra_mancanti = v.stato === "decide_una_persona" || v.stato === "in_regola";
  const gruppi = GRUPPI.map((g) => {
    const righe = v.righe.filter((r) => g.chiavi.indexOf(r.stato) >= 0);
    if (!righe.length) return "";
    const aperto = g.aperto || (g.chiavi.indexOf("da_verificare") >= 0 && mostra_mancanti);
    return "<details class=\"gruppo\"" + (aperto ? " open" : "") + "><summary>"
      + esc(g.titolo) + ' <span class="conto">' + righe.length + " clausole</span>"
      + '<span class="chevron">' + icona("chevron-right") + "</span></summary>"
      + (g.oltre ? '<p class="blocco-sottotitolo">' + esc(g.oltre) + "</p>" : "")
      + righe.map(clausolaHTML).join("")
      + "</details>";
  }).join("");
  const n = v.numeri;
  const conto = n.da_attivare + n.a_rischio + n.da_verificare + n.coperta;
  return '<div class="blocco" id="mappa"><h2>' + icona("scale") + " Tutte le clausole del contratto per " + esc(p.nome.split(" ")[0]) + "</h2>"
    + '<p class="blocco-sottotitolo">'
    + "Contratto letto: <strong>" + esc(ARCHIVIO_CCNL[v.scelta].nome) + "</strong>. "
    + n.pertinenti + " clausole la riguardano (" + n.da_attivare + " da attivare + " + n.a_rischio
    + " applicate male + " + n.da_verificare + " con un dato da recuperare + " + n.coperta
    + " già applicate) + " + n.non_pertinente + " che non la riguardano = " + n.totale + " clausole in tutto.</p>"
    + '<p class="legenda"><span>' + badgeStato("da_attivare") + " spetta e non risulta applicata</span>"
    + "<span>" + badgeStato("a_rischio") + " risulta applicata in modo non conforme</span>"
    + "<span>" + badgeStato("da_verificare") + " manca un documento, l’app non decide</span></p>"
    + (conto !== n.pertinenti ? '<p class="legenda avvertenza">il conto delle clausole aperte non torna: ' + conto + " contro " + n.pertinenti + "</p>" : "")
    + gruppi + "</div>";
}
function clausolaHTML(r) {
  return '<details class="clausola"><summary>' + badgeStato(r.stato)
    + '<span class="cl-testo"><span class="cl-titolo">' + esc(r.titolo) + "</span>"
    + '<span class="cl-valore">' + esc(r.cosa) + "</span></span>"
    + '<span class="chevron">' + icona("chevron-right") + "</span></summary>"
    + '<div class="cl-corpo">'
    + rigaHTML("Che cosa dà", r.cosa)
    + rigaHTML("Perché riguarda " + personaCorrente().nome.split(" ")[0], r.perche)
    + (r.prova ? rigaHTML("Cosa risulta negli atti", r.prova) : "")
    + (r.valore ? '<p class="cl-riga"><b>Cosa prevede</b><span class="fonte">' + esc(r.valore) + "</span></p>" : "")
    + rigaHTML("Fonte", r.fonte, true)
    + (r.passaggio ? '<p class="cl-passaggio">' + icona("history") + esc(r.passaggio) + "</p>" : "")
    + (r.azione && r.azione !== "Nessuna."
        ? '<p class="cl-azione">' + esc(r.azione) + "<em>a carico di: " + esc(r.chi) + "</em></p>" : "")
    + "</div></details>";
}
function rigaHTML(etichetta, testo, fonte) {
  if (!testo) return "";
  return '<p class="cl-riga"><b>' + esc(etichetta) + "</b>"
    + (fonte ? '<span class="fonte">' + esc(testo) + "</span>" : esc(testo)) + "</p>";
}

/* ============================================================
   L'OGGETTO PRODOTTO: la nota per il consulente
   ============================================================ */
function notaBloccoHTML(p) {
  return '<div class="blocco" id="nota-blocco"><h2>' + icona("pen-line") + " Il documento che l'app produce</h2>"
    + '<p class="blocco-sottotitolo">Una nota con le sole cifre, le date e le fonti che stanno già negli atti di ' + esc(p.nome) + ".</p>"
    + '<button class="secondario" id="vedi-nota">' + icona("file-text") + " vedi la nota per il consulente ›</button>"
    + (statoApp.nota ? '<pre class="nota-testo" id="nota-testo">' + esc(statoApp.nota) + "</pre>"
        + '<div class="azioni"><button class="secondario" id="copia-nota">' + icona("copy") + " copia</button></div>" : "")
    + "</div>";
}

/* ============================================================
   BLOCCO PER CHI VALUTA L'APP
   ============================================================ */
function valutatoreHTML() {
  return '<details class="blocco valutatore"><summary>Per chi deve valutare questa app: cosa è vero e cosa è simulato</summary>'
    + '<div class="valutatore-body"><table><tr><th>Dietro la schermata</th><th>Nell\'app vera</th><th>In questa demo</th></tr>'
    + "<tr><td>Leggere gli atti della persona (lettera, prospetto paga, turni, visura)</td><td>estrazione guidata su documento con il modello della piattaforma</td><td>gli atti sono già scritti nell'archivio della posizione</td></tr>"
    + "<tr><td>Trovare il contratto pertinente</td><td>ricerca nell'archivio CCNL (CNEL) sulle prove dell'attività svolta</td><td>archivio locale con tre contratti: E01H, H011, I100</td></tr>"
    + "<tr><td>Aprire le clausole che riguardano la persona</td><td>inferenza vincolata sul testo del contratto, con citazione dell'articolo</td><td>regole deterministiche in js/engine.js: nessun modello nel verdetto</td></tr>"
    + "<tr><td>Tenere la storia delle verifiche</td><td>database dell'app, una riga per posizione</td><td>memoria del browser</td></tr>"
    + "</table>"
    + "<p>I valori contrattuali sono la versione caricata nell'archivio (snapshot 09/2025): "
    + "CCNL Industria Alimentare E01H, Terziario Distribuzione Servizi H011, Logistica Trasporto Merci e Spedizione I100. "
    + "Ogni rinnovo cambia le cifre: l'app vera riallinea l'archivio a ogni verbale depositato. "
    + "Le 40 secondi di lettura sono simulate: partono solo dal pulsante.</p>"
    + "<p>Le due decisioni di progetto — tenant/ambiente target e registry delle immagini — sono aperte: le decide Sara prima di qualsiasi rilascio.</p>"
    + "</div></details>";
}

/* ============================================================
   GUIDA PRIMO AVVIO — tre passi, finisce sul pulsante
   ============================================================ */
const GUIDA = [
  { titolo: "Si parte dalla persona", testo: "Ogni riga è una posizione dell'archivio del personale. Apri quella che ti interessa.", porta: null },
  { titolo: "L'app legge gli atti", testo: "Attività svolta, livello e contratto in busta paga, ognuno con l'atto da cui risulta. Nessun numero scritto a mano.", porta: null },
  { titolo: "Da qui parte la verifica", testo: "Quaranta secondi, e il contratto pertinente compare insieme a tutte le clausole che riguardano questa persona.", porta: "avvia-verifica" },
];
let guidaPasso = 0;
function guidaApri() {
  guidaPasso = 0;
  const overlay = $("guida");
  if (overlay) overlay.classList.add("acceso");
  guidaDisegna();
}
function guidaDisegna() {
  const s = GUIDA[guidaPasso], ultimo = guidaPasso === GUIDA.length - 1;
  $("guida-titolo").innerText = s.titolo;
  $("guida-testo").innerText = s.testo;
  $("guida-punti").innerHTML = GUIDA.map((_, i) => '<i class="' + (i === guidaPasso ? "acceso" : "") + '"></i>').join("");
  const b = $("guida-avanti");
  b.innerText = ultimo ? "Apri la verifica di esempio" : "Continua";
  b.onclick = () => {
    if (!ultimo) { guidaPasso++; guidaDisegna(); return; }
    guidaChiudi();
    if (s.porta && $(s.porta)) {
      const nodo = $(s.porta);
      nodo.scrollIntoView({ behavior: "smooth", block: "center" });
      nodo.classList.add("inseguito");
    }
  };
}
function guidaChiudi() {
  Store.tourFatto();
  const o = $("guida");
  if (o) o.classList.remove("acceso");
}

/* ============================================================
   DISEGNO E AVVENIMENTI
   ============================================================ */
function disegna() {
  const corpo = statoApp.vista === "persona" ? vistaPersona() : vistaElenco();
  $("app").innerHTML = testataHTML()
    + '<main class="contenitore">' + corpo + "</main>"
    + '<div class="tour" id="guida"><div class="tour-card"><h3 id="guida-titolo"></h3><p id="guida-testo"></p>'
    + '<div class="tour-piedi"><span class="tour-punti" id="guida-punti"></span>'
    + '<button class="link-pulito" id="guida-salta">salta</button>'
    + '<button class="primario" id="guida-avanti">Continua</button></div></div></div>';
  collega();
  if (statoApp.lavorazione) rileggiLavorazione();
}
function rileggiLavorazione() {
  /* il DOM appena ridisegnato viene riallineato dal prossimo tick */
  aggiornaLavorazione();
}
function collega() {
  const t = $("torna-coda");
  if (t) t.onclick = () => { chiudiVerifica(); statoApp.vista = "elenco"; disegna(); };
  document.querySelectorAll("[data-apri]").forEach((b) => {
    b.onclick = () => apriPosizione(b.getAttribute("data-apri"));
  });
  const avvio = $("avvia-verifica");
  if (avvio) avvio.onclick = avviaVerifica;
  const esito = $("riapri-esito");
  if (esito) esito.onclick = mostraEsitoPrecedente;
  const nota = $("vedi-nota");
  if (nota) nota.onclick = () => {
    statoApp.nota = statoApp.verdetto ? notaConsulente(personaCorrente(), statoApp.verdetto) : "";
    disegna();
    const n = $("nota-testo");
    if (n) n.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const copia = $("copia-nota");
  if (copia) copia.onclick = () => {
    const n = $("nota-testo");
    if (n && navigator.clipboard) navigator.clipboard.writeText(n.innerText);
  };
  document.querySelectorAll("[data-ccnl]").forEach((b) => {
    b.onclick = () => cambiaContratto(b.getAttribute("data-ccnl"));
  });
  const rg = $("riapri-guida");
  if (rg) rg.onclick = guidaApri;
  const skip = $("guida-salta");
  if (skip) skip.onclick = guidaChiudi;
}
function apriPosizione(id) {
  chiudiVerifica();
  statoApp.personaId = id;
  statoApp.vista = "persona";
  statoApp.verdetto = null;
  statoApp.nota = null;
  statoApp.scelta = null;
  disegna();
  window.scrollTo(0, 0);
  if (!NOTOUR && !Store.tourVisto()) setTimeout(guidaApri, 400);
  if (AUTO) setTimeout(avviaVerifica, 200);
}
function chiudiVerifica() {
  fermalavorazione();
  statoApp.verdetto = null;
  statoApp.nota = null;
}
function mostraEsitoPrecedente() {
  const f = Store.fatto(personaCorrente().id);
  if (!f) return;
  statoApp.verdetto = verdetto(personaCorrente(), f.scelta);
  statoApp.scelta = statoApp.verdetto.scelta;
  disegna();
}
function cambiaContratto(ccnlId) {
  const p = personaCorrente();
  statoApp.scelta = ccnlId;
  statoApp.verdetto = verdetto(p, ccnlId);
  statoApp.nota = null;
  disegna();
  const m = $("mappa");
  if (m) m.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- primo avvio -------------------------------------------- */
function statoDaHash() { return (location.hash || "").replace("#", ""); }
/* stati pilotati da prova-stati.html e dalle catture */
const PRESETI = {
  elenco: () => {},
  persona: () => { statoApp.personaId = "pellizzari"; statoApp.vista = "persona"; },
  lavorazione: () => { statoApp.personaId = "pellizzari"; statoApp.vista = "persona"; statoApp.lavorazione = { inizio: Date.now() - 15000, fase: 1, timer: null, tick: null }; },
  ccnl: () => { posa("pellizzari"); },
  livello: () => { posa("ferrante"); },
  rischio: () => { posa("doumbia"); },
  attivare: () => { posa("el_amrani"); },
  indeciso: () => { posa("sartori"); },
  pulito: () => { posa("bruni"); },
  termine: () => { posa("moretti"); },
  scelta: () => { posa("bruni", "logistica"); },
};
function posa(id, ccnl) {
  statoApp.personaId = id;
  statoApp.vista = "persona";
  statoApp.verdetto = verdetto(personaCorrente(), ccnl || null);
  statoApp.scelta = statoApp.verdetto.scelta;
}
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const preset = PRESETI[statoDaHash()];
    if (preset) preset();
    disegna();
    if (preset && statoApp.vista === "persona") {
      if (!NOTOUR && !Store.tourVisto() && !AUTO) setTimeout(guidaApri, 400);
      if (AUTO) setTimeout(avviaVerifica, 200);
    }
  });
}
