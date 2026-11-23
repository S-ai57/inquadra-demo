/* ------------------------------------------------------------------
   Interfaccia di Inquadra: la coda delle buste da esaminare, i fatti della
   persona, l'esame del prospetto paga voce per voce e le domande di chi
   legge. Vanilla JS, nessuna dipendenza, nessuna build.
   ------------------------------------------------------------------ */

const statoApp = {
  vista: "elenco",
  personaId: null,
  lavorazione: null,   /* non vuoto mentre l'esame gira */
  verdetto: null,      /* serve all'esame come lente di lettura, non è più una schermata */
  scelta: null,        /* contratto sotto cui si legge la busta (null = quello dell'app) */
  esame: null,         /* l'esame della busta, quando è stato chiesto */
  lettura: null,       /* cosa ha scritto il modello vero, con i suoi tempi */
  risposte: [],        /* le domande fatte sull'ultimo esame */
  errore: null,
};

/* --- parametri della demo (scorciatoie sole per le prove) --------- */
const QUERY = (typeof location !== "undefined" && location.search) || "";
const NOAI = /(^|[?&])noai=1/.test(QUERY);
const AUTO = /(^|[?&])auto=1/.test(QUERY);
const NOTOUR = /(^|[?&])notour=1/.test(QUERY);
/* la passata simulata: 40 secondi, accorciati solo con ?noai=1 per le prove */
/* la durata non è più una sceneggiatura: la lettura la fa il modello,
   e il tempo che si vede a schermo è quello della chiamata */

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
  "eye-off": '<path d="M10.7 5.1A9.6 9.6 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.7 2.6"/><path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
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

/* ---------- cosa resta in memoria su questo browser ---------------- */
const Store = {
  chiave: "fontanella.inquadra.v2",
  leggi() {
    try { return JSON.parse(localStorage.getItem(this.chiave)) || { esami: {}, tour: false }; }
    catch (e) { return this._mem || { esami: {}, tour: false }; }
  },
  scrivi(d) {
    this._mem = d;
    try { localStorage.setItem(this.chiave, JSON.stringify(d)); } catch (e) { /* continua in memoria */ }
  },
  /* l'esame della busta paga: si ricorda che è fatto e cosa ha trovato */
  esame(id, es) {
    const d = this.leggi();
    d.esami = d.esami || {};
    d.esami[id] = { ts: Date.now(), lettura: es.lettura,
      anomalie: es.riepilogo.anomalie, euro: es.riepilogo.euro_mancanti };
    this.scrivi(d);
  },
  esameFatto(id) { return (this.leggi().esami || {})[id] || null; },
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
    + '<span class="modello-stato ' + MODELLO.stato + '" title="' + esc(MODELLO.base || "") + '">'
    + icona(modelloIcona()) + esc(modelloEtichetta()) + "</span>"
    + '<span class="spacer"></span>'
    + '<button class="link-pulito" id="riapri-guida">riapri la guida</button>'
    + "</div></header>";
}
const AZENDA_UFFICIO = APP.ufficio;

/* come si chiama il modello, in breve, senza il prefisso del provider */
function nomeModello() { return String(MODELLO.nome || "modello").split("/").pop(); }
function modelloEtichetta() {
  if (SENZA_MODELLO) return "senza modello, per prova";
  if (MODELLO.stato === "pronto") return "modello: " + nomeModello();
  if (MODELLO.stato === "senza_token") return "link senza token: apri l\u2019indirizzo ricevuto per intero";
  if (MODELLO.stato === "assente") return "modello non collegato: risponde il motore";
  return "sto controllando il modello\u2026";
}
/* il segno accanto alla scritta: la parola comanda, l\u2019icona accompagna */
function modelloIcona() {
  if (MODELLO.stato === "pronto") return "sparkles";
  if (MODELLO.stato === "senza_token") return "eye-off";
  return "minus";
}
/* il testo del modello torna in paragrafi, non in un muro di caratteri */
function paragrafi(testo) {
  return String(testo || "").split("\n").map(function (t) { return t.trim(); })
    .filter(function (t) { return t.length; })
    .map(function (t) { return "<p>" + esc(t.replace(/^[-*·]\s*/, "")) + "</p>"; }).join("");
}

/* ============================================================
   VISTA 1 — la coda delle posizioni
   ============================================================ */
