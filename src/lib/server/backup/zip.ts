/*
 * A streaming ZIP writer and reader for backup archives. Both handle only the part of the
 * format (PKWARE APPNOTE) that backups use, and the reader refuses everything else with a
 * ZipError rather than guess:
 *
 * - STORE (method 0) and DEFLATE (method 8, raw deflate through CompressionStream).
 * - CRC-32 and sizes in the local file header, so no data descriptors: the writer holds one
 *   entry at a time to compute them, never the archive.
 * - UTF-8 names (general purpose bit 11), no encryption, one disk, no ZIP64 (at most
 *   ZIP_MAX_ENTRIES entries and ZIP_MAX_BYTES bytes).
 * - A central directory and end record, so the file opens in ordinary unzip tools.
 *
 * A backup archive holds, in this order:
 *   backup.json            the backup document (./format.ts), DEFLATE
 *   photos/<photoId>.jpg   then one STORE entry per receipt image (JPEG and PNG are already
 *   photos/<photoId>.png   compressed), named by the photo's id in backup.json
 */

export type ZipErrorCode =
	/** The input ended before the archive did. */
	| 'truncated'
	/** Damaged or inconsistent: a bad signature, CRC-32 or size, or a central directory
	 * that does not match the entries. */
	| 'corrupt'
	/** Valid ZIP, but a feature these archives never use (encryption, data descriptors,
	 * ZIP64, several disks, a compression method other than STORE or DEFLATE). */
	| 'unsupported'
	/** Over a caller's limit (reader) or the ZIP32 limits (writer). */
	| 'limit'
	/** An entry name that is malformed, unsafe or repeated. */
	| 'name';

export class ZipError extends Error {
	readonly code: ZipErrorCode;

	constructor(code: ZipErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ZipError';
		this.code = code;
	}
}

/** 0xffff and 0xffffffff in the end record mean "see the ZIP64 record", so plain ZIP ends one below. */
export const ZIP_MAX_ENTRIES = 0xfffe;
export const ZIP_MAX_BYTES = 0xfffffffe;

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY = 0x06064b50;
const ZIP64_END_LOCATOR = 0x07064b50;

/** Record sizes without the name, extra field and comment that follow them. */
const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const END_BYTES = 22;

const STORE = 0;
const DEFLATE = 8;

const FLAG_ENCRYPTED = 0x0001;
/** Bits 1-2: the deflate level used; informational only. */
const FLAG_DEFLATE_LEVEL = 0x0006;
const FLAG_DATA_DESCRIPTOR = 0x0008;
const FLAG_STRONG_ENCRYPTION = 0x0040;
const FLAG_UTF8 = 0x0800;
const FLAG_ENCRYPTED_DIRECTORY = 0x2000;

/** 2.0: DEFLATE. The high byte of "version made by" is 0 (MS-DOS attributes, all clear),
 * so unzip tools give extracted files their default permissions. */
const ZIP_VERSION = 20;

// --- CRC-32 -------------------------------------------------------------------------

/** Eight 256-entry tables for CRC-32 (the reflected 0xedb88320 polynomial), slicing by 8. */
const CRC_TABLES = (() => {
	const tables = new Uint32Array(8 * 256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		tables[n] = c;
	}
	for (let n = 0; n < 256; n++) {
		let c = tables[n];
		for (let k = 1; k < 8; k++) {
			c = tables[c & 0xff] ^ (c >>> 8);
			tables[k * 256 + n] = c;
		}
	}
	return tables;
})();

/** The CRC-32 ZIP stores for `data`. About 1.7 GB/s in V8, four times a byte-at-a-time loop. */
export function crc32(data: Uint8Array): number {
	const t = CRC_TABLES;
	let c = -1;
	let i = 0;
	for (const end = data.length - (data.length % 8); i < end; i += 8) {
		const low = c ^ (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24));
		c =
			t[1792 + (low & 0xff)] ^
			t[1536 + ((low >>> 8) & 0xff)] ^
			t[1280 + ((low >>> 16) & 0xff)] ^
			t[1024 + (low >>> 24)] ^
			t[768 + data[i + 4]] ^
			t[512 + data[i + 5]] ^
			t[256 + data[i + 6]] ^
			t[data[i + 7]];
	}
	for (; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
	return ~c >>> 0;
}

