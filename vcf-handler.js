import { state } from './state.js';
import { showNotification } from './contacts.js';
import { encodeQuotedPrintable, decodeQuotedPrintable, repairMojibake } from './utils.js';
import { findDuplicate } from './utils.js';

/**
 * Escapes VCF special characters in a string value.
 * According to RFC 2426, backslashes, commas, and semicolons must be escaped.
 * @param {string} value The string to escape.
 * @returns {string} The escaped string.
 */
const escapeVcfValue = (value) => {
    if (typeof value !== 'string') return '';
    // CRITICAL: Backslash must be escaped FIRST, otherwise we'd escape our own escape chars!
    return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;');
};

/**
 * Unescapes VCF special characters in a string value.
 * Reverses the escaping done by escapeVcfValue().
 * @param {string} value The string to unescape.
 * @returns {string} The unescaped string.
 */
const unescapeVcfValue = (value) => {
    if (typeof value !== 'string') return '';
    // CRITICAL: Must unescape in REVERSE order (semicolon, comma, then backslash)
    return value.replace(/\\;/g, ';').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
};

/**
 * Exports given contacts array as a VCF file.
 */
export function exportContactsToVCF(contacts, filename = 'contacts.vcf') {
    if (!contacts || contacts.length === 0) {
        showNotification('Keine Kontakte zum Exportieren vorhanden.');
        return;
    }

    let vcfString = '';
    contacts.forEach(contact => {
        // Helper to check if a field needs encoding (contains non-ASCII chars)
        const needsEncoding = (val) => val && /[^\x00-\x7F]/.test(val);

        vcfString += 'BEGIN:VCARD\r\nVERSION:3.0\r\n';

        // N and FN fields with escaping and encoding
        const lastName = escapeVcfValue(contact.lastName || '');
        const firstName = escapeVcfValue(contact.firstName || '');
        const nValue = `${lastName};${firstName};;;`;
        // FN field must also be escaped (in case name contains special chars)
        const fnValue = escapeVcfValue(`${contact.firstName || ''} ${contact.lastName || ''}`.trim());

        vcfString += `N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(nValue)}\r\n`;
        vcfString += `FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(fnValue)}\r\n`;

        // Generic field handler
        const addField = (field, value) => {
            if (!value) return;
            const escapedValue = escapeVcfValue(value);
            if (needsEncoding(escapedValue)) {
                vcfString += `${field};CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(escapedValue)}\r\n`;
            } else {
                vcfString += `${field}:${escapedValue}\r\n`;
            }
        };

        addField('NICKNAME', contact.nickname);
        addField('TITLE', contact.title);
        addField('ROLE', contact.role);
        addField('ORG', contact.company);

        if (contact.email) vcfString += `EMAIL;TYPE=INTERNET,HOME:${escapeVcfValue(contact.email)}\r\n`;
        if (contact.phone) vcfString += `TEL;TYPE=HOME,VOICE:${escapeVcfValue(contact.phone)}\r\n`;
        if (contact.mobile) vcfString += `TEL;TYPE=HOME,CELL:${escapeVcfValue(contact.mobile)}\r\n`;
        if (contact.workEmail) vcfString += `EMAIL;TYPE=INTERNET,WORK:${escapeVcfValue(contact.workEmail)}\r\n`;
        if (contact.workPhone) vcfString += `TEL;TYPE=WORK,VOICE:${escapeVcfValue(contact.workPhone)}\r\n`;
        if (contact.workMobile) vcfString += `TEL;TYPE=WORK,CELL:${escapeVcfValue(contact.workMobile)}\r\n`;

        // Addresses with escaping
        if (contact.street || contact.city || contact.zip) {
            const adrValue = `;;${escapeVcfValue(contact.street || '')};${escapeVcfValue(contact.city || '')};;${escapeVcfValue(contact.zip || '')};`;
            vcfString += `ADR;TYPE=HOME;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(adrValue)}\r\n`;
        }
        if (contact.workStreet || contact.workCity || contact.workZip) {
            const adrValue = `;;${escapeVcfValue(contact.workStreet || '')};${escapeVcfValue(contact.workCity || '')};;${escapeVcfValue(contact.workZip || '')};`;
            vcfString += `ADR;TYPE=WORK;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(adrValue)}\r\n`;
        }

        if (contact.category) vcfString += `CATEGORIES:${escapeVcfValue(contact.category)}\r\n`;
        if (contact.birthday) vcfString += `BDAY:${contact.birthday.replace(/-/g, '')}\r\n`;
        if (contact.url) vcfString += `URL:${escapeVcfValue(contact.url)}\r\n`;

        if (contact.notes) {
            const notesEncoded = contact.notes.replace(/\r\n|\n|\r/g, '\\n');
            addField('NOTE', notesEncoded);
        }

        if (contact.socialMedia && contact.socialMedia.length > 0) {
            contact.socialMedia.forEach(social => {
                if (social.platform && social.username) {
                    vcfString += `X-SOCIALPROFILE;TYPE=${escapeVcfValue(social.platform)}:${escapeVcfValue(social.username)}\r\n`;
                }
            });
        }

        vcfString += `END:VCARD\r\n`;
    });

    const blob = new Blob([vcfString], { type: 'text/vcard;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

export function exportContacts() {
    exportContactsToVCF(state.contacts);
    showNotification('Kontakte exportiert.');
}

export function importVCF(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        let text = e.target.result;
        text = text.replace(/(\r\n|\n)[ \t]/g, ''); // Unfold multi-line fields

        // Repair common Mojibake (UTF-8 interpreted as MacRoman/Windows-1252)
        text = repairMojibake(text);

        const vcards = text.split('BEGIN:VCARD');
        let importedCount = 0, skippedCount = 0, replacedCount = 0;

        vcards.forEach(vcardText => {
            if (!vcardText.trim()) return;

            const getVcfField = (fieldName, type) => {
                const lines = vcardText.split(/\r\n|\n/);
                for (const line of lines) {
                    const regex = new RegExp(`^${fieldName}(;[^:]*)?:(.*)$`, 'i');
                    const match = line.match(regex);
                    if (match) {
                        const params = match[1] || '';

                        if (type) {
                            // Support both "TYPE=WORK" and shorthand ";WORK"
                            const typeRegex = new RegExp(`(TYPE=.*${type}|;${type}(;|$))`, 'i');
                            if (!typeRegex.test(params)) continue;
                        }
                        let value = match[2].trim();
                        let charset = 'utf-8';
                        const charsetMatch = params.match(/CHARSET=([^;:]*)/i);
                        if (charsetMatch) charset = charsetMatch[1];

                        // First: decode Quoted-Printable (if needed)
                        if (params.includes('ENCODING=QUOTED-PRINTABLE')) {
                            value = decodeQuotedPrintable(value, charset);
                        }

                        // Then: unescape VCF special characters (\, \; \\ etc.)
                        value = unescapeVcfValue(value);

                        return value;
                    }
                }
                return null;
            };

            const contact = { id: state.nextId, isFavorite: false, socialMedia: [] };

            const nValue = getVcfField('N');
            if (nValue) {
                const parts = nValue.split(';').map(p => p.trim());
                contact.lastName = parts[0];
                contact.firstName = parts[1];
            }

            if (!contact.lastName) {
                const fnValue = getVcfField('FN');
                if (fnValue) {
                    const parts = fnValue.split(' ');
                    contact.lastName = parts.pop();
                    contact.firstName = parts.join(' ');
                }
            }

            contact.name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
            contact.nickname = getVcfField('NICKNAME');
            contact.title = getVcfField('TITLE');
            contact.role = getVcfField('ROLE');
            contact.company = getVcfField('ORG');
            contact.email = getVcfField('EMAIL', 'HOME') || getVcfField('EMAIL');
            contact.workEmail = getVcfField('EMAIL', 'WORK');
            contact.phone = getVcfField('TEL', 'HOME');
            contact.mobile = getVcfField('TEL', 'CELL');
            contact.workPhone = getVcfField('TEL', 'WORK');
            contact.workMobile = getVcfField('TEL', 'WORK.*CELL');

            const adrHome = getVcfField('ADR', 'HOME') || getVcfField('ADR');
            if (adrHome) {
                const parts = adrHome.split(';');
                contact.street = parts[2];
                contact.city = parts[3];
                contact.zip = parts[5];
            }

            const adrWork = getVcfField('ADR', 'WORK');
            if (adrWork) {
                const parts = adrWork.split(';');
                contact.workStreet = parts[2];
                contact.workCity = parts[3];
                contact.workZip = parts[5];
            }

            contact.category = getVcfField('CATEGORIES');
            const bday = getVcfField('BDAY');
            if (bday && bday.length === 8) {
                contact.birthday = `${bday.slice(0, 4)}-${bday.slice(4, 6)}-${bday.slice(6, 8)}`;
            } else if (bday) {
                contact.birthday = bday;
            }

            contact.url = getVcfField('URL');
            const note = getVcfField('NOTE');
            if (note) contact.notes = note.replace(/\\n/g, '\n');

            const socialRegex = /^X-SOCIALPROFILE[^:]*TYPE[^:]*=([^:;]+)[^:]*:(.*)$/gim;
            let socialMatch;
            while ((socialMatch = socialRegex.exec(vcardText)) !== null) {
                contact.socialMedia.push({ platform: socialMatch[1].trim(), username: socialMatch[2].trim() });
            }

            if (!contact.lastName && !contact.firstName) return; // Skip empty contacts

            const duplicate = findDuplicate(contact, state.contacts);
            if (duplicate) {
                const name = `${contact.firstName} ${contact.lastName}`.trim();
                const action = confirm(`Duplikat gefunden: "${name}"\n\nOK = Ersetzen\nAbbrechen = Überspringen`);
                if (action) {
                    const index = state.contacts.findIndex(c => c.id === duplicate.id);
                    if (index !== -1) {
                        contact.id = duplicate.id;
                        contact.isFavorite = duplicate.isFavorite;
                        state.contacts[index] = { ...state.contacts[index], ...contact };
                        replacedCount++;
                    }
                } else {
                    skippedCount++;
                }
            } else {
                state.contacts = [...state.contacts, contact];
                state.nextId++;
                importedCount++;
            }
        });

        if (replacedCount > 0) state.contacts = [...state.contacts];

        const messages = [];
        if (importedCount > 0) messages.push(`${importedCount} neu`);
        if (replacedCount > 0) messages.push(`${replacedCount} ersetzt`);
        if (skippedCount > 0) messages.push(`${skippedCount} übersprungen`);
        showNotification(messages.length > 0 ? `Import: ${messages.join(', ')}` : 'Keine Kontakte importiert.');
        event.target.value = null;
    };
    // Explicitly read as UTF-8 (default is platform-dependent)
    // This ensures umlauts are correctly interpreted even without ENCODING=QUOTED-PRINTABLE
    reader.readAsText(file, 'UTF-8');
}