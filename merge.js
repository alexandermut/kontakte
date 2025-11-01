import { state } from './state.js';
import { showNotification, closeModal as closeContactModal } from './contacts.js';

let currentMergeData = null;
let pendingDuplicateData = null;

/**
 * Field definitions for merge comparison
 */
const MERGE_FIELDS = [
    { key: 'firstName', label: 'Vorname' },
    { key: 'lastName', label: 'Nachname' },
    { key: 'nickname', label: 'Spitzname' },
    { key: 'email', label: 'E-Mail (Privat)' },
    { key: 'phone', label: 'Telefon (Privat)' },
    { key: 'mobile', label: 'Mobiltelefon (Privat)' },
    { key: 'street', label: 'Straße (Privat)' },
    { key: 'zip', label: 'PLZ (Privat)' },
    { key: 'city', label: 'Stadt (Privat)' },
    { key: 'company', label: 'Firma' },
    { key: 'title', label: 'Titel / Position' },
    { key: 'role', label: 'Rolle / Funktion' },
    { key: 'workEmail', label: 'E-Mail (Geschäftlich)' },
    { key: 'workPhone', label: 'Telefon (Geschäftlich)' },
    { key: 'workMobile', label: 'Mobiltelefon (Geschäftlich)' },
    { key: 'workStreet', label: 'Straße (Geschäftlich)' },
    { key: 'workZip', label: 'PLZ (Geschäftlich)' },
    { key: 'workCity', label: 'Stadt (Geschäftlich)' },
    { key: 'birthday', label: 'Geburtstag' },
    { key: 'category', label: 'Kategorie' },
    { key: 'url', label: 'Webseite' },
    { key: 'notes', label: 'Notizen' },
];

/**
 * Opens the custom duplicate confirmation dialog.
 * @param {Object} duplicate - The existing duplicate contact.
 * @param {Object} newContactData - The data of the contact being saved.
 * @param {boolean} isNewContact - True if creating a new contact.
 */
export function showDuplicateDialog(duplicate, newContactData, isNewContact) {
    console.log('=== showDuplicateDialog called ===');
    pendingDuplicateData = { duplicate, newContactData, isNewContact };

    const duplicateName = `${duplicate.firstName} ${duplicate.lastName}`.trim();
    const message = `Es existiert bereits ein Kontakt mit ähnlichen Daten:\n\n` +
        `Name: ${duplicateName}\n` +
        `${duplicate.email ? 'E-Mail: ' + duplicate.email + '\n' : ''}`;

    const dialog = document.getElementById('duplicate-dialog');
    const messageEl = document.getElementById('duplicate-dialog-message');
    messageEl.textContent = message;

    dialog.classList.remove('hidden');
    setTimeout(() => dialog.classList.add('visible'), 10);
}

/**
 * Closes the duplicate confirmation dialog.
 */
export function closeDuplicateDialog() {
    const dialog = document.getElementById('duplicate-dialog');
    dialog.classList.remove('visible');
    setTimeout(() => dialog.classList.add('hidden'), 300);
    pendingDuplicateData = null;
}

/**
 * Handles the user's choice to merge from the duplicate dialog.
 */
export function handleDuplicateMerge() {
    console.log('=== handleDuplicateMerge called ===');
    const { duplicate, newContactData, isNewContact } = pendingDuplicateData;
    closeDuplicateDialog();
    openMergeModal(duplicate, newContactData, isNewContact);
}

export const handleDuplicateCancel = closeDuplicateDialog;

/**
 * Opens the merge modal to compare two contacts
 * @param {Object} existingContact - The contact that already exists in the system
 * @param {Object} newContactData - The new contact data being added (may not have an ID yet)
 * @param {boolean} isNewContact - Whether the new data is from creating a new contact (vs editing)
 */
