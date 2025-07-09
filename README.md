# CoCreate Mindmap – Kollaboratives Mindmap-Tool
Ein webbasiertes kollaboratives Mindmap-Tool, das es mehreren Nutzern ermöglicht, in Echtzeit gemeinsam an Mindmaps zu arbeiten. Die Anwendung nutzt Supabase für das Backend und Socket.io für Echtzeitkommunikation.

# Projektstruktur

.
├── backend/ # Backend-Logik mit Supabase und Tests
│ ├── supabase/ # Supabase-Client und DB-Logik
│ ├── tests/unit/ # Unit-Tests für Hashing & Skript-Logik
│ └── server.js # Einstiegspunkt des Backends
│
├── dist/ # Build-Ordner für Deployment
│ ├── assets/ # Build-Version der Assets
│ └── index.html # Build-Version des Frontends
│
├── frontend/src/ # Quellcode für das Frontend
│ ├── assets/ # Icons & Logos
│ ├── scripts/ # Zentrale Logik fürs Frontend (Mindmap, Hashing, Sockets etc.)
│ └── styles/ # CSS-Dateien
│
├── index.html # Haupt-HTML-Datei
├── .env # Umgebungsvariablen
├── Dockerfile # Für Containerisierung
├── eslint.config.js # Linting-Konfiguration
├── package.json # NPM-Paketinformationen
└── README.md # Dieses Dokument


## Features
- Echtzeit-Zusammenarbeit an Mindmaps
- WebSockets für Live-Synchronisierung
- Benutzerfreundliches Frontend
- Supabase als Datenbank
- Unit-Tests für kritische Komponenten

## Setup

### Voraussetzungen
- Node.js installiert
- Supabase-Account & Projekt
- (Optional) Docker für Container-Deployment

### Installation + Ausführung
1.	“npm install” im Terminal ausführen
2.	“npm run build” im Terminal ausführen
3.	“npm start” im Terminal ausführen 
4.	http://localhost:1235 im Browser öffnen

### Mit Docker:
1.	“npm install” im Terminal ausführen
2.	Docker desktop starten
3.	“docker build -t cocreate-app-prod" im Terminal ausführen
4.	“docker run -p 1235:1235 -p 3000:3000 cocreate-app-prod" im Terminal ausführen
5.	http://localhost:1235 im Browser öffnen

## Zugang über Browser (falls möglich):
1.	Mit Cisco Secure Client mit dem Hochschul-Server der DHBW Mannheim verbinden
2.	http://141.72.13.151:8202 im Browser öffnen

