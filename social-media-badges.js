import { dom } from './state.js';

// Social Media Platforms with icons
export const SOCIAL_PLATFORMS = [
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/', icon: '💼' },
    { name: 'Facebook', url: 'https://www.facebook.com/', icon: '👤' },
    { name: 'Instagram', url: 'https://www.instagram.com/', icon: '📷' },
    { name: 'YouTube', url: 'https://www.youtube.com/@', icon: '▶️' },
    { name: 'Twitter/X', url: 'https://twitter.com/', icon: '🐦' },
    { name: 'TikTok', url: 'https://www.tiktok.com/@', icon: '🎵' },
    { name: 'GitHub', url: 'https://github.com/', icon: '💻' },
    { name: 'Xing', url: 'https://www.xing.com/profile/', icon: '🤝' },
    { name: 'WhatsApp', url: 'https://wa.me/', icon: '💬' },
    { name: 'Telegram', url: 'https://t.me/', icon: '✈️' },
    { name: 'Discord', url: 'https://discord.com/users/', icon: '🎮' },
    { name: 'Twitch', url: 'https://www.twitch.tv/', icon: '📺' },
];

/**
 * Renders all social media badges
 * @param {Array} socialMediaData - The social media data for the contact
 * @param {string} tabId - The ID of the tab to render into
 */
export function renderSocialBadges(socialMediaData = [], tabId) {
    const container = document.getElementById(`social-media-badges-${tabId}`);
    if (!container) return;

    container.innerHTML = '';

    SOCIAL_PLATFORMS.forEach(platform => {
        const existingData = socialMediaData.find(s => s.platform === platform.name);
        const badge = createBadge(platform, existingData?.username || '', tabId);
        container.appendChild(badge);
    });
}

/**
 * Creates a single badge element
 */
function createBadge(platform, username = '', tabId) {
    const badge = document.createElement('div');
    badge.className = 'social-badge' + (username ? ' active' : '');
    badge.dataset.platform = platform.name;
    badge.dataset.tabId = tabId;

    const linkIcon = `
        <svg viewBox="0 0 20 20" fill="currentColor" class="social-badge-icon">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
    `;

    badge.innerHTML = `
        <span class="social-badge-icon">${platform.icon}</span>
        <span class="social-badge-label">${platform.name}</span>
        ${username ? `<span class="social-badge-username">@${username}</span>` : ''}
        ${username ? `
            <button type="button" class="social-badge-remove" title="Entfernen">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
        ` : ''}
    `;

    // Double-click to edit/add
    badge.addEventListener('dblclick', (e) => {
        if (e.target.closest('.social-badge-remove')) return;
        editBadge(badge, platform, username, tabId);
    });

    // Single click to open link (if active)
    badge.addEventListener('click', (e) => {
        if (e.target.closest('.social-badge-remove')) {
            e.stopPropagation();
            removeBadge(badge);
            return;
        }
        // Only open link if no input is currently active within this form
        if (username && !badge.querySelector('.social-badge-input')) {
            const url = platform.url + username.replace(/^@/, '');
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    });

    return badge;
}

/**
 * Edit badge (show input)
 */
function editBadge(badge, platform, currentUsername, tabId) {
    const formWrapper = badge.closest('.contact-form-wrapper');
    if (!formWrapper) return; // Should not happen

    // Close any currently open input *within the same form*
    const otherOpenInput = formWrapper.querySelector('.social-badge-input');
    if (otherOpenInput) {
        otherOpenInput.blur(); // Trigger save/close on the other input
    }

    if (badge.querySelector('.social-badge-input')) return; // Already editing

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'social-badge-input';
    input.placeholder = 'benutzername';
    input.value = currentUsername.replace(/^@/, '');

    badge.appendChild(input);
    input.focus();
    input.select();

    // Save on Enter or blur
    const saveBadge = () => {
        const newUsername = input.value.trim().replace(/^@/, '');
        input.remove();

        if (newUsername) {
            // Update badge
            badge.classList.add('active');
            const usernameSpan = badge.querySelector('.social-badge-username');
            if (usernameSpan) {
                usernameSpan.textContent = '@' + newUsername;
            } else {
                const removeBtn = badge.querySelector('.social-badge-remove');
                const usernameEl = document.createElement('span');
                usernameEl.className = 'social-badge-username';
                usernameEl.textContent = '@' + newUsername;

                if (removeBtn) {
                    badge.insertBefore(usernameEl, removeBtn);
                } else {
                    badge.appendChild(usernameEl);
                    // Add remove button
                    const removeBtnEl = document.createElement('button');
                    removeBtnEl.type = 'button';
                    removeBtnEl.className = 'social-badge-remove';
                    removeBtnEl.title = 'Entfernen';
                    removeBtnEl.innerHTML = `
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    `;
                    removeBtnEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeBadge(badge);
                    });
                    badge.appendChild(removeBtnEl);
                }
            }
        } else {
            // Remove username if empty
            removeBadge(badge);
        }
    };

    input.addEventListener('blur', saveBadge);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBadge();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            input.remove();
        }
    });
}

/**
 * Remove badge username
 */
function removeBadge(badge) {
    badge.classList.remove('active');
    const usernameSpan = badge.querySelector('.social-badge-username');
    const removeBtn = badge.querySelector('.social-badge-remove');
    if (usernameSpan) usernameSpan.remove();
    if (removeBtn) removeBtn.remove();
}

/**
 * Get all social media data from badges
 */
export function getSocialMediaDataFromBadges(tabId) {
    const container = document.getElementById(`social-media-badges-${tabId}`);
    if (!container) return [];
    const badges = container.querySelectorAll('.social-badge.active');
    const socialMedia = [];

    badges.forEach(badge => {
        const platform = badge.dataset.platform;
        const usernameSpan = badge.querySelector('.social-badge-username');
        if (usernameSpan) {
            const username = usernameSpan.textContent.replace(/^@/, '');
            if (platform && username) {
                socialMedia.push({ platform, username });
            }
        }
    });

    return socialMedia;
}
