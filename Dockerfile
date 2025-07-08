# 1. Basis-Image
FROM node:18

# 2. Arbeitsverzeichnis
WORKDIR /app

# 3. Package-Dateien kopieren & installieren
COPY package*.json ./
RUN npm install

# 4. Restliche Dateien kopieren
COPY . .

# 5. Vite-Build
RUN npm run build

# 6. Ports freigeben (1235 = Frontend, 3000 = Socket.IO)
EXPOSE 1235
EXPOSE 3000

# 7. App starten (serve + server.js via npm start)
CMD ["npm", "start"]
