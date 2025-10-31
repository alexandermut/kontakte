import { state } from './state.js';

/**
 * Filters contacts based on the current search term and category filter.
 * @param {Array} contacts - Array of contacts to filter
 * @returns {Array} Filtered contacts
 */
export function filterContacts(contacts) {
    let filtered = contacts;

    // Apply category filter
    if (state.categoryFilter) {
        if (state.categoryFilter === 'favorites') {
            filtered = filtered.filter(c => c.isFavorite);
        } else {
            filtered = filtered.filter(c => c.category === state.categoryFilter);
        }
    }

    // Apply search filter
    const lowerSearch = state.searchTerm.toLowerCase().trim();
    if (lowerSearch) {
        filtered = filtered.filter(contact => {
            return (contact.name || '').toLowerCase().includes(lowerSearch) ||
                   (contact.firstName || '').toLowerCase().includes(lowerSearch) ||
                   (contact.lastName || '').toLowerCase().includes(lowerSearch) ||
                   (contact.nickname || '').toLowerCase().includes(lowerSearch) ||
                   (contact.company || '').toLowerCase().includes(lowerSearch) ||
                   (contact.title || '').toLowerCase().includes(lowerSearch) ||
                   (contact.email || '').toLowerCase().includes(lowerSearch) ||
                   (contact.workEmail || '').toLowerCase().includes(lowerSearch) ||
                   (contact.phone || '').toLowerCase().includes(lowerSearch) ||
                   (contact.mobile || '').toLowerCase().includes(lowerSearch) ||
                   (contact.workPhone || '').toLowerCase().includes(lowerSearch) ||
                   (contact.workMobile || '').toLowerCase().includes(lowerSearch) ||
                   (contact.street || '').toLowerCase().includes(lowerSearch) ||
                   (contact.zip || '').toLowerCase().includes(lowerSearch) ||
                   (contact.city || '').toLowerCase().includes(lowerSearch) ||
                   (contact.workStreet || '').toLowerCase().includes(lowerSearch) ||
                   (contact.workZip || '').toLowerCase().includes(lowerSearch) ||
                   (contact.workCity || '').toLowerCase().includes(lowerSearch) ||
                   (contact.category || '').toLowerCase().includes(lowerSearch) ||
                   (contact.url || '').toLowerCase().includes(lowerSearch) ||
                   (contact.notes || '').toLowerCase().includes(lowerSearch);
        });
    }

    return filtered;
}

/**
 * Gets the currently visible (filtered and sorted) contacts.
 * @returns {Array} Visible contacts
 */
export function getVisibleContacts() {
    return filterContacts(state.contacts);
}
