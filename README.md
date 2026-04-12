# 💰 Expense Tracker

Expense tracker locale con ammortamento e sincronizzazione Notion.

## Architettura

```
spese-tracker/
├── index.html                 ← Entry point (solo markup)
├── css/styles.css             ← Stili separati
├── js/
│   ├── app.js                 ← Controller (routing, orchestrazione)
│   ├── constants.js           ← Configurazione (categorie, opzioni)
│   ├── utils.js               ← Funzioni pure (formatting, date, uid)
│   ├── store.js               ← Persistenza (Notion API + localStorage fallback)
│   ├── models.js              ← Business logic (ammortamenti, aggregazioni)
│   └── views/
│       ├── dashboard.js       ← Vista riepilogo
│       ├── list.js            ← Lista spese con filtri
│       ├── amortization.js    ← Timeline ammortamenti
│       ├── settings.js        ← Impostazioni e gestione dati
│       └── form.js            ← Bottom sheet aggiungi/modifica
├── server/
│   └── index.js               ← Express server (ponte con Notion API)
├── package.json
├── .env.example
└── README.md
```

### Separation of Concerns

| Layer | File | Responsabilità |
|-------|------|----------------|
| **View** | `views/*.js` | Rendering HTML, binding eventi UI |
| **Controller** | `app.js` | Routing, orchestrazione tra views e store |
| **Model** | `models.js` | Calcoli ammortamento, aggregazioni, logica di business |
| **Store** | `store.js` | Persistenza dati (Notion primary, localStorage cache) |
| **Config** | `constants.js` | Categorie, opzioni ammortamento, chiavi storage |
| **Utils** | `utils.js` | Funzioni pure senza side-effects |
| **Server** | `server/index.js` | REST API che fa da ponte con Notion SDK |

## Setup

### 1. Installa dipendenze

```bash
npm install
```

### 2. Crea una Notion Integration

1. Vai su [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Clicca **"New integration"**
3. Dai un nome (es. "Spese Tracker")
4. Seleziona il workspace dove hai il database
5. Copia il **Internal Integration Secret** (`secret_...`)

### 3. Connetti il database alla integration

1. Apri il database "💰 Le mie spese" su Notion
2. Clicca **⋯** (tre puntini) in alto a destra → **Connections** → **Connect to** → seleziona la tua integration

### 4. Configura il file .env

```bash
cp .env.example .env
```

Apri `.env` e inserisci:
- `NOTION_TOKEN` → il secret copiato al punto 2
- `NOTION_DATABASE_ID` → l'ID del database (lo trovi nell'URL di Notion: `notion.so/QUESTO_ID?v=...`)

### 5. Avvia

```bash
npm start
```

Apri **http://localhost:3000** nel browser.

## Come funziona

### Sincronizzazione

- **Notion è la fonte primaria**: ogni operazione (aggiungi, modifica, elimina) viene eseguita prima su Notion, poi la cache locale viene aggiornata.
- **localStorage come fallback**: se il server non è raggiungibile, l'app funziona comunque con i dati in cache.
- L'indicatore in alto mostra lo stato: 🟢 Notion connesso, 🔴 Offline.

### Ammortamento

Per ogni spesa puoi impostare un periodo di ammortamento (3 mesi → 5 anni). L'app calcola automaticamente il costo mensile effettivo e mostra:
- il costo ammortizzato totale del mese corrente nella dashboard
- la barra di progresso per ogni spesa ammortizzata
- la timeline completa nella vista "Ammortamenti"

### Accesso da iPhone

Siccome il server gira in locale, per accedere da iPhone sulla stessa rete WiFi:

1. Trova l'IP locale del PC (es. `192.168.1.100`)
2. Da iPhone apri Safari → `http://192.168.1.100:3000`
3. Facoltativo: Safari → Condividi → "Aggiungi alla schermata Home"

## Tech Stack

- **Frontend**: Vanilla JS (ES Modules), CSS custom properties
- **Backend**: Express.js
- **Database**: Notion API via `@notionhq/client`
- **Persistenza locale**: localStorage
