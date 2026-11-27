import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	NPWP_ENCRYPTION_KEY: 'test-only-npwp-key-0123456789abcdef'
}));
vi.mock('#lib/server/db/index.ts', () => ({ getDb: () => ({}) }));
const profileRef = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('#lib/server/db/queries/index.ts', () => ({
	businessProfileQueries: { findByUserId: async () => profileRef.current }
}));

// The Workers runtime exposes Web Crypto on `self`; Node only on globalThis.
vi.stubGlobal('self', globalThis);

const { encryptNPWP } = await import('#lib/server/crypto.ts');
const { load } = await import('./+page.server');

type LoadResult = {
	catatan: {
		businessProfile: { npwp: string | null } | null;
		notesSections: { content: string }[];
	} | null;
};

async function loadNotes() {
	return (await load({
		locals: { user: { id: 'owner' }, session: { id: 'session' } },
		url: new URL('https://buku.test/laporan/catatan')
	} as unknown as Parameters<typeof load>[0])) as LoadResult;
}

function profileWith(npwp: string | null) {
	return {
		name: 'Warung Maju',
		address: 'Jl. Melati 1',
		phone: null,
		npwp,
		businessType: 'warung_makan',
		ownerName: 'Sari'
	};
}

let ciphertext: string;

beforeAll(async () => {
	ciphertext = await encryptNPWP('012345678901234');
});

describe('notes page NPWP', () => {
	it('sends the decrypted, formatted NPWP and never the ciphertext', async () => {
		profileRef.current = profileWith(ciphertext);

		const result = await loadNotes();

		expect(result.catatan?.businessProfile?.npwp).toBe('01.234.567.8-901.234');
		expect(JSON.stringify(result)).not.toContain(ciphertext);
	});

	it('sends no NPWP when the stored value cannot be decrypted', async () => {
		profileRef.current = profileWith('bm90LWEtdmFsaWQtY2lwaGVydGV4dA==');
		vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await loadNotes();

		expect(result.catatan?.businessProfile?.npwp).toBeNull();
		expect(JSON.stringify(result)).not.toContain('bm90LWEtdmFsaWQtY2lwaGVydGV4dA==');
	});

	it('sends no NPWP when none is stored', async () => {
		profileRef.current = profileWith(null);

		expect((await loadNotes()).catatan?.businessProfile?.npwp).toBeNull();
	});
});

describe('notes page business description', () => {
	it('names the business type by its label, not its stored code', async () => {
		profileRef.current = profileWith(null);

		const text = JSON.stringify((await loadNotes()).catatan?.notesSections);

		expect(text).toContain('adalah usaha Warung Makan/Restoran');
		expect(text).not.toContain('warung_makan');
	});
});
