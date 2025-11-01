import { state, dom } from './state.js';
import { escapeHTML, sortContacts } from './utils.js';
import { filterContacts } from './filters.js';
import { getContactFormTemplate } from './contact-form-template.js';
import { getActiveTab, getActiveTabContact } from './tabs.js';
import { renderSocialBadges } from './social-media-badges.js';

/**
 * Renders the entire application UI based on the current state.
 */
export function render() {
    console.log("Render-Funktion aufgerufen, Active View:", state.activeView);

    // Update tab active state
    updateTabActiveState();

    // Switch between views
    if (state.activeView === 'list') {
        showListView();
        renderHeader();
        renderContactList();
        updateContactCount();
    } else if (state.activeView === 'stats') {
        showStatsView();
        renderStats();
    } else if (state.activeView === 'tab') {
        showTabView();
        renderContactTabs();
        renderTabContainers();
    }
}

/**
 * Updates the active state of the main tabs
 */
function updateTabActiveState() {
    const tabs = document.querySelectorAll('.main-tab');
    tabs.forEach(tab => {
        if (tab.dataset.view === state.activeView) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

/**
 * Shows the list view and hides other views
 */
function showListView() {
    const listView = document.getElementById('list-view');
    const statsView = document.getElementById('stats-view');
    const toolbar = document.querySelector('.toolbar');
    const contactTabs = document.getElementById('contact-tabs');
    const tabContainer = document.getElementById('tab-container');

    listView.classList.remove('hidden');
    toolbar.classList.remove('hidden');
    
    statsView.classList.add('hidden');
    contactTabs.classList.add('hidden');
    tabContainer.classList.add('hidden');
}

/**
 * Shows the stats view and hides other views
 */
function showStatsView() {
    const listView = document.getElementById('list-view');
    const statsView = document.getElementById('stats-view');
    const toolbar = document.querySelector('.toolbar');
    const contactTabs = document.getElementById('contact-tabs');
    const tabContainer = document.getElementById('tab-container');

    statsView.classList.remove('hidden');

    listView.classList.add('hidden');
    toolbar.classList.add('hidden');
    contactTabs.classList.add('hidden');
    tabContainer.classList.add('hidden');
}

/**
 * Renders the statistics view with data quality metrics
 * IMPORTANT: Only called when activeView === 'stats' (performance optimization)
 */
function renderStats() {
    // Use state.contacts directly (unfiltered!) for accurate statistics
    const contacts = state.contacts;
    const total = contacts.length;

    // Helper function to check if a field is empty (after trim)
    const isEmpty = (value) => !value || value.trim() === '';

    // Calculate statistics based on unfiltered contacts
    const stats = {
        total: total,
        noCompany: contacts.filter(c => isEmpty(c.company)).length,
        noTitle: contacts.filter(c => isEmpty(c.title)).length,
        // "ohne E-Mail" means BOTH email AND workEmail are empty
        noEmail: contacts.filter(c => isEmpty(c.email) && isEmpty(c.workEmail)).length,
        // "ohne Adresse" means BOTH street AND workStreet are empty
        noAddress: contacts.filter(c => isEmpty(c.street) && isEmpty(c.workStreet)).length,
        // "ohne Mobilnummer" means BOTH mobile AND workMobile are empty
        noMobile: contacts.filter(c => isEmpty(c.mobile) && isEmpty(c.workMobile)).length,
    };

    // Update DOM elements
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-no-company').textContent = stats.noCompany;
    document.getElementById('stat-no-title').textContent = stats.noTitle;
    document.getElementById('stat-no-email').textContent = stats.noEmail;
    document.getElementById('stat-no-address').textContent = stats.noAddress;
    document.getElementById('stat-no-mobile').textContent = stats.noMobile;
}

function updateContactCount() {
    const filteredContacts = filterContacts(state.contacts);
    const total = state.contacts.length;
    const shown = filteredContacts.length;

    if (state.searchTerm.trim()) {
        dom.contactCount.textContent = `${shown} von ${total} Kontakten`;
    } else {
        dom.contactCount.textContent = `${total} Kontakt${total !== 1 ? 'e' : ''}`;
    }
}

function renderContactList() {
    const contactList = dom.contactList;
    contactList.innerHTML = ''; // Liste vor dem Neuzeichnen leeren

    // Kontakte filtern und sortieren
    const filteredContacts = filterContacts(state.contacts);

    if (filteredContacts.length === 0) {
        const safeSearchTerm = escapeHTML(state.searchTerm);
        const emptyMessage = state.searchTerm === ''
            ? 'Keine Kontakte gefunden. Zeit, welche hinzuzufügen!'
            : `Keine Kontakte für '<strong>${safeSearchTerm}</strong>' gefunden.`;

        contactList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p>${emptyMessage}</p>
            </div>`;
        return;
    }

    // Kontakte sortieren
    const sortedContacts = [...filteredContacts].sort(sortContacts);

    // Trenne Favoriten von normalen Kontakten
    const favorites = sortedContacts.filter(c => c.isFavorite);
    const nonFavorites = sortedContacts.filter(c => !c.isFavorite);

    // Helper-Funktion zum Rendern eines Kontakts
    const renderContact = (contact) => {
        const contactEl = document.createElement('div');
        contactEl.className = `contact-item ${state.selectedContactIds.has(contact.id) ? 'selected' : ''}`;
        contactEl.dataset.id = contact.id;

        const safeLastName = escapeHTML(contact.lastName);
        const safeFirstName = escapeHTML(contact.firstName);
        const safeCompany = escapeHTML(contact.company);
        const safeEmail = escapeHTML(contact.email || '');
        const safePhone = escapeHTML(contact.phone || '');
        const safeStreet = escapeHTML(contact.street || '');
        const safeZip = escapeHTML(contact.zip || '');
        const safeCity = escapeHTML(contact.city || '');

        const favoriteBtnClass = contact.isFavorite ? 'favorite-btn favorited' : 'favorite-btn';
        const favoriteIcon = contact.isFavorite
            ? `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>`
            : `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>`;

        contactEl.innerHTML = `
            <div class="contact-actions">
                <button class="${favoriteBtnClass}" aria-label="Als Favorit markieren">
                    ${favoriteIcon}
                </button>
                <button class="edit-btn" aria-label="Kontakt bearbeiten">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                </button>
                <button class="delete-btn" aria-label="Kontakt löschen">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
            </div>
            <span class="name-col">${safeFirstName}</span>
            <span>${safeLastName}</span>
            <span>${safeCompany}</span>
            <span>${safePhone}</span>
            <span>${safeEmail}</span>
            <span>${safeStreet}</span>
            <span>${safeZip}</span>
            <span>${safeCity}</span>`;
        return contactEl;
    };

    // Rendere Favoriten zuerst (wenn vorhanden)
    if (favorites.length > 0) {
        const favoritesHeader = document.createElement('div');
        favoritesHeader.className = 'group-header favorites-header';
        favoritesHeader.innerHTML = '★ Favoriten';
        contactList.appendChild(favoritesHeader);

        favorites.forEach(contact => {
            contactList.appendChild(renderContact(contact));
        });
    }

    // Rendere normale Kontakte gruppiert nach Buchstaben
    if (nonFavorites.length > 0) {
        // Gruppiere nach Anfangsbuchstaben
        const groupedContacts = nonFavorites.reduce((acc, contact) => {
            const sortKey = state.sort.by;
            const firstLetter = (contact[sortKey] || '#')[0].toUpperCase();
            if (!acc[firstLetter]) {
                acc[firstLetter] = [];
            }
            acc[firstLetter].push(contact);
            return acc;
        }, {});

        // Sortiere Buchstaben
        const sortedLetters = Object.keys(groupedContacts).sort((a, b) => {
            if (a === '#' && b === '#') return 0;
            if (a === '#') return 1;
            if (b === '#') return -1;
            const comparison = a.localeCompare(b);
            return state.sort.order === 'asc' ? comparison : -comparison;
        });

        // Rendere gruppierte Kontakte
        sortedLetters.forEach(letter => {
            const groupHeaderEl = document.createElement('div');
            groupHeaderEl.className = 'group-header';
            groupHeaderEl.textContent = letter;
            contactList.appendChild(groupHeaderEl);

            groupedContacts[letter].forEach(contact => {
                contactList.appendChild(renderContact(contact));
            });
        });
    }

    // Update selection-dependent buttons status
    updateSelectionButtons();
}

function updateSelectionButtons() {
    const hasSelection = state.selectedContactIds.size > 0;
    dom.deleteSelectedBtn.disabled = !hasSelection;
    dom.exportSelectedBtn.disabled = !hasSelection;
}

function renderHeader() {
    const headers = [
        { key: 'actions', label: 'Aktionen' },
        { key: 'firstName', label: 'Vorname' },
        { key: 'lastName', label: 'Nachname' },
        { key: 'company', label: 'Firma' },
        { key: 'phone', label: 'Telefon' },
        { key: 'email', label: 'E-Mail' },
        { key: 'street', label: 'Straße' },
        { key: 'zip', label: 'PLZ' },
        { key: 'city', label: 'Ort' },
    ];

    dom.contactListHeader.innerHTML = '';
    headers.forEach(header => {
        const headerEl = document.createElement('div');
        headerEl.className = 'col-header';

        // Aktionen-Spalte ist nicht sortierbar
        if (header.key !== 'actions') {
            headerEl.dataset.sortKey = header.key;
            
            // Markiere aktive Spalte
            if (state.sort.by === header.key) {
                headerEl.classList.add('active');
            }

            const sortIcon = state.sort.order === 'asc' ? '▲' : '▼';
            const iconHtml = state.sort.by === header.key 
                ? `<span class="sort-icon">${sortIcon}</span>` 
                : '<span class="sort-icon" style="opacity: 0.3;">▲</span>';
            
            headerEl.innerHTML = `<div>${header.label} ${iconHtml}</div>`;
        } else {
            headerEl.innerHTML = `<div>${header.label}</div>`;
        }
        
        dom.contactListHeader.appendChild(headerEl);
    });
}

/**
 * Shows the tab view and hides list/stats views
 */
function showTabView() {
    const listView = document.getElementById('list-view');
    const statsView = document.getElementById('stats-view');
    const toolbar = document.querySelector('.toolbar');
    const contactTabs = document.getElementById('contact-tabs');
    const tabContainer = document.getElementById('tab-container');

    listView.classList.add('hidden');
    statsView.classList.add('hidden');
    toolbar.classList.add('hidden');
    contactTabs.classList.remove('hidden');
    tabContainer.classList.remove('hidden');
}

/**
 * Renders the contact tabs navigation (second level tabs)
 */
function renderContactTabs() {
    const contactTabsNav = document.getElementById('contact-tabs');
    contactTabsNav.innerHTML = '';

    state.openTabs.forEach(tab => {
        const tabButton = document.createElement('button');
        tabButton.type = 'button';
        tabButton.className = `contact-tab ${tab.id === state.activeTabId ? 'active' : ''}`;
        tabButton.dataset.tabId = tab.id;

        tabButton.innerHTML = `
            <span class="tab-title">${escapeHTML(tab.title)}</span>
            <span class="tab-close-btn" data-tab-id="${tab.id}">×</span>
        `;

        contactTabsNav.appendChild(tabButton);
    });
}

/**
 * Renders all tab containers with their forms
 * IMPORTANT: Only fills forms for NEWLY created tabs to preserve user input
 */
function renderTabContainers() {
    const tabContainer = document.getElementById('tab-container');

    // Get existing form IDs to avoid re-creating them
    const existingForms = new Set(
        Array.from(tabContainer.querySelectorAll('.contact-form-wrapper'))
            .map(wrapper => wrapper.dataset.tabId)
    );

    // Create forms for NEW tabs only
    state.openTabs.forEach(tab => {
        if (!existingForms.has(tab.id)) {
            // Create new form for this tab
            const formWrapper = document.createElement('div');
            formWrapper.className = `contact-form-wrapper ${tab.id === state.activeTabId ? '' : 'hidden'}`;
            formWrapper.dataset.tabId = tab.id;
            formWrapper.innerHTML = getContactFormTemplate(tab.id);
            tabContainer.appendChild(formWrapper);

            // Formular nur beim Erstellen befüllen, um User-Eingaben nicht zu überschreiben
            const isNewContact = typeof tab.contactId === 'string' && tab.contactId.startsWith('new-');
            const contact = isNewContact ? null : state.contacts.find(c => c.id === tab.contactId);

            // Add form submit listener
            const form = formWrapper.querySelector('form');
            form.addEventListener('submit', (e) => {
                // WICHTIG: e.preventDefault() MUSS synchron aufgerufen werden,
                // um das Neuladen der Seite zu verhindern, bevor der asynchrone Import abgeschlossen ist.
                e.preventDefault();
                
                // This will be handled by the global saveContact handler
                import('./contacts.js').then(module => {
                    module.saveContact(e);
                });
            });

            // Erst nach dem Anhängen an den DOM befüllen
            // FIX: Stellt sicher, dass das Formular existiert, bevor es befüllt wird.
            if (contact !== undefined) {
                fillTabForm(tab.id, contact);
            }
        }
    });

    // Remove forms for tabs that no longer exist
    Array.from(tabContainer.querySelectorAll('.contact-form-wrapper')).forEach(wrapper => {
        const tabId = wrapper.dataset.tabId;
        if (!state.openTabs.find(tab => tab.id === tabId)) {
            wrapper.remove();
        }
    });

    // Show/hide forms based on active tab
    Array.from(tabContainer.querySelectorAll('.contact-form-wrapper')).forEach(wrapper => {
        if (wrapper.dataset.tabId === state.activeTabId) {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    });
}

/**
 * Fills a tab's form with contact data
 * @param {string} tabId - The tab ID
 * @param {Object|null} contact - The contact data, or null for new contact
 */
function fillTabForm(tabId, contact) {
    // Helper to get element by ID with tab suffix
    const getEl = (id) => document.getElementById(`${id}-${tabId}`);

    // Reset form first
    const form = document.querySelector(`form[data-tab-id="${tabId}"]`);
    if (form) form.reset();

    if (contact) {
        // Fill with contact data
        const idInput = getEl('contact-id');
        if (idInput) idInput.value = contact.id;

        // Allgemein
        if (getEl('contact-firstName')) getEl('contact-firstName').value = contact.firstName || '';
        if (getEl('contact-lastName')) getEl('contact-lastName').value = contact.lastName || '';
        if (getEl('contact-nickname')) getEl('contact-nickname').value = contact.nickname || '';
        if (getEl('contact-birthday')) getEl('contact-birthday').value = contact.birthday || '';
        if (getEl('contact-category')) getEl('contact-category').value = contact.category || '';
        if (getEl('contact-url')) getEl('contact-url').value = contact.url || '';
        if (getEl('contact-notes')) getEl('contact-notes').value = contact.notes || '';

        // Privat
        if (getEl('contact-email')) getEl('contact-email').value = contact.email || '';
        if (getEl('contact-phone')) getEl('contact-phone').value = contact.phone || '';
        if (getEl('contact-mobile')) getEl('contact-mobile').value = contact.mobile || '';
        if (getEl('contact-street')) getEl('contact-street').value = contact.street || '';
        if (getEl('contact-zip')) getEl('contact-zip').value = contact.zip || '';
        if (getEl('contact-city')) getEl('contact-city').value = contact.city || '';

        // Beruflich
        if (getEl('contact-company')) getEl('contact-company').value = contact.company || '';
        if (getEl('contact-title')) getEl('contact-title').value = contact.title || '';
        if (getEl('contact-role')) getEl('contact-role').value = contact.role || '';
        if (getEl('contact-workEmail')) getEl('contact-workEmail').value = contact.workEmail || '';
        if (getEl('contact-workPhone')) getEl('contact-workPhone').value = contact.workPhone || '';
        if (getEl('contact-workMobile')) getEl('contact-workMobile').value = contact.workMobile || '';
        if (getEl('contact-workStreet')) getEl('contact-workStreet').value = contact.workStreet || '';
        if (getEl('contact-workZip')) getEl('contact-workZip').value = contact.workZip || '';
        if (getEl('contact-workCity')) getEl('contact-workCity').value = contact.workCity || '';

        // Social Media Badges
        renderSocialBadges(contact.socialMedia || [], tabId);

        // Show delete button for existing contacts
        const deleteBtn = document.getElementById(`delete-btn-${tabId}`);
        if (deleteBtn) deleteBtn.classList.remove('hidden');
    } else {
        // New contact - empty form
        renderSocialBadges([], tabId);

        // Hide delete button for new contacts
        const deleteBtn = document.getElementById(`delete-btn-${tabId}`);
        if (deleteBtn) deleteBtn.classList.add('hidden');
    }
}