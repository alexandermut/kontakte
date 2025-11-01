import { state, dom } from './state.js';
import {
    saveContact,
    deleteContact,
    toggleFavorite,
    toggleSelection,
    handleShiftSelection,
    deleteSelectedContacts,
    exportSelectedContacts,
    toggleTheme,
    applyTheme
} from './contacts.js';
import { exportContacts, importVCF } from './vcf-handler.js';
import { debounce } from './utils.js';
import { persistSort } from './storage.js';
import { closeMergeModal, confirmMerge, closeDuplicateDialog, handleDuplicateMerge, handleDuplicateCancel } from './merge.js';
import { openTab, closeTab, switchToTab } from './tabs.js';

export function setupEventListeners() {
    console.log("Event Listeners werden eingerichtet...");

    // Theme laden
    const savedTheme = localStorage.getItem('contactsApp.theme') || 'dark';
    applyTheme(savedTheme);

    // Suche mit Debouncing (250ms Verzögerung)
    const debouncedSearch = debounce((value) => {
        state.searchTerm = value;
    }, 250);

    dom.searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });

    // Kategorie-Filter
    dom.categoryFilter.addEventListener('change', (e) => {
        state.categoryFilter = e.target.value;
    });

    // Sortierung durch Klick auf Spaltenüberschriften
    dom.contactListHeader.addEventListener('click', (e) => {
        const sortKey = e.target.closest('.col-header')?.dataset.sortKey;
        if (!sortKey) return; // Keine sortierbare Spalte

        // Wenn gleiche Spalte: Richtung umkehren, sonst neue Spalte mit 'asc'
        if (state.sort.by === sortKey) {
            state.sort = { by: sortKey, order: state.sort.order === 'asc' ? 'desc' : 'asc' };
        } else {
            state.sort = { by: sortKey, order: 'asc' };
        }

        // Sortierung persistieren
        persistSort();
    });

    // Toolbar Buttons
    dom.newContactBtn.addEventListener('click', () => openTab(null));
    dom.importBtn.addEventListener('click', () => dom.vcfInput.click());
    dom.exportBtn.addEventListener('click', exportContacts);
    dom.exportSelectedBtn.addEventListener('click', exportSelectedContacts);
    dom.deleteSelectedBtn.addEventListener('click', deleteSelectedContacts);
    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.vcfInput.addEventListener('change', importVCF);

    // Modal listeners removed - replaced by Tab system
    // Form submit is handled dynamically in ui.js renderTabContainers()
    // Cancel and Delete buttons are handled in contact-tabs listener below

    // Form Tabs (now handled via event delegation since forms are dynamic)
    document.addEventListener('click', (e) => {
        const formTab = e.target.closest('.form-tab');
        if (!formTab) return;

        e.preventDefault();
        const targetTab = formTab.dataset.tab;
        const formId = formTab.dataset.form; // Get the specific form ID

        if (!formId) return;
        
        // Only affect tabs and contents within this specific form
        const formWrapper = document.querySelector(`.contact-form-wrapper[data-tab-id="${formId}"]`);
        if (!formWrapper) return;

        const formTabs = formWrapper.querySelectorAll(`.form-tab`);
        const formTabContents = formWrapper.querySelectorAll(`[data-tab-content]`);

        formTabs.forEach(t => t.classList.remove('active'));
        formTabContents.forEach(c => c.classList.remove('active'));

        formTab.classList.add('active');
        const targetContent = formWrapper.querySelector(`[data-tab-content="${targetTab}"]`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
    });

    // Duplicate Dialog
    const duplicateDialog = document.getElementById('duplicate-dialog');
    document.getElementById('duplicate-cancel-btn').addEventListener('click', handleDuplicateCancel);
    document.getElementById('duplicate-merge-btn').addEventListener('click', handleDuplicateMerge);
    duplicateDialog.addEventListener('click', (e) => {
        if (e.target === duplicateDialog) closeDuplicateDialog();
    });

    // Merge Modal
    const mergeModal = document.getElementById('merge-modal');
    document.getElementById('merge-modal-close-btn').addEventListener('click', closeMergeModal);
    document.getElementById('merge-cancel-btn').addEventListener('click', closeMergeModal);
    document.getElementById('merge-confirm-btn').addEventListener('click', confirmMerge);
    mergeModal.addEventListener('click', (e) => {
        if (e.target === mergeModal) closeMergeModal();
    });

    // Contact Tabs (second-level tabs for open contacts)
    const contactTabsNav = document.getElementById('contact-tabs');
    contactTabsNav.addEventListener('click', (e) => {
        // Tab switch (click on tab button itself)
        const tabButton = e.target.closest('.contact-tab');
        if (tabButton && !e.target.closest('.tab-close-btn')) {
            const tabId = tabButton.dataset.tabId;
            if (tabId) {
                switchToTab(tabId);
            }
            return;
        }

        // Tab close (click on X button)
        const closeBtn = e.target.closest('.tab-close-btn');
        if (closeBtn) {
            const tabId = closeBtn.dataset.tabId;
            if (tabId) {
                closeTab(tabId);
            }
        }
    });

    // Cancel and Delete buttons in tab forms (event delegation)
    document.addEventListener('click', (e) => {
        // Cancel button
        const cancelBtn = e.target.closest('[id^="cancel-btn-"]');
        if (cancelBtn) {
            const tabId = cancelBtn.dataset.tabId;
            if (tabId) {
                closeTab(tabId);
            }
            return;
        }

        // Delete button
        const deleteBtn = e.target.closest('[id^="delete-btn-"]');
        if (deleteBtn) {
            const tabId = deleteBtn.dataset.tabId;
            if (!tabId) return;

            const contactIdInput = document.getElementById(`contact-id-${tabId}`);
            const contactId = contactIdInput ? parseInt(contactIdInput.value, 10) : null;

            if (contactId) {
                deleteContact(contactId);
            }
        }
    });

    // Main Tabs (View Switching)
    const mainTabs = document.getElementById('main-tabs');
    mainTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.main-tab');
        if (!tab) return;

        const view = tab.dataset.view;
        if (view) {
            state.activeView = view;
        }
    });

    // Globale Tastatur-Shortcuts
    window.addEventListener('keydown', (e) => {
        // FIX EDGE #3: Don't trigger shortcuts when user is typing in input/textarea
        const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);

        // Escape zum Schließen des aktiven Tabs (works even when typing)
        if (e.key === 'Escape' && state.activeView === 'tab' && state.activeTabId) {
            closeTab(state.activeTabId);
            return;
        }

        // Strg/Cmd + N für neuen Kontakt (not when typing)
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && state.activeView !== 'tab' && !isTyping) {
            e.preventDefault();
            openTab(null);
            return;
        }

        // Strg/Cmd + F für Suche fokussieren (not when typing in other fields)
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !isTyping) {
            e.preventDefault();
            dom.searchInput.focus();
            return;
        }

        // Strg/Cmd + E für Export (not when typing)
        if ((e.ctrlKey || e.metaKey) && e.key === 'e' && state.activeView !== 'tab' && !isTyping) {
            e.preventDefault();
            exportContacts();
            return;
        }
    });

    // Event Delegation für Kontaktliste
    let clickTimer = null;
    dom.contactList.addEventListener('click', (e) => {
        const contactItem = e.target.closest('.contact-item');
        if (!contactItem) return;

        const contactId = parseInt(contactItem.dataset.id, 10);

        // Prüfen, ob auf einen Aktionsbutton geklickt wurde
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const favoriteBtn = e.target.closest('.favorite-btn');

        if (editBtn) {
            const contact = state.contacts.find(c => c.id === contactId);
            if (contact) {
                openTab(contact);
            }
            return;
        }

        if (deleteBtn) {
            deleteContact(contactId);
            return;
        }

        if (favoriteBtn) {
            toggleFavorite(contactId);
            return;
        }

        // Wenn kein Button geklickt wurde: Auswahl-Logik mit Verzögerung (für Doppelklick)
        if (!e.target.closest('.contact-actions')) {
            // Klare vorherigen Timer
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            // Verzögere die Auswahl um 200ms, damit Doppelklick Vorrang hat
            clickTimer = setTimeout(() => {
                if (e.shiftKey) {
                    handleShiftSelection(contactId);
                    // lastSelectedId wird in handleShiftSelection gesetzt
                } else if (e.ctrlKey || e.metaKey) {
                    toggleSelection(contactId);
                    // Bei Ctrl-Klick: Anker bleibt beim letzten normal geklickten Kontakt
                    // (lastSelectedId wird NICHT geändert)
                } else {
                    // Normaler Klick: Nur diesen Kontakt auswählen
                    state.selectedContactIds.clear();
                    state.selectedContactIds.add(contactId);
                    state.contacts = [...state.contacts];
                    // Setze den Anker für den nächsten Shift-Klick
                    state.lastSelectedId = contactId;
                }
                clickTimer = null;
            }, 200);
        }
    });

    // Doppelklick zum Bearbeiten
    dom.contactList.addEventListener('dblclick', (e) => {
        const contactItem = e.target.closest('.contact-item');
        if (!contactItem) return;

        // Verhindere Doppelklick auf Aktionsbuttons
        if (e.target.closest('.contact-actions')) return;

        // Klare den Click-Timer, damit die Auswahl nicht ausgeführt wird
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
        }

        const contactId = parseInt(contactItem.dataset.id, 10);
        const contact = state.contacts.find(c => c.id === contactId);
        if (contact) openTab(contact);
    });
}