# WASM Implementation Details

**Projekt:** Kontaktmanager Performance-Migration
**Branch:** `feature/wasm-performance`
**Erstellt:** 2025-11-02
**Status:** 🔴 Planung

---

## 🏗️ State-of-the-Art 3-Schichten-Architektur

**Basierend auf Gemini's Analyse - Die einzige Architektur für 25k+ Kontakte ohne Backend**

### Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Client-Only)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Schicht 1: UI Layer (Main Thread)                   │  │
│  │  ─────────────────────────────────────               │  │
│  │  Job: NUR "Malen" (DOM) + Events empfangen           │  │
│  │  Tech: ui.js, events.js, virtual-scroller.js         │  │
│  │  Regel: NIEMALS rechnen, nur Befehle senden          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ postMessage                      │
│                          ↑ results                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Schicht 2: Logic Layer (Web Worker Thread)          │  │
│  │  ────────────────────────────────────────             │  │
│  │  Job: "Denken" - Parsen, Suchen, Duplikate           │  │
│  │  Tech: wasm-worker.js + Rust/WASM                    │  │
│  │  Regel: NIEMALS UI blockieren                        │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────┐          │  │
│  │  │  WASM Modules (Rust)                   │          │  │
│  │  │  ├─ VCF Parser                         │          │  │
│  │  │  ├─ Duplicate Detector (Rayon)         │          │  │
│  │  │  ├─ Fuzzy Search (fuzzy-matcher)       │          │  │
│  │  │  └─ Crypto (Argon2, AES-GCM)           │          │  │
│  │  └────────────────────────────────────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ IndexedDB API                    │
│                          ↑ Query Results                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Schicht 3: Storage Layer (IndexedDB)                │  │
│  │  ──────────────────────────────────                  │  │
│  │  Job: 25k+ Kontakte performant speichern             │  │
│  │  Tech: Dexie.js (IndexedDB Wrapper)                  │  │
│  │  Regel: Async, aus Worker zugänglich                 │  │
│  │                                                        │  │
│  │  DB: KontakteDB                                       │  │
│  │  ├─ contacts (++id, lastName, email, ...)            │  │
│  │  └─ meta (sortOrder, settings, ...)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Warum diese Architektur?

**Problem 1: localStorage ist synchron**
```javascript
// ❌ FALSCH - Blockiert UI für 300ms+
const contacts = JSON.parse(localStorage.getItem('contacts')); // 8MB = 300ms
state.contacts = contacts;
render(); // UI hängt während Parse
```

```javascript
// ✅ RICHTIG - IndexedDB ist async
const contacts = await db.contacts.toArray(); // 0ms UI-Block
state.contacts = contacts;
render(); // UI bleibt responsive
```

**Problem 2: Web Worker kann nicht auf localStorage zugreifen**
```javascript
// ❌ FALSCH - Worker hat kein localStorage
// wasm-worker.js
const contacts = localStorage.getItem('contacts'); // undefined!
```

```javascript
// ✅ RICHTIG - Worker kann IndexedDB nutzen
// wasm-worker.js
import { db } from './storage.js';
const contacts = await db.contacts.toArray(); // Funktioniert!
```

**Problem 3: Daten-Kopie Main → Worker = Langsam**
```javascript
// ❌ FALSCH - 8MB bei jedem Aufruf kopieren
worker.postMessage({
    type: 'FIND_DUPLICATES',
    contacts: state.contacts // 8MB Kopie!
});
```

```javascript
// ✅ RICHTIG - Worker liest direkt aus DB
worker.postMessage({ type: 'FIND_DUPLICATES' }); // Nur Befehl
// Worker macht intern:
const contacts = await db.contacts.toArray(); // Kein Kopieren
```

---

## 🚀 Workflows mit 3-Schichten-Architektur

### Workflow 1: VCF-Import (25.000 Kontakte)