function vistaElenco() {
  const coda = DIPENDENTI.length;
  const righe = DIPENDENTI.map((p) => {
    const e = Store.esameFatto(p.id);
    const destra = e
      ? badgeEsameFatto(e) + '<button class="apri" data-apri="' + esc(p.id) + '">Apri di nuovo ›</button>'
      : '<button class="apri" data-apri="' + esc(p.id) + '">Apri la posizione ›</button>';
    return '<li class="riga">'
      + '<div class="riga-corpo">'
      + '<div class="riga-nome">' + esc(p.nome) + "</div>"
      + '<div class="riga-ruolo">' + esc(p.ruolo) + "</div>"
      + '<p class="riga-nota">' + esc(notaCoda(p, e)) + "</p>"
      + '<span class="riga-contratto">' + icona("briefcase") + "in busta paga: " + esc(nomeContratto(p.ccnl_in_busta)) + "</span>"
      + "</div>" + destra + "</li>";
  }).join("");

  return '<section class="intro"><h1>' + esc(APP.sottotitolo) + "</h1>"
    + "<p>" + esc(AZIENDA.ragione) + " ha " + conto(AZIENDA.unita.length, "attività") + " ("
    + esc(AZIENDA.unita.map(unitaCorta).join(", ")) + ") e un solo contratto applicato a tutti. "
    + "Qui l'ufficio del personale esamina una per una le buste paga del mese.</p></section>"
    + '<div class="elenco-cabeza"><div><span class="cifra-occhio">' + coda + "</span>"
    + "<span>buste da esaminare: ognuna apre il suo prospetto, voce per voce, con la fonte di ogni riga.</span></div></div>"
    + '<ul class="elenco">' + righe + "</ul>"
    + valutatoreHTML();
}
function nomeContratto(id) { return ARCHIVIO_CCNL[id].nome_corto; }
/* le tre unità chiamate con la parola che usano in azienda */
const UNITA_CORTE = { stab: "stabilimento", spaccio: "spaccio", dep: "consegne" };
function unitaCorta(u) { return UNITA_CORTE[u.id] || u.nome; }

