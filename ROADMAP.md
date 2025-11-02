# Projekt-Roadmap: Kontaktmanager

Dieses Dokument beschreibt die Vision, geplante Features und bekannte Probleme der Kontaktmanager-Anwendung.

## 1. Projekt-Vision

Das Ziel ist ein schneller, moderner und benutzerfreundlicher client-seitiger Kontaktmanager. Er soll die einfache Verwaltung von Kontakten ermöglichen und durch VCF-Import/Export eine Brücke zu anderen Geräten und Programmen schlagen. Die Bedienung soll sich an Desktop-Anwendungen orientieren (z.B. durch Shortcuts, Mehrfachauswahl).

---

## 2. Aktuelle Probleme & Bekannte Einschränkungen

### 🐛 Bekannte Bugs (Keine kritischen Bugs!)
*   **Klick-Verzögerung (150ms):** Die Unterscheidung zwischen Einzel- und Doppelklick wird mit einem `setTimeout` gelöst. Dies führt zu einer leichten Verzögerung bei der Auswahl von Kontakten. Mögliche Lösung: Click-Counter statt Timeout.

### ⚠️ Limitierungen
*   **VCF-Felder:** Der VCF-Parser unterstützt noch nicht alle VCF 3.0 Felder:
    - ✅ Unterstützt: FN, N, EMAIL, TEL, ADR, ORG, TITLE, ROLE, URL, BDAY, CATEGORIES, NOTE, VERSION, PHOTO (Base64)
    - ❌ Noch nicht: GEO, TZ, SOUND, ANNIVERSARY, RELATED, mehrere Telefonnummern/E-Mails als Arrays
*   **Performance bei >1000 Kontakten:** Vollständiges Re-Rendering der Liste wird bei sehr vielen Kontakten langsam. Aktuell getestet bis 500 Kontakte ohne Probleme. Lösung: Virtual Scrolling (siehe Sektion 5).
*   **Mobile UX:** Die App ist responsive, aber nicht für Touch optimiert (keine Swipe-Gesten, Button-Größe für Maus optimiert).
*   **Browser-Storage-Limit:** LocalStorage hat ein Limit von ~5-10 MB je nach Browser. Bei >5000 Kontakten könnte dies erreicht werden. Mögliche Lösung: IndexedDB oder Backend-Sync.

