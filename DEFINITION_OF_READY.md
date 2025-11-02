# Definition of Ready — WASM Client-Only Kontaktmanager

**Branch:** `feature/wasm-performance`
**Erstellt:** 2025-11-02
**Basierend auf:** ChatGPT + Gemini Audit

Diese DoR muss erfüllt sein, bevor wir mit der Implementierung starten. Sie stellt sicher, dass Architektur-Entscheidungen, Sicherheit, Performance-Budgets und DX festgezurrt sind.

---

## 1) Architektur & Plattform

### Threading-Entscheidung dokumentiert

- [ ] **Ziel:** `rayon`/WASM-Threads an, falls `crossOriginIsolated === true`, sonst Fallback Single-Thread
- [ ] Hosting/Deploy kann COOP/COEP liefern (siehe Snippets unten)
- [ ] Entscheidung: **Single-Thread First** (GitHub Pages hat keine COOP/COEP Headers)
- [ ] Blocking-Algorithmus ist auch single-threaded schnell genug (<100ms)

### Support-Matrix final

- [ ] **Browser/Desktop:** Chrome, Edge, Firefox, Safari
- [ ] **Mobile:** iOS Safari, Android Chrome
- [ ] **Fallbacks notiert:**
  - Kein SAB/Threads → Single-Thread (Default)
  - Kein OPFS → IndexedDB (Default)
  - Kein FS Access API → Blob Download
  - Ältere iOS-Safari-IDB-Eigenheiten dokumentiert

### Capability-Probe am App-Start

```typescript
// capability-probe.ts
export interface Capabilities {
  worker: boolean;
  idb: boolean;
  wasm: boolean;
  webcrypto: boolean;
  coi: boolean;         // crossOriginIsolated
  fsAccess: boolean;    // File System Access API
  opfs: boolean;        // Origin Private File System
}

export function capabilityProbe(): Capabilities {
  const worker = typeof Worker !== 'undefined';
  const idb = typeof indexedDB !== 'undefined';
  const wasm = typeof WebAssembly !== 'undefined';
  const webcrypto = !!(globalThis.crypto?.subtle);
  const coi = (globalThis as any).crossOriginIsolated === true;
  const fsAccess = 'showOpenFilePicker' in globalThis;
  const opfs = 'storage' in navigator && 'getDirectory' in (navigator.storage as any);

  return { worker, idb, wasm, webcrypto, coi, fsAccess, opfs };
}

export function checkMinimalRequirements(caps: Capabilities): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!caps.worker) missing.push('Web Workers');
  if (!caps.idb) missing.push('IndexedDB');
  if (!caps.wasm) missing.push('WebAssembly');

  return { ok: missing.length === 0, missing };
}
```

- [ ] UI zeigt "Limited Mode" Banner, wenn essentielle Capabilities fehlen
- [ ] Banner zeigt an: welche Features nicht verfügbar sind (z.B. "Verschlüsselung nicht verfügbar")

---

## 2) Sicherheit, Privacy & Policies

### COOP/COEP konfiguriert (für Threads/SAB)

**Status für GitHub Pages:** ❌ Nicht verfügbar (keine Custom Headers möglich)
**Konsequenz:** Single-Thread Fallback (bereits im Plan)

**Für späteren Self-Hosting:**

**nginx:**
```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
```

**Vercel (vercel.json):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "Cross-Origin-Opener-Policy", "value": "same-origin"},
        {"key": "Cross-Origin-Embedder-Policy", "value": "require-corp"},
        {"key": "Cross-Origin-Resource-Policy", "value": "same-origin"}
      ]
    }
  ]
}
```

**Netlify (_headers):**
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
```

### CSP (Content Security Policy)

- [ ] CSP minimal & Worker/WASM-fähig implementiert:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline';
  worker-src 'self' blob:;
  connect-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```

**Hinweis:** `wasm-unsafe-eval` ist für ESM-WASM-Lader teils nötig

### Permissions-Policy

- [ ] Unnötige Permissions explizit blockiert:

```
Permissions-Policy: microphone=(), camera=(), geolocation=()
```

### Privacy Copy

- [ ] In der App sichtbar: "Alle Daten verbleiben lokal im Browser. Kein Backend. Bitte regelmäßige Exporte/Backups anlegen."
- [ ] Datenschutz-Sektion in README.md
- [ ] Hinweis auf Quota & Eviction-Risiko

---

## 3) Storage & Datenmodell

### IndexedDB-Schema & Migration (Dexie)

```typescript
// db.ts
import Dexie, { Table } from 'dexie';

