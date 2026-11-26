import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import type { EmailMessage } from './messages';

/**
 * Sends account email through Cloudflare Email Service: the `EMAIL` send_email binding in
 * wrangler.jsonc, from the address in EMAIL_FROM (a domain onboarded to Email Sending).
 *
 * Sending never throws. A missing binding or sender, or a refused send, is logged and reported
 * as `false`, so the request that triggered the email still gets its normal answer. Logs name
 * the kind of message only: never the recipient, the link or its token.
 */

export const EMAIL_SENDER_NAME = 'Buku UMKM';

/** The part of the `SendEmail` binding this module uses (the structured builder form). */
export interface EmailBinding {
	send(message: EmailMessageBuilder): Promise<unknown>;
}

export interface EmailTransport {
	binding?: EmailBinding;
	/** The sender address, e.g. noreply@example.com. */
	from?: string;
}

const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const ANY_EMAIL_ADDRESS = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g;

/** The binding's error code and message, with any address in the message redacted. */
function describeSendError(error: unknown): string {
	const code =
		error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
			? error.code
			: error instanceof TypeError
				? 'TypeError'
				: 'UNKNOWN';
	const message = error instanceof Error ? error.message : String(error);
	return `${code}: ${message.replace(ANY_EMAIL_ADDRESS, '[alamat]').slice(0, 200)}`;
}

export async function sendEmail(
	transport: EmailTransport,
	to: string,
	message: EmailMessage
): Promise<boolean> {
	if (!transport.binding) {
		console.error(
			`Email "${message.kind}" not sent: the EMAIL send_email binding is not configured in wrangler.jsonc.`
		);
		return false;
	}
	const from = transport.from?.trim();
	if (!from || !EMAIL_ADDRESS.test(from)) {
		console.error(
			`Email "${message.kind}" not sent: EMAIL_FROM must be a sender address on a domain onboarded to Cloudflare Email Sending.`
		);
		return false;
	}

	try {
		await transport.binding.send({
			to,
			from: { email: from, name: EMAIL_SENDER_NAME },
			subject: message.subject,
			text: message.text,
			html: message.html
		});
		return true;
	} catch (error) {
		console.error(`Email "${message.kind}" not sent: ${describeSendError(error)}`);
		return false;
	}
}

/** The binding and sender of the request being handled. */
export function requestEmailTransport(): EmailTransport {
	let binding: SendEmail | undefined;
	try {
		binding = getRequestEvent().platform?.env?.EMAIL;
	} catch {
		// Outside a request (scripts, tests) there is no platform, so no binding.
	}
	return { binding, from: env.EMAIL_FROM };
}

/** Sends `message` to `to` with the current request's binding and sender. */
export function sendAccountEmail(to: string, message: EmailMessage): Promise<boolean> {
	return sendEmail(requestEmailTransport(), to, message);
}
