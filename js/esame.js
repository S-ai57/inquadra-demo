/* ==================================================================
   L'ESAME DELLA BUSTA — il pezzo che l'AI fa sul documento
   ------------------------------------------------------------------
   Entra la busta paga, escono:
   - ogni riga spiegata con la clausola che la genera (o il motivo per
     cui l'app non la può verificare);
   - le voci che il contratto prevede e nella busta non compaiono,
     con la cifra che manca quando l'archivio ce l'ha;
   - i conti rifatti a mano (netto, monte ore, quote dei fondi).
   Le imposte non si toccano: non sono materia di contratto.
   Nessuna cifra inventata: ogni euro qui dentro viene dal documento
   o da una clausola con la sua fonte.
   ================================================================== */

function euro(x) { return "€ " + euroCents(x); }
function pct(x) { return String(x).replace(".", ","); }
function ore(x) {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: true }).format(x);
}
function rigaDi(b, codice) {
  const t = b.righe.filter(function (r) { return r.codice === codice; });
  return t.length ? t[0] : null;
}
/* la clausola del contratto in lettura, e in seconda battuta quella di legge */
function clausolaDi(ist, ccnlId) {
  const c = clausoleDi(ccnlId).filter(function (x) { return x.ist === ist; })[0];
  if (c) return c;
  return CLAUSOLE_LEGGE.filter(function (x) { return x.ist === ist; })[0] || null;
}

/* ------------------------------------------------------------------
   L'esame. `v` è il verdetto già calcolato: serve il contratto scelto
   dall'operatore, perché la stessa busta letta sotto un contratto
   diverso dà risposte diverse.
   ------------------------------------------------------------------ */
