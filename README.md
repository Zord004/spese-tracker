# Spese — conto personale

Tracker di spese personali che usa **Notion come database**. Interfaccia web
installabile come app (PWA), utilizzabile offline. 
Backend Node.js/Express, frontend in JavaScript senza framework.

L'idea: registri spese ed entrate da un'unica app veloce sul telefono o sul PC,
i dati vivono nel tuo Notion (dove puoi sempre consultarli e correggerli), e
l'app ci costruisce sopra bilanci, grafici e un report.

## Funzionalità

- **Sincronizzazione con Notion**, bidirezionale, con **coda offline**: registri
  anche senza rete e l'app sincronizza appena torna online.
- **PWA installabile**: si aggiunge alla schermata Home e funziona offline
  (app-shell in cache, font self-hosted). Online l'app si aggiorna da sola:
  codice e stili vengono sempre scaricati prima, la cache serve solo senza rete.
- **Spese ricorrenti** (abbonamenti, affitto) con periodicità libera e
  **ammortamenti** su più mesi (es. un acquisto grande spalmato su 24 mesi).
- **Budget** complessivo, sulla spesa variabile e **per singola categoria**, con
  barre che virano da navy a ottone a rosso all'avvicinarsi del limite.
- **Previsione di fine mese**: stima quanto spenderai entro il 30/31, sommando la
  parte certa (spese registrate, ricorrenti, rate) a quella attesa dalle tue
  abitudini passate, con fascia di incertezza e indice di affidabilità.
- **Simulatore "what-if"**: inserisci una spesa ipotetica (anche a rate) e vedi
  subito l'impatto su previsione, saldo, risparmio e budget, con un verdetto
  *sostenibile / attenzione / fuori limite*. Non salva nulla.
- **Layout adattivo**: su telefono una colonna verticale con barra in basso e
  controlli da toccare; su desktop barra laterale, schede su più colonne, moduli
  come finestre centrate e azioni sulle righe al passaggio del mouse.
- **Analisi**: ripartizione per categoria (con filtro per mese), andamento a 6
  mesi, tasso di risparmio, con tooltip informativi al tocco su ogni grafico.
- **Multi-valuta**: registri in valuta estera, l'app converte in euro al tasso del giorno.
- **Tema** chiaro, scuro o automatico secondo il sistema.
- **Modifica rapida**: un tap sull'importo di una riga lo corregge al volo.
- **Swipe** sulle righe per clonare o eliminare al volo.

### Come funziona la previsione (e i suoi limiti)

Spesa prevista = **parte certa** (una tantum già registrate + ricorrenti + quote di
ammortamento) + **parte attesa** (ritmo giornaliero × giorni rimanenti). Il ritmo
mescola il passo del mese in corso con la mediana dello storico; all'inizio del
mese pesa lo storico, a fine mese pesa il mese in corso. È una **stima statistica,
non una garanzia**: un acquisto imprevisto la supera, e con meno di 3 mesi di
storico l'affidabilità è segnalata come media o bassa. Il simulatore usa le stesse
regole mensili del resto dell'app, quindi i numeri sono coerenti tra le schermate.

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


## Cosa non è supportato (e perché)

- **Multiutente**: l'app è personale (un solo database Notion, una credenziale).
- **Background Sync API** e **feedback aptico**: non supportati da Safari su iOS.
