#!/bin/bash
# Apre Inquadra nel browser predefinito (doppio clic dal Finder).
#
# Serve i file da un micro-server locale su http://127.0.0.1 con un indirizzo
# diverso a ogni apertura: così il browser non può mai mostrare una copia vecchia
# rimasta in cache. Lo stesso micro-server fa da tramite con il modello Galene
# (modello/server.py): la chiave sta lì, mai nel JavaScript del browser.
cd "$(dirname "$0")"
PORTA=8791

PYTHON=""
for P in python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  if command -v "$P" >/dev/null 2>&1; then PYTHON="$P"; break; fi
done

in_ascolto() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORTA/index.html"; }

if [ -n "$PYTHON" ] && ! in_ascolto; then
  nohup "$PYTHON" -u modello/server.py >/dev/null 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do in_ascolto && break; sleep 0.3; done
fi

if in_ascolto; then
  echo "Inquadra è aperta nel browser."
  if curl -s --max-time 4 "http://127.0.0.1:$PORTA/api/stato" | grep -q '"chiave": true'; then
    echo "Modello collegato: la lettura della busta la scrive davvero il modello."
  else
    echo "Modello non collegato: l'app risponde con il suo motore e lo scrive in alto."
    echo "La chiave si chiama LITELLM_EXT_API_KEY e sta in ~/.hermes/.env."
  fi
  echo "Questa finestra del terminale puoi chiuderla: l'app resta aperta."
  open "http://127.0.0.1:$PORTA/index.html?apre=$(date +%s)"
else
  echo "Il micro-server non è partito: apro il file direttamente (solo motore, niente modello)."
  echo "Se il browser mostra una schermata vecchia premi Cmd+Shift+R."
  open "file://$(pwd)/index.html"
fi