export interface Contact {
  id?: number;
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  city?: string;
  postalCode?: string;
  category?: string;
  isFavorite?: boolean;
  // ab v2 (für Performance):
  phoneDigits?: string;   // normalisiert: nur Ziffern, letzte 10
  emailUser?: string;     // Teil vor @, lowercase
  soundex?: string;       // für Blocking-Algorithmus
}

export interface Meta {
  key: string;
  value: any;
}

export class KontakteDB extends Dexie {
  contacts!: Table<Contact, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super('KontakteDB');

    // Version 1: Initiales Schema
    this.version(1).stores({
      contacts: '++id, lastName, firstName, email, company, mobile, category, isFavorite, postalCode',
      meta: 'key'
    });

    // Version 2: Normalisierte Felder für Performance
    this.version(2).stores({
      contacts: '++id, lastName, firstName, email, company, mobile, category, isFavorite, postalCode, phoneDigits, emailUser, soundex',
      meta: 'key'
    }).upgrade(async tx => {
      console.log('[Migration v1→v2] Normalizing fields...');

      await tx.table<Contact>('contacts').toCollection().modify((contact: any) => {
        // Telefonnummern normalisieren
        const phoneRaw = contact.phone || contact.mobile || '';
        contact.phoneDigits = phoneRaw.replace(/[^\d]/g, '').slice(-10) || null;

        // E-Mail User-Teil extrahieren
        const emailRaw = contact.email || '';
        contact.emailUser = emailRaw.toLowerCase().split('@')[0] || null;

        // Soundex für Blocking
        contact.soundex = computeSoundex(contact.lastName || '');
      });

      console.log('[Migration v1→v2] Complete');
    });
  }
}

// Minimaler Soundex (identisch zur WASM-Implementierung)
function computeSoundex(s: string): string {
  if (!s) return '0000';

  const upper = s.toUpperCase();
  let code = upper[0];

  const soundexMap: Record<string, string> = {
    'B': '1', 'F': '1', 'P': '1', 'V': '1',
    'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
    'D': '3', 'T': '3',
    'L': '4',
    'M': '5', 'N': '5',
    'R': '6'
  };

  let lastCode = soundexMap[upper[0]];

  for (let i = 1; i < upper.length && code.length < 4; i++) {
    const digit = soundexMap[upper[i]];
    if (digit && digit !== lastCode) {
      code += digit;
      lastCode = digit;
    } else if (!digit) {
      lastCode = undefined;
    }
  }

  return code.padEnd(4, '0');
}

export const db = new KontakteDB();
```

**Checklist:**
- [ ] Schema v1 implementiert
- [ ] Migration v1→v2 mit Tests
- [ ] Soundex-Funktion identisch zu Rust-Implementierung
- [ ] Migration-Logging für Debugging

### Quota & Persistenz

```typescript
// storage-manager.ts
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;

  const isPersisted = await navigator.storage.persisted();
  if (isPersisted) return true;

  return await navigator.storage.persist();
}

export async function getStorageEstimate(): Promise<{ used: number; quota: number; percent: number }> {
  if (!navigator.storage?.estimate) {
    return { used: 0, quota: 0, percent: 0 };
  }

  const estimate = await navigator.storage.estimate();
  const used = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const percent = quota > 0 ? (used / quota) * 100 : 0;

  return { used, quota, percent };
}

export function shouldWarnAboutStorage(percent: number): boolean {
  return percent > 80; // Warnung bei >80% Quota
}
```

**Checklist:**
- [ ] `navigator.storage.persist()` beim Onboarding
- [ ] Quota-Anzeige in Einstellungen
- [ ] Warnung bei >80% Quota
- [ ] Export-Hinweis bei kritischem Quota

### Export/Import-Formate (versioniert)

```typescript
// export-format.ts
export interface ContactExport {
  version: string;       // "1.0"
  exportDate: string;    // ISO 8601
  schemaVersion: number; // 2
  contacts: Contact[];
  meta?: Record<string, any>;
}

