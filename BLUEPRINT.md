# Inquadra — blueprint del prototipo (per approvazione)

Prototipo locale, **non deployato**: serve a far vedere il prodotto prima di costruirlo.
Nessun dato reale: l'azienda, le posizioni e i documenti sono un set di dimostrazione
(**Fontanella Alimenti S.p.A.**, stabilimento + spaccio + consegne, 118 persone).
Nome provvisorio: **Inquadra**.

L'app **fa una cosa sola**: prende la busta paga di una persona e la esamina.

**Esame della busta paga** (l'«AI moment»: 2-4 secondi di modello vero, misurati): l'app legge
il documento voce per voce,
spiega ogni riga con la clausola che la genera, rifà i conti, segnala le voci che il contratto
prevede e la busta non versa, e **risponde alle domande** di chi legge.

Il motore di **inquadramento** (quale CCNL si applica davvero, con l'aderenza sulle prove
dell'attività svolta, e la mappa di tutte le clausole) è scritto e testato — **ma da questa fetta
è fuori schermo**: serve all'esame come lente di lettura («rileggi con il contratto»). Taglio
voluto il 23/11: *lascia solo la busta paga, togli «quale contratto si applica» e la mappa delle
clausole da attivare*.

## Il problema

Un ufficio del personale con più attività sotto lo stesso tetto (stabilimento, punto vendita,
consegne con mezzi propri) applica quasi sempre **un solo CCNL a tutti**, perché così è partito
il primo contratto e poi si è continuato. La Cassazione dice il contrario: quando il datore
svolge più attività, ogni gruppo di lavoratori va coperto dal contratto **coerente con l'attività
davvero svolta**, e la volontà scritta nel contratto individuale non può peggiorare quella
provenienza (Cass. 27719 del 17/10/2025; art. 36 Cost.).

Nessuno in azienda, oggi, rifà quel conteggio persona per persona: si scopre al contenzioso,
o in ispezione, o quando il sindacato chiede il Fondo Est che non è mai stato attivato.
E la busta paga — il documento che il lavoratore guarda — nessuno la spiega: le voci ci sono,
i motivi no, e le domande dell'ufficio del personale finiscono in una mail al consulente.

## L'utente

Ufficio del personale / amministrazione del personale di **un'azienda**. Non vuole una
bachiera: vuole aprire **la persona** e avere in una schermata —
**qual è il contratto pertinente** (con le prove che ci sono e quelle che mancano) e
**l'elenco completo delle clausole che la riguardano**, ognuna con la fonte, il perché e
chi deve muoversi. E vuole che l'app **dica quello che non sa**: dove manca il documento,
l'app non stima.

## Flusso attuale (senza app)

Contratto in ingresso → copia/incolla del CCNL dichiarato dal consulente → controlli a campione
sui minimi tabellari → nessuna verifica sistematica di livello, fondi di categoria, permessi,
part-time con clausole elastiche, durata dei termini. Le clausole che cambiano al cambio di
contratto (condizioni di miglior favore) non sono quasi mai elencate per iscritto.

## Risultato di accettazione osservabile

Per ogni persona l'operatore apre **la mappa delle clausole**: il contratto scelto dall'app con
la sua aderenza e le prove (o l'avviso che l'app non propone), poi **tutte** le clausole
dell'archivio passate una per una: *spetta e non è applicata*, *applicata male*, *manca un dato*,
*già applicata*, *non la riguarda* — con scritto per ogni riga **perché** riguarda (o non riguarda)
quella persona, **da quale atto** risulta, **cosa prevede** il contratto e **a carico di chi** è
l'azione. La frase del verdetto è una sola, e dice chi firma il passaggio.

## Prima fetta (quello che il prototipo mostra come sarà l'app vera)

- **coda di posizioni, non anagrafica**: 7 posizioni in controllo periodico, ognuna con il suo
  contratto in busta paga;
- **i tre fatti nudi** prima di qualsiasi giudizio: attività svolta, livello in busta paga,
  contratto applicato — ognuno con l'atto da cui risulta (lettera, prospetto paga, turni, visura);
- **tre fatti nudi** e il documento: attività svolta, livello, contratto in busta — ognuno con
  l'atto da cui risulta — e sotto **il documento che l'app sta per leggere** (uno solo: la busta
  paga del mese). Elencare cinque atti faceva aspettare all'esame qualcosa che non legge;
- **aderenza con soglia dichiarata**: 0 = niente a che vedere, 1 = coincide; l'app propone solo
  sopra **0,70** e se stacca il secondo di **0,15**. Sotto soglia l'app **non propone**: nomina i
  documenti che mancano e dice che decide una persona;
- **la scelta del contratto di riferimento è di chi guarda**: i tre contratti dell'archivio sono
  carte dello stesso peso, il consiglio dell'app è una badge; cambiando carta la mappa si rifà
  all'istante, e la riga che lo spiega resta visibile;
- **tutte le clausole, non solo i problemi**: quelle non pertinenti sono elencate con il motivo
  ("non lavora nella fascia 23:00–06:00", "nessun triennio chiuso: il primo scatto arriva il...");
**L'unica fetta schermata — l'esame della busta paga** (chiesto esplicitamente: «la verifica
comprenda dati utili», «che l'AI esamini la busta paga e dia spiegazioni»):

- il prospetto di ottobre 2026 con i suoi **codici voce** (M10, M30, T01, A04 …), raggruppato per
  *cosa spetta / cosa viene trattenuto / imposte / a carico dell'azienda*, con subtotali;
- **ogni voce spiegata**: la clausola che la genera, il conto scritto nel documento, l'esito
  (`verificata`, `non torna`, `manca nel prospetto`, `decide una persona`,
  `tabella non in archivio`, `fuori dal contratto`) e la fonte, con **legenda a schermo**;
- **i conti rifatti**: crediti − trattenute − imposte = netto, e se il documento scrive un altro
  numero l'app lo scrive (Sartori: 12,00 € di scarto);
- **le voci che il contratto prevede e il prospetto non versa**, con la cifra: Fondo Est 13 €/mese
  (156 €/anno), quota Alifond 1,2%, Fon.Te. 1,55%, Priamo 1%, diaria 46,48 €/giorno;
- **i monti ore confrontati**: 104 ore col Commercio, 108 coll'Alimentaristi; sul part-time
  108 × 24/40 = 64,8 ore contro 54 in busta → 10,8 ore, cioè 105,19 €;
- **le domande in linguaggio naturale**, agganciate per tema, per codice (`M72`) o per cifra
  (`58,44 €`); se l'aggancio non c'è l'app lo dice ed elenca le voci che ha davanti;
- **la stessa busta riletta sotto un altro contratto** rifà l'esame: è così che si vede cosa cambia
  davvero al passaggio (permessi, diaria, fondi, condizioni di miglior favore).
- tre contratti in archivio (uno per attività tipica di un'azienda mista): **Alimentare E01H**,
  **Terziario H011**, **Logistica I100**; più le clausole di legge che valgono su ogni contratto.

## Cosa c'è davvero dentro la demo

| Contratto | Valori usati (fonte pubblica) |
|---|---|
| Industria Alimentare (E01H) | 40 ore; ferie 22/26 giorni (art. 35); 76 ore ROL + 32 ex festività (art. 30); 13ª e 14ª; scatti 2% ogni 3 anni, max 5; prova 3/6 mesi; Alifond quota datoriale 1,2%; FASA |
| Terziario, Distribuzione e Servizi (H011) | 40 ore (art. 130); permessi 72 + 32 = 104 ore (art. 158); ferie 26 giorni; 13ª e 14ª (artt. 220-221); indennità di cassa (art. 218); Fondo Est 15 €/mese (13+2) + 30 € una tantum; Fon.Te. 0,55% → azienda 1,55%; EBT 0,10% + 0,05%; clausole flessibili/elastiche (art. 95) |
| Logistica, Trasporto Merci e Spedizione (I100) | 39 ore su 4 mesi (art. 9); ferie 22/26 (art. 24); 14 mensilità (artt. 18-19); prova 1-6 mesi (art. 5); Fondo Priamo 1% + 1% (art. 50); Ebilog 2 € + 0,50 €; diaria di legge 46,48 / 77,47 € |
| Clausole di legge (su ogni contratto) | riposo 11 ore (D.Lgs 66/2003 art. 9); 48 ore medie (art. 4); termine senza causale fino a 12 mesi (D.Lgs 81/2015 artt. 19-20); supplementari nel part-time (art. 4); L. 104 art. 33; lavoro agile con accordo scritto (L. 81/2017 art. 4); TFR (art. 2120 c.c.) |

Le date delle posizioni sono generate relative a oggi, quindi anzianità, scatti e periodi di
prova restano coerenti anche aprendo la demo fra un mese.

## Regole che il motore non salta mai

- **euro solo dove l'archivio ha la cifra**: fondi e enti di categoria, mensilità aggiuntive,
  diaria, ore di permesso (convertite alla tariffa scritta nel documento). Le differenze
  retributive per livello **non** sono calcolate: la tabella dei minimi tabellari non è
  nell'archivio e la riga lo dichiara (`tabella non in archivio`, con scritto chi la carica);
- **il fisco non si tocca**: IRPEF, addizionali, detrazioni, contributi INPS, prestiti e anticipi
  sono marcati `fuori dal contratto` — l'app non inventa risposte su ciò che il contratto non
  governa;
- **senza tabella nell'archivio non c'è cifra**: la demo lo mostra davvero — la tabella permessi
  della Logistica non è caricata e la riga resta *manca un dato*, con scritto chi la porta;
- **il dato anagrafico che non c'è non viene ipotizzato** (L. 104): la riga chiede una persona;
- **cambiando contratto le condizioni in più restano alla persona** (art. 2113 c.c.): la clausola
  compare da sola quando il contratto scelto non è quello in busta paga;
- **la verifica non parte da sola**: mai all'apertura, mai alla fine della guida.

## Cosa è rimasto fuori dal prototipo (taglio del 23/11, non è più schermato)

- il verdetto **«quale contratto si applica»** con la frase, chi decide e i contatori;
- le **tre carte dei contratti** con aderenza, potenziale, criteri trovati / mancanti;
- la **mappa di tutte le clausole** (da attivare, applicate male, con un dato mancante, già
  applicate, non pertinenti) e la **nota per il consulente** costruita su quelle righe.

L'engine che le produce è ancora in `js/engine.js` e ancora coperto da `prova-motore.js`; le
schermate di prima restano in `backup/`. È una scelta di fetta, non una cancellazione: quando
torna, non è da riscrivere.

## Il modello, e il patto con chi guarda

- **stesso modello di chi ha costruito la demo**: `Galene/DeepSeek-V4-Flash` sul gateway
  `models.galene.ai/v1`, chiamato da `modello/server.py`, un micro-server che sta aggrappato a
  `127.0.0.1` e serve anche i file;
- **la chiave non vede mai il browser**: la legge solo il proxy dall'ambiente
  (`LITELLM_EXT_API_KEY`, o `~/.hermes/.env`). Nel JavaScript non c'è, e non esce dalle risposte
  di `/api` — verificato con un grep sulle risposte;
- **al modello va il fatto, non la pagina**: `riduci()` porta cifre, stati, conti rifatti e clausole
  (≈ 10.000 caratteri) insieme a una **sintesi dei quattro fatti che contano**. Lasciato al JSON da
  solo, il modello si perdeva e rispondeva «non ho trovato» su cose che aveva davanti;
- **la guardia sulle cifre è la regola n. 6 applicata al modello**: ogni importo in euro e ogni
  codice voce che scrive viene ricontrollato contro il documento (i centesimi valgono anche scritti
  in euro). Se uno non c'è la lettura **non viene mostrata**, e la schermata lo dice. Le cifre che il
  modello è legittimo che ricavi — l'anno delle quote mancanti diviso dodici — **le calcola il motore
  e gliele mette nei dati** (`quota_mancante_al_mese_centesimi`): così la guardia non ferma una
  derivazione corretta e non serve allentare niente;
- **i numeri restano del motore**: pertinenza, stati, aderenza ed esame sono regole deterministiche.
  Il modello *scrive*, non *decide*. Se non risponde, l'app ha comunque la sua risposta e scrive
  chi ha parlato;
- **un modello ragionante va spento, quando non serve**: `DeepSeek-V4-Flash` pensa prima di
  scrivere, e i token sono condivisi fra pensiero e testo. Misurato sulla stessa lettura di tre
  posizioni: `reasoning_effort: «low»` → 20-22 secondi e in **due prove su tre il testo non
  arrivava affatto** (`finish_reason: length`, ragionamento 8.000-17.000 caratteri);
  `reasoning_effort: «none»` → **1,4-2,6 secondi, testo scritto, cifre giuste**. I conti li fa il
  motore: qui il pensiero era solo tempo. Resta una scala di ripiego (none 4000 token, poi low
  7000) e un messaggio che nomina la causa invece di incolpare la rete;
- **niente chiamata fuori dal pulsante** (regola del kit): né all'apertura, né sulla scelta del
  contratto, né sul cambio «rileggi con il contratto» — lì l'esame è regole e arriva subito.

### Condivisione: chi apre il link, chi paga il modello

- **modello sul computer di chi condivide, link a chi guarda**: `Condividi Inquadra col
  collega.command` avvia il micro-server + un tunnel HTTPS temporaneo (`*.trycloudflare.com`) e
  stampa `https://…trycloudflare.com/?t=<token>`, giá copiato. Finestra aperta = link vivo.
- **il token è l'unica cosa che sta nel link**: senza, l'API risponde 401 con il motivo; i file
  statici si aprono comunque, perché non contengono segreti. Il token vive in `.env`, nel
  `.gitignore`; `.env.example` è il modello pubblico.
- **HTTP/1.1 e errori nel corpo, non nel codice**: con le risposte in HTTP/1.0 Cloudflare non le
  riconosce e ci mette sopra la sua pagina di errore, e il motivo vero — «il modello ha finito lo
  spazio per pensare» — non lo leggerebbe nessuno.
- **budget misurato, non intuito**: la scala di prova è scritta nel codice (`SCALA = none/2600 →
  none/4000 → low/7000`) perché è il numero che decide se la demo risponde in due secondi o in
  trenta. Il livello base sta largo e la prova in più scatta solo se il modello non scrive testo.

## Release successive (fuori dal prototipo, NON sono schermate)

caricamento delle tabelle dei minimi tabellari per livello (e calcolo delle differenze
retributive con la prescrizione quinquennale);
connessione al consulente del lavoro / software paghe per leggere i prospetti reali; archivio
CCNL allineato a ogni verbale depositato in CNEL con data di vigenza; contratti aziendali e
premi di risultato; deleghe sindacali e RSA; multi-azienda per gli studi di consulenza;
conservazione della verifica come documento opposto al ispezioni.

## Branding

Kit Galene.AI ufficiale (skill `design-galene`) come le altre demo della suite: deep purple /
soft violet / magenta, Apfel Grotezk, icone Lucide. Stati **non** verde/ambra/rosso: tinta del
brand + **parola + icona**.

## Due decisioni di progetto — APERTE, le decide Sara prima di qualsiasi rilascio

1. **Tenant/ambiente target** (quale tenant di test, o produzione).
2. **Registry immagini** (registry OCI esterna del proprietario, o registry integrato Galene).

Nessuna delle due si deduce dall'esistenza di questo prototipo locale.

## Come è verificato

- tre moduli puri, senza DOM: `js/engine.js` (inquadramento e clausole), `js/esame.js` (esame
  della busta e risposte), `js/busta.js` (i prospetti, calcolati da ore, tariffe e aliquote perché
  le somme tornino al centesimo). **Nessun modello nelle decisioni**: pertinenza, stati, aderenza ed
  esame sono regole deterministiche su dati e fonti; il modello scrive la lettura e le risposte, e
  le sue cifre vengono ricontrollate contro il documento;
- `node prova-motore.js` — **3938 asserzioni superate**: verdetti attesi per le 7 posizioni;
  aderenza 0–1 con potenziale sopra l'aderenza e pesi a 100; soglia che blocca la proposta; ogni
  riga della mappa con fonte e perché; **ogni voce di ogni busta con il suo stato e la sua fonte**;
  ogni cifra indicata come mancante agganciata a una clausola citata (CCNL o legge); somme della
  busta risommate; monte ore pieno, part-time e «senza tabella»; tutte le coppie posizione ×
  contratto; ogni intenzione di risposta raggiunta da una domanda reale; nessuna risposta con
  numeri rotti; determinismo; le sei fonti che compilano insieme;
- `python3 prova-modello.py` — **29 asserzioni superate**, chiamata reale al gateway inclusa: gli
  importi di tutte le 11 righe della busta riconosciuti, le invenzioni fermate (`999.999,99 €`,
  la voce `M99`, un fondo inesistente), i prompt sotto i 24.000 caratteri e senza HTML, la risposta
  in italiano entro il minuto (letture misurate 1,7-2,2 s, risposte 2-6 s);
- QA in browser reale: `prova-stati.html#1…14` pilota coda, posizione, esame in corso, voci,
  conti, voci mancanti, «rileggi con il contratto», domande, part-time, busta pulita, guardia sulle
  cifre del modello e guida — **14/14 passati, zero errori di script** (modello disinserito con
  `?noai=1`, perché le prove della UI non devono dipendere dalla rete). Ogni stato asserisce anche
  che le sezioni tagliate non ricompaiano (`#verdetto`, `#contratti`, `#mappa`, `.cand`,
  `.clausola`, `#nota-blocco`);
- QA **da link condiviso** (tunnel HTTPS): pagina 200 con 6 script; `/api/stato` dice
  `token: true, token_ammesso: false` a chi non ha il token; `/api/leggi` senza token → 401 con il
  motivo scritto; con `?t=` → lettura scritta dal modello e cifre tutte del documento; in browser
  il token prende da `?t=`, resta in `sessionStorage` e una pagina aperta senza token scrive
  «link senza token» invece di fingersi rotta;
- QA in browser **col modello acceso**, da `http://127.0.0.1:8791`: chip in testata
  `modello: DeepSeek-V4-Flash`, lettura scritta in 2-4 s e risposta a una domanda in 2-6 s,
  firma con i secondi corsi, «cifre e codici tutti del documento» nei percorsi provati; domande
  scritte a mano (tema, codice, cifra) e nessun scorrimento orizzontale a 390px;
- sicurezza: nessuna chiave nel codice (`grep` sul cartello js/css/html/modello = 0), nessuna chiave
  nel corpo delle risposte `/api`, il server ascolta solo su `127.0.0.1:8791` (`lsof`).
