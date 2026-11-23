# Inquadra — la busta paga, voce per voce (demo locale Galene.AI)

Mockup **solo frontend** di un assistente per l'ufficio del personale. **Fa una cosa sola:**
prende la busta paga di una persona, la legge **voce per voce**, rifà i conti, dice cosa torna,
cosa è applicato male, cosa manca — e **risponde alle domande** di chi legge («perché gli hanno
tolto 58,44 €?», «quante ore di permesso restano?», «il fondo pensione è versato?»).

**Dietro c'è un modello vero**: lettura e risposte le scrive lo stesso modello che ha costruito
la demo — `Galene/DeepSeek-V4-Flash` sul gateway Galene — chiamato da un micro-server che vive
dentro il Mac. I conti no: quelli restano regole verificabili, e il modello li usa.

Ambito: azienda con più attività sotto lo stesso tetto (stabilimento, spaccio, consegne).
Progetto e perimetri in `BLUEPRINT.md`.

Veste con il kit brand Galene.AI (skill `design-galene`): deep purple / soft violet / magenta,
font Apfel Grotezk, logo in testata, icone Lucide. Gli stati non usano verde/ambra/rosso ma
**parola + icona**, e ogni segno ha la sua legenda a schermo.

## Cosa si vede usando la demo

- apre la persona: **tre fatti** (attività svolta, livello, contratto in busta) con l'atto da cui
  risultano, e **il documento che l'app sta per leggere** — un documento solo, non cinque;
- **la lettura del modello** in cima all'esame, con la firma e i secondi che ha messo;
- **ogni voce della busta è spiegata** con la clausola che la genera, o con il motivo per cui
  l'app **non può** verificarla: `fuori dal contratto` per fisco, INPS e gestioni interne,
  `tabella non in archivio` quando servirebbero i minimi tabellari (`chi la carica` è scritto);
- **i conti rifatti**: che spettano − trattenute − imposte = netto. Se il documento scrive un
  altro numero, l'app lo dice (`Mirko Sartori`: 12,00 € di differenza);
- **le voci che il contratto prevede e la busta non versa**, con la cifra: Fondo Est 13 €/mese
  = 156,00 €/anno, quota Alifond 1,2% = 32,18 €/mese, Fon.Te. 1,55%, Priamo 1%;
- **i monti ore confrontati**: 104 ore col Commercio, 108 coll'Alimentaristi; sul part-time di
  Amina Doumbia 108 × 24/40 = 64,8 ore, e in busta ne risultano 54 → 10,8 ore in meno, 105,19 €;
- **le domande libere**: risponde subito il motore (con le fonti), il modello aggiunge la sua;
  le risposte del motore restano apribili sotto «i passaggi del motore». Le domande agganciano
  anche per codice (`M72`) o per cifra (`58,44 €`);
- **«rileggi con il contratto»**: la stessa busta riletta sotto un altro contratto risponde diverso
  (`Marco Brunelli` sotto la Logistica fa comparire la diaria di 46,48 €/giorno e il fondo Priamo).

## Il modello, e come è tenuto a bada

- **dove sta la chiave**: solo nel micro-server (`modello/server.py`), presa dall'ambiente o da
  `~/.hermes/.env` (`LITELLM_EXT_API_KEY`). Nel JavaScript del browser non c'è, e non esce dalle
  risposte di `/api` (verificato). Il server ascolta soltanto su `127.0.0.1`.
- **la guardia sulle cifre**: ogni importo in euro e ogni codice voce che il modello scrive viene
  ricontrollato contro il documento. Se non c'è, **la lettura non viene mostrata** e la schermata
  lo dice; le cifre secche (ore, giorni, percentuali) finiscono in una nota a parte.
- **senza modello si lavora lo stesso**: niente chiave o niente rete → risponde il motore
  deterministico e la testata scrive `modello non collegato: risponde il motore`.
- `?noai=1` (o `?senza-modello=1`) apre la demo senza chiamarlo, per prove e screenshots.

## Cosa **non** c'è più (taglio chiesto il 23/11)

