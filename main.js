import { state, subscribe, subscribeToPersist } from './state.js';
import { render } from './ui.js';
import { loadContacts, loadDummyContacts, persistContacts, loadSort } from './storage.js';
import { setupEventListeners } from './events.js';

/**
 * Main application entry point.
 */
async function init() {
    console.log('App initialisiert...');

    // 1. Die render-Funktion abonnieren. Sie wird nun bei jeder Zustandsänderung aufgerufen.
    subscribe(render);

    // 2. Automatisches Speichern bei Kontakt-Änderungen
    subscribeToPersist(persistContacts);

    // 3. Lade gespeicherte Sortierung
    loadSort();

    // 4. Event-Listener einrichten.
    setupEventListeners();

    // 5. Lade die initialen Daten. Erst aus localStorage, dann ggf. Dummy-Daten.
    const hasStoredContacts = loadContacts();
    if (!hasStoredContacts) {
        await loadDummyContacts();
    }
}

// Start the app once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);