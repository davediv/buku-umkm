/**
 * An in-memory stand-in for the R2 calls receipts use (put, get, delete, list), keeping
 * each object's bytes so tests can compare them. `failPut` makes chosen puts throw, as R2
 * would on an outage.
 */
export function createTestR2(options: { failPut?: (key: string) => boolean } = {}) {
	const objects = new Map<string, Uint8Array<ArrayBuffer>>();
	let puts = 0;
	const bucket = {
		async put(key: string, value: ArrayBuffer | ArrayBufferView) {
			puts++;
			if (options.failPut?.(key)) throw new Error('R2 put failed');
			const view = ArrayBuffer.isView(value) ? value : new Uint8Array(value);
			const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
			objects.set(key, bytes);
			return { key, size: bytes.byteLength };
		},
		async get(key: string) {
			const bytes = objects.get(key);
			if (!bytes) return null;
			return {
				key,
				size: bytes.byteLength,
				get body() {
					return new Response(bytes.slice()).body;
				},
				arrayBuffer: async () => bytes.slice().buffer
			};
		},
		async delete(keys: string | string[]) {
			for (const key of [keys].flat()) objects.delete(key);
		},
		async list({ prefix = '', cursor, limit = 1000 }: R2ListOptions = {}) {
			const matching = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
			const start = cursor ? Number(cursor) : 0;
			const truncated = start + limit < matching.length;
			return {
				objects: matching
					.slice(start, start + limit)
					.map((key) => ({ key, size: objects.get(key)!.byteLength })),
				truncated,
				cursor: truncated ? String(start + limit) : undefined,
				delimitedPrefixes: []
			};
		}
	};
	return {
		objects,
		bucket: bucket as unknown as R2Bucket,
		/** Puts tried so far, failed ones included. */
		get puts() {
			return puts;
		},
		/** Keys under a user's receipt prefix. */
		keysOf: (userId: string) =>
			[...objects.keys()].filter((key) => key.startsWith(`receipts/${userId}/`)).sort()
	};
}

/** `size` bytes that pass the JPEG / PNG check, the rest filler that varies with `seed`. */
export function fakeImage(kind: 'jpg' | 'png', size = 1000, seed = 1): Uint8Array<ArrayBuffer> {
	const magic = kind === 'jpg' ? [0xff, 0xd8, 0xff, 0xe0] : [0x89, 0x50, 0x4e, 0x47];
	const bytes = new Uint8Array(size);
	for (let i = 0; i < size; i++) bytes[i] = (i * 31 + seed * 7) & 0xff;
	bytes.set(magic);
	return bytes;
}
