import { state } from './state.js';
import { showNotification } from './contacts.js';

const MAX_TABS = 5;

/**
 * Opens a tab for a contact or creates a new contact tab.
 * If the contact is already open, switches to that tab.
 * @param {Object|null} contact - The contact to open, or null for "new contact"
 */
export function openTab(contact = null) {
    // FIX EDGE #6: Each "new contact" tab gets unique contactId to allow multiple new tabs
    const contactId = contact ? contact.id : `new-${state.nextTabId}`;

    // Check if tab already exists (only for existing contacts, not "new" ones)
    if (contact) {
        const existingTab = state.openTabs.find(tab => tab.contactId === contactId);
        if (existingTab) {
            // Switch to existing tab
            state.activeTabId = existingTab.id;
            state.activeView = 'tab';
            return;
        }
    }

    // Check max tabs limit
    if (state.openTabs.length >= MAX_TABS) {
        showNotification(`Maximale Anzahl von ${MAX_TABS} Tabs erreicht. Bitte schließen Sie einen Tab.`);
        return;
    }

    // Create new tab
    const tabId = `tab-${state.nextTabId}`;
    state.nextTabId++;

    const title = contact
        ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unbenannt'
        : 'Neuer Kontakt';

    const newTab = {
        id: tabId,
        contactId: contactId,
        title: title
    };

    state.openTabs = [...state.openTabs, newTab];
    state.activeTabId = tabId;
    state.activeView = 'tab';
}

/**
 * Closes a tab by its ID.
 * @param {string} tabId - The ID of the tab to close
 */
export function closeTab(tabId) {
    const tabIndex = state.openTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;

    // Remove tab from array
    const newTabs = state.openTabs.filter(tab => tab.id !== tabId);
    state.openTabs = newTabs;

    // If we closed the active tab, switch to another tab or back to list
    if (state.activeTabId === tabId) {
        if (newTabs.length > 0) {
            // Switch to previous tab (or next if we closed the first one)
            const newIndex = Math.max(0, tabIndex - 1);
            state.activeTabId = newTabs[newIndex].id;
            state.activeView = 'tab';
        } else {
            // No tabs left, go back to list
            state.activeTabId = null;
            state.activeView = 'list';
        }
    }
}

/**
 * Closes all tabs that reference a specific contact (e.g., when contact is deleted).
 * @param {number} contactId - The ID of the contact
 */
export function closeTabsByContactId(contactId) {
    const tabsToClose = state.openTabs.filter(tab => tab.contactId === contactId);
    tabsToClose.forEach(tab => closeTab(tab.id));
}

/**
 * Switches to a specific tab.
 * @param {string} tabId - The ID of the tab to switch to
 */
export function switchToTab(tabId) {
    const tab = state.openTabs.find(t => t.id === tabId);
    if (!tab) return;

    state.activeTabId = tabId;
    state.activeView = 'tab';
}

/**
 * Updates the title of a tab (e.g., after saving a contact).
 * @param {string} tabId - The ID of the tab
 * @param {string} newTitle - The new title
 */
export function updateTabTitle(tabId, newTitle) {
    const tabIndex = state.openTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;

    const updatedTabs = [...state.openTabs];
    updatedTabs[tabIndex] = {
        ...updatedTabs[tabIndex],
        title: newTitle
    };
    state.openTabs = updatedTabs;
}

/**
 * Updates the contact ID for a tab (used after creating a new contact).
 * @param {string} tabId - The ID of the tab
 * @param {number} newContactId - The new, permanent contact ID
 */
export function updateTabContactId(tabId, newContactId) {
    const tabIndex = state.openTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;

    const updatedTabs = [...state.openTabs];
    updatedTabs[tabIndex] = {
        ...updatedTabs[tabIndex],
        contactId: newContactId
    };
    state.openTabs = updatedTabs;
}

/**
 * Gets the currently active tab object.
 * @returns {Object|null} The active tab or null
 */
export function getActiveTab() {
    if (!state.activeTabId) return null;
    return state.openTabs.find(tab => tab.id === state.activeTabId);
}

/**
 * Gets the contact associated with the active tab.
 * @returns {Object|null} The contact or null (for "new" tabs)
 */
export function getActiveTabContact() {
    const activeTab = getActiveTab();
    if (!activeTab) return null;

    // FIX: Handle new contactId format (new-X)
    const isNewContact = typeof activeTab.contactId === 'string' && activeTab.contactId.startsWith('new-');
    if (isNewContact) {
        return null; // New contact, no data yet
    }

    return state.contacts.find(c => c.id === activeTab.contactId);
}
