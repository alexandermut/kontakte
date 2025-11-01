# Projekt-Roadmap: Kontaktmanager

Dieses Dokument beschreibt die Vision, geplante Features und bekannte Probleme der Kontaktmanager-Anwendung.

## 1. Projekt-Vision

Das Ziel ist ein schneller, moderner und benutzerfreundlicher client-seitiger Kontaktmanager. Er soll die einfache Verwaltung von Kontakten ermöglichen und durch VCF-Import/Export eine Brücke zu anderen Geräten und Programmen schlagen. Die Bedienung soll sich an Desktop-Anwendungen orientieren (z.B. durch Shortcuts, Mehrfachauswahl).

---

## 2. Aktuelle Probleme & Bugs

*   **Klick-Verzögerung:** Die Unterscheidung zwischen Einzel- und Doppelklick wird aktuell mit einem `setTimeout` gelöst. Dies führt zu einer leichten Verzögerung bei der Auswahl von Kontakten. Dies könnte durch eine robustere Event-Handling-Logik verbessert werden.
*   **VCF-Kompatibilität:** Der VCF-Parser ist rudimentär und unterstützt möglicherweise nicht alle Dialekte und Felder des VCF-Standards (z.B. mehrere Telefonnummern, komplexe Adressen).
*   **Performance bei >1000 Kontakten:** Das Rendern der gesamten Liste könnte bei sehr vielen Kontakten langsam werden. Hier könnte "Virtual Scrolling" eine zukünftige Lösung sein.

---

## 3. Kurzfristige Ziele (Nächste Schritte)

### 🚧 IN ARBEIT: Multi-Tab Kontakt-Detailansicht (Ersetzt Modal-System)

**Status**: Teilweise implementiert (ca. 60% fertig)

**Architektur-Entscheidungen:**
- ✅ Zweite Tab-Leiste unterhalb der Hauptnavigation (Kontaktliste | Auswertung)
- ✅ **Ein Formular pro Tab** (max. 5 gleichzeitige Tabs)
- ✅ Tabs bleiben offen beim Wechsel zu Liste/Auswertung
- ✅ Auto-Close nach erfolgreichem Speichern
- ✅ Gleicher Kontakt nur 1× öffnen (zu existierendem Tab wechseln)
- ✅ Immer im Edit-Mode (kein Read-Only View im MVP)

**Bereits implementiert:**
- ✅ State erweitert (`openTabs`, `activeTabId`, `nextTabId`) - [state.js](state.js:5-17)
- ✅ Tab-Management-Modul ([tabs.js](tabs.js)) mit:
  - `openTab(contact)` - Öffnet Tab oder wechselt zu existierendem
  - `closeTab(tabId)` - Schließt Tab und wechselt zu anderem/Liste
  - `closeTabsByContactId(contactId)` - Schließt alle Tabs eines Kontakts (für Löschen)
  - `switchToTab(tabId)` - Wechselt zu einem Tab
  - `getActiveTab()` / `getActiveTabContact()` - Helper-Funktionen
- ✅ HTML-Struktur vorbereitet:
  - Modal komplett entfernt
  - `#contact-tabs` Container für Tab-Leiste eingefügt
  - `#tab-container` für Formular-Rendering eingefügt
- ✅ Formular-Template-Funktion ([contact-form-template.js](contact-form-template.js))
  - Generiert komplettes Formular-HTML mit eindeutigen IDs pro Tab
  - Alle Felder haben Tab-spezifische IDs (z.B. `contact-firstName-tab-1`)

**Verbleibende Implementierung:**

#### 1. **ui.js - Tab-Rendering** (~200 Zeilen) 🔴 KRITISCH
```javascript
// Zu implementieren:
- renderContactTabs() {
    // Rendert die zweite Tab-Leiste mit allen offenen Tabs
    // Zeigt Tab-Titel und Close-Button (×)
    // Markiert aktiven Tab
}

- renderTabContainers() {
    // Erstellt/Aktualisiert Formulare für alle Tabs
    // Verwendet getContactFormTemplate(tabId) für HTML
    // Füllt Formulare mit Kontaktdaten via fillTabForm()
}

- fillTabForm(tabId, contact) {
    // Befüllt alle Formularfelder für einen Tab
    // WICHTIG: Muss ALLE Felder aus openModal() Logik übernehmen
    // Felder: firstName, lastName, email, phone, company, etc. (~22 Felder)
    // Social Media Badges rendern
    // Löschen-Button ein/ausblenden (nur bei existierenden Kontakten)
}

- render() erweitern:
    // Fall: state.activeView === 'tab'
    //   → Zeige #contact-tabs und #tab-container
    //   → Verstecke list-view und stats-view
    //   → Rufe renderContactTabs() und renderTabContainers() auf
```

