/**
 * Development tools configuration.
 *
 * Reads the VITE_DEV_TOOLS environment variable to determine whether
 * debug/development utilities should be enabled. Only the explicit value
 * "true" (case-insensitive) activates dev tools; any other value
 * (including undefined or empty) keeps them disabled.
 *
 * This ensures dev tools are never accidentally shipped to production.
 */

const envValue = (import.meta.env.VITE_DEV_TOOLS ?? '').toString().trim().toLowerCase();

export const DEV_TOOLS_ENABLED: boolean = envValue === 'true';
