import { state, dom } from './state.js';
import {
    openModal,
    closeModal,
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
    dom.newContactBtn.addEventListener('click', () => openModal());
    dom.importBtn.addEventListener('click', () => dom.vcfInput.click());
    dom.exportBtn.addEventListener('click', exportContacts);
    dom.exportSelectedBtn.addEventListener('click', exportSelectedContacts);
    dom.deleteSelectedBtn.addEventListener('click', deleteSelectedContacts);
    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.vcfInput.addEventListener('change', importVCF);

    // Modal
    dom.contactForm.addEventListener('submit', saveContact);
    dom.modal.addEventListener('click', (e) => {
        if (e.target === dom.modal) closeModal();
    });
    document.getElementById('modal-close-header-btn').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    dom.modalDeleteBtn.addEventListener('click', () => {
        const contactId = parseInt(dom.contactIdInput.value, 10);
        if (contactId) {
            closeModal();
            setTimeout(() => deleteContact(contactId), 150);
        }
    });

    // Form Tabs
    const formTabs = document.querySelectorAll('.form-tab');
    const formTabContents = document.querySelectorAll('.form-tab-content');

    formTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = tab.dataset.tab;

            // Remove active class from all tabs and contents
            formTabs.forEach(t => t.classList.remove('active'));
            formTabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const targetContent = document.querySelector(`[data-tab-content="${targetTab}"]`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
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
        // Escape zum Schließen des Modals
        if (e.key === 'Escape' && dom.modal.classList.contains('visible')) {
            closeModal();
            return;
        }

        // Strg/Cmd + N für neuen Kontakt
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !dom.modal.classList.contains('visible')) {
            e.preventDefault();
            openModal();
            return;
        }

        // Strg/Cmd + F für Suche fokussieren
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            dom.searchInput.focus();
            return;
        }

        // Strg/Cmd + E für Export
        if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !dom.modal.classList.contains('visible')) {
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
                openModal(contact);
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
        if (contact) openModal(contact);
    });
}