import { state, dom } from './state.js';
import { persistContacts } from './storage.js';
import { isValidEmail, isValidGermanZip, findDuplicate } from './utils.js';
import { getVisualOrder } from './visual-order.js';
import { renderSocialBadges, getSocialMediaDataFromBadges } from './social-media-badges.js';
import { showDuplicateDialog } from './merge.js';
import { closeTab, closeTabsByContactId, updateTabTitle, updateTabContactId } from './tabs.js';

/**
 * Shows a notification message to the user.
 */
export function showNotification(message) {
    dom.notification.textContent = message;
    dom.notification.classList.add('visible');
    setTimeout(() => {
        dom.notification.classList.remove('visible');
    }, 3000);
}

// openModal() and closeModal() REMOVED - Replaced by Tab system
// See tabs.js for openTab() / closeTab() functions

/**
 * Saves a contact (create or update).
 * Now works with tab-based forms (each field has tab-specific ID)
 */
export function saveContact(e) {
    e.preventDefault();

    // Close any open badge input fields before saving
    const openBadgeInput = document.querySelector('.social-badge-input');
    if (openBadgeInput) {
        openBadgeInput.blur(); // Trigger blur to save the badge
    }

    // Get tab ID from form
    const form = e.target.closest('form');
    const tabId = form ? form.dataset.tabId : null;

    if (!tabId) {
        console.error('No tabId found in form!');
        return;
    }

    // Helper to get field value by ID with tab suffix
    const getVal = (id) => {
        const el = document.getElementById(`${id}-${tabId}`);
        return el ? el.value.trim() : '';
    };

    const idValue = document.getElementById(`contact-id-${tabId}`)?.value;
    const id = idValue ? parseInt(idValue, 10) : null; // Convert to number!
    const lastName = getVal('contact-lastName');

    // Validierung
    if (!lastName) {
        showNotification('Nachname ist ein Pflichtfeld.');
        return;
    }

    const email = getVal('contact-email');
    if (email && !isValidEmail(email)) {
        showNotification('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        return;
    }

    const workEmail = getVal('contact-workEmail');
    if (workEmail && !isValidEmail(workEmail)) {
        showNotification('Bitte geben Sie eine gültige geschäftliche E-Mail-Adresse ein.');
        return;
    }

    const zip = getVal('contact-zip');
    if (zip && !isValidGermanZip(zip)) {
        showNotification('PLZ muss aus 5 Ziffern bestehen.');
        return;
    }

    const workZip = getVal('contact-workZip');
    if (workZip && !isValidGermanZip(workZip)) {
        showNotification('Geschäftliche PLZ muss aus 5 Ziffern bestehen.');
        return;
    }

    const firstName = getVal('contact-firstName');
    const contactData = {
        // Allgemein
        lastName: lastName,
        firstName: firstName,
        name: `${firstName} ${lastName}`.trim(), // Kombiniertes Feld für Suche
        nickname: getVal('contact-nickname'),
        birthday: document.getElementById(`contact-birthday-${tabId}`)?.value || '',
        category: document.getElementById(`contact-category-${tabId}`)?.value || '',
        url: getVal('contact-url'),
        notes: getVal('contact-notes'),

        // Privat
        email: email,
        phone: getVal('contact-phone'),
        mobile: getVal('contact-mobile'),
        street: getVal('contact-street'),
        zip: zip,
        city: getVal('contact-city'),

        // Beruflich
        company: getVal('contact-company'),
        title: getVal('contact-title'),
        role: getVal('contact-role'),
        workEmail: workEmail,
        workPhone: getVal('contact-workPhone'),
        workMobile: getVal('contact-workMobile'),
        workStreet: getVal('contact-workStreet'),
        workZip: workZip,
        workCity: getVal('contact-workCity'),

        // Social Media Badges - need to get from specific tab
        socialMedia: getSocialMediaDataFromBadges(tabId),
    };

    // Check for duplicates (exclude current contact if editing)
    const duplicate = findDuplicate(contactData, state.contacts, id);
    console.log('=== DUPLICATE CHECK ===');
    console.log('Checking contactData:', contactData);
    console.log('Current ID (editing):', id);
    console.log('Duplicate found:', duplicate);

    if (duplicate) {
        console.log('Duplicate found, showing dialog');
        // If editing existing contact, add the ID to contactData
        if (id) {
            contactData.id = parseInt(id);
        }
        const isNewContact = !id;

        // Show custom duplicate dialog instead of confirm()
        showDuplicateDialog(duplicate, contactData, isNewContact, tabId);
        return; // Don't save yet, wait for user decision
    }

    // Normal save path (no duplicate detected)
    if (id) {
        // Bearbeiten
        const index = state.contacts.findIndex(c => c.id == id);
        if (index !== -1) {
            // Behalte den Favoritenstatus bei
            const updatedContact = { ...state.contacts[index], ...contactData };
            state.contacts[index] = updatedContact;
            // Force re-render by creating new array
            state.contacts = [...state.contacts];
            // Update tab title if name changed
            updateTabTitle(tabId, updatedContact.name);
        }
    } else {
        // Neu
        contactData.id = state.nextId++;
        contactData.isFavorite = false;
        const newContact = { ...contactData, socialMedia: contactData.socialMedia || [] };
        state.contacts = [...state.contacts, newContact];
        // Update tab title from "Neuer Kontakt" to the actual name
        updateTabTitle(tabId, newContact.name);
        // Update the tab's contactId from temporary to permanent
        updateTabContactId(tabId, newContact.id);
    }

    // Close tab and return to list (SYNCHRONOUS now - imported at top)
    closeTab(tabId);
    state.activeView = 'list';
    showNotification(id ? 'Kontakt aktualisiert.' : 'Kontakt erstellt.');
}

/**
 * Deletes a contact by ID.
 * Also closes any tabs that have this contact open.
 * FIX: Closes tabs BEFORE deleting to prevent ghost tabs
 */
export function deleteContact(id) {
    if (confirm('Möchten Sie diesen Kontakt wirklich löschen?')) {
        // CRITICAL: Close tabs FIRST (synchronous) to avoid ghost tabs
        closeTabsByContactId(id);

        // Then delete the contact from state
        state.contacts = state.contacts.filter(c => c.id !== id);
        showNotification('Kontakt gelöscht.');
    }
}

/**
 * Toggles the favorite status of a contact.
 */
export function toggleFavorite(id) {
    const contact = state.contacts.find(c => c.id === id);
    if (contact) {
        contact.isFavorite = !contact.isFavorite;
        // Trigger re-render by creating new array
        state.contacts = [...state.contacts];
        const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        showNotification(contact.isFavorite ? `${name} als Favorit markiert.` : `${name} als Favorit entfernt.`);
    }
}

/**
 * Toggles selection of a contact.
 */
export function toggleSelection(id) {
    if (state.selectedContactIds.has(id)) {
        state.selectedContactIds.delete(id);
    } else {
        state.selectedContactIds.add(id);
    }
    // Trigger re-render
    state.contacts = [...state.contacts];
}

/**
 * Handles shift-click selection (range selection).
 * Markiert alle Kontakte zwischen Start und Ende in der visuellen Reihenfolge.
 */
export function handleShiftSelection(endId) {
    const startId = state.lastSelectedId;

    // Wenn kein Start-Anker existiert, nur den End-Kontakt auswählen
    if (!startId) {
        state.selectedContactIds.clear();
        state.selectedContactIds.add(endId);
        state.lastSelectedId = endId;
        state.contacts = [...state.contacts];
        return;
    }

    // Wenn Start = Ende, toggle die Auswahl
    if (startId === endId) {
        toggleSelection(endId);
        return;
    }

    // Hole die Kontakte in EXAKT der visuellen Reihenfolge (wie auf dem Bildschirm)
    const visualOrder = getVisualOrder();

    // Finde die Positionen von Start und Ende
    const startIndex = visualOrder.findIndex(c => c.id === startId);
    const endIndex = visualOrder.findIndex(c => c.id === endId);

    // Wenn einer nicht gefunden wird (z.B. durch Filter), nur Ende auswählen
    if (startIndex === -1 || endIndex === -1) {
        state.selectedContactIds.clear();
        state.selectedContactIds.add(endId);
        state.lastSelectedId = endId;
        state.contacts = [...state.contacts];
        return;
    }

    // Markiere ALLES zwischen Start und Ende (inklusive Start und Ende)
    const [min, max] = [startIndex, endIndex].sort((a, b) => a - b);

    // Lösche alte Auswahl und wähle den neuen Bereich
    state.selectedContactIds.clear();
    for (let i = min; i <= max; i++) {
        state.selectedContactIds.add(visualOrder[i].id);
    }

    // Aktualisiere den Anker auf den End-Kontakt
    state.lastSelectedId = endId;

    // Trigger re-render
    state.contacts = [...state.contacts];
}

/**
 * Deletes all selected contacts.
 */
export function deleteSelectedContacts() {
    const count = state.selectedContactIds.size;
    if (count === 0) return;

    if (confirm(`Möchten Sie wirklich die ${count} ausgewählten Kontakte löschen?`)) {
        state.contacts = state.contacts.filter(c => !state.selectedContactIds.has(c.id));
        state.selectedContactIds.clear();
        showNotification(`${count} Kontakte gelöscht.`);
    }
}

/**
 * Exports all selected contacts as VCF.
 */
export function exportSelectedContacts() {
    const count = state.selectedContactIds.size;
    if (count === 0) {
        showNotification('Keine Kontakte ausgewählt.');
        return;
    }

    // Filter selected contacts
    const selectedContacts = state.contacts.filter(c => state.selectedContactIds.has(c.id));

    // Import exportContactsToVCF from vcf-handler
    import('./vcf-handler.js').then(module => {
        module.exportContactsToVCF(selectedContacts);
        showNotification(`${count} Kontakte exportiert.`);
    });
}

/**
 * Applies the theme (dark or light).
 */
export function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('contactsApp.theme', theme);
    updateThemeIcon(theme);
}

/**
 * Updates the theme toggle icon.
 */
function updateThemeIcon(theme) {
    const icon = dom.themeToggle.querySelector('svg');
    if (theme === 'dark') {
        // Sun icon for switching to light mode
        icon.innerHTML = '<path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd" />';
    } else {
        // Moon icon for switching to dark mode
        icon.innerHTML = '<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />';
    }
}

/**
 * Toggles between dark and light theme.
 */
export function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(currentTheme);
}