// --- Shared helpers -----------------------------------------------------------------

const viewOf = (bytes: Uint8Array) =>
	new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** `data` as a one-chunk stream, typed for piping through (De)CompressionStream. */
function singleChunk(data: BufferSource): ReadableStream<BufferSource> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(data);
			controller.close();
		}
	});
}

/** The header fields a local file header and its central directory record share. */
type EntryFields = {
	flags: number;
	method: number;
	crc: number;
	compressedSize: number;
	size: number;
};

// --- Writer -------------------------------------------------------------------------

export type ZipEntrySource = {
	/** A relative path with `/` separators: no empty, `.` or `..` segment, no `\` or NUL. */
	name: string;
	/** The whole entry. A stored entry is enqueued as is, so do not change it afterwards. */
	data: Uint8Array<ArrayBuffer>;
	/** Deflate the entry, kept only if that makes it smaller. Not worth it for JPEG or PNG. */
	compress?: boolean;
};

export type ZipWriterOptions = {
	/** The modification time every entry gets. Defaults to now. */
	modified?: Date;
	/** DOS timestamps carry no time zone: minutes east of UTC to write them in (WIB is 420). */
	utcOffsetMinutes?: number;
};

const encoder = new TextEncoder();

function encodeEntryName(name: string): Uint8Array {
	const unsafe =
		name.includes('\\') ||
		name.includes('\0') ||
		name.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
	const bytes = encoder.encode(name);
	if (unsafe || bytes.byteLength > 0xffff) {
		throw new ZipError('name', `Refusing the entry name ${JSON.stringify(name)}`);
	}
	return bytes;
}

/** MS-DOS time and date words: 2-second resolution, years 1980-2107. */
function dosDateTime(date: Date, utcOffsetMinutes: number): { time: number; date: number } {
	const local = new Date(date.getTime() + utcOffsetMinutes * 60_000);
	const year = local.getUTCFullYear();
	if (!(year >= 1980)) return { time: 0, date: (1 << 5) | 1 }; // before 1980, or invalid
	return {
		time: (local.getUTCHours() << 11) | (local.getUTCMinutes() << 5) | (local.getUTCSeconds() >> 1),
		date:
			((Math.min(year, 2107) - 1980) << 9) | ((local.getUTCMonth() + 1) << 5) | local.getUTCDate()
	};
}

async function deflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const stream = singleChunk(data).pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Writes the fields a local header (from byte 4) and a central record (from byte 6) share:
 * version needed, flags, method, time, date, CRC-32, sizes, name length, extra length 0.
 */
function writeSharedFields(
	view: DataView,
	at: number,
	fields: EntryFields,
	stamp: { time: number; date: number },
	nameLength: number
) {
	view.setUint16(at, ZIP_VERSION, true);
	view.setUint16(at + 2, fields.flags, true);
	view.setUint16(at + 4, fields.method, true);
	view.setUint16(at + 6, stamp.time, true);
	view.setUint16(at + 8, stamp.date, true);
	view.setUint32(at + 10, fields.crc, true);
	view.setUint32(at + 14, fields.compressedSize, true);
	view.setUint32(at + 18, fields.size, true);
	view.setUint16(at + 22, nameLength, true);
}

/**
 * A ZIP archive of `entries` as a byte stream. The source is pulled one entry at a time,
 * only when the consumer reads past the previous one, so a response streaming it to the
 * network holds about one entry, however many there are. Errors from the source (or a
 * ZipError for a bad name, or for passing the ZIP32 limits) error the stream; what was sent
 * by then lacks its central directory, which unzip tools reject. Cancelling the stream
 * calls the source iterator's `return()`.
 */