function esaminaBusta(p, v, oggi) {
  const b = BUSTE[p.id];
  if (!b) return null;
  oggi = oggi || oggiISO();
  const lettura = v.scelta;
  const es = {
    persona: p.id, lettura: lettura, in_busta: p.ccnl_in_busta, busta: b,
    righe: [], mancano: [], conti: [], intestazione: [], cambio: []
  };
  const cl = function (ist) { return clausolaDi(ist, lettura); };
  const metti = function (codice, stato, testo, fonte) {
    es.righe.push({ codice: codice, stato: stato, testo: testo, fonte: fonte || "—" });
  };

  /* 1 — INTESTAZIONE: livello e contratto dichiarati */
  const liv = cl("inquadramento");
  const regLiv = (p.registri || {}).inquadramento;
  if (liv && regLiv && regLiv.esito !== "coperta") {
    es.intestazione.push({
      stato: regLiv.esito === "a_rischio" ? "anomalia" : "da_verificare",
      cosa: "Livello in busta: " + b.livello,
      testo: "Il livello scritto nella busta non è confermato dalle mansioni. " + regLiv.prova + ".",
      fonte: liv.fonte, chi: liv.chi
    });
  } else if (liv) {
    es.intestazione.push({ stato: "torna", cosa: "Livello in busta: " + b.livello, testo: "Le mansioni in anagrafica sono dello stesso livello.", fonte: liv.fonte, chi: "—" });
  }

  /* 2 — I CONTI: il netto, rifatto sulle righe del documento */
  const scarto = b.netto_dichiarato - b.totali.netto;
  if (scarto !== 0) {
    es.conti.push({
      stato: "anomalia", cosa: "Il netto non torna con la somma delle righe",
      testo: "Il prospetto scrive " + euro(b.netto_dichiarato) + ", le sue righe ne danno " + euro(b.totali.netto)
        + ": differenza " + euro(Math.abs(scarto)) + " " + (scarto > 0 ? "in più" : "in meno") + ".",
      fonte: "prospetto paga " + b.mese, chi: "Azienda (paga)"
    });
  }
  es.conti.push({
    stato: scarto === 0 ? "torna" : "da_verificare",
    cosa: "Come arriva il netto",
    testo: euro(b.totali.crediti) + " che spettano − " + euro(b.totali.trattenute) + " trattenute − "
      + euro(b.totali.imposte) + " imposte = " + euro(b.totali.netto) + ".",
    fonte: "prospetto paga " + b.mese, chi: "—"
  });

  /* 3 — OGNI RIGA DEL DOCUMENTO */
  b.righe.forEach(function (r) {
    const conto = r.calcolo ? " Il conto del documento: " + r.calcolo + " = " + euro(r.valore) + "." : "";
    switch (r.codice) {
      case "M10":
        metti("M10", "senza_tabella", "È la paga base: il contratto la prevede, e il conto del documento torna."
          + " La tariffa di " + dueEuro(b.tariffa) + " € l'ora però non la posso confrontare con il minimo tabellare del "
          + livelloCorto(p) + " livello: la tabella dei minimi di " + nomeCorto(lettura) + " non è nell'archivio."
          + " Chi la carica? " + (cl("inquadramento") ? cl("inquadramento").chi : "chi gestisce l'archivio contratti") + ".",
          "documento + archivio CCNL (tabella dei minimi assente)");
        break;
      case "M12":
        metti("M12", (p.flag || {}).notturno ? "torna" : "anomalia", "Indennità per chi turna: " + r.calcolo
          + ". Il suo turno: " + p.turni + ".", (cl("notturno") || {}).fonte || "documento");
        break;
      case "M30": {
        const c = cl("domenicale") || cl("notturno");
        metti("M30", (p.flag || {}).domenicale ? "torna" : "anomalia",
          "Maggiorazione per le ore lavorate in giorno festivo." + conto
            + ((p.flag || {}).domenicale ? " Negli orari risulta lavoro festivo." : " Negli orari suo non c'è lavoro festivo: la voce non si spiega."),
          c ? c.fonte : "documento");
        break;
      }
      case "M31": {
        const c = cl("notturno");
        metti("M31", (p.flag || {}).notturno ? "torna" : "anomalia",
          "Maggiorazione per le ore nella fascia notturna 23:00–06:00." + conto
            + " Negli atti dell'anno risultano " + ((p.conti || {}).notti_2026 || 0) + " notti."
            + (c && /tabella/.test(c.valore || "") ? " Le percentuali esatte sono nella tabella maggiorazioni del contratto, che non è nell'archivio." : ""),
          c ? c.fonte : "documento");
        break;
      }
      case "M40": {
        const c = cl("limite_stra");
        const ecc = (p.conti || {}).ore_eccedenti_4_mesi;
        metti("M40", ecc === undefined ? "non_verifico" : "torna",
          "Straordinario del mese." + conto + (ecc === undefined
            ? " Negli atti non c'è il conteggio delle ore eccedenti degli ultimi 4 mesi: il tetto di 48 ore medie non è verificabile."
            : " Negli atti ci sono " + ecc + " ore eccedenti su 4 mesi (" + dueEuro(ecc / 16) + " ore di media settimanale aggiunta): il tetto di 48 ore medie è rispettato."),
          c ? c.fonte : "documento");
        break;
      }
      case "M60": {
        const rateo = b.ratei.permessi;
        metti("M60", "torna", "Le ore di permesso godute questo mese sono pagate come ore lavorate." + conto
          + " Da inizio anno ne risultano usate " + rateo.usato + " su " + rateo.maturato + " maturate, ne restano " + rateo.residuo + ".",
          "prospetto paga " + b.mese);
        break;
      }
      case "M72": {
        const c = cl("cassa_denaro");
        metti("M72", c ? (/(tabella|allegata)/.test(c.valore || "") ? "senza_tabella" : "torna") : "estranea",
          c ? "Indennità per chi tiene il fondo cassa: la voce è prevista da questo contratto, ma la misura è nella tabella allegata, che non è nell'archivio."
            : "Questa voce non nasce dal contratto che stiamo leggendo: è l'indennità di maneggio denaro dell'art. 218 del Commercio. Che sia in questo prospetto è una prova in più che l'attività di vendita è gestita con un altro contratto.",
          c ? c.fonte : "CCNL Terziario art. 218");
        break;
      }
      case "M81": {
        const c = cl("diaria");
        metti("M81", c ? "da_verificare" : "non_verifico",
          c ? "Rimborso a piè di lista dei chilometri." + conto + " Il rimborso non è la diaria: la diaria è un importo fisso per giornata di uscita. Qui di diaria non c'è traccia, e le sue uscite sono "
            + ((p.conti || {}).uscite_settimana || 0) + " a settimana."
            : "Rimborso chilometrico a piè di lista: voce aziendale, non di contratto.",
          c ? c.fonte : "documento");
        break;
      }
      case "T00": case "T03": case "T04": case "D01":
        metti(r.codice, "non_verifico", r.titolo + ": imposta o conguaglio fiscale." + conto + " L'app non entra nel calcolo delle imposte: è materia del consulente o del CAF.", "fiscalità, fuori dal contratto");
        break;
      case "T01":
        metti("T01", "non_verifico", "Contributi INPS a suo carico." + conto + " L'aliquota la applica il software paghe: l'archivio dei contratti non la contiene.", "aliquota INPS dipendenti");
        break;
      case "T02": {
        const c = cl("fondo_pensione");
        const minimo = c ? c.carico_percento : null;
        const sua = rigaDi(b, "T02");
        const pct = sua ? Math.round(sua.valore / b.imponibile * 10000) / 100 : 0;
        metti("T02", !c ? "non_verifico" : (minimo && pct < minimo ? "anomalia" : "torna"),
          c ? "Quota di previdenza complementare trattenuta a lei: " + pct + " % della retribuzione. "
            + (minimo && pct < minimo ? "Sotto il minimo di " + minimo + " % previsto per far scattare la quota dell'azienda."
              : "Con questa quota il contratto obbliga l'azienda ad aggiungere la sua parte.")
          : "Trattenuta di previdenza complementare: il contratto letto non la disciplina.",
          c ? c.fonte : "documento");
        break;
      }
      case "T05": case "T06": case "T07":
        metti(r.codice, "non_verifico", r.titolo + ": " + (r.dettaglio || "gestione interna") + ". Non dipende dal contratto, ma da una richiesta o da un regolamento interno.", "documento");
        break;
      case "T08":
        metti("T08", "torna", "Trattenuta per le ore di assenza non coperte da permesso." + conto
          + " Il conto del documento torna; la decisione di trattenerle non arriva dal contratto.", "documento");
        break;
      case "A02": case "A03":
        metti(r.codice, "non_verifico", r.titolo + ": quota a carico dell'azienda, non passa dallo stipendio." + conto + " L'archivio non ha l'aliquota di questo ente, quindi non la controllo.", "documento");
        break;
      default:
        metti(r.codice, "non_verifico", r.titolo + "." + conto, "documento");
    }
  });

  /* 4 — LE VOCI CHE IL CONTRATTO PREVEDE E QUI NON CI SONO */
  const fp = cl("fondo_pensione");
  if (fp && fp.datoriale_percento && !rigaDi(b, "A04")) {
    const mese = Math.round(b.imponibile * fp.datoriale_percento / 100);
    es.mancano.push({
      codice: "A04", stato: "manca",
      titolo: fp.fondo_nome + ", quota dell'azienda (" + pct(fp.datoriale_percento) + " %)",
      testo: "Il contratto verserebbe " + euro(mese) + " al mese su questa retribuzione: " + euro(mese * 12)
        + " in un anno. Nel prospetto di " + b.mese + " questa voce non compare.",
      fonte: fp.fonte, chi: fp.chi, euro_mese: mese, euro_anno: mese * 12
    });
  }
  const fe = cl("fondo_est");
  if (fe && fe.azienda_euro_mese && !rigaDi(b, "A05")) {
    es.mancano.push({
      codice: "A05", stato: "manca",
      titolo: fe.fondo_nome + ", " + fe.azienda_euro_mese + " € al mese a carico dell'azienda",
      testo: "Sono " + euro(fe.azienda_euro_mese * 100) + " al mese, " + euro(fe.azienda_euro_mese * 1200)
        + " in un anno, più " + euro(fe.una_tantum * 100) + " una tantum alla prima iscrizione. Nel prospetto non c'è.",
      fonte: fe.fonte, chi: fe.chi, euro_mese: fe.azienda_euro_mese * 100, euro_anno: fe.azienda_euro_mese * 1200
    });
  }
  const di = cl("diaria");
  if (di && di.euro_giorno && (p.flag || {}).viaggiante && !rigaDi(b, "M80")) {
    const uscite = (p.conti || {}).uscite_settimana || 0;
    es.mancano.push({
      codice: "M80", stato: "da_verificare",
      titolo: "Diaria delle uscite fuori comune",
      testo: "Se l'attività è autotrasporto in conto terzi, la giornata fuori sede vale " + euro(di.euro_giorno * 100)
        + ": con " + uscite + " uscite a settimana sarebbero " + euro(Math.round(di.euro_giorno * 100 * uscite))
        + " a settimana. Nel prospetto c'è solo un rimborso chilometrico. Lo verifico del tutto quando il contratto è deciso.",
      fonte: di.fonte, chi: di.chi
    });
  }

  /* 5 — MONTE ORE PERMESSI: il confronto che si può fare al minuto */
  const pm = cl("permessi");
  const prop = cl("proporzione");
  const rateo = b.ratei.permessi;
  if (!pm || pm.ore_anno === undefined || pm.ore_anno === null) {
    es.mancano.push({
      codice: "F2", stato: "da_verificare", titolo: "Monte ore permessi dell'anno",
      testo: (pm && pm.mancante ? pm.mancante : "La tabella permessi di questo contratto non è nell'archivio.")
        + " Nella busta risultano " + rateo.maturato + " ore maturate: non ho la base per dire se sono giuste.",
      fonte: pm ? pm.fonte : "—", chi: pm ? pm.chi : "Chi gestisce l'archivio contratti"
    });
  } else {
    const frazione = (p.flag || {}).part_time ? p.ore / 40 : 1;
    const atteso = Math.round(pm.ore_anno * frazione * 100) / 100;
    if (atteso === rateo.maturato) {
      es.conti.push({
        stato: "torna", cosa: "Monte ore permessi dell'anno",
        testo: "Il contratto dà " + pm.ore_anno + " ore" + (frazione !== 1 ? ", proporzionate a " + p.ore + " ore su 40: " + ore(atteso) : "")
          + ". Il prospetto ne maturate " + rateo.maturato + ": torna.",
        fonte: pm.fonte + (frazione !== 1 && prop ? " + " + prop.fonte : ""), chi: "—"
      });
    } else {
      const delta = Math.round((atteso - rateo.maturato) * 100) / 100;
      es.mancano.push({
        codice: "F2", stato: "anomalia", titolo: "Monte ore permessi dell'anno",
        testo: "Nella busta risultano " + rateo.maturato + " ore maturate. " + pm.ore_anno
          + " ore di contratto" + (frazione !== 1 ? ", proporzionate a " + p.ore + " ore su 40, fanno " + ore(atteso)
            : " piene sono " + ore(atteso))
          + ": " + ore(Math.abs(delta)) + " ore " + (delta > 0 ? "in meno" : "in pi\u00f9") + ", pari a "
          + euro(Math.abs(Math.round(delta * b.tariffa * 100))) + " alla tariffa di questa busta.",
        fonte: pm.fonte + (frazione !== 1 && prop ? " + " + prop.fonte : ""), chi: (pm.chi || "Ufficio del personale")
      });
    }
  }

  /* 6 — COSA CAMBIA PASSANDO AL CONTRATTO LETTO */
  if (lettura !== p.ccnl_in_busta) {
    const oraB = clausolaDi("permessi", p.ccnl_in_busta);
    const favori = cl("favore");
    if (pm && oraB && pm.ore_anno && oraB.ore_anno && pm.ore_anno !== oraB.ore_anno) {
      es.cambio.push({
        cosa: "Permessi retribuiti",
        testo: "Oggi il prospetto segue " + nomeCorto(p.ccnl_in_busta) + " (" + oraB.ore_anno + " ore); con "
          + conArticolo(lettura) + " diventano " + pm.ore_anno + " ore.",
        fonte: pm.fonte
      });
    }
    const meB = clausolaDi("orario", p.ccnl_in_busta), meL = cl("orario");
    if (meL && meB && meL.valore !== meB.valore) {
      es.cambio.push({ cosa: "Orario normale", testo: "Cambia la base di calcolo delle ore: " + meL.valore, fonte: meL.fonte });
    }
    if (favori) {
      es.cambio.push({
        cosa: "Quello che l'altro contratto dava in più",
        testo: "Non si perde al passaggio (art. 2113 c.c.): prima di cambiare contratto va elencato per iscritto. "
          + "In questa busta l'indizio più chiaro è l'indennità di cassa, che il contratto in busta non prevederebbe.",
        fonte: favori.fonte
      });
    }
  }


  es.riepilogo = {
    righe: es.righe.length,
    anomalie: es.conti.concat(es.mancano).filter(function (r) { return r.stato === "anomalia"; }).length,
    mancano: es.mancano.filter(function (r) { return r.stato === "manca" || r.stato === "da_verificare"; }).length,
    non_verificate: es.righe.filter(function (r) { return r.stato === "non_verifico" || r.stato === "senza_tabella"; }).length,
    senza_tabella: es.righe.filter(function (r) { return r.stato === "senza_tabella"; }).length,
    estranee: es.righe.filter(function (r) { return r.stato === "estranea"; }).length,
    euro_mancanti: es.mancano.reduce(function (s, r) { return s + (r.euro_anno || 0); }, 0)
  };
  return es;
}

