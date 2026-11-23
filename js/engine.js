/* ------------------------------------------------------------------
   Motore di Inquadra — regole deterministiche, versione 1.0
   Stessa posizione + stesso archivio => stesso verdetto. Nessuna rete.
   Il motore fa due cose sole:
     1) cerca a quale contratto portano le prove dell'attivita' svolta;
     2) per un contratto scelto, decide quali clausole riguardano la
        persona e come risultano applicate.
   Sotto la soglia di aderenza il motore NON propone: rimanda a una
   persona. Dove manca il dato dice che manca, non lo stima.
   ------------------------------------------------------------------ */

var VERSIONE_REGOLE = "regole v1.0 — archivio snapshot 09/2025";

/* --- date ---------------------------------------------------------- */
function oggiISO() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function pad(x) { return String(x).padStart(2, "0"); }

function dataISO(iso) {
  const p = String(iso).split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function aggiungiAnni(iso, n) {
  const p = String(iso).split("-").map(Number);
  const d = new Date(p[0] + n, p[1] - 1, p[2], 12);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function aggiungiMesi(iso, n) {
  const p = String(iso).split("-").map(Number);
  const d = new Date(p[0], p[1] - 1 + n, p[2], 12);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/* Anzianita' al giorno d'oggi, in anni compieti e mesi totali. */
function anzianita(dal, oggi) {
  oggi = oggi || oggiISO();
  const a = dal.split("-").map(Number), b = oggi.split("-").map(Number);
  let anni = b[0] - a[0];
  let mesi = anni * 12 + (b[1] - a[1]);
  if (b[2] < a[2]) mesi -= 1;
  if (mesi < 0) mesi = 0;
  anni = Math.floor(mesi / 12);
  return { anni: anni, mesi: mesi, giorni: Math.max(0, mesi * 30) };
}

/* ==================================================================
   1) QUALE CONTRATTO: le prove dell'attivita' svolta contro
      il campo di applicazione di ogni contratto dell'archivio.
   ================================================================== */
/* come l'ufficio del personale chiama il contratto a voce */
function nomeCorto(ccnlId) { return ARCHIVIO_CCNL[ccnlId].nome_corto; }
function conArticolo(ccnlId) {
  const a = ARCHIVIO_CCNL[ccnlId].articolo, n = ARCHIVIO_CCNL[ccnlId].nome_corto;
  return /[\u2019']$/.test(a) ? a + n : a + " " + n;
}
/* "a" + articolo, pronto da incollare: al Commercio, alla Logistica, all’Alimentaristi */
function acontratto(ccnlId) {
  const a = ARCHIVIO_CCNL[ccnlId].articolo;
  return a === "il" ? "al " : a === "la" ? "alla " : "all’";
}
function livelloCorto(p) { return String(p.livello).split(" — ")[0]; }

function aderenza(p, ccnlId) {
  const ccnl = ARCHIVIO_CCNL[ccnlId];
  const prove = (p.prove && p.prove[ccnlId]) || { si: [], manca: [] };
  let pesoTot = 0, pesoSi = 0, pesoManca = 0;
  const criteri = ccnl.criteri.map((c) => {
    pesoTot += c.peso;
    let statoC = "no";
    if (prove.si.indexOf(c.id) >= 0) { statoC = "si"; pesoSi += c.peso; }
    else if (prove.manca.indexOf(c.id) >= 0) { statoC = "manca"; pesoManca += c.peso; }
    return { id: c.id, testo: c.testo, peso: c.peso, fonte: c.fonte, stato: statoC };
  });
  return {
    ccnlId: ccnlId,
    nome: ccnl.nome,
    codice: ccnl.codice,
    punteggio: Math.round((pesoSi / pesoTot) * 100) / 100,
    potenziale: Math.round(((pesoSi + pesoManca) / pesoTot) * 100) / 100,
    criteri: criteri,
    pesi: { totale: pesoTot, trovati: pesoSi, mancanti: pesoManca },
  };
}

function candidati(p) {
  return Object.keys(ARCHIVIO_CCNL)
    .map((id) => aderenza(p, id))
    .sort((x, y) => (y.punteggio - x.punteggio) || (y.potenziale - x.potenziale) || x.nome.localeCompare(y.nome));
}

/* Il consiglio c'e' solo se il primo passa la soglia e stacca il
   secondo. Altrimenti il motore si ferma e lo dice. */
function consiglio(p) {
  const c = candidati(p);
  const primo = c[0], secondo = c[1] || { punteggio: 0 };
  const motivo = [];
  if (primo.punteggio < SOGLIA_ADRENZA) {
    motivo.push(conArticolo(primo.ccnlId) + " si ferma a " + due(primo.punteggio) + " e la soglia per proporre è " + due(SOGLIA_ADRENZA));
    return { ccnlId: null, blocca: "soglia", candidati: c, motivo: motivo.join("; ") };
  }
  if (primo.punteggio - secondo.punteggio < SOGLIA_DISTACCO) {
    motivo.push(conArticolo(secondo.ccnlId) + " è a " + due(secondo.punteggio) + ", distanza sotto " + due(SOGLIA_DISTACCO));
    return { ccnlId: null, blocca: "distanza", candidati: c, motivo: motivo.join("; ") };
  }
  return { ccnlId: primo.ccnlId, blocca: null, candidati: c, motivo: "aderenza " + due(primo.punteggio) + ", il secondo è a " + due(secondo.punteggio) };
}

/* sempre due decimali: 0,85 - 0,05 - 0,00, non "0" accanto a "0,05" */
function due(x) { return x.toFixed(2).replace(".", ","); }

/* ==================================================================
   2) QUALI CLAUSOLE RIGUARDANO LA PERSONA
   ================================================================== */
var PROVA_MESI = { alimentari: 3, logistica: 3, terziario: 3 };
function mesiProva(p, ccnlId) {
  if (ccnlId !== "alimentari") return PROVA_MESI[ccnlId] || 3;
  return /Quadro|1°/.test(p.livello) ? 6 : 3;
}

/* Per ogni clausola: la riga dice se la persona la riguarda e perche'. */
function pertinenza(cl, p, ccnlId, sceltaId, oggi) {
  const f = p.flag || {};
  const anz = anzianita(p.dal, oggi);
  const ist = cl.ist;

  if (ist === "notturno" && !f.notturno)
    return no("Non lavora nella fascia 23:00–06:00: il suo turno è " + p.turni + ".");
  if (ist === "domenicale" && !f.domenicale)
    return no("Non lavora di domenica: il suo orario non prevede aperture festive.");
  if (ist === "cassa_denaro" && !f.cassa)
    return no("Non ha la firma di cassa né il fondo cassa.");
  if (ist === "diaria" && !f.viaggiante)
    return no("Non è personale viaggiante: non esce dalla sede per lavoro.");
  if (ist === "part_time" && !f.part_time)
    return no("Il suo contratto è a tempo pieno (" + p.ore + " ore).");
  if (ist === "supplementari" && !f.part_time)
    return no("Le ore supplementari esistono solo nel part-time.");
  if (ist === "proporzione" && !f.part_time)
    return no("Lavora a tempo pieno: la proporzionalità dei ratei non si pone.");
  if (ist === "durata_termine" && !f.termine)
    return no("Il suo contratto è a tempo indeterminato.");
  if (ist === "termine_tetto" && !f.termine)
    return no("Riguarda i contratti a termine: il suo non lo è.");
  if (ist === "limite_stra" && !f.stra)
    return no("Nel 2026 non ha ore eccedenti: il tetto non la tocca.");
  if (ist === "agile" && !f.agile)
    return no("Lavora sempre in sede: il lavoro agile non è in atto.");
  if (ist === "permessi_104") {
    if (f.ha104 === true) return si("Risulta una richiesta di permessi legge 104 in archivio.");
    if (f.ha104 === false) return no("Nessun familiare risulta assistito: l'ha dichiarato in anagrafica.");
    return null; /* dato assente: diventa "da verificare" */
  }
  if (ist === "scatti") {
    if (anz.anni < 3)
      return no("Nessun triennio chiuso: il primo scatto arriva il " + dataISO(aggiungiAnni(p.dal, 3)) + ".");
    return si(anz.anni + " anni di servizio: " + Math.min(5, Math.floor(anz.anni / 3)) + " scatti maturati su un massimo di 5.");
  }
  if (ist === "prova") {
    const m = mesiProva(p, sceltaId || ccnlId);
    if (anz.mesi > m)
      return no("La prova si è chiusa il " + dataISO(aggiungiMesi(p.dal, m)) + ".");
    return si("È dentro i " + m + " mesi di prova del contratto.");
  }
  if (ist === "favore") {
    if (sceltaId && sceltaId !== p.ccnl_in_busta)
      return si("Sta cambiando contratto: quello che l'altro contratto dava in più non si perde.");
    return no("Il contratto scelto è quello già in busta paga: nessun passaggio da presidiare.");
  }
  return si(null); /* clausola che riguarda chiunque, in questo contratto */
}
function si(perche) { return { pertinente: true, perche: perche }; }
function no(perche) { return { pertinente: false, perche: perche }; }

/* Esito della singola clausola per questa persona. */
function statoClausola(cl, p, sceltaId, ccnlId, oggi) {
  const per = pertinenza(cl, p, ccnlId, sceltaId, oggi);
  const base = {
    ist: cl.ist, titolo: cl.titolo, cosa: cl.cosa, fonte: cl.fonte,
    valore: cl.valore, azione: cl.azione, chi: cl.chi,
  };

  /* pertinenza non decidibile: il dato anagrafico manca */
  if (!per) {
    base.stato = "da_verificare";
    base.perche = (p.mancanti || {})[cl.ist] || "L'anagrafica non ha questo dato: il motore non ipotizza.";
    base.prova = null;
    base.azione = "Chiedere il dato alla persona e registrarlo in anagrafica.";
    base.chi = "Ufficio del personale";
    return base;
  }

  if (!per.pertinente) {
    base.stato = "non_pertinente";
    base.perche = per.perche;
    return base;
  }

  /* pertinente: se il valore non è nell'archivio, il motore si ferma */
  if (!cl.valore) {
    base.stato = "da_verificare";
    base.perche = cl.mancante || "L'archivio non ha questa tabella.";
    return base;
  }

  const perche = per.perche
    ? per.perche
    : percheStandard(cl, p, oggi);

  const reg = (p.registri || {})[cl.ist];
  const manca = (p.mancanti || {})[cl.ist];
  if (reg) {
    base.stato = reg.esito;
    base.perche = perche;
    base.prova = reg.prova;
    if (base.stato !== "coperta") {
      base.azione = reg.azione || (base.stato === "a_rischio"
        ? "Riprendere l'applicazione di questa clausola sulla base di quanto risulta in archivio."
        : "Attivare la clausola e registrare la prova in archivio.");
      base.chi = reg.chi || "Ufficio del personale, con il consulente";
    }
    if (base.stato === "coperta" && sceltaId !== p.ccnl_in_busta && PASSAGGIO.indexOf(cl.ist) >= 0)
      base.passaggio = "Il conteggio che vedi arriva dall'altro contratto: qui cambia il nome dell'istituto, non le ore.";
    return base;
  }
  if (manca) {
    base.stato = "da_verificare";
    base.perche = manca;
    base.prova = null;
    base.azione = "Recuperare il documento che chiude il dubbio, poi ricalcolare.";
    base.chi = "Ufficio del personale";
    return base;
  }
  if (sceltaId !== p.ccnl_in_busta) {
    base.stato = "da_verificare";
    base.perche = "Questa clausola arriva da un contratto diverso da quello in busta paga: l'archivio non ha ancora una registrazione per questa posizione.";
    base.prova = null;
    base.azione = "Verificarla a voce (o per iscritto) prima di passare a questo contratto.";
    base.chi = "Ufficio del personale, con il consulente";
    base.esterno = true;
    return base;
  }
  base.stato = "da_verificare";
  base.perche = "L'archivio non ha nessuna registrazione per questa clausola: il motore non ipotizza.";
  base.prova = null;
  base.azione = "Registrare come è applicata oggi questa clausola.";
  base.chi = "Ufficio del personale";
  base.senza_registro = true;
  return base;
}

/* Istituti il cui conteggio dipende dal contratto applicato */
var PASSAGGIO = ["permessi", "ferie", "orario", "mensilita", "festivita", "inquadramento"];

function percheStandard(cl, p, oggi) {
  const anz = anzianita(p.dal, oggi);
  const f = p.flag || {};
  switch (cl.ist) {
    case "inquadramento": return "Riguarda tutti: il livello è scritto in busta paga (" + p.livello + ").";
    case "orario": return "Riguarda tutti: il suo orario pattuito è di " + p.ore + " ore settimanali.";
    case "notturno": return "Lavora su turni con la notte: " + p.turni + ".";
    case "domenicale": return "Lavora anche la domenica: " + p.turni + ".";
    case "permessi": return "Riguarda tutti i dipendenti dell'azienda.";
    case "ferie": return "Riguarda tutti: " + anz.anni + " anni di servizio, maturazione piena.";
    case "mensilita": return "Riguarda tutti: contratto con " + (anz.mesi >= 12 ? "anno intero maturato" : "maturazione in dodicesimi") + ".";
    case "scatti": {
      const n = Math.min(5, Math.floor(anz.anni / 3));
      return anz.anni + " anni di servizio: " + n + (n === 1 ? " scatto maturato" : " scatti maturati") + ".";
    }
    case "cassa_denaro": return "Ha la firma di cassa e il fondo cassa tra le sue mansioni.";
    case "diaria": return "È personale viaggiante: " + p.turni + ".";
    case "favore": return "Cambia contratto: le condizioni in più restano.";
    case "fondo_pensione":
    case "sanita":
    case "ebt": return "Il contributo segue il contratto applicato a questa posizione.";
    case "part_time": return "Il suo contratto è part-time a " + p.ore + " ore.";
    case "supplementari": return "Part-time con ore oltre l'orario pattuito registrate nel 2026.";
    case "durata_termine": return "Il suo contratto è a tempo determinato: " + anz.mesi + " mesi di rapporto.";
    case "termine_tetto": return "Contratto a termine in un comparto con tetto numerico.";
    case "permessi_104": return "Risulta una richiesta di permessi legge 104.";
    case "agile": return "Lavora da casa: l'accordo individuale è obbligatorio.";
    case "prova": return "Dentro il periodo di prova del contratto.";
    case "limite_stra": return "Nel 2026 ha ore eccedenti registrate.";
    default: return "Riguarda tutti i dipendenti di questo contratto.";
  }
}

/* Mappa completa: tutte le clausole del contratto + quelle di legge. */
function mappaClausole(p, sceltaId, oggi) {
  oggi = oggi || oggiISO();
  const righe = clausoleDi(sceltaId).map((cl) => statoClausola(cl, p, sceltaId, p.ccnl_in_busta, oggi));
  return righe;
}

function conteggio(righe) {
  const n = { totale: righe.length, pertinenti: 0, coperta: 0, da_attivare: 0, a_rischio: 0, non_pertinente: 0, da_verificare: 0 };
  righe.forEach((r) => {
    n[r.stato] = (n[r.stato] || 0) + 1;
    if (r.stato !== "non_pertinente") n.pertinenti += 1;
  });
  return n;
}

/* Cosa resta aperto: la riga che il verdetto conta. */
function aperture(righe) {
  return righe.filter((r) => r.stato === "da_attivare" || r.stato === "a_rischio");
}

/* ==================================================================
   VERDETTO — una frase, con scritto chi ci resta
   ================================================================== */
function verdetto(p, sceltaId, oggi) {
  oggi = oggi || oggiISO();
  const cons = consiglio(p);
  const scelta = sceltaId || (cons.ccnlId ? cons.ccnlId : p.ccnl_in_busta);
  const righe = mappaClausole(p, scelta, oggi);
  const n = conteggio(righe);
  const aperto = aperture(righe); /* il numero sta nelle pill, non nella frase */
  const nomeC = nomeCorto(scelta);
  const nomeB = nomeCorto(p.ccnl_in_busta);
  const inquadra = righe.filter((r) => r.ist === "inquadramento")[0];

  let stato, frase, chi;
  if (!cons.ccnlId) {
    stato = "decide_una_persona";
    frase = "Per " + p.nome + " il contratto non lo decide l'app: " + cons.motivo + ".";
    chi = "tocca all'ufficio del personale con il consulente, sui documenti che mancano";
  } else if (scelta !== p.ccnl_in_busta) {
    stato = "ccnl_non_pertinente";
    frase = "Per " + p.nome + " l'attività svolta porta " + acontratto(scelta) + nomeC
      + ", non " + acontratto(p.ccnl_in_busta) + nomeB + " che è in busta paga.";
    chi = "il passaggio lo firma l'azienda, e le condizioni in più restano alla persona";
  } else if (inquadra && inquadra.stato === "a_rischio") {
    stato = "inquadramento_da_riallineare";
    frase = "Per " + p.nome + " il contratto è quello giusto, il livello " + livelloCorto(p) + " no: "
      + (inquadra.prova ? inquadra.prova : "le mansioni non corrispondono") + ".";
    chi = "decide l'ufficio del personale con il consulente del lavoro";
  } else if (righe.some((r) => r.stato === "a_rischio")) {
    stato = "clausole_a_rischio";
    const r = righe.filter((x) => x.stato === "a_rischio");
    frase = "Per " + p.nome + " il contratto è quello giusto, ma la clausola «" + r[0].titolo.toLowerCase()
      + "» è applicata male.";
    chi = "riordinare l'applicazione tocca all'azienda, non alla persona";
  } else if (righe.some((r) => r.stato === "da_attivare")) {
    stato = "clausole_da_attivare";
    const r = righe.filter((x) => x.stato === "da_attivare");
    frase = "Per " + p.nome + " il contratto è quello giusto, ma la clausola «" + r[0].titolo.toLowerCase()
      + "» spetta e non è mai stata applicata.";
    chi = "la quota che apre la clausola è a carico dell'azienda";
  } else {
    stato = "in_regola";
    frase = "Per " + p.nome + " il contratto è quello giusto e tutte le clausole che lo riguardano risultano applicate.";
    chi = "niente da decidere oggi";
  }

  return {
    stato: stato, frase: frase, chi: chi, nome_corto: nomeC, articolo: ARCHIVIO_CCNL[scelta].articolo,
    scelta: scelta, scelto_dalla_persona: !!sceltaId && sceltaId !== (cons.ccnlId || p.ccnl_in_busta),
    consiglio: cons, righe: righe, numeri: n, aperte: aperto.length,
    soglie: { aderenza: SOGLIA_ADRENZA, distacco: SOGLIA_DISTACCO },
  };
}

/* singolare e plurale: "una clausola" / "3 clausole" */
function conto(n, parolaSing, parolaPlur, maschile) {
  if (n === 1) return (maschile ? "un " : "una ") + parolaSing;
  const plur = parolaPlur || (parolaSing === "attività" ? parolaSing
    : /a$/.test(parolaSing) ? parolaSing.slice(0, -1) + "e" : parolaSing + "i");
  return n + " " + plur;
}

/* Nota per il consulente: l'oggetto che l'app produce, solo con
   dati e fonti che stanno già nella posizione. */
function notaConsulente(p, v) {
  const righe = v.righe.filter((r) => r.stato === "da_attivare" || r.stato === "a_rischio" || r.stato === "da_verificare");
  const L = [];
  L.push("Oggetto: posizione di " + p.nome + " — " + p.ruolo + ".");
  L.push("Contratto in busta paga: " + ARCHIVIO_CCNL[p.ccnl_in_busta].nome + " (" + ARCHIVIO_CCNL[p.ccnl_in_busta].codice + ", " + ARCHIVIO_CCNL[p.ccnl_in_busta].vigenza + ").");
  if (v.consiglio.ccnlId && v.scelta !== p.ccnl_in_busta) {
    L.push("Contratto che l'app propone per l'attività svolta: " + ARCHIVIO_CCNL[v.scelta].nome + " (" + ARCHIVIO_CCNL[v.scelta].codice + "), aderenza " + due(v.consiglio.candidati[0].punteggio) + ".");
    L.push("Prima del passaggio: elenco scritto delle condizioni di miglior favore (art. 2113 c.c.).");
  }
  if (!v.consiglio.ccnlId) {
    L.push("L'app non propone nessun contratto: " + v.consiglio.motivo);
    Object.keys(p.mancanti || {}).forEach((k) => { if (p.mancanti[k]) L.push("Documento che manca: " + p.mancanti[k]); });
  }
  L.push("");
  L.push("Clausole aperte (" + righe.length + "):");
  righe.forEach((r, i) => {
    L.push((i + 1) + ". " + r.titolo + " — " + STATI_CLAUSOLA[r.stato].parola + ". Fonte: " + r.fonte + ".");
    if (r.prova) L.push("   Cosa risulta: " + r.prova + ".");
    if (r.valore) L.push("   Cosa prevede: " + r.valore);
    if (r.azione && r.azione !== "Nessuna.") L.push("   Da fare: " + r.azione + " (" + r.chi + ").");
  });
  if (!righe.length) L.push("Nessuna clausola aperta. Verificare solo i dati che mancano all'anagrafica.");
  L.push("");
  L.push("Verdetto: " + v.frase);
  L.push(VERSIONE_REGOLE);
  return L.join("\n");
}

if (typeof module !== "undefined") {
  module.exports = {
    anzianita, aderenza, candidati, consiglio, mappaClausole, conteggio, nomeCorto, conArticolo, acontratto, livelloCorto,
    verdetto, notaConsulente, aperture, oggiISO, due, conto,
  };
}
