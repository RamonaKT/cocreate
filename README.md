# cocreate
Uniprojekt: Kollaborationstool in Form einer Mindmap

# projekt beschreibung

# für die girls
wenn probleme mit container:
node_modules löschen
package-lock.json löschen
npm install
npm run build

npm start ->  für ohne container

# container starten
docker an machen
docker build -t cocreate-app .   -> wenn kein cache dann docker build --no-cache -t cocreate-app .
docker run -p 1235:1235 -p 3000:3000 cocreate-app

# projekt teilnehmer


# projekt setup


# projekt struktur
my-project/
│
├── frontend/
│   ├── public/               # Statische Dateien (z.B. index.html, Favicon, Bilder)
│   ├── src/
│   │   ├── components/       # Wiederverwendbare UI-Komponenten
│   │   ├── pages/            # Seiten/Views
│   │   ├── styles/           # CSS/SCSS-Dateien
│   │   ├── assets/           # Bilder, Fonts, Icons etc.
│   │   ├── utils/            # Hilfsfunktionen
│   │   ├── App.js
│   │   └── index.js
│   └── tests/                # Frontend-Tests (unit/component/integration)
│
├── backend/
│   ├── controllers/          # Routen-Logik
│   ├── models/               # Datenmodelle
│   ├── routes/               # API-Endpunkte
│   ├── services/             # Business-Logik
│   ├── utils/                # Hilfsfunktionen
│   ├── middleware/           # Authentifizierung, Fehlerbehandlung
│   ├── app.js                # Einstiegspunkt
│   └── tests/                # Backend-Tests (unit/integration)
│
├── config/                   # Konfigurationsdateien (z.B. .env, DB, API-Keys)
│   ├── dev.env
│   ├── prod.env
│   └── test.env
│
├── .gitignore
├── package.json
├── README.md
└── jest.config.js            # Beispiel für Testkonfiguration