export function openMergeModal(existingContact, newContactData, isNewContact = true) {
    currentMergeData = {
        existing: existingContact,
        new: newContactData,
        selected: {},
        isNewContact: isNewContact
    };

    // Close contact modal first
    closeContactModal();

    const modal = document.getElementById('merge-modal');
    const container = document.getElementById('merge-fields-container');

    container.innerHTML = '';

    // Generate field comparison UI
    MERGE_FIELDS.forEach(field => {
        const existingValue = existingContact[field.key] || '';
        const newValue = newContactData[field.key] || '';

        // Skip if both values are empty
        if (!existingValue && !newValue) return;

        // Check if there's a conflict
        const hasConflict = existingValue && newValue && existingValue !== newValue;
        const onlyOne = (existingValue && !newValue) || (!existingValue && newValue);

        const row = document.createElement('div');
        row.className = `merge-field-row ${!hasConflict ? 'no-conflict' : ''}`;

        // Auto-select if no conflict
        if (onlyOne) {
            currentMergeData.selected[field.key] = existingValue || newValue;
        } else if (!hasConflict) {
            currentMergeData.selected[field.key] = existingValue;
        } else {
            // Default to existing value in case of conflict
            currentMergeData.selected[field.key] = existingValue;
        }

        row.innerHTML = `
            <div class="merge-field-label">${field.label}</div>
            <label class="merge-field-option ${!hasConflict && existingValue ? 'selected' : hasConflict ? 'selected' : ''}">
                <input
                    type="radio"
                    name="merge-${field.key}"
                    value="existing"
                    ${!hasConflict || !newValue ? 'checked' : 'checked'}
                    ${!hasConflict ? 'disabled' : ''}
                >
                <div class="merge-field-content">
                    <div class="merge-field-source">Bestehend</div>
                    <div class="merge-field-value ${!existingValue ? 'empty' : ''}">
                        ${existingValue || '(leer)'}
                    </div>
                </div>
            </label>
            <label class="merge-field-option ${!hasConflict && newValue && !existingValue ? 'selected' : ''}">
                <input
                    type="radio"
                    name="merge-${field.key}"
                    value="new"
                    ${!hasConflict && newValue && !existingValue ? 'checked' : ''}
                    ${!hasConflict ? 'disabled' : ''}
                >
                <div class="merge-field-content">
                    <div class="merge-field-source">Neu</div>
                    <div class="merge-field-value ${!newValue ? 'empty' : ''}">
                        ${newValue || '(leer)'}
                    </div>
                </div>
            </label>
        `;

        container.appendChild(row);

        // Add click listeners for visual feedback
        const options = row.querySelectorAll('.merge-field-option');
        options.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            option.addEventListener('click', () => {
                if (!radio.disabled) {
                    radio.checked = true;
                    options.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');

                    // Store selection
                    const source = radio.value;
                    currentMergeData.selected[field.key] = source === 'existing' ? existingValue : newValue;
                }
            });
        });
    });

    // Show modal
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
}

/**
 * Closes the merge modal
 */
export function closeMergeModal() {
    const modal = document.getElementById('merge-modal');
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
    currentMergeData = null;
}

/**
 * Confirms the merge and updates the contact
 * The existing contact is updated with the merged data.
 * If this was triggered by creating a new contact, that new contact is never added.
 * Result: Only ONE contact exists with the merged data.
 */
export function confirmMerge() {
    console.log('confirmMerge called');
    console.log('currentMergeData:', currentMergeData);

    if (!currentMergeData) {
        console.error('No merge data available!');
        return;
    }

    const { existing, selected, isNewContact, new: newContactData } = currentMergeData;

    console.log('Existing contact:', existing);
    console.log('Selected values:', selected);
    console.log('Is new contact (not saved yet):', isNewContact);

    // Build merged contact
    const mergedContact = {
        ...existing, // Keep ID, isFavorite, and all other fields from existing
        ...selected  // Override with selected values from merge UI
    };

    // Update combined name field
    mergedContact.name = `${mergedContact.firstName || ''} ${mergedContact.lastName || ''}`.trim();

    console.log('Merged contact:', mergedContact);

    // Find and update the existing contact
    const index = state.contacts.findIndex(c => c.id === existing.id);
    console.log('Contact index:', index);

    if (index !== -1) {
        state.contacts[index] = mergedContact;

        // Wenn ein bestehender Kontakt bearbeitet wurde (nicht neu erstellt)
        // und dieser eine andere ID hat als der, mit dem zusammengeführt wurde,
        // muss der bearbeitete Kontakt entfernt werden.
        if (!isNewContact && newContactData.id && newContactData.id !== existing.id) {
            console.log('Entferne bearbeiteten Kontakt, der zum Duplikat wurde, ID:', newContactData.id);
            state.contacts = state.contacts.filter(c => c.id !== newContactData.id);
        } else {
            state.contacts = [...state.contacts]; // Trigger re-render
        }

        console.log('Contact updated at index:', index);
    } else {
        console.error('Contact not found!');
    }

    closeMergeModal();
    showNotification('Kontakte erfolgreich zusammengeführt.');
}
