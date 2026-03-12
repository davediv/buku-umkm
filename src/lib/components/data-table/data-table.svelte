<script lang="ts" generics="T extends { id?: string | number }">
	import { Search, ChevronUp, ChevronDown } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell,
		TableCaption
	} from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import type { DataTableProps } from './index';

	type Props<T> = DataTableProps<T>;

	let { data, columns, caption, searchPlaceholder = 'Cari...', pageSize = 10 }: Props<T> = $props();

	let searchQuery = $state('');
	let currentPage = $state(1);
	let sortColumn = $state<string | null>(null);
	let sortDirection = $state<'asc' | 'desc'>('asc');

	// Get all searchable keys from columns
	const searchableKeys = $derived(columns.map((col) => col.key));

	// Filter data based on search query
	const filteredData = $derived.by(() => {
		if (!searchQuery.trim()) return data;

		const query = searchQuery.toLowerCase();
		const keys = searchableKeys;
		return data.filter((item) => {
			return keys.some((key) => {
				const value = item[key as keyof T];
				if (value === null || value === undefined) return false;
				return String(value).toLowerCase().includes(query);
			});
		});
	});

	// Sort data
	const sortedData = $derived.by(() => {
		if (!sortColumn) return filteredData;

		return [...filteredData].sort((a, b) => {
			const aValue = a[sortColumn as keyof typeof a];
			const bValue = b[sortColumn as keyof typeof b];

			if (aValue === null || aValue === undefined) return 1;
			if (bValue === null || bValue === undefined) return -1;

			let comparison = 0;
			if (typeof aValue === 'number' && typeof bValue === 'number') {
				comparison = aValue - bValue;
			} else {
				comparison = String(aValue).localeCompare(String(bValue));
			}

			return sortDirection === 'asc' ? comparison : -comparison;
		});
	});

	// Paginate data
	const totalPages = $derived(Math.ceil(sortedData.length / pageSize));
	const paginatedData = $derived(
		sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	function handleSort(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	function handleSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		currentPage = 1; // Reset to first page on search
	}

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	// Pre-computed page numbers for pagination
	const pageNumbers = $derived(Array.from({ length: totalPages }, (_, i) => i));

	function getValue(item: T, key: string | keyof T | ((item: T) => string)): string | undefined {
		if (typeof key === 'function') {
			return key(item);
		}
		const value = item[key as keyof T];
		return value !== null && value !== undefined ? String(value) : undefined;
	}
</script>

<div class="space-y-4">
	<!-- Search Input -->
	<div class="flex items-center gap-2">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<Input
				type="search"
				placeholder={searchPlaceholder}
				value={searchQuery}
				oninput={handleSearch}
				class="pl-9"
			/>
		</div>
	</div>

	<!-- Table -->
	<div class="rounded-md border">
		<Table>
			{#if caption}
				<TableCaption>{caption}</TableCaption>
			{/if}
			<TableHeader>
				<TableRow>
					{#each columns as column (column.key)}
						<TableHead>
							{#if column.sortable}
								<button
									class="flex items-center gap-1 hover:text-foreground transition-colors"
									onclick={() => handleSort(String(column.key))}
								>
									{column.label}
									{#if sortColumn === column.key}
										{#if sortDirection === 'asc'}
											<ChevronUp class="h-4 w-4" />
										{:else}
											<ChevronDown class="h-4 w-4" />
										{/if}
									{/if}
								</button>
							{:else}
								{column.label}
							{/if}
						</TableHead>
					{/each}
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if paginatedData.length === 0}
					<TableRow>
						<TableCell colspan={columns.length} class="h-24 text-center text-muted-foreground">
							Tidak ada data
						</TableCell>
					</TableRow>
				{:else}
					{#each paginatedData as item (item.id)}
						<TableRow>
							{#each columns as column (column.key)}
								<TableCell>
									{#if column.render}
										{column.render(item)}
									{:else}
										{getValue(item, column.key) ?? '-'}
									{/if}
								</TableCell>
							{/each}
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(
					currentPage * pageSize,
					sortedData.length
				)} dari {sortedData.length} data
			</p>
			<div class="flex items-center gap-1">
				<Button
					variant="outline"
					size="sm"
					onclick={() => goToPage(currentPage - 1)}
					disabled={currentPage === 1}
				>
					Sebelumnya
				</Button>
				{#each pageNumbers as i (i)}
					{#if i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
						<Button
							variant={currentPage === i + 1 ? 'default' : 'outline'}
							size="sm"
							onclick={() => goToPage(i + 1)}
						>
							{i + 1}
						</Button>
					{:else if i + 1 === currentPage - 2 || i + 1 === currentPage + 2}
						<span class="px-2">...</span>
					{/if}
				{/each}
				<Button
					variant="outline"
					size="sm"
					onclick={() => goToPage(currentPage + 1)}
					disabled={currentPage === totalPages}
				>
					Berikutnya
				</Button>
			</div>
		</div>
	{/if}
</div>
