const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Sec-Fetch-Site values for requests started by this app's own pages or typed by the user. */
const TRUSTED_FETCH_SITES = new Set(['same-origin', 'none']);

/**
 * Whether a state-changing request must be refused as possibly cross-site. Browsers send Origin
 * on POST/PUT/PATCH/DELETE, and it must match exactly. When it is missing, Sec-Fetch-Site has to
 * vouch for the request instead; a request that carries neither is refused, because nothing
 * shows it came from this app.
 */
export function isCrossSiteRequest(request: Request, url: URL): boolean {
	if (SAFE_METHODS.has(request.method)) return false;

	const origin = request.headers.get('origin');
	// A string comparison also refuses the opaque origin "null" (sandboxed frames, some redirects).
	if (origin !== null) return origin !== url.origin;

	const fetchSite = request.headers.get('sec-fetch-site');
	return fetchSite === null || !TRUSTED_FETCH_SITES.has(fetchSite);
}
