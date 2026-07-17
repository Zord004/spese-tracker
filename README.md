# Spese — conto personale (v9.2)

Tracker di spese personali con sincronizzazione su Notion.
Backend Node.js/Express, frontend vanilla JS.

## Novità v9.2

**Storage — IndexedDB.** La cache dei movimenti, la coda di sincronizzazione
offline e la geocache ora usano IndexedDB (via `localforage`, vendorizzato in
`js/vendor/`) invece di `localStorage`: scritture asincrone che non bloccano
l'interfaccia e nessun limite pratico di dimensione. Le impostazioni scalari
(tema, budget, entrata) restano su localStorage. La migrazione dai dati vecchi
è automatica al primo avvio.

**Schema dinamico da Notion.** Il server legge le categorie dallo schema del
database all'avvio e le tiene in cache. Se aggiungi una categoria su Notion,
premi *Altro → Dati → "Aggiorna schema da Notion"*: l'app la rileva senza
riavviare il server. Alle categorie nuove viene assegnato un colore in automatico.

**Barra budget spesa variabile.** In *Altro → Finanze* puoi impostare un limite
di spesa variabile mensile; nell'intestazione del conto compare una barra che si
riempie (navy → ottone → rosso quando sfori).

**Grafico tasso di risparmio.** In *Analisi → Andamento*, un grafico a barre
mostra il tasso di risparmio degli ultimi 6 mesi (richiede l'entrata mensile
impostata). Disegnato in SVG, nessuna dipendenza aggiuntiva.

**Docker & hosting.** `Dockerfile` + `docker-compose.yml` per un setup pulito, e
`render.yaml` per il deploy su Render (Railway/Fly simili). Basic Auth opzionale
per proteggere l'app se la esponi su internet.

## Setup locale

```bash
npm install
cp .env.example .env    # inserisci token Notion e ID database
npm start
```

App su `http://localhost:3000`. Da iPhone (stessa WiFi): `http://IP-DEL-PC:3000`.

## Con Docker

```bash
cp .env.example .env    # compila i valori
docker compose up --build
```

## Deploy in cloud (accesso ovunque)

1. Fai il push del repo su GitHub.
2. Su Render: "New → Blueprint", punta al repo (usa `render.yaml`).
3. Inserisci `NOTION_TOKEN` e `NOTION_DATABASE_ID` nella dashboard.
4. **Consigliato:** imposta anche `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` per
   proteggere l'app con utente/password.

Nota: i piani gratuiti spesso mettono l'app "in pausa" dopo un po' di inattività,
quindi il primo caricamento dopo una pausa può richiedere qualche secondo.

## .env

```
NOTION_TOKEN=ntn_xxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
HOST=0.0.0.0
# BASIC_AUTH_USER=...
# BASIC_AUTH_PASS=...
```

## Note

- Aggiungendo categorie su Notion, usa il pulsante "Aggiorna schema" invece di
  riavviare il server.
- Il service worker è auto-distruttivo (rimuove versioni in cache). L'app resta
  utilizzabile offline grazie a IndexedDB.
