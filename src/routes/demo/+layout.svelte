<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<main id="main-content" tabindex="-1">
	{@render children()}
</main>
