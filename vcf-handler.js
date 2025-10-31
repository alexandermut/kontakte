import { state } from './state.js';
import { showNotification } from './contacts.js';
import { encodeQuotedPrintable, decodeQuotedPrintable } from './utils.js';

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
        // Helper to check if a field needs encoding
        const needsEncoding = (val) => val && /[^\x00-\x7F]/.test(val);

        vcfString += 'BEGIN:VCARD\r\nVERSION:3.0\r\n';

        // Use Quoted-Printable for fields with special characters
        const lastName = contact.lastName || '';
        const firstName = contact.firstName || '';
        const nValue = `${lastName};${firstName};;;`;
        const fnValue = `${firstName} ${lastName}`.trim();

        vcfString += needsEncoding(nValue)
            ? `N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(nValue)}\r\n`
            : `N:${nValue}\r\n`;
        vcfString += needsEncoding(fnValue)
            ? `FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(fnValue)}\r\n`
            : `FN:${fnValue}\r\n`;

        // Nickname
        if (contact.nickname) {
            vcfString += needsEncoding(contact.nickname)
                ? `NICKNAME;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(contact.nickname)}\r\n`
                : `NICKNAME:${contact.nickname}\r\n`;
        }

        // Title/Position
        if (contact.title) {
            vcfString += needsEncoding(contact.title)
                ? `TITLE;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(contact.title)}\r\n`
                : `TITLE:${contact.title}\r\n`;
        }

        // Role/Function
        if (contact.role) {
            vcfString += needsEncoding(contact.role)
                ? `ROLE;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(contact.role)}\r\n`
                : `ROLE:${contact.role}\r\n`;
        }

        // Organization
        if (contact.company) {
            vcfString += needsEncoding(contact.company)
                ? `ORG;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(contact.company)}\r\n`
                : `ORG:${contact.company}\r\n`;
        }

        // Private Email & Phone
        if (contact.email) vcfString += `EMAIL;TYPE=INTERNET,HOME:${contact.email}\r\n`;
        if (contact.phone) vcfString += `TEL;TYPE=HOME,VOICE:${contact.phone}\r\n`;
        if (contact.mobile) vcfString += `TEL;TYPE=HOME,CELL:${contact.mobile}\r\n`;

        // Work Email & Phone
        if (contact.workEmail) vcfString += `EMAIL;TYPE=INTERNET,WORK:${contact.workEmail}\r\n`;
        if (contact.workPhone) vcfString += `TEL;TYPE=WORK,VOICE:${contact.workPhone}\r\n`;
        if (contact.workMobile) vcfString += `TEL;TYPE=WORK,CELL:${contact.workMobile}\r\n`;

        // Private Address
        if (contact.street || contact.city || contact.zip) {
            const adrValue = `;;${contact.street || ''};${contact.city || ''};;${contact.zip || ''};`;
            vcfString += needsEncoding(adrValue)
                ? `ADR;TYPE=HOME;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(adrValue)}\r\n`
                : `ADR;TYPE=HOME:${adrValue}\r\n`;
        }

        // Work Address
        if (contact.workStreet || contact.workCity || contact.workZip) {
            const adrValue = `;;${contact.workStreet || ''};${contact.workCity || ''};;${contact.workZip || ''};`;
            vcfString += needsEncoding(adrValue)
                ? `ADR;TYPE=WORK;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(adrValue)}\r\n`
                : `ADR;TYPE=WORK:${adrValue}\r\n`;
        }

        if (contact.category) {
            vcfString += `CATEGORIES:${contact.category}\r\n`;
        }

        if (contact.birthday) {
            // VCF format for birthday: BDAY:YYYY-MM-DD or YYYYMMDD
            const formatted = contact.birthday.replace(/-/g, '');
            vcfString += `BDAY:${formatted}\r\n`;
        }

        // URL (Website)
        if (contact.url) {
            vcfString += `URL:${contact.url}\r\n`;
        }

        // Notes
        if (contact.notes) {
            // NOTE field can contain line breaks, encode them properly
            const notesEncoded = contact.notes.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\n');
            vcfString += needsEncoding(notesEncoded)
                ? `NOTE;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(notesEncoded)}\r\n`
                : `NOTE:${notesEncoded}\r\n`;
        }

        // Social Media Profiles (X-SOCIALPROFILE extension)
        if (contact.socialMedia && contact.socialMedia.length > 0) {
            contact.socialMedia.forEach(social => {
                if (social.platform && social.username) {
                    vcfString += `X-SOCIALPROFILE;TYPE=${social.platform}:${social.username}\r\n`;
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

/**
 * Exports all contacts as a VCF file.
 */
export function exportContacts() {
    exportContactsToVCF(state.contacts);
    showNotification('Kontakte exportiert.');
}

/**
 * Imports contacts from a VCF file.
 */
export function importVCF(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const vcards = text.split('BEGIN:VCARD');
        let importedCount = 0;

        vcards.forEach(vcardText => {
            if (!vcardText.trim()) return;

            // Helper to get a field value, decoding it if necessary
            const getVcfField = (field) => {
                const regex = new RegExp(`^${field}(;[^:]*)?:(.*)$`, 'im');
                const match = vcardText.match(regex);
                if (!match) return null;

                const params = match[1] || '';
                let value = match[2].trim();

                if (params.includes('ENCODING=QUOTED-PRINTABLE')) {
                    value = decodeQuotedPrintable(value);
                }
                return value;
            };

            const contact = {
                id: state.nextId,
                firstName: '',
                lastName: '',
                name: '',
                nickname: '',
                title: '',
                role: '',
                company: '',
                email: '',
                phone: '',
                mobile: '',
                workEmail: '',
                workPhone: '',
                workMobile: '',
                street: '',
                zip: '',
                city: '',
                workStreet: '',
                workZip: '',
                workCity: '',
                category: '',
                birthday: '',
                url: '',
                notes: '',
                socialMedia: [],
                isFavorite: false
            };

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
                    contact.firstName = parts.slice(0, -1).join(' ');
                    contact.lastName = parts[parts.length - 1];
                }
            }

            // Generate combined name field
            contact.name = `${contact.firstName} ${contact.lastName}`.trim();

            contact.nickname = getVcfField('NICKNAME') || '';

            // Helper to get field with specific TYPE
            const getVcfFieldWithType = (field, type) => {
                const regex = new RegExp(`^${field}[^:]*TYPE[^:]*${type}[^:]*:(.*)$`, 'im');
                const match = vcardText.match(regex);
                if (!match) return null;
                let value = match[1].trim();
                if (match[0].includes('ENCODING=QUOTED-PRINTABLE')) {
                    value = decodeQuotedPrintable(value);
                }
                return value;
            };

            contact.title = getVcfField('TITLE') || '';
            contact.role = getVcfField('ROLE') || '';
            contact.company = getVcfField('ORG') || '';

            // Emails - prioritize HOME vs WORK
            contact.email = getVcfFieldWithType('EMAIL', 'HOME') || getVcfField('EMAIL') || '';
            contact.workEmail = getVcfFieldWithType('EMAIL', 'WORK') || '';

            // Phones - prioritize based on TYPE
            contact.phone = getVcfFieldWithType('TEL', 'HOME') || '';
            contact.mobile = getVcfFieldWithType('TEL', 'HOME.*CELL') || getVcfFieldWithType('TEL', 'CELL') || '';
            contact.workPhone = getVcfFieldWithType('TEL', 'WORK.*VOICE') || getVcfFieldWithType('TEL', 'WORK') || '';
            contact.workMobile = getVcfFieldWithType('TEL', 'WORK.*CELL') || '';

            // Fallback: if no type-specific phone found, use generic TEL
            if (!contact.phone && !contact.mobile && !contact.workPhone && !contact.workMobile) {
                contact.phone = getVcfField('TEL') || '';
            }

            // Private Address (TYPE=HOME or no type)
            const adrHomeValue = getVcfFieldWithType('ADR', 'HOME');
            if (adrHomeValue) {
                const adrParts = adrHomeValue.split(';');
                contact.street = adrParts[2] || '';
                contact.city = adrParts[3] || '';
                contact.zip = adrParts[5] || '';
            } else {
                // Fallback to any ADR field
                const adrValue = getVcfField('ADR');
                if (adrValue) {
                    const adrParts = adrValue.split(';');
                    contact.street = adrParts[2] || '';
                    contact.city = adrParts[3] || '';
                    contact.zip = adrParts[5] || '';
                }
            }

            // Work Address (TYPE=WORK)
            const adrWorkValue = getVcfFieldWithType('ADR', 'WORK');
            if (adrWorkValue) {
                const adrParts = adrWorkValue.split(';');
                contact.workStreet = adrParts[2] || '';
                contact.workCity = adrParts[3] || '';
                contact.workZip = adrParts[5] || '';
            }

            contact.category = getVcfField('CATEGORIES') || '';

            // Parse birthday (BDAY field can be YYYYMMDD or YYYY-MM-DD)
            const bdayValue = getVcfField('BDAY');
            if (bdayValue) {
                // Convert YYYYMMDD to YYYY-MM-DD if needed
                if (bdayValue.length === 8 && !bdayValue.includes('-')) {
                    contact.birthday = `${bdayValue.substring(0, 4)}-${bdayValue.substring(4, 6)}-${bdayValue.substring(6, 8)}`;
                } else {
                    contact.birthday = bdayValue;
                }
            }

            // URL (Website)
            contact.url = getVcfField('URL') || '';

            // Notes - decode \n back to line breaks
            const notesValue = getVcfField('NOTE');
            if (notesValue) {
                contact.notes = notesValue.replace(/\\n/g, '\n');
            }

            // Social Media Profiles (X-SOCIALPROFILE)
            contact.socialMedia = [];
            const socialRegex = /^X-SOCIALPROFILE[^:]*TYPE[^:]*=([^:;]+)[^:]*:(.*)$/gim;
            let socialMatch;
            while ((socialMatch = socialRegex.exec(vcardText)) !== null) {
                const platform = socialMatch[1].trim();
                const username = socialMatch[2].trim();
                if (platform && username) {
                    contact.socialMedia.push({ platform, username });
                }
            }

            // Check for duplicates
            const isDuplicate = state.contacts.some(c =>
                (c.lastName || '').toLowerCase() === (contact.lastName || '').toLowerCase() &&
                (c.firstName || '').toLowerCase() === (contact.firstName || '').toLowerCase()
            );

            if (contact.lastName && !isDuplicate) {
                state.contacts = [...state.contacts, contact];
                state.nextId++;
                importedCount++;
            }
        });

        if (importedCount > 0) {
            showNotification(`${importedCount} Kontakte importiert.`);
        } else {
            showNotification('Keine neuen Kontakte in der Datei gefunden.');
        }
        event.target.value = null;
    };

    reader.readAsText(file);
}
