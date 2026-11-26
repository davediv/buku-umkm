/** The size a request declares in Content-Length, or null when it declares none. */
export function declaredContentLength(request: Request): number | null {
	const header = request.headers.get('content-length')?.trim();
	return header && /^\d+$/.test(header) ? Number(header) : null;
}

/**
 * Reads a request body, giving up (null) as soon as it is larger than `maxBytes`. A
 * declared Content-Length over the limit is refused before a byte is read; a body sent
 * without one (or with a false one) is counted as it streams in, so it can never be
 * buffered past the limit the way `request.formData()` or `request.text()` would.
 */
export async function readBodyWithLimit(
	request: Request,
	maxBytes: number
): Promise<Uint8Array<ArrayBuffer> | null> {
	const declared = declaredContentLength(request);
	if (declared !== null && declared > maxBytes) return null;
	if (!request.body) return new Uint8Array(0);

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}

/** Parses a multipart body that has already been read within a size limit. */
export function parseMultipart(
	body: Uint8Array<ArrayBuffer>,
	contentType: string
): Promise<FormData> {
	return new Response(body, { headers: { 'content-type': contentType } }).formData();
}