```
User droppt VCF
      ↓
┌──────────────────────────────────────────────────────┐
│ UI Thread (Main)                                      │
│ ────────────────                                      │
│ 1. FileReader.readAsText(file)                       │
│ 2. worker.postMessage({ type: 'PARSE_VCF', text })   │
│ 3. Zeige Spinner                                      │
└──────────────────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────────────────┐
│ Worker Thread                                         │
│ ─────────────                                         │
│ 1. WASM: parse_vcf(text) → 25k Kontakte (180ms)     │
│ 2. IndexedDB: await db.contacts.bulkAdd(contacts)    │
│ 3. postMessage({ type: 'PARSE_COMPLETE' })           │
└──────────────────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────────────────┐
│ UI Thread (Main)                                      │
│ ────────────────                                      │
│ 1. Entferne Spinner                                   │
│ 2. Lade Kontakte: await db.contacts.toArray()        │
│ 3. Virtual Scroller rendert 30 Zeilen                │
└──────────────────────────────────────────────────────┘
```

**Ergebnis:** 25k Kontakte importiert, **UI nie blockiert**, Gesamtzeit <2s

---

### Workflow 2: Fuzzy Search (User tippt "Müll")

```
User tippt "M"
      ↓
┌──────────────────────────────────────────────────────┐
│ UI Thread (Main)                                      │
│ ────────────────                                      │
│ 1. oninput Event                                      │
│ 2. worker.postMessage({ type: 'SEARCH', query: 'M' })│
│ 3. UI bleibt interaktiv (User kann weitertippen)     │
└──────────────────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────────────────┐
│ Worker Thread                                         │
│ ─────────────                                         │
│ 1. IndexedDB: contacts = await db.contacts.toArray() │
│ 2. WASM: fuzzy_search('M', contacts) → Top 50 (<10ms)│
│ 3. postMessage({ type: 'RESULTS', ids: [1,5,7...] }) │
└──────────────────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────────────────┐
│ UI Thread (Main)                                      │
│ ────────────────                                      │
│ 1. state.visibleContactIds = results.ids              │
│ 2. Virtual Scroller rendert 50 Ergebnisse            │
└──────────────────────────────────────────────────────┘
```

User tippt weiter: "ü"
      ↓ (Vorheriger Worker-Task wird gecancelt)

Neuer Worker-Task: Suche "Mü"
      ↓
Ergebnis: Top 20 (z.B. "Müller", "Mülheim", ...)

**Ergebnis:** <50ms pro Tastendruck, **nie UI-Block**, User kann flüssig tippen

---

### Workflow 3: Duplikat-Scan (25k Kontakte)

```
User klickt "Duplikate finden"
      ↓
┌──────────────────────────────────────────────────────┐
│ UI Thread (Main)                                      │
│ ────────────────                                      │
│ 1. worker.postMessage({ type: 'FIND_DUPLICATES' })   │
│ 2. Zeige Progress-Bar                                │
│ 3. User kann weiterarbeiten (Tab wechseln, etc.)     │
└──────────────────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────────────────┐
│ Worker Thread                                         │
│ ─────────────                                         │
│ 1. IndexedDB: contacts = await db.contacts.toArray() │
│ 2. WASM: find_duplicates(contacts, 0.85)             │
│    - Rayon: Parallele Verarbeitung auf 8 Cores       │
│    - Levenshtein, Jaro-Winkler, Soundex              │
│    - 312 Mio. Vergleiche in <1s                      │
│ 3. postMessage({ type: 'DUPLICATES', pairs: [...] }) │
└──────────────────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────────────────┐
│ UI Thread (Main)                                      │
│ ────────────────                                      │
│ 1. Zeige Duplikat-Liste (z.B. 50 Paare gefunden)     │
│ 2. User kann Duplikate einzeln reviewen & mergen     │
└──────────────────────────────────────────────────────┘
```

**Ergebnis:** 25k Kontakte in <1s gescannt, **UI bleibt responsive**

---

## Duplikat-Detector (Rust) - Detaillierte Implementierung

### Performance-Ziel
- **Aktuell (JS):** ~45 Sekunden bei 25.000 Kontakten
- **Ziel (Rust):** <1 Sekunde bei 25.000 Kontakten
- **Speedup:** 56x schneller

### Algorithmen

#### 1. Levenshtein Distance
Misst Anzahl der Änderungen (Insertions, Deletions, Substitutions) zwischen zwei Strings.

