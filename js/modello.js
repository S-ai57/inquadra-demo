/* ------------------------------------------------------------------
   Il modello vero.
   Il browser non ha la chiave: chiede al micro-server locale (modello/server.py,
   stessa origine della pagina) di leggere la busta e di rispondere alle domande.
   Se il micro-server non c'\u00e8, o la chiave manca, o il modello scrive cifre che
   nel documento non ci sono, parla il motore deterministico e la schermata
   lo dice: nessuna risposta attribuita a un modello che non ha risposto.
   ------------------------------------------------------------------ */
const MODELLO = {
  stato: "non_ancora",   /* non_ancora | pronto | assente | errore */
  nome: null,
  base: null,
  ultima: null,          /* cosa ha detto l'ultima volta, con i suoi tempi */
};

/* ?noai=1 o ?senza-modello=1: la demo gira sul motore, per prove e screenshots.
   L'indirizzo lo legge da sé: questo file viene caricato prima di app.js e non
   può prendere in prestito niente da lì (una `const` mancante biancherebbe la
   pagina in `file://` senza dire niente) */
const QUERY_MODELLO = (typeof location !== "undefined" && location.search) || "";
const SENZA_MODELLO = /(^|[?&])(noai|senza-modello)=1/.test(QUERY_MODELLO);

/* Il link che si manda a un collega porta ?t=<token>: il micro-server lo vuole a
   ogni chiamata, così chi trova l'indirizzo non usa il modello di un altro.
   Resta in sessionStorage: serve anche dopo un salto a #esame o un riavvio. */
const TOKEN_LINK = (function () {
  const dalLink = /[?&]t=([A-Za-z0-9._-]+)/.exec(QUERY_MODELLO);
  try {
    if (dalLink) sessionStorage.setItem("inquadra.token", dalLink[1]);
    return sessionStorage.getItem("inquadra.token") || "";
  } catch (e) { return dalLink ? dalLink[1] : ""; }
})();

function intestazioniAPI(extra) {
  const h = Object.assign({ "Content-Type": "application/json" }, extra || {});
  if (TOKEN_LINK) h["X-Token"] = TOKEN_LINK;
  return h;
}

function modelloUsabile() { return !SENZA_MODELLO && MODELLO.stato === "pronto"; }

function unaVolta(percorso, corpo) {
  return new Promise(function (risolvi, rifiuta) {
    const c = new AbortController();
    const temporale = setTimeout(function () { c.abort(); }, 150000);
    fetch(percorso, {
      method: "POST",
      headers: intestazioniAPI(),
      body: JSON.stringify(Object.assign({ esame: statoApp.esame }, corpo || {})),
      signal: c.signal,
    }).then(function (r) {
      // un tunnel libero o un gateway incazzato rispondono a volte con una pagina
      // HTML: se non è JSON lo diciamo, non facciamo vedere "Unexpected token <"
      return r.text().then(function (testo) {
        clearTimeout(temporale);
        var d;
        try { d = JSON.parse(testo); }
        catch (e) {
          rifiuta(new Error(r.ok ? "il collegamento ha risposto senza dati (non è una risposta del micro-server)"
                                 : "il micro-server ha risposto " + r.ok + " " + r.status));
          return;
        }
        risolvi({ ok: r.ok, d: d });
      });
    }).catch(function (e) {
      clearTimeout(temporale);
      rifiuta(e.name === "AbortError" ? new Error("il modello non ha risposto entro 150 secondi") : e);
    });
  });
}

/* il modello a volte finisce il ragionamento senza scrivere, e i tunnel gratuiti
   ogni tanto inciampano: una seconda prova, poi si dice all'utente chi ha parlato */
function modelloChiamata(percorso, corpo) {
  if (SENZA_MODELLO) return Promise.reject(new Error("modello disattivato dal pulsante di prova"));
  return unaVolta(percorso, corpo).then(function (x) {
    if (x.ok && !x.d.errore) { MODELLO.ultima = x.d; return x.d; }
    return new Promise(function (r) { setTimeout(r, 1500); }).then(function () {
      return unaVolta(percorso, corpo);
    }).then(function (y) {
      if (y.ok && !y.d.errore) { MODELLO.ultima = y.d; return y.d; }
      var motivo = (y.d && y.d.errore) || (x.d && x.d.errore) || "il modello non ha risposto";
      throw new Error(motivo);
    });
  });
}

/* dice all'interfaccia se il modello c'\u00e8, prima di promettere chiss\u00e0 cosa */
function modelloControlla() {
  if (SENZA_MODELLO) { MODELLO.stato = "assente"; return Promise.resolve(MODELLO); }
  return fetch("/api/stato", { headers: intestazioniAPI({ Accept: "application/json" }) })
    .then(function (r) {
      // una pagina pubblica su GitHub non ha /api: risponde HTML, e quello vuol dire
      // "modello non collegato", non "sto ancora controllando"
      if (!r.ok) { MODELLO.stato = "assente"; return MODELLO; }
      return r.text().then(function (t) {
        var d;
        try { d = JSON.parse(t); } catch (e) { MODELLO.stato = "assente"; return MODELLO; }
        MODELLO.nome = d.modello; MODELLO.base = d.base;
        MODELLO.stato = d.token && !d.token_ammesso ? "senza_token"
                       : d.chiave ? "pronto" : "assente";
        return MODELLO;
      });
    })
    .catch(function () { MODELLO.stato = "assente"; return MODELLO; });
}

function modelloLegge() { return modelloChiamata("/api/leggi"); }
function modelloRispondi(domanda) { return modelloChiamata("/api/chiedi", { domanda: domanda }); }

/* ------------------------------------------------------------------
   quello che l'interfaccia mostra del modello
   ------------------------------------------------------------------ */
function modelloFirma(d) {
  if (!d) return "";
  const parti = ["scritto da " + (d.modello || "modello")];
  if (d.secondi != null) parti.push(d.secondi + " secondi");
  if (d.token) parti.push(d.token + " parole generate");
  return parti.join(" \u00b7 ");
}

/* la guardia: le cifre in euro devono venire dal documento, non dalla fantasia */
function modelloAffidabile(d) {
  if (!d || d.errore) return { ok: false, perche: "il modello non ha risposto" };
  if (d.cifre_fuori && d.cifre_fuori.length) {
    return { ok: false, perche: "il modello ha scritto cifre che nel documento non ci sono (" + d.cifre_fuori.slice(0, 4).join(", ") + ")" };
  }
  return { ok: true, perche: d.approssimazioni && d.approssimazioni.length
    ? "ogni importo e ogni codice vengono dal documento (cifre secche citate: " + d.approssimazioni.slice(0, 3).join(", ") + ", ore o percentuali)"
    : "cifre e codici tutti del documento" };
}
