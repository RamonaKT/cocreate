# cocreate
Uniprojekt: Kollaborationstool in Form einer Mindmap

# projekt beschreibung


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