```rust
// wasm/src/duplicate/similarity.rs
use strsim::levenshtein;

pub fn name_similarity(a: &str, b: &str) -> f32 {
    let dist = levenshtein(a, b);
    let max_len = a.len().max(b.len()) as f32;

    if max_len == 0.0 {
        return 1.0;
    }

    1.0 - (dist as f32 / max_len)
}

#[test]
fn test_name_similarity() {
    assert!((name_similarity("Max", "Maxx") - 0.75).abs() < 0.01);
    assert!((name_similarity("Schmidt", "Schmitt") - 0.857).abs() < 0.01);
}
```

#### 2. Jaro-Winkler Distance
Besser für kurze Strings und Tippfehler am Anfang.

```rust
use strsim::jaro_winkler;

pub fn fuzzy_name_match(a: &str, b: &str) -> f32 {
    jaro_winkler(a, b) as f32
}

#[test]
fn test_fuzzy_name_match() {
    assert!(fuzzy_name_match("Martha", "Marhta") > 0.95); // Tippfehler
    assert!(fuzzy_name_match("Max", "Maxwell") > 0.80);   // Ähnlich
}
```

#### 3. Soundex (Phonetisch)
Für Namen die ähnlich klingen aber anders geschrieben werden.

```rust
// wasm/src/duplicate/phonetic.rs
pub fn soundex(s: &str) -> String {
    if s.is_empty() {
        return String::from("0000");
    }

    let s = s.to_uppercase();
    let mut chars: Vec<char> = s.chars().collect();

    // Erste Buchstabe behalten
    let mut code = String::from(chars[0]);

    // Soundex-Mapping
    let soundex_map = |c: char| -> Option<char> {
        match c {
            'B' | 'F' | 'P' | 'V' => Some('1'),
            'C' | 'G' | 'J' | 'K' | 'Q' | 'S' | 'X' | 'Z' => Some('2'),
            'D' | 'T' => Some('3'),
            'L' => Some('4'),
            'M' | 'N' => Some('5'),
            'R' => Some('6'),
            _ => None,
        }
    };

    let mut last_code = soundex_map(chars[0]);

    for &c in &chars[1..] {
        if let Some(digit) = soundex_map(c) {
            if Some(digit) != last_code {
                code.push(digit);
                last_code = Some(digit);
            }
        } else {
            last_code = None;
        }

        if code.len() >= 4 {
            break;
        }
    }

    // Auf 4 Zeichen auffüllen
    while code.len() < 4 {
        code.push('0');
    }

    code
}

#[test]
fn test_soundex() {
    assert_eq!(soundex("Robert"), "R163");
    assert_eq!(soundex("Rupert"), "R163"); // Gleicher Code!
    assert_eq!(soundex("Müller"), "M460");
    assert_eq!(soundex("Mueller"), "M460"); // Gleicher Code!
}
```

### Vollständige Implementierung

```rust
// wasm/src/duplicate/mod.rs
pub mod detector;
pub mod similarity;
pub mod phonetic;

pub use detector::DuplicateDetector;
```

