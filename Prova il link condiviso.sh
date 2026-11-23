#!/bin/bash
# Prova di controllo per il link condiviso: si lancia DOPO aver avviato
# "Condividi Inquadra col collega.command". Risponde in italiano cosa funziona
# e cosa no, cosi' non si manda al collega un link rotto.
#   uso:  bash "Prova il link condiviso.sh"  https://xxxx.trycloudflare.com
URL="${1:-$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/inquadra-tunnel.log 2>/dev/null | head -1)}"
cd "$(dirname "$0")" || exit 1
TOKEN="$(grep -m1 '^INQUADRA_TOKEN=' .env 2>/dev/null | cut -d= -f2)"
[ -z "$URL" ] && { echo "Non trovo l'indirizzo del tunnel: passalo tu, es. bash \"Prova il link condiviso.sh\" https://xxxx.trycloudflare.com"; exit 1; }
[ -z "$TOKEN" ] && { echo "Manca INQUADRA_TOKEN nel .env: senza token il link non dovremmo averlo mandato."; exit 1; }

# una busta di prova, generata dai dati della demo
node backup/esame-json.js ferrante > /tmp/prova-link-esame.json 2>/dev/null || { echo "Non trovo node (serve per generare la prova)."; exit 1; }
python3 -c "import json;print(json.dumps({'esame':json.load(open('/tmp/prova-link-esame.json'))}))" > /tmp/prova-link.json

echo "link:      $URL"
PAGINA=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$URL/?t=$TOKEN")
STATO=$(curl -s --max-time 30 "$URL/api/stato")
SENZA=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 -X POST -H "Content-Type: application/json" --data @/tmp/prova-link.json "$URL/api/leggi")
CON=$(curl -s --max-time 180 -o /tmp/prova-link-out.json -w "%{http_code}" -X POST -H "Content-Type: application/json" --data @/tmp/prova-link.json "$URL/api/leggi?t=$TOKEN")

[ "$PAGINA" = "200" ] && echo "pagina:    ok (arriva)" || echo "pagina:    NO (http $PAGINA) — il micro-server non risponde"
echo "$STATO" | grep -q '"chiave": true' && echo "chiave:    ok (il modello è collegato)" || echo "chiave:    NO — sul tuo Mac non si trova LITELLM_EXT_API_KEY"
[ "$SENZA" = "401" ] && echo "token:     ok (chi apre il link senza token non usa il modello)" || echo "token:     ATENZIONE — senza token risponde con http $SENZA, doveva fermare a 401"
if [ "$CON" = "200" ]; then
  python3 - <<'PY'
import json
d = json.load(open("/tmp/prova-link-out.json"))
if d.get("testo"):
    fuori = d.get("cifre_fuori") or []
    print("modello:   ok (%.1f s, cifre tutte del documento%s)" % (
        d.get("secondi") or 0, "" if not fuori else " — tranne " + ", ".join(fuori[:3])))
else:
    print("modello:   NO —", d.get("errore"))
PY
else
  echo "modello:   NO (http $CON)"
fi
echo
echo "Il link da mandare é: $URL/?t=$TOKEN"
echo "Ricorda: vale finché resta aperta la finestra del comando di condivisione."
