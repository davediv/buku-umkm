<script lang="ts">
	import { AlertDialog, AlertDialogCancel, AlertDialogDescription, AlertDialogTitle } from '.';

	let open = $state(false);
</script>

<button onclick={() => (open = true)}>Hapus data</button>

<AlertDialog {open} onopenchange={(nextOpen) => (open = nextOpen)}>
	<AlertDialogTitle>Hapus data?</AlertDialogTitle>
	<AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
	<AlertDialogCancel>Batal</AlertDialogCancel>
</AlertDialog>
