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

**Branch:** `feature/wasm-performance` (erstellt am 2025-11-02)

---

#### 🎯 Architektur-Entscheidungen (Basierend auf Gemini + Claude Analyse)

**Grundprinzip: "50ms-Regel"**
> Operationen die >50ms dauern UND "denken" (rechnen) statt "malen" (DOM) → Rust/WASM
> Operationen mit DOM-Interaktion → JavaScript

**Was kommt in Rust/WASM:**
1. ✅ **Duplikat-Scanner** - O(n²) bei 25k = 312 Mio. Vergleiche → ~45s in JS, <1s in Rust
2. ✅ **Fuzzy Search** - 25k × 22 Felder = 550k String-Vergleiche pro Tastendruck → ~800ms in JS, <10ms in Rust
3. ✅ **VCF Parser** - Text-Parsing ist CPU-intensiv → ~2s in JS, ~180ms in Rust
4. ✅ **Sortierung (Hybrid)** - Nur bei >5000 Kontakten (Bridge-Overhead vermeiden)
5. ✅ **Verschlüsselung** - Sicherheit + Performance (später)

**Was bleibt in JavaScript:**
1. ✅ **Virtual Scrolling** - DOM-Manipulation (Intersection Observer)
2. ✅ **State Management** - Proxy-basiert, JS ist hier schneller
3. ✅ **UI Rendering** - Alle DOM-Updates
4. ✅ **Event Handling** - Tastatur, Maus, Touch
5. ✅ **Sortierung bei <5000 Kontakten** - JS schneller wegen Bridge-Overhead

---

#### 📁 Geplante Dateistruktur

```
contacts/                          # Aktuelles Projekt
├── index.html
├── style.css
├── main.js
├── state.js
├── ui.js
├── events.js
├── contacts.js
├── vcf-handler.js                 # ⚠️ Wird zu vcf-handler-js.js (Fallback)
├── utils.js
├── storage.js
├── ... (alle anderen JS-Dateien)
│
├── wasm/                          # ⭐ NEU: WASM-Module
│   ├── Cargo.toml                 # Rust-Projekt-Konfiguration
│   ├── src/
│   │   ├── lib.rs                 # Entry Point für alle WASM-Module
│   │   ├── duplicate/
│   │   │   ├── mod.rs             # Public API
│   │   │   ├── detector.rs        # Duplikat-Erkennung
│   │   │   ├── similarity.rs      # Levenshtein, Jaro-Winkler
│   │   │   └── phonetic.rs        # Soundex, Metaphone
│   │   ├── search/
│   │   │   ├── mod.rs             # Public API
│   │   │   ├── fuzzy.rs           # Fuzzy-Matching-Algorithmen
│   │   │   └── index.rs           # Inverted Index (Tantivy)
│   │   ├── vcf/
│   │   │   ├── mod.rs             # Public API
│   │   │   ├── parser.rs          # VCF-Parser
│   │   │   ├── exporter.rs        # VCF-Export
│   │   │   └── stream.rs          # Streaming-Parser für >10MB
│   │   ├── sort/
│   │   │   ├── mod.rs             # Public API
│   │   │   └── radix.rs           # Radix Sort
│   │   └── crypto/                # Später: Verschlüsselung
│   │       ├── mod.rs
│   │       └── encrypt.rs         # AES-256, Argon2
│   ├── pkg/                       # ⭐ Generiert von wasm-pack
│   │   ├── contacts_wasm_bg.wasm  # Kompiliertes WASM
│   │   ├── contacts_wasm.js       # JS-Bindings
│   │   └── contacts_wasm.d.ts     # TypeScript-Definitionen
│   └── tests/                     # Rust Unit-Tests
│       ├── duplicate_test.rs
│       ├── search_test.rs
│       └── vcf_test.rs
│
├── wasm-bridge.js                 # ⭐ NEU: JS ↔ WASM Kommunikation
├── wasm-worker.js                 # ⭐ NEU: Web Worker für WASM
└── virtual-scroller.js            # ⭐ NEU: Virtual Scrolling (JS)
```