Sono uscite dalla schermata — restano nell'engine, ancora testato, e torneranno come fetta
seguente: il verdetto «quale contratto si applica», le tre carte dei contratti con l'aderenza,
la mappa di tutte le clausole (da attivare / applicate male / non pertinenti) e la nota per il
consulente costruita su quelle clausole. `prova-motore.js` continua a verificare quel motore:
**3938 asserzioni superate**, così il giorno che si rimette in schermo non è da riscrivere.

## Come si usa

1. **Doppio clic** su `Apri Inquadra.command`; la guida di tre passi finisce sul pulsante
   (o saltala). Il launcher avvia `modello/server.py` — micro-server **solo locale**
   (`http://127.0.0.1:8791`) che serve i file **e** parla con il modello — e apre un indirizzo
   nuovo a ogni apertura, così Safari non può mostrare una copia vecchia in cache. In Terminale
   compare se il modello è collegato. La finestra si può chiudere.
2. Apri **Giorgia Pellizzari** → **Esamina la busta paga**: i numeri arrivano subito, la lettura
   del modello dopo una dozzina di secondi (può arrivare a una trentina: il tempo che si vede a
   schermo è quello vero, non un conto alla rovescia messo lì per scenografia).
3. Apri **Mirko Sartori**, premi **Logistica** sotto «rileggi con il contratto»: il netto del
   documento non torna con le sue righe, la diaria delle uscite non c'è, e senza tabella permessi
   l'app non confronta le ore — lo dice invece di inventarle.
4. Chiedi: «perché il livello in busta non è quello giusto?», «cos'è la voce M72?», «come
   funziona il part-time sui permessi?» (su Sartori, che è a tempo pieno, il modello lo dice).
5. `riapri la guida` in alto a destra; l'esame già fatto resta in questo browser (*mostra l'esame
   di prima*), e in coda la riga della persona porta il numero di voci che non tornano.

Scorciatoie da prova (non sono il percorso dell'utente): `?noai=1` salta il modello, `?auto=1`
preme il pulsante da solo, `?notour=1` salta la guida. Piloti già pronti: `#busta` `#domande`
`#anomalia` `#parttime` `#pulito_esame` `#cambio`.

## Condividere Inquadra con un collega

Stesso schema già usato per la demo *smistamento email*: il modello resta sul **tuo**
computer, il collega apre un link.

1. doppio clic su **`Condividi Inquadra col collega.command`**: parte il micro-server,
   si apre un tunnel HTTPS temporaneo (`*.trycloudflare.com`) e in Terminale compare
   l'indirizzo **già copiato**, del tipo `https://…trycloudflare.com/?t=<token>`;
2. incolli il link in chat. Funziona finché quella finestra resta aperta: chiudendola
   il link muore da solo, niente da disdire;
3. il `?t=` è obbligatorio: **senza token il modello non risponde** (`401`, e la schermata
   lo dice). La pagina e i suoi file si possono aprire anche senza token, perché non
   contengono niente di segreto.

Note oneste:

- la chiave del modello non passa mai al collega: la usa solo il micro-server, che sta
  su `127.0.0.1` e viene raggiunto dal tunnel;
- il token sta in `.env` (nel `.gitignore`), `.env.example` è il modello pubblico;
- il link **cambia a ogni avvio**: va ripreso dalla finestra, non dal messaggio scorso;
- un collega senza token vede comunque l'app con i conti del motore deterministico.

Se invece vuoi un indirizzo sempre accessibile (senza modello, o col modello del
computer di chi apre) la cartella è pronta per git: `.gitignore`, `.env.example`, e i
`fetch` dell'app sono preparati per chiamare `http://127.0.0.1:8791` anche da una pagina
pubblica (CORS + preflight).

## Condividere Inquadra con un collega

Stesso schema giá usato per la demo *smistamento email*: il modello resta sul **tuo** computer,
il collega apre un link.

1. doppio clic su **`Condividi Inquadra col collega.command`**: parte il micro-server, si apre un
   tunnel HTTPS temporaneo (`*.trycloudflare.com`) e in Terminale compare l'indirizzo **giá
   copiato**, del tipo `https://…trycloudflare.com/?t=<token>`;
2. incolli il link nella chat. Funziona finché quella finestra resta aperta: chiudendola il link
   muore da solo, non c'è niente da disdire;
3. il `?t=` è obbligatorio: **senza token il modello non risponde** (arriva un 401, e la schermata
   lo dice in italiano). La pagina e i suoi file si possono aprire anche senza token, perché non
   contengono niente di segreto.

Onestá sui dettagli: la chiave del modello non passa mai al collega (la usa solo il micro-server,
che sta su `127.0.0.1` e viene raggiunto dal tunnel); il token vive in `.env`, che è nel
`.gitignore`; **il link cambia a ogni avvio**, quindi va ripreso dalla finestra e non dal messaggio
scorso; un collega senza token vede comunque l'app con i conti del motore deterministico. Se serve
un indirizzo sempre accessibile, la cartella è già pronta per git (`.gitignore`, `.env.example`) e i
`fetch` dell'app sanno chiamare `http://127.0.0.1:8791` anche da una pagina pubblica (CORS e
preflight già gestiti).

