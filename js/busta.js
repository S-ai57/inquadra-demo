/* ==================================================================
   LE BUSTE PAGA — il documento che l'app esamina
   ------------------------------------------------------------------
   Un prospetto di ottobre 2026 per ognuna delle 7 posizioni. Le cifre
   sono quelle del documento: la tariffa oraria è quella applicata
   dall'azienda, non un minimo tabellare (la tabella dei minimi non è
   nell'archivio, e il motore lo dice). Gli importi derivati sono
   calcolati da ore e aliquote perché la somma torni al centesimo.
   I codici voce (M10, T01, A01 …) sono quelli del software paghe.
   ================================================================== */

/* tutto in centesimi: le somme tornano senza errori di virgola */
function cent(euro) { return Math.round(euro * 100); }
function perOre(ore, tariffa, moltiplica) {
  return cent(ore * tariffa * (moltiplica === undefined ? 1 : moltiplica));
}
/* percentuale su un importo già in centesimi: niente doppio cent() */
function percentoDi(centi, percentuale) { return Math.round(centi * percentuale / 100); }

/* Le righe che il software paghe produce di solito. `tipo`:
   credito = cosa spetta · trattenuta = cosa viene tolto ·
   azienda = cosa versa l'azienda (non passa dallo stipendio) ·
   rateo = ore o giorni maturati, usati, residui · fiscale = imposta. */
function costruisciBusta(b) {
  const righe = [];
  /* `calcolo` è il conto scritto nel documento: serve a chi legge, non è una verifica */
  const aggiungi = function (codice, titolo, tipo, valore, unita, meta) {
    righe.push(Object.assign({ codice: codice, titolo: titolo, tipo: tipo, valore: valore, unita: unita || "" }, meta || {}));
  };

  aggiungi("M10", "Retribuzione base (P1°)", "credito", perOre(b.ore_base, b.tariffa), "euro",
    { calcolo: b.ore_base.toFixed(2).replace(".", ",") + " × " + dueEuro(b.tariffa) + " €" });
  if (b.indennita_turno) {
    aggiungi("M12", "Indennità di turno", "credito", cent(b.indennita_turno.giorni * b.indennita_turno.al_giorno), "euro", { calcolo: b.indennita_turno.giorni + " × " + dueEuro(b.indennita_turno.al_giorno) + " €" });
  }
  (b.maggiorazioni || []).forEach(function (m) {
    aggiungi(m.codice, m.titolo, "credito", perOre(m.ore, b.tariffa, m.moltiplica), "euro",
      { calcolo: m.ore + " × " + dueEuro(b.tariffa) + " € × " + String(m.moltiplica).replace(".", ",") });
  });
  if (b.permessi_goduti) {
    aggiungi("M60", "Permessi retribuiti goduti", "credito", perOre(b.permessi_goduti, b.tariffa), "euro",
      { calcolo: b.permessi_goduti + " × " + dueEuro(b.tariffa) + " €" });
  }
  (b.voci || []).forEach(function (v) {
    aggiungi(v.codice, v.titolo, "credito", cent(v.importo), "euro", { dettaglio: v.dettaglio });
  });

  var imponibile = righe.filter(function (r) { return r.tipo === "credito"; })
    .reduce(function (s, r) { return s + r.valore; }, 0);
  b.imponibile = imponibile;

  /* aliquota INPS IVS dipendenti: il motore la legge dal documento, non la verifica */
  aggiungi("T01", "Contributi IVS a tuo carico", "trattenuta", percentoDi(imponibile, 9.19), "euro",
    { calcolo: "9,19% × " + dueEuro(imponibile / 100) + " €" });
  if (b.fondo_pensione_carico) {
    aggiungi("T02", "Fondo pensione, quota tua", "trattenuta", percentoDi(imponibile, b.fondo_pensione_carico), "euro",
      { calcolo: String(b.fondo_pensione_carico).replace(".", ",") + "% × " + dueEuro(imponibile / 100) + " €" });
  }
  (b.trattenute || []).forEach(function (t) {
    aggiungi(t.codice, t.titolo, "trattenuta", cent(t.importo), "euro", { dettaglio: t.dettaglio });
  });
  if (b.irpef) aggiungi("T00", "IRPEF lorda", "fiscale", cent(b.irpef), "euro",
    { dettaglio: "calcolata dal software paghe sull'imponibile contributivo" });
  if (b.addizionale_regionale) aggiungi("T03", "Addizionale regionale", "fiscale", cent(b.addizionale_regionale), "euro");
  if (b.addizionale_comunale) aggiungi("T04", "Addizionale comunale", "fiscale", cent(b.addizionale_comunale), "euro");
  if (b.detrazioni) aggiungi("D01", "Detrazioni da lavoro dipendente", "credito_fiscale", cent(b.detrazioni), "euro");

  (b.azienda || []).forEach(function (a) {
    var valore = a.percento ? percentoDi(imponibile, a.percento) : cent(a.importo);
    aggiungi(a.codice, a.titolo, "azienda", valore, "euro",
      { calcolo: a.percento ? String(a.percento).replace(".", ",") + "% × " + dueEuro(imponibile / 100) + " €" : dueEuro(a.importo) + " € al mese" });
  });

  var crediti = righe.filter(function (r) { return r.tipo === "credito"; }).reduce(function (s, r) { return s + r.valore; }, 0);
  var trattenute = righe.filter(function (r) { return r.tipo === "trattenuta"; }).reduce(function (s, r) { return s + r.valore; }, 0);
  var imposte = righe.filter(function (r) { return r.tipo === "fiscale"; }).reduce(function (s, r) { return s + r.valore; }, 0)
    - righe.filter(function (r) { return r.tipo === "credito_fiscale"; }).reduce(function (s, r) { return s + r.valore; }, 0);

  return {
    persona: b.persona, mese: b.mese,
    /* il netto scritto in fondo al documento: può non tornare con la somma delle righe */
    netto_dichiarato: crediti - trattenute - imposte + cent(b.scarto || 0), imponibile: imponibile,
    ccnl_dichiarato: b.ccnl, livello: b.livello,
    ore_settimana: b.ore, tariffa: b.tariffa, ore_base: b.ore_base,
    righe: righe,
    totali: {
      crediti: crediti, trattenute: trattenute, imposte: imposte,
      netto: crediti - trattenute - imposte, azienda: righe.filter(function (r) { return r.tipo === "azienda"; }).reduce(function (s, r) { return s + r.valore; }, 0)
    },
    ratei: b.ratei, note: b.note || []
  };
}