```rust
// wasm/src/duplicate/detector.rs
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use rayon::prelude::*;

use super::similarity::{name_similarity, fuzzy_name_match};
use super::phonetic::soundex;

#[derive(Deserialize, Clone)]
pub struct Contact {
    pub id: u32,
    pub first_name: Option<String>,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub mobile: Option<String>,
}

#[derive(Serialize)]
pub struct DuplicatePair {
    pub id1: u32,
    pub id2: u32,
    pub score: f32,
    pub reason: String,
}

#[wasm_bindgen]
pub struct DuplicateDetector {
    contacts: Vec<Contact>,
}

#[wasm_bindgen]
impl DuplicateDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(contacts_json: &str) -> Result<DuplicateDetector, JsValue> {
        let contacts: Vec<Contact> = serde_json::from_str(contacts_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(DuplicateDetector { contacts })
    }

    #[wasm_bindgen]
    pub fn find_duplicates(&self, threshold: f32) -> Result<JsValue, JsValue> {
        // Parallele Duplikat-Suche mit Rayon
        let duplicates: Vec<DuplicatePair> = self.contacts
            .par_iter()
            .enumerate()
            .flat_map(|(i, contact)| {
                self.contacts[i+1..]
                    .par_iter()
                    .filter_map(|other| {
                        let (score, reason) = self.similarity_score(contact, other);

                        if score >= threshold {
                            Some(DuplicatePair {
                                id1: contact.id,
                                id2: other.id,
                                score,
                                reason,
                            })
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .collect();

        serde_wasm_bindgen::to_value(&duplicates)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn similarity_score(&self, a: &Contact, b: &Contact) -> (f32, String) {
        let mut total_score = 0.0;
        let mut reasons = Vec::new();

        // 1. Name-Matching (50% Gewichtung)
        let name_a = format!("{} {}",
            a.first_name.as_deref().unwrap_or(""),
            &a.last_name
        ).trim().to_lowercase();

        let name_b = format!("{} {}",
            b.first_name.as_deref().unwrap_or(""),
            &b.last_name
        ).trim().to_lowercase();

        // Levenshtein für exakte Ähnlichkeit
        let levenshtein_score = name_similarity(&name_a, &name_b);

        // Jaro-Winkler für Tippfehler
        let jaro_score = fuzzy_name_match(&name_a, &name_b);

        // Phonetisches Matching
        let soundex_a = soundex(&a.last_name);
        let soundex_b = soundex(&b.last_name);
        let soundex_match = if soundex_a == soundex_b { 1.0 } else { 0.0 };

        // Beste Methode gewinnt
        let name_score = levenshtein_score
            .max(jaro_score)
            .max(soundex_match * 0.8); // Soundex etwas niedriger gewichten

        total_score += name_score * 0.5;

        if name_score > 0.8 {
            reasons.push(format!("Name: {:.0}%", name_score * 100.0));
        }

        // 2. E-Mail-Matching (30% Gewichtung)
        if let (Some(email_a), Some(email_b)) = (&a.email, &b.email) {
            if email_a.to_lowercase() == email_b.to_lowercase() {
                total_score += 0.3;
                reasons.push("E-Mail identisch".to_string());
            }
        }

        // 3. Telefon-Matching (20% Gewichtung)
        let phone_a = a.phone.as_deref()
            .or(a.mobile.as_deref())
            .map(|p| p.replace(&[' ', '-', '(', ')'][..], ""));

        let phone_b = b.phone.as_deref()
            .or(b.mobile.as_deref())
            .map(|p| p.replace(&[' ', '-', '(', ')'][..], ""));

        if let (Some(pa), Some(pb)) = (phone_a, phone_b) {
            if pa == pb && !pa.is_empty() {
                total_score += 0.2;
                reasons.push("Telefon identisch".to_string());
            }
        }

        let reason_str = if reasons.is_empty() {
            String::from("Geringe Ähnlichkeit")
        } else {
            reasons.join(", ")
        };

        (total_score, reason_str)
    }
}

// Rust Unit-Tests
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_duplicate() {
        let contacts_json = r#"[
            {"id": 1, "first_name": "Max", "last_name": "Mustermann", "email": "max@test.de", "phone": null, "mobile": null},
            {"id": 2, "first_name": "Max", "last_name": "Mustermann", "email": "max@test.de", "phone": null, "mobile": null}
        ]"#;

        let detector = DuplicateDetector::new(contacts_json).unwrap();
        let duplicates_value = detector.find_duplicates(0.85).unwrap();

        let duplicates: Vec<DuplicatePair> = serde_wasm_bindgen::from_value(duplicates_value).unwrap();

        assert_eq!(duplicates.len(), 1);
        assert!(duplicates[0].score >= 0.85);
    }

    #[test]
    fn test_typo_duplicate() {
        let contacts_json = r#"[
            {"id": 1, "first_name": "Max", "last_name": "Schmidt", "email": null, "phone": null, "mobile": null},
            {"id": 2, "first_name": "Maxx", "last_name": "Schmitt", "email": null, "phone": null, "mobile": null}
        ]"#;

        let detector = DuplicateDetector::new(contacts_json).unwrap();
        let duplicates_value = detector.find_duplicates(0.75).unwrap();

        let duplicates: Vec<DuplicatePair> = serde_wasm_bindgen::from_value(duplicates_value).unwrap();

        assert!(duplicates.len() > 0, "Sollte Tippfehler erkennen");
    }

    #[test]
    fn test_no_false_positive() {
        let contacts_json = r#"[
            {"id": 1, "first_name": "Max", "last_name": "Mustermann", "email": null, "phone": null, "mobile": null},
            {"id": 2, "first_name": "Anna", "last_name": "Schmidt", "email": null, "phone": null, "mobile": null}
        ]"#;

        let detector = DuplicateDetector::new(contacts_json).unwrap();
        let duplicates_value = detector.find_duplicates(0.85).unwrap();

        let duplicates: Vec<DuplicatePair> = serde_wasm_bindgen::from_value(duplicates_value).unwrap();

        assert_eq!(duplicates.len(), 0, "Keine Duplikate bei völlig unterschiedlichen Namen");
    }
}
```

