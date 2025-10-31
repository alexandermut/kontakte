# Kontaktmanager

Ein moderner Kontaktmanager mit VCF-Support, gebaut mit Vanilla JavaScript.

## Features

- ✅ **Kontaktverwaltung** - Erstellen, Bearbeiten, Löschen von Kontakten
- ✅ **vCard 3.0 Support** - Import/Export von VCF-Dateien
- ✅ **Private & Geschäftliche Daten** - Getrennte Tabs für private und berufliche Informationen
- ✅ **Social Media Profile** - Badge-System für 12 Social-Media-Plattformen
- ✅ **Erweiterte Felder** - Nickname, URL, Notizen, Geburtstag, Kategorien
- ✅ **Favoriten** - Markiere wichtige Kontakte als Favoriten
- ✅ **Suche & Filter** - Durchsuche alle Felder, filtere nach Kategorien
- ✅ **Sortierung** - Sortiere nach Name, Firma, E-Mail, etc.
- ✅ **Bulk-Aktionen** - Mehrfachauswahl und Export
- ✅ **Dark/Light Theme** - Automatisches Theme-Switching
- ✅ **LocalStorage** - Alle Daten bleiben lokal im Browser gespeichert
- ✅ **Responsive Design** - Funktioniert auf Desktop und Mobile

## Installation

1. Repository klonen oder Dateien herunterladen
2. `index.html` in einem modernen Browser öffnen
3. Fertig! Keine Build-Tools oder Dependencies nötig

Für beste Performance mit einem lokalen Webserver öffnen:
```bash
python3 -m http.server 8000
```
Dann öffne: http://localhost:8000

## Verwendung

### Kontakt erstellen
- Klicke auf "Neuer Kontakt" oder drücke `Ctrl/Cmd + N`
- Fülle die gewünschten Felder aus (Nachname ist Pflichtfeld)
- Klicke auf "Speichern"

### Social Media hinzufügen
- Doppelklick auf eine Plattform-Badge
- Username eingeben (ohne @)
- Enter drücken zum Speichern
- Einzelklick auf aktive Badge öffnet das Profil

### Import/Export
- **Import**: Klicke auf "Importieren" und wähle eine VCF-Datei
- **Export**: Klicke auf "Exportieren" für alle Kontakte oder wähle spezifische Kontakte aus

### Tastaturkürzel
- `Ctrl/Cmd + N` - Neuer Kontakt
- `Ctrl/Cmd + F` - Suche fokussieren
- `Ctrl/Cmd + E` - Kontakte exportieren
- `Escape` - Modal schließen

## Technologie

- **Vanilla JavaScript** (ES6+ Modules)
- **Proxy-based Reactive State** - Automatische UI-Updates
- **Event Delegation** - Effiziente Event-Handhabung
- **CSS Grid & Flexbox** - Modernes Layout
- **CSS Custom Properties** - Theme-System
- **vCard 3.0 Standard** - Kompatibel mit allen gängigen Kontakt-Apps

## Datenschutz

Alle Daten werden ausschließlich lokal im Browser (LocalStorage) gespeichert. Es werden keine Daten an Server gesendet.

## Browser-Unterstützung

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Lizenz

MIT
