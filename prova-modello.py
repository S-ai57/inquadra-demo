#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prova del pezzo modello: la guardia sulle cifre, i prompt, e \u2014 se c'\u00e8 la
chiave \u2014 una chiamata vera. Si lancia con `python3 prova-modello.py`.
Senza chiave le prove vive si saltano: il resto deve passare comunque."""
import importlib.util
import json
import os
import subprocess
import sys

DOVE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("srv", os.path.join(DOVE, "modello", "server.py"))
srv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(srv)

okay, fallite, saltate = [], [], []


def ok(msg, cond):
    (okay if cond else fallite).append(msg)


esame = json.loads(subprocess.check_output(
    ["node", os.path.join(DOVE, "backup", "esame-json.js"), "pellizzari"]).decode())
dati = srv.riduci(esame)
testo_json = json.dumps(dati, ensure_ascii=False)
permessi = srv.cifre_permesse(testo_json, dati)

# 1) le cifre vere del documento non devono essere segnalate come invenzioni
for cifra in ["1.928,86", "177,26", "192,50", "1.559,10", "514,80", "9,74", "168"]:
    fuori, _ = srv.cifre_fuori("La busta dice %s \u20ac." % cifra, permessi)
    ok("cifra vera accettata: %s" % cifra, cifra not in fuori)

# 2) le cifre inventate sì, e anche i codici voce che non esistono
fuori, _ = srv.cifre_fuori("In tutto 999.999,99 \u20ac e 2.400 \u20ac di Fondo ZZZ9 (voce M99).", permessi)
ok("importi inventati fermati", "999.999,99" in fuori and "2.400" in fuori)
ok("codici voce inventati fermati", "ZZZ9" in fuori and "M99" in fuori)
fuori2, _ = srv.cifre_fuori("La voce M10 e la voce T01 restano loro.", permessi)
ok("codici voce veri accettati", not fuori2)

# 3) ogni importo delle righe della busta \u00e8 permesso, in una forma o nell'altra
mancanti = []
for r in esame["busta"]["righe"]:
    euro = "%s,%02d" % ("{:,}".format(int(r["valore"]) // 100).replace(",", "."), int(r["valore"]) % 100)
    fuori3, _ = srv.cifre_fuori("Voce: %s \u20ac." % euro, permessi)
    if euro in fuori3:
        mancanti.append("%s %s" % (r["codice"], euro))
ok("tutti gli importi della busta riconosciuti (%d righe)" % len(esame["busta"]["righe"]), not mancanti)
if mancanti:
    print("   non riconosciuti:", mancanti)

# 4) i prompt: la sintesi dei fatti c'\u00e8, la domanda pure, e non sono chilometrici
leg = srv.prompt_legtura(dati)
dom = srv.prompt_domanda("perch\u00e9 il livello in busta non \u00e8 quello giusto?", dati)
ok("prompt di lettura con la sintesi", "SINTESI DEI FATTI" in leg and "Commercio" in leg)
ok("prompt di lettura con le cifre del documento", "192886" in testo_json and "1.928,86" in testo_json)
ok("prompt di domanda con la domanda scritta", "livello in busta" in dom)
ok("prompt sotto i 24.000 caratteri", len(leg) < 24000 and len(dom) < 24000)
ok("riduci non porta HTML al modello", "<div" not in testo_json and "<span" not in testo_json)
ok("riduci porta i conti e le voci mancanti",
   len(dati.get("conti") or []) >= 1 and len(dati.get("mancano") or []) >= 1)
ok("riduci porta il contratto sotto cui si legge", "contratto_sotto_cui_si_legge" in json.dumps(dati))

# 4b-zero) lo zero non è un'invenzione, un totale fatto dal modello sì
zero, _ = srv.cifre_fuori("Il contratto non prevede nulla: 0,00 \u20ac al mese.", permessi)
ok("0,00 \u20ac accettato (\u00e8 il modo onesto di dire che non manca niente)", not zero)
somma, _ = srv.cifre_fuori("In tutto fa 190,68 \u20ac.", permessi)
ok("un totale che il modello ha sommato da sé è fermato", "190,68" in somma)

# 4c) le cifre che il modello ricava per forza (l'anno diviso dodici) deve dargliele
#     il motore: quelle restano cifre del documento, le altre la guardia le ferma
mensile = dati.get("quota_mancante_al_mese_centesimi")
ok("il motore calcola la quota mensile di ci\u00f2 che manca", isinstance(mensile, int) and mensile > 0)
fuori_m, _ = srv.cifre_fuori("Sono %s \u20ac al mese." % srv.euro(mensile), permessi)
ok("il mensile calcolato dal motore \u00e8 una cifra permessa", not fuori_m)

# 4a-bis) chi è di casa non porta il token, chi arriva dal tunnel sì
class _Header(dict):
    def get(self, k, d=None):
        return dict.get(self, k, d)


class _Richiesta:
    def __init__(self, ip="127.0.0.1", host="127.0.0.1:8791", token=None, cf=None,
                 path="/api/leggi"):
        self.client_address = (ip, 50000)
        self.headers = _Header(Host=host)
        if token:
            self.headers["X-Token"] = token
        if cf:
            self.headers["CF-Connecting-IP"] = cf
        self.path = path


ok("token richiesto solo quando è configurato", srv.token_richiesto())
ok("chi apre l'app sul proprio Mac non deve mettere il token", srv.token_ammesso(_Richiesta()))
ok("il link del tunnel senza token è fermato",
   not srv.token_ammesso(_Richiesta(host="qualcosa.trycloudflare.com")))
ok("CF-Connecting-IP tradisce il visitatore remoto",
   not srv.token_ammesso(_Richiesta(cf="203.0.113.9")))
ok("un indirizzo che non è locale è fermato", not srv.token_ammesso(_Richiesta(ip="192.168.1.44")))
ok("col token nel link passa", srv.token_ammesso(
    _Richiesta(host="qualcosa.trycloudflare.com", path="/api/leggi?t=" + srv.TOKEN_LINK)))
ok("col token nell'header passa", srv.token_ammesso(
    _Richiesta(host="qualcosa.trycloudflare.com", token=srv.TOKEN_LINK)))

# 4b) le risposte storte del gateway non devono far morire niente
ok("risposta normale: il testo passa",
   srv.testo_da_risposta({"choices": [{"message": {"content": "  ciao  "}}]}) == "ciao")
ok("content: None (modello che ragiona e non scrive) → testo vuoto, non eccezione",
   srv.testo_da_risposta({"choices": [{"message": {"content": None}}]}) == "")
ok("scelte mancanti → testo vuoto, non eccezione", srv.testo_da_risposta({"choices": []}) == "")
ok("risposta senzachoices → testo vuoto", srv.testo_da_risposta({}) == "")
ok("risposta malformata (choices non lista) → testo vuoto",
   srv.testo_da_risposta({"choices": None}) == "")

# 5) la chiamata vera (si salta se la chiave non c'\u00e8 o la rete manca)
if not srv.chiave():
    saltate.append("nessuna chiave: prova viva saltata")
else:
    esito = srv.modello_chiama([{"role": "user", "content": dom}], temperatura=0.2, max_tokens=900)
    if esito.get("errore"):
        saltate.append("gateway non raggiungibile (%s): prova viva saltata" % esito["errore"])
    else:
        ok("il modello risponde", len(esito.get("testo", "")) > 40)
        ok("la risposta \u00e8 in italiano", "non" in esito["testo"].lower() or "\u00e8" in esito["testo"])
        ok("entro il minuto", esito.get("secondi", 999) < 60)
        if not esito.get("solo_cifre_del_documento"):
            print("   attenzione: cifre fuori dal documento =", esito.get("cifre_fuori"))
            print("   testo:", esito["testo"][:220].replace("\n", " \u2022 "))
        ok("firma del modello presente", esito.get("modello") == srv.MODELLO)
        print("   chiamata reale: %.1f s, %d parole generate" % (esito["secondi"], esito.get("token") or 0))

print()
for m in okay:
    print("  ok  ", m)
for m in saltate:
    print("  \u2013  ", m)
for m in fallite:
    print("  \u2717  ", m)
print("\n%d asserzioni superate, %d fallite, %d saltate" % (len(okay), len(fallite), len(saltate)))
sys.exit(1 if fallite else 0)