/* una riga sola, e dice cosa non sa ancora l'app */
function notaCoda(p, e) {
  if (!e) {
    const b = BUSTE[p.id];
    return "Prospetto di " + ultimoMese() + (b ? ", " + b.righe.length + " voci da leggere" : ", da leggere");
  }
  const parti = [e.anomalie
    ? e.anomalie + (e.anomalie === 1 ? " voce che non torna" : " voci che non tornano")
    : "nessuna voce che non torna"];
  if (e.euro) parti.push(euroCents(e.euro) + " € l'anno di quote non versate");
  return "Esame già fatto: " + parti.join(", ") + ".";
}
/* la coda si legge prima di aprire: due parole e il numero che conta */
function badgeEsameFatto(e) {
  const parola = e.anomalie
    ? e.anomalie + (e.anomalie === 1 ? " voce che non torna" : " voci che non tornano")
    : "esame fatto";
  return '<span class="badge ' + (e.anomalie ? "a_rischio" : "coperta") + '">'
    + icona(e.anomalie ? "alert" : "check") + esc(parola) + "</span>";
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

  let busta;
  if (statoApp.lavorazione) busta = lavorazioneHTML();
  else if (statoApp.esame) busta = esameHTML(p);
  else busta = bustaCTAHTML(p);
  const corpo = busta + valutatoreHTML();

  return '<div class="torna"><button class="link-pulito" id="torna-coda">‹ coda delle posizioni</button></div>'
    + '<div class="intestazione"><h1>' + esc(p.nome) + "</h1>"
    + "<p>" + esc(p.ruolo) + " · " + esc(unita.nome) + " · dal " + esc(dataISO(p.dal)) + " (" + esc(antoTesto(anz)) + ")</p></div>"
    + '<dl class="fatti">'
    + fattoHTML("Attività svolta", p.mansioni, "dalla lettera di incarico e dai turni")
    + fattoHTML("Livello in busta paga", p.livello, "dal prospetto paga di " + esc(ultimoMese()))
    + fattoHTML("Contratto applicato", nomeContratto(p.ccnl_in_busta) + " · " + p.contratto, "dal prospetto paga, cio\u00e8 dal contratto dichiarato all\u2019INPS ogni mese")
    + "</dl>"
    + '<div class="blocco"><h2>' + icona("file-text") + "Cosa legge l’app" + "</h2>"
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
function attiHTML(p) {
  const b = BUSTE[p.id];
  /* l'app legge un documento solo: elencarne cinque faceva aspettare di più */
  const atti = [{
    t: "Busta paga di " + (b ? b.mese : ultimoMese()),
    d: b ? String(b.righe.length) + " voci, contratto dichiarato " + nomeContratto(b.ccnl_dichiarato)
          + ", " + b.ore_settimana + " ore, tariffa " + dueEuro(b.tariffa) + " € l'ora"
      : "il documento sotto esame",
    i: "file-text",
  }];
  const mancanti = p.mancanti || {};
  const chi = Object.keys(mancanti).filter(function (k) { return mancanti[k]; }).map(function (k) { return mancanti[k]; });
  if (chi.length) atti.push({ t: "Atti che non ci sono ancora", d: chi.join(" · "), i: "help", manca: true });
  /* una riga sola: la spiegazione lunga resta nel tooltip, non spezza l'elenco */
  return atti.map((a) => '<li class="atto' + (a.manca ? " manca" : "") + '">' + icona(a.i)
    + "<span><strong>" + esc(a.t) + "</strong><em>" + esc(a.d) + "</em></span></li>").join("");
}

/* ---------- il pulsante: la verifica non parte mai da sola --------- */
function bustaCTAHTML(p) {
  const b = BUSTE[p.id];
  const prima = Store.esameFatto(p.id);
  return '<div class="cta-verifica" id="cta-busta"><h3>' + icona("file-text")
    + " Esamina la busta paga di " + esc(b ? b.mese : "questo mese") + "</h3>"
    + "<p>L’app legge il documento voce per voce, rifà i conti e dice cosa torna, cosa è applicato male e cosa manca. "
    + (modelloUsabile()
        ? "I numeri li calcola il motore, la scrittura è di " + nomeModello()
          + ": pochi secondi, e il tempo che vedi è quello vero della chiamata.</p>"
        : "Il modello non è collegato: risponde il motore deterministico, e lo dice.</p>")
    + '<button class="primario" id="avvia-esame">' + icona("sparkles") + " Esamina la busta paga</button>"
    + (prima ? '<div class="azioni" style="justify-content:center"><button class="secondario" id="riapri-esame">'
        + icona("history") + " mostra l'esame di prima</button></div>" : "")
    + "</div>";
}

/* ============================================================
   L'ESAME DELLA BUSTA — il documento, riga per riga
   ============================================================ */
const TIPO_RIGA = {
  credito: "Cosa spetta", trattenuta: "Cosa viene trattenuto", fiscale: "Imposte",
  credito_fiscale: "Detrazioni", azienda: "A carico dell'azienda", rateo: "Ratei",
};
const ESAME_PAROLA = {
  torna: { parola: "verificata", icona: "check", tono: "coperta" },
  anomalia: { parola: "non torna", icona: "alert", tono: "a_rischio" },
  estranea: { parola: "di un altro contratto", icona: "copy", tono: "da_attivare" },
  manca: { parola: "manca nel prospetto", icona: "bolt", tono: "da_attivare" },
  da_verificare: { parola: "decide una persona", icona: "help", tono: "da_verificare" },
  non_verifico: { parola: "fuori dal contratto", icona: "eye-off", tono: "non_pertinente" },
  senza_tabella: { parola: "tabella non in archivio", icona: "help", tono: "da_verificare" },
};
/* la legenda: chi legge deve sapere cosa promette (e cosa non promette) ogni segno */
const ESAME_LEGENDA = [
  { chiave: "torna", testo: "confrontata con una clausola: torna" },
  { chiave: "anomalia", testo: "contraddice la clausola o il conto del documento" },
  { chiave: "manca", testo: "il contratto la prevede, il prospetto non la versa" },
  { chiave: "da_verificare", testo: "manca un atto: l'app non stima" },
  { chiave: "senza_tabella", testo: "serve la tabella dei minimi: non è caricata" },
  { chiave: "non_verifico", testo: "imposta o gestione interna: fuori dal contratto" },
];
function badgeEsame(stato) {
  const s = ESAME_PAROLA[stato] || ESAME_PAROLA.non_verifico;
  return '<span class="badge ' + s.tono + '">' + icona(s.icona) + esc(s.parola) + "</span>";
}
function euroVisto(cents) { return '<b class="cifra">' + esc(euroCents(cents)) + " \u20ac</b>"; }

function esameHTML(p) {
  const es = statoApp.esame, b = es.busta;
  return '<div class="blocco" id="esame"><h2>' + icona("file-text") + " Esame del prospetto di " + esc(b.mese) + "</h2>"
    + '<p class="blocco-sottotitolo">Letto sotto <strong>' + esc(ARCHIVIO_CCNL[es.lettura].nome) + "</strong> · "
    + es.riepilogo.righe + " voci, " + es.riepilogo.anomalie + " che non tornano, "
    + es.riepilogo.mancano + " da recuperare, "
    + (es.riepilogo.non_verificate - es.riepilogo.senza_tabella) + " fuori dal contratto"
    + (es.riepilogo.senza_tabella ? ", " + es.riepilogo.senza_tabella + " con la tabella dei minimi non caricata" : "") + "."
    + (es.riepilogo.euro_mancanti ? " · <strong>" + esc(euroCents(es.riepilogo.euro_mancanti)) + " € l'anno"
      + " di quote che il contratto prevede e il prospetto non versa</strong>." : "</p>")
    + '<div class="azioni"><button class="secondario" id="rifai-esame">' + icona("refresh") + " rifà l'esame</button></div>"
    + letturaModelloHTML() + letturaHTML(es) + contiHTML(es) + bustaHTML(es) + mancanoHTML(es) + cambioHTML(es) + domandeHTML(p)
    + "</div>";
}
/* la lente di lettura: è l'unica scelta che l'esame chiede a chi guarda */
/* quello che ha scritto il modello, con il controllo sulle cifre gi\u00e0 fatto */
function letturaModelloHTML() {
  const d = statoApp.lettura;
  if (!d) return "";
  const titolo = '<h3 class="sottosezione">' + icona("sparkles") + " La lettura del modello</h3>";
  if (d.errore) {
    return titolo + '<p class="avvertenza-modello">Il modello non ha risposto: ' + esc(d.errore)
      + ". Le righe qui sotto sono del motore deterministico e restano valide.</p>";
  }
  const controllo = modelloAffidabile(d);
  if (!controllo.ok) {
    return titolo + '<p class="avvertenza-modello">' + esc(controllo.perche)
      + ": non la mostro. Sotto trovi le stesse informazioni riga per riga, con le cifre del documento.</p>";
  }
  return titolo + '<div class="lettura-modello">' + paragrafi(d.testo)
    + '<p class="modello-firma">' + icona("clock") + esc(modelloFirma(d)) + " \u00b7 " + esc(controllo.perche) + "</p></div>";
}
function letturaHTML(es) {
  const opzioni = Object.keys(ARCHIVIO_CCNL);
  return '<div class="lettura"><span>rileggi con il contratto</span>'
    + opzioni.map(function (id) {
        return '<button class="chip-lettura' + (id === es.lettura ? " scelta" : "") + '" data-ccnl="' + esc(id) + '">'
          + esc(nomeContratto(id)) + "</button>";
      }).join("")
    + "<em>la stessa busta, con un altro contratto, risponde diverso</em></div>";
}
function contiHTML(es) {
  return '<h3 class="sottosezione">I conti rifatti</h3>' + es.conti.map((r) =>
      '<div class="conto">' + badgeEsame(r.stato) + "<div><strong>" + esc(r.cosa) + "</strong><p>" + esc(r.testo) + "</p>"
      + '<p class="fonte">' + esc(r.fonte) + (r.chi && r.chi !== "—" ? " · " + esc(r.chi) : "") + "</p></div></div>").join("");
}
function bustaHTML(es) {
  const b = es.busta;
  const gruppi = ["credito", "trattenuta", "fiscale", "credito_fiscale", "azienda"];
  const corpo = gruppi.map(function (tipo) {
    const righe = b.righe.filter((r) => r.tipo === tipo);
    if (!righe.length) return "";
    const sotto = righe.reduce((sum, r) => sum + r.valore, 0);
    return '<h4 class="gruppo-busta">' + esc(TIPO_RIGA[tipo])
      + '<span>' + esc(euroCents(sotto)) + " \u20ac</span></h4>"
      + righe.map((r) => rigaBustaHTML(es, r)).join("");
  }).join("");
  const rt = b.ratei;
  return '<h3 class="sottosezione">Il prospetto, voce per voce</h3>'
    + '<div class="busta-testa"><strong>Documento letto:</strong> busta paga di ' + esc(b.mese)
    + " \u00b7 " + esc(AZIENDA.ragione) + " \u00b7 contratto dichiarato " + esc(nomeContratto(b.ccnl_dichiarato))
    + " \u00b7 " + esc(b.livello) + " \u00b7 " + esc(String(b.ore_settimana)) + " ore \u00b7 tariffa "
    + esc(dueEuro(b.tariffa)) + " \u20ac/ora</div>"
    + '<p class="legenda">' + ESAME_LEGENDA.map(function (l) {
        return "<span>" + badgeEsame(l.chiave) + esc(l.testo) + "</span>";
      }).join("") + "</p>"
    + es.intestazione.map((r) => '<div class="conto">' + badgeEsame(r.stato) + "<div><strong>" + esc(r.cosa) + "</strong><p>" + esc(r.testo)
      + '</p><p class="fonte">' + esc(r.fonte) + "</p></div></div>").join("")
    + '<div class="busta">' + corpo + "</div>"
    + '<div class="busta-netto"><div><span>' + esc(euroCents(b.totali.crediti)) + "</span><em>che spettano</em></div><i>−</i>"
    + '<div><span>' + esc(euroCents(b.totali.trattenute)) + "</span><em>trattenute</em></div><i>−</i>"
    + '<div><span>' + esc(euroCents(b.totali.imposte)) + "</span><em>imposte</em></div><i>=</i>"
    + '<div class="netto"><span>' + esc(euroCents(b.totali.netto)) + "</span><em>netto che risulta dai conti</em></div>"
    + (b.netto_dichiarato !== b.totali.netto ? '<p class="scarto">Il documento scrive ' + esc(euroCents(b.netto_dichiarato))
        + " €: " + esc(euroCents(Math.abs(b.netto_dichiarato - b.totali.netto))) + " € di differenza.</p>" : "")
    + "</div>"
    + '<div class="ratei">'
    + '<div><span>' + esc(String(rt.permessi.maturato)) + " " + esc(rt.permessi.unita) + "</span><em>permessi maturati</em><i>" + esc(String(rt.permessi.residuo)) + " residui</i></div>"
    + '<div><span>' + esc(String(rt.ferie.maturato)) + " " + esc(rt.ferie.unita) + "</span><em>ferie maturate</em><i>" + esc(String(rt.ferie.residuo)) + " residue</i></div>"
    + (rt.mensilita ? '<div><span>' + rt.mensilita.maturate + " di " + rt.mensilita.di + "</span><em>ratei di tredicesima e quattordicesima</em></div>" : "")
    + "</div>";
}
function rigaBustaHTML(es, r) {
  const ann = es.righe.filter((x) => x.codice === r.codice)[0] || { stato: "non_verifico", testo: "", fonte: "documento" };
  const conto = r.calcolo || r.dettaglio || "voce a importo fisso, senza calcolo nel documento";
  return '<details class="voce"><summary>' + badgeEsame(ann.stato)
    + '<span class="voce-titolo">' + esc(r.titolo) + '<em class="voce-conto">' + esc(conto) + "</em></span>"
    + '<span class="voce-cod">' + esc(r.codice) + "</span>"
    + euroVisto(r.valore) + '<span class="chevron">' + icona("chevron-right") + "</span></summary>"
    + '<div class="voce-corpo"><p>' + esc(ann.testo) + '</p><p class="fonte">' + esc(ann.fonte) + "</p></div></details>";
}
function mancanoHTML(es) {
  if (!es.mancano.length) {
    return '<h3 class="sottosezione">Le voci che il contratto prevede e che nella busta mancano</h3>'
      + '<p class="vuoto">Nessuna voce attesa manca: tutto quello che questo contratto versa compare nel documento.</p>';
  }
  return '<h3 class="sottosezione">Quello che il contratto prevede e nella busta non c’è</h3>'
    + es.mancano.map((r) => '<details class="voce aperto-possibile" open><summary>' + badgeEsame(r.stato)
      + '<span class="voce-cod">' + esc(r.codice) + '</span><span class="voce-titolo">' + esc(r.titolo) + "</span>"
      + (r.euro_mese ? euroVisto(r.euro_mese) : "<span></span>") + '<span class="chevron">' + icona("chevron-right") + "</span></summary>"
      + '<div class="voce-corpo"><p>' + esc(r.testo) + "</p>"
      + (r.euro_anno ? '<p class="totino">' + esc(euroCents(r.euro_anno)) + " € in un anno</p>" : "")
      + '<p class="fonte">' + esc(r.fonte) + " · " + esc(r.chi) + "</p></div></details>").join("");
}
function cambioHTML(es) {
  if (!es.cambio.length) return "";
  return '<h3 class="sottosezione">Cosa cambia passando a ' + esc(nomeContratto(es.lettura)) + "</h3>"
    + es.cambio.map((r) => '<div class="conto neutro"><div><strong>' + esc(r.cosa) + "</strong><p>" + esc(r.testo)
      + '</p><p class="fonte">' + esc(r.fonte) + "</p></div></div>").join("");
}
function domandeHTML(p) {
  const suggested = DOMANDE_BASE.concat(DOMANDE_PERSONE[p.id] ? [DOMANDE_PERSONE[p.id]] : []);
  return '<h3 class="sottosezione">Chiedi qualcosa di questa busta</h3>'
    + '<p class="blocco-sottotitolo">Scrivi tu una domanda, o premi una di queste: l’app risponde solo con le voci che ha davanti e con le clausole che le governano.</p>'
    + '<div class="chip-domande">' + suggested.map((d) => '<button class="chip-domanda" data-domanda="' + esc(d) + '">' + esc(d) + "</button>").join("") + "</div>"
    + '<form class="domanda-form" id="form-domanda"><input id="campo-domanda" type="text" placeholder="perché gli hanno tolto 58,44 €?" autocomplete="off">'
    + '<button class="primario" type="submit">' + icona("arrow-right") + "</button></form>"
    + (statoApp.risposte.length ? statoApp.risposte.map(rispostaHTML).join("")
        + '<div class="azioni"><button class="link-pulito" id="pulisci-domande">pulisci le risposte</button></div>'
      : "")
    + '<p class="defs">Le ' + (statoApp.esame ? statoApp.esame.riepilogo.non_verificate : 0)
    + " voci che l'app non ha potuto controllare sono imposte, contributi INPS, gestioni interne e le cifre che dipendono dalla tabella dei minimi non caricata. "
    + "Su quelle l'app tace o chiede il documento: non inventa risposte.</p>";
}
function rispostaHTML(r) {
  const capo = '<p class="domanda-eco">' + icona("arrow-right") + "<span>" + esc(r.domanda) + "</span></p>"
    + (r.risposte.length > 1 ? "<h4>" + r.risposte.length + " risposte agganciate alla domanda</h4>" : "");
  const motore = r.risposte.map(function (x) {
    return '<div class="risposta-blocco"><h5>' + esc(x.titolo) + "</h5><ul>"
      + x.testo.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>"
      + (x.cita && x.cita.length ? '<p class="cita">voci del prospetto citate: '
          + x.cita.map((c) => '<span class="cod">' + esc(c) + "</span>").join(" ") + "</p>" : "")
      + "</div>";
  }).join("");
  let cima = "";
  if (r.attesa) {
    cima = '<p class="modello-attesa"><span class="spinner"></span> sto chiedendo anche al modello…</p>';
  } else if (r.modello) {
    const controllo = modelloAffidabile(r.modello);
    cima = controllo.ok
      ? '<div class="risposta-modello">' + paragrafi(r.modello.testo)
          + '<p class="modello-firma">' + icona("clock") + esc(modelloFirma(r.modello)) + " · " + esc(controllo.perche) + "</p></div>"
      : '<p class="avvertenza-modello">' + esc(controllo.perche) + ": non la mostro, sotto c'è la risposta del motore.</p>";
  } else if (r.errore) {
    cima = '<p class="avvertenza-modello">Il modello non ha risposto: ' + esc(r.errore)
      + ". Parla il motore deterministico.</p>";
  }
  return '<div class="risposta">' + capo + cima
    + (cima ? '<details class="passaggi-motore"><summary>i passaggi del motore, con le fonti</summary>' + motore + "</details>" : motore)
    + "</div>";
}

/* ---------- cosa succede davvero quando premi il pulsante ---------------- */
const FASI = [
  "I conti e le voci: gi\u00e0 rifatti dal motore deterministico",
  "Il modello legge il documento e scrive la lettura",
  "Controllo: ogni euro e ogni codice devono venire dal documento",
];
function faseAttuale(w) {
  if (Date.now() - w.inizio < 1200) return 1;
  return 2;
}
function lavorazioneHTML() {
  const w = statoApp.lavorazione;
  const secondi = Math.max(1, Math.round((Date.now() - w.inizio) / 1000));
  const stima = Math.max(secondi, 14);
  const fase = faseAttuale(w);
  return '<div class="blocco lavorazione" id="lavorazione"><h2>' + icona("sparkles")
    + " Sto leggendo la busta di " + esc(personaCorrente().nome) + "</h2>"
    + '<p class="blocco-sottotitolo">' + (modelloUsabile()
        ? "I numeri sono gi\u00e0 a posto: adesso " + nomeModello() + " legge e scrive."
        : "Sta rispondendo il motore deterministico.") + "</p>"
    + '<div class="lav-bar"><i style="width:' + Math.min(96, Math.round(secondi / stima * 100)) + '%"></i></div>'
    + '<ul class="lav-fasi">'
    + FASI.map(function (f, i) {
        const classe = i < fase ? "fatta" : i === fase ? "attiva" : "";
        const marcatore = i < fase ? icona("check") : i === fase ? '<span class="spinner"></span>' : icona("minus");
        return '<li class="' + classe + '">' + marcatore + esc(f) + "</li>";
      }).join("")
    + "</ul><p class=\"lav-conta\">passati " + secondi + "s \u00b7 il tempo vero della chiamata</p></div>";
}
function avviaEsame() {
  if (statoApp.lavorazione) return;
  const p = personaCorrente();
  if (!statoApp.verdetto) statoApp.verdetto = verdetto(p, statoApp.scelta);
  statoApp.risposte = [];
  /* i numeri prima di tutto: sono regole e arrivano subito, modello o no */
  statoApp.esame = esaminaBusta(p, statoApp.verdetto);
  statoApp.lettura = null;
  Store.esame(p.id, statoApp.esame);
  const scendi = function () {
    const nodo = $("esame");
    if (nodo) nodo.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (!modelloUsabile()) { statoApp.lavorazione = null; disegna(); scendi(); return; }
  statoApp.lavorazione = { inizio: Date.now(), timer: null, tick: null };
  disegna();
  const fine = function () {
    clearInterval(statoApp.lavorazione && statoApp.lavorazione.tick);
    statoApp.lavorazione = null;
  };
  modelloLegge().then(function (d) { fine(); statoApp.lettura = d; disegna(); scendi(); })
    .catch(function (e) { fine(); statoApp.lettura = { errore: String((e && e.message) || e) }; disegna(); scendi(); });
  statoApp.lavorazione.tick = setInterval(aggiornaLavorazione, 500);
}
function pulisciRisposte() { statoApp.risposte = []; disegna(); }
function poniDomanda(testo) {
  const p = personaCorrente();
  if (!statoApp.esame || !String(testo || "").trim()) return;
  const r = rispondi(p, statoApp.verdetto, statoApp.esame, testo);
  const voce = { domanda: testo, risposte: r.risposte || [r], titolo: r.titolo,
                 modello: null, attesa: modelloUsabile(), errore: null };
  statoApp.risposte.unshift(voce);
  disegna();
  const nodo = document.querySelector(".risposta");
  if (nodo) nodo.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!modelloUsabile()) return;
  modelloRispondi(testo)
    .then(function (d) { voce.attesa = false; voce.modello = d; disegna(); })
    .catch(function (e) { voce.attesa = false; voce.errore = String((e && e.message) || e); disegna(); });
}
function aggiornaLavorazione() {
  if (!statoApp.lavorazione) { clearInterval(statoApp.lavorazione && statoApp.lavorazione.tick); return; }
  const nodo = $("lavorazione");
  if (nodo) nodo.outerHTML = lavorazioneHTML();
}
function fermalavorazione() {
  const w = statoApp.lavorazione;
  if (!w) return;
  clearInterval(w.tick);
  statoApp.lavorazione = null;
}

/* ============================================================
   BLOCCO PER CHI VALUTA L'APP
   ============================================================ */
function valutatoreHTML() {
  return '<details class="blocco valutatore"><summary>Per chi deve valutare questa app: cosa è vero e cosa è simulato</summary>'
    + '<div class="valutatore-body"><table><tr><th>Dietro la schermata</th><th>Nell\'app vera</th><th>In questa demo</th></tr>'
    + "<tr><td>Leggere gli atti e il prospetto paga, voce per voce</td><td>estrazione guidata sul documento (PDF, OCR, modello di estrazione)</td><td>prospetto già scritto in js/busta.js, con i suoi codici voce: <strong>questo è il pezzo simulato</strong></td></tr>"
    + "<tr><td>Scrivere la lettura e rispondere alle domande</td><td>un modello della piattaforma, con le chiavi sul server</td><td><strong>modello vero</strong>: " + esc(nomeModello()) + " sul gateway Galene, chiamato da modello/server.py — la chiave non passa mai dal browser</td></tr>"
    + "<tr><td>Agganciare ogni voce di busta alla clausola che la genera</td><td>ricerca sulle clausole + inferenza vincolata, con la citazione dell'articolo</td><td>regole in js/esame.js: ogni riga ha il suo stato e la sua fonte</td></tr>"
    + "<tr><td>Trovare il contratto pertinente</td><td>ricerca nell'archivio CCNL (CNEL) sulle prove dell'attività svolta</td><td>archivio locale con tre contratti: E01H, H011, I100</td></tr>"
    + "<tr><td>Aprire le clausole che riguardano la persona</td><td>inferenza vincolata sul testo del contratto, con citazione dell'articolo</td><td>regole deterministiche in js/engine.js: nessun modello nel verdetto</td></tr>"
    + "<tr><td>Tenere la storia delle verifiche</td><td>database dell'app, una riga per posizione</td><td>memoria del browser</td></tr>"
    + "</table>"
    + "<p>L'esame della busta non inventa cifre: prende gli importi dal documento e le percentuali dalle clausole con la fonte. Dove la tabella manca (minimi tabellari, permessi della Logistica) lo scrive e non stima. "
    + "I valori contrattuali sono la versione caricata nell'archivio (snapshot 09/2025): "
    + "CCNL Industria Alimentare E01H, Terziario Distribuzione Servizi H011, Logistica Trasporto Merci e Spedizione I100. "
    + "Ogni rinnovo cambia le cifre: l'app vera riallinea l'archivio a ogni verbale depositato. "
    + "La lettura è scritta dal modello, non da un copione: parte solo dal pulsante, e ogni euro e ogni codice "
    + "che scrive vengono ricontrollati contro il documento — se non ci sono, l'app non la mostra. "
    + "Senza modello o senza rete risponde il motore deterministico e lo dice in testata.</p>"
    + "<p>Le due decisioni di progetto — tenant/ambiente target e registry delle immagini — sono aperte: le decide Sara prima di qualsiasi rilascio.</p>"
    + "</div></details>";
}

/* ============================================================
   GUIDA PRIMO AVVIO — tre passi, finisce sul pulsante
   ============================================================ */
const GUIDA = [
  { titolo: "Si parte dalla persona", testo: "Ogni riga è una posizione dell'archivio del personale. Apri quella che ti interessa.", porta: null },
  { titolo: "Prima i fatti, poi il documento", testo: "Attività svolta, livello e contratto in busta paga, con gli atti da cui risultano. Da lì si apre l'esame del prospetto.", porta: null },
  { titolo: "Da qui parte l'esame della busta", testo: "Quaranta secondi: l'app legge il prospetto voce per voce e dice cosa torna, cosa è applicato male e cosa manca.", porta: "avvia-esame" },
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
  b.innerText = ultimo ? "Apri l'esame di esempio" : "Continua";
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
  if (t) t.onclick = () => { chiudiEsame(); statoApp.vista = "elenco"; disegna(); };
  document.querySelectorAll("[data-apri]").forEach((b) => {
    b.onclick = () => apriPosizione(b.getAttribute("data-apri"));
  });
  const avvio = $("avvia-esame");
  if (avvio) avvio.onclick = avviaEsame;
  const riesame = $("rifai-esame");
  if (riesame) riesame.onclick = avviaEsame;
  const riprendi = $("riapri-esame");
  if (riprendi) riprendi.onclick = mostraEsamePrecedente;
  document.querySelectorAll("[data-domanda]").forEach((b) => {
    b.onclick = () => poniDomanda(b.getAttribute("data-domanda"));
  });
  const form = $("form-domanda");
  if (form) form.onsubmit = (ev) => {
    ev.preventDefault();
    const campo = $("campo-domanda");
    poniDomanda(campo.value);
    campo.value = "";
  };
  const pulisci = $("pulisci-domande");
  if (pulisci) pulisci.onclick = pulisciRisposte;
  document.querySelectorAll("[data-ccnl]").forEach((b) => {
    b.onclick = () => cambiaContratto(b.getAttribute("data-ccnl"));
  });
  const rg = $("riapri-guida");
  if (rg) rg.onclick = guidaApri;
  const skip = $("guida-salta");
  if (skip) skip.onclick = guidaChiudi;
}
function apriPosizione(id) {
  chiudiEsame();
  statoApp.personaId = id;
  statoApp.vista = "persona";
  statoApp.verdetto = verdetto(personaCorrente(), null);
  statoApp.scelta = statoApp.verdetto.scelta;
  disegna();
  window.scrollTo(0, 0);
  if (!NOTOUR && !Store.tourVisto()) setTimeout(guidaApri, 400);
  if (AUTO) setTimeout(avviaEsame, 200);
}
function chiudiEsame() {
  fermalavorazione();
  statoApp.verdetto = null;
  statoApp.esame = null;
  statoApp.risposte = [];
}
function mostraEsamePrecedente() {
  const f = Store.esameFatto(personaCorrente().id);
  if (!f) return;
  statoApp.verdetto = verdetto(personaCorrente(), f.lettura);
  statoApp.scelta = statoApp.verdetto.scelta;
  statoApp.esame = esaminaBusta(personaCorrente(), statoApp.verdetto);
  disegna();
  const nodo = $("esame");
  if (nodo) nodo.scrollIntoView({ behavior: "smooth", block: "start" });
}
function cambiaContratto(ccnlId) {
  const p = personaCorrente();
  statoApp.scelta = ccnlId;
  statoApp.verdetto = verdetto(p, ccnlId);
  statoApp.risposte = [];
  /* la stessa busta, letto sotto un altro contratto, dà altre risposte */
  if (statoApp.esame) statoApp.esame = esaminaBusta(p, statoApp.verdetto);
  disegna();
  const m = $("esame");
  if (m) m.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- primo avvio -------------------------------------------- */
function statoDaHash() { return (location.hash || "").replace("#", ""); }
/* stati pilotati da prova-stati.html e dalle catture */
const PRESETI = {
  elenco: () => {},
  persona: () => { statoApp.personaId = "pellizzari"; statoApp.vista = "persona"; },
  lavorazione: () => { statoApp.personaId = "pellizzari"; statoApp.vista = "persona"; statoApp.lavorazione = { inizio: Date.now() - 15000, fase: 1, timer: null, tick: null }; },
  cambio: () => { posa("bruni", "logistica"); esameSubito(); },
  busta: () => { posa("el_amrani"); esameSubito(); },
  domande: () => { posa("pellizzari", "terziario"); esameSubito(); poniDomandaSilenzioso("Il fondo pensione è versato?"); },
  anomalia: () => { posa("sartori", "logistica"); esameSubito(); },
  parttime: () => { posa("doumbia"); esameSubito(); poniDomandaSilenzioso("Come funziona il part-time?"); },
  pulito_esame: () => { posa("bruni"); esameSubito(); },
};
function posa(id, ccnl) {
  statoApp.personaId = id;
  statoApp.vista = "persona";
  statoApp.verdetto = verdetto(personaCorrente(), ccnl || null);
  statoApp.scelta = statoApp.verdetto.scelta;
}
/* per le catture e i test: l'esame c'è, l'attesa simulata no */
function esameSubito() {
  statoApp.esame = esaminaBusta(personaCorrente(), statoApp.verdetto);
}
function poniDomandaSilenzioso(testo) {
  const r = rispondi(personaCorrente(), statoApp.verdetto, statoApp.esame, testo);
  statoApp.risposte.push({ domanda: testo, risposte: r.risposte || [r], titolo: r.titolo });
}
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const preset = PRESETI[statoDaHash()];
    if (preset) preset();
    disegna();
    modelloControlla().then(function () { if (!statoApp.lavorazione) disegna(); });
    if (preset && statoApp.vista === "persona") {
      if (!NOTOUR && !Store.tourVisto() && !AUTO) setTimeout(guidaApri, 400);
      if (AUTO && !statoApp.esame) setTimeout(avviaEsame, 200);
    }
  });
}