export function createExport(contacts: Contact[]): ContactExport {
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    schemaVersion: 2,
    contacts,
    meta: {
      totalCount: contacts.length,
      appVersion: '1.0.0' // aus package.json
    }
  };
}

export function validateImport(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.version) errors.push('Missing version field');
  if (!Array.isArray(data.contacts)) errors.push('Contacts must be an array');
  if (data.schemaVersion > 2) errors.push(`Unsupported schema version: ${data.schemaVersion}`);

  return { valid: errors.length === 0, errors };
}
```

**Checklist:**
- [ ] Versioniertes JSON-Format
- [ ] VCF-Export optional (spätere Phase)
- [ ] File System Access API mit Fallback
- [ ] Chunking für >50MB Exporte
- [ ] Round-trip Tests (Export → Import → Verify)

---

## 4) Suche & Dedupe (Fachlogik)

### Blocking-Schlüssel festgelegt - VARIANTE A (FINAL) ✅

**Entscheidung:** Variante A - Name-Phonetik + E-Mail-User + Telefon-Tail (ohne PLZ)

**Finaler Blocking-Key:**
```
soundex(lastName) + "-" + prefix(emailUser, 3) + "-" + suffix(phoneDigits, 4)
```

**Begründung:**
- ✅ Beste Balance aus Recall/Präzision ohne PLZ-Abhängigkeit
- ✅ Sprach-/Länderunabhängig (keine Postleitzahl nötig)
- ✅ Robuste Felder: Nachname fast immer vorhanden, E-Mail ODER Telefon oft vorhanden
- ✅ Stabil bei gemischter Datenqualität (Consumer-Adressbücher)

**Beispiele:**
- "Müller" + "max@test.de" + "0123456789" → `M460-max-6789`
- "Mueller" + "max@test.de" + "0123456789" → `M460-max-6789` (✓ gleich!)
- "Schmidt" + "anna@firma.de" + "9876543210" → `S530-ann-3210`
- "Müller" + (keine Mail) + "0123456789" → `M460----6789`
- "Schmidt" + "info@test.de" + (kein Tel) → `S530-inf-0000`

**Fallbacks:**
- Kein E-Mail: `"---"` (3 Zeichen)
- Kein Telefon: `"0000"` (4 Zeichen)
- Kein Nachname: `"0000"` als soundex

**Alternative Modi (optional, Feature-Flag):**
- **Variante B** (B2B/CRM): `soundex + PLZ[:3] + phone[-4]` (für verlässliche PLZ)
- **Variante C** (High-Recall): Doppel-Buckets `soundex+email` UND `soundex+phone`

**Checklist:**
- [x] Variante A als Default gewählt (ChatGPT + Gemini Empfehlung)
- [ ] Blocking-Key-Generierung in Rust implementiert
- [ ] Dexie-Normalisierung mit `emailUser`, `phoneDigits`, `soundex`
- [ ] Unit-Tests für Kantenfälle (Umlaute, fehlende Felder)
- [ ] Dokumentation in allen Dateien vereinheitlicht

### Search-Cache-Design

```typescript
// search-cache.ts (im Worker)
export interface SearchCacheEntry {
  id: number;
  str: string; // lowercase, normalisiert
}

export let searchCache: SearchCacheEntry[] | null = null;

export async function initializeSearchCache(): Promise<void> {
  const contacts = await db.contacts.toArray();

  searchCache = contacts.map(c => ({
    id: c.id!,
    str: [
      c.firstName,
      c.lastName,
      c.email,
      c.company,
      c.mobile,
      c.phone,
      c.city
    ].filter(Boolean).join(' ').toLowerCase()
  }));

  console.log(`[Worker] Search cache initialized: ${searchCache.length} contacts`);
}

export function updateCacheEntry(contact: Contact): void {
  if (!searchCache) return;

  const index = searchCache.findIndex(c => c.id === contact.id);
  const entry: SearchCacheEntry = {
    id: contact.id!,
    str: [
      contact.firstName,
      contact.lastName,
      contact.email,
      contact.company,
      contact.mobile,
      contact.phone,
      contact.city
    ].filter(Boolean).join(' ').toLowerCase()
  };

  if (index >= 0) {
    searchCache[index] = entry;
  } else {
    searchCache.push(entry);
  }
}

