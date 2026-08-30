<script lang="ts">
	import Dialog from './dialog.svelte';

	let open = $state(false);
</script>

<button onclick={() => (open = true)}>Buka dialog</button>

<Dialog {open} onopenchange={(nextOpen) => (open = nextOpen)} ariaLabel="Dialog pengujian">
	<button data-dialog-initial-focus>Batalkan</button>
	<button>Simpan</button>
</Dialog>