---

#### ⚠️ Kritische Architektur-Korrekturen (Gemini's Feedback) - ABGESCHLOSSEN

**Status:** ✅ Abgeschlossen (2025-11-02, Commit: a87b41c)

Drei fundamentale Architektur-Fehler wurden basierend auf Gemini's Analyse korrigiert:

**Fix 1: IndexedDB statt localStorage** ✅
- Problem: localStorage ist synchron → blockiert UI, nicht aus Worker zugänglich
- Lösung: IndexedDB mit Dexie.js → async, worker-accessible, keine UI-Blocks
- Impact: Kein UI-Blocking mehr beim Laden von 8MB Kontakten

**Fix 2: fuzzy-matcher statt tantivy** ✅
- Problem: tantivy = 2MB WASM Bundle (Overkill für 25k Kontakte)
- Lösung: fuzzy-matcher = 50KB WASM (97.5% kleiner)
- Impact: Bundle-Size von 2MB auf 50KB reduziert

**Fix 3: Worker liest direkt aus IndexedDB** ✅
- Problem: Main Thread → 8MB JSON → Worker = Datenkopie bei jedem Aufruf
- Lösung: Worker hat eigene IndexedDB-Verbindung, Main Thread sendet nur Befehle
- Impact: Keine Daten-Kopien mehr, nur noch Befehlsübermittlung

**Dokumentation:**
- ✅ Vollständige wasm-bridge.js Implementierung
- ✅ Korrekte wasm-worker.js mit IndexedDB-Integration
- ✅ Alle JavaScript-Integrationen korrigiert
- ✅ Performance-Tests angepasst

**Ergebnis:** State-of-the-Art 3-Schichten-Architektur (UI Layer → Logic Layer → Storage Layer)

---

#### 🔄 Phase 1: JavaScript Foundation (Tag 1-2)

**Status:** 🔴 Nicht begonnen

**Ziel:** UI bleibt responsive bei 25k+ Kontakten (ohne WASM)

##### 1.1 Virtual Scrolling (Priorität: HOCH)
**Datei:** `virtual-scroller.js` (NEU)

**Aufwand:** 2-3 Stunden

**Implementierung:**
```javascript
// virtual-scroller.js
export class VirtualScroller {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.visibleItems = 30; // Nur 30 Zeilen rendern
        this.items = [];
        this.scrollTop = 0;

        this.setupIntersectionObserver();
    }

    setupIntersectionObserver() {
        // Intersection Observer für smooth scrolling
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            { root: this.container, threshold: 0.1 }
        );
    }

    setItems(items) {
        this.items = items;
        this.render();
    }

    render() {
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.min(
            startIndex + this.visibleItems,
            this.items.length
        );

        // Nur sichtbare Items rendern
        const fragment = document.createDocumentFragment();
        for (let i = startIndex; i < endIndex; i++) {
            const itemEl = this.renderItem(this.items[i], i);
            fragment.appendChild(itemEl);
        }

        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }
}
```

**Integration in ui.js:**
```javascript
// ui.js - renderContactList() anpassen
import { VirtualScroller } from './virtual-scroller.js';

let virtualScroller = null;

function renderContactList() {
    const contacts = getVisualOrder();

    // Virtual Scrolling nur bei >500 Kontakten aktivieren
    if (contacts.length > 500) {
        if (!virtualScroller) {
            virtualScroller = new VirtualScroller(
                dom.contactList,
                50, // itemHeight in px
                (contact) => renderContact(contact) // Bestehende Funktion nutzen
            );
        }
        virtualScroller.setItems(contacts);
    } else {
        // Bestehende Logik für <500 Kontakte
        renderContactListClassic(contacts);
    }
}
```

**Testing:**
- [ ] Test mit 100 Kontakten (klassisches Rendering)
- [ ] Test mit 1.000 Kontakten (Virtual Scrolling)
- [ ] Test mit 10.000 Kontakten (Virtual Scrolling)
- [ ] Smooth Scrolling funktioniert
- [ ] Keyboard-Navigation (Pfeil-Tasten) funktioniert mit Virtual Scrolling

