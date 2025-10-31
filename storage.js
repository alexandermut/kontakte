import { state } from './state.js';

const STORAGE_KEY = 'contactsApp.contacts';
const SORT_STORAGE_KEY = 'contactsApp.sort';

/**
 * Speichert die Kontakte im localStorage.
 */
export function persistContacts() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
    } catch (error) {
        console.error("Fehler beim Speichern der Kontakte:", error);
    }
}

/**
 * Lädt die Kontakte aus dem localStorage.
 * @returns {boolean} True wenn Kontakte geladen wurden, false wenn leer.
 */
export function loadContacts() {
    try {
        const storedContacts = localStorage.getItem(STORAGE_KEY);
        if (storedContacts) {
            state.contacts = JSON.parse(storedContacts);
            // Setze nextId basierend auf der höchsten ID
            if (state.contacts.length > 0) {
                state.nextId = Math.max(0, ...state.contacts.map(c => c.id)) + 1;
            }
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Laden der Kontakte:", error);
    }
    return false;
}

/**
 * Lädt Dummy-Kontakte aus der JSON-Datei.
 */
export async function loadDummyContacts() {
    try {
        const response = await fetch('dummy-contacts.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const dummyData = await response.json();
        // Durch das reaktive State-Objekt wird die UI automatisch neu gerendert.
        state.contacts = dummyData;
        // Setze nextId basierend auf der höchsten ID
        if (state.contacts.length > 0) {
            state.nextId = Math.max(0, ...state.contacts.map(c => c.id)) + 1;
        }
        persistContacts(); // Speichere die Dummy-Daten
    } catch (error) {
        console.error("Konnte Dummy-Kontakte nicht laden:", error);
        // Hier könnte man eine Fehlermeldung in der UI anzeigen.
    }
}

/**
 * Speichert die Sortierung im localStorage.
 */
export function persistSort() {
    try {
        localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(state.sort));
    } catch (error) {
        console.error("Fehler beim Speichern der Sortierung:", error);
    }
}

/**
 * Lädt die Sortierung aus dem localStorage.
 */
export function loadSort() {
    try {
        const storedSort = localStorage.getItem(SORT_STORAGE_KEY);
        if (storedSort) {
            state.sort = JSON.parse(storedSort);
        }
    } catch (error) {
        console.error("Fehler beim Laden der Sortierung:", error);
    }
}