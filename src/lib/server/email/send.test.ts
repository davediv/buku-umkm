import { afterEach, describe, expect, it, vi } from 'vitest';
import { passwordResetEmail } from './messages';
import { EMAIL_SENDER_NAME, sendEmail, type EmailBinding } from './send';

const TOKEN = 'tok3n-sangat-rahasia';
const RECIPIENT = 'ayu.lestari@example.com';
const message = passwordResetEmail(`https://buku.test/atur-ulang-kata-sandi?token=${TOKEN}`, 3600);

function fakeBinding(send: EmailBinding['send'] = async () => ({ messageId: 'msg-1' })) {
	return { send: vi.fn(send) };
}

function loggedText(spy: ReturnType<typeof vi.spyOn>): string {
	return spy.mock.calls.flat().map(String).join(' ');
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('sendEmail', () => {
	it('sends the built message from the configured sender', async () => {
		const binding = fakeBinding();

		const sent = await sendEmail({ binding, from: ' noreply@buku.test ' }, RECIPIENT, message);

		expect(sent).toBe(true);
		expect(binding.send).toHaveBeenCalledWith({
			to: RECIPIENT,
			from: { email: 'noreply@buku.test', name: EMAIL_SENDER_NAME },
			subject: message.subject,
			text: message.text,
			html: message.html
		});
	});

	it('reports a missing binding without throwing', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});

		expect(await sendEmail({ from: 'noreply@buku.test' }, RECIPIENT, message)).toBe(false);
		expect(loggedText(log)).toContain('EMAIL send_email binding is not configured');
	});

	it.each([undefined, '', 'Buku UMKM', 'noreply@'])(
		'refuses to send without a valid EMAIL_FROM (%s)',
		async (from) => {
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			const binding = fakeBinding();

			expect(await sendEmail({ binding, from }, RECIPIENT, message)).toBe(false);
			expect(binding.send).not.toHaveBeenCalled();
			expect(loggedText(log)).toContain('EMAIL_FROM');
		}
	);

	it('logs a refused send by its code, without the address, link or token', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const binding = fakeBinding(async () => {
			throw Object.assign(new Error(`recipient ${RECIPIENT} is not allowed`), {
				code: 'E_RECIPIENT_NOT_ALLOWED'
			});
		});

		expect(await sendEmail({ binding, from: 'noreply@buku.test' }, RECIPIENT, message)).toBe(false);

		const logged = loggedText(log);
		expect(logged).toContain('password-reset');
		expect(logged).toContain('E_RECIPIENT_NOT_ALLOWED');
		for (const secret of [RECIPIENT, 'ayu.lestari', TOKEN, 'atur-ulang-kata-sandi']) {
			expect(logged).not.toContain(secret);
		}
	});
});