---

##### 1.2 Web Worker Infrastructure (Priorität: MITTEL)
**Datei:** `wasm-worker.js` (NEU)

**Aufwand:** 2 Stunden

**Implementierung:**
```javascript
// wasm-worker.js
// Wird später für WASM-Operationen genutzt, jetzt Setup

self.onmessage = async (e) => {
    const { type, id, payload } = e.data;

    try {
        let result;

        switch(type) {
            case 'INIT_WASM':
                // Später: WASM initialisieren
                result = { ready: true };
                break;

            case 'FIND_DUPLICATES':
                // Später: WASM-Duplikat-Scanner
                result = await findDuplicatesPlaceholder(payload.contacts);
                break;

            case 'FUZZY_SEARCH':
                // Später: WASM-Fuzzy-Search
                result = await fuzzySearchPlaceholder(payload.query, payload.contacts);
                break;

            case 'PARSE_VCF':
                // Später: WASM-VCF-Parser
                result = await parseVcfPlaceholder(payload.vcfText);
                break;
        }

        self.postMessage({ type: 'SUCCESS', id, result });
    } catch (error) {
        self.postMessage({ type: 'ERROR', id, error: error.message });
    }
};

// Placeholder-Funktionen (werden später durch WASM ersetzt)
async function findDuplicatesPlaceholder(contacts) {
    return { duplicates: [], message: 'WASM not loaded yet' };
}

async function fuzzySearchPlaceholder(query, contacts) {
    return { results: [], message: 'WASM not loaded yet' };
}

async function parseVcfPlaceholder(vcfText) {
    return { contacts: [], message: 'WASM not loaded yet' };
}
```

**Bridge-Datei:** `wasm-bridge.js` (NEU)
```javascript
// wasm-bridge.js
// High-level API für WASM-Operationen (läuft in Main-Thread)

class WasmBridge {
    constructor() {
        this.worker = new Worker('./wasm-worker.js');
        this.pendingRequests = new Map();
        this.nextId = 0;
        this.wasmReady = false;

        this.worker.onmessage = (e) => this.handleResponse(e.data);
    }

    async init() {
        const result = await this.sendRequest('INIT_WASM', {});
        this.wasmReady = result.ready;
        return this.wasmReady;
    }

    async findDuplicates(contacts, threshold = 0.85) {
        // Threshold-basiert: Nur bei vielen Kontakten WASM nutzen
        if (contacts.length < 1000) {
            // Fallback zu JS-Implementierung (schneller wegen Bridge-Overhead)
            return this.findDuplicatesJS(contacts, threshold);
        }

        const result = await this.sendRequest('FIND_DUPLICATES', {
            contacts,
            threshold
        });
        return result.duplicates;
    }

    async fuzzySearch(query, contacts) {
        // Threshold-basiert
        if (contacts.length < 5000) {
            return this.fuzzySearchJS(query, contacts);
        }

        const result = await this.sendRequest('FUZZY_SEARCH', {
            query,
            contacts
        });
        return result.results;
    }

    async parseVcf(vcfText) {
        // VCF-Parsing immer in WASM (auch bei kleinen Dateien)
        const result = await this.sendRequest('PARSE_VCF', { vcfText });
        return result.contacts;
    }

    // Helper: Promise-basierte Request-Handling
    sendRequest(type, payload) {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            this.pendingRequests.set(id, { resolve, reject });
            this.worker.postMessage({ type, id, payload });
        });
    }

    handleResponse(data) {
        const { type, id, result, error } = data;
        const request = this.pendingRequests.get(id);

        if (!request) return;

        this.pendingRequests.delete(id);

        if (type === 'SUCCESS') {
            request.resolve(result);
        } else {
            request.reject(new Error(error));
        }
    }

    // JS-Fallback-Implementierungen (für kleine Datensätze)
    findDuplicatesJS(contacts, threshold) {
        // Nutze bestehende JS-Implementierung aus utils.js
        // ... (später implementieren)
        return [];
    }

    fuzzySearchJS(query, contacts) {
        // Nutze bestehende JS-Suche
        // ... (später implementieren)
        return [];
    }
}

// Singleton-Instanz
export const wasm = new WasmBridge();
```