export function removeCacheEntry(contactId: number): void {
  if (!searchCache) return;
  searchCache = searchCache.filter(c => c.id !== contactId);
}
```

**Checklist:**
- [ ] Cache beim Worker-Start initialisieren
- [ ] `UPDATE_CACHE` für CRUD-Operationen
- [ ] `RELOAD_CACHE` nach Massenimport
- [ ] Batched Updates für Performance

### Qualitätsmetriken

- [ ] **Golden-Set:** ≥200 Kontakte mit gelabelten Duplikatpaaren
- [ ] **Ziel-Thresholds:**
  - Precision: >95% (wenig False Positives)
  - Recall: >90% (wenig False Negatives)
- [ ] **UI zeigt "Warum Duplikat":**
  - "Name: 87%" (Levenshtein/Jaro-Winkler)
  - "E-Mail identisch"
  - "Telefon identisch"

---

## 5) Kryptografie (rein lokal)

### WebCrypto-Helper (AES-GCM + PBKDF2)

```typescript
// crypto-helper.ts (im Worker verwendbar)
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250_000, // OWASP-Empfehlung 2024
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptAesGcm(
  key: CryptoKey,
  data: Uint8Array
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  return { iv, ciphertext: new Uint8Array(ct) };
}

export async function decryptAesGcm(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(pt);
}

// Versionierter Crypto-Header
export interface CryptoHeader {
  version: string;       // "1.0"
  algorithm: string;     // "AES-GCM-256"
  kdf: string;          // "PBKDF2-SHA256"
  kdfIterations: number; // 250000
  salt: string;         // Base64
  iv: string;           // Base64
}

export function createCryptoHeader(salt: Uint8Array, iv: Uint8Array): CryptoHeader {
  return {
    version: '1.0',
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    kdfIterations: 250_000,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv))
  };
}
```

**Checklist:**
- [ ] WebCrypto-Helper implementiert
- [ ] Versionierter Crypto-Header
- [ ] Passphrase-Flow dokumentiert
- [ ] Auto-Lock nach Inaktivität (optional)
- [ ] Recovery-Hinweis: "Kein Server = Kein Reset"
- [ ] Argon2 WASM optional (später, falls PBKDF2 zu langsam)

---

## 6) UI/UX & A11y

### Long-Task UX

```typescript
// progress-controller.ts
export class ProgressController {
  private abortController: AbortController | null = null;

  start(message: string): AbortController {
    this.abortController = new AbortController();
    // Zeige Progress-UI mit message
    return this.abortController;
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
    // Verstecke Progress-UI
  }

  complete(): void {
    this.abortController = null;
    // Verstecke Progress-UI
  }
}

// Usage in Worker
self.onmessage = async (e) => {
  const { type, id, payload } = e.data;
  const signal = payload.signal; // AbortSignal vom Main Thread

  try {
    if (type === 'FIND_DUPLICATES') {
      const contacts = await db.contacts.toArray();

      if (signal?.aborted) throw new Error('Aborted');

      const result = await findDuplicates(contacts, signal);
      // ...
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      self.postMessage({ type: 'CANCELLED', id });
    } else {
      self.postMessage({ type: 'ERROR', id, error: error.message });
    }
  }
};
```

**Checklist:**
- [ ] Progress-UI für Import/Dedupe/Search
- [ ] Cancel-Button funktioniert (AbortController)
- [ ] Progress-Prozent bei Import (chunked)
- [ ] Optimistic UI für CRUD

### Virtual Scroller QA

- [ ] Fokus bleibt korrekt bei Scroll
- [ ] Screenreader-Announcements bei Navigation
- [ ] Keyboard-Navigation (Arrow Up/Down, Page Up/Down, Home/End)
- [ ] Resize-Handling (Window-Größe ändert sich)
- [ ] Sehr große Listen (50k+ Kontakte) getestet

### i18n/L10n

- [ ] Umlaute/Diakritika normalisieren (é → e, ü → u)
- [ ] Pluralisierung ("1 Kontakt" vs "5 Kontakte")
- [ ] Datumsformate (DE: DD.MM.YYYY)
- [ ] Telefon-Normalisierung (E.164 für internationale Nummern)

---

## 7) Performance & Benchmarks

### Budgets (Target/Max)

| Operation | Target | Max | Status |
|-----------|--------|-----|--------|
| Search Keystroke | < 5 ms | < 16 ms | ⏳ |
| Dedupe 25k (Single-Thread) | < 100 ms | < 200 ms | ⏳ |
| Dedupe 25k (Threads) | < 50 ms | < 100 ms | N/A (kein COOP/COEP) |
| Import 25k | < 2 s | < 3 s | ⏳ |
| First Interaction | < 200 ms | < 300 ms | ⏳ |
| Bundle Size (WASM gzipped) | < 300 KB | < 600 KB | ⏳ |

### Repro-Benchmarks

```typescript
// benchmark.test.ts
import { test, expect } from '@playwright/test';

