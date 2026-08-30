import { describe, expect, it, vi } from 'vitest';
import { uploadAttachments } from './transaction-attachments';

describe('transaction attachment uploads', () => {
	it('reports partial success without losing failed attachments', async () => {
		const attachments = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
		const upload = vi.fn(async (attachment: { id: string }) => {
			if (attachment.id === 'two') throw new Error('Penyimpanan foto tidak tersedia');
		});

		const result = await uploadAttachments(attachments, upload);

		expect(result.succeeded.map((item) => item.id)).toEqual(['one', 'three']);
		expect(result.failed).toEqual([
			{
				attachment: { id: 'two' },
				error: 'Penyimpanan foto tidak tersedia'
			}
		]);
		expect(upload).toHaveBeenCalledTimes(3);
	});
});