**Testing:**
- [ ] Worker wird korrekt erstellt
- [ ] Message-Passing funktioniert
- [ ] Fehlerbehandlung funktioniert
- [ ] Promise-basierte API funktioniert

---

##### 1.3 IndexedDB Migration (KRITISCH - Gemini's Korrektur!)
**⚠️ WICHTIG:** Ursprünglicher Plan (localStorage behalten) war **falsch**!

**Gemini's kritische Erkenntnisse:**
1. **localStorage ist SYNCHRON** → 8MB JSON blockiert UI für Hunderte Millisekunden
2. **localStorage ist NICHT aus Web Workern erreichbar** → WASM im Worker kann nicht auf Daten zugreifen
3. **Daten-Kopie Main Thread → Worker = Performance-Killer** → 8MB bei jedem Aufruf kopieren

**✅ Richtige Lösung: IndexedDB**
- Asynchron → blockiert UI nie
- Aus Web Workern zugänglich → WASM kann direkt lesen/schreiben
- Keine Größenlimits (außer Disk-Space)
- Indizes für schnelle Queries

**Implementierung mit Dexie.js (schlanke IndexedDB-Lib):**

```javascript
// storage.js (KOMPLETT NEU)
import Dexie from 'dexie';

export const db = new Dexie('KontakteDB');

db.version(1).stores({
    // ++id = Auto-Increment Primary Key
    // Weitere Felder = Indizes für schnelle Suche
    contacts: '++id, lastName, firstName, email, company, mobile, category, isFavorite',

    // Meta-Daten (sortOrder, nextId, etc.)
    meta: 'key'
});

// === API (ersetzt localStorage-Funktionen) ===

export async function loadContacts() {
    const contacts = await db.contacts.toArray();
    return contacts;
}

export async function persistContacts(contacts) {
    // Bulk-Update (viel schneller als einzeln)
    await db.contacts.clear();
    await db.contacts.bulkAdd(contacts);
}

export async function addContact(contact) {
    const id = await db.contacts.add(contact);
    return id;
}

export async function updateContact(id, changes) {
    await db.contacts.update(id, changes);
}

export async function deleteContact(id) {
    await db.contacts.delete(id);
}

// Indizierte Queries (SEHR schnell)
export async function getContactsByCategory(category) {
    return await db.contacts.where('category').equals(category).toArray();
}

export async function getFavorites() {
    return await db.contacts.where('isFavorite').equals(1).toArray();
}

export async function searchByName(query) {
    // Nutzt lastName-Index
    return await db.contacts
        .where('lastName')
        .startsWithIgnoreCase(query)
        .toArray();
}

// Meta-Daten
export async function getSortOrder() {
    const meta = await db.meta.get('sortOrder');
    return meta ? meta.value : { by: 'lastName', order: 'asc' };
}

export async function setSortOrder(sortOrder) {
    await db.meta.put({ key: 'sortOrder', value: sortOrder });
}
```

**Migration von localStorage → IndexedDB:**

```javascript
// migration.js (Einmalig beim ersten App-Start)
export async function migrateFromLocalStorage() {
    // Prüfen ob Migration nötig
    const hasMigrated = await db.meta.get('migrated');
    if (hasMigrated) return;

    console.log('Migrating from localStorage to IndexedDB...');

    try {
        // Alte Daten aus localStorage lesen
        const oldContacts = JSON.parse(localStorage.getItem('contacts') || '[]');
        const oldSort = JSON.parse(localStorage.getItem('sortOrder') || '{"by":"lastName","order":"asc"}');

        if (oldContacts.length > 0) {
            // In IndexedDB schreiben
            await db.contacts.bulkAdd(oldContacts);
            await db.meta.put({ key: 'sortOrder', value: oldSort });

            console.log(`✅ ${oldContacts.length} Kontakte migriert`);

            // localStorage aufräumen (optional)
            // localStorage.removeItem('contacts');
            // localStorage.removeItem('sortOrder');
        }

        // Migration als abgeschlossen markieren
        await db.meta.put({ key: 'migrated', value: true });

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}
```