### 🔧 Technische Schulden (Refactoring-Bedarf)
*   **Click-Delay-System:** `setTimeout`-basierte Unterscheidung zwischen Single/Double-Click sollte durch Event-Counter ersetzt werden.
*   **Sortierung nicht vollständig persistiert:** Die Funktion `persistSort()` ist implementiert, aber nicht überall aufgerufen (siehe [storage.js:18-23](storage.js#L18-L23)).
*   **Code-Duplikation:** Formular-Validierung (E-Mail, PLZ) sollte in zentrale Validation-Utility ausgelagert werden.
*   **Fehlende Tests:** Keine Unit-Tests vorhanden. Besonders kritisch: VCF-Parser, Duplikatserkennung, Merge-Logik.
*   **Magic Numbers:** Einige Werte sind hard-coded (z.B. Tab-Limit: 5, Debounce: 250ms). Sollten in Konstanten ausgelagert werden.

### ⚡ Performance-Skalierung (für 25.000+ Kontakte)

**Ziel:** App soll 25.000+ Kontakte flüssig verwalten können

**Strategie:** Hybrid-Architektur mit Rust/WebAssembly für CPU-intensive Operationen

**Phase 1: Grundlagen (Voraussetzungen)**
1. **Virtual Scrolling** - Nur 20-30 sichtbare Zeilen rendern (JS)
   - Intersection Observer API
   - Smooth Scrolling trotz 25k+ Kontakte
   - Geschätzte Implementierung: 2-3 Stunden

2. **IndexedDB Migration** - LocalStorage-Limit umgehen
   - Migration von localStorage → IndexedDB
   - Async Storage-API
   - Keine 10 MB Grenze mehr
   - Geschätzte Implementierung: 3-4 Stunden

3. **Web Worker Infrastruktur** - UI-Blocking vermeiden
   - Schwere Operationen in Background-Thread
   - Message-Passing-Interface
   - Geschätzte Implementierung: 2 Stunden

**Phase 2: Rust/WASM Core-Module**
4. **WASM Build-Pipeline** - Entwicklungsumgebung
   - `wasm-pack` Setup
   - Cargo.toml konfigurieren
   - JS/WASM Bridge erstellen
   - Bundle-Size-Optimierung
   - Geschätzte Implementierung: 4-6 Stunden

5. **Duplikat-Detector (Rust)** - Kritischster Bottleneck
   - Parallele Duplikat-Suche mit Rayon
   - Levenshtein Distance
   - Jaro-Winkler für Tippfehler
   - Soundex/Metaphone für phonetische Ähnlichkeit
   - **Performance:** 25k Kontakte in <1s (aktuell: ~45s in JS)
   - Geschätzte Implementierung: 8-10 Stunden

6. **Fuzzy Search Engine (Rust)** - Inverted Index
   - Tantivy Volltext-Suchindex
   - Typo-Toleranz (~2 Buchstaben)
   - Multi-Field Search (Name, E-Mail, Firma, Notizen)
   - **Performance:** Suche in 25k in <10ms (aktuell: ~800ms in JS)
   - Geschätzte Implementierung: 10-12 Stunden

7. **High-Performance Sorting (Rust)** - Radix Sort
   - Radix Sort für große Datensätze
   - Multi-Key Sorting
   - **Performance:** 25k Kontakte in ~12ms (aktuell: ~150ms in JS)
   - Geschätzte Implementierung: 4-5 Stunden

8. **VCF Parser (Rust)** - Schneller Import
   - Paralleles Parsing großer VCF-Dateien
   - Streaming-Parser für >10 MB Dateien
   - **Performance:** 5000-Kontakt-VCF in ~180ms (aktuell: ~2s in JS)
   - Geschätzte Implementierung: 6-8 Stunden

**Phase 3: Optimierungen**
9. **Memory Pool** - Weniger Garbage Collection
   - Objekt-Recycling für Kontakt-Rendering
   - Weniger Memory-Churn

10. **Lazy Loading** - On-Demand Daten laden
    - Social-Media-Badges on demand
    - Avatar-Bilder lazy loaden

**Geschätzter Gesamtaufwand:** ~50-60 Stunden (1-2 Wochen Vollzeit)

**Technologie-Stack:**
- **Rust:** `wasm-bindgen`, `serde`, `rayon`, `tantivy`, `strsim`
- **Build:** `wasm-pack`, `cargo`
- **JS Integration:** Web Workers, SharedArrayBuffer (optional)

**Bundle-Size-Impact:**
- WASM Runtime: ~100 KB (gzipped)
- Core Module: ~200-300 KB (gzipped)
- Gesamt: +400 KB (akzeptabel für die Performance-Gewinne)

---

## 3. Kurzfristige Ziele (Hohe Priorität - Quick Wins)

### 🔥 Produktivität & UX
1. **Undo/Redo-Funktion** - Versehentliche Änderungen rückgängig machen (Ctrl+Z / Ctrl+Y)
   - History-Stack für letzte 20 Aktionen (Löschen, Bearbeiten, Merge)
   - Visual Feedback in Toolbar ("Rückgängig: Kontakt gelöscht")

2. **Batch-Edit für Kategorien** - Mehrere Kontakte gleichzeitig kategorisieren
   - Auswahl → Neue Aktion "Kategorie ändern" in Toolbar
   - Dropdown mit Kategorien → Bulk-Update

3. **Geburtstags-Widget** - Anstehende Geburtstage in den nächsten 30 Tagen
   - Badge in Toolbar mit Counter (z.B. "🎂 3")
   - Klick öffnet Dropdown mit Liste
   - Direkt zu Kontakt springen möglich

4. **Erweiterte Filter** - Zusätzliche schnelle Filter im Dropdown
   - "Ohne Kategorie" (Kontakte ohne Zuordnung finden)
   - "Unvollständige Kontakte" (ohne E-Mail oder Telefon)
   - "Ohne Geburtstag" (fehlende Geburtsdaten)

5. **Kontakt-Avatar-System** - Profilbilder mit Initialen-Fallback
   - Foto-Upload via Click oder Drag & Drop
   - Auto-generierte Initialen-Avatare in 8 Farben (Hash-basiert)
   - Anzeige in Liste (30px) und Tab (80px)

### 📊 Export & Daten
6. **CSV Export** - Alternative zu VCF für Excel/Google Sheets
   - Alle Kontakte oder Auswahl exportieren
   - UTF-8 BOM für Excel-Kompatibilität
   - Spalten-Mapping: Vorname, Nachname, E-Mail, Telefon, etc.

7. **Drag & Drop VCF Import** - Dateien direkt ins Fenster ziehen
   - Visual Feedback beim Hover (gestrichelte Border)
   - Mehrere VCF-Dateien gleichzeitig verarbeiten
   - Progress-Indicator bei großen Importen

8. **Print-View** - Druckbare Kontaktliste generieren
   - Clean Layout ohne UI-Elemente
   - Sortierung & Filter respektieren
   - Optional: Mit/Ohne Adressen

### 🔍 Suche & Navigation
9. **Erweiterte Suche** - Suche auf spezifische Felder einschränken
   - Dropdown neben Suchfeld: "Alle Felder", "Name", "E-Mail", "Firma", "Notizen"
   - URL-Parameter für Deep-Links (z.B. ?search=Max&field=name)

10. **Spalten anpassen** - Spaltenbreite per Drag ändern
    - Resize-Handle zwischen Spalten
    - Breite im localStorage persistieren
    - Reset-Button für Standard-Breiten

---

## 4. Mittelfristige Ziele (UX-Verbesserungen)

### 🎨 Tabellen-Customization
- **Spalten ein-/ausblenden** - Benutzerdefinierte Tabellenansicht
  - Checkboxen in Toolbar: Welche Spalten anzeigen?
  - Mindestens: Name, E-Mail, Telefon immer sichtbar
  - Preferences im localStorage speichern

- **Spalten-Reihenfolge per Drag & Drop** - Flexible Anordnung
  - Spalten-Header sind draggable
  - Visual Feedback beim Drag (Ghost-Element)
  - Reihenfolge persistieren

- **Spalten-Sortierung persistieren** - Sortierung merken
  - Aktuelle Sortierung im localStorage speichern
  - Beim nächsten App-Start wiederherstellen
  - Bereits teilweise implementiert, muss aktiviert werden

### 🔍 Duplikat-Management
- **Duplikat-Scanner** - Alle Duplikate auf einmal finden
  - Neue Ansicht "Duplikate prüfen" im Hauptmenü
  - Liste aller potenziellen Duplikate mit Konfidenz-Score
  - Massenaktionen: "Alle zusammenführen" oder einzeln wählen
  - Fuzzy-Matching für Tippfehler (z.B. "Max" vs "Maxx")

### 📋 Kontakt-Organisation
- **Kontakt-Tags** - Flexible Mehrfach-Kategorisierung
  - Zusätzlich zu festen Kategorien
  - Freie Texteingabe für Tags (z.B. "Kunde", "Partner", "VIP")
  - Mehrere Tags pro Kontakt möglich
  - Tag-Filter in Toolbar (Multi-Select)

- **Benutzerdefinierte Kategorien** - Eigene Kategorien erstellen
  - Settings-Dialog für Kategorien-Verwaltung
  - Hinzufügen, Umbenennen, Löschen, Farben zuweisen
  - Migration bestehender Kontakte bei Kategorie-Änderung

- **Trash/Papierkorb** - Sicherheitsnetz für gelöschte Kontakte
  - Gelöschte Kontakte 30 Tage im Papierkorb behalten
  - Wiederherstellen-Funktion
  - Endgültiges Löschen nach Ablauf oder manuell
  - Badge zeigt Anzahl der gelöschten Kontakte

### 💾 Daten-Management
- **Kontakt-Templates** - Vorlagen für häufige Kontakttypen
  - "Privatkontakt", "Geschäftskontakt", "Lieferant", etc.
  - Vorbefüllte Felder beim Erstellen
  - User kann eigene Templates erstellen

- **JSON Export/Import** - Vollständiger Datenexport
  - Alle Felder inklusive Metadaten
  - Backup-Funktion (Download als .json)
  - Wiederherstellung aus JSON

- **Kontakt-History** - Änderungen nachvollziehen
  - "Letzte Änderung"-Timestamp für jeden Kontakt
  - Anzeige in Tab: "Erstellt am: ... / Geändert am: ..."
  - Optional: Vollständiger Change-Log pro Kontakt

### 🖱️ Interaktion
- **Rechtsklick-Kontextmenü** - Schnellaktionen per Rechtsklick
  - "Öffnen", "Bearbeiten", "Löschen", "Favorit", "Exportieren"
  - Auch für Mehrfachauswahl (z.B. "5 Kontakte löschen")

- **Notiz-Vollbildmodus** - Größeres Textfeld für lange Notizen
  - Fullscreen-Button im Notizen-Feld
  - Markdown-Support (fett, kursiv, Listen)
  - Live-Preview während der Eingabe

---

## 5. Langfristige Ziele (Advanced Features)

### 🔄 Synchronisierung & Cloud
- **Backend-Synchronisierung** - Multi-Device Support
  - CardDAV-Server-Integration (Nextcloud, iCloud, Google)
  - Conflict Resolution bei gleichzeitigen Änderungen
  - Offline-First mit Sync-Queue
  - End-to-End Verschlüsselung optional

- **Progressive Web App (PWA)** - Installierbare App
  - Service Worker für Offline-Fähigkeit
  - Desktop & Mobile Installation
  - App-Icons und Splash-Screens
  - Push-Notifications für Geburtstage (opt-in)

### 📱 Mobile & Performance
- **Virtual Scrolling** - Performance bei >1000 Kontakten
  - Nur sichtbare Zeilen rendern
  - Smooth Scrolling auch bei 10.000+ Kontakten
  - Intersection Observer API nutzen

- **Mobile-Optimierung** - Native App Feeling
  - Swipe-Gesten (Links: Löschen, Rechts: Favorit)
  - Touch-optimierte UI (größere Buttons)
  - Bottom-Navigation für Tabs

### 🔧 Erweiterte Datenfelder
- **Mehrere Telefonnummern** - Array-basierte Felder
  - Dynamisch Telefonnummern hinzufügen/entfernen
  - Typen: Mobil, Privat, Geschäft, Fax, etc.
  - Primär-Nummer markieren

- **Mehrere E-Mail-Adressen** - Flexible E-Mail-Verwaltung
  - Dynamisch E-Mails hinzufügen/entfernen
  - Typen: Privat, Geschäft, Sonstige
  - Primär-Adresse markieren

- **Benutzerdefinierte Felder** - Vollständig anpassbar
  - User kann eigene Felder definieren (Text, Zahl, Datum, URL)
  - Feldtypen mit Validierung
  - Felder pro Kontakt oder global

### 🌐 Kollaboration & Integration
- **Kontakt-Beziehungen** - Netzwerk-Grafik
  - Beziehungen zwischen Kontakten (Partner, Chef, Kollege, Familie)
  - Graph-Visualisierung der Beziehungen
  - "Gemeinsame Kontakte" finden

- **Gruppen & Mailinglisten** - Team-Management
  - Kontakte zu Gruppen zusammenfassen
  - E-Mail an ganze Gruppe (mailto: mit BCC)
  - Gruppen-Export für Newsletter-Tools

- **QR-Code Generator** - Schnelles Teilen
  - VCard als QR-Code generieren
  - Scannen mit Smartphone → direkter Import
  - Anzeige im Tab und zum Download

### 🎯 Analytics & Insights
- **Erweiterte Statistiken** - Daten-Insights
  - Kontakte nach Herkunft (Import-Quelle)
  - Wachstum über Zeit (Graph)
  - Geburtstags-Verteilung (Heatmap)
  - Vollständigkeits-Score pro Kontakt

- **Aktivitäts-Dashboard** - Was passiert in der App?
  - "Heute hinzugefügt: 3"
  - "Diese Woche bearbeitet: 8"
  - "Ungenutzte Kontakte (>365 Tage nicht geöffnet)"

### 🔐 Sicherheit & Datenschutz
- **Verschlüsselung** - Sensitive Daten schützen
  - Optional: localStorage verschlüsseln (Master-Passwort)
  - Notizen als verschlüsselt markieren
  - Auto-Lock nach Inaktivität

- **Export mit Passwort** - Geschützte Backups
  - VCF/JSON Export mit Passwortschutz
  - AES-256 Verschlüsselung
  - Import mit Passwort-Eingabe

---

## 6. Abgeschlossene Meilensteine

### Kern-Features
- ✅ Grundlegende Anwendungsstruktur mit modularem JavaScript (ESM).
- ✅ Reaktives State-Management via Proxy.
- ✅ Laden und Anzeigen von Kontakten aus einer JSON-Datei.
- ✅ Persistenz der Kontakte und Sortiereinstellungen im `localStorage`.
- ✅ Implementierung einer reaktiven Tabellenansicht mit fixiertem Header.
- ✅ Implementierung der Sortierfunktion für alle Spalten (auf- und absteigend).
- ✅ Basis-CRUD-Funktionen (Erstellen, Lesen, Aktualisieren, Löschen).

### Favoriten & Gruppierung
- ✅ Favoriten-System mit visueller Kennzeichnung (Stern-Icon).
- ✅ Favoriten werden in separater Sektion am Anfang der Liste angezeigt.
- ✅ Alphabetische Gruppierung nach Anfangsbuchstaben mit Sticky-Headers.

### Suche & Filter
- ✅ Reaktive Suche mit Debouncing (durchsucht alle Felder).
- ✅ Kategorie-Filter mit vordefinierten Kategorien (Familie, Freunde, Arbeit, Geschäft, Sonstige).
- ✅ "Nur Favoriten"-Filter im Kategorie-Dropdown.
- ✅ Kontakt-Counter mit Anzeige gefilterte/gesamt.

### Kontaktverwaltung
- ✅ Kategorisierung von Kontakten.
- ✅ Geburtsdatum-Feld mit automatischer Altersberechnung.
- ✅ Formular-Validierung (E-Mail, deutsche PLZ).
- ✅ Duplikats-Erkennung mit verbesserter Logik (Name-basiert, unterstützt fehlende Vornamen).
- ✅ Merge-Funktion zum Zusammenführen von Duplikaten.

### Multi-Tab Kontakt-Detailansicht
- ✅ Tab-basierte Kontakt-Bearbeitung (ersetzt Modal-System).
- ✅ Bis zu 5 gleichzeitige Tabs mit je eigenem Formular.
- ✅ Tab-Persistenz beim Wechsel zwischen Hauptansichten (Liste/Auswertung).
- ✅ Auto-Close nach erfolgreichem Speichern.
- ✅ Deduplizierung: Gleicher Kontakt nur einmal öffnen.
- ✅ Tab-Management: Öffnen, Schließen, Wechseln zwischen Tabs.
- ✅ Ghost-Tab-Prevention: Tabs schließen automatisch bei Kontakt-Löschung.
- ✅ Tab-spezifische Formulare mit eindeutigen IDs pro Tab.
- ✅ Social Media Badges pro Tab mit Tab-ID-Unterstützung.

### Import/Export
- ✅ VCF-Import mit Quoted-Printable-Dekodierung für Sonderzeichen.
- ✅ VCF-Export der gesamten Kontaktliste.
- ✅ VCF-Export nur ausgewählter Kontakte (Bulk-Export).
- ✅ Unterstützung für CATEGORIES und BDAY in VCF 3.0.
- ✅ Automatische Mojibake-Reparatur (UTF-8 → MacRoman/Windows-1252 Korruption).
- ✅ Line Unfolding nach RFC 2426 (mehrzeilige VCF-Felder).
- ✅ Charset-Detection (UTF-8 und ISO-8859-1).
- ✅ Korrekte Escape/Unescape-Logik für Sonderzeichen (Backslash, Komma, Semikolon).
- ✅ Unterstützung für TYPE-Parameter (TYPE=WORK und ;WORK Syntax).

### Mehrfachauswahl & Bulk-Aktionen
- ✅ Mehrfachauswahl mit `Strg/Cmd` + Klick (einzelne Kontakte hinzufügen/entfernen).
- ✅ Bereichsauswahl mit `Shift` + Klick (respektiert visuelle Reihenfolge nach Filterung/Sortierung).
- ✅ Bulk-Löschen ausgewählter Kontakte.
- ✅ Bulk-Export ausgewählter Kontakte.

### UI/UX
- ✅ Dark/Light-Theme mit persistenter Speicherung.
- ✅ Responsives Design für verschiedene Bildschirmgrößen.
- ✅ Doppelklick zum Öffnen eines Kontakts.
- ✅ Visuelles Feedback bei Auswahl und Hover-Effekte.

### Tastatur-Shortcuts
- ✅ `Strg/Cmd + N` - Neuer Kontakt
- ✅ `Strg/Cmd + F` - Suche fokussieren
- ✅ `Strg/Cmd + E` - Kontakte exportieren
- ✅ `Esc` - Modal/Dialog/Tab schließen, Suche entfokussieren
- ✅ `Pfeil Runter/Hoch` - Navigation durch Kontaktliste (respektiert Filter/Sortierung)
- ✅ `Enter` - Ausgewählten Kontakt öffnen
- ✅ `Backspace/Delete` - Ausgewählte Kontakte löschen
- ✅ `Strg/Cmd + Enter` - Formular speichern (in Tab-Ansicht)
- ✅ Automatisches Scrolling zu ausgewähltem Kontakt
- ✅ `isTyping`-Check: Shortcuts werden in Input/Textarea-Feldern deaktiviert