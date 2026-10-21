# Changelog

Tutte le modifiche di rilievo, dalla più recente.

## 9.8.0

- **Correzione importante: gli aggiornamenti ora arrivano davvero.** Il service
  worker serviva i file dalla cache prima della rete, con un nome di cache mai
  cambiato dalla v9.4: i dispositivi che avevano già installato l'app continuavano
  a mostrare il codice vecchio dopo ogni deploy. Ora codice e stili vengono
  scaricati prima dalla rete (la cache serve solo offline) e la versione dell'app
  è scritta automaticamente nel service worker, che quindi cambia a ogni release e
  scarta la cache precedente. Dopo questo aggiornamento può servire aprire l'app
  due volte per passare alla versione nuova; poi non servirà più.
- **Previsione di fine mese.** Stima della spesa totale: parte certa + spesa
  attesa dal ritmo storico (mediana robusta agli acquisti eccezionali), con fascia
  di incertezza e affidabilità. Card in *Conto* e scheda *Analisi → Previsione*
  (composizione, ritmo, storico, saldo previsto).
- **Simulatore what-if** (*Analisi → Simulatore*). Impatto in tempo reale di una
  spesa ipotetica, una tantum o a rate, su spesa prevista, saldo, tasso di
  risparmio, budget variabile e budget di categoria, con verdetto e stima dei
  mesi di risparmio necessari per recuperarla.
- **Layout desktop.** Da 1024 px: barra laterale, schede su 2–3 colonne, form e
  report come finestre centrate, azioni di riga al passaggio del mouse. Layout
  intermedio per tablet.
- **Mobile più comodo.** Aree di tocco più ampie (icone ⓘ, frecce del periodo,
  chip), campi a 16 px per evitare lo zoom automatico su iOS, esito del simulatore
  visibile sotto il campo importo anche con la tastiera aperta.
- 31 nuovi test (89 → 120): 26 su previsione e simulatore, 5 sul service worker
  (verificano anche che ogni modulo dell'app sia nel precache).

## 9.7.1 — Correzioni da audit

- **Ricorrenza personalizzata ora salvata correttamente.** "Ogni N mesi" veniva
  scritta su Notion come "Mensile" (perdita di dato, costo mensile sballato).
- **Grafici coerenti.** Il grafico del tasso di risparmio, `fissi/variabili`, la
  barra del budget variabile, i budget per categoria e la proiezione del saldo
  ora usano tutti la stessa regola mensile della "Spesa del mese": ricorrenti e
  ammortamenti contano come quota in ogni mese attivo. Prima alcune sezioni
  mostravano cifre incoerenti tra loro.
- **Ricerca**: non perde più il focus mentre si scrive.
- **Import**: i movimenti importati vengono ora davvero aggiunti a Notion (prima
  restavano solo in cache e sparivano alla sincronizzazione successiva).
- **Offline più robusto**: niente doppio invio in caso di sync concorrenti;
  modificare o eliminare un movimento non ancora sincronizzato non perde più la
  modifica né lo ricrea per errore.
- **Date**: attribuzione di mese/anno indipendente dal fuso orario; le date
  future non mostrano più "-3g fa".
- **Pulizia**: rimosso codice e import inutilizzati.

## 9.7.0

- **Descrizione facoltativa per le entrate.** Registrando un'entrata, la
  descrizione non è più obbligatoria: se lasciata vuota, il movimento prende il
  nome generico "Entrata". Per le spese resta obbligatoria.
- **Tooltip informativi sui grafici.** Oltre ai valori di barre e fette (già
  mostrati al tocco), ogni grafico ha ora un'icona ⓘ che, toccata, spiega cosa
  rappresenta: savings rate, ripartizione per categoria, andamento a 6 mesi e
  tasso di risparmio.
- **Modifica rapida dell'importo.** Un tap sull'importo di una riga (in *Conto* o
  *Movimenti*) permette di correggerlo al volo, senza aprire il form.
- **Filtro per periodo nell'analisi.** La sezione "Per categoria" ha un
  navigatore di mesi (‹ ›) per vedere la ripartizione di un mese specifico, non
  solo di quello corrente.

## 9.6.0

- **Ripartizione per categoria ora mensile.** Sia in *Conto* sia in *Analisi*,
  la ripartizione mostra la spesa del mese corrente (stessa regola di "Spesa del
  mese"), non più i totali di tutto lo storico. La somma coincide con la spesa
  del mese e col totale del grafico a ciambella.

## 9.5.1

- **Fix conteggio spese ricorrenti nel grafico Andamento.** Le ricorrenti
  venivano conteggiate solo nel mese d'inserimento, non nei mesi successivi.
  Introdotta una regola unica di addebito mensile (ricorrenti dal mese d'origine
  in poi, ammortamenti come quota mensile, una tantum nel loro mese); la barra
  del mese corrente ora coincide con la Home.

## 9.5.0 — Irrobustimento sicurezza

A seguito di un audit del codice:

- **Autenticazione obbligatoria in produzione** (`NODE_ENV=production`): senza
  `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` il server non parte.
- **Freno al brute-force**: rate limiter sui tentativi di autenticazione.
- **Nessuna esposizione del codice server**: gli asset client vivono in
  `public/`; server, test e configurazioni non sono più scaricabili.
- **CSP irrigidita**: rimossi `'unsafe-eval'` e i domini CDN (tutto self-hosted).
- **Messaggi d'errore generici** dalle API.

## 9.4.0

- **Suite di test** con `node:test` (nessuna dipendenza) su tutti i calcoli.
- **Budget per categoria** con barre colorate (navy → ottone → rosso).
- **Controllo dei tipi** via JSDoc + `checkJs`, senza build step.
- **Integrazione continua** con GitHub Actions su Node 20 e 22.
- Fix di un bug in `addMonths` (fine mese: 31 gennaio + 1 mese).

## 9.3.0

- **PWA offline completa** con service worker e font self-hosted.
- **Sync robusto**: pacing e backoff esponenziale sul rate limit di Notion,
  svuotamento automatico della coda al ritorno online.
- **Proiezione del saldo** a fine mese.
- **Tema automatico** secondo il sistema (chiaro/scuro).
- **Swipe** sulle righe per clonare o eliminare.
- **Multi-valuta** con conversione al tasso del giorno (Frankfurter).

## 9.2.0

- Migrazione della cache e della coda offline a **IndexedDB** (localforage).
- **Schema dinamico** letto da Notion, con aggiornamento a caldo.
- **Barra del budget** sulla spesa variabile.
- **Grafico del tasso di risparmio**.
- **Docker** e configurazione per l'hosting cloud.

## 9.1.0 e precedenti

- Redesign "istituzionale" (tema chiaro stile estratto conto, font sobri).
- Report per il commercialista (730/Unico) con detraibilità.
- Ammortamenti e spese ricorrenti.
- Sincronizzazione con Notion e coda offline.