**Integration in main.js:**

```javascript
// main.js - App-Start
import { db, loadContacts } from './storage.js';
import { migrateFromLocalStorage } from './migration.js';

async function init() {
    // 1. IndexedDB öffnen
    await db.open();

    // 2. Einmalige Migration von localStorage
    await migrateFromLocalStorage();

    // 3. Kontakte laden (async!)
    const contacts = await loadContacts();
    state.contacts = contacts;

    // 4. Rest der App starten
    render();
    initEvents();
}

init();
```

**Aufwand:** 4-6 Stunden (inkl. Migration & Testing)

**Testing:**
- [ ] IndexedDB wird korrekt erstellt
- [ ] Migration von localStorage funktioniert
- [ ] Alle CRUD-Operationen funktionieren
- [ ] Indizierte Queries sind schnell (<10ms)
- [ ] Web Worker kann auf IndexedDB zugreifen
- [ ] Keine UI-Blockierung bei großen Datensätzen

---

#### 🦀 Phase 2: Rust/WASM Setup (Tag 3-4)

**Status:** 🔴 Nicht begonnen

##### 2.1 WASM Build-Pipeline (Priorität: HOCH)
**Aufwand:** 4-6 Stunden

**Schritte:**

**1. Rust & wasm-pack installieren**
```bash
# Rust installieren (falls nicht vorhanden)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# wasm-pack installieren
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Target hinzufügen
rustup target add wasm32-unknown-unknown
```

**2. Cargo-Projekt erstellen**
```bash
cd contacts/
mkdir wasm
cd wasm
cargo init --lib
```

**3. Cargo.toml konfigurieren**
```toml
[package]
name = "contacts-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]  # Wichtig für WASM!

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde-wasm-bindgen = "0.6"

# Für Duplikat-Scanner
rayon = "1.8"  # Parallele Verarbeitung
strsim = "0.11"  # Levenshtein, Jaro-Winkler

# Für Fuzzy Search (später)
# tantivy = "0.21"

# Für VCF-Parser (später)
# nom = "7.1"

# Für Crypto (später)
# aes-gcm = "0.10"
# argon2 = "0.5"

[profile.release]
opt-level = "z"  # Optimierung für Größe
lto = true       # Link-Time-Optimization
codegen-units = 1
```

**4. Hello World WASM-Modul**
```rust
// wasm/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello from Rust, {}!", name)
}

#[wasm_bindgen]
pub fn init() {
    // Setup (falls nötig)
    console_log("WASM module initialized!");
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

fn console_log(s: &str) {
    log(s);
}
```

**5. Kompilieren**
```bash
cd wasm
wasm-pack build --target web --out-dir pkg
```

**6. In HTML einbinden**
```html
<!-- index.html -->
<script type="module">
    import init, { greet, init as initWasm } from './wasm/pkg/contacts_wasm.js';

    async function run() {
        await init();  // WASM laden
        initWasm();    // WASM initialisieren
        console.log(greet('World'));  // "Hello from Rust, World!"
    }

    run();
</script>
```

**Testing:**
- [ ] Rust & wasm-pack installiert
- [ ] Cargo-Projekt kompiliert
- [ ] WASM lädt im Browser
- [ ] `greet()` funktioniert
- [ ] Keine Console-Errors
- [ ] Bundle-Size akzeptabel (<500 KB)

---

##### 2.2 Duplikat-Detector (Rust) (Priorität: SEHR HOCH)
**Datei:** `wasm/src/duplicate/`

**Aufwand:** 8-10 Stunden

**Implementierung:** (siehe nächster Abschnitt für Details)

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