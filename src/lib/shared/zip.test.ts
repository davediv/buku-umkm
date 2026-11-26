import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { crc32 as zlibCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
	crc32,
	createZipStream,
	readZip,
	ZIP_MAX_ENTRIES,
	ZipError,
	type ZipEntry,
	type ZipEntrySource,
	type ZipReadLimits
} from './zip';

const LIMITS: ZipReadLimits = {
	maxArchiveBytes: 2 ** 30,
	maxEntries: 1000,
	maxEntryBytes: 2 ** 26,
	maxTotalBytes: 2 ** 30
};

/** mulberry32: a small seeded generator, so a failing case can be replayed. */
function prng(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
	};
}

function randomBytes(length: number, seed: number): Uint8Array<ArrayBuffer> {
	const next = prng(seed);
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) bytes[i] = next() * 256;
	return bytes;
}

const utf8 = (text: string) => new TextEncoder().encode(text);

async function bytesOf(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

const zipOf = (entries: ZipEntrySource[]) => bytesOf(createZipStream(entries));

/** `bytes` as a stream of chunks sized by `nextSize`, counting what has been pulled. */
function chunked(bytes: Uint8Array, nextSize: () => number = () => bytes.length) {
	const progress = { pulled: 0, cancelled: false };
	const stream = new ReadableStream<Uint8Array>(
		{
			pull(controller) {
				if (progress.pulled >= bytes.length) return controller.close();
				const size = Math.max(1, Math.floor(nextSize()));
				controller.enqueue(bytes.slice(progress.pulled, progress.pulled + size));
				progress.pulled = Math.min(bytes.length, progress.pulled + size);
			},
			cancel() {
				progress.cancelled = true;
			}
		},
		{ highWaterMark: 0 }
	);
	return Object.assign(stream, { progress });
}

async function readAll(stream: ReadableStream<Uint8Array>, limits = LIMITS): Promise<ZipEntry[]> {
	const entries: ZipEntry[] = [];
	for await (const entry of readZip(stream, limits)) entries.push(entry);
	return entries;
}

async function zipErrorOf(work: Promise<unknown>): Promise<ZipError> {
	try {
		await work;
	} catch (error) {
		if (error instanceof ZipError) return error;
		throw error;
	}
	throw new Error('Expected a ZipError');
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const centralDirectoryOffset = (zip: Uint8Array) => view(zip).getUint32(zip.length - 22 + 16, true);

/** V8's full GC, so memoryUsage() counts only live buffers (`--expose-gc`, set at run time). */
function fullGc(): () => void {
	setFlagsFromString('--expose-gc');
	return runInNewContext('gc') as () => void;
}

const hasCommand = (command: string) =>
	spawnSync(command, ['-v'], { stdio: 'ignore' }).status === 0;

/** A JSON document like a backup's: compressible, with non-ASCII text. */
const backupJson = utf8(
	JSON.stringify({
		format: 'buku-umkm-backup',
		transactions: Array.from({ length: 400 }, (_, i) => ({
			id: `txn-${i}`,
			description: `Pembelian bahan baku — nota #${i}`,
			amount: i * 1250
		}))
	})
);

function sampleEntries(): ZipEntrySource[] {
	return [
		{ name: 'backup.json', data: backupJson, compress: true },
		{ name: 'photos/0b6a2e4c.jpg', data: randomBytes(3000, 1) },
		{ name: 'photos/kuitansi-ñ-日本.png', data: randomBytes(2000, 2) },
		{ name: 'photos/empty.jpg', data: new Uint8Array(0) }
	];
}

describe('crc32', () => {
	it('matches zlib for every length around the 8-byte stride, and the standard check value', () => {
		const data = randomBytes(70, 7);
		for (let length = 0; length <= data.length; length++) {
			const slice = data.subarray(0, length);
			expect(crc32(slice)).toBe(zlibCrc32(slice));
		}
		const large = randomBytes(400 * 1024 + 3, 8);
		expect(crc32(large)).toBe(zlibCrc32(large));
		expect(crc32(utf8('123456789'))).toBe(0xcbf43926);
	});
});

describe('createZipStream and readZip', () => {
	it('round-trips many entries through random chunk boundaries', async () => {
		const sizes = prng(11);
		const entries: ZipEntrySource[] = [
			{ name: 'backup.json', data: backupJson, compress: true },
			...Array.from({ length: 150 }, (_, i) => ({
				name: `photos/${crypto.randomUUID()}.${i % 3 ? 'jpg' : 'png'}`,
				data: randomBytes(Math.floor(sizes() * 40_000), 100 + i)
			}))
		];
		const zip = await zipOf(entries);

		for (const seed of [1, 2, 3]) {
			const next = prng(seed);
			const read = await readAll(chunked(zip, () => 1 + next() * 9000));
			expect(read.map((entry) => entry.name)).toEqual(entries.map((entry) => entry.name));
			// Buffer.compare: toEqual walks typed arrays element by element, seconds for 3 MB.
			read.forEach((entry, i) => {
				expect(Buffer.compare(entry.data, entries[i].data), entry.name).toBe(0);
			});
		}
	});

	it('reads an archive delivered one byte at a time', async () => {
		const entries = sampleEntries();
		const read = await readAll(chunked(await zipOf(entries), () => 1));
		expect(read).toEqual(entries.map(({ name, data }) => ({ name, data })));
	});

	it('deflates only the entries it is asked to, and only when that is smaller', async () => {
		const zip = await zipOf([
			{ name: 'backup.json', data: backupJson, compress: true },
			{ name: 'noise.bin', data: randomBytes(5000, 3), compress: true }
		]);
		const header = view(zip);
		expect(header.getUint16(8, true)).toBe(8); // DEFLATE
		const compressedSize = header.getUint32(18, true);
		expect(compressedSize).toBeLessThan(backupJson.length / 4);

		const second = view(zip.subarray(30 + 'backup.json'.length + compressedSize));
		expect(second.getUint32(0, true)).toBe(0x04034b50);
		expect(second.getUint16(8, true)).toBe(0); // STORE: deflate would not have helped
		expect(second.getUint32(18, true)).toBe(5000);
	});

	it('marks names as UTF-8 and stamps the DOS time in the given offset', async () => {
		const zip = await bytesOf(
			createZipStream([{ name: 'photos/nota-ñ.jpg', data: utf8('x') }], {
				modified: new Date('2026-11-27T03:04:06Z'),
				utcOffsetMinutes: 7 * 60
			})
		);
		const header = view(zip);
		expect(header.getUint16(6, true) & 0x0800).toBe(0x0800);
		expect(header.getUint16(10, true)).toBe((10 << 11) | (4 << 5) | 3); // 10:04:06 WIB
		expect(header.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (11 << 5) | 27);
		expect(new TextDecoder().decode(zip.subarray(30, 30 + header.getUint16(26, true)))).toBe(
			'photos/nota-ñ.jpg'
		);
	});

	it('writes and reads an empty archive', async () => {
		const zip = await zipOf([]);
		expect(zip.length).toBe(22);
		expect(await readAll(chunked(zip))).toEqual([]);
	});

	it.skipIf(!hasCommand('unzip'))('writes archives that pass unzip -t', async () => {
		const entries = sampleEntries();
		const dir = mkdtempSync(join(tmpdir(), 'buku-umkm-zip-'));
		try {
			const path = join(dir, 'backup.zip');
			writeFileSync(path, await zipOf(entries));

			const test = spawnSync('unzip', ['-t', path], { encoding: 'utf8' });
			expect(test.status, test.stdout + test.stderr).toBe(0);
			expect(test.stdout).toContain('No errors detected');

			// Apple's unzip 6.00 predates UTF-8 names and garbles them (Python's zipfile, bsdtar
			// and ditto read them), so only the ASCII names are compared.
			const listed = spawnSync('unzip', ['-Z1', path], { encoding: 'utf8' }).stdout.split('\n');
			entries.forEach((entry, i) => {
				if (/^[\x20-\x7e]+$/.test(entry.name)) expect(listed[i]).toBe(entry.name);
			});
			expect(listed.filter(Boolean)).toHaveLength(entries.length);

			const json = spawnSync('unzip', ['-p', path, 'backup.json']);
			expect(new Uint8Array(json.stdout)).toEqual(backupJson);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it.skipIf(!hasCommand('zip'))('reads archives written by Info-ZIP zip', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'buku-umkm-zip-'));
		try {
			const text = backupJson;
			const binary = randomBytes(20_000, 4);
			writeFileSync(join(dir, 'a.json'), text);
			writeFileSync(join(dir, 'b.bin'), binary);
			// Extra fields (timestamps, Unix ids) stay in, so the reader has to skip them.
			const made = spawnSync('zip', ['-q', '-D', 'archive.zip', 'a.json', 'b.bin'], { cwd: dir });
			expect(made.status).toBe(0);
			const zip = new Uint8Array(readFileSync(join(dir, 'archive.zip')));
			expect(view(zip).getUint16(8, true)).toBe(8); // a.json was deflated

			const read = await readAll(chunked(zip, () => 777));
			expect(read).toEqual([
				{ name: 'a.json', data: text },
				{ name: 'b.bin', data: binary }
			]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe('streaming', () => {
	it('pulls the next entry only when the consumer reads past the previous one', async () => {
		let produced = 0;
		const stream = createZipStream(
			(function* () {
				for (let i = 0; i < 3; i++) {
					produced++;
					yield { name: `photos/${i}.jpg`, data: randomBytes(100, i) };
				}
			})()
		);
		expect(produced).toBe(0);
		const reader = stream.getReader();
		await reader.read(); // first local header
		await reader.read(); // first entry's data
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(produced).toBe(1);
		await reader.read();
		expect(produced).toBe(2);
		await reader.cancel();
	});

	it('holds one entry at a time end to end: 300 entries of 400 KB', async () => {
		const count = 300;
		const size = 400 * 1024;
		let produced = 0;
		let consumed = 0;
		let mostAhead = 0;
		const gc = fullGc();
		gc();
		const baseline = process.memoryUsage().arrayBuffers;
		let mostLive = 0;
		async function* photos(): AsyncGenerator<ZipEntrySource> {
			for (let i = 0; i < count; i++) {
				produced++;
				mostAhead = Math.max(mostAhead, produced - consumed);
				const data = new Uint8Array(size).fill(i & 0xff);
				data[0] = i >> 8;
				yield { name: `photos/${i}.jpg`, data };
			}
		}

		for await (const entry of readZip(createZipStream(photos()), LIMITS)) {
			expect(entry.name).toBe(`photos/${consumed}.jpg`);
			expect(entry.data.length).toBe(size);
			expect([entry.data[0], entry.data[size - 1]]).toEqual([consumed >> 8, consumed & 0xff]);
			consumed++;
			if (consumed % 20 === 0) {
				gc();
				mostLive = Math.max(mostLive, process.memoryUsage().arrayBuffers - baseline);
			}
		}

		expect(consumed).toBe(count);
		// The writer asked for entry k + 1 only after the reader had handed over entry k.
		expect(mostAhead).toBe(1);
		// Live buffers mid-stream, after a full GC: a few entries' worth (the runner's own
		// buffers included), against the 120 MB that went through.
		expect(mostLive).toBeLessThan(16 * 1024 * 1024);
	});

	it('errors the stream with the source error, and closes the source when cancelled', async () => {
		const failing = createZipStream(
			(async function* () {
				yield { name: 'backup.json', data: backupJson };
				throw new Error('R2 is down');
			})()
		);
		await expect(bytesOf(failing)).rejects.toThrow('R2 is down');

		let closed = false;
		const cancelled = createZipStream(
			(async function* () {
				try {
					for (let i = 0; ; i++) yield { name: `photos/${i}.jpg`, data: randomBytes(10, i) };
				} finally {
					closed = true;
				}
			})()
		);
		const reader = cancelled.getReader();
		await reader.read();
		await reader.cancel();
		expect(closed).toBe(true);
	});

	it('cancels the rest of the input when the consumer stops early', async () => {
		const input = chunked(await zipOf(sampleEntries()), () => 100);
		for await (const entry of readZip(input, LIMITS)) {
			expect(entry.name).toBe('backup.json');
			break;
		}
		expect(input.progress.cancelled).toBe(true);
		expect(input.locked).toBe(false);
	});
});

describe('createZipStream refuses', () => {
	it.each([
		'',
		'/abs.jpg',
		'photos/../x.jpg',
		'./x.jpg',
		'a\\b.jpg',
		'a//b.jpg',
		'photos/',
		'a\0b'
	])('the unsafe name %j', async (name) => {
		expect((await zipErrorOf(zipOf([{ name, data: utf8('x') }]))).code).toBe('name');
	});

	it('a repeated name', async () => {
		const entry = { name: 'photos/a.jpg', data: utf8('x') };
		expect((await zipErrorOf(zipOf([entry, entry]))).code).toBe('name');
	});

	it('more entries than ZIP32 can count', async () => {
		const empty = new Uint8Array(0);
		const error = await zipErrorOf(
			bytesOf(
				createZipStream(
					(function* () {
						for (let i = 0; i <= ZIP_MAX_ENTRIES; i++) yield { name: `${i}`, data: empty };
					})()
				)
			)
		);
		expect(error.code).toBe('limit');
	});

	it('an archive past 4 GiB, before reading the entry', async () => {
		// Zero-filled lazily by the allocator: refused on its length, never touched.
		const huge = new Uint8Array(2 ** 32);
		const error = await zipErrorOf(zipOf([{ name: 'photos/huge.jpg', data: huge }]));
		expect(error.code).toBe('limit');
		expect(error.message).toContain('4 GiB');
	});
});

describe('readZip refuses', () => {
	/** An archive whose first entry is stored, so its header and data sit at known offsets. */
	async function storedFirst() {
		const name = 'photos/a.jpg';
		const zip = await zipOf([
			{ name, data: randomBytes(500, 5) },
			{ name: 'photos/b.jpg', data: randomBytes(300, 6) }
		]);
		return { zip, dataAt: 30 + name.length };
	}

	it('a CRC-32 mismatch', async () => {
		const { zip, dataAt } = await storedFirst();
		zip[dataAt + 10] ^= 0xff;
		const error = await zipErrorOf(readAll(chunked(zip)));
		expect(error.code).toBe('corrupt');
		expect(error.message).toContain('CRC-32');
	});

	it('damaged deflate data', async () => {
		const zip = await zipOf([{ name: 'backup.json', data: backupJson, compress: true }]);
		zip[30 + 'backup.json'.length + 20] ^= 0x55;
		expect((await zipErrorOf(readAll(chunked(zip)))).code).toBe('corrupt');
	});

	it('an entry that inflates past its declared size', async () => {
		const zip = await zipOf([{ name: 'zeros.bin', data: new Uint8Array(100_000), compress: true }]);
		view(zip).setUint32(22, 1000, true); // local header
		view(zip).setUint32(centralDirectoryOffset(zip) + 24, 1000, true); // central record
		const error = await zipErrorOf(readAll(chunked(zip)));
		expect(error.code).toBe('corrupt');
		expect(error.message).toContain('past its declared size');
	});

	it('input cut short at any byte', async () => {
		const zip = await zipOf([
			{ name: 'backup.json', data: backupJson.subarray(0, 600), compress: true },
			{ name: 'photos/a.jpg', data: randomBytes(100, 1) },
			{ name: 'photos/ñ.png', data: randomBytes(50, 2) },
			{ name: 'photos/empty.jpg', data: new Uint8Array(0) }
		]);
		const codes = new Set<string>();
		for (let length = 0; length < zip.length; length++) {
			const error = await zipErrorOf(readAll(chunked(zip.subarray(0, length), () => 64)));
			codes.add(error.code);
		}
		// A cut inside a name or a deflate stream can also read as corrupt.
		expect([...codes].every((code) => code === 'truncated' || code === 'corrupt')).toBe(true);

		// Cut right after the last entry: everything yielded was intact, the end is missing.
		const cut = zip.subarray(0, centralDirectoryOffset(zip));
		const yielded: string[] = [];
		const error = await zipErrorOf(
			(async () => {
				for await (const entry of readZip(chunked(cut), LIMITS)) yielded.push(entry.name);
			})()
		);
		expect(error.code).toBe('truncated');
		expect(yielded).toHaveLength(4);
	});

	it('data after the end record', async () => {
		const zip = await zipOf(sampleEntries());
		const padded = new Uint8Array(zip.length + 1);
		padded.set(zip);
		expect((await zipErrorOf(readAll(chunked(padded)))).code).toBe('corrupt');
	});

	it('a central directory that disagrees with the entries', async () => {
		const { zip } = await storedFirst();
		view(zip).setUint32(centralDirectoryOffset(zip) + 16, 0x12345678, true); // its CRC-32
		const error = await zipErrorOf(readAll(chunked(zip)));
		expect(error.code).toBe('corrupt');
		expect(error.message).toContain('central directory');
	});

	it('something that is not a ZIP archive', async () => {
		const error = await zipErrorOf(readAll(chunked(backupJson)));
		expect(error.code).toBe('corrupt');
		expect(error.message).toBe('Not a ZIP archive');
	});

	it('a repeated name', async () => {
		const { zip } = await storedFirst();
		// Rename photos/b.jpg to photos/a.jpg in its local header and central record.
		const b = utf8('photos/b.jpg');
		for (let at = 0; at <= zip.length - b.length; at++) {
			if (b.every((byte, i) => zip[at + i] === byte)) zip[at + 'photos/'.length] = 0x61;
		}
		expect((await zipErrorOf(readAll(chunked(zip)))).code).toBe('name');
	});

	it.each([
		['encryption', (header: DataView) => header.setUint16(6, 0x0801, true), 'Encrypted'],
		['a data descriptor', (header: DataView) => header.setUint16(6, 0x0808, true), 'descriptor'],
		['another method', (header: DataView) => header.setUint16(8, 12, true), 'method 12'],
		['ZIP64 sizes', (header: DataView) => header.setUint32(18, 0xffffffff, true), 'ZIP64']
	])('%s', async (_feature, patch, message) => {
		const { zip } = await storedFirst();
		patch(view(zip));
		const error = await zipErrorOf(readAll(chunked(zip)));
		expect(error.code).toBe('unsupported');
		expect(error.message).toContain(message);
	});
});

describe('readZip limits', () => {
	const limits = (overrides: Partial<ZipReadLimits>): ZipReadLimits => ({
		...LIMITS,
		...overrides
	});

	it('the number of entries', async () => {
		const zip = await zipOf(sampleEntries());
		const read: string[] = [];
		const error = await zipErrorOf(
			(async () => {
				for await (const entry of readZip(chunked(zip), limits({ maxEntries: 2 }))) {
					read.push(entry.name);
				}
			})()
		);
		expect(error.code).toBe('limit');
		expect(read).toHaveLength(2);
	});

	it('the size of one entry, before reading its data', async () => {
		const zip = await zipOf([{ name: 'photos/big.jpg', data: randomBytes(100_000, 9) }]);
		const input = chunked(zip, () => 1024);
		const error = await zipErrorOf(readAll(input, limits({ maxEntryBytes: 50_000 })));
		expect(error.code).toBe('limit');
		expect(input.progress.pulled).toBeLessThanOrEqual(1024);
	});

	it('a size limit that depends on the entry name', async () => {
		const maxEntryBytes = (name: string) => (name === 'backup.json' ? 1_000_000 : 2500);
		const fits = await zipOf([
			{ name: 'backup.json', data: backupJson },
			{ name: 'photos/a.jpg', data: randomBytes(2500, 1) }
		]);
		expect(await readAll(chunked(fits), limits({ maxEntryBytes }))).toHaveLength(2);

		const tooBig = await zipOf([
			{ name: 'backup.json', data: backupJson },
			{ name: 'photos/a.jpg', data: randomBytes(2501, 1) }
		]);
		const error = await zipErrorOf(readAll(chunked(tooBig), limits({ maxEntryBytes })));
		expect(error.code).toBe('limit');
		expect(error.message).toContain('photos/a.jpg');
	});

	it('the total of the entries, counted uncompressed', async () => {
		const zip = await zipOf([{ name: 'backup.json', data: backupJson, compress: true }]);
		expect(zip.length).toBeLessThan(backupJson.length / 4);
		const error = await zipErrorOf(
			readAll(chunked(zip), limits({ maxTotalBytes: backupJson.length - 1 }))
		);
		expect(error.code).toBe('limit');
	});

	it('the size of the archive', async () => {
		const zip = await zipOf(sampleEntries());
		expect(await readAll(chunked(zip), limits({ maxArchiveBytes: zip.length }))).toHaveLength(4);
		const error = await zipErrorOf(
			readAll(chunked(zip), limits({ maxArchiveBytes: zip.length - 1 }))
		);
		expect(error.code).toBe('limit');
	});
});
