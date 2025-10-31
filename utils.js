import { state } from './state.js';

export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(match) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
    });
}

export function sortContacts(a, b) {
    const { by, order } = state.sort;
    const factor = order === 'asc' ? 1 : -1;

    if (a.isFavorite !== b.isFavorite) {
        return (a.isFavorite ? -1 : 1) * factor;
    }

    const valA = a[by] || '';
    const valB = b[by] || '';

    return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * factor;
}

/**
 * Decodes a Quoted-Printable string, assuming UTF-8.
 * Handles "=HH" hex sequences and soft line breaks.
 * @param {string} str The string to decode.
 * @returns {string} The decoded string.
 */
export function decodeQuotedPrintable(str) {
    if (!str) return '';
    // 1. Replace soft line breaks (= at the end of a line)
    const noSoftBreaks = str.replace(/=\r\n/g, '');

    // 2. Convert =HH sequences to actual byte values
    const byteValues = [];
    let lastIndex = 0;
    noSoftBreaks.replace(/(=[A-F0-9]{2})/g, (match, p1, offset) => {
        // Add any text before the =HH sequence as is (will be treated as ASCII bytes)
        for (let i = lastIndex; i < offset; i++) {
            byteValues.push(noSoftBreaks.charCodeAt(i));
        }
        // Add the decoded byte
        byteValues.push(parseInt(p1.substring(1), 16));
        lastIndex = offset + p1.length;
        return ''; // Replace with empty string, we're building byteValues
    });
    // Add any remaining text
    for (let i = lastIndex; i < noSoftBreaks.length; i++) {
        byteValues.push(noSoftBreaks.charCodeAt(i));
    }

    // 3. Create a Uint8Array from the byte values
    const uint8Array = new Uint8Array(byteValues);

    // 4. Use TextDecoder to interpret the Uint8Array as UTF-8
    try {
        return new TextDecoder('utf-8').decode(uint8Array);
    } catch (e) {
        console.error("Fehler beim Dekodieren von Quoted-Printable (TextDecoder):", e);
        return str; // Fallback to original string on error
    }
}

/**
 * Encodes a string into Quoted-Printable format, assuming UTF-8.
 * Encodes non-ASCII bytes, '=', and control characters.
 * @param {string} str The string to encode.
 * @returns {string} The encoded string.
 */
export function encodeQuotedPrintable(str) {
    if (!str) return '';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str); // Get UTF-8 bytes
    let encoded = '';
    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        // Encode non-ASCII bytes (byte > 126), '=', and control characters (byte < 32)
        // Also encode ';' (59) for VCF structured values, as it's a separator.
        // Space (32) and Tab (9) are usually not encoded unless at line end,
        // but for simplicity and robustness in VCF, we might encode them if needed.
        // Here, we follow the general QP rule for bytes outside printable ASCII range or '='.
        // VCF often requires encoding of ';' as well.
        if (byte < 32 || byte > 126 || byte === 61 || byte === 59) { // 61 is '=', 59 is ';'
            encoded += '=' + ('0' + byte.toString(16).toUpperCase()).slice(-2);
        } else {
            encoded += String.fromCharCode(byte);
        }
    }
    return encoded;
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Validates an email address format.
 * @param {string} email The email to validate.
 * @returns {boolean} True if the email format is valid.
 */
export function isValidEmail(email) {
    if (!email) return true; // Optional field, valid if empty
    // A common, reasonably strict regex for email validation
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

/**
 * Validates a German ZIP code format (5 digits).
 * @param {string} zip The ZIP code to validate.
 * @returns {boolean} True if the ZIP code format is valid.
 */
export function isValidGermanZip(zip) {
    if (!zip) return true; // Optional field, valid if empty
    const regex = /^\d{5}$/;
    return regex.test(zip);
}

/**
 * Cleans a phone number string by removing all non-digit characters.
 * @param {string} phone The phone number string to clean.
 * @returns {string} The cleaned phone number string (digits only).
 */
export function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

/**
 * Formats a German phone number for display.
 * Removes non-digits and applies a basic grouping for readability.
 * Does not perform strict validation, just formatting.
 * @param {string} phone The phone number string to format.
 * @returns {string} The formatted phone number string.
 */
export function formatGermanPhoneNumber(phone) {
    const cleaned = cleanPhoneNumber(phone);
    if (cleaned.startsWith('0049')) {
        // International format 0049 -> 0
        const nationalNumber = '0' + cleaned.substring(4);
        return nationalNumber.replace(/(\d{4})(\d{6,})/, '$1 $2'); // e.g., 0176 1234567
    } else if (cleaned.startsWith('49')) {
        // International format 49 -> 0
        const nationalNumber = '0' + cleaned.substring(2);
        return nationalNumber.replace(/(\d{4})(\d{6,})/, '$1 $2'); // e.g., 0176 1234567
    } else if (cleaned.startsWith('0')) {
        // National format 0XXX XXXXXXX
        return cleaned.replace(/(\d{4})(\d{6,})/, '$1 $2');
    }
    // If no specific German prefix, just return cleaned number
    return cleaned;
}

/**
 * Calculates age from a birthday string in YYYY-MM-DD format.
 * @param {string} birthday The birthday in YYYY-MM-DD format
 * @returns {number|null} The age in years, or null if invalid
 */
export function calculateAge(birthday) {
    if (!birthday) return null;

    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust if birthday hasn't occurred this year yet
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= 0 ? age : null;
}

/**
 * Formats a birthday date for display.
 * @param {string} birthday The birthday in YYYY-MM-DD format
 * @returns {string} Formatted birthday with age
 */
export function formatBirthday(birthday) {
    if (!birthday) return '';

    const age = calculateAge(birthday);
    const date = new Date(birthday);

    if (isNaN(date.getTime())) return birthday;

    const formatted = date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return age !== null ? `${formatted} (${age})` : formatted;
}