export function createZipStream(
	entries: AsyncIterable<ZipEntrySource> | Iterable<ZipEntrySource>,
	options: ZipWriterOptions = {}
): ReadableStream<Uint8Array> {
	const stamp = dosDateTime(options.modified ?? new Date(), options.utcOffsetMinutes ?? 0);
	// One async iterator over either kind of source; `return()` reaches the source through yield*.
	const source = (async function* () {
		yield* entries;
	})();
	const central: Uint8Array[] = [];
	const names = new Set<string>();
	let offset = 0;
	let centralBytes = 0;

	async function writeEntry(
		entry: ZipEntrySource,
		controller: ReadableStreamDefaultController<Uint8Array>
	) {
		if (names.has(entry.name)) {
			throw new ZipError('name', `Duplicate entry name ${JSON.stringify(entry.name)}`);
		}
		const name = encodeEntryName(entry.name);
		if (central.length >= ZIP_MAX_ENTRIES) {
			throw new ZipError(
				'limit',
				`A ZIP archive without ZIP64 holds at most ${ZIP_MAX_ENTRIES} entries`
			);
		}

		let body = entry.data;
		let method = STORE;
		if (entry.compress) {
			const deflated = await deflateRaw(entry.data);
			if (deflated.byteLength < entry.data.byteLength) {
				body = deflated;
				method = DEFLATE;
			}
		}
		const localBytes = LOCAL_HEADER_BYTES + name.byteLength + body.byteLength;
		const centralLength = CENTRAL_HEADER_BYTES + name.byteLength;
		// Checked before the CRC: the archive, finished, must still fit 32-bit sizes and offsets.
		if (offset + localBytes + centralBytes + centralLength + END_BYTES > ZIP_MAX_BYTES) {
			throw new ZipError('limit', 'The archive would pass 4 GiB, which needs ZIP64');
		}
		const fields: EntryFields = {
			flags: FLAG_UTF8,
			method,
			crc: crc32(entry.data),
			compressedSize: body.byteLength,
			size: entry.data.byteLength
		};

		const local = new Uint8Array(LOCAL_HEADER_BYTES + name.byteLength);
		const localView = viewOf(local);
		localView.setUint32(0, LOCAL_FILE_HEADER, true);
		writeSharedFields(localView, 4, fields, stamp, name.byteLength);
		local.set(name, LOCAL_HEADER_BYTES);

		const record = new Uint8Array(centralLength);
		const recordView = viewOf(record);
		recordView.setUint32(0, CENTRAL_DIRECTORY_HEADER, true);
		recordView.setUint16(4, ZIP_VERSION, true); // version made by
		writeSharedFields(recordView, 6, fields, stamp, name.byteLength);
		// Comment length, disk number and attributes stay 0.
		recordView.setUint32(42, offset, true);
		record.set(name, CENTRAL_HEADER_BYTES);

		controller.enqueue(local);
		if (body.byteLength > 0) controller.enqueue(body);
		names.add(entry.name);
		central.push(record);
		offset += localBytes;
		centralBytes += centralLength;
	}

	function writeCentralDirectory(controller: ReadableStreamDefaultController<Uint8Array>) {
		const tail = new Uint8Array(centralBytes + END_BYTES);
		let at = 0;
		for (const record of central) {
			tail.set(record, at);
			at += record.byteLength;
		}
		const end = viewOf(tail.subarray(at));
		end.setUint32(0, END_OF_CENTRAL_DIRECTORY, true);
		// Disk numbers and the comment length stay 0.
		end.setUint16(8, central.length, true);
		end.setUint16(10, central.length, true);
		end.setUint32(12, centralBytes, true);
		end.setUint32(16, offset, true);
		controller.enqueue(tail);
		controller.close();
	}

	return new ReadableStream<Uint8Array>(
		{
			async pull(controller) {
				try {
					const next = await source.next();
					if (next.done) writeCentralDirectory(controller);
					else await writeEntry(next.value, controller);
				} catch (error) {
					try {
						await source.return(undefined);
					} catch {
						// The first error is the one to report.
					}
					throw error;
				}
			},
			async cancel() {
				await source.return(undefined);
			}
		},
		// Pull only for a pending read, so the source runs at most one entry ahead.
		{ highWaterMark: 0 }
	);
}

