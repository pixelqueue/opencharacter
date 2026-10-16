// Everything that builds a URL to the site reads these. For a custom domain at its root, set
// ORIGIN to it and BASE to ''.

/** No trailing slash. */
export const ORIGIN = 'https://opencharacterformat.org';
/** No trailing slash ('' at a domain's root). */
export const BASE = '';
export const SITE = `${ORIGIN}${BASE}/`;
