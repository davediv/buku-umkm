<script lang="ts">
	import TabList from './tab-list.svelte';
</script>

<TabList label="Jenis transaksi">
	<a href="#income" role="tab" aria-selected="true" tabindex="0">Pemasukan</a>
	<a href="#expense" role="tab" aria-selected="false" tabindex="-1">Pengeluaran</a>
</TabList>
