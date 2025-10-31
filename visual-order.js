import { state } from './state.js';
import { filterContacts } from './filters.js';
import { sortContacts } from './utils.js';

/**
 * Gibt die Kontakte in genau der Reihenfolge zurück, wie sie auf dem Bildschirm erscheinen.
 * Das ist die gefilterte und sortierte Liste (ohne Gruppierung).
 * @returns {Array} Array der sichtbaren Kontakte in visueller Reihenfolge
 */
export function getVisualOrder() {
    const filteredContacts = filterContacts(state.contacts);
    return [...filteredContacts].sort(sortContacts);
}
