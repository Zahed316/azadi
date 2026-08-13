/**
 * Escape special HTML characters to prevent injection when rendering
 * user-supplied or admin-configured text inside Telegram HTML messages.
 *
 * Only needed for values loaded from the database (SettingsRepository.getValue)
 * and interpolated into strings sent with `parse_mode: 'HTML'`.
 * Hardcoded default strings are trusted and do not need escaping.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