**Dateipfad**: [ui.js](ui.js:8-98)
**Referenz für Formular-Befüllung**: [contacts.js:23-67](contacts.js:23-67) (openModal-Funktion)

---

#### 2. **contacts.js - Refactoring** (~100 Zeilen) 🔴 KRITISCH
```javascript
// Zu löschen:
- openModal() {  // Zeilen 22-70 → KOMPLETT LÖSCHEN
- closeModal() { // Zeilen 75-78 → KOMPLETT LÖSCHEN

// Zu ändern:
- saveContact(e) { // Zeilen 83+
    // PROBLEM: Aktuell nutzt es DOM-Elemente ohne Tab-ID (z.B. dom.contactFirstNameInput)
    // LÖSUNG: Muss Tab-ID ermitteln und Felder mit Tab-Suffix abrufen

    // NEU:
    const tabId = e.target.closest('form').dataset.tabId; // Aus Formular holen
    const id = document.getElementById(`contact-id-${tabId}`).value;
    const firstName = document.getElementById(`contact-firstName-${tabId}`).value.trim();
    // ... alle ~22 Felder mit ${tabId} Suffix

    // Nach erfolgreichem Speichern:
    import { closeTab } from './tabs.js';
    closeTab(tabId); // Schließt Tab automatisch
    state.activeView = 'list'; // Wechselt zurück zur Liste
}

- deleteContact(contactId) {
    // NEU: Prüfen ob Kontakt in einem Tab offen ist
    import { closeTabsByContactId } from './tabs.js';
    closeTabsByContactId(contactId); // Schließt alle Tabs dieses Kontakts
    // ... rest der Löschlogik
}
```

**Dateipfad**: [contacts.js](contacts.js:1-200)
**Referenz für alle Formularfelder**: Siehe openModal() Zeilen 28-56

---

#### 3. **events.js - Event-Handler umschreiben** (~80 Zeilen) 🟡 MITTEL
```javascript
// Zu ändern:

// A) Edit-Button (Zeile ~164):
//    VORHER: openModal(contact)
//    NACHHER:
import { openTab } from './tabs.js';
openTab(contact);

// B) Doppelklick (Zeile ~227):
//    VORHER: openModal(contact)
//    NACHHER: openTab(contact)

// C) "Neuer Kontakt" Button (Zeile 58):
//    VORHER: openModal()
//    NACHHER: openTab(null)

// NEU: Event-Listener für Kontakt-Tabs hinzufügen
const contactTabsNav = document.getElementById('contact-tabs');
contactTabsNav.addEventListener('click', (e) => {
    // Tab-Wechsel (Klick auf Tab-Button)
    const tabButton = e.target.closest('.contact-tab');
    if (tabButton && !e.target.closest('.tab-close-btn')) {
        const tabId = tabButton.dataset.tabId;
        switchToTab(tabId);
        return;
    }

    // Tab-Schließen (Klick auf X-Button)
    const closeBtn = e.target.closest('.tab-close-btn');
    if (closeBtn) {
        const tabId = closeBtn.dataset.tabId;
        closeTab(tabId);
    }
});

// NEU: Formular-Tab-Switcher anpassen (Zeilen 82-101)
// PROBLEM: Aktueller Code nutzt globale .form-tab Selector
// LÖSUNG: Muss Tab-spezifisch sein via data-form="${tabId}" Attribut

formTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        const targetTab = tab.dataset.tab;
        const formId = tab.dataset.form; // NEU: Tab-ID ermitteln

        // Nur Tabs DIESES Formulars ändern
        const formTabs = document.querySelectorAll(`.form-tab[data-form="${formId}"]`);
        const formContents = document.querySelectorAll(`[data-tab-content][data-form="${formId}"]`);

        formTabs.forEach(t => t.classList.remove('active'));
        formContents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = document.querySelector(
            `[data-tab-content="${targetTab}"][data-form="${formId}"]`
        );
        targetContent.classList.add('active');
    });
});

// NEU: Formular Submit-Handler
// WICHTIG: Jedes Tab-Formular braucht eigenen Submit-Listener
// Wird in renderTabContainers() via addEventListener hinzugefügt
```

**Dateipfad**: [events.js](events.js:1-229)

---

