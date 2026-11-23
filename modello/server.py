#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Micro-server locale di Inquadra.

Fa due cose, e solo dentro il Mac (127.0.0.1):
  1. serve i file della demo (come `python3 -m http.server`);
  2. fa da tramite verso il modello Galene, perche\u00f9 la chiave NON pu\u00f2 finire nel
     JavaScript che il browser scarica.

Il modello \u00e8 lo stesso che usa Hermes: stesso gateway, stessa variabile d'ambiente.
La chiave viene letta a ogni chiamata dall'ambiente o da ~/.hermes/.env, cos\u00ec se
ruota non c'\u00e8 nulla da riscrivere qui. Non viene mai scritta da nessun'altra parte,
mai stampata, mai mandata al browser.

Senza chiave o senza rete l'app non si rompe: risponde il motore deterministico,
e la schermata lo dice.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

CARTELLA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def leggi_env():
    """`.env` nella cartella della demo: lì stanno il token del link condiviso e,
    se uno vuole, la propria chiave. Il file è nel .gitignore: non esce dal Mac."""
    valori = {}
    try:
        with open(os.path.join(CARTELLA, ".env"), encoding="utf-8") as f:
            for riga in f:
                m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$", riga)
                if m:
                    valori[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    except OSError:
        pass
    return valori


ENV = leggi_env()


def variabile(nome, di_default=""):
    return (os.environ.get(nome) or ENV.get(nome) or di_default).strip()


PORTA = int(variabile("INQUADRA_PORTA", "8791"))
BASE = variabile("GALENE_BASE_URL", "https://models.galene.ai/v1")
MODELLO = variabile("GALENE_MODELLO", "Galene/DeepSeek-V4-Flash")
# il link condiviso: senza token in `?t=` il modello non si tocca (statico, no)
TOKEN_LINK = variabile("INQUADRA_TOKEN") or variabile("DEMO_TOKEN")
FONTI_CHIAVE = [
    os.path.expanduser("~/.hermes/.env"),
    os.path.expanduser("~/.config/inquadra/galene.env"),
]

# ------------------------------------------------------------------ la chiave
def chiave():
    """prende la chiave dall'ambiente o dal .env della cartella, poi dai file di
    config noti (se ruota, non c'è niente da riscrivere qui)."""
    k = variabile("LITELLM_EXT_API_KEY") or variabile("AI_API_KEY")
    if k:
        return k
    for path in FONTI_CHIAVE:
        try:
            with open(path, encoding="utf-8") as f:
                for riga in f:
                    if riga.strip().startswith("LITELLM_EXT_API_KEY"):
                        return riga.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            continue
    return ""

# ------------------------------------------------------------- cosa \u00e8 lecito dire
NUMERO = re.compile(r"\d+(?:\.\d{3})*(?:,\d+)?")
CODICE = re.compile(r"\b[A-Z]{1,3}\d{1,4}\b")

def euro(centesimi):
    """8800 centesimi written the way a payslip writes them: 88,00"""
    v = int(centesimi)
    return "%s,%02d" % ("{:,}".format(v // 100).replace(",", "."), v % 100)


def varianti(n):
    """Le stesse cifre scritte in modi diversi: 8800 centesimi sono 88,00 euro,
    e 1.928,86 è 1928.86. Senza questa conversione la guardia segnala come
    invenzione quella che è solo una conversione."""
    out = {n}
    puro = n.replace(".", "").replace(",", ".")
    try:
        v = float(puro)
    except ValueError:
        return out
    out.add(puro)
    if v == 0:
        out.update({"0", "0,00", "0.00"})
    if "." not in n and "," not in n and v >= 100:
        out.add(euro(v))
        out.add(euro(v).replace(",", "."))
    return out

def numeri_nel_dato(cosa, fuori):
    """ogni numero che sta davvero nel documento, anche annidato: gli importi in
    centesimi valgono anche scritti in euro"""
    if isinstance(cosa, dict):
        for v in cosa.values():
            numeri_nel_dato(v, fuori)
    elif isinstance(cosa, (list, tuple)):
        for v in cosa:
            numeri_nel_dato(v, fuori)
    elif isinstance(cosa, int) and not isinstance(cosa, bool):
        fuori.add(str(cosa))
        if cosa == 0:
            fuori.update({"0", "0,00", "0.00"})
        if cosa >= 100:
            fuori.add(euro(cosa))
            fuori.add(euro(cosa).replace(",", "."))
    elif isinstance(cosa, float):
        fuori.add(("%g" % cosa))


def cifre_permesse(testo_json, dati=None):
    """tutte le cifre e i codici che stanno davvero nel documento: il modello non
    pu\u00f2 scriverne altre, e questo viene controllato dopo, non solo chiesto."""
    permessi = set()
    for n in NUMERO.findall(testo_json):
        permessi |= varianti(n)
    if dati is not None:
        numeri_nel_dato(dati, permessi)
    for c in CODICE.findall(testo_json):
        permessi.add(c)
    return permessi

def cifre_fuori(testo, permessi):
    """I numeri che il modello ha scritto e che nel documento non ci sono.

    Gli importi in euro sono affermazioni sui soldi: se non vengono dal documento
    sono invenzioni, e l'app non le mostra. Le cifre secche (ore, giorni,
    percentuali) finiscono in `approssimazioni`: il modello le rigira, non le crea,
    e trattarle come errori peggiorerebbe le cose."""
    fuori, appross = [], []
    for n in NUMERO.findall(testo):
        if varianti(n) & permessi:
            continue
        soldi = ("," in n) or ("." in n) or len(n.replace(".", "")) >= 4
        (fuori if soldi else appross).append(n)
    for c in CODICE.findall(testo):
        if c not in permessi:
            fuori.append(c)
    return fuori, appross

# ------------------------------------------------------------------- i prompt
RUOLO = (
    "Sei l'assistente dell'ufficio del personale di un'azienda. Hai davanti SOLO i dati "
    "di una busta paga gi\u00e0 estratti e le clausole del contratto sotto cui \u00e8 letta.\n"
    "Regole dure: non inventare niente. Non scrivere cifre, percentuali, date, codici voce "
    "o nomi di enti che non compaiono nel JSON che ti do. Se un dato manca, dillo con una "
    "frase: \u00abnel documento non c'\u00e8\u00bb. Non dare pareri legali e non citare articoli "
    "che non sono nel JSON: dici cosa risulta dal documento e cosa chiede il contratto.\n"
    "Scrivi in italiano sobrio, da collega a collega: niente markdown, niente titoli, niente "
    "elenchi con i pallini: quattro punti separati da a capo, **non pi\u00f9 di 28 parole per punto**. "
    "Nomina le voci come sono scritte nel documento, senza ripetere i codici. "
    "Accanto a ogni cifra scrivi sempre l'unit\u00e0: \u00ab4 ore in pi\u00f9, 38,96 \u20ac\u00bb, non \u00ab4, 38,96\u00bb. "
    "Quando ripeti un conto del documento, dedicagli una riga: \u00ab8 ore \u00d7 9,74 \u20ac \u00d7 1,5 = 116,88 \u20ac\u00bb. "
    "Non inventare totali: non sommare e non sottrarre cifre fra loro. Se un totale non è "
    "scritto nei dati che ti do, non scriverlo: di\u00b4 quali voci si compone. "
    "Non trasformare i moltiplicatori in percentuali: dove il documento scrive «× 1,5» "
    "scrivi «× 1,5», non «50 per cento\u00bb."
)

def sintesi(dati):
    """Le quattro cose che contano, scritte bene prima del JSON: il modello deve
    partire da qui, non perdersi in undici righe di oggetti annidati."""
    d = dati.get("documento") or {}
    r = dati.get("riepilogo") or {}
    fuori = [v.get("voce") for v in dati.get("voci") or [] if v.get("esito") == "anomalia"]
    mancanti = [m.get("titolo") for m in dati.get("mancano") or []]
    tariffa = d.get("tariffa_oraria_centesimi")
    anno = r.get("euro_mancanti") or 0
    mese = dati.get("quota_mancante_al_mese_centesimi") or 0
    return (
        "SINTESI DEI FATTI (\u00e8 questa la realt\u00e0, il JSON sotto \u00e8 il dettaglio; "
        "le cifre in euro sono gi\u00e0 scritte come stanno nel documento):\n"
        "- documento: %s, livello %s, %s ore settimanali, tariffa %s \u20ac l'ora\n"
        "- contratto dichiarato nel documento: %s; contratto sotto cui \u00e8 letta: %s\n"
        "- voci che non tornano: %s\n"
        "- voci che il contratto prevede e il documento non versa: %s\n"
        "- riepilogo: %s voci, %s da recuperare, %s fuori dal contratto\n\n"
    ) % (d.get("mese"), d.get("livello"), d.get("ore_settimana"),
         euro(tariffa) if isinstance(tariffa, int) else tariffa,
         d.get("contratto_dichiarato"), d.get("contratto_sotto_cui_si_legge"),
         "; ".join([x for x in fuori if x]) or "nessuna",
         ("%s (%s \u20ac l\u2019anno, %s \u20ac al mese)"
          % ("; ".join([x for x in mancanti if x]) or "nessuna", euro(anno), euro(mese))),
         r.get("righe"), r.get("mancano"), r.get("non_verificate"))


def prompt_legtura(dati):
    return (
        sintesi(dati) +
        "Busta paga e suo esame, in JSON:\n" + json.dumps(dati, ensure_ascii=False) + "\n\n"
        "Scrivi la lettura per chi governa questa posizione: quattro punti, uno per riga, "
        "senza numerarli e senza titoli.\n"
        "Cosa torna e perch\u00e9.\n"
        "Cosa non torna, e chi deve decidere.\n"
        "Cosa prevede il contratto e nel documento non viene versato, con la cifra gi\u00e0 scritta.\n"
        "Cosa serve ancora (un atto, una tabella) per chiudere il discorso.\n"
        "Nei dati qui sopra la risposta c'\u00e8 gi\u00e0: non dire che non la trovi. "
        "Usa solo numeri gi\u00e0 scritti."
    )

def prompt_domanda(domanda, dati):
    return (
        sintesi(dati) +
        "Domanda di chi sta leggendo la busta: \u00ab" + domanda + "\u00bb\n\n"
        "Busta paga e suo esame, in JSON:\n" + json.dumps(dati, ensure_ascii=False) + "\n\n"
        "Rispondi alla domanda con le cifre e le voci che hai davanti, massimo cinque righe. "
        "Cerca la risposta nelle voci, nei conti e nelle note dell'esame prima di dire che "
        "manca: \u00abnel documento non c'è\u00bb si scrive solo dopo aver guardato tutto."
    )

def testo_da_risposta(risposta):
    """Il testo, da qualunque forma abbia la risposta. è il punto dove un gateway
    capriccioso ha fatto morire il server in passato: `content` arriva anche `None`
    (il modello ha ragionato e non ha scritto), o manca proprio la scelta."""
    try:
        scelta = (risposta.get("choices") or [{}])[0]
        messaggio = scelta.get("message") or {}
        return (messaggio.get("content") or "").strip()
    except (AttributeError, IndexError, TypeError):
        return ""


# ------------------------------------------------------------ chiamata al modello
# Scala di prova misurata sul gateway (busta da 11-13 voci, prompt con la sintesi):
#   reasoning_effort "none"  → 1,4-2,6 secondi, testo scritto, cifre tutte sue dal documento
#   reasoning_effort "low"   → 20-22 secondi, e in 2 prove su 3 il testo NON arrivava
#   senza il campo           → 51 secondi, ragionamento 17.000 caratteri, testo vuoto
# I conti li fa il motore deterministico, quindi qui il "pena" è tempo buttato: si
# parte da "none" e si risale solo se il modello non scrive niente.
SFORZO_BASE = "none"
SCALA = [("none", 2600), ("none", 4000), ("low", 7000)]


def modello_chiama(messaggi, temperatura=0.25, max_tokens=None, riprova=True, sforzo=SFORZO_BASE):
    k = chiave()
    if not k:
        return {"errore": "chiave non trovata", "modello": MODELLO}
    corpo = json.dumps({
        "model": MODELLO,
        "messages": [{"role": "system", "content": RUOLO}] + messaggi,
        "temperature": temperatura,
        "max_tokens": max_tokens or SCALA[0][1],
        "reasoning_effort": sforzo,
    }).encode()
    richiesta = urllib.request.Request(
        BASE + "/chat/completions", data=corpo,
        headers={"Authorization": "Bearer " + k, "Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(richiesta, timeout=90) as r:
            dati = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        corpo_errore = ""
        try:
            corpo_errore = e.read().decode()[:180]
        except OSError:
            pass
        # un 5xx del gateway è di solito un momento storto: vale una prova in più
        if e.code >= 500 and riprova:
            time.sleep(1.2)
            dopo = modello_chiama(messaggi, temperatura, max_tokens, riprova=False)
            dopo["riprovato"] = True
            return dopo
        return {"errore": "gateway " + str(e.code), "modello": MODELLO, "dettaglio": corpo_errore}
    except Exception as e:  # rete gi\u00f9, DNS, timeout\u2026 l'app deve poter continuare
        return {"errore": str(e)[:180], "modello": MODELLO}
    testo = testo_da_risposta(dati)
    if not testo:
        # risale la scala: più token, e per ultimo rimette il ragionamento
        if riprova:
            try:
                posto = SCALA.index((sforzo, max_tokens or SCALA[0][1]))
            except ValueError:
                posto = 0
            if posto + 1 < len(SCALA):
                prossimo_sforzo, prossimi_token = SCALA[posto + 1]
                dopo = modello_chiama(messaggi, temperatura, prossimi_token, riprova=False,
                                      sforzo=prossimo_sforzo)
                dopo["riprovato"] = True
                dopo["secondi"] = round(dopo.get("secondi", 0) + (time.time() - t0), 1)
                return dopo
        return {"errore": "il modello ha finito lo spazio per pensare senza scrivere il testo",
                "modello": MODELLO, "secondi": round(time.time() - t0, 1)}
    return {"testo": testo, "modello": dati.get("model", MODELLO),
            "secondi": round(time.time() - t0, 1),
            "token": (dati.get("usage") or {}).get("completion_tokens")}

# ------------------------------------------------------- i dati che il browser manda
def riduci(esame):
    """porta al modello solo quello che serve: niente HTML, niente ripetizioni"""
    busta = esame.get("busta") or {}
    def voce(r, ann=None):
        v = {"voce": r.get("titolo"), "codice": r.get("codice"),
             "importo_centesimi": r.get("valore"), "tipo": r.get("tipo")}
        if r.get("calcolo"):
            v["calcolo_del_documento"] = r["calcolo"]
        if ann:
            v["esito"] = ann.get("stato")
            v["perche"] = ann.get("testo")
            v["fonte"] = ann.get("fonte")
        return v
    ann = {r.get("codice"): r for r in esame.get("righe") or []}
    righe = [voce(r, ann.get(r.get("codice"))) for r in busta.get("righe") or []]
    return {
        "persona": esame.get("persona"),
        "documento": {"mese": busta.get("mese"), "livello": busta.get("livello"),
                      "ore_settimana": busta.get("ore_settimana"),
                      "tariffa_oraria_centesimi": busta.get("tariffa"),
                      "contratto_dichiarato": busta.get("ccnl_dichiarato"),
                      "contratto_sotto_cui_si_legge": esame.get("lettura"),
                      "netto_scritto_centesimi": busta.get("netto_dichiarato"),
                      "totale_crediti_centesimi": (busta.get("totali") or {}).get("crediti"),
                      "totale_trattenute_centesimi": (busta.get("totali") or {}).get("trattenute"),
                      "totale_imposte_centesimi": (busta.get("totali") or {}).get("imposte")},
        "ratei": busta.get("ratei"),
        "conti": esame.get("conti"),
        "voci": righe,
        "mancano": esame.get("mancano"),
        "cambia_passando_al_contratto": esame.get("cambio"),
        "riepilogo": esame.get("riepilogo"),
        # se il modello vuole il mensile, lo divide il motore: una cifra derivata
        # che sta nel documento vale, una che si inventa diDivisione no
        "quota_mancante_al_mese_centesimi": round(
            ((esame.get("riepilogo") or {}).get("euro_mancanti") or 0) / 12),
    }

# ------------------------------------------------------------- il link condiviso
def token_richiesto():
    return bool(TOKEN_LINK)


def arriva_da_fuori(richiesta):
    # True se la chiamata non viene dal computer che sta servendo l'app. Il tunnel
    # Cloudflare arriva comunque da 127.0.0.1, ma porta i segni del passaggio
    # (CF-Connecting-IP, oppure un Host che non è il nostro indirizzo locale): così
    # chi apre Inquadra sul proprio Mac lavora senza pensare al token, e chi riceve
    # il link deve averlo.
    ip = (getattr(richiesta, "client_address", None) or ("?",))[0]
    if ip not in ("127.0.0.1", "::1", "localhost"):
        return True
    if richiesta.headers.get("CF-Connecting-IP") or richiesta.headers.get("X-Forwarded-For"):
        return True
    host = (richiesta.headers.get("Host") or "").split(":")[0].lower()
    return host not in ("127.0.0.1", "localhost", "[::1]", "::1", "")


def token_ammesso(richiesta):
    # Il token arriva dall'header X-Token o da ?t= nel link. Serve solo a chi viene
    # da fuori: i file della demo non contengono segreti, ma il modello costa, e non
    # deve restarne a disposizione chi trova l'indirizzo del link.
    if not TOKEN_LINK or not arriva_da_fuori(richiesta):
        return True
    ricevuto = (richiesta.headers.get("X-Token") or "").strip()
    if not ricevuto:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(richiesta.path).query)
        ricevuto = (query.get("t") or [""])[0].strip()
    return ricevuto == TOKEN_LINK


# --------------------------------------------------------------------- il server
class Gestione(SimpleHTTPRequestHandler):
    # HTTP/1.1 perché davanti può esserci un tunnel: con le risposte in 1.0 Cloudflare
    # non le riconosce e sostituisce il nostro messaggio con la sua pagina di errore
    protocol_version = "HTTP/1.1"

    def log_message(self, forma, *args):
        sys.stderr.write("  " + (forma % args) + "\n")

    def _cors(self):
        """serve alla copia della demo su GitHub Pages, che chiama il micro-server
        del computer che la apre (localhost) da un indirizzo esterno."""
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Token")
        # le pagine pubbliche che chiamano un server locale passano da qui
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def _json(self, codice, corpo):
        dati = json.dumps(corpo, ensure_ascii=False).encode()
        self.send_response(codice)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dati)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(dati)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/stato":
            k = chiave()
            return self._json(200, {"modello": MODELLO, "base": BASE,
                                    "chiave": bool(k), "porta": PORTA,
                                    "token": token_richiesto(),
                                    "token_ammesso": token_ammesso(self)})
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        percorso = self.path.split("?")[0]
        # il corpo si legge SEMPRE, anche quando si risponde 401 o 404: i byte non
        # letti restano nel socket, e con HTTP/1.1 (e un tunnel che tiene vive le
        # connessioni) la richiesta successiva arriva incollata male — "400 Bad
        # request syntax" con in mezzo il JSON di prima.
        try:
            n = min(int(self.headers.get("Content-Length") or 0), 8 * 1024 * 1024)
        except ValueError:
            n = 0
        grezzo = self.rfile.read(n) if n > 0 else b"{}"
        if percorso not in ("/api/leggi", "/api/chiedi"):
            return self._json(404, {"errore": "non esiste"})
        if not token_ammesso(self):
            return self._json(401, {"errore": "manca il token del link: riapri "
                                              "l’indirizzo ricevuto per intero, "
                                              "compreso ?t=…"})
        try:
            corpo = json.loads(grezzo.decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            return self._json(400, {"errore": "JSON malformato"})
        try:
            return self._esamina(percorso, corpo)
        except Exception as e:
            # meglio un errore nominato a schermo che una connessione chiusa: il
            # browser la chiamerebbe "Failed to fetch" e nessuno capirebbe niente
            return self._json(200, {"errore": "il micro-server si è inceppato: "
                                              + type(e).__name__ + " " + str(e)[:160]})

    def _esamina(self, percorso, corpo):
        esame = corpo.get("esame") or {}
        if not esame.get("busta"):
            return self._json(400, {"errore": "nessuna busta nell'invio"})
        dati = riduci(esame)
        if percorso == "/api/chiedi":
            domanda = (corpo.get("domanda") or "").strip()[:400]
            if not domanda:
                return self._json(400, {"errore": "domanda vuota"})
            esito = modello_chiama([{"role": "user", "content": prompt_domanda(domanda, dati)}],
                                   temperatura=0.2, max_tokens=4500)
        else:
            # budget largo al primo colpo: con un budget stretto il modello ragiona,
            # finisce i token e la risposta arriva vuota (30 secondi buttati)
            esito = modello_chiama([{"role": "user", "content": prompt_legtura(dati)}],
                                   temperatura=0.3, max_tokens=6000)
        if "testo" in esito:
            permessi = cifre_permesse(json.dumps(dati, ensure_ascii=False), dati)
            fuori, appross = cifre_fuori(esito["testo"], permessi)
            esito["cifre_fuori"] = fuori
            esito["approssimazioni"] = appross
            esito["solo_cifre_del_documento"] = not fuori
        # 200 anche quando il modello non ha risposto: il codice HTTP parla del
        # collegamento, la parola `errore` nel corpo dice cosa è successo. Un 5xx
        # qui dentro verrebbe riscritto dal tunnel e nessuno leggerebbe il motivo.
        return self._json(200, esito)

def avvia():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    os.chdir("..")   # il launcher chiama la cartella della demo: serviamo quella
    server = ThreadingHTTPServer(("127.0.0.1", PORTA), Gestione)
    print("Inquadra in ascolto su http://127.0.0.1:%d" % PORTA)
    print("modello:", MODELLO, "| chiave:", "presente" if chiave() else "MANCANTE (l'app usa il motore deterministico)")
    if TOKEN_LINK:
        print("il link condiviso chiede il token (?t=…): attivo")
    else:
        print("nessun token: il modello è raggiungibile solo da questo computer "
              "(per condividere, metti INQUADRA_TOKEN in .env)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    avvia()
