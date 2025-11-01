/**
 * Generates the HTML template for a contact form.
 * This template includes all form fields and tabs.
 * @param {string} tabId - The unique ID for this tab
 * @returns {string} HTML string
 */
export function getContactFormTemplate(tabId) {
    return `
        <form id="contact-form-${tabId}" class="contact-form" data-tab-id="${tabId}">
            <input type="hidden" id="contact-id-${tabId}">

            <!-- Tab Navigation -->
            <div class="form-tabs">
                <button type="button" class="form-tab active" data-tab="general" data-form="${tabId}">Allgemein</button>
                <button type="button" class="form-tab" data-tab="business" data-form="${tabId}">Beruflich</button>
                <button type="button" class="form-tab" data-tab="private" data-form="${tabId}">Privat</button>
                <button type="button" class="form-tab" data-tab="social" data-form="${tabId}">Social Media</button>
            </div>

            <!-- Tab: Allgemein -->
            <div class="form-tab-content active" data-tab-content="general" data-form="${tabId}">
                <div class="form-row">
                    <div class="form-group">
                        <label for="contact-firstName-${tabId}">Vorname</label>
                        <input type="text" id="contact-firstName-${tabId}" placeholder="Max">
                    </div>
                    <div class="form-group">
                        <label for="contact-lastName-${tabId}">Nachname *</label>
                        <input type="text" id="contact-lastName-${tabId}" required placeholder="Mustermann">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="contact-nickname-${tabId}">Spitzname</label>
                        <input type="text" id="contact-nickname-${tabId}" placeholder="Maxi">
                    </div>
                    <div class="form-group">
                        <label for="contact-birthday-${tabId}">Geburtstag</label>
                        <input type="date" id="contact-birthday-${tabId}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="contact-category-${tabId}">Kategorie</label>
                        <select id="contact-category-${tabId}">
                            <option value="">Keine Kategorie</option>
                            <option value="Familie">Familie</option>
                            <option value="Freunde">Freunde</option>
                            <option value="Arbeit">Arbeit</option>
                            <option value="Geschäft">Geschäft</option>
                            <option value="Sonstige">Sonstige</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="contact-url-${tabId}">Website</label>
                        <input type="url" id="contact-url-${tabId}" placeholder="https://www.beispiel.de">
                    </div>
                </div>

                <div class="form-group">
                    <label for="contact-notes-${tabId}">Notizen</label>
                    <textarea id="contact-notes-${tabId}" rows="3" placeholder="Persönliche Notizen..."></textarea>
                </div>
            </div>

            <!-- Tab: Beruflich -->
            <div class="form-tab-content" data-tab-content="business" data-form="${tabId}">
                <div class="form-group">
                    <label for="contact-company-${tabId}">Firma</label>
                    <input type="text" id="contact-company-${tabId}" placeholder="Beispiel GmbH">
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="contact-title-${tabId}">Titel / Position</label>
                        <input type="text" id="contact-title-${tabId}" placeholder="Geschäftsführer">
                    </div>
                    <div class="form-group">
                        <label for="contact-role-${tabId}">Rolle / Funktion</label>
                        <input type="text" id="contact-role-${tabId}" placeholder="Projektleiter">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="contact-workEmail-${tabId}">E-Mail (Geschäftlich)</label>
                        <input type="email" id="contact-workEmail-${tabId}" placeholder="max.mustermann@firma.de">
                    </div>
                    <div class="form-group">
                        <label for="contact-workPhone-${tabId}">Telefon (Geschäftlich)</label>
                        <input type="tel" id="contact-workPhone-${tabId}" placeholder="+49 30 12345678">
                    </div>
                </div>

                <div class="form-group">
                    <label for="contact-workMobile-${tabId}">Mobiltelefon (Geschäftlich)</label>
                    <input type="tel" id="contact-workMobile-${tabId}" placeholder="+49 151 12345678">
                </div>

                <h4 class="form-section-title">Geschäftsadresse</h4>
                <div class="form-group">
                    <label for="contact-workStreet-${tabId}">Straße & Hausnummer</label>
                    <input type="text" id="contact-workStreet-${tabId}" placeholder="Firmenstraße 10">
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex: 0 0 30%;">
                        <label for="contact-workZip-${tabId}">PLZ</label>
                        <input type="text" id="contact-workZip-${tabId}" placeholder="12345" maxlength="5">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="contact-workCity-${tabId}">Ort</label>
                        <input type="text" id="contact-workCity-${tabId}" placeholder="Berlin">
                    </div>
                </div>
            </div>

            <!-- Tab: Privat -->
            <div class="form-tab-content" data-tab-content="private" data-form="${tabId}">
                <div class="form-row">
                    <div class="form-group">
                        <label for="contact-email-${tabId}">E-Mail (Privat)</label>
                        <input type="email" id="contact-email-${tabId}" placeholder="max@beispiel.de">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone-${tabId}">Telefon (Privat)</label>
                        <input type="tel" id="contact-phone-${tabId}" placeholder="+49 123 456789">
                    </div>
                </div>

                <div class="form-group">
                    <label for="contact-mobile-${tabId}">Mobiltelefon (Privat)</label>
                    <input type="tel" id="contact-mobile-${tabId}" placeholder="+49 176 12345678">
                </div>

                <h4 class="form-section-title">Privatadresse</h4>
                <div class="form-group">
                    <label for="contact-street-${tabId}">Straße & Hausnummer</label>
                    <input type="text" id="contact-street-${tabId}" placeholder="Musterstraße 1">
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex: 0 0 30%;">
                        <label for="contact-zip-${tabId}">PLZ</label>
                        <input type="text" id="contact-zip-${tabId}" placeholder="12345" maxlength="5">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="contact-city-${tabId}">Ort</label>
                        <input type="text" id="contact-city-${tabId}" placeholder="Musterstadt">
                    </div>
                </div>
            </div>

            <!-- Tab: Social Media -->
            <div class="form-tab-content" data-tab-content="social" data-form="${tabId}">
                <h4 class="form-section-title">Social Media Profile</h4>
                <p class="form-help-text">Doppelklick auf eine Plattform, um Benutzername hinzuzufügen</p>

                <!-- Social Media Badges -->
                <div id="social-media-badges-${tabId}" class="social-media-badges"></div>
            </div>

            <div class="form-footer">
                <button type="button" id="delete-btn-${tabId}" class="btn btn-danger hidden" data-tab-id="${tabId}">Löschen</button>
                <div style="flex: 1;"></div>
                <button type="button" id="cancel-btn-${tabId}" class="btn" data-tab-id="${tabId}">Abbrechen</button>
                <button type="submit" class="btn btn-primary">Speichern</button>
            </div>
        </form>
    `;
}