#### 4. **CSS für Tab-System** (~150 Zeilen) 🟡 MITTEL
```css
/* Zu erstellen in style.css */

/* ===== Kontakt-Tabs (zweite Ebene) ===== */
.contact-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 var(--spacing-lg);
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto; /* Für viele Tabs */
}

.contact-tabs.hidden {
    display: none;
}

.contact-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
    border-top: 2px solid transparent;
}

.contact-tab:hover {
    background-color: var(--bg-primary);
    color: var(--text-primary);
}

.contact-tab.active {
    background-color: var(--bg-primary);
    color: var(--color-primary);
    border-top-color: var(--color-primary);
}

.tab-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
}

.tab-close-btn:hover {
    opacity: 1;
    background-color: var(--color-danger);
    color: white;
}

/* ===== Tab-Container (hält Formulare) ===== */
.tab-container {
    padding: var(--spacing-xl);
    overflow-y: auto;
    max-height: calc(100vh - 200px); /* Anpassen je nach Layout */
}

.tab-container.hidden {
    display: none;
}

.contact-form {
    max-width: 900px;
    margin: 0 auto;
}

.contact-form.hidden {
    display: none;
}

/* Form-Footer (ersetzt modal-footer) */
.form-footer {
    display: flex;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    margin-top: var(--spacing-lg);
}

/* Responsive: Schmale Bildschirme */
@media (max-width: 768px) {
    .contact-tabs {
        padding: 0 var(--spacing-sm);
    }

    .contact-tab {
        padding: 0.375rem 0.75rem;
        font-size: 0.8125rem;
    }

    .tab-container {
        padding: var(--spacing-md);
    }
}
```

**Dateipfad**: [style.css](style.css) (am Ende einfügen, nach Zeile 1214)

---

#### 5. **merge.js - Anpassung** (~10 Zeilen) 🟢 EINFACH
```javascript
// Zeile 75-76:
// VORHER:
closeContactModal(); // Close the contact edit modal
openMergeModal(duplicate, newContactData, isNewContact);

// NACHHER:
import { getActiveTab, closeTab } from './tabs.js';
const activeTab = getActiveTab();
if (activeTab) {
    closeTab(activeTab.id); // Schließt aktuell offenen Tab
}
state.activeView = 'list'; // Wechselt zur Liste
openMergeModal(duplicate, newContactData, isNewContact);
```

**Dateipfad**: [merge.js:75-76](merge.js:75-76)

---

#### 6. **Social Media Badges - Anpassung** (~20 Zeilen) 🟢 EINFACH
```javascript
// social-media-badges.js
// Funktion renderSocialBadges() anpassen

// VORHER:
export function renderSocialBadges(socialMedia = []) {
    const container = document.getElementById('social-media-badges');
    // ...
}

// NACHHER:
export function renderSocialBadges(socialMedia = [], tabId = '') {
    const containerId = tabId ? `social-media-badges-${tabId}` : 'social-media-badges';
    const container = document.getElementById(containerId);
    // ... rest bleibt gleich
}

// Alle Aufrufe von renderSocialBadges() müssen tabId übergeben:
// contacts.js: renderSocialBadges(contact.socialMedia || [], tabId)
```

**Dateipfad**: [social-media-badges.js](social-media-badges.js)

---

#### 7. **Testing-Checkliste** 🧪

Nach Implementierung testen:

**Basis-Funktionalität:**
- [ ] Klick auf "Neuer Kontakt" → Tab öffnet sich mit leerem Formular
- [ ] Klick auf Kontakt in Liste → Tab öffnet sich mit Daten
- [ ] Doppelklick auf Kontakt → Tab öffnet sich
- [ ] Tab-Titel zeigt Kontaktnamen korrekt
- [ ] Wechsel zwischen Tabs funktioniert
- [ ] X-Button schließt Tab

**Tab-Limit:**
- [ ] Max 5 Tabs öffnen → 6. Tab zeigt Fehlermeldung

**Gleicher Kontakt:**
- [ ] Kontakt "Max M." öffnen → Tab 1 öffnet sich
- [ ] Nochmal "Max M." öffnen → wechselt zu Tab 1 (kein neuer Tab)

**Speichern & Schließen:**
- [ ] Kontakt bearbeiten & Speichern → Tab schließt automatisch
- [ ] Änderungen in Kontaktliste sichtbar

**Löschen:**
- [ ] Kontakt in Tab öffnen, Löschen-Button klicken → Tab schließt, Kontakt weg

**Navigation:**
- [ ] Tab offen, wechseln zu "Auswertung" → Tab bleibt offen
- [ ] Zurück zu "Kontaktliste" → Tab immer noch offen
- [ ] Tab aktivieren → Formular erscheint

**Formular-Tabs:**
- [ ] Zwischen "Allgemein", "Privat", "Beruflich" wechseln → funktioniert in jedem Tab unabhängig

**Mehrere Tabs:**
- [ ] Tab 1: Max Mustermann, Tab 2: Erika Müller
- [ ] In Tab 1 Name ändern, zu Tab 2 wechseln
- [ ] Zurück zu Tab 1 → Änderungen noch da (nicht gespeichert)
- [ ] Tab 1 Speichern → schließt, Änderungen persistent

