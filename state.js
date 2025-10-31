// --- State Management ---
const listeners = new Set();
const persistListeners = new Set();

const rawState = {
    contacts: [],
    searchTerm: '',
    categoryFilter: '',
    sort: { by: 'firstName', order: 'asc' },
    selectedContactIds: new Set(),
    lastSelectedId: null, // Für Shift-Klick
    nextId: 1,
};

const handler = {
    set(target, property, value) {
        const success = Reflect.set(target, property, value);
        if (success) {
            // Benachrichtige alle Abonnenten über die Zustandsänderung.
            listeners.forEach(listener => listener());

            // Wenn 'contacts' geändert wurde, benachrichtige Persist-Listener
            if (property === 'contacts') {
                persistListeners.forEach(listener => listener());
            }
        }
        return success;
    }
};

/**
 * Ein reaktives State-Objekt. Jede Änderung seiner Eigenschaften löst
 * automatisch die abonnierten Listener (z.B. die render-Funktion) aus.
 */
export const state = new Proxy(rawState, handler);

/**
 * Abonniert eine Listener-Funktion, die bei jeder Zustandsänderung aufgerufen wird.
 * @param {Function} listener Die Funktion, die bei einer Zustandsänderung aufgerufen werden soll.
 */
export function subscribe(listener) {
    listeners.add(listener);
}

/**
 * Abonniert eine Listener-Funktion, die bei Änderungen der Kontakte aufgerufen wird.
 * @param {Function} listener Die Funktion, die bei Kontakt-Änderungen aufgerufen werden soll.
 */
export function subscribeToPersist(listener) {
    persistListeners.add(listener);
}

// --- DOM-Elemente ---
export const dom = {
    contactList: document.getElementById('contact-list'),
    contactListHeader: document.getElementById('contact-list-header'),
    searchInput: document.getElementById('search-input'),
    contactCount: document.getElementById('contact-count'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    contactForm: document.getElementById('contact-form'),
    contactIdInput: document.getElementById('contact-id'),
    contactFirstNameInput: document.getElementById('contact-firstName'),
    contactLastNameInput: document.getElementById('contact-lastName'),
    contactCompanyInput: document.getElementById('contact-company'),
    contactEmailInput: document.getElementById('contact-email'),
    contactPhoneInput: document.getElementById('contact-phone'),
    contactStreetInput: document.getElementById('contact-street'),
    contactZipInput: document.getElementById('contact-zip'),
    contactCityInput: document.getElementById('contact-city'),
    contactCategoryInput: document.getElementById('contact-category'),
    contactBirthdayInput: document.getElementById('contact-birthday'),
    contactNicknameInput: document.getElementById('contact-nickname'),
    contactUrlInput: document.getElementById('contact-url'),
    contactNotesInput: document.getElementById('contact-notes'),
    contactMobileInput: document.getElementById('contact-mobile'),
    contactTitleInput: document.getElementById('contact-title'),
    contactWorkEmailInput: document.getElementById('contact-workEmail'),
    contactWorkPhoneInput: document.getElementById('contact-workPhone'),
    contactWorkMobileInput: document.getElementById('contact-workMobile'),
    contactWorkStreetInput: document.getElementById('contact-workStreet'),
    contactWorkZipInput: document.getElementById('contact-workZip'),
    contactWorkCityInput: document.getElementById('contact-workCity'),
    categoryFilter: document.getElementById('category-filter'),
    notification: document.getElementById('notification'),
    vcfInput: document.getElementById('vcf-input'),
    themeToggle: document.getElementById('theme-toggle'),
    deleteSelectedBtn: document.getElementById('delete-selected-btn'),
    exportSelectedBtn: document.getElementById('export-selected-btn'),
    modalDeleteBtn: document.getElementById('modal-delete-btn'),
    newContactBtn: document.getElementById('new-contact-btn'),
    importBtn: document.getElementById('import-btn'),
    exportBtn: document.getElementById('export-btn'),
};