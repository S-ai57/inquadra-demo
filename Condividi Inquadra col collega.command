#!/bin/bash
# Condivide Inquadra con un collega: link https temporaneo, modello vero,
# token obbligatorio. Il collegamento vive finché questa finestra resta aperta.
#
# La chiave del modello non lascia mai questo computer: la usa solo il
# micro-server locale (modello/server.py), e il collega non la vede mai.
cd "$(dirname "$0")" || exit 1

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Manca cloudflared, il programmino che fa il link temporaneo."
  echo "Si installa con:  brew install cloudflared"
  exit 1
fi

# il token: se non c'è, lo genera e lo scrive nel .env (che non finisce su GitHub)
if [ ! -f .env ]; then
  : > .env
  chmod 600 .env
fi
if ! grep -q "^INQUADRA_TOKEN=." .env 2>/dev/null; then
  NUOVO="$(openssl rand -hex 8)"
  printf '\n# Token per il link condiviso: senza ?t=<token> il modello non risponde.\nINQUADRA_TOKEN=%s\n' "$NUOVO" >> .env
  echo "Creato il token della demo: $NUOVO (salvato in .env, cambia quando vuoi)"
fi
TOKEN="$(grep -m1 '^INQUADRA_TOKEN=' .env | cut -d= -f2)"

PORTA="$(grep -m1 '^INQUADRA_PORTA=' .env 2>/dev/null | cut -d= -f2)"
PORTA="${PORTA:-8791}"

# se il micro-server locale non c'è già, lo avvia lui
AVVIATO=""
if ! curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORTA/index.html"; then
  nohup python3 -u modello/server.py >/tmp/inquadra_server.log 2>&1 &
  AVVIATO=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORTA/index.html" && break
    sleep 0.4
  done
fi

pkill -f "cloudflared tunnel --url http://127.0.0.1:$PORTA" 2>/dev/null
sleep 0.3
cloudflared tunnel --url "http://127.0.0.1:$PORTA" --no-autoupdate >/tmp/inquadra-tunnel.log 2>&1 &
CF=$!

pulisci() {
  kill $CF 2>/dev/null
  [ -n "$AVVIATO" ] && kill $AVVIATO 2>/dev/null
  echo
  echo "collegamento chiuso: il link non funziona più."
}
trap pulisci EXIT INT TERM

echo "Sto attivando il collegamento (Ctrl+C o chiusura finestra = tutto spento)…"
URL=""
for _ in $(seq 1 40); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/inquadra-tunnel.log | head -1)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "Il tunnel non è partito: guarda /tmp/inquadra-tunnel.log"
  exit 1
fi

LINK="$URL/?t=$TOKEN"
echo
echo "✅ Link da mandare al collega (funziona finché questa finestra resta aperta):"
echo
echo "   $LINK"
echo
printf "%s" "$LINK" | pbcopy
echo "   già copiato: puoi incollarlo nella chat"
echo "   Solo chi apre questo indirizzo con il token può usare il modello."
echo "   Il link cambia a ogni avvio: riprendilo da qui, non dal messaggio scorso."
echo
open "$LINK" 2>/dev/null
wait