## Verifiche fatte

- motore: `node prova-motore.js` → **3938 asserzioni superate**: ogni voce di ogni busta con il suo
  stato e la sua fonte, nessuna cifra indicata come mancante senza una clausola che la dica, somme
  della busta risommate, monte ore (pieno, part-time, tabella assente), ogni intenzione di risposta
  raggiunta da una domanda reale, nessuna risposta con `NaN`/`undefined`, determinismo, e le
  **sei fonti che compilano insieme** (il duplicato di una `const` fra file biancherebbe la pagina);
- modello: `python3 prova-modello.py` → **29 asserzioni superate**, di cui una **chiamata reale**:
  gli importi di tutte le 11 righe riconosciuti, gli inventati fermati (`999.999,99 €`, la voce
  `M99`, un fondo inesistente), le risposte storte del gateway (`content: None`, scelte mancanti)
  che non fanno morire niente, i prompt sotto i 24.000 caratteri, la risposta in italiano entro il
  minuto. Nel giro di prova: lettura 15-18 s, risposta a una domanda 4-12 s (la prima chiamata può
  capitare sui 30 s, se il modello deve riprovare da solo);
- UI: `prova-stati.html#1…14` pilota la demo in browser reale, **14/14 passati** e **zero errori di
  script**, modello disinserito. Ogni stato verifica anche che le sezioni tagliate **non**
  ricompaiano (`#verdetto`, `#contratti`, `#mappa`, `.cand`, `.clausola`, `#nota-blocco`);
- QA in browser col modello acceso: lettura e risposte vere, firma con i secondi, nessuna cifre
  fuori dal documento nei percorsi provati, nessun taglio orizzontale a 390px, due passaggi di
  lettura esterna come non addetti.

## Ricostruire

```bash
node --check js/data.js js/busta.js js/engine.js js/esame.js js/modello.js js/app.js
node prova-motore.js              # regole, buste, risposte
python3 prova-modello.py          # la guardia sulle cifre + una chiamata vera
python3 modello/server.py         # poi http://127.0.0.1:8791/index.html?noai=1
# e per condividere: doppio clic su "Condividi Inquadra col collega.command" 
# guida visiva: prova-stati.html#1 … #14 (con ?noai=1)
```

Prima chiamata a `DeepSeek-V4-Flash` con `reasoning_effort: "low"`: è un modello che ragiona
prima di scrivere, e senza quel campo finisce i token nel ragionamento lasciando il testo vuoto.

`js/data.js` archivio contratti e posizioni · `js/busta.js` le buste (con i codici voce) ·
`js/esame.js` esame della busta e risposte · `js/modello.js` la chiamata al modello e la sua
firma · `modello/server.py` il proxy locale con la chiave · `Condividi Inquadra col collega.command`
il link temporaneo con token · `.env` (locale, nel `.gitignore`) e `.env.example` · `js/engine.js` inquadramento e clausole
(motore non ancora in schermo) · `js/app.js` interfaccia. Le versioni con le clausole a schermo
sono in `backup/` (`app-con-clausole.js`, `style-con-clausole.css`, `prova-stati-con-clausole.html`).