// --- Reader -------------------------------------------------------------------------

export type ZipReadLimits = {
	/** Bytes read from the stream, headers and central directory included. */
	maxArchiveBytes: number;
	maxEntries: number;
	/** The largest entry, both stored and uncompressed; may depend on the entry's name. */
	maxEntryBytes: number | ((name: string) => number);
	/** The sum of every entry's uncompressed size. */
	maxTotalBytes: number;
};

export type ZipEntry = {
	name: string;
	data: Uint8Array<ArrayBuffer>;
};

type LocalEntry = EntryFields & { name: string };

/** Consumes a byte stream in exact-length reads, whatever its chunk boundaries. */
class ByteReader {
	readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
	readonly #limit: number;
	#chunk: Uint8Array = new Uint8Array(0);
	#at = 0;
	#done = false;
	/** Bytes consumed so far: the offset of the next byte in the archive. */
	position = 0;

	constructor(stream: ReadableStream<Uint8Array>, limit: number) {
		this.#reader = stream.getReader();
		this.#limit = limit;
	}

	/** False once the stream has ended and every byte of it is consumed. */
	async #fill(): Promise<boolean> {
		while (this.#at === this.#chunk.byteLength) {
			if (this.#done) return false;
			const { done, value } = await this.#reader.read();
			if (done) {
				this.#done = true;
				return false;
			}
			this.#chunk = value;
			this.#at = 0;
		}
		return true;
	}

