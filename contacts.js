import { state, dom } from './state.js';
import { persistContacts } from './storage.js';
import { isValidEmail, isValidGermanZip } from './utils.js';
import { getVisualOrder } from './visual-order.js';
import { renderSocialBadges, getSocialMediaDataFromBadges } from './social-media-badges.js';

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

/**
 * Opens the modal for creating or editing a contact.
 */
export function openModal(contact = null) {
    dom.contactForm.reset();
    if (contact) {
        dom.modalTitle.textContent = 'Kontakt bearbeiten';
        dom.contactIdInput.value = contact.id;

        // Allgemein
        dom.contactFirstNameInput.value = contact.firstName || '';
        dom.contactLastNameInput.value = contact.lastName || '';
        dom.contactNicknameInput.value = contact.nickname || '';
        dom.contactBirthdayInput.value = contact.birthday || '';
        dom.contactCategoryInput.value = contact.category || '';
        dom.contactUrlInput.value = contact.url || '';
        dom.contactNotesInput.value = contact.notes || '';

        // Privat
        dom.contactEmailInput.value = contact.email || '';
        dom.contactPhoneInput.value = contact.phone || '';
        dom.contactMobileInput.value = contact.mobile || '';
        dom.contactStreetInput.value = contact.street || '';
        dom.contactZipInput.value = contact.zip || '';
        dom.contactCityInput.value = contact.city || '';

        // Beruflich
        dom.contactCompanyInput.value = contact.company || '';
        dom.contactTitleInput.value = contact.title || '';
        dom.contactWorkEmailInput.value = contact.workEmail || '';
        dom.contactWorkPhoneInput.value = contact.workPhone || '';
        dom.contactWorkMobileInput.value = contact.workMobile || '';
        dom.contactWorkStreetInput.value = contact.workStreet || '';
        dom.contactWorkZipInput.value = contact.workZip || '';
        dom.contactWorkCityInput.value = contact.workCity || '';

        // Social Media Badges
        renderSocialBadges(contact.socialMedia || []);

        dom.modalDeleteBtn.classList.remove('hidden');
    } else {
        dom.modalTitle.textContent = 'Neuer Kontakt';
        dom.contactIdInput.value = '';
        renderSocialBadges([]);
        dom.modalDeleteBtn.classList.add('hidden');
    }
    dom.modal.classList.remove('hidden');
    setTimeout(() => dom.modal.classList.add('visible'), 10);
}

/**
 * Closes the modal.
 */
export function closeModal() {
    dom.modal.classList.remove('visible');
    setTimeout(() => dom.modal.classList.add('hidden'), 300);
}

/**
 * Saves a contact (create or update).
 */
export function saveContact(e) {
    e.preventDefault();

    // Close any open badge input fields before saving
    const openBadgeInput = document.querySelector('.social-badge-input');
    if (openBadgeInput) {
        openBadgeInput.blur(); // Trigger blur to save the badge
    }

    const id = dom.contactIdInput.value;
    const lastName = dom.contactLastNameInput.value.trim();

    // Validierung
    if (!lastName) {
        showNotification('Nachname ist ein Pflichtfeld.');
        return;
    }

    const email = dom.contactEmailInput.value.trim();
    if (email && !isValidEmail(email)) {
        showNotification('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        return;
    }

    const workEmail = dom.contactWorkEmailInput.value.trim();
    if (workEmail && !isValidEmail(workEmail)) {
        showNotification('Bitte geben Sie eine gültige geschäftliche E-Mail-Adresse ein.');
        return;
    }

    const zip = dom.contactZipInput.value.trim();
    if (zip && !isValidGermanZip(zip)) {
        showNotification('PLZ muss aus 5 Ziffern bestehen.');
        return;
    }

    const workZip = dom.contactWorkZipInput.value.trim();
    if (workZip && !isValidGermanZip(workZip)) {
        showNotification('Geschäftliche PLZ muss aus 5 Ziffern bestehen.');
        return;
    }

    const firstName = dom.contactFirstNameInput.value.trim();
    const contactData = {
        // Allgemein
        lastName: lastName,
        firstName: firstName,
        name: `${firstName} ${lastName}`.trim(), // Kombiniertes Feld für Suche
        nickname: dom.contactNicknameInput.value.trim(),
        birthday: dom.contactBirthdayInput.value,
        category: dom.contactCategoryInput.value,
        url: dom.contactUrlInput.value.trim(),
        notes: dom.contactNotesInput.value.trim(),

        // Privat
        email: email,
        phone: dom.contactPhoneInput.value.trim(),
        mobile: dom.contactMobileInput.value.trim(),
        street: dom.contactStreetInput.value.trim(),
        zip: zip,
        city: dom.contactCityInput.value.trim(),

        // Beruflich
        company: dom.contactCompanyInput.value.trim(),
        title: dom.contactTitleInput.value.trim(),
        workEmail: dom.contactWorkEmailInput.value.trim(),
        workPhone: dom.contactWorkPhoneInput.value.trim(),
        workMobile: dom.contactWorkMobileInput.value.trim(),
        workStreet: dom.contactWorkStreetInput.value.trim(),
        workZip: dom.contactWorkZipInput.value.trim(),
        workCity: dom.contactWorkCityInput.value.trim(),

        // Social Media Badges
        socialMedia: getSocialMediaDataFromBadges(),
    };

    if (id) {
        // Bearbeiten
        const index = state.contacts.findIndex(c => c.id == id);
        if (index !== -1) {
            // Behalte den Favoritenstatus bei
            state.contacts[index] = { ...state.contacts[index], ...contactData };
            // Force re-render by creating new array
            state.contacts = [...state.contacts];
        }
    } else {
        // Neu
        contactData.id = state.nextId++;
        contactData.isFavorite = false;
        state.contacts = [...state.contacts, contactData];
    }

    closeModal();
    showNotification(id ? 'Kontakt aktualisiert.' : 'Kontakt erstellt.');
}

/**
 * Deletes a contact by ID.
 */
export function deleteContact(id) {
    if (confirm('Möchten Sie diesen Kontakt wirklich löschen?')) {
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
