import { DrizzleQueryError } from 'drizzle-orm';

const MAX_MESSAGE_LENGTH = 200;

function isQueryError(error: Error): boolean {
	return error instanceof DrizzleQueryError || error.message.startsWith('Failed query:');
}

function nameOf(error: Error): string {
	// DrizzleQueryError does not set `name`, so it would read as a plain "Error".
	return error instanceof DrizzleQueryError ? 'DrizzleQueryError' : error.name || 'Error';
}

function messageOf(error: Error): string {
	// Drizzle's message is "Failed query: <sql>\nparams: <every bound value>".
	if (isQueryError(error)) return 'Failed query';
	// Driver messages quote offending values (D1_TYPE_ERROR: ... for value '...').
	const firstLine = error.message.split('\n', 1)[0] ?? '';
	return firstLine.replace(/'[^']*'|"[^"]*"/g, "'…'").slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * A log line for an error that carries no user data: the error's name and the
 * first line of its message, plus the same for its direct cause. Logging the
 * error itself would print a Drizzle query error's SQL with every bound
 * parameter, such as the business and owner names a user just typed.
 */
export function summarizeError(error: unknown): string {
	if (!(error instanceof Error)) return `non-Error value thrown (${typeof error})`;
	const summary = `${nameOf(error)}: ${messageOf(error)}`;
	if (!(error.cause instanceof Error)) return summary;
	return `${summary} (cause: ${nameOf(error.cause)}: ${messageOf(error.cause)})`;
}
