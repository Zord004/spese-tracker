# Immagine leggera, indipendente dalla versione di Node sul PC
FROM node:20-alpine

WORKDIR /app

# Installa solo le dipendenze di produzione (cache-friendly)
COPY package*.json ./
RUN npm ci --omit=dev

# Copia il resto dell'app
COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