### Integration in lib.rs

```rust
// wasm/src/lib.rs
use wasm_bindgen::prelude::*;

pub mod duplicate;

// Re-export für einfacheren Zugriff
pub use duplicate::DuplicateDetector;

#[wasm_bindgen]
pub fn init() {
    // Setup für bessere Panic-Messages im Browser
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
```

### JavaScript-Integration

```javascript
// wasm-worker.js - FIND_DUPLICATES implementieren
import init, { DuplicateDetector } from '../wasm/pkg/contacts_wasm.js';

let wasmInitialized = false;

async function ensureWasmInit() {
    if (!wasmInitialized) {
        await init();
        wasmInitialized = true;
    }
}

self.onmessage = async (e) => {
    const { type, id, payload } = e.data;

    try {
        await ensureWasmInit();
        let result;

        switch(type) {
            case 'FIND_DUPLICATES':
                const detector = new DuplicateDetector(
                    JSON.stringify(payload.contacts)
                );
                const duplicatesValue = detector.find_duplicates(payload.threshold);
                result = { duplicates: duplicatesValue };
                break;
        }

        self.postMessage({ type: 'SUCCESS', id, result });
    } catch (error) {
        self.postMessage({ type: 'ERROR', id, error: error.message });
    }
};
```

### Usage in Main App

```javascript
// Irgendwo in der App - z.B. neue "Duplikate finden" Funktion
import { wasm } from './wasm-bridge.js';

async function scanForDuplicates() {
    const contacts = state.contacts;

    console.time('Duplikat-Scan');

    const duplicates = await wasm.findDuplicates(contacts, 0.85);

    console.timeEnd('Duplikat-Scan');
    // Erwartet: <1s bei 25.000 Kontakten

    console.log(`${duplicates.length} Duplikate gefunden:`);
    duplicates.forEach(dup => {
        console.log(`  ${dup.id1} ↔ ${dup.id2}: ${(dup.score * 100).toFixed(0)}% (${dup.reason})`);
    });

    return duplicates;
}
```

---

## Fuzzy Search Engine (Rust) - Detaillierte Implementierung

### Performance-Ziel
- **Aktuell (JS):** ~800ms pro Tastendruck bei 25.000 Kontakten
- **Ziel (Rust):** <10ms pro Tastendruck
- **Speedup:** 80x schneller

### ⚠️ Ansatz-Änderung: fuzzy-matcher statt Tantivy

**Gemini's Empfehlung:** `fuzzy-matcher` statt `tantivy`

**Grund:**
- `tantivy` ist RIESIG (~2 MB WASM nach gzip)
- `fuzzy-matcher` ist winzig (~50 KB WASM)
- Für 25k Kontakte reicht fuzzy-matcher völlig
- Tantivy lohnt sich erst bei >100k Dokumenten

```toml
# Cargo.toml - Dependency hinzufügen
[dependencies]
fuzzy-matcher = "0.3"  # Leichtgewichtig!
# tantivy = "0.21"     # NUR wenn >100k Kontakte
```

### Implementierung

