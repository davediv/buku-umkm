import DataTable from './data-table.svelte';

export { DataTable };

export type DataTableColumn<T> = {
	key: keyof T | string;
	label: string;
	sortable?: boolean;
	render?: (item: T) => string | undefined;
};

export type DataTableProps<T> = {
	data: T[];
	columns: DataTableColumn<T>[];
	caption?: string;
	searchPlaceholder?: string;
	pageSize?: number;
};