	async #consume(length: number, into: Uint8Array | null): Promise<void> {
		if (this.position + length > this.#limit) {
			throw new ZipError('limit', `The archive is over ${this.#limit} bytes`);
		}
		for (let copied = 0; copied < length;) {
			if (!(await this.#fill())) throw new ZipError('truncated', 'The archive ends early');
			const take = Math.min(length - copied, this.#chunk.byteLength - this.#at);
			into?.set(this.#chunk.subarray(this.#at, this.#at + take), copied);
			this.#at += take;
			copied += take;
		}
		this.position += length;
	}

	async read(length: number): Promise<Uint8Array<ArrayBuffer>> {
		const bytes = new Uint8Array(length);
		await this.#consume(length, bytes);
		return bytes;
	}

	skip(length: number): Promise<void> {
		return this.#consume(length, null);
	}

	async fields(length: number): Promise<DataView> {
		return viewOf(await this.read(length));
	}

	async atEnd(): Promise<boolean> {
		return !(await this.#fill());
	}

	/** Cancels whatever of the stream is left unread, and lets go of it. */
	async close(): Promise<void> {
		if (!this.#done) await this.#reader.cancel().catch(() => {});
		this.#reader.releaseLock();
	}
}

const nameDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function decodeEntryName(bytes: Uint8Array): string {
	let name = '';
	try {
		name = nameDecoder.decode(bytes);
	} catch {
		// Reported below with the empty name.
	}
	if (name === '') throw new ZipError('name', 'An entry name is empty or not valid UTF-8');
	return name;
}

function checkFlags(flags: number) {
	if (flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION | FLAG_ENCRYPTED_DIRECTORY)) {
		throw new ZipError('unsupported', 'Encrypted ZIP entries are not supported');
	}
	if (flags & FLAG_DATA_DESCRIPTOR) {
		throw new ZipError('unsupported', 'ZIP entries with a data descriptor are not supported');
	}
	if (flags & ~(FLAG_UTF8 | FLAG_DEFLATE_LEVEL)) {
		throw new ZipError('unsupported', `Unsupported ZIP flags 0x${flags.toString(16)}`);
	}
}

const isZip64Marker = (value: number) => value === 0xffffffff;

/** The local header after its signature, with the name; leaves the reader at the entry's data. */
async function readLocalHeader(input: ByteReader): Promise<LocalEntry> {
	const view = await input.fields(LOCAL_HEADER_BYTES - 4);
	const fields: EntryFields = {
		flags: view.getUint16(2, true),
		method: view.getUint16(4, true),
		crc: view.getUint32(10, true),
		compressedSize: view.getUint32(14, true),
		size: view.getUint32(18, true)
	};
	checkFlags(fields.flags);
	if (fields.method !== STORE && fields.method !== DEFLATE) {
		throw new ZipError('unsupported', `Unsupported ZIP compression method ${fields.method}`);
	}
	if (isZip64Marker(fields.compressedSize) || isZip64Marker(fields.size)) {
		throw new ZipError('unsupported', 'ZIP64 archives are not supported');
	}
	if (fields.method === STORE && fields.compressedSize !== fields.size) {
		throw new ZipError('corrupt', 'A stored ZIP entry has two different sizes');
	}
	const name = decodeEntryName(await input.read(view.getUint16(22, true)));
	await input.skip(view.getUint16(24, true)); // extra field: nothing in it is needed
	return { ...fields, name };
}

/** Inflates raw deflate data that must come to exactly `size` bytes, stopping at the first byte past it. */
async function inflateRaw(
	compressed: Uint8Array<ArrayBuffer>,
	size: number
): Promise<Uint8Array<ArrayBuffer>> {
	const output = new Uint8Array(size);
	const reader = singleChunk(compressed)
		.pipeThrough(new DecompressionStream('deflate-raw'))
		.getReader();
	let length = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (length + value.byteLength > size) {
				throw new ZipError('corrupt', 'A ZIP entry inflates past its declared size');
			}
			output.set(value, length);
			length += value.byteLength;
		}
	} catch (error) {
		await reader.cancel().catch(() => {});
		if (error instanceof ZipError) throw error;
		throw new ZipError('corrupt', 'A ZIP entry holds invalid deflate data', { cause: error });
	}
	if (length !== size) {
		throw new ZipError('corrupt', 'A ZIP entry inflates short of its declared size');
	}
	return output;
}

/** A central directory record after its signature, checked against the local header it names. */
async function readCentralRecord(
	input: ByteReader,
	entries: Map<number, LocalEntry>,
	matched: Set<number>
): Promise<void> {
	const view = await input.fields(CENTRAL_HEADER_BYTES - 4);
	const compressedSize = view.getUint32(16, true);
	const size = view.getUint32(20, true);
	const localOffset = view.getUint32(38, true);
	if ([compressedSize, size, localOffset].some(isZip64Marker)) {
		throw new ZipError('unsupported', 'ZIP64 archives are not supported');
	}
	const name = decodeEntryName(await input.read(view.getUint16(24, true)));
	await input.skip(view.getUint16(26, true) + view.getUint16(28, true)); // extra field, comment

	const local = entries.get(localOffset);
	const same =
		local !== undefined &&
		!matched.has(localOffset) &&
		view.getUint16(30, true) === 0 && // starting disk
		local.name === name &&
		local.flags === view.getUint16(4, true) &&
		local.method === view.getUint16(6, true) &&
		local.crc === view.getUint32(12, true) &&
		local.compressedSize === compressedSize &&
		local.size === size;
	if (!same) {
		throw new ZipError(
			'corrupt',
			`The ZIP central directory does not match ${JSON.stringify(name)}`
		);
	}
	matched.add(localOffset);
}

/**
 * The entries of a ZIP archive read from a stream, in order, each with its bytes in full
 * (so one at a time is held, up to `maxEntryBytes`). Sizes are checked against `limits`
 * from the local header before an entry's data is read, and every entry's CRC-32 and size
 * are verified. Stopping early cancels the rest of the stream.
 *
 * Entries are yielded before the end of the archive is reached, and a truncated or altered
 * archive can only show at its central directory, so whatever is done with them stays
 * provisional until the loop finishes without throwing a ZipError.
 */
export async function* readZip(
	body: ReadableStream<Uint8Array>,
	limits: ZipReadLimits
): AsyncGenerator<ZipEntry, void, undefined> {
	const input = new ByteReader(body, limits.maxArchiveBytes);
	const entries = new Map<number, LocalEntry>(); // by local header offset
	const names = new Set<string>();
	let totalBytes = 0;
	try {
		let signature = (await input.fields(4)).getUint32(0, true);
		if (signature !== LOCAL_FILE_HEADER && signature !== END_OF_CENTRAL_DIRECTORY) {
			throw new ZipError('corrupt', 'Not a ZIP archive');
		}

		while (signature === LOCAL_FILE_HEADER) {
			const offset = input.position - 4;
			const entry = await readLocalHeader(input);
			if (names.has(entry.name)) {
				throw new ZipError('name', `Duplicate ZIP entry name ${JSON.stringify(entry.name)}`);
			}
			if (entries.size >= limits.maxEntries) {
				throw new ZipError('limit', `The archive has more than ${limits.maxEntries} entries`);
			}
			const entryLimit =
				typeof limits.maxEntryBytes === 'function'
					? limits.maxEntryBytes(entry.name)
					: limits.maxEntryBytes;
			if (entry.size > entryLimit || entry.compressedSize > entryLimit) {
				throw new ZipError('limit', `${JSON.stringify(entry.name)} is over ${entryLimit} bytes`);
			}
			if (totalBytes + entry.size > limits.maxTotalBytes) {
				throw new ZipError(
					'limit',
					`The archive's entries come to over ${limits.maxTotalBytes} bytes`
				);
			}

			const stored = await input.read(entry.compressedSize);
			const data = entry.method === DEFLATE ? await inflateRaw(stored, entry.size) : stored;
			if (crc32(data) !== entry.crc) {
				throw new ZipError('corrupt', `CRC-32 mismatch in ${JSON.stringify(entry.name)}`);
			}
			names.add(entry.name);
			entries.set(offset, entry);
			totalBytes += entry.size;
			yield { name: entry.name, data };
			signature = (await input.fields(4)).getUint32(0, true);
		}

		const centralOffset = input.position - 4;
		const matched = new Set<number>();
		while (signature === CENTRAL_DIRECTORY_HEADER) {
			await readCentralRecord(input, entries, matched);
			signature = (await input.fields(4)).getUint32(0, true);
		}
		if (signature === ZIP64_END_OF_CENTRAL_DIRECTORY || signature === ZIP64_END_LOCATOR) {
			throw new ZipError('unsupported', 'ZIP64 archives are not supported');
		}
		if (signature !== END_OF_CENTRAL_DIRECTORY) {
			throw new ZipError('corrupt', `Unexpected ZIP record at byte ${input.position - 4}`);
		}

		const centralSize = input.position - 4 - centralOffset;
		const end = await input.fields(END_BYTES - 4);
		const [disk, centralDisk, diskEntries, totalEntries] = [0, 2, 4, 6].map((at) =>
			end.getUint16(at, true)
		);
		if (disk !== 0 || centralDisk !== 0) {
			throw new ZipError('unsupported', 'Multi-disk ZIP archives are not supported');
		}
		const consistent =
			matched.size === entries.size &&
			diskEntries === entries.size &&
			totalEntries === entries.size &&
			end.getUint32(8, true) === centralSize &&
			end.getUint32(12, true) === centralOffset;
		if (!consistent) {
			throw new ZipError('corrupt', 'The ZIP end record does not match the central directory');
		}
		await input.skip(end.getUint16(16, true)); // archive comment
		if (!(await input.atEnd())) {
			throw new ZipError('corrupt', 'Unexpected data after the end of the ZIP archive');
		}
	} finally {
		await input.close();
	}
}
