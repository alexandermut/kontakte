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