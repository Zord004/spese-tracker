# Spese — conto personale

[![CI](https://github.com/Zord004/spese-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Zord004/spese-tracker/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installabile-1c3d5c)
![Versione](https://img.shields.io/badge/versione-9.7.0-9a7c3b)

Tracker di spese personali che usa **Notion come database**. Interfaccia web
installabile come app (PWA), utilizzabile offline, con estetica sobria da
estratto conto. Backend Node.js/Express, frontend in JavaScript senza framework.

L'idea: registri spese ed entrate da un'unica app veloce sul telefono o sul PC,
i dati vivono nel tuo Notion (dove puoi sempre consultarli e correggerli), e
l'app ci costruisce sopra bilanci, grafici e un report per il commercialista.

## Funzionalità

- **Sincronizzazione con Notion**, bidirezionale, con **coda offline**: registri
  anche senza rete e l'app sincronizza appena torna online.
- **PWA installabile**: si aggiunge alla schermata Home e funziona offline
  (app-shell in cache, font self-hosted).
- **Spese ricorrenti** (abbonamenti, affitto) con periodicità libera e
  **ammortamenti** su più mesi (es. un acquisto grande spalmato su 24 mesi).
- **Budget** complessivo, sulla spesa variabile e **per singola categoria**, con
  barre che virano da navy a ottone a rosso all'avvicinarsi del limite.
- **Proiezione del saldo** a fine mese, basata su entrate e spese ricorrenti.
- **Analisi**: ripartizione per categoria (con filtro per mese), andamento a 6
  mesi, tasso di risparmio, con tooltip informativi al tocco su ogni grafico.
- **Report per il commercialista** (730/Unico) con detraibilità e percentuali.
- **Multi-valuta**: registri in valuta estera, l'app converte in euro al tasso
  del giorno.
- **Tema** chiaro, scuro o automatico secondo il sistema.
- **Modifica rapida**: un tap sull'importo di una riga lo corregge al volo.
- **Swipe** sulle righe per clonare o eliminare al volo.

## Anteprima

| Conto | Analisi | Tema scuro |
|-------|---------|-----------|
| ![Conto](docs/screenshots/conto.png) | ![Analisi](docs/screenshots/analisi.png) | ![Tema scuro](docs/screenshots/scuro.png) |

## Avvio rapido

```bash
npm install
cp .env.example .env      # inserisci token Notion e ID del database
npm start                 # http://localhost:3000
```

Da telefono sulla stessa WiFi: `http://IP-DEL-PC:3000`.

## Il database Notion

L'app legge e scrive su un database Notion. Servono un'**integrazione** (per il
token) e un database con le colonne attese.

### 1. Crea l'integrazione e condividi il database

1. Crea un'integrazione su <https://www.notion.so/my-integrations> e copia il
   token (`ntn_...`) in `.env` come `NOTION_TOKEN`.
2. Nel database Notion: menù `•••` → *Connections* → aggiungi l'integrazione.
3. Copia l'ID del database dall'URL (la parte prima di `?v=`) in
   `NOTION_DATABASE_ID`.

### 2. Le colonne del database

Queste sono le proprietà che l'app usa. Il server è tollerante: se una colonna
**opzionale** manca, la ignora senza errori. Le colonne **base** servono perché
l'app sia utile.

| Colonna | Tipo Notion | Ruolo |
|---|---|---|
| **Nome** | Title | Descrizione del movimento *(base)* |
| **Importo** | Number | Importo in € *(base)* |
| **Data** | Date | Data del movimento *(base)* |
| **Categoria** | Select | Categoria (le opzioni sono libere) *(base)* |
| **Tipo** | Select | `Spesa` / `Entrata` *(base)* |
| **Natura** | Select | `Variabile` / `Fisso` |
| **Ricorrenza** | Select | `Nessuna` / `Giornaliera` / `Mensile` / `Trimestrale` / `Annuale` |
| **Mesi ammortamento** | Number | 1 = nessun ammortamento |
| **Note** | Text | Note libere |
| **Luogo** | Text | Luogo (per la ricerca) |
| **Detraibile** | Checkbox | Per il report fiscale |
| **% Detrazione** | Number | Percentuale di detrazione |
| **Utilizzi** | Number | Per il costo per utilizzo |
| **Valuta** | Select | *(opzionale)* multi-valuta: EUR, USD, GBP, JPY, CHF, CAD, AUD, SEK, NOK, DKK |
| **Importo originale** | Number | *(opzionale)* importo nella valuta originale |

> Suggerimento: le opzioni delle categorie le definisci tu su Notion; l'app le
> legge dallo schema. Dopo averle cambiate, usa *Altro → Dati → "Aggiorna schema
> da Notion"* invece di riavviare il server.

### 3. Template (opzionale)

Per evitare di ricreare il database a mano puoi partire da un template già
pronto con le colonne corrette:

<!-- Inserisci qui il link a una tua pagina Notion pubblica condivisibile:
     "Duplica questo template nel tuo workspace e copia il suo ID". -->
`(link al template Notion da inserire)`

## Comandi utili

```bash
npm start            # avvia il server
npm test             # suite di test
npm run typecheck    # controllo dei tipi (JSDoc + checkJs)
npm run check        # tipi + test (come in CI)
```

## Con Docker

```bash
cp .env.example .env
docker compose up --build
```

## Deploy in cloud

1. Push del repo su GitHub.
2. Su Render: *New → Blueprint*, punta al repo (usa `render.yaml`).
3. Inserisci `NOTION_TOKEN` e `NOTION_DATABASE_ID`.
4. Imposta `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` per proteggere l'app: con
   `NODE_ENV=production` (già nel `render.yaml`) sono **obbligatorie**.

I piani gratuiti mettono l'app in pausa dopo inattività: la prima apertura dopo
la pausa può richiedere qualche secondo.

## Sicurezza

L'app è pensata per uso personale, protetta da HTTP Basic Auth su HTTPS.
In produzione l'autenticazione è obbligatoria, i tentativi di accesso sono
limitati (anti brute-force), la CSP è restrittiva e il codice del server non è
servito pubblicamente. Dettagli nel `CHANGELOG.md` (v9.5.0).

## Cosa non è supportato (e perché)

- **Multiutente**: l'app è personale (un solo database Notion, una credenziale).
- **Background Sync API** e **feedback aptico**: non supportati da Safari su iOS.

## Note tecniche

- Struttura: `public/` (client), `server/` (Express), `test/` (test).
- Nessun framework frontend; grafici in SVG disegnati a mano.
- Cronologia completa delle versioni: [CHANGELOG.md](CHANGELOG.md).