/* stampa in euro con il separatore delle migliaia sempre attivo */
function dueEuro(x) {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true, minimumGroupingDigits: 1 }).format(x);
}
function euroCents(c) { return dueEuro(c / 100); }

/* ------------------------------------------------------------------
   Le 7 buste. Ogni cifra che il motore confronta con il contratto ha
   la sua fonte nell'archivio; le imposte no, e il motore lo dice.
   ------------------------------------------------------------------ */
var BUSTE = {
  el_amrani: costruisciBusta({
    persona: "el_amrani", irpef: 420, mese: "ottobre 2026", ccnl: "alimentari", livello: "3° — operaio specializzato",
    ore: 40, tariffa: 10.21, ore_base: 168,
    indennita_turno: { giorni: 21, al_giorno: 7.5 },
    maggiorazioni: [
      { codice: "M30", titolo: "Maggiorazione lavoro festivo", ore: 16, moltiplica: 1.5 },
      { codice: "M31", titolo: "Maggiorazione lavoro notturno", ore: 24, moltiplica: 1.3 },
      { codice: "M40", titolo: "Straordinario al 25%", ore: 12, moltiplica: 1.25 },
    ],
    permessi_goduti: 9,
    /* nessuna quota T02: Alifond non risulta, è la clausola aperta della posizione */
    trattenute: [{ codice: "T05", titolo: "Rata prestito su stipendio", importo: 120, dettaglio: "cessione del quinto in corso" }],
    addizionale_regionale: 38.4, addizionale_comunale: 14.2, detrazioni: 168.6,
    azienda: [
      { codice: "A03", titolo: "FASA, assistenza sanitaria", importo: 24.4 },
      { codice: "A02", titolo: "EBAN, ente bilaterale alimentare", percento: 0.1 },
      /* A04 assente di proposito: la quota datoriale Alifond non è versata */
    ],
    ratei: { mensilita: { maturate: 10, di: 12 },
      ferie: { maturato: 22, usato: 14, residuo: 8, unita: "giorni" },
      permessi: { maturato: 108, usato: 71, residuo: 37, unita: "ore" },
    },
  }),

  pellizzari: costruisciBusta({
    persona: "pellizzari", irpef: 300, mese: "ottobre 2026", ccnl: "alimentari", livello: "4° — operaio qualificato",
    ore: 40, tariffa: 9.74, ore_base: 168,
    maggiorazioni: [{ codice: "M30", titolo: "Maggiorazione lavoro festivo", ore: 8, moltiplica: 1.5 }],
    permessi_goduti: 9,
    /* la voce nasce dal Terziario (art. 218): è l'indizio che lo spaccio è gestito con un altro contratto */
    voci: [{ codice: "M72", titolo: "Indennità di cassa", importo: 88, dettaglio: "2,00 € × 44 aperture al pubblico · voce che il contratto in busta non prevede" }],
    trattenute: [],
    addizionale_regionale: 34.1, addizionale_comunale: 12.6, detrazioni: 154.2,
    azienda: [
      { codice: "A03", titolo: "FASA, assistenza sanitaria", importo: 24.4 },
      { codice: "A02", titolo: "EBAN, ente bilaterale alimentare", percento: 0.1 },
    ],
    ratei: { mensilita: { maturate: 10, di: 12 },
      ferie: { maturato: 22, usato: 10, residuo: 12, unita: "giorni" },
      /* 108 ore = monte ore degli Alimentaristi: con il Commercio sarebbero 104 */
      permessi: { maturato: 108, usato: 54, residuo: 54, unita: "ore" },
    },
  }),

  ferrante: costruisciBusta({
    persona: "ferrante", irpef: 340, mese: "ottobre 2026", ccnl: "alimentari", livello: "3°A — specialista HACCP",
    ore: 40, tariffa: 11.35, ore_base: 168,
    maggiorazioni: [{ codice: "M40", titolo: "Straordinario al 25%", ore: 8, moltiplica: 1.25 }],
    permessi_goduti: 9,
    trattenute: [{ codice: "T06", titolo: "Rimborso buoni pasto utilizzati", importo: 15.4, dettaglio: "14 buoni da 1,10 € a tuo carico" }],
    addizionale_regionale: 52.8, addizionale_comunale: 19.4, detrazioni: 142.3,
    azienda: [
      { codice: "A04", titolo: "Alifond, quota datoriale", percento: 1.2 },
      { codice: "A03", titolo: "FASA, assistenza sanitaria", importo: 24.4 },
      { codice: "A02", titolo: "EBAN, ente bilaterale alimentare", percento: 0.1 },
    ],
    fondo_pensione_carico: 0.55,
    ratei: { mensilita: { maturate: 10, di: 12 },
      ferie: { maturato: 22, usato: 16, residuo: 6, unita: "giorni" },
      permessi: { maturato: 108, usato: 62, residuo: 46, unita: "ore" },
    },
  }),

  sartori: costruisciBusta({
    persona: "sartori", irpef: 320, mese: "ottobre 2026", scarto: -12, ccnl: "alimentari", livello: "3° — operaio specializzato",
    ore: 40, tariffa: 9.88, ore_base: 168,
    maggiorazioni: [{ codice: "M40", titolo: "Straordinario al 25%", ore: 14, moltiplica: 1.25 }],
    permessi_goduti: 9,
    /* il guidatore esce 4 giorni su 5 fuori comune: nel prospetto non c'è né diaria né trasferta */
    voci: [{ codice: "M81", titolo: "Rimborso chilometrico", importo: 96.2, dettaglio: "a piè di lista, 4 uscite · non è diaria" }],
    trattenute: [{ codice: "T07", titolo: "Anticipo su stipendio", importo: 200, dettaglio: "richiesto il 12/10/2026" }],
    addizionale_regionale: 41.7, addizionale_comunale: 15.1, detrazioni: 158.9,
    azienda: [
      { codice: "A03", titolo: "FASA, assistenza sanitaria", importo: 24.4 },
      { codice: "A02", titolo: "EBAN, ente bilaterale alimentare", percento: 0.1 },
    ],
    ratei: { mensilita: { maturate: 10, di: 12 },
      ferie: { maturato: 22, usato: 8, residuo: 14, unita: "giorni" },
      permessi: { maturato: 108, usato: 40, residuo: 68, unita: "ore" },
    },
  }),

  bruni: costruisciBusta({
    persona: "bruni", irpef: 470, mese: "ottobre 2026", ccnl: "alimentari", livello: "2° — impiego amministrativo",
    ore: 40, tariffa: 12.6, ore_base: 168,
    permessi_goduti: 9,
    trattenute: [],
    addizionale_regionale: 68.2, addizionale_comunale: 24.8, detrazioni: 121.5,
    fondo_pensione_carico: 0.55,
    azienda: [
      { codice: "A04", titolo: "Alifond, quota datoriale", percento: 1.2 },
      { codice: "A03", titolo: "FASA, assistenza sanitaria", importo: 24.4 },
      { codice: "A02", titolo: "EBAN, ente bilaterale alimentare", percento: 0.1 },
    ],
    ratei: { mensilita: { maturate: 10, di: 12 },
      ferie: { maturato: 22, usato: 18, residuo: 4, unita: "giorni" },
      permessi: { maturato: 108, usato: 88, residuo: 20, unita: "ore" },
    },
  }),

  doumbia: costruisciBusta({
    persona: "doumbia", irpef: 130, mese: "ottobre 2026", ccnl: "alimentari", livello: "4° — operaio qualificato",
    ore: 24, tariffa: 9.74, ore_base: 100.8,
    maggiorazioni: [{ codice: "M40", titolo: "Straordinario al 25%", ore: 6, moltiplica: 1.25 }],
    /* 9 ore godute: l'azienda usa lo stesso conteggio del tempo pieno */
    permessi_goduti: 9,
    trattenute: [],
    addizionale_regionale: 21.6, addizionale_comunale: 8.4, detrazioni: 96.7,
    azienda: [
      { codice: "A03", titolo: "FASA, assistenza sanitaria", importo: 24.4 },
      { codice: "A02", titolo: "EBAN, ente bilaterale alimentare", percento: 0.1 },
    ],
    ratei: { mensilita: { maturate: 10, di: 12 },
      ferie: { maturato: 13.2, usato: 6, residuo: 7.2, unita: "giorni" },
      /* il software paghe divide le ore lavorate su 12 mesi: vengono 54 ore,
         mentre 108 × 24/40 ne darebbe 64,80 */
      permessi: { maturato: 54, usato: 41, residuo: 13, unita: "ore" },
    },
  }),

  moretti: costruisciBusta({
    persona: "moretti", irpef: 290, mese: "ottobre 2026", ccnl: "alimentari", livello: "4° — operaio qualificato",
    ore: 40, tariffa: 9.74, ore_base: 168,
    maggiorazioni: [{ codice: "M40", titolo: "Straordinario al 25%", ore: 10, moltiplica: 1.25 }],
    permessi_goduti: 9,
    trattenute: [{ codice: "T08", titolo: "Trattenuta per assenza ingiustificata", importo: 58.44, dettaglio: "6 ore non coperte da permesso" }],
    addizionale_regionale: 33.9, addizionale_comunale: 13.2, detrazioni: 149.8,
    azienda: [
      { codice: "A03", titolo: "FASA, assistenza sanitaria", importo: 24.4 },
      { codice: "A02", titolo: "EBAN, ente bilaterale alimentare", percento: 0.1 },
    ],
    ratei: { mensilita: { maturate: 10, di: 12 },
      ferie: { maturato: 22, usato: 9, residuo: 13, unita: "giorni" },
      permessi: { maturato: 108, usato: 44, residuo: 64, unita: "ore" },
    },
  }),
};

/* Le domande che l'ufficio del personale fa davvero, in testa alla schermata.
   Le prime quattro valgono per tutti, l'ultima è della posizione aperta. */
var DOMANDE_BASE = [
  "Come arriva a questo netto?",
  "Quante ore di permesso gli restano quest'anno?",
  "Il fondo pensione è versato?",
  "Il livello in busta paga è quello giusto?",
];
var DOMANDE_PERSONE = {
  el_amrani: "Perché non vede l'Alifond in busta?",
  pellizzari: "Cos'è l'indennità di cassa in questa busta?",
  ferrante: "Lo scatto di anzianità c'è?",
  sartori: "La diaria delle trasferte dove è?",
  bruni: "C'è qualcosa che non torna?",
  doumbia: "Perché i permessi sono calcolati su 40 ore?",
  moretti: "Perché gli hanno tolto 58,44 €?",
};
