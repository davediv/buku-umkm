export const ALERT_DIALOG_CONTEXT = Symbol('alert-dialog');

export type AlertDialogContext = {
	close: () => void;
};