```rust
// wasm/src/search/mod.rs
pub mod fuzzy;
pub mod index;

pub use index::SearchEngine;
```

```rust
// wasm/src/search/index.rs
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use tantivy::*;
use tantivy::query::FuzzyTermQuery;

#[derive(Deserialize, Clone)]
pub struct Contact {
    pub id: u32,
    pub first_name: Option<String>,
    pub last_name: String,
    pub email: Option<String>,
    pub company: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub id: u32,
    pub score: f32,
    pub snippet: String,
}

#[wasm_bindgen]
pub struct SearchEngine {
    index: Index,
    reader: IndexReader,
    schema: Schema,
}

#[wasm_bindgen]
impl SearchEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(contacts_json: &str) -> Result<SearchEngine, JsValue> {
        let contacts: Vec<Contact> = serde_json::from_str(contacts_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Schema definieren
        let mut schema_builder = Schema::builder();

        let text_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("default")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions)
            )
            .set_stored();

        let id_field = schema_builder.add_u64_field("id", INDEXED | STORED);
        let first_name_field = schema_builder.add_text_field("first_name", text_options.clone());
        let last_name_field = schema_builder.add_text_field("last_name", text_options.clone());
        let email_field = schema_builder.add_text_field("email", text_options.clone());
        let company_field = schema_builder.add_text_field("company", text_options.clone());
        let notes_field = schema_builder.add_text_field("notes", text_options.clone());

        let schema = schema_builder.build();

        // Index im RAM erstellen
        let index = Index::create_in_ram(schema.clone());

        // Kontakte indexieren
        let mut index_writer = index.writer(50_000_000)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        for contact in contacts {
            let mut doc = Document::new();

            doc.add_u64(id_field, contact.id as u64);

            if let Some(first_name) = contact.first_name {
                doc.add_text(first_name_field, &first_name);
            }

            doc.add_text(last_name_field, &contact.last_name);

            if let Some(email) = contact.email {
                doc.add_text(email_field, &email);
            }

            if let Some(company) = contact.company {
                doc.add_text(company_field, &company);
            }

            if let Some(notes) = contact.notes {
                doc.add_text(notes_field, &notes);
            }

            index_writer.add_document(doc)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
        }

        index_writer.commit()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let reader = index.reader()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(SearchEngine { index, reader, schema })
    }

    #[wasm_bindgen]
    pub fn search(&self, query: &str, limit: usize) -> Result<JsValue, JsValue> {
        let searcher = self.reader.searcher();

        // Fuzzy Query mit Typo-Toleranz (Distance: 2)
        let query_parser = QueryParser::for_index(
            &self.index,
            vec![
                self.schema.get_field("first_name").unwrap(),
                self.schema.get_field("last_name").unwrap(),
                self.schema.get_field("email").unwrap(),
                self.schema.get_field("company").unwrap(),
                self.schema.get_field("notes").unwrap(),
            ]
        );

        let query = query_parser.parse_query(&format!("{}~2", query))
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let mut results = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc(doc_address)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;

            let id = retrieved_doc
                .get_first(self.schema.get_field("id").unwrap())
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32;

            results.push(SearchResult {
                id,
                score,
                snippet: format!("Contact #{}", id),
            });
        }

        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
```

### JavaScript-Integration

```javascript
// wasm-worker.js - FUZZY_SEARCH implementieren
case 'FUZZY_SEARCH':
    if (!searchEngine) {
        // Index beim ersten Mal erstellen
        searchEngine = new SearchEngine(
            JSON.stringify(payload.contacts)
        );
    }

    const searchResults = searchEngine.search(
        payload.query,
        payload.limit || 50
    );

    result = { results: searchResults };
    break;
```

```javascript
// events.js - In Search-Handler integrieren
import { wasm } from './wasm-bridge.js';

dom.searchInput.addEventListener('input', (e) => {
    const query = e.target.value;

    if (state.contacts.length > 5000 && query.length > 2) {
        // WASM Fuzzy Search
        wasm.fuzzySearch(query, state.contacts).then(results => {
            // results enthält IDs der gefundenen Kontakte
            const contactIds = new Set(results.map(r => r.id));

            // Filter state basierend auf Ergebnissen
            state.searchResults = contactIds;
            render();
        });
    } else {
        // Normale JS-Suche (wie bisher)
        debouncedSearch(query);
    }
});
```

