export interface AttachmentUploadFailure<T> {
	attachment: T;
	error: string;
}

export interface AttachmentUploadOutcome<T> {
	succeeded: T[];
	failed: AttachmentUploadFailure<T>[];
}

export async function uploadAttachments<T>(
	attachments: T[],
	upload: (attachment: T) => Promise<void>
): Promise<AttachmentUploadOutcome<T>> {
	const settled = await Promise.allSettled(attachments.map((attachment) => upload(attachment)));
	const outcome: AttachmentUploadOutcome<T> = { succeeded: [], failed: [] };

	settled.forEach((result, index) => {
		const attachment = attachments[index];
		if (result.status === 'fulfilled') {
			outcome.succeeded.push(attachment);
		} else {
			outcome.failed.push({
				attachment,
				error: result.reason instanceof Error ? result.reason.message : 'Unggahan gagal'
			});
		}
	});

	return outcome;
}