test('Import 25k contacts performance', async ({ page }) => {
  await page.goto('/');

  // Generate 25k test contacts
  const contacts = generateTestContacts(25000);
  const json = JSON.stringify({ contacts });

  const startTime = Date.now();

  // Trigger import
  await page.evaluate((data) => {
    return window.importContacts(data);
  }, json);

  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(2000); // < 2s
});

test('Duplicate scan 25k contacts', async ({ page }) => {
  await page.goto('/');

  // Load 25k contacts (with known duplicates)
  const contacts = generateContactsWithDuplicates(25000, 100);
  await page.evaluate((data) => {
    return window.db.contacts.bulkAdd(data);
  }, contacts);

  const startTime = Date.now();

  const duplicates = await page.evaluate(() => {
    return window.wasm.findDuplicates(0.85);
  });

  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(100); // < 100ms single-thread
  expect(duplicates.length).toBeGreaterThan(80); // Recall >80%
});
```

**Checklist:**
- [ ] Synthetic 25k/50k Datensätze mit kontrollierten Duplikaten
- [ ] E2E-Flows (Import → Search → Merge → Export)
- [ ] CI-Artefakt: JSON/HTML-Report mit Zeiten & Size-Diff
- [ ] Performance-Regression-Detection

---

## 8) Delivery & DX

### Build/Bundle

```bash
# build.sh
#!/bin/bash
set -e

echo "🦀 Building WASM..."
cd wasm
wasm-pack build --target web --out-dir pkg --release
cd ..

echo "📦 Building App..."
npm run build