---

## VCF Parser (Rust) - Detaillierte Implementierung

### Performance-Ziel
- **Aktuell (JS):** ~2s für 5000-Kontakt-VCF
- **Ziel (Rust):** ~180ms
- **Speedup:** 11x schneller

### Ansatz: Streaming-Parser mit `nom`

```rust
// wasm/src/vcf/parser.rs
use nom::{
    IResult,
    bytes::complete::{tag, take_until, take_while},
    character::complete::{line_ending, not_line_ending},
    multi::many0,
    sequence::{delimited, tuple},
};

#[derive(Debug, Clone)]
pub struct VCard {
    pub fn_field: Option<String>,
    pub n_field: Option<(String, String)>, // (LastName, FirstName)
    pub email: Vec<String>,
    pub tel: Vec<String>,
    // ... weitere Felder
}

// VCF-Parser (vereinfacht)
fn parse_vcard(input: &str) -> IResult<&str, VCard> {
    let (input, _) = tag("BEGIN:VCARD")(input)?;
    let (input, _) = line_ending(input)?;

    // Hier folgt die eigentliche Parse-Logik
    // ... (komplex, siehe RFC 2426)

    let (input, _) = tag("END:VCARD")(input)?;

    Ok((input, VCard {
        fn_field: None,
        n_field: None,
        email: vec![],
        tel: vec![],
    }))
}
```

**Hinweis:** Die vollständige VCF-Parser-Implementierung ist sehr umfangreich. Da der aktuelle JS-Parser bereits funktioniert, sollte dies **niedrigere Priorität** haben als Duplikat-Scanner und Fuzzy Search.

---

## Performance-Benchmarks

### Messungen durchführen

```rust
// wasm/src/lib.rs - Benchmark-Funktionen hinzufügen
#[wasm_bindgen]
pub fn benchmark_duplicates(contacts_json: &str, iterations: u32) -> f64 {
    use std::time::Instant;

    let detector = DuplicateDetector::new(contacts_json).unwrap();

    let start = Instant::now();

    for _ in 0..iterations {
        let _ = detector.find_duplicates(0.85);
    }

    let elapsed = start.elapsed();
    elapsed.as_secs_f64() / iterations as f64
}
```

```javascript
// Performance-Test in Browser
async function testPerformance() {
    // 25.000 Kontakte generieren
    const testContacts = generateTestContacts(25000);

    console.time('JS Duplikat-Scan');
    const jsResult = findDuplicatesJS(testContacts);
    console.timeEnd('JS Duplikat-Scan');

    console.time('WASM Duplikat-Scan');
    const wasmResult = await wasm.findDuplicates(testContacts);
    console.timeEnd('WASM Duplikat-Scan');

    console.log('Speedup:', (jsTime / wasmTime).toFixed(1) + 'x');
}
```

---

## Deployment & Build

### Build-Script erstellen

```bash
# build.sh
#!/bin/bash

echo "Building WASM modules..."

cd wasm
wasm-pack build --target web --out-dir pkg --release

echo "WASM build complete!"
echo "Bundle size:"
du -h pkg/contacts_wasm_bg.wasm
```

### .gitignore erweitern

```gitignore
# WASM Build-Artefakte
/wasm/target/
/wasm/Cargo.lock
/wasm/pkg/

# Rust-spezifisch
**/*.rs.bk
```

---

## Nächste Schritte

**Priorität 1 (Diese Woche):**
1. ✅ Virtual Scrolling (JS) - Quick Win
2. ✅ WASM Build-Pipeline Setup
3. ✅ Duplikat-Detector (Rust) - Größter Impact

**Priorität 2 (Nächste Woche):**
4. Fuzzy Search Engine (Rust)
5. Hybrid Sortierung (threshold-basiert)
6. Performance-Tests mit echten Daten

**Priorität 3 (Later):**
7. VCF Parser (Rust)
8. Verschlüsselung (Rust)
9. Bundle-Size-Optimierung