/* ==================================================================
   LE RISPOSTE — cosa risponde l'app a chi legge la busta
   ------------------------------------------------------------------
   La domanda arriva in linguaggio corrente; l'app la aggancia alle
   voci del prospetto e alle clausole, e risponde solo con quello che
   ha visto. Se non trova nulla, lo dice e chiede l'atto che manca.
   ================================================================== */
var INTENTI = [
  {
    chiavi: ["netto", "quanto prende", "quanto gli viene", "quanto le viene", "trattenute", "perche il netto", "perché il netto"],
    titolo: "Come arriva al netto del mese",
    costruisci: function (p, v, es) {
      const b = es.busta, sc = [];
      sc.push("Voci che le spettano: " + euro(b.totali.crediti) + ".");
      sc.push("Trattenute: " + euro(b.totali.trattenute) + ". Imposte dopo le detrazioni: " + euro(b.totali.imposte) + ".");
      sc.push("Netto: " + euro(b.totali.netto) + (b.netto_dichiarato !== b.totali.netto ? " — ma il foglio ne scrive " + euro(b.netto_dichiarato) : "."));
      const f = es.righe.filter(function (r) { return r.stato === "non_verifico" && /imposta|fisco|INPS/i.test(r.testo); });
      sc.push("Le " + f.length + " voci fiscali l'app non le verifica: sono calcolate dal software paghe, non dal contratto.");
      return { testo: sc, cita: ["M10", "T01", "T00", "D01"] };
    }
  },
  {
    chiavi: ["permesso", "rol", "ore residue", "restano", "ex festivit"],
    titolo: "Le ore di permesso dell'anno",
    costruisci: function (p, v, es) {
      const r = es.busta.ratei.permessi, sc = [];
      sc.push("Maturate da inizio anno: " + r.maturato + " " + r.unita + ". Godute: " + r.usato + ". Residue: " + r.residuo + ".");
      const ctr = es.conti.filter(function (x) { return /permessi/i.test(x.cosa); })[0];
      const ano = es.mancano.filter(function (x) { return x.codice === "F2"; })[0];
      if (ctr) sc.push(ctr.testo);
      if (ano) sc.push("⚠ " + ano.testo);
      sc.push("Le ore residue non si monetizzano: si godono entro il " + (Number(es.busta.mese.slice(0, 2)) > 6 ? "30 giugno dell'anno dopo" : "30 giugno di quest'anno") + " o si perde il monte ore extra.");
      return { testo: sc, cita: ["M60", "F2"] };
    }
  },
  {
    chiavi: ["pensione", "alifond", "fon.te", "fondo", "previdenza", "tfr"],
    titolo: "Previdenza complementare e TFR",
    costruisci: function (p, v, es) {
      const sc = [], sua = rigaDi(es.busta, "T02"), dat = rigaDi(es.busta, "A04");
      const manca = es.mancano.filter(function (x) { return x.codice === "A04"; })[0];
      if (sua) sc.push("In busta c'è la tua quota: " + euro(sua.valore) + " (" + sua.calcolo + ").");
      else sc.push("Nel prospetto non c'è nessuna quota di previdenza complementare a suo carico.");
      if (dat) sc.push("L'azienda versa la sua parte: " + euro(dat.valore) + " (" + dat.calcolo + ").");
      if (manca) sc.push("⚠ " + manca.testo + " — " + manca.chi + ".");
      const tfr = clausolaDi("tfr", es.lettura);
      if (tfr) {
        const r = (p.registri || {}).tfr;
        const come = r ? r.prova : "nessuna registrazione negli atti";
        sc.push(come.charAt(0).toUpperCase() + come.slice(1) + ". " + tfr.valore + " — " + tfr.fonte);
      }
      return { testo: sc, cita: ["T02", "A04"] };
    }
  },
  {
    chiavi: ["livello", "inquadramento", "mansioni", "qualified", "qfa"],
    titolo: "Il livello scritto in busta",
    costruisci: function (p, v, es) {
      const sc = ["La busta dice «" + es.busta.livello + "», sotto il contratto " + nomeContrattoTesto(es.lettura) + "."];
      const testa = es.intestazione[0];
      if (testa) sc.push(testa.testo);
      const c = clausolaDi("inquadramento", es.lettura);
      if (c) sc.push(c.valore + " — " + c.fonte);
      sc.push("Se l'inquadramento cambia, la lettera nuova la firma la persona: " + (c ? c.chi : "ufficio del personale") + " prepara l'atto.");
      return { testo: sc, cita: ["testa"] };
    }
  },
  {
    chiavi: ["tasse", "irpef", "addizionale", "detrazi", "fisco", "contributi inps"],
    titolo: "Le voci fiscali",
    costruisci: function (p, v, es) {
      const sc = [];
      const f = es.busta.righe.filter(function (r) { return r.tipo === "fiscale" || r.tipo === "credito_fiscale" || r.codice === "T01"; });
      sc.push("In questo prospetto ce ne sono " + f.length + ": " + f.map(function (r) { return r.titolo + " " + euro(r.valore); }).join(", ") + ".");
      sc.push("Non le verifico: dipendono dal reddito complessivo della persona, dalle detrazioni che ha dichiarato e dalle aliquote comunali. Su queste la risposta giusta la dà il consulente del lavoro, non il contratto.");
      return { testo: sc, cita: f.map(function (r) { return r.codice; }) };
    }
  },
  {
    chiavi: ["tredicesima", "quattordicesima", "13", "14", "mensilit"],
    titolo: "Le mensilità aggiuntive",
    costruisci: function (p, v, es) {
      const sc = [], m = es.busta.ratei.mensilita, c = clausolaDi("mensilita", es.lettura);
      if (m) sc.push("Ratei maturati a " + es.busta.mese + ": " + m.maturate + " su " + m.di + " di ciascuna mensilità.");
      if (c) sc.push(c.valore + " — " + c.fonte);
      return { testo: sc, cita: ["mensilita"] };
    }
  },
  {
    chiavi: ["ferie"],
    titolo: "Le ferie",
    costruisci: function (p, v, es) {
      const f = es.busta.ratei.ferie, c = clausolaDi("ferie", es.lettura), sc = [];
      sc.push("Maturate " + f.maturato + " " + f.unita + ", godute " + f.usato + ", residue " + f.residuo + ".");
      if (c) sc.push("Questo contratto ne prevede " + c.valore.toLowerCase() + " — " + c.fonte);
      sc.push("Le residue vanno programmate: il datore può collocarle, ma non oltre il 18 mesi della fine dell'anno di competenza (D.Lgs 66/2003 art. 10).");
      return { testo: sc, cita: ["F1"] };
    }
  },
  {
    chiavi: ["turno", "notte", "notturn", "festivo", "domenica", "ciclo continuo"],
    titolo: "Turni, notti e festivi in busta",
    costruisci: function (p, v, es) {
      const sc = ["Orario registrato: " + p.turni + "."];
      ["M12", "M30", "M31"].forEach(function (cod) {
        const r = rigaDi(es.busta, cod), a = es.righe.filter(function (x) { return x.codice === cod; })[0];
        if (r) sc.push(r.titolo + " " + euro(r.valore) + (r.calcolo ? " (" + r.calcolo + ")" : "") + (a ? " — " + a.testo : ""));
      });
      if (!rigaDi(es.busta, "M31") && (p.flag || {}).notturno) sc.push("Nessuna maggiorazione notturna in questo mese: i turni notturni ci sono stati, la voce manca o è in un altro mese.");
      const n = clausolaDi("notturno", es.lettura);
      if (n) sc.push(n.valore + " — " + n.fonte);
      return { testo: sc, cita: ["M12", "M30", "M31"] };
    }
  },
  {
    chiavi: ["straordinario", "eccedenti", "stra ", "supplementare"],
    titolo: "Straordinari e tetto delle ore",
    costruisci: function (p, v, es) {
      const sc = [], s = rigaDi(es.busta, "M40"), a = es.righe.filter(function (x) { return x.codice === "M40"; })[0];
      if (s) sc.push("Questo mese: " + euro(s.valore) + " (" + s.calcolo + ").");
      else sc.push("Questo mese nessuna ora eccedente in busta.");
      if (a) sc.push(a.testo);
      const c = clausolaDi("limite_stra", es.lettura);
      if (c) sc.push(c.valore + " — " + c.fonte);
      return { testo: sc, cita: ["M40"] };
    }
  },
  {
    chiavi: ["scatto", "anzianit"],
    titolo: "Scatti di anzianità",
    costruisci: function (p, v, es) {
      const sc = [], c = clausolaDi("scatti", es.lettura), anz = anzianita(p.dal, oggiISO());
      sc.push("Servizio dal " + dataISO(p.dal) + " (" + anz.anni + " anni e " + (anz.mesi % 12) + " mesi).");
      if (c) sc.push(c.valore + " — " + c.fonte);
      const r = (p.registri || {}).scatti;
      if (r) sc.push("Dagli atti: " + r.prova + ".");
      sc.push("La cifra esatta dello scatto si calcola sul minimo tabellare: la tabella dei minimi non è nell'archivio, quindi l'importo lo verifica il consulente.");
      return { testo: sc, cita: ["scatti"] };
    }
  },
  {
    chiavi: ["diaria", "trasferta", "chilometric", "chilometri", "uscita", "fuori comune"],
    titolo: "Trasferte e diaria",
    costruisci: function (p, v, es) {
      const sc = [], c = clausolaDi("diaria", es.lettura), m = es.mancano.filter(function (x) { return x.codice === "M80"; })[0];
      const r = rigaDi(es.busta, "M81");
      if (r) sc.push("Nel prospetto c'è «" + r.titolo + "» " + euro(r.valore) + ": è un rimborso a piè di lista, non una diaria.");
      if (m) sc.push(m.testo);
      if (c) sc.push(c.valore + " — " + c.fonte);
      if (!c) sc.push("Il contratto che stiamo leggendo non disciplina la diaria: per chi non esce dalla sede la domanda non si pone.");
      return { testo: sc, cita: ["M80", "M81"] };
    }
  },
  {
    chiavi: ["fondo est", "fasa", "eban", "ebt", "sanita", "bilaterale", "priamo", "ente"],
    titolo: "Fondi e enti di categoria",
    costruisci: function (p, v, es) {
      const sc = [];
      const az = es.busta.righe.filter(function (r) { return r.tipo === "azienda"; });
      if (az.length) sc.push("Quote a carico dell'azienda visibili nel prospetto: " + az.map(function (r) { return r.titolo + " " + euro(r.valore); }).join(", ") + ".");
      es.mancano.filter(function (x) { return /fondo|assistenza|ente/i.test(x.titolo); }).forEach(function (x) { sc.push("⚠ " + x.titolo + ": " + x.testo); });
      const fe = clausolaDi("fondo_est", es.lettura);
      if (fe) sc.push(fe.valore + " — " + fe.fonte);
      const ebt = clausolaDi("ebt", es.lettura);
      if (ebt) sc.push(ebt.valore + " — " + ebt.fonte);
      return { testo: sc, cita: az.map(function (r) { return r.codice; }) };
    }
  },
  {
    chiavi: ["tolto", "trattenuto", "trattenuta", "anticipo", "prestito", "rata", "buoni pasto", "assenza", "cedolino"],
    titolo: "Le trattenute che non vengono dal contratto",
    costruisci: function (p, v, es) {
      const sc = [];
      const inter = es.busta.righe.filter(function (r) { return ["T05", "T06", "T07", "T08"].indexOf(r.codice) >= 0; });
      if (!inter.length) return { testo: ["In questo prospetto non ci sono trattenute decise dall'azienda: solo contributi e imposte."], cita: [] };
      inter.forEach(function (r) {
        const a = es.righe.filter(function (x) { return x.codice === r.codice; })[0];
        sc.push(r.titolo + " " + euro(r.valore) + (r.dettaglio ? " (" + r.dettaglio + ")" : "") + (a ? " \u2014 " + a.testo : ""));
      });
      sc.push("Nessuna di queste dipende dal contratto collettivo: sono richieste della persona o regole interne. Se la domanda è sulla legittimità di una trattenuta, la risposta la firma il consulente del lavoro.");
      return { testo: sc, cita: inter.map(function (r) { return r.codice; }) };
    }
  },
  {
    chiavi: ["104", "disabilit", "familiare", "caregiver"],
    titolo: "Permessi legge 104",
    costruisci: function (p, v, es) {
      const sc = [], f = (p.flag || {}).ha104;
      if (f === true) sc.push("In anagrafica risulta una richiesta di permessi 104: 3 giorni al mese frazionabili anche in ore (art. 33 L. 104/1992).");
      else if (f === false) sc.push("Nessun familiare assistito risulta in anagrafica: i permessi 104 non la riguardano.");
      else sc.push("L'app non lo sa: l'anagrafica non dice se assista un familiare con disabilità grave. Non lo ipotizzo — serve una dichiarazione della persona, e la domanda va fatta a lei.");
      sc.push("In busta non c'è nessuna voce di permesso 104 questo mese.");
      return { testo: sc, cita: [] };
    }
  },
  {
    chiavi: ["termine", "proroga", "scadenza", "rinnovo del contratto", "a tempo determinato"],
    titolo: "Il contratto a termine",
    costruisci: function (p, v, es) {
      const sc = [], c = clausolaDi("durata_termine", es.lettura), r = (p.registri || {}).durata_termine;
      if (!(p.flag || {}).termine) return { testo: ["Il suo contratto è a tempo indeterminato: la domanda non si pone."], cita: [] };
      if (c) sc.push(c.valore + " — " + c.fonte);
      if (r) sc.push("Dagli atti: " + r.prova + ".");
      sc.push("Se il rapporto continua oltre il limite, il contratto si trasforma a tempo indeterminato: la data la decide il calendario, non la volontà delle parti.");
      return { testo: sc, cita: ["durata_termine"] };
    }
  },
  {
    chiavi: ["cassa", "maneggio", "indennita di cassa"],
    titolo: "L'indennità di cassa",
    costruisci: function (p, v, es) {
      const sc = [], r = rigaDi(es.busta, "M72"), a = es.righe.filter(function (x) { return x.codice === "M72"; })[0];
      if (!r) return { testo: ["Nel prospetto di " + es.busta.mese + " non c'è nessuna indennità di cassa."], cita: [] };
      sc.push("Nel prospetto c'è «" + r.titolo + "» " + euro(r.valore) + (r.dettaglio ? " (" + r.dettaglio + ")" : "") + ".");
      if (a) sc.push(a.testo);
      const c = clausolaDi("cassa_denaro", es.lettura);
      if (c) sc.push(c.valore + " — " + c.fonte);
      return { testo: sc, cita: ["M72"] };
    }
  },
  {
    chiavi: ["part-time", "part time", "24 ore", "elastiche", "flessibili", "verticale"],
    titolo: "Part-time: ore, flessibilità e proporzionalità",
    costruisci: function (p, v, es) {
      const sc = [], c = clausolaDi("part_time", es.lettura), pr = clausolaDi("proporzione", es.lettura);
      if (!(p.flag || {}).part_time) return { testo: ["Il suo contratto è a tempo pieno (" + p.ore + " ore): le regole del part-time non si applicano."], cita: [] };
      sc.push("Orario pattuito: " + p.ore + " ore settimanali. " + (p.turni ? "Registrazione: " + p.turni + "." : ""));
      if (c) sc.push(c.valore + " — " + c.fonte);
      if (pr) sc.push(pr.valore + " — " + pr.fonte);
      const ano = es.mancano.filter(function (x) { return x.codice === "F2"; })[0];
      if (ano) sc.push("⚠ " + ano.testo);
      return { testo: sc, cita: ["F2"] };
    }
  },
  {
    chiavi: ["anomal", "errore", "non torna", "sbagliato", "tutto a posto", "cosa manca", "problemi"],
    titolo: "Quello che l'esame ha trovato",
    costruisci: function (p, v, es) {
      const sc = [];
      const anomalie = es.conti.concat(es.mancano).filter(function (x) { return x.stato === "anomalia"; });
      const aperte = es.mancano.filter(function (x) { return x.stato !== "anomalia"; });
      if (!anomalie.length && !aperte.length) sc.push("Nessuna anomalia: le voci che l'app poteva confrontare tornano tutte.");
      anomalie.forEach(function (x) { sc.push("\u26a0 " + (x.cosa || x.titolo) + ": " + x.testo + " (" + x.fonte + ")"); });
      aperte.forEach(function (x) { sc.push(x.titolo + ": " + x.testo + " \u2014 " + x.chi); });
      sc.push("Le " + es.riepilogo.non_verificate + " voci che l'app non ha potuto controllare sono imposte, contributi INPS, gestioni interne e le cifre che dipendono dalla tabella dei minimi non caricata.");
      if (es.riepilogo.euro_mancanti) sc.push("Totale delle cifre annue che il contratto prevede e il prospetto non versa: " + euro(es.riepilogo.euro_mancanti) + ".");
      return { testo: sc, cita: [] };
    }
  },
];