echo "📊 Bundle Size Report:"
du -h wasm/pkg/contacts_wasm_bg.wasm
du -h dist/*.js | tail -5

echo "✅ Build Complete"
```

**Checklist:**
- [ ] `wasm-pack build --target web --release` integriert
- [ ] Bundler (Vite/Rspack/Esbuild) ESM-Worker-Pfad für WASM geklärt
- [ ] Lockfiles committed (`package-lock.json`, `Cargo.lock`)
- [ ] Reproduzierbare Builds (gleicher Input = gleicher Output Hash)

### CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: wasm32-unknown-unknown

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install wasm-pack
        run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

      - name: Install dependencies
        run: npm ci

      - name: Lint Rust
        run: cd wasm && cargo fmt --check && cargo clippy -- -D warnings

      - name: Lint TypeScript
        run: npm run lint

      - name: Build WASM
        run: cd wasm && wasm-pack build --target web --release

      - name: Test Rust
        run: cd wasm && cargo test

      - name: Build App
        run: npm run build

      - name: Size Check
        run: |
          SIZE=$(du -b wasm/pkg/contacts_wasm_bg.wasm | cut -f1)
          MAX=614400  # 600 KB
          if [ $SIZE -gt $MAX ]; then
            echo "❌ WASM bundle too large: $SIZE bytes (max: $MAX)"
            exit 1
          fi
          echo "✅ WASM bundle size OK: $SIZE bytes"

      - name: E2E Tests
        run: npm run test:e2e
```

**Checklist:**
- [ ] Lint/Format (Rust + TS/JS) in CI
- [ ] Unit-Tests (Rust + TS/JS)
- [ ] Worker-Integration-Tests (Playwright)
- [ ] E2E-Flows
- [ ] Size Guard (Fail wenn > 600 KB gzipped)
- [ ] Preview-Deploy mit COOP/COEP (wenn Self-Hosting)

### Lizenzprüfung

- [ ] Alle Rust Crates: MIT/Apache-2.0 kompatibel
- [ ] Alle npm Packages: MIT/Apache-2.0 kompatibel
- [ ] `fuzzy-matcher`: MIT ✅
- [ ] `dexie`: Apache-2.0 ✅
- [ ] `strsim`: MIT ✅
- [ ] `rayon`: Apache-2.0/MIT ✅

---

## Snippet: Worker-Init mit Cache & Fallback

```typescript
// worker-bootstrap.ts
import init, { DuplicateDetector, fuzzy_search } from '../wasm/pkg/contacts_wasm.js';
import { db } from './db';

let wasmReady = false;
let searchCache: Array<{id: number; str: string}> = [];

export async function ensureWasm() {
  if (!wasmReady) {
    await init();
    wasmReady = true;
  }
}

export async function reloadCache() {
  const contacts = await db.contacts.toArray();
  searchCache = contacts.map(c => ({
    id: c.id!,
    str: [
      c.firstName, c.lastName, c.email, c.company, c.mobile, c.phone, c.city
    ].filter(Boolean).join(' ').toLowerCase()
  }));
}

export function hasThreads(): boolean {
  return (globalThis as any).crossOriginIsolated === true &&
         typeof SharedArrayBuffer !== 'undefined';
}

export function getSearchCache() {
  return searchCache;
}
```

---

## Snippet: File System Access API (Export/Import)

```typescript
// file-io.ts (Main thread)
export async function exportJson(blob: Blob, suggestedName = 'contacts-export.json'): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'JSON',
          accept: { 'application/json': ['.json'] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return;
    } catch (e) {
      // User cancelled or error → fallback
    }
  }

  // Fallback: Blob Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importJson(): Promise<ContactExport | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'JSON',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });

      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (e) {
      // User cancelled or error
      return null;
    }
  }

  // Fallback: File Input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const text = await file.text();
      resolve(JSON.parse(text));
    };
    input.click();
  });
}
```

---

## Akzeptanzkriterien ("Ready when …")

### Must-Have (Blocking)

- [ ] Alle Header/Policies sind im Preview-Deploy aktiv (wenn Self-Hosting; für GitHub Pages: dokumentiert dass COOP/COEP nicht verfügbar)
- [ ] Capability-Probe blendet korrekt einen Limited-Mode-Banner ein
- [ ] Dexie v2 Schema mit Migration und Tests vorhanden
- [ ] Normalisierer (`phoneDigits`, `emailUser`, `soundex`) implementiert
- [ ] Search-Cache im Worker funktionsfähig
- [ ] `UPDATE_CACHE`/`RELOAD_CACHE` Pfade abgedeckt
- [ ] Blocking-Schlüssel dokumentiert & Unit-Tests decken Kantenfälle ab
- [ ] WebCrypto-Helper lauffähig & versioniert (auch wenn Verschlüsselung Phase 3 ist)
- [ ] Export/Import inkl. FS Access Fallback und Dateinamens-Konventionen

### Should-Have (Wichtig)

- [ ] Performance-Benchmarks laufen in CI, erzeugen Artefakte
- [ ] Budgets sind grün (oder dokumentiert warum nicht)
- [ ] CSP bricht keine Worker/WASM-Ladewege
- [ ] Manuelle Smoke-Tests in Safari & iOS bestanden
- [ ] A11y/UX: Progress + Cancel bei Import/Dedupe
- [ ] Virtual Scroller Keyboard-/Screenreader-Checks bestanden

### Nice-to-Have (Optional)

- [ ] OPFS als Alternative zu IndexedDB evaluiert (nicht kritisch)
- [ ] Multi-Threading mit COOP/COEP auf Self-Hosted-Variante getestet
- [ ] Argon2 WASM als PBKDF2-Alternative evaluiert
- [ ] Offline-First PWA-Manifest

---

## Nächste Schritte

1. ✅ Diese Definition of Ready reviewen
2. ⏳ Fehlende Checkboxen abhaken (Implementierung)
3. ⏳ Tests schreiben (Golden-Set, Unit, E2E)
4. ⏳ CI/CD Pipeline aufsetzen
5. ⏳ Preview-Deploy testen
6. 🚀 **Go-Live wenn alle Must-Haves erfüllt**

---

**Erstellt:** 2025-11-02
**Letzte Änderung:** 2025-11-02
**Status:** 🔴 In Arbeit