**Edge-Cases:**
- [ ] Kontakt in Tab offen, über Liste löschen → Tab schließt automatisch
- [ ] Alle Tabs schließen → Zurück zu Liste
- [ ] Tab öffnen, Abbrechen → Tab schließt

**Duplicate Detection:**
- [ ] In Tab Kontakt erstellen, Duplikat → Dialog erscheint
- [ ] Zusammenführen → Merge-Dialog, danach zurück zur Liste

---

### Weitere kurzfristige Ziele

- **Kontakt-Avatars:** Implementierung von Foto/Avatar-Unterstützung mit Fallback auf Initialen-Avatars in verschiedenen Farben.
- **Geburtstags-Erinnerungen:** Anzeige bevorstehender Geburtstage (z.B. in den nächsten 7 Tagen) in der Toolbar oder als Badge.
- **Duplikatsprüfung verbessern:** Eine erweiterte Prüfung beim Speichern und Importieren, um Duplikate zuverlässiger zu erkennen (aktuell nur Name-basiert).
- **Kontaktfelder-Erweiterung:** Unterstützung für mehrere Telefonnummern, E-Mail-Adressen und Notizen.

---

## 4. Mittelfristige Ziele (Feature-Backlog)

- **Spalten per Drag & Drop verschieben:** Dem Benutzer erlauben, die Reihenfolge der Spalten in der Tabellenansicht nach seinen Wünschen anzupassen und zu speichern.
- **Duplikate zusammenführen:** Eine dedizierte Funktion, um Duplikate in der Liste zu finden und dem Benutzer eine Oberfläche zum Zusammenführen (Merging) anzubieten.
- **Erweiterte Filter-Optionen:** Zusätzliche Filtermöglichkeiten für "Kontakte ohne E-Mail", "Kontakte ohne Telefonnummer", "Geburtstage diesen Monat" etc.
- **Druckansicht:** Eine saubere, für den Druck optimierte Ansicht der Kontaktliste.
- **Kontakt-Detailansicht:** Statt eines Modals könnte ein Klick auf einen Kontakt eine dedizierte Detailansicht (z.B. in einer Seitenleiste) öffnen.
- **Benutzerdefinierte Kategorien:** Dem Benutzer erlauben, eigene Kategorien zu erstellen, zu bearbeiten und zu löschen.

---

## 5. Langfristige Ideen (Vision)

- **Backend-Synchronisierung:** Anbindung an einen echten Server oder eine API (z.B. CardDAV, Google Contacts API), um Kontakte über Geräte hinweg zu synchronisieren.
- **Progressive Web App (PWA):** Die Anwendung installierbar machen, um sie wie eine native App zu nutzen und Offline-Fähigkeiten zu verbessern.
- **Benutzerdefinierte Felder:** Dem Benutzer erlauben, eigene Felder zu Kontakten hinzuzufügen (z.B. Social Media Profile, Hobbies).
- **Kontakthistorie:** Protokollierung von Änderungen an Kontakten mit Undo/Redo-Funktionalität.
- **Export in andere Formate:** CSV, JSON, oder Excel-Export zusätzlich zu VCF.

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
- ✅ Duplikats-Erkennung beim Import (Name-basiert).

### Import/Export
- ✅ VCF-Import mit Quoted-Printable-Dekodierung für Sonderzeichen.
- ✅ VCF-Export der gesamten Kontaktliste.
- ✅ VCF-Export nur ausgewählter Kontakte (Bulk-Export).
- ✅ Unterstützung für CATEGORIES und BDAY in VCF 3.0.

### Mehrfachauswahl & Bulk-Aktionen
- ✅ Mehrfachauswahl mit `Strg/Cmd` + Klick (einzelne Kontakte hinzufügen/entfernen).
- ✅ Bereichsauswahl mit `Shift` + Klick (respektiert visuelle Reihenfolge nach Filterung/Sortierung).
- ✅ Bulk-Löschen ausgewählter Kontakte.
- ✅ Bulk-Export ausgewählter Kontakte.

### UI/UX
- ✅ Dark/Light-Theme mit persistenter Speicherung.
- ✅ Responsives Design für verschiedene Bildschirmgrößen.
- ✅ Tastatur-Shortcuts (`Strg/Cmd + N` für neuen Kontakt, `Strg/Cmd + F` für Suche, `Strg/Cmd + E` für Export, `Esc` zum Schließen).
- ✅ Doppelklick zum Öffnen eines Kontakts.
- ✅ Visuelles Feedback bei Auswahl und Hover-Effekte.