/* la domanda in linguaggio corrente -> risposta con le voci citate */
function rispondi(p, v, es, domanda) {
  const t = String(domanda || "").toLowerCase().replace("\u00e8", "e").replace("\u00e0", "a").replace("\u00f9", "u");
  const colpite = INTENTI.filter(function (i) {
    return i.chiavi.some(function (k) { return t.indexOf(k) >= 0; });
  });
  /* la domanda cita una cifra o un codice voce? allora rispondi su quella riga */
  const cifra = (String(domanda || "").match(/\d+[.,]\d{2}/) || [null])[0];
  const codice = (String(domanda || "").match(/\b[MTADF]\d{2}\b/) || [null])[0];
  if (!colpite.length && (cifra || codice)) {
    const cercata = es.busta.righe.filter(function (r) {
      if (codice) return r.codice === codice.toUpperCase();
      const n = parseFloat(cifra.replace(/\./g, "").replace(",", ".")) * 100;
      return Math.abs(r.valore - n) < 1;
    });
    if (cercata.length) {
      const riga = cercata[0];
      const ann = es.righe.filter(function (x) { return x.codice === riga.codice; })[0];
      return {
        titolo: "La voce " + riga.codice + " — " + riga.titolo,
        risposte: [{ titolo: "La voce " + riga.codice, testo: [
          riga.titolo + ": " + euro(riga.valore) + (riga.calcolo ? " (" + riga.calcolo + ")" : "") + (riga.dettaglio ? " (" + riga.dettaglio + ")" : "") + ".",
          ann ? ann.testo : "Nessuna verifica applicabile a questa voce.",
          "Fonte: " + (ann ? ann.fonte : "documento") + "."
        ], cita: [riga.codice] }],
        agganciati: [riga.codice]
      };
    }
  }
  if (!colpite.length) {
    return {
      titolo: "Non ho trovato questa voce",
      testo: ["Nella domanda non c'è nessuna parola che io agganci al prospetto di " + es.busta.mese
        + ". Le voci che ho davanti sono: " + es.busta.righe.map(function (r) { return r.codice + " " + r.titolo; }).join(", ") + ".",
        "Se la domanda riguarda un importo preciso, scrivi il codice della voce (per esempio M72) o la cifra."],
      cita: [], agganciati: []
    };
  }
  const risposte = colpite.map(function (i) {
    const r = i.costruisci(p, v, es);
    r.titolo = i.titolo;
    return r;
  });
  return { titolo: risposte.length > 1 ? risposte.length + " risposte agganciate alla domanda" : risposte[0].titolo,
    risposte: risposte, agganciati: risposte.map(function (r) { return r.titolo; }) };
}
function nomeContrattoTesto(id) { return ARCHIVIO_CCNL[id].nome; }
