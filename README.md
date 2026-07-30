# Spese — conto personale

[![CI](https://github.com/Zord004/spese-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Zord004/spese-tracker/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installabile-1c3d5c)
![Versione](https://img.shields.io/badge/versione-9.5.1-9a7c3b)

Tracker di spese personali con sincronizzazione su Notion.
Backend Node.js/Express, frontend vanilla JS. PWA installabile e utilizzabile offline.

## Correzioni v9.5.1

**Spese ricorrenti nel grafico Andamento.** Le ricorrenti (abbonamenti, affitto…)
venivano conteggiate solo nel mese in cui erano state inserite, non nei mesi
successivi: il grafico degli ultimi 6 mesi mostrava mesi vuoti e non coincideva
con la "Spesa del mese" in Home. Ora una regola unica imputa a ogni mese la quota
corretta — ricorrenti da ogni mese dall'origine in poi, ammortamenti come quota
mensile, spese una tantum nel loro mese — e la barra del mese corrente nel grafico
coincide con la Home.

## Novità v9.5 — irrobustimento sicurezza

A seguito di un audit del codice sono state applicate cinque patch:

- **Autenticazione obbligatoria in produzione.** Con `NODE_ENV=production`, se
  mancano `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` il server **non parte**: l'app non
  può più finire online senza protezione per una svista. In sviluppo, se l'auth è
  spenta, un avviso lo segnala all'avvio.
- **Freno al brute-force.** Rate limiter sui tentativi di autenticazione (per IP);
  la navigazione normale non viene mai frenata.
- **Nessuna esposizione del codice server.** Gli asset client vivono ora in
  `public/` e il server serve solo quella cartella: `server/`, `test/`,
  `package.json`, `Dockerfile` ecc. non sono più scaricabili.
- **CSP irrigidita.** Rimossi `'unsafe-eval'` e i domini CDN non più necessari
  (tutto è self-hosted): `script-src 'self'`.
- **Messaggi d'errore generici.** Le API non restituiscono più i dettagli interni
  degli errori al client.

## Novità v9.4

**Suite di test.** 72 test con `node:test` (integrato in Node 20+, nessuna
dipendenza aggiuntiva) su tutti i calcoli che riguardano i soldi: ammortamenti,
ricorrenze, report fiscale, proiezione del saldo, tasso di risparmio, budget.

> I test hanno subito ripagato: hanno scovato un bug in `addMonths`. Una spesa
> datata **31 gennaio** con ammortamento a 4 mesi finiva in
> `['2026-01', '2026-03', '2026-03', '2026-04']` — febbraio saltato, marzo
> contato due volte. Colpiva ogni acquisto fatto il 29, 30 o 31 del mese.
> Corretto, con test di regressione a presidio (anno bisestile incluso).

**Budget per categoria.** In *Altro → Finanze → Budget per categoria* si fissa un
tetto mensile per ogni categoria. Nella schermata *Conto* compare una sezione con
le barre che virano da navy a ottone a rosso man mano che ci si avvicina al
limite, con l'indicazione di quanto resta o di quanto si è sforato. Le spese
ricorrenti pesano con la loro quota mensile.

**Controllo dei tipi senza TypeScript.** Annotazioni JSDoc più `checkJs`: si
ottiene il controllo dei tipi nell'editor e in CI senza rinominare i file, senza
build step e senza toccare il deploy. I tipi condivisi stanno in `js/types.js`.

Il controllo ha ripulito imprecisioni reali: sottrazioni implicite fra oggetti
`Date`, `parseInt()` applicato a valori già numerici, e soprattutto due endpoint
che non gestivano i parametri ripetuti nella query string (`?amount=1&amount=9`
arriva come array, non come stringa).

**Integrazione continua.** Il workflow in `.github/workflows/ci.yml` esegue
controllo dei tipi e test a ogni push su `main`, su Node 20 e 22.

## Comandi

```bash
npm install
cp .env.example .env    # token Notion e ID database
npm start               # avvia su http://localhost:3000

npm test                # suite di test
npm run test:watch      # test in watch mode
npm run typecheck       # controllo dei tipi
npm run check           # tipi + test (come in CI)
```

Da iPhone sulla stessa WiFi: `http://IP-DEL-PC:3000`.
Dopo un aggiornamento, svuota la cache di Safari.

## Funzionalità

- **Sincronizzazione Notion** bidirezionale, con coda offline e ripristino
  automatico al ritorno della connessione
- **PWA installabile**: app-shell in cache, font self-hosted, funziona offline
- **Ammortamenti** su più mesi e **spese ricorrenti** con periodicità libera
- **Report per il commercialista** (730/Unico) con detraibilità e percentuali
- **Proiezione del saldo** a fine mese basata su entrate e ricorrenze
- **Budget** complessivo, sulla spesa variabile e per singola categoria
- **Multi-valuta** con conversione al tasso del giorno
- **Tema chiaro/scuro** o automatico secondo il sistema
- **Swipe** sulle righe per clonare o eliminare

## Con Docker

```bash
cp .env.example .env
docker compose up --build
```

## Deploy in cloud

1. Push del repo su GitHub.
2. Su Render: "New → Blueprint", punta al repo (usa `render.yaml`).
3. Inserisci `NOTION_TOKEN` e `NOTION_DATABASE_ID`.
4. Consigliato: `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` per proteggere l'app.

I piani gratuiti mettono l'app in pausa dopo un periodo di inattività: il primo
caricamento dopo la pausa può richiedere qualche secondo.

## Colonne Notion opzionali (multi-valuta)

L'app funziona senza, ma per vedere su Notion anche la valuta e l'importo
originale, aggiungi due colonne al database:

- **Valuta** — tipo *Select* (EUR, USD, GBP, JPY, CHF, CAD, AUD, SEK, NOK, DKK)
- **Importo originale** — tipo *Number*

Finché non esistono, il server le salta senza errori e salva comunque l'importo
convertito in € nella colonna *Importo*.

## Categorie dinamiche

Aggiungendo categorie su Notion, usa *Altro → Dati → "Aggiorna schema da Notion"*
invece di riavviare il server.

## Cosa non è supportato (e perché)

- **Background Sync API** — non supportata da Safari su iOS in nessuna versione.
  Sostituita dallo svuotamento della coda all'evento `online`.
- **Feedback aptico (`navigator.vibrate`)** — non supportato nativamente da
  Safari su iOS; gli unici workaround sono polyfill fragili.

## Copertura dei test

Coperti: `js/models.js` e `js/utils.js`, cioè tutti i calcoli.
Non coperti: la validazione lato server e lo `store` (richiedono rispettivamente
un'istanza Notion e IndexedDB), e il rendering delle viste.
